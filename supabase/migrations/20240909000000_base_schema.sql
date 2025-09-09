
-- Enable necessary extensions
create extension if not exists "pg_net" with schema "extensions";
create extension if not exists "pgsodium" with schema "pgsodium";
create extension if not exists "pg_graphql" with schema "graphql";
create extension if not exists "pg_stat_statements" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "pgjwt" with schema "extensions";
create extension if not 'exists' "supabase_vault" with schema "vault";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Create custom types
create type "public"."transaction_type" as enum ('income', 'expense');
create type "public"."bank_transaction_type" as enum ('deposit', 'withdrawal');
create type "public"."stock_transaction_type" as enum ('purchase', 'sale');
create type "public"."contact_type" as enum ('vendor', 'client', 'both');
create type "public"."ledger_status" as enum ('unpaid', 'partially paid', 'paid');
create type "public"."ledger_type" as enum ('payable', 'receivable', 'advance');
create type "public"."payment_method" as enum ('cash', 'bank', 'credit');
create type "public"."category_type" as enum ('cash', 'bank');
create type "public"."category_direction" as enum ('credit', 'debit');
create type "public"."loan_type" as enum ('payable', 'receivable');
create type "public"."loan_status" as enum ('active', 'paid', 'defaulted');


--
-- TABLES
--

-- Banks Table
CREATE TABLE IF NOT EXISTS banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read banks" ON banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage banks" ON banks FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type category_type NOT NULL,
    direction category_direction,
    is_deletable BOOLEAN DEFAULT true,
    UNIQUE(name, type)
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage categories" ON categories FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type contact_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage contacts" ON contacts FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Initial Stock Table
CREATE TABLE IF NOT EXISTS initial_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    purchasePricePerKg NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE initial_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read initial stock" ON initial_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage initial stock" ON initial_stock FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Stock Transactions Table
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    stockItemName TEXT NOT NULL,
    type stock_transaction_type NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    pricePerKg NUMERIC(10, 2) NOT NULL,
    paymentMethod payment_method NOT NULL,
    bank_id UUID REFERENCES banks(id),
    description TEXT,
    lastEdited TIMESTAMPTZ,
    deletedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expected_amount NUMERIC(12, 2) NOT NULL,
    actual_amount NUMERIC(12, 2) NOT NULL,
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    contact_id UUID REFERENCES contacts(id),
    contact_name TEXT
);
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read stock transactions" ON stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage stock transactions" ON stock_transactions FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Cash Transactions Table
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type transaction_type NOT NULL,
    expected_amount NUMERIC(12, 2) NOT NULL,
    actual_amount NUMERIC(12, 2) NOT NULL,
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    description TEXT,
    category TEXT NOT NULL,
    lastEdited TIMESTAMPTZ,
    deletedAt TIMESTAMPTZ,
    linkedStockTxId UUID REFERENCES stock_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    advance_id UUID,
    contact_id UUID REFERENCES contacts(id)
);
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read cash transactions" ON cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage cash transactions" ON cash_transactions FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Bank Transactions Table
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type bank_transaction_type NOT NULL,
    bank_id UUID REFERENCES banks(id) ON DELETE CASCADE NOT NULL,
    expected_amount NUMERIC(12, 2) NOT NULL,
    actual_amount NUMERIC(12, 2) NOT NULL,
    difference NUMERIC(12, 2),
    difference_reason TEXT,
    description TEXT,
    category TEXT NOT NULL,
    lastEdited TIMESTAMPTZ,
    deletedAt TIMESTAMPTZ,
    linkedStockTxId UUID REFERENCES stock_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    advance_id UUID,
    contact_id UUID REFERENCES contacts(id)
);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read bank transactions" ON bank_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage bank transactions" ON bank_transactions FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- AP/AR Transactions Table
CREATE TABLE IF NOT EXISTS ap_ar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    type ledger_type NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    status ledger_status NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    contact_name TEXT,
    deletedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE ap_ar_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read ap_ar transactions" ON ap_ar_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage ap_ar transactions" ON ap_ar_transactions FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Ledger Payments Table
CREATE TABLE IF NOT EXISTS ledger_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_ar_transaction_id UUID REFERENCES ap_ar_transactions(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method payment_method NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE ledger_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read ledger payments" ON ledger_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage ledger payments" ON ledger_payments FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
    type loan_type NOT NULL,
    principal_amount NUMERIC(12, 2) NOT NULL,
    interest_rate NUMERIC(5, 2) DEFAULT 0,
    issue_date DATE NOT NULL,
    due_date DATE,
    status loan_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read loans" ON loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage loans" ON loans FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Loan Payments Table
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    linked_transaction_id UUID, -- Can be linked to cash_transactions or bank_transactions
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read loan payments" ON loan_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage loan payments" ON loan_payments FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Add linkedLoanId to cash and bank transactions
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS linkedLoanId UUID REFERENCES loans(id) ON DELETE SET NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS linkedLoanId UUID REFERENCES loans(id) ON DELETE SET NULL;


-- Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    username TEXT,
    description TEXT
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admin users to manage activity log" ON activity_log FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Users Table (for storing roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'user'))
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to see their own role" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow admins to manage roles" ON users FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Function to create a user profile upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if any admin user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin') THEN
    user_role := 'admin';
  ELSE
    user_role := 'user';
  END IF;

  -- Insert into public.users
  INSERT INTO public.users (id, role)
  VALUES (new.id, user_role);

  -- Set user metadata in auth.users
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', user_role)
  WHERE id = new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger to call the function on new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Monthly Snapshots Table
CREATE TABLE IF NOT EXISTS monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE,
    cash_balance NUMERIC(15, 2) NOT NULL,
    bank_balances JSONB NOT NULL,
    stock_items JSONB NOT NULL,
    total_receivables NUMERIC(15, 2) NOT NULL,
    total_payables NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read snapshots" ON monthly_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin users to manage snapshots" ON monthly_snapshots FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));


-- Function to permanently delete records from recycle bin
CREATE OR REPLACE FUNCTION permanently_empty_recycle_bin()
RETURNS void AS $$
BEGIN
    DELETE FROM cash_transactions WHERE deletedAt IS NOT NULL;
    DELETE FROM bank_transactions WHERE deletedAt IS NOT NULL;
    DELETE FROM stock_transactions WHERE deletedAt IS NOT NULL;
    DELETE FROM ap_ar_transactions WHERE deletedAt IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
