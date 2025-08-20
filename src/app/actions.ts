
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
        throw new Error("SESSION_EXPIRED");
    }

    // For a shared app model, we can use the service role key for all authenticated actions
    // that are gated by role checks within the action itself.
    // This simplifies RLS policies significantly.
    return createSupabaseClient(true);
};


const handleApiError = (error: any) => {
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
    return handleApiError(error);
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
        return handleApiError(error);
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

        // Server-side data cleaning for categories to prevent schema mismatch errors.
        if (input.tableName === 'categories' && !Array.isArray(dataToInsert)) {
            const categoryData = { ...dataToInsert }; // Create a copy to mutate
            if (categoryData.type === 'cash' && 'direction' in categoryData) {
                // This logic is now handled on the client, but keeping as a safeguard
                // Cash categories shouldn't have a direction property sent to DB
                // if the table schema doesn't support it for that type.
            }
            dataToInsert = categoryData;
        }

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
        return handleApiError(error);
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
    return handleApiError(error);
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
        
        await logActivity(`Restored item from ${input.tableName} with ID: ${input.id}`);

        return { success: true };
    } catch (error) {
        return handleApiError(error);
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
        return handleApiError(error);
    }
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    const supabase = createSupabaseClient(true);
    const tables = ['banks', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'ap_ar_transactions', 'payment_installments'];
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

        for (const tableName of tables) {
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                 records.forEach(r => {
                    // Remove user_id if it exists from old exports
                    delete r.user_id; 
                 });
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
        
        const tables = ['payment_installments', 'ap_ar_transactions', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'vendors', 'clients', 'banks', 'activity_log'];
        for (const tableName of tables) {
            const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error && error.code !== '42P01') {
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

export async function hasInitialData() {
    const supabase = await getAuthenticatedSupabaseClient();
    try {
        const { data: cashCheck, error: cashError } = await supabase.from('cash_transactions').select('id', { count: 'exact', head: true }).limit(1);
        if (cashError && cashError.code !== '42P01') throw cashError;

        const { data: bankCheck, error: bankError } = await supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).limit(1);
        if (bankError && bankError.code !== '42P01') throw bankError;

        return (cashCheck?.count ?? 0) > 0 || (bankCheck?.count ?? 0) > 0;
    } catch (error) {
        console.error("Error checking for initial data:", error);
        return true; 
    }
}

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
        // Create an authenticated client to check data
        const tempAuthedSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
        });
        const { data: cashCheck, error: cashError } = await tempAuthedSupabase.from('cash_transactions').select('id', { count: 'exact', head: true }).limit(1);
        if (cashError && cashError.code !== '42P01') throw cashError;
        const { data: bankCheck, error: bankError } = await tempAuthedSupabase.from('bank_transactions').select('id', { count: 'exact', head: true }).limit(1);
        if (bankError && bankError.code !== '42P01') throw bankError;
        needsData = (cashCheck?.count ?? 0) === 0 && (bankCheck?.count ?? 0) === 0;
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
        // Cash Balance
        const { data: cashData, error: cashError } = await supabase.from('cash_transactions').select('type, amount');
        if (cashError && cashError.code !== '42P01') throw cashError;
        const cashBalance = (cashData || []).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);

        // Bank Balance
        const { data: bankData, error: bankError } = await supabase.from('bank_transactions').select('type, amount');
        if (bankError && bankError.code !== '42P01') throw bankError;
        const bankBalance = (bankData || []).reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
        
        // Stock Balance
        const { data: stockData, error: stockError } = await supabase.from('stock_transactions').select('type, weight, pricePerKg');
        if (stockError && stockError.code !== '42P01') throw stockError;
        const { data: initialStockData, error: initialStockError } = await supabase.from('initial_stock').select('*');
        if(initialStockError && initialStockError.code !== '42P01') throw initialStockError;
        
        const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};
        (initialStockData || []).forEach(item => {
              if (!stockPortfolio[item.name]) {
                  stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
              }
              stockPortfolio[item.name].weight += item.weight;
              stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
        });

        const sortedStockTransactions = [...(stockData || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        sortedStockTransactions.forEach(tx => {
            if (!stockPortfolio[tx.stockItemName]) {
                stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
            }
            const item = stockPortfolio[tx.stockItemName];
            const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;
            if (tx.type === 'purchase') {
                item.weight += tx.weight;
                item.totalValue += tx.weight * tx.pricePerKg;
            } else { // sale
                item.weight -= tx.weight;
                item.totalValue -= tx.weight * currentAvgPrice;
            }
        });
        const aggregatedStockItems = Object.entries(stockPortfolio).map(([name, data], index) => ({
            id: `stock-agg-${index}`, name, weight: data.weight, purchasePricePerKg: data.weight > 0 ? data.totalValue / data.weight : 0,
        }));

        // A/R and A/P Balances
        const { data: ledgerData, error: ledgerError } = await supabase.from('ap_ar_transactions').select('type, amount, paid_amount, status');
        if (ledgerError && ledgerError.code !== '42P01') throw ledgerError;
        const totalPayables = (ledgerData || []).filter((tx) => tx.type === 'payable' && tx.status !== 'paid').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        const totalReceivables = (ledgerData || []).filter((tx) => tx.type === 'receivable' && tx.status !== 'paid').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);

        return {
            cashBalance,
            bankBalance,
            stockItems: aggregatedStockItems,
            totalPayables,
            totalReceivables
        };
    } catch(e) {
        return handleApiError(e);
    }
}


// This is a shared helper function for recording payments.
async function applyPaymentToLedger(
    supabase: ReturnType<typeof getAuthenticatedSupabaseClient>,
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
    
    const totalOutstanding = outstandingTxs.reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
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
            amount: input.payment_amount,
            description: `Payment ${input.ledger_type === 'payable' ? 'to' : 'from'} ${input.contact_name}`,
            category: input.ledger_type === 'payable' ? 'A/P Settlement' : 'A/R Settlement',
        };
        
        const logDescription = `Recorded payment of ${financialTxData.amount} ${input.ledger_type === 'payable' ? 'to' : 'from'} ${input.contact_name} via ${input.payment_method}`;

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
        return handleApiError(error);
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
            amount: input.amount,
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
        return handleApiError(error);
    }
}
