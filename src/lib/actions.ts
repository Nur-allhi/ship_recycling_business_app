
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/app/auth/actions';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';
import type { MonthlySnapshot, Loan, LoanPayment, Category } from '@/lib/types';

// This is the privileged client for server-side operations.
const createAdminSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Supabase URL or Service Role Key is missing from environment variables.");
    }
    
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

const handleApiError = async (error: any) => {
    // Auth errors can be thrown by getSession() itself
    if (error.message.includes('SESSION_EXPIRED')) {
        throw new Error("SESSION_EXPIRED");
    }
    // For other errors, log them
    console.error("Server Action Error:", error);
    // And re-throw a generic or specific error message
    throw new Error(error.message || "An unexpected server error occurred.");
}


const logActivity = async (description: string) => {
    try {
        const session = await getSession();
        if (!session) return;
        
        const supabase = createAdminSupabaseClient();
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


export async function readData(input: z.infer<typeof ReadDataInputSchema>): Promise<any[]> {
  try {
    const session = await getSession();
    if (!session) throw new Error("SESSION_EXPIRED");
    const supabase = createAdminSupabaseClient();
    
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
        throw new Error(error.message);
    }
    return (data as any[]) || [];
  } catch (error) {
    return handleApiError(error);
  }
}

const BatchReadDataInputSchema = z.object({
  tables: z.array(z.object({
    tableName: z.string(),
    select: z.string().optional().default('*'),
  })),
});


export async function batchReadData(input: z.infer<typeof BatchReadDataInputSchema>) {
    try {
        const session = await getSession();
        if (!session) throw new Error("SESSION_EXPIRED");
        const supabase = createAdminSupabaseClient();
        
        const results: Record<string, any[]> = {};
        const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];

        const queries = input.tables.map(tableInfo => {
            let query = supabase.from(tableInfo.tableName).select(tableInfo.select);
            if (softDeleteTables.includes(tableInfo.tableName)) {
                query = query.is('deletedAt', null);
            }
            return query.then(({ data, error }) => {
                if (error && error.code !== '42P01') {
                    throw new Error(`Error fetching ${tableInfo.tableName}: ${error.message}`);
                }
                return { tableName: tableInfo.tableName, data: data || [] };
            });
        });

        const settledResults = await Promise.all(queries);

        for (const result of settledResults) {
            results[result.tableName] = result.data;
        }
        
        return results;

    } catch (error) {
        return handleApiError(error);
    }
}

export async function readDeletedData(input: z.infer<typeof ReadDataInputSchema>) {
    try {
        const session = await getSession();
        if (!session) throw new Error("SESSION_EXPIRED");
        if (session.role !== 'admin') throw new Error("Only admins can view the recycle bin.");

        const supabase = createAdminSupabaseClient();
        let query = supabase
            .from(input.tableName)
            .select(input.select)
            .not('deletedAt', 'is', null);
        
        const { data, error } = await query;

        if (error) {
            if (error.code === '42P01') return [];
            throw new Error(error.message);
        }
        return data as any[];
    } catch (error) {
        return handleApiError(error);
    }
}

const ReadSingleItemInputSchema = z.object({
    tableName: z.string(),
    id: z.string(),
    select: z.string().optional().default('*'),
});

export async function readSingleItem(input: z.infer<typeof ReadSingleItemInputSchema>) {
    try {
        const session = await getSession();
        if (!session) throw new Error("SESSION_EXPIRED");

        const supabase = createAdminSupabaseClient();
        const { data, error } = await supabase
            .from(input.tableName)
            .select(input.select)
            .eq('id', input.id)
            .maybeSingle();
        
        if (error) throw new Error(error.message);
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
        if (!session || session.role !== 'admin') throw new Error("Permission denied. Only admins can add data.");
        
        const supabase = createAdminSupabaseClient();
        
        const { data, error } = await supabase
            .from(input.tableName)
            .insert(input.data)
            .select(input.select || '*');
            
        if (error) {
            if (error.code === '42P01') return null;
            throw new Error(error.message);
        }
        if (input.logDescription) await logActivity(input.logDescription);
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
    if (!session || session.role !== 'admin') throw new Error("Only admins can update data.");
    
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
        .from(input.tableName)
        .update(input.data)
        .eq('id', input.id)
        .select();

    if (error) throw new Error(error.message);
    if (input.logDescription) await logActivity(input.logDescription);
    return data;
  } catch(error) {
    return handleApiError(error);
  }
}

const DeleteDataInputSchema = z.object({
  tableName: z.enum(['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions']),
  id: z.string(),
  logDescription: z.string().optional(),
});

export async function deleteData(input: z.infer<typeof DeleteDataInputSchema>) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') throw new Error("Only admins can delete data.");
    
    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: new Date().toISOString() })
        .eq('id', input.id);
            
    if (error) throw new Error(error.message);
    if (input.logDescription) await logActivity(input.logDescription);
    return { success: true };
  } catch(error) {
    return handleApiError(error);
  }
}

const DeleteCategoryInputSchema = z.object({ id: z.string() });

export async function deleteCategory(input: z.infer<typeof DeleteCategoryInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can delete categories.");
        
        const supabase = createAdminSupabaseClient();
        const { error } = await supabase.from('categories').delete().eq('id', input.id);

        if (error) throw new Error(error.message);
        await logActivity(`Deleted category with ID: ${input.id}`);
        return { success: true };
    } catch(error) {
        return handleApiError(error);
    }
}


const RestoreDataInputSchema = z.object({ tableName: z.string(), id: z.string() });

export async function restoreData(input: z.infer<typeof RestoreDataInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can restore data.");
        
        const supabase = createAdminSupabaseClient();
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

export async function emptyRecycleBin() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can empty the recycle bin.");

        const supabase = createAdminSupabaseClient();
        const { error } = await supabase.rpc('permanently_empty_recycle_bin');

        if (error) throw new Error(`Failed to empty recycle bin: ${error.message}`);
        await logActivity("Emptied the recycle bin.");
        return { success: true };

    } catch (error: any) {
        return handleApiError(error);
    }
}


export async function exportAllData() {
    try {
        const session = await getSession();
        if (!session) throw new Error("SESSION_EXPIRED");
        
        const supabase = createAdminSupabaseClient();
        const tables = ['banks', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories', 'contacts', 'ap_ar_transactions', 'ledger_payments', 'loans', 'loan_payments'];
        const exportedData: Record<string, any[]> = {};
        
        for (const tableName of tables) {
            const { data, error } = await supabase.from(tableName).select('*');
            if (error && error.code !== '42P01') throw new Error(`Error exporting ${tableName}: ${error.message}`);
            if (data) exportedData[tableName] = data;
        }
        await logActivity("Exported all data to a backup file.");
        return exportedData;
    } catch (error) {
        return handleApiError(error);
    }
}


const ImportDataSchema = z.record(z.array(z.record(z.any())));

export async function batchImportData(dataToImport: z.infer<typeof ImportDataSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can import data.");

        const supabase = createAdminSupabaseClient();
        const tables = ['loan_payments', 'ledger_payments', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions', 'loans', 'contacts', 'initial_stock', 'categories', 'banks', 'monthly_snapshots', 'activity_log'];

        for (const table of tables) {
             const { error: deleteError } = await supabase.from(table).delete().gt('created_at', '1970-01-01');
             if (deleteError && deleteError.code !== '42P01') throw new Error(`Failed to clear ${table}: ${deleteError.message}`);
        }

        const importOrder = ['banks', 'categories', 'contacts', 'initial_stock', 'cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions', 'ledger_payments', 'monthly_snapshots', 'loans', 'loan_payments'];

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
        return handleApiError(error);
    }
}

export async function deleteAllData() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can delete all data.");

        const supabase = createAdminSupabaseClient();
        
        // Correct deletion order to respect foreign key constraints
        const tablesToDelete = [
            'loan_payments',          // Depends on loans
            'ledger_payments',        // Depends on ap_ar_transactions
            'cash_transactions',      // Links to loans, ap_ar, contacts, banks
            'bank_transactions',      // Links to loans, ap_ar, contacts, banks
            'stock_transactions',     // Links to contacts, banks
            'ap_ar_transactions',     // Depends on contacts
            'loans',                  // Depends on contacts
            'contacts',               // Referenced by many
            'initial_stock',
            'categories',
            'banks',
            'activity_log',
            'monthly_snapshots',
        ];

        for (const tableName of tablesToDelete) {
            const { error } = await supabase.from(tableName).delete().gt('created_at', '1970-01-01');
            // We ignore '42P01' which means the table doesn't exist, which is fine.
            if (error && error.code !== '42P01') {
                 throw new Error(`Failed to delete data from ${tableName}: ${error.message}`);
            }
        }

        const { data: users, error: userError } = await supabase.auth.admin.listUsers();
        if(userError) throw userError;

        for(const user of users.users) {
            if (user.id !== session.id) {
                 await supabase.auth.admin.deleteUser(user.id);
            }
        }
        
        await logActivity("DELETED ALL DATA AND USERS.");
        return { success: true };
    } catch (error: any) {
        return handleApiError(error);
    }
}

export async function deleteContact(input: { id: string }) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can perform this action.");
        const supabase = createAdminSupabaseClient();
        const { error } = await supabase.from('contacts').delete().eq('id', input.id);
        if(error) throw error;
        await logActivity(`Deleted contact with ID: ${input.id}`);
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}


async function applyPaymentToLedger(supabase: any, contactId: string, paymentAmount: number, paymentDate: string, paymentMethod: 'cash' | 'bank') {
    const { data: outstandingTxs, error: fetchError } = await supabase
        .from('ap_ar_transactions')
        .select('*')
        .eq('contact_id', contactId)
        .in('status', ['unpaid', 'partially paid'])
        .order('date', { ascending: true });

    if (fetchError) throw fetchError;
    
    let amountToSettle = paymentAmount;

    if (outstandingTxs && outstandingTxs.length > 0) {
        for (const tx of outstandingTxs) {
            if (amountToSettle <= 0) break;
            const remainingBalance = tx.amount - tx.paid_amount;
            const paymentForThisTx = Math.min(amountToSettle, remainingBalance);
            const newPaidAmount = tx.paid_amount + paymentForThisTx;
            const newStatus = newPaidAmount >= tx.amount ? 'paid' : 'partially paid';

            const { error: updateError } = await supabase
                .from('ap_ar_transactions')
                .update({ paid_amount: newPaidAmount, status: newStatus })
                .eq('id', tx.id);
            if (updateError) throw updateError;
            
            const { error: installmentError } = await supabase.from('ledger_payments').insert({
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
    contact_id: z.string(), payment_amount: z.number(), payment_date: z.string(),
    payment_method: z.enum(['cash', 'bank']), ledger_type: z.enum(['payable', 'receivable']),
    bank_id: z.string().optional(), description: z.string(),
});

export async function recordPaymentAgainstTotal(input: z.infer<typeof RecordPaymentAgainstTotalInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can record payments.");

        const supabase = createAdminSupabaseClient();
        const financialTxData = {
            date: input.payment_date, description: input.description,
            category: input.ledger_type === 'payable' ? 'A/P Settlement' : 'A/R Settlement',
            expected_amount: input.payment_amount, actual_amount: input.payment_amount, difference: 0,
            contact_id: input.contact_id,
        };

        let financialTxId: string;
        if (input.payment_method === 'cash') {
            const { data: tx, error } = await supabase.from('cash_transactions').insert({ ...financialTxData, type: input.ledger_type === 'payable' ? 'expense' : 'income' }).select('id').single();
            if (error) throw error;
            financialTxId = tx.id;
        } else {
            const { data: tx, error } = await supabase.from('bank_transactions').insert({ ...financialTxData, type: input.ledger_type === 'payable' ? 'withdrawal' : 'deposit', bank_id: input.bank_id! }).select('id').single();
            if (error) throw error;
            financialTxId = tx.id;
        }
        
        await applyPaymentToLedger(supabase, input.contact_id, input.payment_amount, input.payment_date, input.payment_method);
        await logActivity(`Recorded payment of ${input.payment_amount} ${input.ledger_type === 'payable' ? 'to' : 'from'} contact ID ${input.contact_id} via ${input.payment_method}`);
        return { success: true, financialTxId };
    } catch (error: any) {
        return handleApiError(error);
    }
}


const RecordDirectPaymentInputSchema = z.object({
  payment_method: z.enum(['cash', 'bank']), bank_id: z.string().optional(), date: z.string(),
  amount: z.number(), category: z.enum(['A/R Settlement', 'A/P Settlement']), description: z.string(),
  contact_id: z.string(),
});

export async function recordDirectPayment(input: z.infer<typeof RecordDirectPaymentInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can record payments.");
        const supabase = createAdminSupabaseClient();
        await applyPaymentToLedger(supabase, input.contact_id, input.amount, input.date, input.payment_method);
        await logActivity(`Recorded ${input.category} of ${input.amount} for contact ${input.contact_id}`);
        return { success: true };
    } catch (error: any) {
        return handleApiError(error);
    }
}

const AddStockTransactionInputSchema = z.object({ 
    stockTx: z.any(), 
    newContact: z.object({ name: z.string(), type: z.enum(['vendor', 'client']) }).optional(),
    localId: z.string() 
});

export async function addStockTransaction(input: z.infer<typeof AddStockTransactionInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can add transactions.");
        
        const supabase = createAdminSupabaseClient();
        const { stockTx, newContact } = input;
        
        let finalContactId = stockTx.contact_id;
        let finalContactName = stockTx.contact_name;

        if (newContact) {
            const { data: createdContact, error: contactError } = await supabase
                .from('contacts')
                .insert({ name: newContact.name, type: newContact.type })
                .select('id, name')
                .single();
            if (contactError) throw new Error(`Failed to create new contact: ${contactError.message}`);
            finalContactId = createdContact.id;
            finalContactName = createdContact.name;
        }

        const { id, ...stockTxToSave } = { ...stockTx, contact_id: finalContactId, contact_name: finalContactName };
        
        const { data: savedStockTx, error: stockError } = await supabase.from('stock_transactions').insert(stockTxToSave).select().single();
        if(stockError) throw stockError;

        let savedFinancialTx = null;
        if (stockTx.paymentMethod === 'cash' || stockTx.paymentMethod === 'bank') {
            const financialTxData = {
                date: stockTx.date, expected_amount: stockTx.expected_amount, actual_amount: stockTx.actual_amount,
                difference: stockTx.difference, difference_reason: stockTx.difference_reason,
                description: stockTx.description || `${stockTx.type} of ${stockTx.weight}kg of ${stockTx.stockItemName}`,
                category: stockTx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale', linkedStockTxId: savedStockTx.id,
                contact_id: finalContactId
            };
            const tableName = stockTx.paymentMethod === 'cash' ? 'cash_transactions' : 'bank_transactions';
            const type = stockTx.paymentMethod === 'cash' ? (stockTx.type === 'purchase' ? 'expense' : 'income') : (stockTx.type === 'purchase' ? 'withdrawal' : 'deposit');
            const { data, error } = await supabase.from(tableName).insert({ ...financialTxData, type, bank_id: stockTx.bank_id }).select().single();
            if(error) throw error;
            savedFinancialTx = data;
        } else if (stockTx.paymentMethod === 'credit') {
             if (!finalContactId) {
                throw new Error("Contact information is missing for credit stock transaction.");
            }
            if (!finalContactName) {
                 const {data: contact} = await supabase.from('contacts').select('name').eq('id', finalContactId).single();
                 if (!contact) throw new Error("Contact not found for credit transaction.");
                 finalContactName = contact.name;
            }

            let amountToLog = stockTx.actual_amount;
            
            const { data: advances } = await supabase
                .from('ap_ar_transactions')
                .select('id, amount')
                .eq('contact_id', finalContactId)
                .eq('type', 'advance')
                .lt('amount', 0);

            if (advances && advances.length > 0) {
                for (const advance of advances) {
                    if (amountToLog <= 0) break;
                    const advanceBalance = Math.abs(advance.amount);
                    const amountToSettle = Math.min(amountToLog, advanceBalance);
                    
                    const { error: updateError } = await supabase.from('ap_ar_transactions').update({ amount: advance.amount + amountToSettle }).eq('id', advance.id);
                    if (updateError) throw updateError;
                    
                    amountToLog -= amountToSettle;
                }
            }


            if (amountToLog <= 0) {
                await logActivity(`Added stock transaction (credit, fully covered by advance): ${stockTx.stockItemName}`);
                return { stockTx: savedStockTx, financialTx: null };
            }
            
            const ledgerData = {
                type: stockTx.type === 'purchase' ? 'payable' : 'receivable',
                description: stockTx.description || `${stockTx.stockItemName} (${stockTx.weight}kg)`,
                amount: amountToLog,
                date: stockTx.date,
                contact_id: finalContactId,
                status: 'unpaid',
                paid_amount: 0,
                contact_name: finalContactName,
            };
            const { error } = await supabase.from('ap_ar_transactions').insert(ledgerData);
            if (error) throw error;
        }
        await logActivity(`Added stock transaction: ${stockTx.stockItemName}`);
        return { stockTx: savedStockTx, financialTx: savedFinancialTx };
    } catch (error) {
        return handleApiError(error);
    }
}
    
const UpdateStockTransactionInputSchema = z.object({ stockTxId: z.string(), updates: z.record(z.any()) });

export async function updateStockTransaction(input: z.infer<typeof UpdateStockTransactionInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can update transactions.");
        
        const supabase = createAdminSupabaseClient();
        const { data: updatedStockTx, error: stockError } = await supabase.from('stock_transactions').update(input.updates).eq('id', input.stockTxId).select().single();
        if (stockError) throw stockError;
        if (!updatedStockTx) throw new Error("Failed to find the stock transaction after update.");

        const { data: linkedCashTx } = await supabase.from('cash_transactions').select('id').eq('linkedStockTxId', input.stockTxId).maybeSingle();
        const { data: linkedBankTx } = await supabase.from('bank_transactions').select('id').eq('linkedStockTxId', input.stockTxId).maybeSingle();
        
        const financialUpdates = {
            actual_amount: updatedStockTx.actual_amount, expected_amount: updatedStockTx.expected_amount,
            difference: updatedStockTx.difference, difference_reason: updatedStockTx.difference_reason,
        };
        if (linkedCashTx) await supabase.from('cash_transactions').update(financialUpdates).eq('id', linkedCashTx.id);
        if (linkedBankTx) await supabase.from('bank_transactions').update(financialUpdates).eq('id', linkedBankTx.id);

        await logActivity(`Edited stock transaction: ${input.stockTxId}`);
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}    

const SetInitialBalancesSchema = z.object({
  cash: z.number().nonnegative(),
  bankTotals: z.record(z.string(), z.number().nonnegative()),
  stockItems: z.array(z.object({ name: z.string(), weight: z.number(), pricePerKg: z.number() })),
  date: z.string(),
});

export async function setInitialBalances(input: z.infer<typeof SetInitialBalancesSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can set initial balances.");
        const supabase = createAdminSupabaseClient();
        
        await supabase.from('cash_transactions').delete().eq('category', 'Initial Balance');
        await supabase.from('bank_transactions').delete().eq('category', 'Initial Balance');
        await supabase.from('initial_stock').delete().gt('created_at', '1970-01-01T00:00:00Z');

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

        if (input.stockItems.length > 0) {
            const stockData = input.stockItems.map(item => ({
                name: item.name,
                weight: item.weight,
                purchasePricePerKg: item.pricePerKg,
            }));
            await supabase.from('initial_stock').insert(stockData);
        }

        await logActivity("Set initial cash, bank, and stock balances.");
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}


const TransferFundsSchema = z.object({ from: z.enum(['cash', 'bank']), amount: z.number().positive(), date: z.string(), bankId: z.string(), description: z.string().optional() });

export async function transferFunds(input: z.infer<typeof TransferFundsSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can transfer funds.");
        const supabase = createAdminSupabaseClient();
        const fromDesc = `Transfer to ${input.from === 'cash' ? 'Bank' : 'Cash'}: ${input.description || 'Funds Transfer'}`;
        const toDesc = `Transfer from ${input.from === 'cash' ? 'Cash' : 'Bank'}: ${input.description || 'Funds Transfer'}`;
        const commonData = { date: input.date, actual_amount: input.amount, expected_amount: input.amount, difference: 0, category: 'Funds Transfer' };

        let cashTxId, bankTxId;

        if (input.from === 'cash') {
            const { data: cashTx } = await supabase.from('cash_transactions').insert({ ...commonData, type: 'expense', description: fromDesc }).select('id').single();
            cashTxId = cashTx?.id;
            const { data: bankTx } = await supabase.from('bank_transactions').insert({ ...commonData, type: 'deposit', description: toDesc, bank_id: input.bankId }).select('id').single();
            bankTxId = bankTx?.id;
        } else {
            const { data: bankTx } = await supabase.from('bank_transactions').insert({ ...commonData, type: 'withdrawal', description: fromDesc, bank_id: input.bankId }).select('id').single();
            bankTxId = bankTx?.id;
            const { data: cashTx } = await supabase.from('cash_transactions').insert({ ...commonData, type: 'income', description: toDesc }).select('id').single();
            cashTxId = cashTx?.id;
        }
        
        await logActivity(`Transferred ${input.amount} from ${input.from}`);
        return { success: true, cashTxId, bankTxId };
    } catch (error) {
        return handleApiError(error);
    }
}

const RecordAdvancePaymentSchema = z.object({
    contact_id: z.string(), amount: z.number().positive(), date: z.string(),
    payment_method: z.enum(['cash', 'bank']), ledger_type: z.enum(['payable', 'receivable']),
    bank_id: z.string().optional(), description: z.string().optional(),
});

export async function recordAdvancePayment(input: z.infer<typeof RecordAdvancePaymentSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can record advance payments.");
        const supabase = createAdminSupabaseClient();
        const { contact_id, amount, date, payment_method, ledger_type, bank_id, description } = input;
        
        const contact = await supabase.from('contacts').select('name').eq('id', contact_id).single();
        if (!contact.data) throw new Error("Contact not found");

        const ledgerAmount = -amount;
        const ledgerDescription = description || `Advance ${ledger_type === 'payable' ? 'to' : 'from'} ${contact.data.name}`;
        
        const { data: ledgerEntry, error: ledgerError } = await supabase.from('ap_ar_transactions').insert({
            type: 'advance', date: date, description: ledgerDescription, amount: ledgerAmount, paid_amount: 0,
            status: 'paid', contact_id: contact_id, contact_name: contact.data.name
        }).select().single();
        if (ledgerError) throw new Error(ledgerError.message);
        if (!ledgerEntry) throw new Error("Failed to create ledger entry for advance.");

        const financialTxData = {
            date: date, description: ledgerDescription, category: `Advance ${ledger_type === 'payable' ? 'Payment' : 'Received'}`,
            expected_amount: amount, actual_amount: amount, difference: 0, advance_id: ledgerEntry.id, contact_id: contact_id,
        };

        if (payment_method === 'cash') {
            const {data: cashTx, error: cashErr} = await supabase.from('cash_transactions').insert({ ...financialTxData, type: ledger_type === 'payable' ? 'expense' : 'income' }).select().single();
            if(cashErr) throw new Error(cashErr.message);
            return {ledgerEntry, financialTx: cashTx}
        } else {
            const {data: bankTx, error: bankErr} = await supabase.from('bank_transactions').insert({ ...financialTxData, type: ledger_type === 'payable' ? 'withdrawal' : 'deposit', bank_id: bank_id! }).select().single();
            if(bankErr) throw new Error(bankErr.message);
            return {ledgerEntry, financialTx: bankTx}
        }
    } catch (error) {
        return handleApiError(error);
    }
}


const toYYYYMMDD = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

export async function getOrCreateSnapshot(date: string): Promise<MonthlySnapshot | null> {
    try {
        const session = await getSession();
        if (!session) throw new Error("SESSION_EXPIRED");
        const supabase = createAdminSupabaseClient();
        
        const snapshotDate = toYYYYMMDD(startOfMonth(new Date(date)));
        const { data: existingSnapshot } = await supabase.from('monthly_snapshots').select('*').eq('snapshot_date', snapshotDate).maybeSingle();
        if (existingSnapshot) return existingSnapshot;
        
        if (session.role !== 'admin') return null;

        const calculationEndDate = toYYYYMMDD(endOfMonth(subMonths(new Date(snapshotDate), 1)));
        const [cashTxs, bankTxs, ledgerTxs, stockTxs, initialStock] = await Promise.all([
            readData({ tableName: 'cash_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'bank_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'ap_ar_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'stock_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'initial_stock', select: '*' }),
        ]);

        const cash_balance = Array.isArray(cashTxs) ? (cashTxs as any[]).reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0) : 0;
        const bank_balances: Record<string, number> = {};
        if (Array.isArray(bankTxs)) {
            (bankTxs as any[]).forEach(tx => {
                if (!bank_balances[tx.bank_id]) bank_balances[tx.bank_id] = 0;
                bank_balances[tx.bank_id] += (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount);
            });
        }

        const total_receivables = Array.isArray(ledgerTxs) ? (ledgerTxs as any[]).filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0) : 0;
        const total_payables = Array.isArray(ledgerTxs) ? (ledgerTxs as any[]).filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0) : 0;
        
        const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};
        if (Array.isArray(initialStock)) {
            (initialStock as any[]).forEach(item => {
                if (!stockPortfolio[item.name]) stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
                stockPortfolio[item.name].weight += item.weight;
                stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
            });
        }
        if (Array.isArray(stockTxs)) {
            (stockTxs as any[]).forEach(tx => {
                if (!stockPortfolio[tx.stockItemName]) stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
                const item = stockPortfolio[tx.stockItemName];
                const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;
                if (tx.type === 'purchase') {
                    item.weight += tx.weight;
                    item.totalValue += tx.weight * tx.pricePerKg;
                } else {
                    item.weight -= tx.weight;
                    item.totalValue -= tx.weight * currentAvgPrice;
                }
            });
        }
        const stock_items: Record<string, { weight: number; value: number }> = {};
        Object.entries(stockPortfolio).forEach(([name, data]) => {
            stock_items[name] = { weight: data.weight, value: data.totalValue };
        });

        const newSnapshot: Omit<MonthlySnapshot, 'id' | 'created_at'> = {
            snapshot_date: snapshotDate, cash_balance, bank_balances,
            stock_items, total_receivables, total_payables,
        };

        const { data: savedSnapshot, error } = await supabase.from('monthly_snapshots').insert(newSnapshot).select().single();
        if (error) {
            console.error("Failed to create snapshot:", error);
            return null;
        }
        await logActivity(`Generated monthly snapshot for ${snapshotDate}`);
        return savedSnapshot;
    } catch(error) {
        return handleApiError(error);
    }
}

const AddLoanSchema = z.object({
  loanData: z.any(),
  disbursement: z.object({
    method: z.enum(['cash', 'bank']),
    bank_id: z.string().optional(),
  }),
  newContact: z.object({
    name: z.string(),
    type: z.enum(['vendor', 'client']),
  }).optional(),
  localId: z.string(),
  localFinancialId: z.string(),
});


export async function addLoan(input: z.infer<typeof AddLoanSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can add loans.");

        const { loanData, disbursement, newContact } = input;
        const supabase = createAdminSupabaseClient();
        
        let finalContactId = loanData.contact_id;

        if (newContact) {
            const { data: createdContact, error: contactError } = await supabase
                .from('contacts')
                .insert({ name: newContact.name, type: newContact.type })
                .select('id')
                .single();
            if (contactError) throw new Error(`Failed to create new contact: ${contactError.message}`);
            finalContactId = createdContact.id;
        }
        
        if (!finalContactId) {
            throw new Error("Contact ID is missing for the loan.");
        }

        const dataForLoanInsert = {
            ...loanData,
            contact_id: finalContactId,
            status: 'active',
        };
        
        const { data: loan, error: loanError } = await supabase.from('loans').insert(dataForLoanInsert).select().single();

        if (loanError) throw loanError;

        const financialTxData = {
            date: loan.issue_date,
            description: `Loan ${loan.type === 'payable' ? 'received from' : 'given to'} contact ID ${loan.contact_id}`,
            category: loan.type === 'payable' ? 'Loan In' : 'Loan Out',
            expected_amount: loan.principal_amount,
            actual_amount: loan.principal_amount,
            difference: 0,
            contact_id: loan.contact_id,
            linkedLoanId: loan.id,
        };
        
        let savedFinancialTx;

        if (disbursement.method === 'cash') {
            const { data, error } = await supabase.from('cash_transactions').insert({
                ...financialTxData,
                type: loan.type === 'payable' ? 'income' : 'expense',
            }).select().single();
            if(error) throw error;
            savedFinancialTx = data;

        } else {
            const { data, error } = await supabase.from('bank_transactions').insert({
                ...financialTxData,
                type: loan.type === 'payable' ? 'deposit' : 'withdrawal',
                bank_id: disbursement.bank_id,
            }).select().single();
             if(error) throw error;
            savedFinancialTx = data;
        }

        await logActivity(`Added new ${loan.type} loan for ${loan.principal_amount}`);
        return { loan, financialTx: savedFinancialTx };

    } catch(error) {
        return handleApiError(error);
    }
}

const RecordLoanPaymentSchema = z.object({
    loan_id: z.string(),
    amount: z.number().positive(),
    payment_date: z.string(),
    payment_method: z.enum(['cash', 'bank']),
    bank_id: z.string().optional(),
    notes: z.string().optional(),
    localPaymentId: z.string(),
    localFinancialId: z.string(),
});

export async function recordLoanPayment(input: z.infer<typeof RecordLoanPaymentSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can record loan payments.");

        const supabase = createAdminSupabaseClient();
        const { loan_id, amount, payment_date, payment_method, bank_id, notes } = input;

        const { data: loan, error: loanError } = await supabase.from('loans').select('*').eq('id', loan_id).single();
        if (loanError || !loan) throw new Error("Loan not found.");

        const { data: existingPayments, error: paymentsError } = await supabase.from('loan_payments').select('amount').eq('loan_id', loan_id);
        if (paymentsError) throw paymentsError;

        const financialTxData = {
            date: payment_date,
            description: `Payment for loan from ${loan.contact_id}`,
            category: 'Loan Payment',
            expected_amount: amount,
            actual_amount: amount,
            difference: 0,
            contact_id: loan.contact_id,
            linkedLoanId: loan.id,
        };

        let savedFinancialTx;
        if (payment_method === 'cash') {
            const { data, error } = await supabase.from('cash_transactions').insert({ ...financialTxData, type: loan.type === 'payable' ? 'expense' : 'income' }).select().single();
            if(error) throw error;
            savedFinancialTx = data;
        } else {
            const { data, error } = await supabase.from('bank_transactions').insert({ ...financialTxData, type: loan.type === 'payable' ? 'withdrawal' : 'deposit', bank_id: bank_id! }).select().single();
             if(error) throw error;
            savedFinancialTx = data;
        }

        const { data: savedPayment, error: paymentError } = await supabase.from('loan_payments').insert({
            loan_id,
            payment_date,
            amount,
            notes,
            linked_transaction_id: savedFinancialTx.id
        }).select().single();
        if (paymentError) throw paymentError;

        const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + savedPayment.amount;
        if (totalPaid >= loan.principal_amount) {
            await supabase.from('loans').update({ status: 'paid' }).eq('id', loan_id);
        }
        
        await logActivity(`Recorded payment of ${amount} for loan ${loan_id}`);
        return { savedPayment, financialTx: savedFinancialTx };
    } catch(error) {
        return handleApiError(error);
    }
}

export async function clearActivityLog() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can clear the activity log.");
        const supabase = createAdminSupabaseClient();
        const { error } = await supabase.from('activity_log').delete().gt('id', 0);
        if (error) throw error;
        await logActivity("Cleared the activity log.");
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}

    
