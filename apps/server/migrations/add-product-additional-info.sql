-- Migration: Add additional product information fields
-- Date: 2024-12-19
-- Description: Add fields for features, specifications, warranty, etc.

-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN features TEXT AFTER description,
ADD COLUMN specifications_text TEXT AFTER features,
ADD COLUMN whats_included TEXT AFTER specifications_text,
ADD COLUMN usage_instructions TEXT AFTER whats_included,
ADD COLUMN warranty_period VARCHAR(50) AFTER usage_instructions,
ADD COLUMN return_policy VARCHAR(50) AFTER warranty_period,
ADD COLUMN base_price DECIMAL(10,2) AFTER price;

-- Update existing products to have base_price equal to current price
UPDATE products SET base_price = price WHERE base_price IS NULL;

-- Add sort_order column to product_images if it doesn't exist
ALTER TABLE product_images 
ADD COLUMN sort_order INT DEFAULT 0 AFTER is_main;

-- Update existing product_images to have sort_order
UPDATE product_images SET sort_order = id WHERE sort_order = 0;