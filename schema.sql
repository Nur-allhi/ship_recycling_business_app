
-- Vendors Table: Stores information about suppliers.
CREATE TABLE if not exists vendors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors are viewable by the user who created them" ON vendors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own vendors" ON vendors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own vendors" ON vendors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vendors" ON vendors FOR DELETE USING (auth.uid() = user_id);


-- Clients Table: Stores information about customers.
CREATE TABLE if not exists clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients are viewable by the user who created them" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON clients FOR DELETE USING (auth.uid() = user_id);


-- Accounts Payable / Accounts Receivable Transactions Table
-- Tracks money owed to vendors (payables) and money owed by clients (receivables).
CREATE TABLE if not exists ap_ar_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date timestamp with time zone NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
    contactId uuid NOT NULL,
    contactName TEXT NOT NULL,
    description TEXT NOT NULL,
    amount numeric NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    dueDate timestamp with time zone,
    paidDate timestamp with time zone,
    paidFrom TEXT CHECK (paidFrom IN ('cash', 'bank')),
    "deletedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "linkedStockTxId" uuid,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE ap_ar_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AP/AR transactions are viewable by the user who created them" ON ap_ar_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own AP/AR transactions" ON ap_ar_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own AP/AR transactions" ON ap_ar_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own AP/AR transactions" ON ap_ar_transactions FOR DELETE USING (auth.uid() = user_id);
