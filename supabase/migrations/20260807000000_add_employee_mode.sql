-- Add employee mode columns to store_profiles
ALTER TABLE store_profiles 
ADD COLUMN IF NOT EXISTS employee_pin text,
ADD COLUMN IF NOT EXISTS employee_mode_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS last_employee_access timestamp with time zone;

-- Add show_to_employee column to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS show_to_employee boolean DEFAULT true NOT NULL;

-- Add recorded_by column to sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS recorded_by text DEFAULT 'owner' NOT NULL;
