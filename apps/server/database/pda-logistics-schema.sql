-- Enhanced PDA Logistics Flow Database Schema
-- Implements comprehensive order tracking with dual confirmations, GPS, OTP, and notifications

-- First, enhance the existing orders table with new status options and fields
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS detailed_status ENUM(
  'ORDER_PLACED',
  'PAYMENT_CONFIRMED', 
  'ASSIGNED_TO_PDA',
  'PDA_EN_ROUTE_TO_SELLER',
  'PDA_AT_SELLER',
  'PICKED_FROM_SELLER',
  'EN_ROUTE_TO_PSM',
  'DELIVERED_TO_PSM',
  'READY_FOR_PICKUP',
  'EN_ROUTE_TO_BUYER',
  'DELIVERED_TO_BUYER',
  'COLLECTED_BY_BUYER',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED'
) DEFAULT 'ORDER_PLACED' AFTER status,
ADD COLUMN IF NOT EXISTS delivery_method ENUM('pickup', 'home') DEFAULT 'pickup',
ADD COLUMN IF NOT EXISTS pickup_site_id INT NULL,
ADD COLUMN IF NOT EXISTS delivery_address JSON NULL,
ADD COLUMN IF NOT EXISTS delivery_coordinates JSON NULL,
ADD COLUMN IF NOT EXISTS delivery_distance DECIMAL(8,2) NULL COMMENT 'Distance in kilometers',
ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL,
ADD COLUMN IF NOT EXISTS manual_payment_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manual_payment_approved_by INT NULL,
ADD COLUMN IF NOT EXISTS manual_payment_approved_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS seller_payout_released BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS seller_payout_released_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS pda_commission_released BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pda_commission_released_at TIMESTAMP NULL,
ADD INDEX IF NOT EXISTS idx_detailed_status (detailed_status),
ADD INDEX IF NOT EXISTS idx_delivery_method (delivery_method),
ADD INDEX IF NOT EXISTS idx_pickup_site (pickup_site_id),
ADD FOREIGN KEY IF NOT EXISTS fk_orders_pickup_site (pickup_site_id) REFERENCES pickup_sites(id),
ADD FOREIGN KEY IF NOT EXISTS fk_orders_payment_approver (manual_payment_approved_by) REFERENCES users(id);

-- Create order_status_history table to track all status transitions
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  from_status ENUM(
    'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER',
    'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM',
    'READY_FOR_PICKUP', 'EN_ROUTE_TO_BUYER', 'DELIVERED_TO_BUYER', 
    'COLLECTED_BY_BUYER', 'COMPLETED', 'CANCELLED', 'DISPUTED'
  ) NULL,
  to_status ENUM(
    'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER',
    'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM',
    'READY_FOR_PICKUP', 'EN_ROUTE_TO_BUYER', 'DELIVERED_TO_BUYER', 
    'COLLECTED_BY_BUYER', 'COMPLETED', 'CANCELLED', 'DISPUTED'
  ) NOT NULL,
  changed_by INT NOT NULL,
  change_reason TEXT NULL,
  location_data JSON NULL COMMENT 'GPS coordinates and accuracy at time of change',
  metadata JSON NULL COMMENT 'Additional data like photos, confirmations, etc.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_status (to_status),
  INDEX idx_changed_by (changed_by),
  INDEX idx_created (created_at)
);

-- Create order_confirmations table for dual confirmation system
CREATE TABLE IF NOT EXISTS order_confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  confirmation_type ENUM('SELLER_HANDOVER', 'PSM_DEPOSIT', 'BUYER_DELIVERY', 'BUYER_PICKUP') NOT NULL,
  confirmation_method ENUM('OTP', 'QR_SCAN', 'SIGNATURE', 'PHOTO', 'MANUAL_OVERRIDE') NOT NULL,
  confirmer_role ENUM('seller', 'pda', 'psm', 'buyer', 'admin') NOT NULL,
  confirmer_user_id INT NOT NULL,
  confirmation_data JSON NULL COMMENT 'OTP codes, signatures, photo URLs, etc.',
  gps_coordinates JSON NULL,
  gps_accuracy DECIMAL(10,2) NULL COMMENT 'GPS accuracy in meters',
  within_radius BOOLEAN DEFAULT TRUE,
  manual_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT NULL,
  override_by INT NULL,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmer_user_id) REFERENCES users(id),
  FOREIGN KEY (override_by) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_type (confirmation_type),
  INDEX idx_method (confirmation_method),
  INDEX idx_confirmer (confirmer_user_id),
  INDEX idx_created (created_at)
);

-- Create order_otp_codes table for OTP generation and verification
CREATE TABLE IF NOT EXISTS order_otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  confirmation_type ENUM('SELLER_HANDOVER', 'PSM_DEPOSIT', 'BUYER_DELIVERY', 'BUYER_PICKUP') NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  generated_for_role ENUM('seller', 'pda', 'psm', 'buyer') NOT NULL,
  generated_for_user_id INT NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_by INT NULL,
  used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_for_user_id) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_code (otp_code),
  INDEX idx_type (confirmation_type),
  INDEX idx_expires (expires_at),
  INDEX idx_used (is_used)
);

-- Create order_qr_codes table for QR code generation and tracking
CREATE TABLE IF NOT EXISTS order_qr_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  qr_code_data TEXT NOT NULL COMMENT 'QR code content/payload',
  qr_image_url VARCHAR(255) NULL COMMENT 'Generated QR code image URL',
  qr_type ENUM('ORDER_RECEIPT', 'PICKUP_VERIFICATION', 'DELIVERY_VERIFICATION') DEFAULT 'ORDER_RECEIPT',
  generated_for_role ENUM('seller', 'pda', 'psm', 'buyer', 'system') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  scanned_count INT DEFAULT 0,
  last_scanned_at TIMESTAMP NULL,
  last_scanned_by INT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (last_scanned_by) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_type (qr_type),
  INDEX idx_active (is_active),
  INDEX idx_expires (expires_at)
);

-- Create order_gps_tracking table for real-time location tracking
CREATE TABLE IF NOT EXISTS order_gps_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  tracked_user_id INT NOT NULL COMMENT 'Usually the PDA',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10,2) NULL COMMENT 'GPS accuracy in meters',
  altitude DECIMAL(10,2) NULL,
  speed DECIMAL(8,2) NULL COMMENT 'Speed in km/h',
  heading DECIMAL(6,2) NULL COMMENT 'Direction in degrees',
  status_at_time ENUM(
    'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER',
    'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM',
    'READY_FOR_PICKUP', 'EN_ROUTE_TO_BUYER', 'DELIVERED_TO_BUYER', 
    'COLLECTED_BY_BUYER', 'COMPLETED', 'CANCELLED', 'DISPUTED'
  ) NOT NULL,
  address_estimate TEXT NULL COMMENT 'Reverse geocoded address',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (tracked_user_id) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_user (tracked_user_id),
  INDEX idx_status (status_at_time),
  INDEX idx_location (latitude, longitude),
  INDEX idx_created (created_at)
);

-- Create order_photos table for evidence storage
CREATE TABLE IF NOT EXISTS order_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  photo_url VARCHAR(255) NOT NULL,
  photo_type ENUM(
    'SELLER_HANDOVER_PROOF', 'PSM_DEPOSIT_PROOF', 'BUYER_DELIVERY_PROOF', 
    'PACKAGE_CONDITION', 'DAMAGE_REPORT', 'OTHER'
  ) NOT NULL,
  taken_by INT NOT NULL,
  taken_at_status ENUM(
    'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER',
    'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM',
    'READY_FOR_PICKUP', 'EN_ROUTE_TO_BUYER', 'DELIVERED_TO_BUYER', 
    'COLLECTED_BY_BUYER', 'COMPLETED', 'CANCELLED', 'DISPUTED'
  ) NOT NULL,
  gps_coordinates JSON NULL,
  description TEXT NULL,
  is_evidence BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (taken_by) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_type (photo_type),
  INDEX idx_taken_by (taken_by),
  INDEX idx_status (taken_at_status),
  INDEX idx_created (created_at)
);

-- Create comprehensive notifications table
CREATE TABLE IF NOT EXISTS enhanced_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_role ENUM('buyer', 'seller', 'agent', 'admin', 'psm', 'pda') NOT NULL,
  notification_type ENUM(
    'ORDER_PLACED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'AGENT_ASSIGNED',
    'PICKUP_SCHEDULED', 'EN_ROUTE_TO_SELLER', 'PICKED_FROM_SELLER',
    'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM', 'READY_FOR_PICKUP',
    'EN_ROUTE_TO_BUYER', 'DELIVERED_TO_BUYER', 'ORDER_COMPLETED',
    'PAYOUT_RELEASED', 'COMMISSION_RELEASED', 'EXCEPTION_OCCURRED',
    'ADMIN_ATTENTION_REQUIRED'
  ) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  order_id INT NULL,
  related_user_id INT NULL COMMENT 'Other user involved (e.g., the PDA for a buyer notification)',
  data JSON NULL COMMENT 'Additional structured data',
  channels JSON DEFAULT '["app", "email"]' COMMENT 'Notification channels: app, email, sms, push',
  is_read BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (related_user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_role (user_role),
  INDEX idx_type (notification_type),
  INDEX idx_order (order_id),
  INDEX idx_read (is_read),
  INDEX idx_sent (is_sent),
  INDEX idx_priority (priority),
  INDEX idx_created (created_at)
);

-- Create admin_approvals table for manual payment and payout approvals
CREATE TABLE IF NOT EXISTS admin_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  approval_type ENUM(
    'MANUAL_PAYMENT', 'SELLER_PAYOUT', 'PDA_COMMISSION', 'EXCEPTION_OVERRIDE',
    'GPS_MANUAL_FALLBACK', 'ORDER_CANCELLATION'
  ) NOT NULL,
  order_id INT NOT NULL,
  requested_by INT NOT NULL,
  reviewed_by INT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  request_data JSON NULL COMMENT 'Supporting data for the approval request',
  review_notes TEXT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_type (approval_type),
  INDEX idx_order (order_id),
  INDEX idx_status (status),
  INDEX idx_requested_by (requested_by),
  INDEX idx_created (created_at)
);

-- Create pickup_sites table if it doesn't exist
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
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  operating_hours JSON DEFAULT '{"monday": "08:00-18:00", "tuesday": "08:00-18:00", "wednesday": "08:00-18:00", "thursday": "08:00-18:00", "friday": "08:00-18:00", "saturday": "08:00-16:00", "sunday": "closed"}',
  capacity INT DEFAULT 100 COMMENT 'Maximum packages that can be stored',
  current_load INT DEFAULT 0 COMMENT 'Current number of packages',
  manager_user_id INT NULL COMMENT 'Pickup Site Manager user ID',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_user_id) REFERENCES users(id),
  INDEX idx_location (latitude, longitude),
  INDEX idx_manager (manager_user_id),
  INDEX idx_active (is_active),
  INDEX idx_city (city)
);

-- Create platform_settings for configurable system behavior
CREATE TABLE IF NOT EXISTS pda_platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  category ENUM('gps', 'confirmations', 'payouts', 'timeouts', 'notifications') NOT NULL,
  description TEXT,
  is_configurable BOOLEAN DEFAULT TRUE,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_key (setting_key),
  INDEX idx_category (category)
);

-- Insert default platform settings
INSERT IGNORE INTO pda_platform_settings (setting_key, setting_value, setting_type, category, description) VALUES
('gps_radius_tolerance', '100', 'number', 'gps', 'GPS radius tolerance in meters for location confirmations'),
('otp_expiry_minutes', '30', 'number', 'confirmations', 'OTP code expiry time in minutes'),
('auto_payout_enabled', 'false', 'boolean', 'payouts', 'Whether to automatically release payouts or require admin approval'),
('seller_payout_on_psm_deposit', 'true', 'boolean', 'payouts', 'Release seller payout when item reaches PSM (true) or when buyer collects (false)'),
('pda_commission_on_delivery', 'true', 'boolean', 'payouts', 'Release PDA commission on delivery completion (true) or require manual approval (false)'),
('status_timeout_hours', '24', 'number', 'timeouts', 'Hours to wait before flagging stuck orders'),
('enable_photo_evidence', 'true', 'boolean', 'confirmations', 'Require photo evidence for confirmations'),
('notification_channels', '["app", "email"]', 'json', 'notifications', 'Default notification channels'),
('max_retry_attempts', '3', 'number', 'confirmations', 'Maximum retry attempts for failed confirmations'),
('manual_payment_required', 'true', 'boolean', 'payouts', 'Require manual admin approval for all payment proofs');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_detailed_status_created ON orders(detailed_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_agent_status ON orders(agent_id, detailed_status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_site_status ON orders(pickup_site_id, detailed_status);
CREATE INDEX IF NOT EXISTS idx_confirmations_order_type ON order_confirmations(order_id, confirmation_type);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_order_time ON order_gps_tracking(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read ON enhanced_notifications(user_id, notification_type, is_read);

-- Grant necessary permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON *.* TO 'your_app_user'@'localhost';