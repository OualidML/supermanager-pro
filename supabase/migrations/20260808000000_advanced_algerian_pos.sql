-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text,
    current_debt numeric(12,2) DEFAULT 0.00 NOT NULL,
    credit_limit numeric(12,2) DEFAULT 50000.00 NOT NULL,
    price_tier text DEFAULT 'retail' NOT NULL, -- retail, wholesale, special
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow CRUD for owners" ON clients
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trigger_update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 2. Add columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS wholesale_price numeric(12,2),
ADD COLUMN IF NOT EXISTS special_price numeric(12,2),
ADD COLUMN IF NOT EXISTS expiration_date date,
ADD COLUMN IF NOT EXISTS warehouse_location text;


-- 3. Create delivery_notes table (BL - Bon de Livraison)
CREATE TABLE IF NOT EXISTS delivery_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
    client_name text NOT NULL,
    client_phone text,
    items_json jsonb NOT NULL, -- list of items purchased
    total_amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0.00 NOT NULL,
    driver_name text,
    vehicle_plate text,
    destination text,
    converted_to_invoice boolean DEFAULT false NOT NULL,
    invoice_id uuid, -- links to invoices table once converted
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_owner ON delivery_notes(owner_id);

ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow CRUD for owners" ON delivery_notes
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);


-- 4. Create invoices table (Factures)
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    delivery_note_id uuid REFERENCES delivery_notes(id) ON DELETE SET NULL,
    client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
    client_name text NOT NULL,
    items_json jsonb NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_owner ON invoices(owner_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow CRUD for owners" ON invoices
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);


-- 5. Create versements table (Installment payments)
CREATE TABLE IF NOT EXISTS versements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL,
    remaining_debt_after numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versements_owner ON versements(owner_id);

ALTER TABLE versements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow CRUD for owners" ON versements
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);
