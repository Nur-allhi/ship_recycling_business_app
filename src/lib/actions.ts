
'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/app/auth/actions';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';
import type { MonthlySnapshot, Loan, LoanPayment, Category } from '@/lib/types';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, and, gte, lte, isNull, isNotNull, sql } from 'drizzle-orm';

const tableMap: Record<string, any> = {
    banks: schema.banks,
    categories: schema.categories,
    contacts: schema.contacts,
    initial_stock: schema.initialStock,
    cash_transactions: schema.cashTransactions,
    bank_transactions: schema.bankTransactions,
    stock_transactions: schema.stockTransactions,
    ap_ar_transactions: schema.apArTransactions,
    ledger_payments: schema.ledgerPayments,
    loans: schema.loans,
    loan_payments: schema.loanPayments,
    activity_log: schema.activityLog,
    monthly_snapshots: schema.monthlySnapshots,
};

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
        
        await db.insert(schema.activityLog).values({ 
            description,
            userId: session.id,
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
    
    const table = tableMap[input.tableName];
    if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

    let query = db.select().from(table);

    const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];
    const conditions = [];

    if (softDeleteTables.includes(input.tableName)) {
      conditions.push(isNull(table.deletedAt));
    }
    
    if (input.startDate) {
        conditions.push(gte(table.date, input.startDate));
    }
    if (input.endDate) {
        conditions.push(lte(table.date, input.endDate));
    }

    const data = await (conditions.length > 0 ? query.where(and(...conditions)) : query);

    return data || [];
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
        
        const results: Record<string, any[]> = {};
        const softDeleteTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'ap_ar_transactions'];

        const queries = input.tables.map(async (tableInfo) => {
            const table = tableMap[tableInfo.tableName];
            if (!table) return { tableName: tableInfo.tableName, data: [] };

            let query = db.select().from(table);
            if (softDeleteTables.includes(tableInfo.tableName)) {
                query = query.where(isNull(table.deletedAt)) as any;
            }
            const data = await query;
            return { tableName: tableInfo.tableName, data: data || [] };
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

        const table = tableMap[input.tableName];
        if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

        const data = await db.select().from(table).where(isNotNull(table.deletedAt));
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

        const table = tableMap[input.tableName];
        if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

        const data = await db.select().from(table).where(eq(table.id, input.id)).limit(1);
        return data[0] || null;

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
        
        const table = tableMap[input.tableName];
        if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

        const dataToInsert = Array.isArray(input.data) ? input.data : [input.data];
        const results = await db.insert(table).values(dataToInsert).returning();
            
        if (input.logDescription) await logActivity(input.logDescription);
        return Array.isArray(input.data) ? (results as any[]) : ((results as any[])[0] as any);

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
    
    const table = tableMap[input.tableName];
    if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

    const results = await db.update(table)
        .set(input.data)
        .where(eq(table.id, input.id))
        .returning();

    if (input.logDescription) await logActivity(input.logDescription);
    return results;
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
    
    const table = tableMap[input.tableName];
    if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

    await db.update(table)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(table.id, input.id));
            
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
        
        await db.delete(schema.categories).where(eq(schema.categories.id, input.id));

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
        
        const table = tableMap[input.tableName];
        if (!table) throw new Error(`Table ${input.tableName} not found in schema.`);

        await db.update(table)
            .set({ deletedAt: null })
            .where(eq(table.id, input.id));

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

        const softDeleteTables = [schema.cashTransactions, schema.bankTransactions, schema.stockTransactions, schema.apArTransactions];
        
        for (const table of softDeleteTables) {
            await db.delete(table).where(isNotNull(table.deletedAt));
        }

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
        
        const tables = {
            banks: schema.banks,
            cash_transactions: schema.cashTransactions,
            bank_transactions: schema.bankTransactions,
            stock_transactions: schema.stockTransactions,
            initial_stock: schema.initialStock,
            categories: schema.categories,
            contacts: schema.contacts,
            ap_ar_transactions: schema.apArTransactions,
            ledger_payments: schema.ledgerPayments,
            loans: schema.loans,
            loan_payments: schema.loanPayments,
        };
        const exportedData: Record<string, any[]> = {};
        
        for (const [name, table] of Object.entries(tables)) {
            const data = await db.select().from(table);
            exportedData[name] = data;
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

        const tables = [
            schema.loanPayments, schema.ledgerPayments, schema.cashTransactions, schema.bankTransactions,
            schema.stockTransactions, schema.apArTransactions, schema.loans, schema.contacts,
            schema.initialStock, schema.categories, schema.banks, schema.monthlySnapshots, schema.activityLog
        ];

        db.transaction((tx) => {
            for (const table of tables) {
                tx.delete(table).run();
            }

            const importOrder = [
                { name: 'banks', table: schema.banks },
                { name: 'categories', table: schema.categories },
                { name: 'contacts', table: schema.contacts },
                { name: 'initial_stock', table: schema.initialStock },
                { name: 'cash_transactions', table: schema.cashTransactions },
                { name: 'bank_transactions', table: schema.bankTransactions },
                { name: 'stock_transactions', table: schema.stockTransactions },
                { name: 'ap_ar_transactions', table: schema.apArTransactions },
                { name: 'ledger_payments', table: schema.ledgerPayments },
                { name: 'monthly_snapshots', table: schema.monthlySnapshots },
                { name: 'loans', table: schema.loans },
                { name: 'loan_payments', table: schema.loanPayments }
            ];

            for (const { name, table } of importOrder) {
                const records = dataToImport[name];
                if (records && records.length > 0) {
                    tx.insert(table).values(records).run();
                }
            }
        });

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

        if (process.env.NODE_ENV === 'production') {
            throw new Error("This action is prohibited in production.");
        }

        const tablesToDelete = [
            schema.loanPayments,
            schema.ledgerPayments,
            schema.cashTransactions,
            schema.bankTransactions,
            schema.stockTransactions,
            schema.apArTransactions,
            schema.loans,
            schema.contacts,
            schema.initialStock,
            schema.categories,
            schema.banks,
            schema.activityLog,
            schema.monthlySnapshots,
        ];

        db.transaction((tx) => {
            for (const table of tablesToDelete) {
                tx.delete(table).run();
            }
        });

        try {
            const supabase = createAdminSupabaseClient();
            const { data: users, error: userError } = await supabase.auth.admin.listUsers();
            if(!userError && users) {
                for(const user of users.users) {
                    if (user.id !== session.id) {
                         await supabase.auth.admin.deleteUser(user.id);
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to delete Supabase users:", e);
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
        
        await db.delete(schema.contacts).where(eq(schema.contacts.id, input.id));

        await logActivity(`Deleted contact with ID: ${input.id}`);
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}


function applyPaymentToLedger(tx: any, contactId: string, paymentAmount: number, paymentDate: string, paymentMethod: 'cash' | 'bank') {
    const outstandingTxs = tx
        .select()
        .from(schema.apArTransactions)
        .where(
            and(
                eq(schema.apArTransactions.contactId, contactId),
                sql`${schema.apArTransactions.status} IN ('unpaid', 'partially paid')`
            )
        )
        .orderBy(schema.apArTransactions.date)
        .all();
    
    let amountToSettle = paymentAmount;

    if (outstandingTxs && outstandingTxs.length > 0) {
        for (const record of outstandingTxs) {
            if (amountToSettle <= 0) break;
            const remainingBalance = record.amount - record.paidAmount;
            const paymentForThisTx = Math.min(amountToSettle, remainingBalance);
            const newPaidAmount = record.paidAmount + paymentForThisTx;
            const newStatus = newPaidAmount >= record.amount ? 'paid' : 'partially paid';

            tx
                .update(schema.apArTransactions)
                .set({ paidAmount: newPaidAmount, status: newStatus })
                .where(eq(schema.apArTransactions.id, record.id))
                .run();
            
            tx.insert(schema.ledgerPayments).values({
                apArTransactionId: record.id,
                amount: paymentForThisTx,
                date: paymentDate,
                paymentMethod: paymentMethod,
            }).run();

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

        const result = db.transaction((tx) => {
            const financialTxData = {
                date: input.payment_date, description: input.description,
                category: input.ledger_type === 'payable' ? 'A/P Settlement' : 'A/R Settlement',
                expectedAmount: input.payment_amount, actualAmount: input.payment_amount, difference: 0,
                contactId: input.contact_id,
            };

            let financialTxId: string;
            if (input.payment_method === 'cash') {
                const [r] = tx.insert(schema.cashTransactions).values({ ...financialTxData, type: input.ledger_type === 'payable' ? 'expense' : 'income' }).returning({ id: schema.cashTransactions.id }).all();
                financialTxId = r.id;
            } else {
                const [r] = tx.insert(schema.bankTransactions).values({ ...financialTxData, type: input.ledger_type === 'payable' ? 'withdrawal' : 'deposit', bankId: input.bank_id! }).returning({ id: schema.bankTransactions.id }).all();
                financialTxId = r.id;
            }
            
            applyPaymentToLedger(tx, input.contact_id, input.payment_amount, input.payment_date, input.payment_method);
            return { success: true, financialTxId };
        });
        await logActivity(`Recorded payment of ${input.payment_amount} ${input.ledger_type === 'payable' ? 'to' : 'from'} contact ID ${input.contact_id} via ${input.payment_method}`);
        return result;
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
        db.transaction((tx) => {
            applyPaymentToLedger(tx, input.contact_id, input.amount, input.date, input.payment_method);
        });
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
        
        const { stockTx, newContact } = input;
        
        const result = db.transaction((tx) => {
            let finalContactId = stockTx.contact_id;
            let finalContactName = stockTx.contact_name;

            if (newContact) {
                const [createdContact] = tx
                    .insert(schema.contacts)
                    .values({ name: newContact.name, type: newContact.type })
                    .returning()
                    .all();
                finalContactId = createdContact.id;
                finalContactName = createdContact.name;
            }

            // Map frontend fields to Drizzle schema
            const stockTxToSave = {
                date: stockTx.date,
                stockItemName: stockTx.stockItemName,
                type: stockTx.type,
                weight: stockTx.weight,
                pricePerKg: stockTx.pricePerKg,
                paymentMethod: stockTx.paymentMethod,
                bankId: stockTx.bank_id,
                description: stockTx.description,
                expectedAmount: stockTx.expected_amount,
                actualAmount: stockTx.actual_amount,
                difference: stockTx.difference,
                differenceReason: stockTx.difference_reason,
                contactId: finalContactId,
                contactName: finalContactName,
            };
            
            const [savedStockTx] = tx.insert(schema.stockTransactions).values(stockTxToSave).returning().all();

            let savedFinancialTx = null;
            if (stockTx.paymentMethod === 'cash' || stockTx.paymentMethod === 'bank') {
                const financialTxData = {
                    date: stockTx.date, 
                    expectedAmount: stockTx.expected_amount, 
                    actualAmount: stockTx.actual_amount,
                    difference: stockTx.difference, 
                    differenceReason: stockTx.difference_reason,
                    description: stockTx.description || `${stockTx.type} of ${stockTx.weight}kg of ${stockTx.stockItemName}`,
                    category: stockTx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale', 
                    linkedStockTxId: savedStockTx.id,
                    contactId: finalContactId
                };
                
                if (stockTx.paymentMethod === 'cash') {
                    const [financialResult] = tx.insert(schema.cashTransactions).values({ ...financialTxData, type: stockTx.type === 'purchase' ? 'expense' : 'income' }).returning().all();
                    savedFinancialTx = financialResult;
                } else {
                    const [financialResult] = tx.insert(schema.bankTransactions).values({ ...financialTxData, type: stockTx.type === 'purchase' ? 'withdrawal' : 'deposit', bankId: stockTx.bank_id }).returning().all();
                    savedFinancialTx = financialResult;
                }
            } else if (stockTx.paymentMethod === 'credit') {
                 if (!finalContactId) {
                    throw new Error("Contact information is missing for credit stock transaction.");
                }
                
                let amountToLog = stockTx.actual_amount;
                const isPurchase = stockTx.type === 'purchase';
                
                const advances = tx
                    .select()
                    .from(schema.apArTransactions)
                    .where(
                        and(
                            eq(schema.apArTransactions.contactId, finalContactId),
                            eq(schema.apArTransactions.type, 'advance'),
                            isPurchase ? sql`${schema.apArTransactions.amount} < 0` : sql`${schema.apArTransactions.amount} > 0`
                        )
                    ).all();

                if (advances && advances.length > 0) {
                    for (const advance of advances) {
                        if (amountToLog <= 0) break;
                        const advanceBalance = Math.abs(advance.amount);
                        const amountToSettle = Math.min(amountToLog, advanceBalance);
                        
                        tx.update(schema.apArTransactions)
                            .set({ amount: advance.amount + (isPurchase ? amountToSettle : -amountToSettle) })
                            .where(eq(schema.apArTransactions.id, advance.id))
                            .run();
                        
                        amountToLog -= amountToSettle;
                    }
                }

                if (amountToLog > 0) {
                    const ledgerData: typeof schema.apArTransactions.$inferInsert = {
                        type: stockTx.type === 'purchase' ? 'payable' : 'receivable',
                        description: stockTx.description || `${stockTx.stockItemName} (${stockTx.weight}kg)`,
                        amount: amountToLog,
                        date: stockTx.date,
                        contactId: finalContactId,
                        status: 'unpaid',
                        paidAmount: 0,
                        contactName: finalContactName,
                    };
                    tx.insert(schema.apArTransactions).values(ledgerData).run();
                }
            }
            return { stockTx: savedStockTx, financialTx: savedFinancialTx };
        });
        await logActivity(`Added stock transaction: ${stockTx.stockItemName}`);
        return result;
    } catch (error) {
        return handleApiError(error);
    }
}
    
const UpdateStockTransactionInputSchema = z.object({ stockTxId: z.string(), updates: z.record(z.any()) });

export async function updateStockTransaction(input: z.infer<typeof UpdateStockTransactionInputSchema>) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can update transactions.");
        
        const result = db.transaction((tx) => {
            const [updatedStockTx] = tx.update(schema.stockTransactions).set(input.updates).where(eq(schema.stockTransactions.id, input.stockTxId)).returning().all();
            if (!updatedStockTx) throw new Error("Failed to find the stock transaction after update.");

            const financialUpdates = {
                actualAmount: updatedStockTx.actualAmount, 
                expectedAmount: updatedStockTx.expectedAmount,
                difference: updatedStockTx.difference, 
                differenceReason: updatedStockTx.differenceReason,
            };

            tx.update(schema.cashTransactions).set(financialUpdates).where(eq(schema.cashTransactions.linkedStockTxId, input.stockTxId)).run();
            tx.update(schema.bankTransactions).set(financialUpdates).where(eq(schema.bankTransactions.linkedStockTxId, input.stockTxId)).run();

            return { success: true };
        });
        await logActivity(`Edited stock transaction: ${input.stockTxId}`);
        return result;
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
    console.log("DEBUG: setInitialBalances called");
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can set initial balances.");
        
        db.transaction((tx) => {
            tx.delete(schema.cashTransactions).where(eq(schema.cashTransactions.category, 'Initial Balance')).run();
            tx.delete(schema.bankTransactions).where(eq(schema.bankTransactions.category, 'Initial Balance')).run();
            tx.delete(schema.initialStock).run();

            tx.insert(schema.cashTransactions).values({
                date: input.date, type: 'income', category: 'Initial Balance',
                description: 'Initial cash balance set.', actualAmount: input.cash, expectedAmount: input.cash, difference: 0,
            }).run();
            
            if (Object.keys(input.bankTotals).length > 0) {
                const bankInitialValues: (typeof schema.bankTransactions.$inferInsert)[] = Object.entries(input.bankTotals).map(([bank_id, amount]) => ({
                    date: input.date, type: 'deposit', category: 'Initial Balance',
                    description: 'Initial bank balance set.', bankId: bank_id, actualAmount: amount, expectedAmount: amount, difference: 0,
                }));
                tx.insert(schema.bankTransactions).values(bankInitialValues).run();
            }

            if (input.stockItems.length > 0) {
                const stockData = input.stockItems.map(item => ({
                    name: item.name,
                    weight: item.weight,
                    purchasePricePerKg: item.pricePerKg,
                }));
                tx.insert(schema.initialStock).values(stockData).run();
            }
        });

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
        
        const result = db.transaction((tx) => {
            const fromDesc = `Transfer to ${input.from === 'cash' ? 'Bank' : 'Cash'}: ${input.description || 'Funds Transfer'}`;
            const toDesc = `Transfer from ${input.from === 'cash' ? 'Cash' : 'Bank'}: ${input.description || 'Funds Transfer'}`;
            const commonData = { date: input.date, actualAmount: input.amount, expectedAmount: input.amount, difference: 0, category: 'Funds Transfer' };

            let cashTxId, bankTxId;

            if (input.from === 'cash') {
                const [cashResult] = tx.insert(schema.cashTransactions).values({ ...commonData, type: 'expense', description: fromDesc }).returning({ id: schema.cashTransactions.id }).all();
                cashTxId = cashResult.id;
                const [bankResult] = tx.insert(schema.bankTransactions).values({ ...commonData, type: 'deposit', description: toDesc, bankId: input.bankId }).returning({ id: schema.bankTransactions.id }).all();
                bankTxId = bankResult.id;
            } else {
                const [bankResult] = tx.insert(schema.bankTransactions).values({ ...commonData, type: 'withdrawal', description: fromDesc, bankId: input.bankId }).returning({ id: schema.bankTransactions.id }).all();
                bankTxId = bankResult.id;
                const [cashResult] = tx.insert(schema.cashTransactions).values({ ...commonData, type: 'income', description: toDesc }).returning({ id: schema.cashTransactions.id }).all();
                cashTxId = cashResult.id;
            }
            
            return { success: true, cashTxId, bankTxId };
        });
        await logActivity(`Transferred ${input.amount} from ${input.from}`);
        return result;
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
        
        return db.transaction((tx) => {
            const { contact_id, amount, date, payment_method, ledger_type, bank_id, description } = input;
            
            const [contact] = tx.select().from(schema.contacts).where(eq(schema.contacts.id, contact_id)).limit(1).all();
            if (!contact) throw new Error("Contact not found");

            const ledgerAmount = -amount;
            const ledgerDescription = description || `Advance ${ledger_type === 'payable' ? 'to' : 'from'} ${contact.name}`;
            
            const [ledgerEntry] = tx.insert(schema.apArTransactions).values({
                type: 'advance', date: date, description: ledgerDescription, amount: ledgerAmount, paidAmount: 0,
                status: 'paid', contactId: contact_id, contactName: contact.name
            }).returning().all();

            const financialTxData = {
                date: date, description: ledgerDescription, category: `Advance ${ledger_type === 'payable' ? 'Payment' : 'Received'}`,
                expectedAmount: amount, actualAmount: amount, difference: 0, advanceId: ledgerEntry.id, contactId: contact_id,
            };

            if (payment_method === 'cash') {
                const [cashTx] = tx.insert(schema.cashTransactions).values({ ...financialTxData, type: ledger_type === 'payable' ? 'expense' : 'income' }).returning().all();
                return {ledgerEntry, financialTx: cashTx}
            } else {
                const [bankTx] = tx.insert(schema.bankTransactions).values({ ...financialTxData, type: ledger_type === 'payable' ? 'withdrawal' : 'deposit', bankId: bank_id! }).returning().all();
                return {ledgerEntry, financialTx: bankTx}
            }
        });
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
        
        const snapshotDate = toYYYYMMDD(startOfMonth(new Date(date)));
        const [existingSnapshot] = await db.select().from(schema.monthlySnapshots).where(eq(schema.monthlySnapshots.snapshotDate, snapshotDate)).limit(1);
        
        if (existingSnapshot) {
            return {
                id: existingSnapshot.id,
                snapshot_date: existingSnapshot.snapshotDate,
                cash_balance: existingSnapshot.cashBalance,
                bank_balances: existingSnapshot.bankBalances as Record<string, number>,
                stock_items: existingSnapshot.stockItems as Record<string, { weight: number, value: number }>,
                total_receivables: existingSnapshot.totalReceivables,
                total_payables: existingSnapshot.totalPayables,
                created_at: existingSnapshot.createdAt!,
            } as MonthlySnapshot;
        }
        
        if (session.role !== 'admin') return null;

        const calculationEndDate = toYYYYMMDD(endOfMonth(subMonths(new Date(snapshotDate), 1)));
        const [cashTxs, bankTxs, ledgerTxs, stockTxs, initialStock] = await Promise.all([
            readData({ tableName: 'cash_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'bank_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'ap_ar_transactions', endDate: calculationEndDate, select: '*' }),
            readData({ tableName: 'stock_transactions', endDate: calculationEndDate, select: '*' }),
            db.select().from(schema.initialStock),
        ]);

        const cash_balance = cashTxs.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actualAmount : -tx.actualAmount), 0);
        const bank_balances: Record<string, number> = {};
        bankTxs.forEach(tx => {
            if (!bank_balances[tx.bankId]) bank_balances[tx.bankId] = 0;
            bank_balances[tx.bankId] += (tx.type === 'deposit' ? tx.actualAmount : -tx.actualAmount);
        });

        const total_receivables = ledgerTxs.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paidAmount), 0);
        const total_payables = ledgerTxs.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paidAmount), 0);
        
        const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};
        initialStock.forEach(item => {
            if (!stockPortfolio[item.name]) stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
            stockPortfolio[item.name].weight += item.weight;
            stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
        });
        stockTxs.forEach(tx => {
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
        const stock_items: Record<string, { weight: number; value: number }> = {};
        Object.entries(stockPortfolio).forEach(([name, data]) => {
            stock_items[name] = { weight: data.weight, value: data.totalValue };
        });

        const newSnapshot = {
            snapshotDate, cashBalance: cash_balance, bankBalances: bank_balances,
            stockItems: stock_items, totalReceivables: total_receivables, totalPayables: total_payables,
        };

        const [savedSnapshot] = await db.insert(schema.monthlySnapshots).values(newSnapshot).returning();
        await logActivity(`Generated monthly snapshot for ${snapshotDate}`);
        
        return {
            id: savedSnapshot.id,
            snapshot_date: savedSnapshot.snapshotDate,
            cash_balance: savedSnapshot.cashBalance,
            bank_balances: savedSnapshot.bankBalances as Record<string, number>,
            stock_items: savedSnapshot.stockItems as Record<string, { weight: number, value: number }>,
            total_receivables: savedSnapshot.totalReceivables,
            total_payables: savedSnapshot.totalPayables,
            created_at: savedSnapshot.createdAt!,
        } as MonthlySnapshot;

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
        
        const result = db.transaction((tx) => {
            let finalContactId = loanData.contact_id;

            if (newContact) {
                const [createdContact] = tx
                    .insert(schema.contacts)
                    .values({ name: newContact.name, type: newContact.type })
                    .returning()
                    .all();
                finalContactId = createdContact.id;
            }
            
            if (!finalContactId) {
                throw new Error("Contact ID is missing for the loan.");
            }

            const dataForLoanInsert: typeof schema.loans.$inferInsert = {
                type: loanData.type as 'payable' | 'receivable',
                principalAmount: loanData.principal_amount,
                interestRate: loanData.interest_rate,
                issueDate: loanData.issue_date,
                dueDate: loanData.due_date,
                notes: loanData.notes,
                contactId: finalContactId,
                status: 'active',
            };
            
            const [loan] = tx.insert(schema.loans).values(dataForLoanInsert).returning().all();

            const financialTxData = {
                date: loan.issueDate,
                description: `Loan ${loan.type === 'payable' ? 'received from' : 'given to'} contact ID ${loan.contactId}`,
                category: loan.type === 'payable' ? 'Loan In' : 'Loan Out',
                expectedAmount: loan.principalAmount,
                actualAmount: loan.principalAmount,
                difference: 0,
                contactId: loan.contactId,
                linkedLoanId: loan.id,
            };
            
            let savedFinancialTx;

            if (disbursement.method === 'cash') {
                const [r] = tx.insert(schema.cashTransactions).values({
                    ...financialTxData,
                    type: loan.type === 'payable' ? 'income' : 'expense',
                }).returning().all();
                savedFinancialTx = r;

            } else {
                const [r] = tx.insert(schema.bankTransactions).values({
                    ...financialTxData,
                    type: loan.type === 'payable' ? 'deposit' : 'withdrawal',
                    bankId: disbursement.bank_id!,
                }).returning().all();
                savedFinancialTx = r;
            }

            return { loan, financialTx: savedFinancialTx };
        });
        await logActivity(`Added new ${result.loan.type} loan for ${result.loan.principalAmount}`);
        return result;

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

        const { loan_id, amount, payment_date, payment_method, bank_id, notes } = input;

        const result = db.transaction((tx) => {
            const [loan] = tx.select().from(schema.loans).where(eq(schema.loans.id, loan_id)).limit(1).all();
            if (!loan) throw new Error("Loan not found.");

            const existingPayments = tx.select({ amount: schema.loanPayments.amount }).from(schema.loanPayments).where(eq(schema.loanPayments.loanId, loan_id)).all();

            const financialTxData = {
                date: payment_date,
                description: `Payment for loan from ${loan.contactId}`,
                category: 'Loan Payment',
                expectedAmount: amount,
                actualAmount: amount,
                difference: 0,
                contactId: loan.contactId,
                linkedLoanId: loan.id,
            };

            let savedFinancialTx;
            if (payment_method === 'cash') {
                const [r] = tx.insert(schema.cashTransactions).values({ ...financialTxData, type: loan.type === 'payable' ? 'expense' : 'income' }).returning().all();
                savedFinancialTx = r;
            } else {
                const [r] = tx.insert(schema.bankTransactions).values({ ...financialTxData, type: loan.type === 'payable' ? 'withdrawal' : 'deposit', bankId: bank_id! }).returning().all();
                savedFinancialTx = r;
            }

            const [savedPayment] = tx.insert(schema.loanPayments).values({
                loanId: loan_id,
                paymentDate: payment_date,
                amount,
                notes,
                linkedTransactionId: savedFinancialTx.id
            }).returning().all();

            const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + savedPayment.amount;
            if (totalPaid >= loan.principalAmount) {
                tx.update(schema.loans).set({ status: 'paid' }).where(eq(schema.loans.id, loan_id)).run();
            }
            
            return { savedPayment, financialTx: savedFinancialTx };
        });
        await logActivity(`Recorded payment of ${amount} for loan ${loan_id}`);
        return result;
    } catch(error) {
        return handleApiError(error);
    }
}

export async function clearActivityLog() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') throw new Error("Only admins can clear the activity log.");
        
        await db.delete(schema.activityLog);
        
        await logActivity("Cleared the activity log.");
        return { success: true };
    } catch (error) {
        return handleApiError(error);
    }
}

    
