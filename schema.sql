-- This file contains the necessary SQL commands to ensure your database schema is compatible with the application.
-- Run these commands in your Supabase SQL Editor.

-- Adds the required 'additional_info' column to the ap_ar_transactions table to store contact information.
-- This is the most critical command to fix errors related to creating credit transactions.
ALTER TABLE ap_ar_transactions
ADD COLUMN additional_info JSONB;
