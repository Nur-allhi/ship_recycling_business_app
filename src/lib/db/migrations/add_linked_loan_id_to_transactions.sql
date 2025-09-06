-- This script adds a column to link financial transactions directly to a loan.
-- This is necessary to track the disbursement of a loan.

ALTER TABLE cash_transactions
ADD COLUMN IF NOT EXISTS "linkedLoanId" UUID REFERENCES loans(id) ON DELETE SET NULL;

ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS "linkedLoanId" UUID REFERENCES loans(id) ON DELETE SET NULL;
