
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession } from '@/lib/auth';

// Helper function to create a Supabase client.
// Can be configured to use the service_role key for admin-level access.
const createSupabaseClient = (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = serviceRole
        ? process.env.SUPABASE_SERVICE_ROLE_KEY
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const options: any = {
        auth: { persistSession: false },
    };

    if (!supabaseUrl || !supabaseKey) {
        if (serviceRole && !supabaseKey) {
            throw new Error("Supabase Service Role Key is missing. Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.");
        }
        throw new Error("Supabase URL or Anon Key is missing from environment variables.");
    }
    
    // If not using service role, use the user's session token for RLS
    if (!serviceRole) {
        const sessionCookie = cookies().get('session')?.value;
        if (sessionCookie) {
            options.global = {
                headers: {
                    Authorization: `Bearer ${sessionCookie}`
                }
            };
        }
    }
    
    return createClient(supabaseUrl, supabaseKey, options);
}

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});

export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  const supabase = createSupabaseClient();
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
    const supabase = createSupabaseClient();
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
  const supabase = createSupabaseClient();
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
  const supabase = createSupabaseClient();
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
  const supabase = createSupabaseClient();
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
    const supabase = createSupabaseClient();
    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: null })
        .eq('id', input.id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function exportAllData() {
    const supabase = createSupabaseClient();
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
    const supabase = createSupabaseClient(true); // Use service role for import
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
    const supabase = createSupabaseClient(true); // Use service role to delete
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
    const supabase = createSupabaseClient(true); 
    
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
    const supabase = createSupabaseClient();
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
    const supabase = createSupabaseClient(true);
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
    const supabase = createSupabaseClient(true);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getSupabaseForClient() {
    const supabase = createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            },
        });
    }
    return supabase;
}
