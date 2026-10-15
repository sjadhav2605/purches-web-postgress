-- Migration: Add Commercial Terms & Declaration tracking to purchase_orders
-- Preserves all existing columns and data.

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS declaration_text TEXT NULL AFTER payment_terms,
ADD COLUMN IF NOT EXISTS terms_updated_by_id INT NULL AFTER declaration_text,
ADD COLUMN IF NOT EXISTS terms_updated_by_name VARCHAR(150) NULL AFTER terms_updated_by_id,
ADD COLUMN IF NOT EXISTS terms_updated_at VARCHAR(50) NULL AFTER terms_updated_by_name;
