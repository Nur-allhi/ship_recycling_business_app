'use server';
/**
 * @fileOverview A flow for reading data from a Google Sheet.
 *
 * - readSheetData - A function that handles reading data from the sheet.
 * - ReadSheetInput - The input type for the readSheetData function.
 * - ReadSheetOutput - The return type for the readSheetData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { sheets, sheetId } from '@/services/google-sheets';

const ReadSheetInputSchema = z.object({
  range: z.string().describe('The A1 notation of the range to retrieve values from. E.g., "Sheet1!A1:B2".'),
});
export type ReadSheetInput = z.infer<typeof ReadSheetInputSchema>;

const ReadSheetOutputSchema = z.array(z.array(z.any())).describe('A 2D array of values from the sheet.');
export type ReadSheetOutput = z.infer<typeof ReadSheetOutputSchema>;

export async function readSheetData(input: ReadSheetInput): Promise<ReadSheetOutput> {
  return readSheetDataFlow(input);
}

const readSheetDataFlow = ai.defineFlow(
  {
    name: 'readSheetDataFlow',
    inputSchema: ReadSheetInputSchema,
    outputSchema: ReadSheetOutputSchema,
  },
  async (input) => {
    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable not set.');
    }
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: input.range,
    });
    
    return response.data.values || [];
  }
);
