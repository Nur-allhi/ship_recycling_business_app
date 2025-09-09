-- Initial migration to set up the database schema for the ledger app

-- Enable necessary extensions
create extension if not exists "uuid-ossp" with schema "extensions";
create extension if not exists "pg_graphql" with schema "graphql";
create extension if not exists "moddatetime" with schema "extensions";
create extension if not exists "pgsodium" with schema "pgsodium";

-- Grant usage on the extensions schema to the authenticated role
grant usage on schema extensions to authenticated;

-- Grant usage on the graphql schema to anon and authenticated roles
grant usage on schema graphql to anon, authenticated;
grant all on all tables in schema graphql to anon, authenticated;
grant all on all functions in schema graphql to anon, authenticated;
grant all on all sequences in schema graphql to anon, authenticated;

-- Grant usage on the public schema to anon and authenticated roles
grant usage on schema public to anon, authenticated;

-- Function to set the last updated time
create function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Set up Row Level Security (RLS)
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- All users can read all public tables
alter default privileges in schema public grant select on tables to authenticated;
-- Admins can do anything
alter default privileges for role postgres in schema public grant all on tables to authenticated;

-- Banks Table
create table public.banks (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banks enable row level security;
create policy "Users can view all banks" on public.banks for select using (true);
create policy "Admins can manage banks" on public.banks for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.banks
  for each row execute procedure public.handle_updated_at();

-- Categories Table
create table public.categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  type text not null, -- 'cash' or 'bank'
  direction text, -- 'credit', 'debit', or null for transfers
  is_deletable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, type)
);
alter table public.categories enable row level security;
create policy "Users can view all categories" on public.categories for select using (true);
create policy "Admins can manage categories" on public.categories for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.categories
  for each row execute procedure public.handle_updated_at();

-- Contacts Table
create table public.contacts (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  type text not null, -- 'vendor', 'client', or 'both'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contacts enable row level security;
create policy "Users can view all contacts" on public.contacts for select using (true);
create policy "Admins can manage contacts" on public.contacts for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.contacts
  for each row execute procedure public.handle_updated_at();

-- Initial Stock Table
create table public.initial_stock (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  weight numeric not null,
  "purchasePricePerKg" numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.initial_stock enable row level security;
create policy "Users can view all initial stock" on public.initial_stock for select using (true);
create policy "Admins can manage initial stock" on public.initial_stock for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.initial_stock
  for each row execute procedure public.handle_updated_at();

-- Cash Transactions Table
create table public.cash_transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  date date not null,
  type text not null, -- 'income' or 'expense'
  expected_amount numeric not null,
  actual_amount numeric not null,
  difference numeric,
  difference_reason text,
  description text not null,
  category text not null,
  "linkedStockTxId" uuid references public.stock_transactions(id) on delete set null,
  "linkedLoanId" uuid references public.loans(id) on delete set null,
  "lastEdited" timestamptz,
  "deletedAt" timestamptz,
  advance_id uuid references public.ap_ar_transactions(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cash_transactions enable row level security;
create policy "Users can view their own transactions" on public.cash_transactions for select using (true);
create policy "Admins can manage all transactions" on public.cash_transactions for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.cash_transactions
  for each row execute procedure public.handle_updated_at();

-- Bank Transactions Table
create table public.bank_transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  date date not null,
  bank_id uuid references public.banks(id) on delete cascade,
  type text not null, -- 'deposit' or 'withdrawal'
  expected_amount numeric not null,
  actual_amount numeric not null,
  difference numeric,
  difference_reason text,
  description text not null,
  category text not null,
  "linkedStockTxId" uuid references public.stock_transactions(id) on delete set null,
  "linkedLoanId" uuid references public.loans(id) on delete set null,
  "lastEdited" timestamptz,
  "deletedAt" timestamptz,
  advance_id uuid references public.ap_ar_transactions(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bank_transactions enable row level security;
create policy "Users can view their own transactions" on public.bank_transactions for select using (true);
create policy "Admins can manage all transactions" on public.bank_transactions for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.bank_transactions
  for each row execute procedure public.handle_updated_at();

-- Stock Transactions Table
create table public.stock_transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  date date not null,
  "stockItemName" text not null,
  type text not null, -- 'purchase' or 'sale'
  weight numeric not null,
  "pricePerKg" numeric not null,
  "paymentMethod" text not null,
  bank_id uuid references public.banks(id),
  contact_id uuid references public.contacts(id),
  description text,
  "lastEdited" timestamptz,
  "deletedAt" timestamptz,
  expected_amount numeric not null,
  actual_amount numeric not null,
  difference numeric,
  difference_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stock_transactions enable row level security;
create policy "Users can view their own transactions" on public.stock_transactions for select using (true);
create policy "Admins can manage all transactions" on public.stock_transactions for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.stock_transactions
  for each row execute procedure public.handle_updated_at();

-- Accounts Payable/Receivable Transactions Table
create table public.ap_ar_transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  date date not null,
  type text not null, -- 'payable', 'receivable', or 'advance'
  description text not null,
  amount numeric not null,
  paid_amount numeric not null default 0,
  status text not null, -- 'unpaid', 'partially paid', 'paid'
  contact_id uuid not null references public.contacts(id) on delete cascade,
  contact_name text,
  "deletedAt" timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ap_ar_transactions enable row level security;
create policy "Users can view all ap_ar_transactions" on public.ap_ar_transactions for select using (true);
create policy "Admins can manage ap_ar_transactions" on public.ap_ar_transactions for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.ap_ar_transactions
  for each row execute procedure public.handle_updated_at();

-- Ledger Payments Table
create table public.ledger_payments (
    id uuid primary key default extensions.uuid_generate_v4(),
    ap_ar_transaction_id uuid not null references public.ap_ar_transactions(id) on delete cascade,
    amount numeric not null,
    date date not null,
    payment_method text not null, -- 'cash' or 'bank'
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.ledger_payments enable row level security;
create policy "Users can view ledger payments" on public.ledger_payments for select using (true);
create policy "Admins can manage ledger payments" on public.ledger_payments for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.ledger_payments
  for each row execute procedure public.handle_updated_at();


-- Activity Log Table
create table public.activity_log (
  id bigserial primary key,
  created_at timestamptz default now() not null,
  user_id uuid references auth.users(id),
  username text,
  description text not null
);
alter table public.activity_log enable row level security;
create policy "Admins can view all activity logs" on public.activity_log for select using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create policy "Admins can manage activity logs" on public.activity_log for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');

-- Monthly Snapshots Table
create table public.monthly_snapshots (
  id uuid primary key default extensions.uuid_generate_v4(),
  snapshot_date date not null unique,
  cash_balance numeric not null,
  bank_balances jsonb not null,
  stock_items jsonb not null,
  total_receivables numeric not null,
  total_payables numeric not null,
  created_at timestamptz default now() not null
);
alter table public.monthly_snapshots enable row level security;
create policy "Users can view snapshots" on public.monthly_snapshots for select using (true);
create policy "Admins can manage snapshots" on public.monthly_snapshots for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');


-- Loans Table
create table public.loans (
  id uuid primary key default extensions.uuid_generate_v4(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  type text not null, -- 'payable' (we borrowed) or 'receivable' (we lent)
  principal_amount numeric not null,
  interest_rate numeric not null default 0,
  issue_date date not null,
  due_date date,
  status text not null, -- 'active', 'paid', 'defaulted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loans enable row level security;
create policy "Users can view loans" on public.loans for select using (true);
create policy "Admins can manage loans" on public.loans for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.loans
  for each row execute procedure public.handle_updated_at();

-- Loan Payments Table
create table public.loan_payments (
    id uuid primary key default extensions.uuid_generate_v4(),
    loan_id uuid not null references public.loans(id) on delete cascade,
    payment_date date not null,
    amount numeric not null,
    linked_transaction_id uuid, -- Can be linked to a cash or bank transaction
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.loan_payments enable row level security;
create policy "Users can view loan payments" on public.loan_payments for select using (true);
create policy "Admins can manage loan payments" on public.loan_payments for all using (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin') with check (auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin');
create trigger on_updated_at before update on public.loan_payments
  for each row execute procedure public.handle_updated_at();
  
-- Function to permanently delete soft-deleted records
create or replace function permanently_empty_recycle_bin()
returns void as $$
begin
  delete from public.cash_transactions where "deletedAt" is not null;
  delete from public.bank_transactions where "deletedAt" is not null;
  delete from public.stock_transactions where "deletedAt" is not null;
  delete from public.ap_ar_transactions where "deletedAt" is not null;
end;
$$ language plpgsql security definer;
