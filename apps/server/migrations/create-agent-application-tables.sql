-- Agent Applications System Database Schema
-- This script creates all necessary tables for the agent registration and management system

-- 1. Agent Types Configuration Table
CREATE TABLE IF NOT EXISTS agent_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_code VARCHAR(50) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    requirements JSON,
    benefits JSON,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Agent Applications Table
CREATE TABLE IF NOT EXISTS agent_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    application_ref VARCHAR(50) UNIQUE NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    status ENUM('pending', 'under_review', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    
    -- Address Information
    street_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Location Coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Bank Information
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_holder VARCHAR(100),
    routing_number VARCHAR(50),
    
    -- Agent-Specific Fields
    delivery_radius INT, -- in kilometers
    max_orders_per_day INT,
    pickup_zone VARCHAR(100),
    delivery_zone VARCHAR(100),
    transport_capacity VARCHAR(50),
    max_orders_per_trip INT,
    site_name VARCHAR(100),
    opening_hours TIME,
    closing_hours TIME,
    operating_days VARCHAR(100), -- comma-separated days
    
    -- Vehicle Information
    has_vehicle BOOLEAN DEFAULT FALSE,
    vehicle_type VARCHAR(50),
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_year YEAR,
    vehicle_plate VARCHAR(20),
    vehicle_color VARCHAR(30),
    
    -- Review Information
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_application_ref (application_ref),
    INDEX idx_status (status),
    INDEX idx_agent_type (agent_type),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);

-- 3. Agent Application Documents Table
CREATE TABLE IF NOT EXISTS agent_application_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id INT NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- profile_photo, id_document_front, id_document_back, etc.
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (application_id) REFERENCES agent_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_application_id (application_id),
    INDEX idx_document_type (document_type),
    INDEX idx_is_verified (is_verified)
);

-- 4. Admin Notifications Table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(50) NOT NULL, -- agent_application, payment_issue, etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSON, -- additional data for the notification
    status ENUM('unread', 'read', 'archived') DEFAULT 'unread',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_by INT,
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at)
);

-- 5. Agent Application Status History Table
CREATE TABLE IF NOT EXISTS agent_application_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT,
    change_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (application_id) REFERENCES agent_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_application_id (application_id),
    INDEX idx_new_status (new_status),
    INDEX idx_created_at (created_at)
);

-- 6. Agent Performance Metrics Table (for approved agents)
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    metric_date DATE NOT NULL,
    orders_completed INT DEFAULT 0,
    orders_cancelled INT DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_distance_km DECIMAL(8,2) DEFAULT 0.00,
    active_hours DECIMAL(5,2) DEFAULT 0.00,
    customer_complaints INT DEFAULT 0,
    late_deliveries INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_agent_date (agent_id, metric_date),
    INDEX idx_metric_date (metric_date),
    INDEX idx_agent_id (agent_id)
);

-- Insert default agent types
INSERT INTO agent_types (type_code, type_name, description, commission_rate, requirements, benefits, display_order) VALUES
('fast_delivery', 'Fast Delivery Agent', 'Deliver groceries and local market items with real-time tracking', 15.00, 
 JSON_OBJECT('documents', JSON_ARRAY('national_id', 'phone_verification'), 'vehicle', 'optional', 'background_check', true),
 JSON_OBJECT('features', JSON_ARRAY('Real-time GPS tracking', '30-120 min deliveries', 'Grocery marketplace'), 'requirements_text', 'National ID, GPS location, phone'),
 1),

('pickup_delivery', 'Transport/Delivery Agent', 'Collect from pickup sites and deliver physical products', 12.00,
 JSON_OBJECT('documents', JSON_ARRAY('national_id', 'drivers_license'), 'vehicle', 'required', 'background_check', true),
 JSON_OBJECT('features', JSON_ARRAY('Route optimization', 'Multi-order capacity', 'Physical products'), 'requirements_text', 'National ID, GPS location, phone'),
 2),

('pickup_site_manager', 'Pickup Site Manager', 'Manage pickup locations and coordinate order handovers', 10.00,
 JSON_OBJECT('documents', JSON_ARRAY('national_id', 'business_license'), 'vehicle', 'not_required', 'background_check', true),
 JSON_OBJECT('features', JSON_ARRAY('Fixed location management', 'Regular working hours', 'Team coordination'), 'requirements_text', 'National ID, business location, phone'),
 3);

-- Create indexes for better performance
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_email ON users(email);

-- Add agent-specific columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) AFTER role,
ADD COLUMN IF NOT EXISTS agent_status ENUM('pending', 'active', 'suspended', 'inactive') DEFAULT 'pending' AFTER agent_type,
ADD COLUMN IF NOT EXISTS application_id INT AFTER agent_status,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER application_id,
ADD COLUMN IF NOT EXISTS approved_by INT AFTER approved_at;

-- Add foreign key constraints for agent-specific columns
ALTER TABLE users 
ADD CONSTRAINT fk_users_application_id FOREIGN KEY (application_id) REFERENCES agent_applications(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_users_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create view for agent application summary
CREATE OR REPLACE VIEW agent_application_summary AS
SELECT 
    aa.id,
    aa.application_ref,
    aa.agent_type,
    aa.status,
    aa.first_name,
    aa.last_name,
    aa.email,
    aa.phone,
    aa.city,
    aa.state,
    aa.country,
    aa.created_at,
    aa.updated_at,
    aa.reviewed_at,
    CONCAT(reviewer.name) as reviewed_by_name,
    COUNT(aad.id) as document_count,
    SUM(CASE WHEN aad.is_verified = 1 THEN 1 ELSE 0 END) as verified_documents
FROM agent_applications aa
LEFT JOIN users reviewer ON aa.reviewed_by = reviewer.id
LEFT JOIN agent_application_documents aad ON aa.id = aad.application_id
GROUP BY aa.id, aa.application_ref, aa.agent_type, aa.status, aa.first_name, aa.last_name, 
         aa.email, aa.phone, aa.city, aa.state, aa.country, aa.created_at, aa.updated_at, 
         aa.reviewed_at, reviewer.name;

-- Create triggers for status history tracking
DELIMITER //

CREATE TRIGGER agent_application_status_change 
AFTER UPDATE ON agent_applications
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO agent_application_status_history 
        (application_id, old_status, new_status, changed_by, change_reason, created_at)
        VALUES 
        (NEW.id, OLD.status, NEW.status, NEW.reviewed_by, 'Status updated', NOW());
    END IF;
END//

DELIMITER ;

-- Create procedure for approving agent applications
DELIMITER //

CREATE PROCEDURE ApproveAgentApplication(
    IN p_application_id INT,
    IN p_approved_by INT,
    IN p_notes TEXT
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_agent_type VARCHAR(50);
    DECLARE v_email VARCHAR(255);
    DECLARE v_first_name VARCHAR(100);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get application details
    SELECT user_id, agent_type, email, first_name 
    INTO v_user_id, v_agent_type, v_email, v_first_name
    FROM agent_applications 
    WHERE id = p_application_id AND status = 'pending';
    
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found or already processed';
    END IF;
    
    -- Update application status
    UPDATE agent_applications 
    SET status = 'approved',
        reviewed_by = p_approved_by,
        reviewed_at = NOW(),
        review_notes = p_notes
    WHERE id = p_application_id;
    
    -- Update user status and role
    UPDATE users 
    SET status = 'active',
        agent_type = v_agent_type,
        agent_status = 'active',
        application_id = p_application_id,
        approved_at = NOW(),
        approved_by = p_approved_by
    WHERE id = v_user_id;
    
    -- Create agent-specific record based on type
    IF v_agent_type = 'pickup_delivery' THEN
        INSERT INTO pickup_delivery_agents (user_id, is_available, created_at)
        VALUES (v_user_id, TRUE, NOW())
        ON DUPLICATE KEY UPDATE is_available = TRUE;
    ELSEIF v_agent_type = 'fast_delivery' THEN
        INSERT INTO fast_delivery_agents (user_id, is_available, created_at)
        VALUES (v_user_id, TRUE, NOW())
        ON DUPLICATE KEY UPDATE is_available = TRUE;
    ELSEIF v_agent_type = 'pickup_site_manager' THEN
        INSERT INTO pickup_site_managers (user_id, is_active, created_at)
        VALUES (v_user_id, TRUE, NOW())
        ON DUPLICATE KEY UPDATE is_active = TRUE;
    END IF;
    
    -- Create notification for the applicant
    INSERT INTO admin_notifications (
        type, title, message, data, status, created_at
    ) VALUES (
        'agent_approved',
        'Agent Application Approved',
        CONCAT('Agent application for ', v_first_name, ' has been approved'),
        JSON_OBJECT('applicationId', p_application_id, 'agentType', v_agent_type, 'email', v_email),
        'unread',
        NOW()
    );
    
    COMMIT;
END//

DELIMITER ;

-- Create procedure for rejecting agent applications
DELIMITER //

CREATE PROCEDURE RejectAgentApplication(
    IN p_application_id INT,
    IN p_rejected_by INT,
    IN p_rejection_reason TEXT,
    IN p_notes TEXT
)
BEGIN
    DECLARE v_user_id INT;
    DECLARE v_email VARCHAR(255);
    DECLARE v_first_name VARCHAR(100);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get application details
    SELECT user_id, email, first_name 
    INTO v_user_id, v_email, v_first_name
    FROM agent_applications 
    WHERE id = p_application_id AND status IN ('pending', 'under_review');
    
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found or already processed';
    END IF;
    
    -- Update application status
    UPDATE agent_applications 
    SET status = 'rejected',
        reviewed_by = p_rejected_by,
        reviewed_at = NOW(),
        rejection_reason = p_rejection_reason,
        review_notes = p_notes
    WHERE id = p_application_id;
    
    -- Update user status
    UPDATE users 
    SET status = 'rejected'
    WHERE id = v_user_id;
    
    -- Create notification
    INSERT INTO admin_notifications (
        type, title, message, data, status, created_at
    ) VALUES (
        'agent_rejected',
        'Agent Application Rejected',
        CONCAT('Agent application for ', v_first_name, ' has been rejected'),
        JSON_OBJECT('applicationId', p_application_id, 'email', v_email, 'reason', p_rejection_reason),
        'unread',
        NOW()
    );
    
    COMMIT;
END//

DELIMITER ;