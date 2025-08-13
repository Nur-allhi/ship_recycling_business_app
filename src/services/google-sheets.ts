
/**
 * @fileoverview Service for interacting with the Google Sheets API.
 * This service provides methods to authenticate and access Google Sheets using a service account.
 * It is configured via environment variables.
 *
 * GOOGLE_SHEETS_CLIENT_EMAIL: The email address of the service account.
 * GOOGLE_SHEETS_PRIVATE_KEY: The private key of the service account.
 * GOOGLE_SHEET_ID: The ID of the Google Sheet to interact with.
 */
import { google } from 'googleapis';

// Ensure environment variables are loaded. In Next.js, this is typically handled in next.config.js.
const client_email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const private_key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
export const sheetId = process.env.GOOGLE_SHEET_ID;

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email,
    private_key,
  },
  scopes,
});

export const sheets = google.sheets({ version: 'v4', auth });

/**
 * Verifies that the Google Sheets service is configured correctly
 * by attempting to fetch the properties of the configured sheet.
 * @returns A promise that resolves with the sheet properties if successful.
 * @throws An error if the required environment variables are not set or if the sheet is not accessible.
 */
export async function verifyGoogleSheetsConnection() {
  if (!client_email || !private_key || !sheetId) {
    throw new Error('Google Sheets API credentials and Sheet ID must be configured in environment variables.');
  }

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    console.log('Successfully connected to Google Sheet:', response.data.properties?.title);
    return response.data;
  } catch (error) {
    console.error('Failed to connect to Google Sheets:', error);
    throw new Error('Could not connect to Google Sheets. Please check your credentials and sheet permissions.');
  }
}

let sheetMetadataCache: any = null;

async function getSheetMetadata() {
    if (sheetMetadataCache) {
        return sheetMetadataCache;
    }
     if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID is not set.');
    }
    const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    sheetMetadataCache = response.data;
    return sheetMetadataCache;
}

export async function getSheetIdByName(sheetName: string): Promise<number | null> {
    const metadata = await getSheetMetadata();
    const sheet = metadata.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId ?? null;
}
