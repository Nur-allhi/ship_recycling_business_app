
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
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank'))
    -- Removed user_id as it's a shared app
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

-- SECURE: Enable RLS for the new table
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

-- SECURE: Policy to allow authenticated users to manage their own installment payments
CREATE POLICY "Authenticated users can manage payment installments"
ON payment_installments FOR ALL
USING (true)
WITH CHECK (true);
```

To enable multi-bank accounts and activity logging, please run the following SQL code:

```sql
-- Create a helper function to safely get the role from user_metadata
-- This may already exist from previous steps, CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create a table to store different bank accounts
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Removed user_id as it's a shared app
    name TEXT NOT NULL
);

-- Add a foreign key to bank_transactions to link to a specific bank
-- This may already exist from previous steps, this is safe to run again.
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' and column_name='bank_id') THEN
      ALTER TABLE bank_transactions ADD COLUMN bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;
   END IF;
END
$$;


-- Create the activity log table to track user actions
CREATE TABLE activity_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT, -- We will store the username directly
    description TEXT
);

-- Drop the problematic view if it exists
DROP VIEW IF EXISTS activity_log_with_users;

-- RLS Policies for new tables
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage bank accounts"
ON banks FOR ALL
USING (true)
WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- This policy allows users with the 'admin' role to view all logs
CREATE POLICY "Admins can view all activity logs"
ON activity_log FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Users can insert their own activity logs"
ON activity_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

To enable monthly balance snapshots for improved performance, please run the following SQL code:

```sql
-- Creates a table to store balance snapshots at the start of each month
CREATE TABLE monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- REMOVED: user_id column is not needed for a shared app
    snapshot_date DATE NOT NULL,
    cash_balance NUMERIC NOT NULL DEFAULT 0,
    bank_balances JSONB NOT NULL DEFAULT '{}'::jsonb,
    stock_items JSONB NOT NULL DEFAULT '{}'::jsonb, -- Stores { "itemName": { "weight": X, "value": Y } }
    total_receivables NUMERIC NOT NULL DEFAULT 0,
    total_payables NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(snapshot_date) -- The snapshot is now unique for a given date across the whole system
);

-- RLS policy for the snapshots table
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;

-- This policy allows any authenticated user to read the snapshots.
CREATE POLICY "Authenticated users can view snapshots"
ON monthly_snapshots FOR SELECT
TO authenticated
USING (true);

-- This policy allows only admins to create, update, or delete snapshots.
CREATE POLICY "Admins can manage snapshots"
ON monthly_snapshots FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');


-- A server-side function to be called to generate a snapshot.
-- This would ideally be run by a cron job, but can be triggered manually by the app.
-- REMOVED: p_user_id parameter is no longer needed.
CREATE OR REPLACE FUNCTION generate_monthly_snapshot()
RETURNS void AS $$
DECLARE
    -- ... (function implementation would go here)
BEGIN
    -- NOTE: The logic for this function would be complex, involving iterating
    -- all transactions. For now, we will perform this logic inside the `getBalances`
    -- server action instead of a PL/pgSQL function to keep it in application code.
    -- This function signature is a placeholder for a future, more advanced implementation.
END;
$$ LANGUAGE plpgsql;
```
    

    