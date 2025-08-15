
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, getSession } from '@/lib/auth';

// Helper function to create a Supabase client.
// Can be configured to use the service_role key for admin-level access.
// When not using service role, it will try to impersonate the logged-in user.
const createSupabaseClient = async (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = serviceRole
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
    });
    
    // If not using service role, try to impersonate the user based on session
    if (!serviceRole) {
        const user = await getSession();
        if (user) {
            // This is a critical step for RLS.
            // We use the admin client to set the current user for this request.
            const adminAuthClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!).auth.admin;
            const { data: { user: impersonatedUser }, error } = await adminAuthClient.getUserById(user.id);
            if (error || !impersonatedUser) {
                 console.error("Error impersonating user:", error?.message);
                 throw new Error("Could not authenticate user for server action.");
            }
            supabase.auth.setSession({
                access_token: 'dummy-token', // It needs a token, but the user is set by admin
                refresh_token: 'dummy-token',
                user: impersonatedUser,
            });
        }
    }
    
    return supabase;
}

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});

export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  const supabase = await createSupabaseClient();
  let query = supabase
    .from(input.tableName)
    .select(input.select);

  // Only apply the soft-delete filter to tables that have the column
  if (['cash_transactions', 'bank_transactions', 'stock_transactions'].includes(input.tableName)) {
    query = query.is('deletedAt', null);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data;
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from(input.tableName)
        .select(input.select)
        .not('deletedAt', 'is', null); // Only fetch soft-deleted items

    if (error) throw new Error(error.message);
    return data;
}

const AppendDataInputSchema = z.object({
  tableName: z.string(),
  data: z.record(z.any()),
});

export async function appendData(input: z.infer<typeof AppendDataInputSchema>) {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from(input.tableName)
    .insert([input.data])
    .select();

  if (error) throw new Error(error.message);
  return data;
}

const UpdateDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
  data: z.record(z.any()),
});

export async function updateData(input: z.infer<typeof UpdateDataInputSchema>) {
  const supabase = await createSupabaseClient();
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
    const supabase = await createSupabaseClient();
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories'];
    const exportedData: Record<string, any[]> = {};

    for (const tableName of tables) {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw new Error(`Error exporting ${tableName}: ${error.message}`);
        exportedData[tableName] = data;
    }

    return exportedData;
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = await createSupabaseClient(true); // Use service role for import
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'users'];
    
    try {
        // Clear existing data (except users)
        for (const tableName of tables.filter(t => t !== 'users').reverse()) {
            const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) throw new Error(`Failed to clear ${tableName}: ${deleteError.message}`);
        }

        // Import new data
        for (const tableName of tables) {
             if (tableName === 'users') continue; // Don't import users this way for security
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                const { error: insertError } = await supabase.from(tableName).upsert(records);
                if (insertError) throw new Error(`Failed to import to ${tableName}: ${insertError.message}`);
            }
        }
        return { success: true };
    } catch(error: any) {
        console.error("Batch import failed:", error);
        throw error;
    }
}

export async function deleteAllData() {
    const supabase = await createSupabaseClient(true); // Use service role to delete
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories'];
    try {
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
                console.error(`Error deleting from ${tableName}:`, error);
                throw new Error(`Failed to delete data from ${tableName}.`);
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to delete all data:", error);
        throw error;
    }
}

// --- Auth Actions ---

const LoginInputSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    // Use the service role client to bypass RLS for login check
    const supabase = await createSupabaseClient(true); 
    
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', input.username)
        .single();
    
    if (error || !user) {
        throw new Error("Invalid username or password.");
    }

    // IMPORTANT: In a real app, you MUST hash passwords.
    // This is a major security vulnerability.
    if (user.password !== input.password) {
        throw new Error("Invalid username or password.");
    }
    
    // Don't include password in the session cookie
    const { password, ...sessionData } = user;
    await createSession(sessionData);
    return { success: true };
}

export async function getUsers() {
    const supabase = await createSupabaseClient();
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
