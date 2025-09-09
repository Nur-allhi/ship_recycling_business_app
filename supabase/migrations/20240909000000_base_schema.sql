
-- Enable the required extensions
create extension if not exists "pg_net" with schema "extensions";
create extension if not exists "pgsodium" with schema "pgsodium";
create extension if not exists "pg_graphql" with schema "graphql";
create extension if not exists "pg_stat_statements" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "pgjwt" with schema "extensions";
create extension if not exists "supabase_vault" with schema "vault";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Create custom types
create type "public"."transaction_type" as enum ('income', 'expense');
create type "public"."bank_transaction_type" as enum ('deposit', 'withdrawal');
create type "public"."stock_transaction_type" as enum ('purchase', 'sale');
create type "public"."contact_type" as enum ('vendor', 'client', 'both');
create type "public"."ledger_type" as enum ('payable', 'receivable', 'advance');
create type "public"."ledger_status" as enum ('unpaid', 'partially paid', 'paid');
create type "public"."payment_method" as enum ('cash', 'bank', 'credit');
create type "public"."loan_type" as enum ('payable', 'receivable');
create type "public"."loan_status" as enum ('active', 'paid', 'defaulted');
create type "public"."category_type" as enum ('cash', 'bank');
create type "public"."category_direction" as enum ('credit', 'debit');


-- Create tables
create table "public"."banks" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone not null default now(),
    "name" text not null
);
alter table "public"."banks" enable row level security;
CREATE UNIQUE INDEX banks_pkey ON public.banks USING btree (id);
alter table "public"."banks" add constraint "banks_pkey" PRIMARY KEY using index "banks_pkey";

create table "public"."categories" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "type" category_type not null,
    "direction" category_direction,
    "is_deletable" boolean default true
);
alter table "public"."categories" enable row level security;
CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);
alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";

create table "public"."contacts" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "type" contact_type not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."contacts" enable row level security;
CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id);
alter table "public"."contacts" add constraint "contacts_pkey" PRIMARY KEY using index "contacts_pkey";


create table "public"."loans" (
    "id" uuid not null default uuid_generate_v4(),
    "contact_id" uuid not null references public.contacts(id),
    "type" loan_type not null,
    "principal_amount" numeric not null,
    "interest_rate" numeric not null default 0,
    "issue_date" date not null,
    "due_date" date,
    "status" loan_status not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."loans" enable row level security;
CREATE UNIQUE INDEX loans_pkey ON public.loans USING btree (id);
alter table "public"."loans" add constraint "loans_pkey" PRIMARY KEY using index "loans_pkey";


create table "public"."cash_transactions" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone not null default now(),
    "date" date not null,
    "type" transaction_type not null,
    "category" text not null,
    "description" text,
    "expected_amount" numeric,
    "actual_amount" numeric not null,
    "difference" numeric,
    "difference_reason" text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "linkedStockTxId" uuid,
    "linkedLoanId" uuid references public.loans(id),
    "contact_id" uuid references public.contacts(id),
    "advance_id" uuid
);
alter table "public"."cash_transactions" enable row level security;
CREATE UNIQUE INDEX cash_transactions_pkey ON public.cash_transactions USING btree (id);
alter table "public"."cash_transactions" add constraint "cash_transactions_pkey" PRIMARY KEY using index "cash_transactions_pkey";


create table "public"."bank_transactions" (
    "id" uuid not null default uuid_generate_v4(),
    "created_at" timestamp with time zone not null default now(),
    "date" date not null,
    "type" bank_transaction_type not null,
    "category" text not null,
    "description" text,
    "expected_amount" numeric,
    "actual_amount" numeric not null,
    "difference" numeric,
    "difference_reason" text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "bank_id" uuid references public.banks(id),
    "linkedStockTxId" uuid,
    "linkedLoanId" uuid references public.loans(id),
    "contact_id" uuid references public.contacts(id),
    "advance_id" uuid
);
alter table "public"."bank_transactions" enable row level security;
CREATE UNIQUE INDEX bank_transactions_pkey ON public.bank_transactions USING btree (id);
alter table "public"."bank_transactions" add constraint "bank_transactions_pkey" PRIMARY KEY using index "bank_transactions_pkey";

create table "public"."stock_transactions" (
    "id" uuid not null default uuid_generate_v4(),
    "date" date not null,
    "stockItemName" text not null,
    "type" stock_transaction_type not null,
    "weight" numeric not null,
    "pricePerKg" numeric not null,
    "paymentMethod" payment_method not null,
    "bank_id" uuid references public.banks(id),
    "description" text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "expected_amount" numeric not null,
    "actual_amount" numeric not null,
    "difference" numeric,
    "difference_reason" text,
    "contact_id" uuid references public.contacts(id),
    "contact_name" text
);
alter table "public"."stock_transactions" enable row level security;
CREATE UNIQUE INDEX stock_transactions_pkey ON public.stock_transactions USING btree (id);
alter table "public"."stock_transactions" add constraint "stock_transactions_pkey" PRIMARY KEY using index "stock_transactions_pkey";
alter table "public"."cash_transactions" add constraint "cash_transactions_linkedStockTxId_fkey" FOREIGN KEY ("linkedStockTxId") REFERENCES "public"."stock_transactions"(id) on delete set null;
alter table "public"."bank_transactions" add constraint "bank_transactions_linkedStockTxId_fkey" FOREIGN KEY ("linkedStockTxId") REFERENCES "public"."stock_transactions"(id) on delete set null;


create table "public"."ap_ar_transactions" (
    "id" uuid not null default uuid_generate_v4(),
    "date" date not null,
    "type" ledger_type not null,
    "description" text not null,
    "amount" numeric not null,
    "paid_amount" numeric not null default 0,
    "status" ledger_status not null,
    "contact_id" uuid not null references public.contacts(id),
    "contact_name" text,
    "deletedAt" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."ap_ar_transactions" enable row level security;
CREATE UNIQUE INDEX ap_ar_transactions_pkey ON public.ap_ar_transactions USING btree (id);
alter table "public"."ap_ar_transactions" add constraint "ap_ar_transactions_pkey" PRIMARY KEY using index "ap_ar_transactions_pkey";
alter table "public"."cash_transactions" add constraint "cash_transactions_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "public"."ap_ar_transactions"(id) on delete set null;
alter table "public"."bank_transactions" add constraint "bank_transactions_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "public"."ap_ar_transactions"(id) on delete set null;


create table "public"."ledger_payments" (
    "id" uuid not null default uuid_generate_v4(),
    "ap_ar_transaction_id" uuid not null references public.ap_ar_transactions(id) on delete cascade,
    "amount" numeric not null,
    "date" date not null,
    "payment_method" payment_method not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."ledger_payments" enable row level security;
CREATE UNIQUE INDEX ledger_payments_pkey ON public.ledger_payments USING btree (id);
alter table "public"."ledger_payments" add constraint "ledger_payments_pkey" PRIMARY KEY using index "ledger_payments_pkey";


create table "public"."initial_stock" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "weight" numeric not null,
    "purchasePricePerKg" numeric not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."initial_stock" enable row level security;
CREATE UNIQUE INDEX initial_stock_pkey ON public.initial_stock USING btree (id);
alter table "public"."initial_stock" add constraint "initial_stock_pkey" PRIMARY KEY using index "initial_stock_pkey";


create table "public"."monthly_snapshots" (
    "id" uuid not null default uuid_generate_v4(),
    "snapshot_date" date not null,
    "cash_balance" numeric,
    "bank_balances" jsonb,
    "stock_items" jsonb,
    "total_receivables" numeric,
    "total_payables" numeric,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."monthly_snapshots" enable row level security;
CREATE UNIQUE INDEX monthly_snapshots_pkey ON public.monthly_snapshots USING btree (id);
alter table "public"."monthly_snapshots" add constraint "monthly_snapshots_pkey" PRIMARY KEY using index "monthly_snapshots_pkey";


create table "public"."loan_payments" (
    "id" uuid not null default uuid_generate_v4(),
    "loan_id" uuid not null references public.loans(id) on delete cascade,
    "payment_date" date not null,
    "amount" numeric not null,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "linked_transaction_id" uuid
);
alter table "public"."loan_payments" enable row level security;
CREATE UNIQUE INDEX loan_payments_pkey ON public.loan_payments USING btree (id);
alter table "public"."loan_payments" add constraint "loan_payments_pkey" PRIMARY KEY using index "loan_payments_pkey";


create table "public"."activity_log" (
    "id" bigint generated by default as identity,
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid not null references auth.users(id),
    "username" text not null,
    "description" text not null
);
alter table "public"."activity_log" enable row level security;
CREATE UNIQUE INDEX activity_log_pkey ON public.activity_log USING btree (id);
alter table "public"."activity_log" add constraint "activity_log_pkey" PRIMARY KEY using index "activity_log_pkey";

-- Set up policies
alter publication "supabase_realtime" add table "public"."banks";
alter publication "supabase_realtime" add table "public"."categories";
alter publication "supabase_realtime" add table "public"."contacts";
alter publication "supabase_realtime" add table "public"."loans";
alter publication "supabase_realtime" add table "public"."cash_transactions";
alter publication "supabase_realtime" add table "public"."bank_transactions";
alter publication "supabase_realtime" add table "public"."stock_transactions";
alter publication "supabase_realtime" add table "public"."ap_ar_transactions";
alter publication "supabase_realtime" add table "public"."ledger_payments";
alter publication "supabase_realtime" add table "public"."initial_stock";
alter publication "supabase_realtime" add table "public"."monthly_snapshots";
alter publication "supabase_realtime" add table "public"."loan_payments";
alter publication "supabase_realtime" add table "public"."activity_log";

create policy "Enable all access for authenticated users" on "public"."banks" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."categories" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."contacts" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."loans" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."cash_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."bank_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."stock_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."ap_ar_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."ledger_payments" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."initial_stock" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."monthly_snapshots" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."loan_payments" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."activity_log" as permissive for all to authenticated using (true) with check (true);


-- RPC function to empty recycle bin
create or replace function permanently_empty_recycle_bin()
returns void as $$
begin
    -- Permanently delete records marked for deletion
    delete from cash_transactions where "deletedAt" is not null;
    delete from bank_transactions where "deletedAt" is not null;
    delete from stock_transactions where "deletedAt" is not null;
    delete from ap_ar_transactions where "deletedAt" is not null;
end;
$$ language plpgsql security definer;

grant execute on function permanently_empty_recycle_bin() to authenticated;


-- Add Foreign Key Constraints
ALTER TABLE "public"."loan_payments"
ADD CONSTRAINT "loan_payments_linked_transaction_id_fkey"
FOREIGN KEY ("linked_transaction_id")
REFERENCES "public"."cash_transactions"(id)
ON DELETE SET NULL;

ALTER TABLE "public"."loan_payments"
ADD CONSTRAINT "loan_payments_linked_transaction_id_bank_fkey"
FOREIGN KEY ("linked_transaction_id")
REFERENCES "public"."bank_transactions"(id)
ON DELETE SET NULL;


-- Add indexes for performance
CREATE INDEX idx_cash_transactions_date ON public.cash_transactions(date);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(date);
CREATE INDEX idx_stock_transactions_date ON public.stock_transactions(date);
CREATE INDEX idx_ap_ar_transactions_contact ON public.ap_ar_transactions(contact_id);
CREATE INDEX idx_loans_contact ON public.loans(contact_id);
CREATE INDEX idx_loan_payments_loan_id ON public.loan_payments(loan_id);
