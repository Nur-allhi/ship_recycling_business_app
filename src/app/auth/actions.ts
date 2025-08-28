
'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createSession, getSession as getSessionFromCookie, removeSession } from '@/lib/auth';
import { cookies } from 'next/headers';

// Helper function to create a Supabase client.
const createSupabaseClient = (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    const supabaseKey = serviceRole ? supabaseServiceKey : supabaseAnonKey;

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            // Prevent the server-side client from using cookies, as we're managing them manually.
            persistSession: false,
            autoRefreshToken: false,
        }
    });
}

const logActivity = async (description: string) => {
    try {
        const session = await getSession();
        if (!session) return; // Don't log if no session
        
        const supabase = createSupabaseClient(true);
        await supabase.from('activity_log').insert({ 
            description,
            user_id: session.id,
            username: session.username, 
        });
    } catch(e) {
        console.error("Failed to log activity:", e);
    }
}

export async function getSession() {
    return await getSessionFromCookie();
}

export async function hasUsers() {
    const supabaseAdmin = createSupabaseClient(true);
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if(error) throw new Error(error.message);
    return data.users.length > 0;
}

const LoginInputSchema = z.object({
    username: z.string().email("Username must be a valid email address."),
    password: z.string(),
    rememberMe: z.boolean().optional(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    const supabase = createSupabaseClient();
    let isFirstUser = false;
    
    let { data, error } = await supabase.auth.signInWithPassword({
        email: input.username,
        password: input.password,
    });
    
    if (error) {
        if (error.message === 'Invalid login credentials') {
             const supabaseAdmin = createSupabaseClient(true);
             const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

             if(allUsers?.users.length === 0) {
                isFirstUser = true;
                const { error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: input.username,
                    password: input.password,
                    email_confirm: true, 
                    user_metadata: { role: 'admin' } 
                });
                if(createError) throw new Error(createError.message);
             } else {
                throw new Error(error.message);
             }
            
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: input.username,
                password: input.password,
            });
            if(loginError) throw new Error(loginError.message);
            data = loginData;
        } else {
           throw new Error(error.message);
        }
    }
    
    if (!data.user || !data.session) {
        throw new Error("Login failed: could not retrieve user session.");
    }
    
    const sessionPayload = {
        id: data.user.id,
        username: data.user.email!,
        role: data.user.user_metadata.role || 'user',
        accessToken: data.session.access_token,
    };
    
    await createSession(sessionPayload, input.rememberMe);

    let needsData = false;
    if (!isFirstUser) {
        // We use the service role key to check for data existence
        const tempAuthedSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { count: cashCount, error: cashError } = await tempAuthedSupabase.from('cash_transactions').select('id', { count: 'exact', head: true });
        if (cashError && cashError.code !== '42P01') throw cashError;
        const { count: bankCount, error: bankError } = await tempAuthedSupabase.from('bank_transactions').select('id', { count: 'exact', head: true });
        if (bankError && bankError.code !== '42P01') throw bankError;
        needsData = (cashCount ?? 0) === 0 && (bankCount ?? 0) === 0;
    }
    
    if (isFirstUser) {
        await logActivity("Created the first admin user and logged in.");
    } else {
        await logActivity("User logged in.");
    }

    return { 
        success: true, 
        needsInitialBalance: isFirstUser || needsData,
        session: sessionPayload 
    };
}

export async function logout() {
  await logActivity("User logged out.");
  await removeSession();
}

export async function getUsers() {
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can view users.");

    const supabase = createSupabaseClient(true);
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    return data.users.map(u => ({ id: u.id, username: u.email || 'N/A', role: u.user_metadata.role || 'user' }));
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
    await logActivity(`Added new user: ${input.username} with role: ${input.role}`);
    return { success: true };
}

export async function deleteUser(id: string) {
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can delete users.");

    const supabase = createSupabaseClient(true);
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    
    await logActivity(`Deleted user with ID: ${id}`);
    return { success: true };
}
