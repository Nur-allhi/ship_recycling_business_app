// Flows will be imported for their side effects in this file.
import './flows/sheet-reader-flow';
import { verifyGoogleSheetsConnection } from '@/services/google-sheets';

verifyGoogleSheetsConnection();
