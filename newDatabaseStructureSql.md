
# New Database Schema (Version 2.0)

This file documents the new, refactored SQL structure for the application. It includes a unified `contacts` table and a dedicated module for `loans`.

### **Part 1: Create New Tables**

These commands set up the new tables for contacts and loans.

```sql
-- Create a new unified contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Type can be 'vendor', 'client', or 'both'
    type TEXT NOT NULL CHECK (type IN ('vendor', 'client', 'both')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the main table for loan agreements
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    -- 'payable' (we borrowed), 'receivable' (we lent)
    type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
    principal_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    issue_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table to track individual payments against a loan
CREATE TABLE loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    payment_date TIMESTamptz NOT NULL,
    amount NUMERIC NOT NULL,
    -- Can be linked to a cash or bank transaction
    linked_transaction_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for the new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Allow all for authenticated users" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON loan_payments FOR ALL USING (true) WITH CHECK (true);
```

---

### **Part 2: Data Migration**

This script migrates existing data from the old `vendors` and `clients` tables into the new `contacts` table. **This should be run only once.**

```sql
-- Step 1: Insert all vendors into the new contacts table
INSERT INTO contacts (id, name, type, created_at)
SELECT id, name, 'vendor', created_at
FROM vendors;

-- Step 2: Insert all clients into the new contacts table
-- This uses ON CONFLICT to handle cases where a contact might exist as both a vendor and a client
INSERT INTO contacts (id, name, type, created_at)
SELECT id, name, 'client', created_at
FROM clients
ON CONFLICT (id) DO UPDATE
SET type = 'both';

-- Step 3: Update all transaction tables to point to the new contacts table
-- This assumes the contact_id from vendors/clients is directly transferrable.
UPDATE ap_ar_transactions
SET contact_id = ap_ar_transactions.contact_id; -- No change needed if IDs are preserved

UPDATE stock_transactions
SET contact_id = stock_transactions.contact_id; -- No change needed if IDs are preserved

UPDATE cash_transactions
SET contact_id = cash_transactions.contact_id; -- No change needed if IDs are preserved

UPDATE bank_transactions
SET contact_id = bank_transactions.contact_id; -- No change needed if IDs are preserved
```

---

### **Part 3: Clean Up Old Tables**

After confirming the data migration is successful, these commands will remove the old, now redundant, tables.

```sql
-- Drop the old tables
DROP TABLE vendors;
DROP TABLE clients;
```
