-- Migration: Add category column to store_profiles table
ALTER TABLE store_profiles 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'retail' NOT NULL;
