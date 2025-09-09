
-- Enable pgsodium extension
create extension if not exists "pgsodium" with schema "pgsodium";

-- Enable pg_graphql extension
create extension if not exists "pg_graphql" with schema "graphql";

-- Enable the uuid-ossp extension for generating UUIDs
create extension if not exists "uuid-ossp" with schema "extensions";

-- Create the 'banks' table
create table if not exists public.banks (
    id uuid primary key default extensions.uuid_generate_v4(),
    name character varying not null,
    created_at timestamp with time zone not null default now()
);
alter table public.banks enable row level security;

-- Create the 'categories' table
create table if not exists public.categories (
    id uuid primary key default extensions.uuid_generate_v4(),
    name character varying not null,
    type character varying not null,
    direction character varying,
    is_deletable boolean default true,
    unique(name, type)
);
alter table public.categories enable row level security;

-- Create the 'contacts' table
create table if not exists public.contacts (
    id uuid primary key default extensions.uuid_generate_v4(),
    name character varying not null,
    type character varying not null,
    created_at timestamp with time zone not null default now()
);
alter table public.contacts enable row level security;

-- Create the 'initial_stock' table
create table if not exists public.initial_stock (
    id uuid primary key default extensions.uuid_generate_v4(),
    name character varying not null,
    weight double precision not null,
    "purchasePricePerKg" double precision not null,
    created_at timestamp with time zone not null default now()
);
alter table public.initial_stock enable row level security;

-- Create the 'cash_transactions' table
create table if not exists public.cash_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    date date not null,
    type character varying not null,
    category character varying not null,
    description text,
    expected_amount double precision not null,
    actual_amount double precision not null,
    difference double precision,
    difference_reason text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "linkedStockTxId" uuid,
    "linkedLoanId" uuid,
    advance_id uuid,
    contact_id uuid references public.contacts(id) on delete set null,
    created_at timestamp with time zone not null default now()
);
alter table public.cash_transactions enable row level security;
create index if not exists cash_transactions_date_idx on public.cash_transactions(date);

-- Create the 'bank_transactions' table
create table if not exists public.bank_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    date date not null,
    type character varying not null,
    category character varying not null,
    description text,
    expected_amount double precision not null,
    actual_amount double precision not null,
    difference double precision,
    difference_reason text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    bank_id uuid references public.banks(id) on delete cascade,
    "linkedStockTxId" uuid,
    "linkedLoanId" uuid,
    advance_id uuid,
    contact_id uuid references public.contacts(id) on delete set null,
    created_at timestamp with time zone not null default now()
);
alter table public.bank_transactions enable row level security;
create index if not exists bank_transactions_date_idx on public.bank_transactions(date);


-- Create the 'stock_transactions' table
create table if not exists public.stock_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    date date not null,
    "stockItemName" character varying not null,
    type character varying not null,
    weight double precision not null,
    "pricePerKg" double precision not null,
    "paymentMethod" character varying not null,
    bank_id uuid references public.banks(id) on delete set null,
    description text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    expected_amount double precision not null,
    actual_amount double precision not null,
    difference double precision,
    difference_reason text,
    contact_id uuid references public.contacts(id) on delete set null,
    contact_name character varying(255),
    created_at timestamp with time zone not null default now()
);
alter table public.stock_transactions enable row level security;
create index if not exists stock_transactions_date_idx on public.stock_transactions(date);

-- Create the 'ap_ar_transactions' table
create table if not exists public.ap_ar_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    date date not null,
    type character varying not null,
    description text,
    amount double precision not null,
    paid_amount double precision not null default 0,
    status character varying not null,
    contact_id uuid references public.contacts(id) on delete cascade,
    contact_name character varying(255),
    "deletedAt" timestamp with time zone,
    created_at timestamp with time zone not null default now()
);
alter table public.ap_ar_transactions enable row level security;
create index if not exists ap_ar_transactions_contact_id_idx on public.ap_ar_transactions(contact_id);

-- Create the 'ledger_payments' table
create table if not exists public.ledger_payments (
    id uuid primary key default extensions.uuid_generate_v4(),
    ap_ar_transaction_id uuid references public.ap_ar_transactions(id) on delete cascade,
    amount double precision not null,
    date date not null,
    payment_method character varying,
    created_at timestamp with time zone not null default now()
);
alter table public.ledger_payments enable row level security;

-- Create the 'activity_log' table
create table if not exists public.activity_log (
    id bigint generated by default as identity primary key,
    created_at timestamp with time zone not null default now(),
    user_id uuid references auth.users(id) on delete cascade,
    username text,
    description text
);
alter table public.activity_log enable row level security;

-- Create the 'monthly_snapshots' table
create table if not exists public.monthly_snapshots (
    id uuid primary key default extensions.uuid_generate_v4(),
    snapshot_date date not null unique,
    cash_balance double precision not null,
    bank_balances jsonb not null,
    stock_items jsonb not null,
    total_receivables double precision not null,
    total_payables double precision not null,
    created_at timestamp with time zone not null default now()
);
alter table public.monthly_snapshots enable row level security;

-- Create 'loans' table
create table if not exists public.loans (
    id uuid primary key default extensions.uuid_generate_v4(),
    contact_id uuid not null references public.contacts(id) on delete cascade,
    type text not null,
    principal_amount numeric not null,
    interest_rate numeric not null default 0,
    issue_date date not null,
    due_date date,
    status text not null,
    created_at timestamptz not null default now()
);
alter table public.loans enable row level security;


-- Create 'loan_payments' table
create table if not exists public.loan_payments (
    id uuid primary key default extensions.uuid_generate_v4(),
    loan_id uuid not null references public.loans(id) on delete cascade,
    payment_date date not null,
    amount numeric not null,
    notes text,
    linked_transaction_id uuid,
    created_at timestamptz not null default now()
);
alter table public.loan_payments enable row level security;


-- RLS Policies
create policy "Enable ALL for authenticated users" on public.banks for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.categories for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.contacts for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.initial_stock for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.cash_transactions for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.bank_transactions for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.stock_transactions for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.ap_ar_transactions for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.ledger_payments for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.monthly_snapshots for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.activity_log for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.loans for all using (auth.role() = 'authenticated');
create policy "Enable ALL for authenticated users" on public.loan_payments for all using (auth.role() = 'authenticated');


-- Function to permanently delete soft-deleted records
create or replace function permanently_empty_recycle_bin()
returns void
language plpgsql
security definer
as $$
begin
    -- Permanently delete from tables with soft delete
    delete from public.cash_transactions where "deletedAt" is not null;
    delete from public.bank_transactions where "deletedAt" is not null;
    delete from public.stock_transactions where "deletedAt" is not null;
    delete from public.ap_ar_transactions where "deletedAt" is not null;
end;
$$;

grant execute on function permanently_empty_recycle_bin() to authenticated;
