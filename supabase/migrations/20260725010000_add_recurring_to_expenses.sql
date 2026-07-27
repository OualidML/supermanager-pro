-- Migration: Add recurring and frequency columns to expenses table
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false NOT NULL, 
  ADD COLUMN IF NOT EXISTS frequency text;
