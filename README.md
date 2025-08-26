
# ShipShape Ledger - Application Blueprint

This document outlines the architecture, features, and technical implementation of the ShipShape Ledger application. It serves as a comprehensive blueprint for understanding the project at its current stage.

## 1. Core Architecture

The application is a modern, offline-first web app designed for financial and inventory management. It is built on a robust, type-safe, and scalable technology stack.

- **Frontend:** Next.js with React (App Router)
- **Language:** TypeScript
- **UI Framework:** Tailwind CSS with ShadCN UI components
- **State Management:** React Context API (`AppContext`) for global state.
- **Offline Caching:** `Dexie.js` (a wrapper for IndexedDB) for an offline-first experience, instant UI rendering, and data resilience.
- **Backend-as-a-Service (BaaS):** Supabase
- **Authentication:** Supabase Auth, with a custom session management system using JWTs stored in secure, `httpOnly` cookies. Supports 'admin' and 'user' roles.
- **Database:** Supabase PostgreSQL

## 2. Key Features

### 2.1. Financial Management
- **Dashboard:** An at-a-glance overview of key financial metrics, including total balance, cash balance, bank balance, and total stock value.
- **Cash Ledger:** Tracks all cash-based income and expenses. Features include monthly navigation, running balance calculation, and transaction history.
- **Bank Ledger:** Tracks transactions across multiple bank accounts. Features include filtering by bank, monthly navigation, and a running balance for each account.
- **A/R & A/P:** Manages accounts receivable (money owed by clients) and accounts payable (money owed to vendors). It tracks total outstanding balances for each contact.

### 2.2. Stock & Inventory Management
- **Stock Inventory:** A real-time view of all stock items, including current weight, average purchase price, and total value.
- **Stock History:** A detailed log of all stock purchases and sales, with monthly navigation and filtering.

### 2.3. Offline-First Capability
- **Instant Load Times:** The app loads instantly by first reading all data from the local IndexedDB cache.
- **Background Syncing:** It fetches the latest data from the Supabase server in the background and seamlessly merges it with the local cache.
- **Offline Transaction Queueing:** Users can create, update, and delete transactions while offline. These actions are saved to a local queue and automatically synced with the server once the internet connection is restored. An "Offline" indicator is displayed in the UI when connectivity is lost.

### 2.4. User & System Management (Admin Only)
- **User Management:** Admins can add, view, and delete users ('admin' or 'user' roles).
- **Data Management:** Admins can export all data to a ZIP backup, restore from a backup (overwriting current data), and delete all application data.
- **Recycle Bin:** Deleted transactions are moved to a recycle bin, from which admins can restore them or empty the bin permanently.
- **Activity Log:** Tracks important actions performed by users, providing an audit trail.

## 3. Data Flow & State Management

The application's state management is centered in **`src/app/store.tsx`** (`AppContext`).

1.  **Initial Load:**
    - The `AppProvider` attempts to load user session data.
    - All necessary data (transactions, contacts, categories, etc.) is first read from the local **IndexedDB** using `Dexie.js`. This makes the UI render instantly.
    - In the background, `reloadData` fetches the latest data from the **Supabase** server.
2.  **Live UI Updates:**
    - UI components use the `useLiveQuery` hook from `dexie-react-hooks`. This creates a live connection to the IndexedDB.
    - Any change to the local database (from a user action or background sync) automatically triggers a re-render of the relevant components.
3.  **Data Modification (Create/Update/Delete):**
    - User performs an action (e.g., adds a transaction).
    - The action is **immediately** written to the local IndexedDB. The UI updates instantly (Optimistic Update).
    - The app checks for online status:
        - **Online:** The action is sent to the Supabase server.
        - **Offline:** The action is added to a `syncQueue` table in IndexedDB.
4.  **Syncing:**
    - When the app comes back online, it automatically processes the `syncQueue`, sending pending actions to the server in the order they were made.

## 4. Supabase Database Schema Setup

To properly set up the Supabase database, run the SQL commands found in the sections below in your Supabase SQL Editor. This will create all necessary tables and security policies.

### 4.1. Core Schema (`schema.sql`)
This is the original schema for the application.

```sql
-- (Original schema from the project's early days)
-- This is preserved for historical context but the subsequent scripts are what matter.
```

### 4.2. Installment Payments
This enables tracking partial payments against A/R and A/P items.

```sql
-- Create a new table to store each installment payment
CREATE TABLE payment_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ap_ar_transaction_id UUID NOT NULL REFERENCES ap_ar_transactions(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank'))
);

-- Add a column to ap_ar_transactions to track the amount paid
ALTER TABLE ap_ar_transactions
ADD COLUMN paid_amount NUMERIC NOT NULL DEFAULT 0;

-- Drop the old status constraint if it exists (using a safer method)
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ap_ar_transactions_status_check' AND conrelid = 'ap_ar_transactions'::regclass) THEN
      ALTER TABLE ap_ar_transactions DROP CONSTRAINT ap_ar_transactions_status_check;
   END IF;
END
$$;

-- Add the new status constraint that includes 'partially paid'
ALTER TABLE ap_ar_transactions
ADD CONSTRAINT ap_ar_transactions_status_check
CHECK (status IN ('unpaid', 'partially paid', 'paid'));

-- SECURE: Enable RLS for the new table
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

-- SECURE: Policy to allow authenticated users to manage their own installment payments
CREATE POLICY "Authenticated users can manage payment installments"
ON payment_installments FOR ALL
USING (true)
WITH CHECK (true);
```

### 4.3. Multi-Bank Accounts & Activity Logging
This adds support for multiple bank accounts and a system-wide activity log.

```sql
-- Create a helper function to safely get the role from user_metadata
-- This may already exist from previous steps, CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create a table to store different bank accounts
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL
);

-- Add a foreign key to bank_transactions to link to a specific bank
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' and column_name='bank_id') THEN
      ALTER TABLE bank_transactions ADD COLUMN bank_id UUID REFERENCES banks(id) ON DELETE SET NULL;
   END IF;
END
$$;


-- Create the activity log table to track user actions
CREATE TABLE activity_log (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT, -- We will store the username directly
    description TEXT
);

-- Drop the problematic view if it exists
DROP VIEW IF EXISTS activity_log_with_users;

-- RLS Policies for new tables
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage bank accounts"
ON banks FOR ALL
USING (true)
WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
ON activity_log FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Users can insert their own activity logs"
ON activity_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### 4.4. Monthly Balance Snapshots
Improves performance by pre-calculating balances at the start of each month.

```sql
-- Creates a table to store balance snapshots at the start of each month
CREATE TABLE monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    cash_balance NUMERIC NOT NULL DEFAULT 0,
    bank_balances JSONB NOT NULL DEFAULT '{}'::jsonb,
    stock_items JSONB NOT NULL DEFAULT '{}'::jsonb, -- Stores { "itemName": { "weight": X, "value": Y } }
    total_receivables NUMERIC NOT NULL DEFAULT 0,
    total_payables NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(snapshot_date)
);

-- RLS policy for the snapshots table
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view snapshots"
ON monthly_snapshots FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage snapshots"
ON monthly_snapshots FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');
```

### 4.5. Expected vs. Actual Amounts
Adds columns to track discrepancies between expected and actual transaction amounts.

```sql
-- Add new columns to cash_transactions
ALTER TABLE cash_transactions RENAME COLUMN amount TO actual_amount;
ALTER TABLE cash_transactions ADD COLUMN expected_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE cash_transactions ADD COLUMN difference NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE cash_transactions ADD COLUMN difference_reason TEXT;

-- Add new columns to bank_transactions
ALTER TABLE bank_transactions RENAME COLUMN amount TO actual_amount;
ALTER TABLE bank_transactions ADD COLUMN expected_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN difference NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN difference_reason TEXT;

-- Add new columns to stock_transactions
ALTER TABLE stock_transactions ADD COLUMN expected_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stock_transactions ADD COLUMN actual_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stock_transactions ADD COLUMN difference NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stock_transactions ADD COLUMN difference_reason TEXT;

-- Backfill data for existing records if necessary.
UPDATE cash_transactions SET expected_amount = actual_amount WHERE expected_amount = 0;
UPDATE bank_transactions SET expected_amount = actual_amount WHERE expected_amount = 0;
UPDATE stock_transactions SET expected_amount = (weight * "pricePerKg"), actual_amount = (weight * "pricePerKg") WHERE expected_amount = 0;
```

### 4.6. Advance Payments & Contact Linking
Adds support for tracking advance payments and links financial transactions to contacts.

```sql
-- Add a new 'advance' type to the ledger transaction types
ALTER TABLE ap_ar_transactions DROP CONSTRAINT IF EXISTS ap_ar_transactions_type_check;
ALTER TABLE ap_ar_transactions ADD CONSTRAINT ap_ar_transactions_type_check
CHECK (type IN ('payable', 'receivable', 'advance'));

-- Add a column to link financial transactions to advance ledger entries
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS advance_id UUID REFERENCES ap_ar_transactions(id) ON DELETE SET NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS advance_id UUID REFERENCES ap_ar_transactions(id) ON DELETE SET NULL;

-- Add a column to link financial transactions directly to contacts (vendors or clients)
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS contact_id UUID;
```

### 4.7. Empty Recycle Bin Stored Procedure
This adds a stored procedure to permanently delete items from the recycle bin, bypassing RLS policies that might interfere.

```sql
-- Create the stored procedure to empty the recycle bin
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
