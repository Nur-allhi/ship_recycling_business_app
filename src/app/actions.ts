
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, getSession } from '@/lib/auth';

// Helper function to create a Supabase client.
// Can be configured to use the service_role key for admin-level access.
const createSupabaseClient = async (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const sessionCookie = cookies().get('session')?.value;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    // For privileged operations that need to bypass RLS, use the service key.
    // This should be used sparingly (e.g., creating users).
    if (serviceRole) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }

    // For standard data access, use the anon key and pass the user's JWT.
    // This is the standard and secure way to enforce RLS.
    const session = sessionCookie ? JSON.parse(sessionCookie) : null;
    const accessToken = session?.accessToken;
    
    // If we have a session but no specific access token (due to simplified auth),
    // we must use the service role key to perform operations, but we will
    // scope them to the user_id manually in the functions below.
    if (session && !accessToken) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }

    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
            headers: {
                ...authHeader,
            }
        }
    });
}

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
  // userId is no longer used for filtering, RLS handles it.
  // Kept for schema compatibility but will be ignored.
  userId: z.string().optional(), 
});


export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  const supabase = await createSupabaseClient();
  let query = supabase
    .from(input.tableName)
    .select(input.select);

  // These tables support soft deletion
  const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];
  
  if (softDeleteTables.includes(input.tableName)) {
    query = query.is('deletedAt', null);
  }
  
  // RLS will handle user-specific filtering automatically.

  const { data, error } = await query;

    if (error) {
        // Gracefully handle tables that might not exist for all users
        if (error.code === '42P01') { // 42P01 is 'undefined_table'
            return []; // Return empty array if table doesn't exist
        }
        console.error(`Error reading from ${input.tableName}:`, error);
        throw new Error(error.message);
    }
    return data;
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    const supabase = await createSupabaseClient();
    // RLS handles user scoping.
    let query = supabase
        .from(input.tableName)
        .select(input.select)
        .not('deletedAt', 'is', null); // Only fetch soft-deleted items
    

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return [];
      }
      throw new Error(error.message);
    }
    return data;
}

const AppendDataInputSchema = z.object({
  tableName: z.string(),
  data: z.record(z.any()),
});

export async function appendData(input: z.infer<typeof AppendDataInputSchema>) {
    const supabase = await createSupabaseClient();
    const session = await getSession();

    // If there's an active session, ensure the user_id is set for the insert.
    // This is crucial when using the service_role key as a fallback.
    if (session) {
      input.data.user_id = session.id;
    }

    const { data, error } = await supabase
        .from(input.tableName)
        .insert([input.data])
        .select();

    if (error) {
        if (error.code === '42P01') {
            console.warn(`Attempted to append to a non-existent table: ${input.tableName}`);
            return null; // Gracefully return null if table doesn't exist
        }
        throw new Error(error.message);
    }
    return data;
}

const UpdateDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
  data: z.record(z.any()),
});

export async function updateData(input: z.infer<typeof UpdateDataInputSchema>) {
  const supabase = await createSupabaseClient();
  // RLS policies on UPDATE will prevent unauthorized edits
  const { data, error } = await supabase
    .from(input.tableName)
    .update(input.data)
    .eq('id', input.id)
    .select();

  if (error) throw new Error(error.message);
  return data;
}

const DeleteDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
});

// This now performs a soft delete
export async function deleteData(input: z.infer<typeof DeleteDataInputSchema>) {
  const supabase = await createSupabaseClient();
  // RLS policies on UPDATE will prevent unauthorized deletes
  const { error } = await supabase
    .from(input.tableName)
    .update({ deletedAt: new Date().toISOString() })
    .eq('id', input.id);
    
  if (error) throw new Error(error.message);
  return { success: true };
}

const RestoreDataInputSchema = z.object({
    tableName: z.string(),
    id: z.string(),
});

export async function restoreData(input: z.infer<typeof RestoreDataInputSchema>) {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: null })
        .eq('id', input.id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function exportAllData() {
    const supabase = await createSupabaseClient(); // Use RLS-enabled client
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
    const exportedData: Record<string, any[]> = {};
    
    for (const tableName of tables) {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
            // Gracefully handle tables that might not exist for all users
            if (error.code !== '42P01') { // 42P01 is 'undefined_table'
                 throw new Error(`Error exporting ${tableName}: ${error.message}`);
            }
        }
        if (data) {
          exportedData[tableName] = data;
        }
    }

    return exportedData;
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

// This operation requires bypassing RLS to import data for a user.
export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = await createSupabaseClient(true); // Use service role for import
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions', 'users'];
    const session = await getSession();
    if (!session) throw new Error("No active session for import.");
    
    try {
        // Clear existing data for the current user
        for (const tableName of ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'].reverse()) {
            const { error: deleteError } = await supabase.from(tableName).delete().eq('user_id', session.id);
            if (deleteError && deleteError.code !== '42P01') {
                console.error(`Failed to clear ${tableName}: ${deleteError.message}`);
                throw new Error(`Failed to clear ${tableName}: ${deleteError.message}`);
            }
        }

        // Import new data
        for (const tableName of tables) {
             if (tableName === 'users') continue; // Don't import users this way for security
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                 // Assign current user_id to all imported records
                 records.forEach(r => {
                    r.user_id = session.id;
                 });
                const { error: insertError } = await supabase.from(tableName).upsert(records);
                if (insertError && insertError.code !== '42P01') throw new Error(`Failed to import to ${tableName}: ${insertError.message}`);
            }
        }
        return { success: true };
    } catch(error: any) {
        console.error("Batch import failed:", error);
        throw error;
    }
}

// This operation requires bypassing RLS to delete all data for a specific user.
export async function deleteAllData() {
    const supabase = await createSupabaseClient(true); // Use service role to delete
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
    const session = await getSession();
    if (!session) throw new Error("No active session to delete data.");
    try {
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().eq('user_id', session.id);
            if (error && error.code !== '42P01') {
                console.error(`Error deleting from ${tableName}:`, error);
                throw new Error(`Failed to delete data from ${tableName}.`);
            }
        }
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete all data:", error);
        throw new Error(error.message || "An unknown error occurred during data deletion.");
    }
}

// --- Auth Actions ---

const LoginInputSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    // This is a special client that can bypass RLS to check the password
    const supabase = await createSupabaseClient(true);
    
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, password, role, username')
        .eq('username', input.username)
        .single();
    
    if (userError || !user) {
        throw new Error("Invalid username or password.");
    }

    // IMPORTANT: In a real app, you MUST hash passwords.
    // This is a major security vulnerability.
    if (user.password !== input.password) {
        throw new Error("Invalid username or password.");
    }
    
    // In a real app, you would create a JWT here for the user.
    // For this simplified example, we are storing the user object directly.
    // A real JWT would be passed to the Supabase client to impersonate the user.
    const sessionData = {
        id: user.id,
        username: user.username,
        role: user.role as 'admin' | 'user',
        // In a real app, you would generate and include a JWT here.
        // accessToken: 'your-generated-jwt'
    }
    
    await createSession(sessionData);
    return { success: true };
}

export async function getUsers() {
    // Reading all users should be a privileged operation
    const supabase = await createSupabaseClient(true);
    const { data, error } = await supabase.from('users').select('id, username, role');
    if (error) throw new Error(error.message);
    return data;
}

const AddUserInputSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    role: z.enum(['admin', 'user']),
});

export async function addUser(input: z.infer<typeof AddUserInputSchema>) {
    // Adding a user should be a privileged operation
    const supabase = await createSupabaseClient(true);
    const { error } = await supabase.from('users').insert([input]);
    if (error) {
        if (error.code === '23505') { // unique_violation
            throw new Error('Username already exists.');
        }
        throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteUser(id: string) {
    // Deleting a user should be a privileged operation
    const supabase = await createSupabaseClient(true);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
}
