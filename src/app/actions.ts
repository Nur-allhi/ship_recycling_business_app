
'use server';

import { z } from 'zod';
import { sheets, sheetId, getSheetIdByName } from '@/services/google-sheets';

const ReadSheetInputSchema = z.object({
  range: z.string().describe('The A1 notation of the range to retrieve values from. E.g., "Sheet1!A1:B2".'),
});

export type ReadSheetInput = z.infer<typeof ReadSheetInputSchema>;

export async function readSheetData(input: ReadSheetInput) {
    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable not set.');
    }
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: input.range,
    });
    
    return response.data.values || [];
}

const AppendSheetRowInputSchema = z.object({
    range: z.string(),
    values: z.array(z.any()),
});

export async function appendSheetRow(input: z.infer<typeof AppendSheetRowInputSchema>) {
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID is not set.');
    
    const response = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: input.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [input.values],
        }
    });
    return response.data;
}


const UpdateSheetRowInputSchema = z.object({
    range: z.string(),
    values: z.array(z.any()),
});

export async function updateSheetRow(input: z.infer<typeof UpdateSheetRowInputSchema>) {
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID is not set.');
    
    const response = await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: input.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [input.values],
        }
    });
    return response.data;
}

const DeleteSheetRowInputSchema = z.object({
    sheetName: z.string(),
    rowIndex: z.number().int().positive(), // 1-based index
});

export async function deleteSheetRow(input: z.infer<typeof DeleteSheetRowInputSchema>) {
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID is not set.');

    const GIDSHEETID = await getSheetIdByName(input.sheetName);
    if (GIDSHEETID === null) {
        throw new Error(`Sheet with name "${input.sheetName}" not found.`);
    }

    const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: GIDSHEETID,
                        dimension: 'ROWS',
                        startIndex: input.rowIndex - 1, // API is 0-indexed
                        endIndex: input.rowIndex,
                    }
                }
            }]
        }
    });
    return response.data;
}

export async function initializeSheets() {
    try {
        const cashHeaders = ['Date', 'Type', 'Amount', 'Description', 'Category'];
        await updateSheetRow({ range: 'Cash!A1', values: cashHeaders });
        
        const bankHeaders = ['Date', 'Type', 'Amount', 'Description', 'Category'];
        await updateSheetRow({ range: 'Bank!A1', values: bankHeaders });
        
        const stockTxHeaders = ['Date', 'Type', 'Item Name', 'Weight', 'Price/kg', 'Payment', 'Description'];
        await updateSheetRow({ range: 'Stock Transactions!A1', values: stockTxHeaders });
        
        const initialStockHeaders = ['Item Name', 'Initial Weight', 'Average Purchase Price/kg'];
        await updateSheetRow({ range: 'Initial Stock!A1', values: initialStockHeaders });
        
        return { success: true };
    } catch (error: any) {
        console.error("Failed to initialize sheets:", error);
        return { success: false, error: error.message };
    }
}
