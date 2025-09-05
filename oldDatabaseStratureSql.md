
# Current Database Schema (Version 1.0)

This file documents the complete SQL structure of the application's database before the planned refactoring.

```sql
-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main Transaction Tables
CREATE TABLE cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    description TEXT,
    expected_amount NUMERIC NOT NULL,
    actual_amount NUMERIC NOT NULL,
    difference NUMERIC NOT NULL DEFAULT 0,
    difference_reason TEXT,
    contact_id UUID,
    advance_id UUID,
    linkedStockTxId UUID,
    "deletedAt" TIMESTAMPTZ,
    "lastEdited" TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    category TEXT NOT NULL,
    description TEXT,
    bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
    expected_amount NUMERIC NOT NULL,
    actual_amount NUMERIC NOT NULL,
    difference NUMERIC NOT NULL DEFAULT 0,
    difference_reason TEXT,
    contact_id UUID,
    advance_id UUID,
    linkedStockTxId UUID,
    "deletedAt" TIMESTAMPTZ,
    "lastEdited" TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    "stockItemName" TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'sale')),
    weight NUMERIC NOT NULL,
    "pricePerKg" NUMERIC NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    bank_id UUID,
    description TEXT,
    contact_id UUID,
    contact_name TEXT,
    expected_amount NUMERIC NOT NULL,
    actual_amount NUMERIC NOT NULL,
    difference NUMERIC NOT NULL DEFAULT 0,
    difference_reason TEXT,
    "deletedAt" TIMESTAMPTZ,
    "lastEdited" TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ap_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('payable', 'receivable', 'advance')),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('unpaid', 'partially paid', 'paid')),
    contact_id UUID NOT NULL,
    contact_name TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ap_ar_transaction_id UUID NOT NULL REFERENCES ap_ar_transactions(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank'))
);

-- Supporting Tables
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    direction TEXT,
    is_deletable BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE initial_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    weight NUMERIC NOT NULL,
    "purchasePricePerKg" NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Tables
CREATE TABLE activity_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT,
    description TEXT
);

CREATE TABLE monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE,
    cash_balance NUMERIC NOT NULL DEFAULT 0,
    bank_balances JSONB NOT NULL DEFAULT '{}'::jsonb,
    stock_items JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_receivables NUMERIC NOT NULL DEFAULT 0,
    total_payables NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_ar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE initial_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON cash_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON bank_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON ap_ar_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON payment_installments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON banks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON initial_stock FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs" ON activity_log FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Users can insert their own activity logs" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view snapshots" ON monthly_snapshots FOR SELECT USING (true);
CREATE POLICY "Admins can manage snapshots" ON monthly_snapshots FOR ALL USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Stored Procedure for Recycle Bin
CREATE OR REPLACE FUNCTION permanently_empty_recycle_bin()
RETURNS void AS $$
BEGIN
    DELETE FROM cash_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM bank_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM stock_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM ap_ar_transactions WHERE "deletedAt" IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

```
