
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, getSession, removeSession } from '@/lib/auth';

// Helper function to create a Supabase client.
// Can be configured to use the service_role key for admin-level access.
const createSupabaseClient = (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    // For server-side actions, we use the service role key.
    // RLS policies that depend on `auth.uid()` will still work correctly 
    // as long as we pass the user_id in the operations.
    return createClient(supabaseUrl, serviceRole ? supabaseServiceKey : supabaseAnonKey);
}

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});


export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  const supabase = createSupabaseClient(true);
  const session = await getSession();
  if(!session) throw new Error("Not authenticated");

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
    const supabase = createSupabaseClient(true);
    const session = await getSession();
    if(!session) throw new Error("Not authenticated");

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
    const session = await getSession();
    if (!session) throw new Error("User not authenticated for append operation.");
    if (session.role !== 'admin') throw new Error("Only admins can add new data.");
    
    // We create the client here and pass the JWT to properly authenticate the request
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            },
        }
    );

    // The user_id is now automatically handled by RLS policies because the request is authenticated.
    // We no longer need to manually add it.
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
  const session = await getSession();
  if (!session) throw new Error("User not authenticated for update operation.");
  if (session.role !== 'admin') throw new Error("Only admins can update data.");
  const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            },
        }
    );
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
  const session = await getSession();
  if (!session) throw new Error("User not authenticated for delete operation.");
  if (session.role !== 'admin') throw new Error("Only admins can delete data.");
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            },
        }
    );
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
    const session = await getSession();
    if (!session) throw new Error("User not authenticated for restore operation.");
    if (session.role !== 'admin') throw new Error("Only admins can restore data.");
     const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            },
        }
    );
    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: null })
        .eq('id', input.id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function exportAllData() {
    const supabase = createSupabaseClient(true);
    const session = await getSession();
    if (!session) throw new Error("No active session for export.");
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
    const supabase = createSupabaseClient(true);
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
    const session = await getSession();
    if (!session) throw new Error("No active session for import.");
    if (session.role !== 'admin') throw new Error("Only admins can import data.");
    
    try {
        for (const table of tables) {
             const { error: deleteError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
             if (deleteError && deleteError.code !== '42P01') {
                console.error(`Failed to clear ${table}: ${deleteError.message}`);
                throw new Error(`Failed to clear ${table}: ${deleteError.message}`);
            }
        }

        const adminUsers = (await getUsers()).filter(u => u.role === 'admin');
        if (adminUsers.length === 0) throw new Error("Cannot import data, no admin user exists to own the data.");
        const primaryAdminId = adminUsers[0].id;

        for (const tableName of tables) {
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                 records.forEach(r => {
                    // Assign all imported data to the primary admin
                    r.user_id = primaryAdminId;
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
    const supabase = createSupabaseClient(true);
    const session = await getSession();
    if (!session) throw new Error("No active session to delete data.");
    if (session.role !== 'admin') throw new Error("Only admins can delete all data.");

    try {
        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if(userError) throw userError;

        for(const user of users.users) {
            if (user.id !== session.id) { // Don't delete the current admin
                 await supabase.auth.admin.deleteUser(user.id);
            }
        }
        
        const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions'];
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            if (error && error.code !== '42P01') {
                console.error(`Error deleting from ${tableName}:`, error);
                throw new Error(`Failed to delete data from ${tableName}.`);
            }
        }
        
        await logout(); // Log out the current user as well, forcing a new session

        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete all data:", error);
        throw new Error(error.message || "An unknown error occurred during data deletion.");
    }
}

// --- Auth Actions ---

const LoginInputSchema = z.object({
    username: z.string().email("Username must be a valid email address."),
    password: z.string(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    const supabase = createSupabaseClient(); // Use anon client for login
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: input.username,
        password: input.password,
    });
    
    if (error) {
        if (error.message === 'Invalid login credentials') {
             const supabaseAdmin = createSupabaseClient(true);
             const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

             // If this is the first user ever, create them as an admin
             if(allUsers?.users.length === 0) {
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: input.username,
                    password: input.password,
                    email_confirm: true, // auto-confirm for simplicity
                    user_metadata: { role: 'admin' } 
                });
                if(createError) throw new Error(createError.message);
             } else {
                throw new Error(error.message); // If users exist, don't auto-create
             }
            
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: input.username,
                password: input.password,
            });
            if(loginError) throw new Error(loginError.message);

            const sessionPayload = {
                id: loginData.user.id,
                username: loginData.user.email!,
                role: loginData.user.user_metadata.role || 'user',
                accessToken: loginData.session.access_token,
            };
            await createSession(sessionPayload);
            return { success: true };
        }
        throw new Error(error.message);
    }
    
    const sessionData = {
        id: data.user.id,
        username: data.user.email!,
        role: data.user.user_metadata.role || 'user',
        accessToken: data.session.access_token,
    }
    
    await createSession(sessionData);
    return { success: true };
}

export async function getUsers() {
    const supabase = createSupabaseClient(true);
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
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can add users.");

    const supabase = createSupabaseClient(true);
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
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can delete users.");

    const supabase = createSupabaseClient(true);
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return { success: true };
}

async function logout() {
  await removeSession();
  // We can't use redirect() here because this is not a component.
  // The client will handle the redirection.
}
    

    
