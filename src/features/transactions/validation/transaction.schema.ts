import * as z from 'zod';

export const baseSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  amount: z.coerce.number().positive("Amount must be a positive number."),
});

export const cashSchema = baseSchema.extend({
  category: z.string({ required_error: "Category is required." }),
  description: z.string().min(1, "Description is required."),
  contact_id: z.string().optional(),
  expected_amount: z.coerce.number().optional(),
  actual_amount: z.coerce.number().optional(),
  difference_reason: z.string().optional(),
  payLater: z.boolean().optional(),
});

export const bankSchema = baseSchema.extend({
  bank_id: z.string({ required_error: "Bank account is required." }),
  category: z.string({ required_error: "Category is required." }),
  description: z.string().min(1, "Description is required."),
  contact_id: z.string().optional(),
  expected_amount: z.coerce.number().optional(),
  actual_amount: z.coerce.number().optional(),
  difference_reason: z.string().optional(),
  payLater: z.boolean().optional(),
});

export const stockSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  stockType: z.enum(['purchase', 'sale'], { required_error: "Please select purchase or sale." }),
  stockItemName: z.string({ required_error: "Item name is required." }),
  weight: z.coerce.number().positive(),
  pricePerKg: z.coerce.number().nonnegative(),
  paymentMethod: z.enum(['cash', 'bank', 'credit'], { required_error: "Payment method is required." }),
  description: z.string().optional(),
  bank_id: z.string().optional(),
  contact_id: z.string().optional(),
  newContact: z.string().optional(),
  // Discrepancy fields for stock
  expected_amount: z.coerce.number().positive(),
  actual_amount: z.coerce.number().nonnegative(),
  difference_reason: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'bank' && !data.bank_id) {
    ctx.addIssue({ code: 'custom', message: 'Bank account is required.', path: ['bank_id'] });
  }
  // A contact is now only required for credit transactions
  if (data.paymentMethod === 'credit' && !data.contact_id) {
    ctx.addIssue({ code: 'custom', message: 'A contact is required for credit transactions.', path: ['contact_id'] });
  }
  if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
  }
});

export const transferSchema = baseSchema.extend({
  transferFrom: z.enum(['cash', 'bank'], { required_error: "Please select transfer source." }),
  transferToBankId: z.string().optional(),
  transferFromBankId: z.string().optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.transferFrom === 'cash' && !data.transferToBankId) {
    ctx.addIssue({ code: 'custom', message: 'Destination bank is required.', path: ['transferToBankId'] });
  }
  if (data.transferFrom === 'bank' && !data.transferFromBankId) {
    ctx.addIssue({ code: 'custom', message: 'Source bank is required.', path: ['transferFromBankId'] });
  }
});

export const apArSchema = baseSchema.extend({
  ledgerType: z.enum(['payable', 'receivable'], { required_error: "Please select payable or receivable." }),
  contact_id: z.string({ required_error: "A contact is required." }),
  newContact: z.string().optional(),
  description: z.string().min(1, "Description is required."),
}).superRefine((data, ctx) => {
  if (data.contact_id === 'new' && (!data.newContact || data.newContact.trim().length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'New contact name is required.', path: ['newContact'] });
  }
});

export const formSchemas = {
  cash: cashSchema,
  bank: bankSchema,
  stock: stockSchema,
  transfer: transferSchema,
  ap_ar: apArSchema,
};

export type TransactionType = keyof typeof formSchemas;

// Enhanced schema creation with runtime validation
export function createTransactionSchema(transactionType: TransactionType) {
  let schema = formSchemas[transactionType];
  
  if (transactionType === 'cash' || transactionType === 'bank') {
    schema = (schema as any).superRefine((data: any, ctx: any) => {
      if (data.payLater && !data.contact_id) {
        ctx.addIssue({ 
          code: 'custom', 
          message: 'A vendor is required for pay later transactions.', 
          path: ['contact_id'] 
        });
      }
    });
  }
  
  return schema;
}