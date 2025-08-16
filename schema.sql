-- Full database schema for the Ha-Mim Iron Mart application.
-- Run this in your Supabase SQL Editor to set up all necessary tables and policies.

-- 1. cash_transactions table
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    date timestamp with time zone NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    category text NOT NULL,
    type text NOT NULL,
    "linkedStockTxId" uuid,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone
);
-- RLS Policy for cash_transactions
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own cash transactions" ON public.cash_transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all cash transactions" ON public.cash_transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 2. bank_transactions table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    date timestamp with time zone NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    category text NOT NULL,
    type text NOT NULL,
    "linkedStockTxId" uuid,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone
);
-- RLS Policy for bank_transactions
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bank transactions" ON public.bank_transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all bank transactions" ON public.bank_transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 3. stock_transactions table
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    date timestamp with time zone NOT NULL,
    "stockItemName" text NOT NULL,
    type text NOT NULL,
    weight numeric NOT NULL,
    "pricePerKg" numeric NOT NULL,
    "paymentMethod" text NOT NULL,
    description text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone
);
-- RLS Policy for stock_transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stock transactions" ON public.stock_transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all stock transactions" ON public.stock_transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 4. initial_stock table
CREATE TABLE IF NOT EXISTS public.initial_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    weight numeric NOT NULL,
    "purchasePricePerKg" numeric NOT NULL
);
-- RLS Policy for initial_stock
ALTER TABLE public.initial_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own initial stock" ON public.initial_stock
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all initial stock" ON public.initial_stock
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 5. categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    UNIQUE(user_id, name, type)
);
-- RLS Policy for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own categories" ON public.categories
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all categories" ON public.categories
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 6. vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    UNIQUE(user_id, name)
);
-- RLS Policy for vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own vendors" ON public.vendors
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all vendors" ON public.vendors
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 7. clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    UNIQUE(user_id, name)
);
-- RLS Policy for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own clients" ON public.clients
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all clients" ON public.clients
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 8. ap_ar_transactions table
CREATE TABLE IF NOT EXISTS public.ap_ar_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    date timestamp with time zone NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    "dueDate" timestamp with time zone,
    "paidDate" timestamp with time zone,
    "paidFrom" text,
    "deletedAt" timestamp with time zone,
    additional_info jsonb
);
-- RLS Policy for ap_ar_transactions
ALTER TABLE public.ap_ar_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own ap_ar transactions" ON public.ap_ar_transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can access all ap_ar transactions" ON public.ap_ar_transactions
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Helper table to store user roles, since it's not in Supabase Auth by default
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text
);
-- RLS Policy for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own role" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can manage all user roles" ON public.users FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Function and Trigger to sync new users from auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (new.id, new.raw_user_meta_data->>'role');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, to prevent errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
