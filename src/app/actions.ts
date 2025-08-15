
'use server';

import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ReadDataInputSchema = z.object({
  tableName: z.string(),
  select: z.string().optional().default('*'),
});

export async function readData(input: z.infer<typeof ReadDataInputSchema>) {
  const { data, error } = await supabase
    .from(input.tableName)
    .select(input.select);

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

export async function deleteData(input: z.infer<typeof DeleteDataInputSchema>) {
  const { error } = await supabase
    .from(input.tableName)
    .delete()
    .eq('id', input.id);
    
  if (error) throw new Error(error.message);
  return { success: true };
}
