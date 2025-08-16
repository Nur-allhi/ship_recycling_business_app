# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Database Setup

To properly set up your Supabase database for this application, please run the commands found in `schema.sql` in your Supabase SQL Editor. This will create all the necessary tables and security policies for all features to work correctly.

To enable installment payments, please run the following SQL code:

```sql
-- Create a new table to store each installment payment
CREATE TABLE payment_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ap_ar_transaction_id UUID NOT NULL REFERENCES ap_ar_transactions(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank')),
    user_id UUID REFERENCES auth.users(id)
);

-- Add a column to ap_ar_transactions to track the amount paid
ALTER TABLE ap_ar_transactions
ADD COLUMN paid_amount NUMERIC NOT NULL DEFAULT 0;

-- Drop the old status constraint if it exists (using a safer method)
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ap_ar_transactions_status_check' AND conrelid = 'ap_ar_transactions'::regclass) THEN
      ALTER TABLE ap_ar_transactions DROP CONSTRAINT ap_ar_transactions_status_check;
   END IF;
END
$$;

-- Add the new status constraint that includes 'partially paid'
ALTER TABLE ap_ar_transactions
ADD CONSTRAINT ap_ar_transactions_status_check
CHECK (status IN ('unpaid', 'partially paid', 'paid'));
```
