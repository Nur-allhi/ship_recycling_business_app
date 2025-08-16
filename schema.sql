--
-- Vendors Table: Stores information about businesses you purchase from.
--
CREATE TABLE
  public.vendors (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    user_id uuid NULL,
    CONSTRAINT vendors_pkey PRIMARY KEY (id),
    CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
  ) TABLESPACE pg_default;

-- Enable Row Level Security (RLS) for the vendors table.
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own vendors.
CREATE POLICY "Users can view their own vendors" ON public.vendors FOR
SELECT
  USING (auth.uid () = user_id);

-- Policy: Users can insert vendors for themselves.
CREATE POLICY "Users can insert their own vendors" ON public.vendors FOR INSERT
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can update their own vendors.
CREATE POLICY "Users can update their own vendors" ON public.vendors FOR
UPDATE USING (auth.uid () = user_id)
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can delete their own vendors.
CREATE POLICY "Users can delete their own vendors" ON public.vendors FOR
DELETE
  USING (auth.uid () = user_id);

--
-- Clients Table: Stores information about businesses you sell to.
--
CREATE TABLE
  public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    user_id uuid NULL,
    CONSTRAINT clients_pkey PRIMARY KEY (id),
    CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
  ) TABLESPACE pg_default;

-- Enable Row Level Security (RLS) for the clients table.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own clients.
CREATE POLICY "Users can view their own clients" ON public.clients FOR
SELECT
  USING (auth.uid () = user_id);

-- Policy: Users can insert clients for themselves.
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can update their own clients.
CREATE POLICY "Users can update their own clients" ON public.clients FOR
UPDATE USING (auth.uid () = user_id)
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can delete their own clients.
CREATE POLICY "Users can delete their own clients" ON public.clients FOR
DELETE
  USING (auth.uid () = user_id);


--
-- AP/AR Transactions Table: Tracks credit-based transactions (Payables and Receivables).
--
CREATE TABLE
  public.ap_ar_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    date timestamp with time zone NOT NULL,
    type text NOT NULL, -- 'payable' or 'receivable'
    contact_id uuid NOT NULL,
    contact_name text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL DEFAULT 'unpaid'::text, -- 'unpaid' or 'paid'
    due_date date NULL,
    paid_date timestamp with time zone NULL,
    paid_from text NULL, -- 'cash' or 'bank'
    deleted_at timestamp with time zone NULL,
    user_id uuid NULL,
    linked_stock_tx_id uuid NULL,
    CONSTRAINT ap_ar_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT ap_ar_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT ap_ar_transactions_linked_stock_tx_id_fkey FOREIGN KEY (linked_stock_tx_id) REFERENCES stock_transactions (id) ON DELETE SET NULL
  ) TABLESPACE pg_default;

-- Enable Row Level Security (RLS) for the ap_ar_transactions table.
ALTER TABLE public.ap_ar_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own transactions.
CREATE POLICY "Users can view their own ap_ar_transactions" ON public.ap_ar_transactions FOR
SELECT
  USING (auth.uid () = user_id);

-- Policy: Users can insert transactions for themselves.
CREATE POLICY "Users can insert their own ap_ar_transactions" ON public.ap_ar_transactions FOR INSERT
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can update their own transactions.
CREATE POLICY "Users can update their own ap_ar_transactions" ON public.ap_ar_transactions FOR
UPDATE USING (auth.uid () = user_id)
WITH
  CHECK (auth.uid () = user_id);

-- Policy: Users can delete their own transactions (soft delete).
-- Note: This policy assumes soft-deletion is handled by updating a 'deleted_at' column.
-- For hard deletes, the policy would be simpler.
CREATE POLICY "Users can delete their own ap_ar_transactions" ON public.ap_ar_transactions FOR
DELETE
  USING (auth.uid () = user_id);
