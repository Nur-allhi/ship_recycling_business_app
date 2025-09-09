
-- Enable pgsodium extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";


-- Create the 'banks' table
CREATE TABLE IF NOT EXISTS public.banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'contacts' table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'vendor', 'client', or 'both'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'categories' table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'cash' or 'bank'
    direction VARCHAR(50), -- 'credit' or 'debit'
    is_deletable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_category_name_type ON public.categories(name, type);


-- Create the 'initial_stock' table
CREATE TABLE IF NOT EXISTS public.initial_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    "purchasePricePerKg" NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'stock_transactions' table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    "stockItemName" VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'purchase' or 'sale'
    weight NUMERIC(10, 2) NOT NULL,
    "pricePerKg" NUMERIC(10, 2) NOT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL, -- 'cash', 'bank', 'credit'
    bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
    description TEXT,
    "lastEdited" TIMESTAMPTZ,
    "deletedAt" TIMESTAMPTZ,
    expected_amount NUMERIC(12, 2),
    actual_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'cash_transactions' table
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'income' or 'expense'
    description TEXT,
    expected_amount NUMERIC(12, 2),
    actual_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    category VARCHAR(255),
    "linkedStockTxId" UUID REFERENCES public.stock_transactions(id) ON DELETE SET NULL,
    "lastEdited" TIMESTAMPTZ,
    "deletedAt" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    advance_id UUID
);

-- Create the 'bank_transactions' table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'deposit' or 'withdrawal'
    bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
    description TEXT,
    expected_amount NUMERIC(12, 2),
    actual_amount NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    category VARCHAR(255),
    "linkedStockTxId" UUID REFERENCES public.stock_transactions(id) ON DELETE SET NULL,
    "lastEdited" TIMESTAMPTZ,
    "deletedAt" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    advance_id UUID
);

-- Create the 'ap_ar_transactions' table (Accounts Payable/Receivable)
CREATE TABLE IF NOT EXISTS public.ap_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'payable' or 'receivable' or 'advance'
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL, -- 'unpaid', 'partially paid', 'paid'
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    contact_name VARCHAR(255),
    "deletedAt" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'ledger_payments' table for tracking installments
CREATE TABLE IF NOT EXISTS public.ledger_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_ar_transaction_id UUID NOT NULL REFERENCES public.ap_ar_transactions(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'bank'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the 'activity_log' table
CREATE TABLE IF NOT EXISTS public.activity_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    username TEXT,
    description TEXT NOT NULL
);

-- Create the 'monthly_snapshots' table
CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE,
    cash_balance NUMERIC(15, 2),
    bank_balances JSONB,
    stock_items JSONB,
    total_receivables NUMERIC(15, 2),
    total_payables NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    principal_amount NUMERIC(12, 2) NOT NULL,
    interest_rate NUMERIC(5, 2) DEFAULT 0,
    issue_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    linked_transaction_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Add linkedLoanId to cash and bank transactions after loans table is created
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS "linkedLoanId" UUID REFERENCES public.loans(id) ON DELETE SET NULL;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS "linkedLoanId" UUID REFERENCES public.loans(id) ON DELETE SET NULL;


-- RLS Policies
-- Enable RLS for all tables
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initial_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_ar_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (assuming 'user' role is the default authenticated role)
-- Replace 'authenticated' with your specific role if different.
CREATE POLICY "Allow all access to authenticated users" ON public.banks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.cash_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.bank_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.stock_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.initial_stock FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.ap_ar_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.ledger_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.activity_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.monthly_snapshots FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.loans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users" ON public.loan_payments FOR ALL USING (auth.role() = 'authenticated');


CREATE OR REPLACE FUNCTION permanently_empty_recycle_bin()
RETURNS void AS $$
BEGIN
    DELETE FROM public.cash_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM public.bank_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM public.stock_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM public.ap_ar_transactions WHERE "deletedAt" IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to get the role of the current user from custom claims
create or replace function get_my_role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', 'user')::text;
$$;

-- Grant execute on the function to authenticated users
grant execute on function get_my_role() to authenticated;


-- Admin access policies (Can do anything)
CREATE POLICY "Allow admins full access" ON public.banks FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.cash_transactions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.bank_transactions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.stock_transactions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.initial_stock FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.categories FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.contacts FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.ap_ar_transactions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.ledger_payments FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.activity_log FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.monthly_snapshots FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.loans FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Allow admins full access" ON public.loan_payments FOR ALL USING (get_my_role() = 'admin');
