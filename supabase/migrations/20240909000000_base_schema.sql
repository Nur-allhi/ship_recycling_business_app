
-- Enable pgsodium extension if not exists
create extension if not exists "pgsodium" with schema "pgsodium";

-- Enable pg_graphql extension if not exists
create extension if not exists "pg_graphql" with schema "graphql";

-- Enable pg_stat_statements extension if not exists
create extension if not exists "pg_stat_statements" with schema "extensions";

-- Enable pgcrypto extension if not exists
create extension if not exists "pgcrypto" with schema "extensions";

-- Enable pgjwt extension if not exists
create extension if not exists "pgjwt" with schema "extensions";

-- Enable uuid-ossp extension if not exists
create extension if not exists "uuid-ossp" with schema "extensions";


-- Create custom types
create type "public"."transaction_type" as enum ('income', 'expense');
create type "public"."bank_transaction_type" as enum ('deposit', 'withdrawal');
create type "public"."stock_transaction_type" as enum ('purchase', 'sale');
create type "public"."contact_type" as enum ('vendor', 'client', 'both');
create type "public"."payment_status" as enum ('unpaid', 'partially paid', 'paid');
create type "public"."ledger_type" as enum ('payable', 'receivable', 'advance');
create type "public"."payment_method" as enum ('cash', 'bank', 'credit');
create type "public"."loan_type" as enum ('payable', 'receivable');
create type "public"."loan_status" as enum ('active', 'paid', 'defaulted');
create type "public"."category_type" as enum ('cash', 'bank');
create type "public"."category_direction" as enum ('credit', 'debit');

-- Set up tables
create table "public"."banks" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."banks" enable row level security;
CREATE UNIQUE INDEX banks_pkey ON public.banks USING btree (id);
alter table "public"."banks" add constraint "banks_pkey" PRIMARY KEY using index "banks_pkey";

create table "public"."cash_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "date" date not null,
    "description" text not null,
    "expected_amount" numeric not null,
    "actual_amount" numeric not null,
    "difference" numeric not null,
    "difference_reason" text,
    "category" text not null,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "type" transaction_type not null,
    "linkedStockTxId" uuid,
    "advance_id" uuid,
    "contact_id" uuid,
    "linkedLoanId" uuid,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."cash_transactions" enable row level security;
CREATE UNIQUE INDEX cash_transactions_pkey ON public.cash_transactions USING btree (id);
alter table "public"."cash_transactions" add constraint "cash_transactions_pkey" PRIMARY KEY using index "cash_transactions_pkey";

create table "public"."bank_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "date" date not null,
    "description" text not null,
    "expected_amount" numeric not null,
    "actual_amount" numeric not null,
    "difference" numeric not null,
    "difference_reason" text,
    "category" text not null,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "type" bank_transaction_type not null,
    "bank_id" uuid not null,
    "linkedStockTxId" uuid,
    "advance_id" uuid,
    "contact_id" uuid,
    "linkedLoanId" uuid,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."bank_transactions" enable row level security;
CREATE UNIQUE INDEX bank_transactions_pkey ON public.bank_transactions USING btree (id);
alter table "public"."bank_transactions" add constraint "bank_transactions_pkey" PRIMARY KEY using index "bank_transactions_pkey";
alter table "public"."bank_transactions" add constraint "bank_transactions_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE not valid;
alter table "public"."bank_transactions" validate constraint "bank_transactions_bank_id_fkey";

create table "public"."stock_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "date" date not null,
    "stockItemName" text not null,
    "type" stock_transaction_type not null,
    "weight" numeric not null,
    "pricePerKg" numeric not null,
    "paymentMethod" payment_method not null,
    "bank_id" uuid,
    "description" text,
    "lastEdited" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "expected_amount" numeric not null,
    "actual_amount" numeric not null,
    "difference" numeric not null,
    "difference_reason" text,
    "contact_id" uuid,
    "contact_name" text,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."stock_transactions" enable row level security;
CREATE UNIQUE INDEX stock_transactions_pkey ON public.stock_transactions USING btree (id);
alter table "public"."stock_transactions" add constraint "stock_transactions_pkey" PRIMARY KEY using index "stock_transactions_pkey";

create table "public"."initial_stock" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "weight" numeric not null,
    "purchasePricePerKg" numeric not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."initial_stock" enable row level security;
CREATE UNIQUE INDEX initial_stock_pkey ON public.initial_stock USING btree (id);
alter table "public"."initial_stock" add constraint "initial_stock_pkey" PRIMARY KEY using index "initial_stock_pkey";


create table "public"."contacts" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" contact_type not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."contacts" enable row level security;
CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id);
alter table "public"."contacts" add constraint "contacts_pkey" PRIMARY KEY using index "contacts_pkey";


create table "public"."ap_ar_transactions" (
    "id" uuid not null default gen_random_uuid(),
    "date" date not null,
    "type" ledger_type not null,
    "description" text not null,
    "amount" numeric not null,
    "paid_amount" numeric not null default 0,
    "status" payment_status not null,
    "contact_id" uuid not null,
    "contact_name" text,
    "deletedAt" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."ap_ar_transactions" enable row level security;
CREATE UNIQUE INDEX ap_ar_transactions_pkey ON public.ap_ar_transactions USING btree (id);
alter table "public"."ap_ar_transactions" add constraint "ap_ar_transactions_pkey" PRIMARY KEY using index "ap_ar_transactions_pkey";
alter table "public"."ap_ar_transactions" add constraint "ap_ar_transactions_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE not valid;
alter table "public"."ap_ar_transactions" validate constraint "ap_ar_transactions_contact_id_fkey";


create table "public"."ledger_payments" (
    "id" uuid not null default gen_random_uuid(),
    "ap_ar_transaction_id" uuid not null,
    "amount" numeric not null,
    "date" date not null,
    "payment_method" text not null,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."ledger_payments" enable row level security;
CREATE UNIQUE INDEX ledger_payments_pkey ON public.ledger_payments USING btree (id);
alter table "public"."ledger_payments" add constraint "ledger_payments_pkey" PRIMARY KEY using index "ledger_payments_pkey";
alter table "public"."ledger_payments" add constraint "ledger_payments_ap_ar_transaction_id_fkey" FOREIGN KEY (ap_ar_transaction_id) REFERENCES ap_ar_transactions(id) ON DELETE CASCADE not valid;
alter table "public"."ledger_payments" validate constraint "ledger_payments_ap_ar_transaction_id_fkey";


create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "type" category_type not null,
    "direction" category_direction,
    "is_deletable" boolean not null default true
);

alter table "public"."categories" enable row level security;
CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);
alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";


create table "public"."loans" (
    "id" uuid not null default gen_random_uuid(),
    "contact_id" uuid not null,
    "type" loan_type not null,
    "principal_amount" numeric not null,
    "interest_rate" numeric not null,
    "issue_date" date not null,
    "due_date" date,
    "status" loan_status not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."loans" enable row level security;
CREATE UNIQUE INDEX loans_pkey ON public.loans USING btree (id);
alter table "public"."loans" add constraint "loans_pkey" PRIMARY KEY using index "loans_pkey";
alter table "public"."loans" add constraint "loans_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE not valid;
alter table "public"."loans" validate constraint "loans_contact_id_fkey";

create table "public"."loan_payments" (
    "id" uuid not null default gen_random_uuid(),
    "loan_id" uuid not null,
    "payment_date" date not null,
    "amount" numeric not null,
    "linked_transaction_id" uuid,
    "notes" text,
    "created_at" timestamp with time zone not null default now()
);
alter table "public"."loan_payments" enable row level security;
CREATE UNIQUE INDEX loan_payments_pkey ON public.loan_payments USING btree (id);
alter table "public"."loan_payments" add constraint "loan_payments_pkey" PRIMARY KEY using index "loan_payments_pkey";
alter table "public"."loan_payments" add constraint "loan_payments_loan_id_fkey" FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE not valid;
alter table "public"."loan_payments" validate constraint "loan_payments_loan_id_fkey";


create table "public"."monthly_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "snapshot_date" date not null,
    "cash_balance" numeric not null,
    "bank_balances" jsonb not null,
    "stock_items" jsonb not null,
    "total_receivables" numeric not null,
    "total_payables" numeric not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."monthly_snapshots" enable row level security;
CREATE UNIQUE INDEX monthly_snapshots_pkey ON public.monthly_snapshots USING btree (id);
alter table "public"."monthly_snapshots" add constraint "monthly_snapshots_pkey" PRIMARY KEY using index "monthly_snapshots_pkey";


create table "public"."activity_log" (
    "id" bigint generated by default as identity,
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid not null,
    "username" text not null,
    "description" text not null
);

alter table "public"."activity_log" enable row level security;
CREATE UNIQUE INDEX activity_log_pkey ON public.activity_log USING btree (id);
alter table "public"."activity_log" add constraint "activity_log_pkey" PRIMARY KEY using index "activity_log_pkey";

-- Function to permanently delete records marked for deletion
CREATE OR REPLACE FUNCTION permanently_empty_recycle_bin()
RETURNS void AS $$
BEGIN
    DELETE FROM cash_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM bank_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM stock_transactions WHERE "deletedAt" IS NOT NULL;
    DELETE FROM ap_ar_transactions WHERE "deletedAt" IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security
create policy "Enable all access for authenticated users" on "public"."banks" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."cash_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."bank_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."stock_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."initial_stock" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."contacts" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."ap_ar_transactions" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."ledger_payments" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."categories" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."loans" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."loan_payments" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."monthly_snapshots" as permissive for all to authenticated using (true) with check (true);
create policy "Enable all access for authenticated users" on "public"."activity_log" as permissive for all to authenticated using (true) with check (true);
