-- Migration: PSM manual orders, payment proofs, and commissions
-- Safe to run multiple times using IF NOT EXISTS and conditional alters

-- 1) Payment Proofs table (used by PSM manual orders and general proofs)
CREATE TABLE IF NOT EXISTS payment_proofs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT NULL,
  order_type ENUM('regular_order', 'manual_order', 'local_market') DEFAULT 'manual_order',
  sender_name VARCHAR(150) NULL,
  payment_method VARCHAR(50) NULL,
  sender_phone VARCHAR(30) NULL,
  transaction_id VARCHAR(120) NULL,
  screenshot_path VARCHAR(255) NULL,
  notes TEXT NULL,
  amount DECIMAL(10,2) NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  verified_by INT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_order (order_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add columns if missing (MySQL <8 has no IF NOT EXISTS for columns, so guard with information_schema)
-- verified_by
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_proofs' AND COLUMN_NAME = 'verified_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE payment_proofs ADD COLUMN verified_by INT NULL AFTER status, ADD COLUMN verified_at TIMESTAMP NULL AFTER verified_by, ADD FOREIGN KEY (verified_by) REFERENCES users(id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Manual Orders table (PSM-created orders only)
CREATE TABLE IF NOT EXISTS manual_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE,
  created_by_agent_id INT NOT NULL,
  pickup_site_id INT NULL,
  buyer_name VARCHAR(150) NOT NULL,
  buyer_phone VARCHAR(30) NOT NULL,
  buyer_email VARCHAR(150) NULL,
  buyer_national_id VARCHAR(50) NULL,
  delivery_details JSON NULL,
  items JSON NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_proof_url VARCHAR(255) NULL,
  payment_proof_id INT NULL,
  receipt_pdf_path VARCHAR(255) NULL,
  status ENUM('created','ready_for_print','printed') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent (created_by_agent_id),
  INDEX idx_site (pickup_site_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (created_by_agent_id) REFERENCES agents(id),
  FOREIGN KEY (pickup_site_id) REFERENCES pickup_sites(id),
  FOREIGN KEY (payment_proof_id) REFERENCES payment_proofs(id)
);

-- 3) PSM Commissions table (earnings only for manual/assisted orders)
CREATE TABLE IF NOT EXISTS psm_commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  pickup_site_id INT NULL,
  order_id INT NOT NULL,
  order_type ENUM('manual','regular') DEFAULT 'manual',
  commission_type ENUM('assisted_purchase','storage_only') DEFAULT 'assisted_purchase',
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  order_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('pending','ready','paid','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent (agent_id),
  INDEX idx_site (pickup_site_id),
  INDEX idx_order (order_id),
  INDEX idx_status (status),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (pickup_site_id) REFERENCES pickup_sites(id)
);

-- 4) Ensure pickup_sites exists (if schema not applied earlier)
CREATE TABLE IF NOT EXISTS pickup_sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Rwanda',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  operating_hours JSON,
  capacity INT DEFAULT 100,
  current_load INT DEFAULT 0,
  manager_user_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active),
  INDEX idx_manager (manager_user_id),
  INDEX idx_city (city),
  FOREIGN KEY (manager_user_id) REFERENCES users(id)
);