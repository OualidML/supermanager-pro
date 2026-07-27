-- Migration: Add city and currency columns to store_profiles table
ALTER TABLE store_profiles 
  ADD COLUMN IF NOT EXISTS city text, 
  ADD COLUMN IF NOT EXISTS currency text DEFAULT '$' NOT NULL;
