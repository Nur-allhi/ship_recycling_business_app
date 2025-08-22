'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, getSession, removeSession } from '@/lib/auth';
import { startOfMonth, subMonths } from 'date-fns';

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
        throw new Error("SESSION_EXPIRED");
    }

    // For a shared app model, we use the service role key for all authenticated actions
    // because RLS policies are now based on roles, not user_id.
    return createSupabaseClient(true);
};


export async function handleApiError(error: any) {
    const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
    if (isAuthError) {
        // This specific error message will be caught by the client to trigger a logout.
        throw new Error("SESSION_EXPIRED"); 
    }
    throw error;
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


const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});


export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  try {
    const supabase = await getAuthenticatedSupabaseClient();
    
    let query = supabase
      .from(input.tableName)
      .select(input.select);

    const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];
    
    if (softDeleteTables.includes(input.tableName)) {
      query = query.is('deletedAt', null);
    }
    
    if (input.startDate) {
        query = query.gte('date', input.startDate);
    }
    if (input.endDate) {
        query = query.lte('date', input.endDate);
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
    return await handleApiError(error);
  }
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Only admins can view the recycle bin.");

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
        return await handleApiError(error);
    }
}

const AppendDataInputSchema = z.object({
  tableName: z.string(),
  data: z.record(z.any()).or(z.array(z.record(z.any()))),
  select: z.string().optional(),
  logDescription: z.string().optional(),
});

export async function appendData(input: z.infer<typeof AppendDataInputSchema>) {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Permission denied. Only admins can add data.");
        
        const supabase = await getAuthenticatedSupabaseClient();
        
        let dataToInsert = input.data;

        const { data, error } = await supabase
            .from(input.tableName)
            .insert(dataToInsert)
            .select(input.select || '*');
            
        if (error) {
            if (error.code === '42P01') {
                console.warn(`Attempted to append to a non-existent table: ${input.tableName}`);
                return null;
            }
            throw new Error(error.message);
        }
        if (input.logDescription) {
            await logActivity(input.logDescription);
        }

        return Array.isArray(input.data) ? data : data?.[0];

    } catch (error) {
        return await handleApiError(error);
    }
}

const UpdateDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
  data: z.record(z.any()),
  logDescription: z.string().optional(),
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

    if (input.logDescription) {
        await logActivity(input.logDescription);
    }
    return data;
  } catch(error) {
    return await handleApiError(error);
  }
}

const DeleteDataInputSchema = z.object({
  tableName: z.string(),
  id: z.string(),
  logDescription: z.string().optional(),
});

export async function deleteData(input: z.infer<typeof DeleteDataInputSchema>) {
  try {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can delete data.");
    
    const supabase = await getAuthenticatedSupabaseClient();

    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', input.id);
            
    if (error) throw new Error(error.message);
    
    if (input.logDescription) {
        await logActivity(input.logDescription);
    }

    return { success: true };
  } catch(error) {
    return await handleApiError(error);
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
        
        await logActivity(`Restored item from ${input.tableName} with ID: ${input.id}`);

        return { success: true };
    } catch (error) {
        return await handleApiError(error);
    }
}

export async function emptyRecycleBin() {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Only admins can empty the recycle bin.");

        const supabase = await getAuthenticatedSupabaseClient();
        const tablesToClear = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];

        for (const tableName of tablesToClear) {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .not('deletedAt', 'is', null);

            if (error && error.code !== '42P01') {
                // If table doesn't exist, it's fine. Otherwise, throw.
                throw new Error(`Failed to empty recycle bin for ${tableName}: ${error.message}`);
            }
        }
        
        await logActivity("Emptied the recycle bin.");
        return { success: true };

    } catch (error: any) {
        return await handleApiError(error);
    }
}


export async function exportAllData() {
    try {
        const session = await getSession();
        if (!session) throw new Error("Authentication required.");
        
        const supabase = await getAuthenticatedSupabaseClient();
        const tables = ['banks', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions', 'payment_installments'];
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
        await logActivity("Exported all data to a backup file.");
        return exportedData;
    } catch (error) {
        return await handleApiError(error);
    }
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = createSupabaseClient(true);
    const tables = ['payment_installments', 'ap_ar_transactions', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'banks', 'monthly_snapshots'];
    const session = await getSession();
    if (!session) throw new Error("No active session for import.");
    if (session.role !== 'admin') throw new Error("Only admins can import data.");
    
    try {
        for (const table of tables) {
             const { error: deleteError } = await supabase.from(table).delete().gt('created_at', '1970-01-01');
             if (deleteError && deleteError.code !== '42P01') {
                console.error(`Failed to clear ${table}: ${deleteError.message}`);
                throw new Error(`Failed to clear ${table}: ${deleteError.message}`);
             }
        }

        const importOrder = ['banks', 'categories', 'vendors', 'clients', 'initial_stock', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions', 'payment_installments', 'monthly_snapshots'];

        for (const tableName of importOrder) {
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                const { error: insertError } = await supabase.from(tableName).upsert(records);
                if (insertError && insertError.code !== '42P01') throw new Error(`Failed to import to ${tableName}: ${insertError.message}`);
            }
        }
        await logActivity("Imported data from a backup file, overwriting existing data.");
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
        
        const tables = ['payment_installments', 'ap_ar_transactions', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'banks', 'activity_log', 'monthly_snapshots'];
        for (const tableName of tables) {
            // Using `created_at` is a robust way to delete all records as it exists on all tables
            // and avoids type mismatches with different `id` column types (bigint vs uuid).
            const { error } = await supabase.from(tableName).delete().gt('created_at', '1970-01-01');
            if (error && error.code !== '42P01') { // 42P01 = table does not exist, which is fine.
                console.error(`Error deleting from ${tableName}:`, error);
                throw new Error(`Failed to delete data from ${tableName}.`);
            }
        }
        
        await logActivity("DELETED ALL DATA AND USERS.");
        await logout();

        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete all data:", error);
        throw new Error(error.message || "An unknown error occurred during data deletion.");
    }
}

// --- Auth Actions ---

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
    
    const sessionPayload = {
        id: data.user.id,
        username: data.user.email!,
        role: data.user.user_metadata.role || 'user',
        accessToken: data.session.access_token,
    };
    
    await createSession(sessionPayload, input.rememberMe);

    let needsData = false;
    if (!isFirstUser) {
        // Temporarily create a new authenticated client just for this check
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

    return { success: true, needsInitialBalance: isFirstUser || needsData };
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

export async function logout() {
  await logActivity("User logged out.");
  await removeSession();
}

// --- Specific App Actions ---

export async function getBalances() {
    const supabase = await getAuthenticatedSupabaseClient();
    try {
        const { data: latestSnapshot } = await supabase
            .from('monthly_snapshots')
            .select('*')
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        const startDate = latestSnapshot ? latestSnapshot.snapshot_date : '1970-01-01';

        // Initialize balances from snapshot or zero
        let cashBalance = latestSnapshot?.cash_balance || 0;
        let bankBalances: Record<string, number> = latestSnapshot?.bank_balances || {};
        let stockPortfolio: Record<string, { weight: number; totalValue: number }> = {};
        if (latestSnapshot?.stock_items) {
             Object.entries(latestSnapshot.stock_items).forEach(([name, data]: [string, any]) => {
                stockPortfolio[name] = { weight: data.weight, totalValue: data.value };
            });
        }
        let totalPayables = latestSnapshot?.total_payables || 0;
        let totalReceivables = latestSnapshot?.total_receivables || 0;

        // Fetch all transactions since the snapshot date
        // If there's no snapshot, startDate is 1970, so all transactions will be fetched.
        const [
            cashData, bankData, stockData, initialStockData, ledgerData
        ] = await Promise.all([
            readData({ tableName: 'cash_transactions', startDate }),
            readData({ tableName: 'bank_transactions', startDate }),
            readData({ tableName: 'stock_transactions', startDate }),
            readData({ tableName: 'initial_stock' }),
            readData({ tableName: 'ap_ar_transactions', startDate }),
        ]);

        // If no snapshot, calculate initial state from the beginning of time
        if (!latestSnapshot) {
            cashBalance = (cashData || []).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
            
            bankBalances = {};
            (bankData || []).forEach(tx => {
                bankBalances[tx.bank_id] = (bankBalances[tx.bank_id] || 0) + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount);
            });

            stockPortfolio = {};
            (initialStockData || []).forEach(item => {
                if (!stockPortfolio[item.name]) {
                    stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
                }
                stockPortfolio[item.name].weight += item.weight;
                stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
            });

            totalPayables = (ledgerData || []).filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
            totalReceivables = (ledgerData || []).filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);

        } else {
            // Apply transactions that happened *after* the snapshot was taken
            (cashData || []).forEach(tx => cashBalance += (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount));
            
            (bankData || []).forEach(tx => {
                bankBalances[tx.bank_id] = (bankBalances[tx.bank_id] || 0) + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount);
            });
             
            (ledgerData || []).forEach(tx => {
                const remaining = tx.amount - tx.paid_amount;
                if(tx.type === 'payable') totalPayables += remaining;
                if(tx.type === 'receivable') totalReceivables += remaining;
             });
        }
        
        const totalBankBalance = Object.values(bankBalances).reduce((acc, bal) => acc + bal, 0);
        
        // Always process all stock transactions since the snapshot date (or all time if no snapshot)
        const sortedStockTransactions = [...(stockData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        sortedStockTransactions.forEach(tx => {
            if (!stockPortfolio[tx.stockItemName]) {
                stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
            }
            const item = stockPortfolio[tx.stockItemName];
            const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;
            if (tx.type === 'purchase') {
                const newTotalValue = item.totalValue + (tx.weight * tx.pricePerKg);
                const newTotalWeight = item.weight + tx.weight;
                item.totalValue = newTotalValue;
                item.weight = newTotalWeight;
            } else { // sale
                item.totalValue -= tx.weight * currentAvgPrice;
                item.weight -= tx.weight;
            }
        });
        
        const aggregatedStockItems = Object.entries(stockPortfolio).map(([name, data], index) => ({
            id: `stock-agg-${index}`, name, weight: data.weight, purchasePricePerKg: data.weight > 0 ? data.totalValue / data.weight : 0,
        }));


        return {
            cashBalance,
            bankBalance: totalBankBalance,
            stockItems: aggregatedStockItems,
            totalPayables,
            totalReceivables
        };
    } catch(e) {
        return await handleApiError(e);
    }
}


// This is a shared helper function for recording payments.
async function applyPaymentToLedger(
    supabase: any,
    contactId: string,
    paymentAmount: number,
    paymentDate: string,
    paymentMethod: 'cash' | 'bank'
) {
    // 1. Fetch all outstanding transactions for this contact, oldest first
    const { data: outstandingTxs, error: fetchError } = await supabase
        .from('ap_ar_transactions')
        .select('*')
        .eq('contact_id', contactId)
        .in('status', ['unpaid', 'partially paid'])
        .order('date', { ascending: true });

    if (fetchError) throw fetchError;
    if (!outstandingTxs || outstandingTxs.length === 0) {
        throw new Error("No outstanding balance to settle for this contact.");
    }
    
    const totalOutstanding = outstandingTxs.reduce((acc: number, tx: any) => acc + (tx.amount - tx.paid_amount), 0);
    if (paymentAmount > totalOutstanding) {
        throw new Error(`Payment amount (${paymentAmount}) exceeds the total outstanding balance (${totalOutstanding}).`);
    }

    let amountToSettle = paymentAmount;

    for (const tx of outstandingTxs) {
        if (amountToSettle <= 0) break;

        const remainingBalance = tx.amount - tx.paid_amount;
        const paymentForThisTx = Math.min(amountToSettle, remainingBalance);
        
        const newPaidAmount = tx.paid_amount + paymentForThisTx;
        const newStatus = newPaidAmount >= tx.amount ? 'paid' : 'partially paid';

        // 2. Update the ledger transaction
        const { error: updateError } = await supabase
            .from('ap_ar_transactions')
            .update({ paid_amount: newPaidAmount, status: newStatus })
            .eq('id', tx.id);
        
        if (updateError) throw updateError;
        
        // 3. Create an installment record for this part of the payment
        const { error: installmentError } = await supabase.from('payment_installments').insert({
            ap_ar_transaction_id: tx.id,
            amount: paymentForThisTx,
            date: paymentDate,
            payment_method: paymentMethod,
        });

        if (installmentError) throw installmentError;

        amountToSettle -= paymentForThisTx;
    }
}


const RecordPaymentAgainstTotalInputSchema = z.object({
    contact_id: z.string(),
    contact_name: z.string(),
    payment_amount: z.number(),
    payment_date: z.string(),
    payment_method: z.enum(['cash', 'bank']),
    ledger_type: z.enum(['payable', 'receivable']),
    bank_id: z.string().optional(),
});


export async function recordPaymentAgainstTotal(input: z.infer<typeof RecordPaymentAgainstTotalInputSchema>) {
    const session = await getSession();
    if (!session || session.role !== 'admin') throw new Error("Only admins can record payments.");

    const supabase = await getAuthenticatedSupabaseClient();
    
    try {
        // Shared logic to apply payment to A/P or A/R ledger
        await applyPaymentToLedger(supabase, input.contact_id, input.payment_amount, input.payment_date, input.payment_method);
        
        // Create a single financial transaction for the total payment
        const financialTxData = {
            date: input.payment_date,
            actual_amount: input.payment_amount,
            expected_amount: input.payment_amount, // For settlements, expected and actual are the same.
            difference: 0,
            description: `Payment ${input.ledger_type === 'payable' ? 'to' : 'from'} ${input.contact_name}`,
            category: input.ledger_type === 'payable' ? 'A/P Settlement' : 'A/R Settlement',
        };
        
        const logDescription = `Recorded payment of ${financialTxData.actual_amount} ${input.ledger_type === 'payable' ? 'to' : 'from'} ${input.contact_name} via ${input.payment_method}`;

        if (input.payment_method === 'cash') {
            await supabase.from('cash_transactions').insert({
                ...financialTxData,
                type: input.ledger_type === 'payable' ? 'expense' : 'income',
            });
        } else { // bank
            if (!input.bank_id) throw new Error("Bank ID is required for bank payments.");
            await supabase.from('bank_transactions').insert({
                ...financialTxData,
                type: input.ledger_type === 'payable' ? 'withdrawal' : 'deposit',
                bank_id: input.bank_id,
            });
        }
        
        await logActivity(logDescription);
        return { success: true };

    } catch (error: any) {
        console.error("Error recording payment:", error);
        return await handleApiError(error);
    }
}


const RecordDirectPaymentInputSchema = z.object({
  payment_method: z.enum(['cash', 'bank']),
  bank_id: z.string().optional(),
  date: z.string(),
  amount: z.number(),
  category: z.enum(['A/R Settlement', 'A/P Settlement']),
  description: z.string(),
  contact_id: z.string(),
  contact_name: z.string(),
});

export async function recordDirectPayment(input: z.infer<typeof RecordDirectPaymentInputSchema>) {
    const session = await getSession();
    if (!session || session.role !== 'admin') throw new Error("Only admins can record payments.");

    const supabase = await getAuthenticatedSupabaseClient();

    try {
        // Determine ledger type from category
        const ledgerType = input.category === 'A/P Settlement' ? 'payable' : 'receivable';

        // Apply payment to the ledger
        await applyPaymentToLedger(supabase, input.contact_id, input.amount, input.date, input.payment_method);
        
        // Log the corresponding financial transaction
        const financialTxData = {
            date: input.date,
            actual_amount: input.amount,
            expected_amount: input.amount, // For settlements, expected and actual are the same
            difference: 0,
            description: input.description,
            category: input.category,
        };

        if (input.payment_method === 'cash') {
            await supabase.from('cash_transactions').insert({
                ...financialTxData,
                type: ledgerType === 'payable' ? 'expense' : 'income',
            });
        } else { // bank
            if (!input.bank_id) throw new Error("Bank ID is required for bank payments.");
            await supabase.from('bank_transactions').insert({
                ...financialTxData,
                type: ledgerType === 'payable' ? 'withdrawal' : 'deposit',
                bank_id: input.bank_id,
            });
        }

        await logActivity(`Recorded ${input.category} of ${input.amount} for ${input.contact_name}`);
        return { success: true };

    } catch (error: any) {
        console.error("Error in direct payment recording:", error);
        return await handleApiError(error);
    }
}
    
const UpdateStockTransactionInputSchema = z.object({
    stockTxId: z.string(),
    updates: z.record(z.any()),
});

export async function updateStockTransaction(input: z.infer<typeof UpdateStockTransactionInputSchema>) {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can update transactions.");
    
    const supabase = await getAuthenticatedSupabaseClient();

    // Update the stock transaction first
    const { data: updatedStockTx, error: stockError } = await supabase
        .from('stock_transactions')
        .update(input.updates)
        .eq('id', input.stockTxId)
        .select()
        .single();
    
    if (stockError) throw stockError;
    if (!updatedStockTx) throw new Error("Failed to find the stock transaction after update.");

    // Check if there is a linked financial transaction
    // A financial transaction is linked if it has the stock transaction's ID
    const { data: linkedCashTx, error: cashError } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('linkedStockTxId', input.stockTxId)
        .maybeSingle();
        
    if (cashError) throw cashError;

    const { data: linkedBankTx, error: bankError } = await supabase
        .from('bank_transactions')
        .select('id')
        .eq('linkedStockTxId', input.stockTxId)
        .maybeSingle();
    
    if (bankError) throw bankError;

    // If there is a linked transaction, update its amount to match the new stock value
    const hasAmountChanged = input.updates.pricePerKg !== undefined || input.updates.weight !== undefined;

    if (hasAmountChanged) {
        const newActualAmount = updatedStockTx.weight * updatedStockTx.pricePerKg;
        const newExpectedAmount = newActualAmount; // Assuming for edits, expected and actual are reset
        const financialUpdates = {
            actual_amount: newActualAmount,
            expected_amount: newExpectedAmount,
            difference: 0,
            difference_reason: 'Edited transaction',
        };

        if (linkedCashTx) {
            await supabase.from('cash_transactions').update(financialUpdates).eq('id', linkedCashTx.id);
        }
        if (linkedBankTx) {
            await supabase.from('bank_transactions').update(financialUpdates).eq('id', linkedBankTx.id);
        }
    }

    await logActivity(`Edited stock transaction: ${input.stockTxId}`);
    return { success: true };
}    

const SetInitialBalancesSchema = z.object({
  cash: z.number().nonnegative(),
  bankTotals: z.record(z.string(), z.number().nonnegative()),
  date: z.string(),
});

export async function setInitialBalances(input: z.infer<typeof SetInitialBalancesSchema>) {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can set initial balances.");

    const supabase = await getAuthenticatedSupabaseClient();
    
    // First, delete any existing initial balance entries to prevent duplicates.
    await supabase.from('cash_transactions').delete().eq('category', 'Initial Balance');
    await supabase.from('bank_transactions').delete().eq('category', 'Initial Balance');

    const cashTx = {
        date: input.date,
        type: 'income',
        category: 'Initial Balance',
        description: 'Initial cash balance set.',
        expected_amount: input.cash,
        actual_amount: input.cash,
        difference: 0,
    };
    const { error: cashError } = await supabase.from('cash_transactions').insert(cashTx);
    if(cashError) throw new Error(`Failed to set cash balance: ${cashError.message}`);

    const bankTxs = Object.entries(input.bankTotals).map(([bank_id, amount]) => ({
        date: input.date,
        type: 'deposit',
        category: 'Initial Balance',
        description: 'Initial bank balance set.',
        bank_id,
        expected_amount: amount,
        actual_amount: amount,
        difference: 0,
    }));
    
    if (bankTxs.length > 0) {
        const { error: bankError } = await supabase.from('bank_transactions').insert(bankTxs);
        if(bankError) throw new Error(`Failed to set bank balances: ${bankError.message}`);
    }

    await logActivity("Set initial cash and bank balances.");
    return { success: true };
}
