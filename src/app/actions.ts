
'use server';

import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});

export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
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
    const { error } = await supabase
        .from(input.tableName)
        .update({ deletedAt: null })
        .eq('id', input.id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function exportAllData() {
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
    const tables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories'];
    
    // Use a transaction to ensure all-or-nothing import
    // Note: Supabase JS library doesn't directly support multi-table transactions in this way.
    // A db function would be better. For now, we execute sequentially and hope for the best.
    
    try {
        // Clear existing data in reverse order of dependency
        for (const tableName of [...tables].reverse()) {
            const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // A bit of a hack to delete all
            if (deleteError) throw new Error(`Failed to clear ${tableName}: ${deleteError.message}`);
        }

        // Import new data
        for (const tableName of tables) {
            const records = dataToImport[tableName];
            if (records && records.length > 0) {
                 // Supabase requires `id` to be omitted on insert if it's auto-generated, unless you specify upsert.
                 // We will assume the backup contains IDs and they should be preserved.
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
