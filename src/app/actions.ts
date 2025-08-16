
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, getSession, removeSession } from '@/lib/auth';

// Helper function to create a Supabase client.
const createSupabaseClient = (serviceRole = false) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Supabase URL, Anon Key, or Service Role Key is missing from environment variables.");
    }
    
    return createClient(supabaseUrl, serviceRole ? supabaseServiceKey : supabaseAnonKey);
}

const getAuthenticatedSupabaseClient = async () => {
    const session = await getSession();
    if (!session?.accessToken) {
        // This will trigger a logout on the client-side if the session is missing or invalid
        throw new Error("User not authenticated.");
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${session.accessToken}` },
            },
        }
    );
};


const handleApiError = (error: any) => {
    const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
    if (isAuthError) {
        // This specific error message will be caught by the client to trigger a logout.
        throw new Error("SESSION_EXPIRED"); 
    }
    throw error;
}


const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});


export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  try {
    const supabase = await getAuthenticatedSupabaseClient();
    
    let query = supabase
      .from(input.tableName)
      .select(input.select);

    const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions'];
    
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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    try {
        const supabase = await getAuthenticatedSupabaseClient();
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
    } catch (error) {
        return handleApiError(error);
    }
}

const AppendDataInputSchema = z.object({
  tableName: z.string(),
  data: z.record(z.any()),
  select: z.string().optional().default('*'),
});

export async function appendData(input: z.infer<typeof AppendDataInputSchema>) {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Only admins can add new data.");
        
        const supabase = await getAuthenticatedSupabaseClient();
        
        const { data, error } = await supabase
            .from(input.tableName)
            .insert([input.data]) 
            .select(input.select);

        if (error) {
            if (error.code === '42P01') {
                console.warn(`Attempted to append to a non-existent table: ${input.tableName}`);
                return null;
            }
            throw new Error(error.message);
        }
        return data ? data[0] : null;
    } catch (error) {
        return handleApiError(error);
    }
}

const UpdateDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
  data: z.record(z.any()),
});

export async function updateData(input: z.infer<typeof UpdateDataInputSchema>) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can update data.");
    
    const supabase = await getAuthenticatedSupabaseClient();

    const { data, error } = await supabase
        .from(input.tableName)
        .update(input.data)
        .eq('id', input.id)
        .select();

    if (error) throw new Error(error.message);
    return data;
  } catch(error) {
    return handleApiError(error);
  }
}

const DeleteDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
});

export async function deleteData(input: z.infer<typeof DeleteDataInputSchema>) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can delete data.");
    
    const supabase = await getAuthenticatedSupabaseClient();

    if(input.tableName === 'ap_ar_transactions'){
        const { error } = await supabase
            .from(input.tableName)
            .delete()
            .eq('id', input.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase
            .from(input.tableName)
            .update({ deletedAt: new Date().toISOString() })
            .eq('id', input.id);
                
        if (error) throw new Error(error.message);
    }
    
    return { success: true };
  } catch(error) {
    return handleApiError(error);
  }
}

const RestoreDataInputSchema = z.object({
    tableName: z.string(),
    id: z.string(),
});

export async function restoreData(input: z.infer<typeof RestoreDataInputSchema>) {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Only admins can restore data.");
        
        const supabase = await getAuthenticatedSupabaseClient();

        const { error } = await supabase
            .from(input.tableName)
            .update({ deletedAt: null })
            .eq('id', input.id);

        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}

export async function exportAllData() {
    try {
        const supabase = await getAuthenticatedSupabaseClient();
        const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions', 'payment_installments'];
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
    } catch (error) {
        return handleApiError(error);
    }
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = createSupabaseClient(true);
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions', 'payment_installments'];
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
            if (user.id !== session.id) {
                 await supabase.auth.admin.deleteUser(user.id);
            }
        }
        
        const tables = ['payment_installments', 'ap_ar_transactions', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients'];
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error && error.code !== '42P01') {
                console.error(`Error deleting from ${tableName}:`, error);
                throw new Error(`Failed to delete data from ${tableName}.`);
            }
        }
        
        await logout();

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
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: input.username,
        password: input.password,
    });
    
    if (error) {
        if (error.message === 'Invalid login credentials') {
             const supabaseAdmin = createSupabaseClient(true);
             const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

             if(allUsers?.users.length === 0) {
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
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

export async function logout() {
  await removeSession();
}

// --- Specific App Actions ---

const AddInstallmentInputSchema = z.object({
    ap_ar_transaction_id: z.string(),
    original_amount: z.number(),
    already_paid_amount: z.number(),
    payment_amount: z.number(),
    payment_date: z.string(),
    payment_method: z.enum(['cash', 'bank']),
    ledger_type: z.enum(['payable', 'receivable']),
    description: z.string(),
});

export async function addPaymentInstallment(input: z.infer<typeof AddInstallmentInputSchema>) {
    const supabase = await getAuthenticatedSupabaseClient();
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can settle payments.");

    try {
        const newPaidAmount = input.already_paid_amount + input.payment_amount;
        const newStatus = newPaidAmount >= input.original_amount ? 'paid' : 'partially paid';
        
        const {data: updatedParent, error: updateError} = await supabase.from('ap_ar_transactions').update({
            paid_amount: newPaidAmount,
            status: newStatus
        }).eq('id', input.ap_ar_transaction_id).select().single();

        if (updateError) throw updateError;


        const {data: newInstallment, error: installmentError} = await supabase.from('payment_installments').insert({
            ap_ar_transaction_id: input.ap_ar_transaction_id,
            amount: input.payment_amount,
            date: input.payment_date,
            payment_method: input.payment_method,
        }).select().single();

        if(installmentError) throw installmentError;


        const financialTxData = {
            date: input.payment_date,
            amount: input.payment_amount,
            description: `Installment for: ${input.description}`,
            category: input.ledger_type === 'payable' ? 'A/P Settlement' : 'A/R Settlement',
        };

        let newFinancialTx = null;
        if (input.payment_method === 'cash') {
            newFinancialTx = await supabase.from('cash_transactions').insert({
                ...financialTxData,
                type: input.ledger_type === 'payable' ? 'expense' : 'income',
            }).select().single();
        } else { // bank
            newFinancialTx = await supabase.from('bank_transactions').insert({
                ...financialTxData,
                type: input.ledger_type === 'payable' ? 'withdrawal' : 'deposit',
            }).select().single();
        }

        if(newFinancialTx.error) throw newFinancialTx.error;

        return { 
            updatedParent, 
            newInstallment, 
            newFinancialTx: newFinancialTx.data,
            paymentMethod: input.payment_method
        };

    } catch (error: any) {
        console.error("Error adding installment:", error);
        return handleApiError(error);
    }
}
    
