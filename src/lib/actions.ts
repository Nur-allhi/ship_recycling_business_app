
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/app/auth/actions';
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
  tableName: z.enum(['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions']),
  id: z.string(),
  logDescription: z.string().optional(),
});

// This function is now ONLY for soft-deletable tables.
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

const DeleteCategoryInputSchema = z.object({
    id: z.string(),
});

export async function deleteCategory(input: z.infer<typeof DeleteCategoryInputSchema>) {
    try {
        const session = await getSession();
        if (session?.role !== 'admin') throw new Error("Only admins can delete categories.");
        
        const supabase = await getAuthenticatedSupabaseClient();
        const { error } = await supabase.from('categories').delete().eq('id', input.id);

        if (error) throw new Error(error.message);
        
        await logActivity(`Deleted category with ID: ${input.id}`);

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
        // await logout();

        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete all data:", error);
        throw new Error(error.message || "An unknown error occurred during data deletion.");
    }
}

// --- Specific App Actions ---

export async function deleteVendor(id: string) {
    const supabase = await getAuthenticatedSupabaseClient();
    const { error } = await supabase.from('vendors').delete().eq('id', id);
    if(error) throw error;
    await logActivity(`Deleted vendor with ID: ${id}`);
    return { success: true };
}

export async function deleteClient(id: string) {
    const supabase = await getAuthenticatedSupabaseClient();
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if(error) throw error;
    await logActivity(`Deleted client with ID: ${id}`);
    return { success: true };
}

export async function getBalances() {
    // This function is deprecated for client-side use but can be kept for server-side reports or checks.
    // The client now calculates balances locally for speed.
    return { cashBalance: 0, bankBalance: 0, stockItems: [], totalPayables: 0, totalReceivables: 0 };
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
    
    let amountToSettle = paymentAmount;

    if (!outstandingTxs || outstandingTxs.length === 0) {
        // This case can happen if it's an overpayment on a zero balance, which is valid.
        // We just skip settling against specific transactions.
    } else {
         const totalOutstanding = outstandingTxs.reduce((acc: number, tx: any) => acc + (tx.amount - tx.paid_amount), 0);
        if (paymentAmount > totalOutstanding + 0.01) { // Add a small tolerance for floating point issues
            // This is now a valid scenario (overpayment), so we don't throw an error.
            // We'll settle what we can, and the rest is handled by the advance logic.
        }

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
        
        // No need to create financial transaction here, it's created optimistically on the client
        
        const logDescription = `Recorded payment of ${input.payment_amount} ${input.ledger_type === 'payable' ? 'to' : 'from'} ${input.contact_name} via ${input.payment_method}`;
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
        await applyPaymentToLedger(supabase, input.contact_id, input.amount, input.date, input.payment_method);
        
        await logActivity(`Recorded ${input.category} of ${input.amount} for ${input.contact_name}`);
        return { success: true };

    } catch (error: any) {
        console.error("Error in direct payment recording:", error);
        return await handleApiError(error);
    }
}

const AddStockTransactionInputSchema = z.object({
    stockTx: z.any(),
    bank_id: z.string().optional(),
});

export async function addStockTransaction(input: z.infer<typeof AddStockTransactionInputSchema>) {
    const supabase = await getAuthenticatedSupabaseClient();
    const { stockTx, bank_id } = input;
    
    // Step 1: Insert the stock transaction itself
    const { data: savedStockTx, error: stockError } = await supabase
        .from('stock_transactions')
        .insert(stockTx)
        .select()
        .single();
    if(stockError) throw stockError;

    // Step 2: Handle the financial side of the transaction
    let savedFinancialTx = null;
    if (stockTx.paymentMethod === 'cash' || stockTx.paymentMethod === 'bank') {
        const financialTxData = {
            date: stockTx.date, expected_amount: stockTx.expected_amount, actual_amount: stockTx.actual_amount,
            difference: stockTx.difference, difference_reason: stockTx.difference_reason,
            description: stockTx.description || `${stockTx.type} of ${stockTx.weight}kg of ${stockTx.stockItemName}`,
            category: stockTx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale', linkedStockTxId: savedStockTx.id,
        };
        const tableName = stockTx.paymentMethod === 'cash' ? 'cash_transactions' : 'bank_transactions';
        const type = stockTx.paymentMethod === 'cash' ? (stockTx.type === 'purchase' ? 'expense' : 'income') : (stockTx.type === 'purchase' ? 'withdrawal' : 'deposit');
        
        const { data, error } = await supabase.from(tableName).insert({ ...financialTxData, type, bank_id }).select().single();
        if(error) throw error;
        savedFinancialTx = data;
    } else if (stockTx.paymentMethod === 'credit') {
        // This is a new debt or it settles an advance.
        let amountToLog = stockTx.actual_amount;
        
        // Check for an advance balance
        const { data: advances } = await supabase
            .from('ap_ar_transactions')
            .select('id, amount')
            .eq('contact_id', stockTx.contact_id)
            .eq('type', 'advance')
            .lt('amount', 0); // Advances are stored as negative numbers

        if (advances && advances.length > 0) {
            for (const advance of advances) {
                if (amountToLog <= 0) break;

                const advanceBalance = Math.abs(advance.amount);
                const amountToSettle = Math.min(amountToLog, advanceBalance);

                // Reduce the advance balance (make it less negative)
                const { error: updateError } = await supabase
                    .from('ap_ar_transactions')
                    .update({ amount: advance.amount + amountToSettle })
                    .eq('id', advance.id);
                
                if (updateError) throw updateError;
                
                amountToLog -= amountToSettle;
            }
        }
        
        // If there's still an amount left, create a new payable/receivable
        if (amountToLog > 0) {
            const ledgerData = {
                type: stockTx.type === 'purchase' ? 'payable' : 'receivable',
                description: stockTx.description || `${stockTx.stockItemName} (${stockTx.weight}kg)`,
                amount: amountToLog, date: stockTx.date, contact_id: stockTx.contact_id!, contact_name: stockTx.contact_name!,
                status: 'unpaid', paid_amount: 0
            };
            const { error } = await supabase.from('ap_ar_transactions').insert(ledgerData);
            if(error) throw error;
        }
    }
    await logActivity(`Added stock transaction: ${stockTx.stockItemName}`);
    return { stockTx: savedStockTx, financialTx: savedFinancialTx };
}
    
const UpdateStockTransactionInputSchema = z.object({
    stockTxId: z.string(),
    updates: z.record(z.any()),
});

export async function updateStockTransaction(input: z.infer<typeof UpdateStockTransactionInputSchema>) {
    const session = await getSession();
    if (session?.role !== 'admin') throw new Error("Only admins can update transactions.");
    
    const supabase = await getAuthenticatedSupabaseClient();

    const { data: updatedStockTx, error: stockError } = await supabase
        .from('stock_transactions')
        .update(input.updates)
        .eq('id', input.stockTxId)
        .select()
        .single();
    
    if (stockError) throw stockError;
    if (!updatedStockTx) throw new Error("Failed to find the stock transaction after update.");

    const { data: linkedCashTx } = await supabase.from('cash_transactions').select('id').eq('linkedStockTxId', input.stockTxId).maybeSingle();
    const { data: linkedBankTx } = await supabase.from('bank_transactions').select('id').eq('linkedStockTxId', input.stockTxId).maybeSingle();
    
    const financialUpdates = {
        actual_amount: updatedStockTx.actual_amount,
        expected_amount: updatedStockTx.expected_amount,
        difference: updatedStockTx.difference,
        difference_reason: updatedStockTx.difference_reason,
    };
    if (linkedCashTx) await supabase.from('cash_transactions').update(financialUpdates).eq('id', linkedCashTx.id);
    if (linkedBankTx) await supabase.from('bank_transactions').update(financialUpdates).eq('id', linkedBankTx.id);

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
    
    await supabase.from('cash_transactions').delete().eq('category', 'Initial Balance');
    await supabase.from('bank_transactions').delete().eq('category', 'Initial Balance');

    await supabase.from('cash_transactions').insert({
        date: input.date, type: 'income', category: 'Initial Balance',
        description: 'Initial cash balance set.', actual_amount: input.cash, expected_amount: input.cash, difference: 0,
    });
    
    if (Object.keys(input.bankTotals).length > 0) {
        await supabase.from('bank_transactions').insert(Object.entries(input.bankTotals).map(([bank_id, amount]) => ({
            date: input.date, type: 'deposit', category: 'Initial Balance',
            description: 'Initial bank balance set.', bank_id, actual_amount: amount, expected_amount: amount, difference: 0,
        })));
    }
    await logActivity("Set initial cash and bank balances.");
    return { success: true };
}

const AddInitialStockItemSchema = z.object({
    item: z.object({
        name: z.string(),
        weight: z.number(),
        pricePerKg: z.number(),
    })
});
export async function addInitialStockItem(input: z.infer<typeof AddInitialStockItemSchema>) {
    const supabase = await getAuthenticatedSupabaseClient();
    const { error } = await supabase.from('initial_stock').insert({ name: input.item.name, weight: input.item.weight, purchasePricePerKg: input.item.pricePerKg });
    if(error) throw error;
    return { success: true };
}


const TransferFundsSchema = z.object({
    from: z.enum(['cash', 'bank']),
    amount: z.number().positive(),
    date: z.string(),
    bankId: z.string(),
    description: z.string().optional(),
});

export async function transferFunds(input: z.infer<typeof TransferFundsSchema>) {
    const supabase = await getAuthenticatedSupabaseClient();
    const fromDesc = `Transfer to ${input.from === 'cash' ? 'Bank' : 'Cash'}: ${input.description || 'Funds Transfer'}`;
    const toDesc = `Transfer from ${input.from === 'cash' ? 'Cash' : 'Bank'}: ${input.description || 'Funds Transfer'}`;

    const commonData = { date: input.date, actual_amount: input.amount, expected_amount: input.amount, difference: 0, category: 'Funds Transfer' };

    if (input.from === 'cash') {
        await supabase.from('cash_transactions').insert({ ...commonData, type: 'expense', description: fromDesc });
        await supabase.from('bank_transactions').insert({ ...commonData, type: 'deposit', description: toDesc, bank_id: input.bankId });
    } else {
        await supabase.from('bank_transactions').insert({ ...commonData, type: 'withdrawal', description: fromDesc, bank_id: input.bankId });
        await supabase.from('cash_transactions').insert({ ...commonData, type: 'income', description: toDesc });
    }
    
    await logActivity(`Transferred ${input.amount} from ${input.from}`);
    return { success: true };
}

const RecordAdvancePaymentSchema = z.object({
    contact_id: z.string(),
    contact_name: z.string(),
    amount: z.number().positive(),
    date: z.string(),
    payment_method: z.enum(['cash', 'bank']),
    ledger_type: z.enum(['payable', 'receivable']),
    bank_id: z.string().optional(),
    description: z.string().optional(),
});

export async function recordAdvancePayment(input: z.infer<typeof RecordAdvancePaymentSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can record advance payments.");
        const supabase = await getAuthenticatedSupabaseClient();

        const { contact_id, contact_name, amount, date, payment_method, ledger_type, bank_id, description } = input;

        // The amount is stored as negative in the ledger to represent a credit/advance
        const ledgerAmount = -amount;
        const ledgerDescription = description || `Advance ${ledger_type === 'payable' ? 'to' : 'from'} ${contact_name}`;

        // 1. Create the advance entry in the ledger
        const { data: ledgerEntry, error: ledgerError } = await supabase
            .from('ap_ar_transactions')
            .insert({
                type: 'advance',
                date: date,
                description: ledgerDescription,
                amount: ledgerAmount,
                paid_amount: 0,
                status: 'paid', // An advance is technically a "paid" liability on your part
                contact_id: contact_id,
                contact_name: contact_name,
            })
            .select()
            .single();
        
        if (ledgerError) throw ledgerError;
        if (!ledgerEntry) throw new Error("Failed to create ledger entry for advance.");

        // 2. Create the corresponding financial transaction
        const financialTxData = {
            date: date,
            description: ledgerDescription,
            category: `Advance ${ledger_type === 'payable' ? 'Payment' : 'Received'}`,
            expected_amount: amount,
            actual_amount: amount,
            difference: 0,
            contact_id: contact_id,
            advance_id: ledgerEntry.id,
        };

        if (payment_method === 'cash') {
            const {data: cashTx, error: cashErr} = await supabase.from('cash_transactions').insert({ ...financialTxData, type: ledger_type === 'payable' ? 'expense' : 'income' }).select().single();
            if(cashErr) throw cashErr;
            return {ledgerEntry, financialTx: cashTx}
        } else {
            const {data: bankTx, error: bankErr} = await supabase.from('bank_transactions').insert({ ...financialTxData, type: ledger_type === 'payable' ? 'withdrawal' : 'deposit', bank_id: bank_id! }).select().single();
            if(bankErr) throw bankErr;
            return {ledgerEntry, financialTx: bankTx}
        }
    } catch(error) {
        console.log('DETAILED SUPABASE ERROR:', error);
        throw error;
    }
}
