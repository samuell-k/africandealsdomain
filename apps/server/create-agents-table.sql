-- Enhanced Agents Table for ADD Physical Products Platform
-- This table will replace the existing agent functionality in the users table

CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_code VARCHAR(20) UNIQUE NOT NULL, -- Unique agent identifier like AGT-001
  user_id INT NOT NULL, -- Reference to users table
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  profile_image VARCHAR(255),
  
  -- Agent Details
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  national_id VARCHAR(50),
  passport_number VARCHAR(50),
  
  -- Address Information
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Agent Classification
  agent_type ENUM('delivery', 'pickup', 'both') DEFAULT 'both',
  specialization JSON, -- Array of specializations like ["electronics", "fragile", "heavy"]
  vehicle_type ENUM('motorcycle', 'car', 'van', 'truck', 'bicycle', 'foot') DEFAULT 'motorcycle',
  vehicle_details JSON, -- Vehicle information like make, model, plate number
  
  -- Territory & Coverage
  primary_territory VARCHAR(100),
  secondary_territories JSON, -- Array of secondary territories
  coverage_radius DECIMAL(8,2) DEFAULT 10.0, -- in kilometers
  coverage_areas JSON, -- Specific areas covered
  
  -- Performance Metrics
  total_deliveries INT DEFAULT 0,
  total_pickups INT DEFAULT 0,
  successful_deliveries INT DEFAULT 0,
  failed_deliveries INT DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  total_ratings INT DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  commission_earned DECIMAL(12,2) DEFAULT 0.00,
  bonus_earned DECIMAL(12,2) DEFAULT 0.00,
  
  -- Commission & Payment
  commission_rate DECIMAL(5,2) DEFAULT 15.00, -- Percentage
  bonus_rate DECIMAL(5,2) DEFAULT 5.00, -- Percentage
  payment_method ENUM('bank_transfer', 'mobile_money', 'cash', 'wallet') DEFAULT 'wallet',
  bank_details JSON, -- Bank account information
  mobile_money_details JSON, -- Mobile money details
  
  -- Status & Availability
  status ENUM('active', 'inactive', 'suspended', 'pending_verification', 'on_leave') DEFAULT 'pending_verification',
  verification_status ENUM('unverified', 'pending', 'verified', 'rejected') DEFAULT 'unverified',
  is_available BOOLEAN DEFAULT FALSE,
  availability_schedule JSON, -- Weekly schedule
  current_location JSON, -- Current GPS coordinates
  
  -- Permissions & Capabilities
  permissions JSON, -- Array of permissions like ["deliver", "pickup", "track", "report"]
  can_handle_fragile BOOLEAN DEFAULT FALSE,
  can_handle_heavy_items BOOLEAN DEFAULT FALSE,
  can_handle_refrigerated BOOLEAN DEFAULT FALSE,
  max_weight_capacity DECIMAL(8,2) DEFAULT 50.0, -- in kg
  
  -- Documents & Verification
  id_document_url VARCHAR(255),
  address_proof_url VARCHAR(255),
  vehicle_registration_url VARCHAR(255),
  insurance_document_url VARCHAR(255),
  background_check_status ENUM('pending', 'passed', 'failed') DEFAULT 'pending',
  background_check_date DATE,
  
  -- Communication Preferences
  preferred_language ENUM('en', 'fr', 'sw', 'ha', 'yo', 'rw', 'ar') DEFAULT 'en',
  notification_preferences JSON, -- Email, SMS, push notification settings
  
  -- System Fields
  last_active TIMESTAMP NULL,
  last_location_update TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes
  INDEX idx_agent_code (agent_code),
  INDEX idx_user_id (user_id),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_verification_status (verification_status),
  INDEX idx_agent_type (agent_type),
  INDEX idx_primary_territory (primary_territory),
  INDEX idx_is_available (is_available),
  INDEX idx_created (created_at),
  INDEX idx_last_active (last_active)
);

-- Agent Activity Log Table
CREATE TABLE IF NOT EXISTS agent_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  activity_type ENUM('login', 'logout', 'delivery_start', 'delivery_complete', 'pickup_start', 'pickup_complete', 'location_update', 'status_change', 'earnings_update') NOT NULL,
  description TEXT,
  metadata JSON, -- Additional activity data
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  INDEX idx_agent_id (agent_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_created (created_at)
);

-- Agent Earnings Table
CREATE TABLE IF NOT EXISTS agent_earnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  order_id INT NOT NULL,
  earnings_type ENUM('commission', 'bonus', 'tip', 'penalty') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_agent_id (agent_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- Agent Ratings Table
CREATE TABLE IF NOT EXISTS agent_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rating (order_id, user_id),
  INDEX idx_agent_id (agent_id),
  INDEX idx_order_id (order_id),
  INDEX idx_user_id (user_id),
  INDEX idx_rating (rating),
  INDEX idx_created (created_at)
);

-- Agent Schedule Table
CREATE TABLE IF NOT EXISTS agent_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE KEY unique_schedule (agent_id, day_of_week),
  INDEX idx_agent_id (agent_id),
  INDEX idx_day_of_week (day_of_week),
  INDEX idx_is_available (is_available)
);

-- Agent Territories Table
CREATE TABLE IF NOT EXISTS agent_territories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  countries JSON NOT NULL, -- Array of countries
  cities JSON, -- Array of cities
  postal_codes JSON, -- Array of postal codes
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_active (is_active)
);

-- Insert sample territories
INSERT INTO agent_territories (name, description, countries, cities) VALUES
('East Africa', 'East African countries', '["Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia"]', '["Nairobi", "Kampala", "Dar es Salaam", "Kigali", "Addis Ababa"]'),
('West Africa', 'West African countries', '["Nigeria", "Ghana", "Senegal", "Cote d\'Ivoire"]', '["Lagos", "Accra", "Dakar", "Abidjan"]'),
('South Africa', 'Southern African countries', '["South Africa", "Zimbabwe", "Zambia"]', '["Johannesburg", "Cape Town", "Harare", "Lusaka"]'),
('North Africa', 'North African countries', '["Egypt", "Morocco", "Algeria", "Tunisia"]', '["Cairo", "Casablanca", "Algiers", "Tunis"]');

-- Insert sample agent data
INSERT INTO agents (
  agent_code, user_id, first_name, last_name, email, phone,
  agent_type, primary_territory, status, verification_status,
  commission_rate, bonus_rate, permissions, is_available
) VALUES
('AGT-001', 1, 'John', 'Doe', 'john.doe@example.com', '+254700123456',
 'both', 'East Africa', 'active', 'verified',
 15.00, 5.00, '["deliver", "pickup", "track", "report"]', TRUE),
('AGT-002', 2, 'Jane', 'Smith', 'jane.smith@example.com', '+254700123457',
 'delivery', 'East Africa', 'active', 'verified',
 12.00, 3.00, '["deliver", "track"]', TRUE),
('AGT-003', 3, 'Mike', 'Johnson', 'mike.johnson@example.com', '+254700123458',
 'pickup', 'West Africa', 'active', 'verified',
 18.00, 7.00, '["pickup", "track", "report"]', FALSE);