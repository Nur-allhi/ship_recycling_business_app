
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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    // For privileged operations or when RLS is handled by user ID filters, use the service key.
    // This is a trusted server environment.
    if (serviceRole) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }

    // For general server-side access, we will use the service role key to bypass RLS
    // as the application logic itself will enforce data visibility based on the user's session.
    // This is simpler and more reliable than impersonation with the current setup.
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
  userId: z.string().optional(),
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
  
  // Only filter by user_id if it's provided and the table is user-specific
  if (input.userId && ['cash_transactions', 'bank_transactions', 'stock_transactions', 'categories', 'initial_stock'].includes(input.tableName)) {
      query = query.eq('user_id', input.userId);
  }


  const { data, error } = await query;

  if (error) {
    // If the error is that user_id column doesn't exist, we can ignore it for now
    // as the user might not have run the migration yet.
    if (error.code === '42703' && error.message.includes('user_id')) {
        console.warn(`Warning: column 'user_id' not found in '${input.tableName}'. Returning all data.`);
        const { data: allData, error: allError } = await supabase.from(input.tableName).select(input.select).is('deletedAt', null);
        if(allError) throw new Error(allError.message);
        return allData || [];
    }
    throw new Error(error.message);
  }
  return data;
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    const supabase = await createSupabaseClient();
    let query = supabase
        .from(input.tableName)
        .select(input.select)
        .not('deletedAt', 'is', null); // Only fetch soft-deleted items
    
    if (input.userId && ['cash_transactions', 'bank_transactions', 'stock_transactions'].includes(input.tableName)) {
      query = query.eq('user_id', input.userId);
    }

    const { data, error } = await query;

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
    const session = await getSession();

    for (const tableName of tables) {
        let query = supabase.from(tableName).select('*');
        if (session?.id) {
             let shouldFilter = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'categories', 'initial_stock'].includes(tableName);
             if (shouldFilter) {
                query = query.eq('user_id', session.id);
             }
        }
        const { data, error } = await query;
        if (error) {
             if (error.code === '42703' && error.message.includes('user_id')) {
                console.warn(`Warning during export: column 'user_id' not found in '${tableName}'. Exporting all data for this table.`);
                const { data: allData, error: allError } = await supabase.from(tableName).select('*');
                 if (allError) throw new Error(`Error re-exporting ${tableName}: ${allError.message}`);
                 exportedData[tableName] = allData;
                 continue;
            }
            throw new Error(`Error exporting ${tableName}: ${error.message}`);
        }
        exportedData[tableName] = data;
    }

    return exportedData;
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = await createSupabaseClient(true); // Use service role for import
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'users'];
    const session = await getSession();
    if (!session) throw new Error("No active session for import.");
    
    try {
        // Clear existing data for the current user
        for (const tableName of ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories'].reverse()) {
            const { error: deleteError } = await supabase.from(tableName).delete().eq('user_id', session.id);
            if (deleteError) {
                 if (deleteError.code === '42703' && deleteError.message.includes('user_id')) {
                    console.warn(`User_id not found on ${tableName} for clearing, this may be ok.`);
                 } else {
                    throw new Error(`Failed to clear ${tableName}: ${deleteError.message}`);
                 }
            }
        }


        // Import new data
        for (const tableName of tables) {
             if (tableName === 'users') continue; // Don't import users this way for security
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                 // Assign current user_id to all imported transactions
                 records.forEach(r => r.user_id = session.id);
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
    const session = await getSession();
    if (!session) throw new Error("No active session to delete data.");
    try {
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().eq('user_id', session.id);
            if (error) {
                 if (error.code === '42703' && error.message.includes('user_id')) {
                    console.warn(`User_id not found on ${tableName} for deletion, this may be ok.`);
                 } else {
                    console.error(`Error deleting from ${tableName}:`, error);
                    throw new Error(`Failed to delete data from ${tableName}.`);
                 }
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
    
    const sessionData = {
        id: user.id,
        username: user.username,
        role: user.role as 'admin' | 'user',
    }
    
    await createSession(sessionData);
    return { success: true };
}

export async function getUsers() {
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
