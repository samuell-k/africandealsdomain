-- Database setup for ADD Physical Products Platform
-- Run this file to create the necessary tables

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id INT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL,
  INDEX idx_parent_id (parent_id),
  INDEX idx_slug (slug),
  INDEX idx_active (is_active)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  category_id INT,
  seller_id INT NOT NULL,
  stock_quantity INT DEFAULT 0,
  main_image VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT TRUE, -- Changed to TRUE for free listing
  is_featured BOOLEAN DEFAULT FALSE,
  is_boosted BOOLEAN DEFAULT FALSE,
  is_sponsored BOOLEAN DEFAULT FALSE, -- New column for sponsored products
  approval_reason TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 1.00, -- Default 1% commission
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  INDEX idx_active (is_active),
  INDEX idx_approved (is_approved),
  INDEX idx_featured (is_featured),
  INDEX idx_boosted (is_boosted),
  INDEX idx_sponsored (is_sponsored),
  INDEX idx_price (price),
  INDEX idx_created (created_at)
);

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('buyer', 'seller', 'agent', 'admin', 'moderator') DEFAULT 'buyer',
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  wallet_balance DECIMAL(12,2) DEFAULT 0.00,
  commission_balance DECIMAL(12,2) DEFAULT 0.00,
  total_sales DECIMAL(12,2) DEFAULT 0.00,
  total_orders INT DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  profile_image VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  login_attempts INT DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  INDEX idx_role (role),
  INDEX idx_active (is_active),
  INDEX idx_verified (is_verified),
  INDEX idx_created (created_at)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
  product_id INT NULL,
  order_id INT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_product (product_id),
  INDEX idx_order (order_id),
  INDEX idx_read (is_read),
  INDEX idx_created (created_at)
);

-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY unique_wishlist (user_id, product_id),
  INDEX idx_user (user_id),
  INDEX idx_product (product_id)
);

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY unique_cart (user_id, product_id),
  INDEX idx_user (user_id),
  INDEX idx_product (product_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  seller_id INT NOT NULL,
  agent_id INT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed') DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL,
  shipping_cost DECIMAL(8,2) DEFAULT 0,
  tax_amount DECIMAL(8,2) DEFAULT 0,
  discount_amount DECIMAL(8,2) DEFAULT 0,
  commission_amount DECIMAL(8,2) DEFAULT 0,
  shipping_address TEXT,
  billing_address TEXT,
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  tracking_number VARCHAR(100),
  notes TEXT,
  dispute_reason TEXT,
  refund_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_seller (seller_id),
  INDEX idx_agent (agent_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created (created_at)
);

-- Add payment_proof column to orders table for manual payments
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof VARCHAR(255) NULL;

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order (order_id),
  INDEX idx_product (product_id)
);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('info', 'warning', 'error', 'debug') DEFAULT 'info',
  message VARCHAR(500) NOT NULL,
  details JSON,
  user_id INT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_level (level),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);

-- Create shipping_rates table
CREATE TABLE IF NOT EXISTS shipping_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone VARCHAR(100) NOT NULL,
  min_weight DECIMAL(8,2) DEFAULT 0,
  max_weight DECIMAL(8,2),
  base_rate DECIMAL(8,2) NOT NULL,
  additional_rate DECIMAL(8,2) DEFAULT 0,
  delivery_time INT DEFAULT 1, -- in days
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_zone (zone),
  INDEX idx_active (is_active)
);

-- Create shipping_zones table
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  countries JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
);

-- Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('email', 'sms', 'push', 'banner', 'social') NOT NULL,
  description TEXT,
  budget DECIMAL(10,2),
  target_audience JSON,
  start_date DATE,
  end_date DATE,
  status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
  metrics JSON,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
);

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('discount_code', 'flash_sale', 'bundle', 'free_shipping') NOT NULL,
  discount_value DECIMAL(8,2),
  discount_percentage DECIMAL(5,2),
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  usage_limit INT,
  per_user_limit INT DEFAULT 1,
  applicable_products JSON,
  start_date DATETIME,
  end_date DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_type (type),
  INDEX idx_active (is_active),
  INDEX idx_dates (start_date, end_date)
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (setting_key),
  INDEX idx_public (is_public)
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('technical', 'billing', 'order', 'product', 'general') DEFAULT 'general',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  assigned_to INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_category (category),
  INDEX idx_created (created_at)
);

-- Create support_ticket_responses table
CREATE TABLE IF NOT EXISTS support_ticket_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_ticket (ticket_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'order', 'payment', 'system') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_read (is_read),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
  target_audience ENUM('all', 'buyers', 'sellers', 'agents') DEFAULT 'all',
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATETIME,
  end_date DATETIME,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_active (is_active),
  INDEX idx_audience (target_audience),
  INDEX idx_dates (start_date, end_date)
);

-- Create platform_settings table for commission and pricing configuration
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  is_editable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_key (setting_key)
);

-- Insert commission and pricing settings
INSERT IGNORE INTO platform_settings (setting_key, setting_value, setting_type, category, description, is_editable) VALUES
('default_platform_margin', '21.00', 'number', 'commission', 'Default platform margin percentage (hidden from buyers)', TRUE),
('home_delivery_additional_fee', '6.00', 'number', 'commission', 'Additional fee for home delivery (percentage)', TRUE),
('system_maintenance_fee', '1.00', 'number', 'commission', 'System maintenance fee (percentage of platform margin)', TRUE),
('fast_delivery_agent_rate', '70.00', 'number', 'commission', 'Fast delivery agent commission rate (percentage)', TRUE),
('psm_helped_rate', '25.00', 'number', 'commission', 'Pickup site manager helped commission rate (percentage)', TRUE),
('psm_received_rate', '15.00', 'number', 'commission', 'Pickup site manager received commission rate (percentage)', TRUE),
('pickup_delivery_agent_rate', '70.00', 'number', 'commission', 'Pickup delivery agent commission rate (percentage)', TRUE);

-- Insert default system settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'ADD Physical Products', 'string', 'Website name'),
('site_url', 'https://addphysicalproducts.com', 'string', 'Website URL'),
('default_currency', 'FRW', 'string', 'Default currency'),
('timezone', 'UTC', 'string', 'Default timezone'),
('commission_rate', '1', 'number', 'Platform commission rate (%)'),
('transaction_fee', '2.9', 'number', 'Transaction fee (%)'),
('maintenance_mode', 'false', 'boolean', 'Maintenance mode status'),
('session_timeout', '30', 'number', 'Session timeout in minutes'),
('max_login_attempts', '5', 'number', 'Maximum login attempts'),
('email_notifications', 'true', 'boolean', 'Enable email notifications'),
('two_factor_auth', 'false', 'boolean', 'Enable two-factor authentication'),
('ssl_required', 'true', 'boolean', 'Require SSL for admin access'),
('product_approval_required', 'false', 'boolean', 'Require admin approval for products'),
('free_product_listing', 'true', 'boolean', 'Allow free product listing'),
('supported_currencies', '["USD", "EUR", "GBP", "NGN", "KES", "UGX", "TZS", "RWF"]', 'json', 'Supported currencies'),
('supported_languages', '["en", "fr", "sw", "ha", "yo", "rw", "ar"]', 'json', 'Supported languages'),
('shipping_enabled', 'true', 'boolean', 'Enable shipping features'),
('marketing_enabled', 'true', 'boolean', 'Enable marketing features'),
('support_enabled', 'true', 'boolean', 'Enable support system'),
('analytics_enabled', 'true', 'boolean', 'Enable analytics tracking');

-- Insert sample shipping rates
INSERT IGNORE INTO shipping_rates (zone, min_weight, max_weight, base_rate, additional_rate, delivery_time) VALUES
('Local', 0, 5, 5.00, 1.00, 1),
('Regional', 0, 10, 12.00, 2.50, 3),
('International', 0, 20, 25.00, 5.00, 7);

-- Insert sample shipping zones
INSERT IGNORE INTO shipping_zones (name, countries) VALUES
('Local', '["Rwanda"]'),
('Regional', '["Kenya", "Uganda", "Tanzania"]'),
('International', '["All"]');

-- Insert sample admin user
INSERT IGNORE INTO users (username, email, password_hash, role, is_active, is_verified) VALUES
('admin', 'admin@addphysicalproducts.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', TRUE, TRUE);

-- Insert sample categories
INSERT INTO product_categories (name, slug, description, sort_order) VALUES
('Electronics', 'electronics', 'Electronic devices and accessories', 1),
('Clothing & Fashion', 'clothing-fashion', 'Apparel and fashion items', 2),
('Home & Garden', 'home-garden', 'Home improvement and garden supplies', 3),
('Sports & Outdoor', 'sports-outdoor', 'Sports equipment and outdoor gear', 4),
('Automotive', 'automotive', 'Automotive parts and accessories', 5),
('Health & Beauty', 'health-beauty', 'Health and beauty products', 6),
('Books & Media', 'books-media', 'Books, movies, and media', 7),
('Toys & Games', 'toys-games', 'Toys and entertainment', 8);

-- Insert sub-categories for Electronics
INSERT INTO product_categories (name, slug, description, parent_id, sort_order) VALUES
('Smartphones', 'smartphones', 'Mobile phones and smartphones', 1, 1),
('Laptops', 'laptops', 'Portable computers and laptops', 1, 2),
('Tablets', 'tablets', 'Tablet computers and iPads', 1, 3),
('Accessories', 'electronics-accessories', 'Electronic accessories and peripherals', 1, 4);

-- Insert sub-categories for Clothing & Fashion
INSERT INTO product_categories (name, slug, description, parent_id, sort_order) VALUES
('Men\'s Clothing', 'mens-clothing', 'Clothing for men', 2, 1),
('Women\'s Clothing', 'womens-clothing', 'Clothing for women', 2, 2),
('Kids\' Clothing', 'kids-clothing', 'Clothing for children', 2, 3),
('Shoes', 'shoes', 'Footwear for all ages', 2, 4);

-- Insert sub-categories for Home & Garden
INSERT INTO product_categories (name, slug, description, parent_id, sort_order) VALUES
('Furniture', 'furniture', 'Home furniture and decor', 3, 1),
('Kitchen & Dining', 'kitchen-dining', 'Kitchen appliances and dining items', 3, 2),
('Garden Tools', 'garden-tools', 'Gardening equipment and tools', 3, 3),
('Lighting', 'lighting', 'Home lighting solutions', 3, 4);

-- Sample users removed - users will register through the application

-- Sample products removed - sellers will add their own products through the application

-- Sample messages removed - messages will be created when users interact

-- Sample orders removed - users will create their own orders through the application

-- Sample order items removed - order items will be created when users place orders

-- Create commission_transactions table for tracking all commission distributions
CREATE TABLE IF NOT EXISTS commission_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  agent_id INT,
  commission_type ENUM('platform_margin', 'system_maintenance', 'fast_delivery', 'pickup_delivery', 'psm_helped', 'psm_received') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_agent (agent_id),
  INDEX idx_type (commission_type),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- Create agent_earnings table for tracking agent earnings and payouts
CREATE TABLE IF NOT EXISTS agent_earnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  order_id INT NOT NULL,
  commission_transaction_id INT,
  amount DECIMAL(10,2) NOT NULL,
  earnings_type ENUM('delivery', 'pickup', 'management', 'bonus') DEFAULT 'delivery',
  status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
  payout_method VARCHAR(50),
  payout_reference VARCHAR(100),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (commission_transaction_id) REFERENCES commission_transactions(id) ON DELETE SET NULL,
  INDEX idx_agent (agent_id),
  INDEX idx_order (order_id),
  INDEX idx_status (status),
  INDEX idx_type (earnings_type),
  INDEX idx_created (created_at)
);

-- Create payment_logs table for tracking payment actions
CREATE TABLE IF NOT EXISTS payment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT,
  action VARCHAR(100) NOT NULL,
  details JSON,
  user_id INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_transaction (transaction_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);

-- Create agents table for agent profiles
CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  agent_type ENUM('fast_delivery', 'pickup_delivery', 'pickup_site_manager') NOT NULL,
  status ENUM('available', 'busy', 'offline', 'suspended') DEFAULT 'offline',
  admin_approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_deliveries INT DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  current_location JSON,
  working_hours JSON,
  vehicle_type VARCHAR(50),
  vehicle_registration VARCHAR(50),
  license_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_type (agent_type),
  INDEX idx_status (status),
  INDEX idx_approval (admin_approval_status),
  INDEX idx_rating (rating)
);

-- Create pickup_sites table for pickup locations
CREATE TABLE IF NOT EXISTS pickup_sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(100),
  manager_id INT,
  capacity INT DEFAULT 50,
  current_load INT DEFAULT 0,
  operating_hours JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_city (city),
  INDEX idx_active (is_active),
  INDEX idx_manager (manager_id)
); 