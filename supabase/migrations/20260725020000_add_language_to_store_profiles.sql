-- Migration: Add language column to store_profiles table
ALTER TABLE store_profiles 
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en' NOT NULL;
