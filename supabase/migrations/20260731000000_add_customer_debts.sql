-- Create customer_debts table to record store credit sales
CREATE TABLE IF NOT EXISTS customer_debts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    customer_phone text,
    items_summary text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0.00 NOT NULL,
    status text DEFAULT 'unpaid' NOT NULL, -- unpaid, partially_paid, paid
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_debts_owner ON customer_debts(owner_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_status ON customer_debts(status);

-- Enable Row Level Security (RLS)
ALTER TABLE customer_debts ENABLE ROW LEVEL SECURITY;

-- Create Ownership Security Policies
CREATE POLICY "Allow CRUD for owners" ON customer_debts
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);
