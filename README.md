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

-- SECURE: Enable RLS for the new table
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

-- SECURE: Policy to allow users to manage their own installment payments
CREATE POLICY "Users can manage their own payment installments"
ON payment_installments FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

To enable multi-bank accounts and activity logging, please run the following SQL code:

```sql
-- Create a helper function to safely get the role from user_metadata
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
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL
);

-- Add a foreign key to bank_transactions to link to a specific bank
ALTER TABLE bank_transactions
ADD COLUMN bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;

-- Create the activity log table to track user actions
CREATE TABLE activity_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT
);

-- Create a view to easily query activity logs with usernames
-- SECURE: This view is now defined with SECURITY_INVOKER to respect RLS policies
CREATE OR REPLACE VIEW activity_log_with_users WITH (security_invoker = true) AS
SELECT
    al.id,
    al.created_at,
    al.user_id,
    u.email AS username,
    al.description
FROM
    activity_log al
LEFT JOIN
    auth.users u ON al.user_id = u.id;

-- RLS Policies for new tables
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bank accounts"
ON banks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
