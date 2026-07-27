-- Enable UUID generation extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create update_updated_at_column helper function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

--------------------------------------------------------------------------------
-- 1. store_profiles
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_profiles_owner ON store_profiles(owner_id);

-- Enable RLS
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON store_profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_update_store_profiles_updated_at
    BEFORE UPDATE ON store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------------------------------------
-- 2. products
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    sku text,
    price numeric(12,2) DEFAULT 0.00 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    min_stock integer DEFAULT 0 NOT NULL,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON products
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

--------------------------------------------------------------------------------
-- 3. sales
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_at_sale numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_owner ON sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON sales
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

--------------------------------------------------------------------------------
-- 4. expenses
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    amount numeric(12,2) NOT NULL,
    category text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON expenses
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

--------------------------------------------------------------------------------
-- 5. stock_inputs
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_inputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    cost_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_inputs_owner ON stock_inputs(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_inputs_product ON stock_inputs(product_id);

-- Enable RLS
ALTER TABLE stock_inputs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON stock_inputs
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

--------------------------------------------------------------------------------
-- 6. daily_summaries
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date DEFAULT CURRENT_DATE NOT NULL,
    total_sales numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_expenses numeric(12,2) DEFAULT 0.00 NOT NULL,
    net_profit numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (owner_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_summaries_owner ON daily_summaries(owner_id);

-- Enable RLS
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON daily_summaries
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

--------------------------------------------------------------------------------
-- 7. forecasts
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_date date NOT NULL,
    predicted_sales numeric(12,2) NOT NULL,
    confidence_level numeric(5,2) NOT NULL, -- e.g. 95.50 for 95.5%
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forecasts_owner ON forecasts(owner_id);

-- Enable RLS
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON forecasts
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

--------------------------------------------------------------------------------
-- 8. assistant_messages
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assistant_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL, -- 'user', 'assistant', or 'system'
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_messages_owner ON assistant_messages(owner_id);

-- Enable RLS
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow CRUD for owners" ON assistant_messages
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);
