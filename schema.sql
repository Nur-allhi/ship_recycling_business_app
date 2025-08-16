
-- This file contains the recommended SQL schema for the ShipShape Ledger application.
-- Running these commands in your Supabase SQL Editor will set up the necessary tables and policies.

-- Enable the uuid-ossp extension if not already enabled, for generating UUIDs.
create extension if not exists "uuid-ossp" with schema "extensions";

-- ####################################################################
-- TABLES
-- ####################################################################

-- Table for cash transactions
create table if not exists cash_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    date timestamptz not null,
    type text not null,
    amount numeric(15, 2) not null,
    description text not null,
    category text,
    linkedStockTxId uuid,
    lastEdited timestamptz,
    deletedAt timestamptz,
    createdAt timestamptz default now()
);

-- Table for bank transactions
create table if not exists bank_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    date timestamptz not null,
    type text not null,
    amount numeric(15, 2) not null,
    description text not null,
    category text,
    linkedStockTxId uuid,
    lastEdited timestamptz,
    deletedAt timestamptz,
    createdAt timestamptz default now()
);

-- Table for vendors (suppliers)
create table if not exists vendors (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    createdAt timestamptz default now()
);

-- Table for clients (customers)
create table if not exists clients (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    createdAt timestamptz default now()
);

-- Table for Accounts Payable (A/P) and Accounts Receivable (A/R)
create table if not exists ap_ar_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    contact_id uuid not null, -- This will reference either vendors(id) or clients(id)
    date timestamptz not null,
    type text not null, -- 'payable' or 'receivable'
    description text not null,
    amount numeric(15, 2) not null,
    status text default 'unpaid',
    dueDate timestamptz,
    paidDate timestamptz,
    paidFrom text,
    linkedStockTxId uuid,
    deletedAt timestamptz,
    createdAt timestamptz default now()
);

-- Table for stock transactions (purchases and sales)
create table if not exists stock_transactions (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    date timestamptz not null,
    stockItemName text not null,
    type text not null, -- 'purchase' or 'sale'
    weight numeric(15, 3) not null,
    pricePerKg numeric(15, 2) not null,
    paymentMethod text not null,
    description text,
    lastEdited timestamptz,
    deletedAt timestamptz,
    createdAt timestamptz default now()
);

-- Table for initial stock balance
create table if not exists initial_stock (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    weight numeric(15, 3) not null,
    purchasePricePerKg numeric(15, 2) not null,
    createdAt timestamptz default now()
);

-- Table for custom categories
create table if not exists categories (
    id uuid primary key default extensions.uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    type text not null, -- 'cash' or 'bank'
    createdAt timestamptz default now()
);

-- ####################################################################
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ####################################################################

-- Generic function to get user role from metadata
create or replace function get_user_role()
returns text as $$
  select auth.jwt()->>'role';
$$ language sql stable;


-- Policies for all tables

-- cash_transactions
alter table cash_transactions enable row level security;
drop policy if exists "Users can see all data, admins can do all" on cash_transactions;
create policy "Users can see all data, admins can do all" on cash_transactions
  for all using (true) with check (get_user_role() = 'admin');

-- bank_transactions
alter table bank_transactions enable row level security;
drop policy if exists "Users can see all data, admins can do all" on bank_transactions;
create policy "Users can see all data, admins can do all" on bank_transactions
  for all using (true) with check (get_user_role() = 'admin');
  
-- vendors
alter table vendors enable row level security;
drop policy if exists "Users can see all data, admins can do all" on vendors;
create policy "Users can see all data, admins can do all" on vendors
  for all using (true) with check (get_user_role() = 'admin');

-- clients
alter table clients enable row level security;
drop policy if exists "Users can see all data, admins can do all" on clients;
create policy "Users can see all data, admins can do all" on clients
  for all using (true) with check (get_user_role() = 'admin');

-- ap_ar_transactions
alter table ap_ar_transactions enable row level security;
drop policy if exists "Users can see all data, admins can do all" on ap_ar_transactions;
create policy "Users can see all data, admins can do all" on ap_ar_transactions
  for all using (true) with check (get_user_role() = 'admin');
  
-- stock_transactions
alter table stock_transactions enable row level security;
drop policy if exists "Users can see all data, admins can do all" on stock_transactions;
create policy "Users can see all data, admins can do all" on stock_transactions
  for all using (true) with check (get_user_role() = 'admin');

-- initial_stock
alter table initial_stock enable row level security;
drop policy if exists "Users can see all data, admins can do all" on initial_stock;
create policy "Users can see all data, admins can do all" on initial_stock
  for all using (true) with check (get_user_role() = 'admin');

-- categories
alter table categories enable row level security;
drop policy if exists "Users can see all data, admins can do all" on categories;
create policy "Users can see all data, admins can do all" on categories
  for all using (true) with check (get_user_role() = 'admin');
