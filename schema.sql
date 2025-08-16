
-- Add a 'deletedAt' column to the ap_ar_transactions table to enable soft-deletes.
-- This allows items to be moved to the recycle bin instead of being permanently deleted.
ALTER TABLE ap_ar_transactions
ADD COLUMN "deletedAt" TIMESTAMPTZ;
