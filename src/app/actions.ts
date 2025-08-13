'use server';

import { z } from 'zod';
import { sheets, sheetId } from '@/services/google-sheets';

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
