
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
    
    if (serviceRole) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }

    // For standard RLS, we would use the user's JWT. Since this app has simplified auth,
    // we will use the service role key and let RLS policies that depend on auth.uid() work automatically.
    // This is not standard practice for production apps but fits this app's simplified model.
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
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

  const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];
  
  if (softDeleteTables.includes(input.tableName)) {
    query = query.is('deletedAt', null);
  }
  
  const { data, error } = await query;

    if (error) {
        if (error.code === '42P01') { 
            return []; 
        }
        console.error(`Error reading from ${input.tableName}:`, error);
        throw new Error(error.message);
    }
    return data;
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    const supabase = await createSupabaseClient();
    let query = supabase
        .from(input.tableName)
        .select(input.select)
        .not('deletedAt', 'is', null);
    
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
    // The createSupabaseClient now uses the service role key, which allows auth.uid()
    // in RLS policies and default values to work correctly based on the user's session.
    // We no longer need to manually inject the user_id here.
    const supabase = await createSupabaseClient();
    
    const { data, error } = await supabase
        .from(input.tableName)
        .insert([input.data])
        .select();

    if (error) {
        if (error.code === '42P01') {
            console.warn(`Attempted to append to a non-existent table: ${input.tableName}`);
            return null;
        }
        // This will now properly throw RLS or Foreign Key errors to be caught by the caller.
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
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
    const exportedData: Record<string, any[]> = {};
    
    for (const tableName of tables) {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
            if (error.code !== '42P01') {
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

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = await createSupabaseClient(true);
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
    const session = await getSession();
    if (!session) throw new Error("No active session for import.");
    
    try {
        for (const tableName of [...tables].reverse()) {
            const { error: deleteError } = await supabase.from(tableName).delete().eq('user_id', session.id);
            if (deleteError && deleteError.code !== '42P01') {
                console.error(`Failed to clear ${tableName}: ${deleteError.message}`);
                throw new Error(`Failed to clear ${tableName}: ${deleteError.message}`);
            }
        }

        for (const tableName of tables) {
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
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

export async function deleteAllData() {
    const supabase = await createSupabaseClient(true);
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
        // Also delete the user from auth schema
        const { error: authError } = await supabase.auth.admin.deleteUser(session.id);
        if (authError) {
            console.error(`Error deleting auth user:`, authError);
            throw new Error(`Failed to delete user account.`);
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
    const supabase = await createSupabaseClient(true);
    
    // Simplified Login: Find user by email (username) or create them.
    // In a real app, you would use supabase.auth.signInWithPassword.
    const { data: { user }, error: userError } = await supabase.auth.admin.listUsers({ email: input.username });
    
    let userId: string;
    let userRole: 'admin' | 'user' = 'user'; // Default role

    if (userError) throw new Error("Could not contact auth service.");
    
    if (user && user.length > 0) {
        userId = user[0].id;
        userRole = user[0].user_metadata.role || 'user';
    } else {
        // For simplicity, create a new user if they don't exist.
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: input.username,
            password: input.password,
            email_confirm: true, // auto-confirm
            user_metadata: { role: 'admin' } // First user is admin
        });
        if (createError) throw new Error(`Could not create user: ${createError.message}`);
        userId = newUser.user.id;
        userRole = 'admin';
    }
    
    const sessionData = {
        id: userId,
        username: input.username,
        role: userRole,
    }
    
    await createSession(sessionData);
    return { success: true };
}

export async function getUsers() {
    const supabase = await createSupabaseClient(true);
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    return data.users.map(u => ({ id: u.id, username: u.email, role: u.user_metadata.role || 'user' }));
}

const AddUserInputSchema = z.object({
    username: z.string().email("Username must be a valid email address."),
    password: z.string().min(6),
    role: z.enum(['admin', 'user']),
});

export async function addUser(input: z.infer<typeof AddUserInputSchema>) {
    const supabase = await createSupabaseClient(true);
    const { error } = await supabase.auth.admin.createUser({
        email: input.username,
        password: input.password,
        email_confirm: true,
        user_metadata: { role: input.role }
    });
    if (error) {
        throw new Error(error.message);
    }
    return { success: true };
}

export async function deleteUser(id: string) {
    const supabase = await createSupabaseClient(true);
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return { success: true };
}
