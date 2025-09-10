-- Migration: Add tables for comprehensive product details
-- Date: Today
-- Description: Add tables for product reviews, views, and specifications

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_votes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_user (user_id),
  INDEX idx_rating (rating),
  INDEX idx_approved (is_approved),
  INDEX idx_created (created_at),
  UNIQUE KEY unique_user_product_review (user_id, product_id)
);

-- Create product_views table for analytics
CREATE TABLE IF NOT EXISTS product_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_user (user_id),
  INDEX idx_viewed (viewed_at),
  INDEX idx_ip (ip_address)
);

-- Create product_specifications table for better querying
CREATE TABLE IF NOT EXISTS product_specifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  specification_name VARCHAR(255) NOT NULL,
  specification_value TEXT NOT NULL,
  specification_group VARCHAR(100) DEFAULT 'General',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_name (specification_name),
  INDEX idx_group (specification_group),
  INDEX idx_sort (sort_order)
);

-- Create product_tags table for better categorization
CREATE TABLE IF NOT EXISTS product_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_active (is_active)
);

-- Create product_tag_relationships table
CREATE TABLE IF NOT EXISTS product_tag_relationships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES product_tags(id) ON DELETE CASCADE,
  UNIQUE KEY unique_product_tag (product_id, tag_id),
  INDEX idx_product (product_id),
  INDEX idx_tag (tag_id)
);

-- Add missing columns to products table if they don't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand VARCHAR(255) AFTER name,
ADD COLUMN IF NOT EXISTS sku VARCHAR(100) AFTER brand,
ADD COLUMN IF NOT EXISTS condition ENUM('new', 'used', 'refurbished') DEFAULT 'new' AFTER sku,
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RWF' AFTER price,
ADD COLUMN IF NOT EXISTS discount_price DECIMAL(10,2) AFTER currency,
ADD COLUMN IF NOT EXISTS min_order_quantity INT DEFAULT 1 AFTER stock_quantity,
ADD COLUMN IF NOT EXISTS weight DECIMAL(8,3) AFTER min_order_quantity,
ADD COLUMN IF NOT EXISTS dimensions VARCHAR(100) AFTER weight,
ADD COLUMN IF NOT EXISTS shipping_info TEXT AFTER dimensions,
ADD COLUMN IF NOT EXISTS tags JSON AFTER specifications,
ADD COLUMN IF NOT EXISTS certifications JSON AFTER tags,
ADD COLUMN IF NOT EXISTS display_price DECIMAL(10,2) AFTER price;

-- Update display_price for existing products
UPDATE products 
SET display_price = price 
WHERE display_price IS NULL;

-- Create indexes for new columns
ALTER TABLE products
ADD INDEX IF NOT EXISTS idx_brand (brand),
ADD INDEX IF NOT EXISTS idx_sku (sku),
ADD INDEX IF NOT EXISTS idx_condition (condition),
ADD INDEX IF NOT EXISTS idx_currency (currency),
ADD INDEX IF NOT EXISTS idx_discount_price (discount_price),
ADD INDEX IF NOT EXISTS idx_min_order_quantity (min_order_quantity);

-- Insert some sample tags
INSERT IGNORE INTO product_tags (name, slug, color) VALUES
('Electronics', 'electronics', '#3B82F6'),
('Fashion', 'fashion', '#EC4899'),
('Home & Garden', 'home-garden', '#10B981'),
('Sports', 'sports', '#F59E0B'),
('Books', 'books', '#8B5CF6'),
('Health & Beauty', 'health-beauty', '#06B6D4'),
('Automotive', 'automotive', '#EF4444'),
('Toys & Games', 'toys-games', '#84CC16'),
('Food & Beverages', 'food-beverages', '#F97316'),
('Office Supplies', 'office-supplies', '#6B7280'),
('New Arrival', 'new-arrival', '#22C55E'),
('Best Seller', 'best-seller', '#FFD700'),
('On Sale', 'on-sale', '#DC2626'),
('Free Shipping', 'free-shipping', '#059669'),
('Limited Edition', 'limited-edition', '#7C3AED'),
('Eco-Friendly', 'eco-friendly', '#16A34A'),
('Premium Quality', 'premium-quality', '#B45309'),
('Handmade', 'handmade', '#BE185D'),
('Import', 'import', '#0891B2'),
('Local', 'local', '#65A30D');