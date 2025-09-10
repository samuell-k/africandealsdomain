const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAgentTables() {
  console.log('🗄️  Creating Agent Management Tables...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connection established\n');

    // 1. Agent Types Configuration Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_types_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type_code VARCHAR(50) UNIQUE NOT NULL,
        type_name VARCHAR(100) NOT NULL,
        description TEXT,
        commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        marketplace_type ENUM('grocery', 'physical', 'both') NOT NULL DEFAULT 'both',
        requirements JSON,
        benefits JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created agent_types_config table');

    // 2. Agent Verification Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_verification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        user_id INT NOT NULL,
        verification_status ENUM('pending', 'under_review', 'approved', 'rejected', 'requires_resubmission') DEFAULT 'pending',
        
        -- Personal Information
        date_of_birth DATE,
        gender ENUM('male', 'female', 'other'),
        alt_phone VARCHAR(20),
        emergency_contact VARCHAR(20),
        
        -- Address Information
        street_address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        
        -- ID Information
        id_type ENUM('national_id', 'passport', 'driving_license'),
        id_number VARCHAR(50),
        
        -- Vehicle Information (for delivery agents)
        vehicle_type ENUM('motorcycle', 'bicycle', 'car', 'van', 'truck'),
        license_plate VARCHAR(20),
        
        -- Business Information (for site managers)
        business_name VARCHAR(200),
        business_registration_number VARCHAR(50),
        
        -- Banking Information
        bank_name VARCHAR(100),
        account_number VARCHAR(50),
        account_holder VARCHAR(200),
        mobile_money VARCHAR(20),
        
        -- Document Paths
        profile_photo VARCHAR(255),
        id_front VARCHAR(255),
        id_back VARCHAR(255),
        vehicle_registration VARCHAR(255),
        drivers_license VARCHAR(255),
        business_license VARCHAR(255),
        
        -- Admin Review
        reviewed_by INT,
        reviewed_at TIMESTAMP NULL,
        admin_notes TEXT,
        rejection_reason TEXT,
        
        -- Timestamps
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created agent_verification table');

    // 3. Admin Notifications Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        data JSON,
        is_read BOOLEAN DEFAULT FALSE,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Created admin_notifications table');

    // 4. Agent Performance Metrics Table (enhanced)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_performance_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        metric_date DATE NOT NULL,
        
        -- Order Statistics
        total_orders INT DEFAULT 0,
        completed_orders INT DEFAULT 0,
        cancelled_orders INT DEFAULT 0,
        
        -- Financial Metrics
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        commission_earned DECIMAL(10,2) DEFAULT 0.00,
        bonus_earned DECIMAL(10,2) DEFAULT 0.00,
        
        -- Performance Metrics
        average_delivery_time INT DEFAULT 0, -- in minutes
        customer_rating DECIMAL(3,2) DEFAULT 0.00,
        on_time_delivery_rate DECIMAL(5,2) DEFAULT 0.00,
        
        -- Agent Type Specific Metrics
        agent_type_metrics JSON,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        UNIQUE KEY unique_agent_date (agent_id, metric_date)
      )
    `);
    console.log('✅ Created agent_performance_metrics table');

    // 5. Agent Commission Rules Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_commission_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_type VARCHAR(50) NOT NULL,
        rule_name VARCHAR(100) NOT NULL,
        rule_type ENUM('base_commission', 'performance_bonus', 'volume_bonus', 'special_promotion') NOT NULL,
        
        -- Commission Configuration
        commission_rate DECIMAL(5,2),
        fixed_amount DECIMAL(10,2),
        min_threshold DECIMAL(10,2),
        max_threshold DECIMAL(10,2),
        
        -- Conditions
        conditions JSON,
        
        -- Validity
        valid_from DATE,
        valid_until DATE,
        is_active BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created agent_commission_rules table');

    // 6. Agent Training Requirements Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_training_requirements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_type VARCHAR(50) NOT NULL,
        training_module VARCHAR(100) NOT NULL,
        description TEXT,
        is_mandatory BOOLEAN DEFAULT TRUE,
        estimated_duration INT, -- in minutes
        training_materials JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created agent_training_requirements table');

    // Insert default agent types configuration
    await connection.execute(`
      INSERT IGNORE INTO agent_types_config (
        type_code, type_name, description, commission_rate, marketplace_type, requirements, benefits
      ) VALUES 
      (
        'fast_delivery',
        'Fast Delivery Agent',
        'Deliver groceries and local market items with real-time tracking',
        15.00,
        'grocery',
        JSON_OBJECT(
          'vehicle', true,
          'smartphone', true,
          'gps', true,
          'min_age', 18,
          'documents', JSON_ARRAY('id', 'vehicle_registration', 'drivers_license')
        ),
        JSON_OBJECT(
          'features', JSON_ARRAY('Real-time GPS tracking', '30-120 min deliveries', 'Grocery marketplace'),
          'requirements_text', 'Vehicle, smartphone, GPS'
        )
      ),
      (
        'pickup_delivery',
        'Pickup Delivery Agent',
        'Collect from pickup sites and deliver physical products',
        12.00,
        'physical',
        JSON_OBJECT(
          'vehicle', true,
          'smartphone', true,
          'storage_capacity', true,
          'min_age', 18,
          'documents', JSON_ARRAY('id', 'vehicle_registration', 'drivers_license')
        ),
        JSON_OBJECT(
          'features', JSON_ARRAY('Route optimization', 'Multi-order capacity', 'Physical products'),
          'requirements_text', 'Vehicle, smartphone, storage'
        )
      ),
      (
        'pickup_site',
        'Pickup Site Manager',
        'Manage pickup sites and assist walk-in customers',
        10.00,
        'both',
        JSON_OBJECT(
          'fixed_location', true,
          'customer_service', true,
          'min_age', 21,
          'documents', JSON_ARRAY('id', 'business_license')
        ),
        JSON_OBJECT(
          'features', JSON_ARRAY('Create walk-in orders', 'PDF receipt generation', 'Both marketplaces'),
          'requirements_text', 'Fixed location, customer service'
        )
      )
    `);
    console.log('✅ Inserted default agent types configuration');

    // Insert default commission rules
    await connection.execute(`
      INSERT IGNORE INTO agent_commission_rules (
        agent_type, rule_name, rule_type, commission_rate, conditions, valid_from, valid_until
      ) VALUES 
      ('fast_delivery', 'Base Commission', 'base_commission', 15.00, JSON_OBJECT('min_order_value', 10), '2024-01-01', '2024-12-31'),
      ('pickup_delivery', 'Base Commission', 'base_commission', 12.00, JSON_OBJECT('min_order_value', 20), '2024-01-01', '2024-12-31'),
      ('pickup_site', 'Base Commission', 'base_commission', 10.00, JSON_OBJECT('min_order_value', 15), '2024-01-01', '2024-12-31'),
      ('fast_delivery', 'High Performance Bonus', 'performance_bonus', 2.00, JSON_OBJECT('min_rating', 4.5, 'min_orders_per_day', 10), '2024-01-01', '2024-12-31'),
      ('pickup_delivery', 'Volume Bonus', 'volume_bonus', 1.50, JSON_OBJECT('min_orders_per_week', 50), '2024-01-01', '2024-12-31')
    `);
    console.log('✅ Inserted default commission rules');

    // Insert training requirements
    await connection.execute(`
      INSERT IGNORE INTO agent_training_requirements (
        agent_type, training_module, description, is_mandatory, estimated_duration, training_materials
      ) VALUES 
      ('fast_delivery', 'GPS Navigation & Route Optimization', 'Learn to use GPS effectively and optimize delivery routes', true, 45, JSON_OBJECT('video_url', '', 'documents', JSON_ARRAY())),
      ('fast_delivery', 'Customer Service Excellence', 'Best practices for customer interaction during deliveries', true, 30, JSON_OBJECT('video_url', '', 'documents', JSON_ARRAY())),
      ('pickup_delivery', 'Package Handling & Safety', 'Proper handling of packages and safety protocols', true, 60, JSON_OBJECT('video_url', '', 'documents', JSON_ARRAY())),
      ('pickup_site', 'Point of Sale System', 'How to use the POS system for walk-in orders', true, 90, JSON_OBJECT('video_url', '', 'documents', JSON_ARRAY())),
      ('pickup_site', 'Inventory Management', 'Managing pickup site inventory and customer orders', true, 75, JSON_OBJECT('video_url', '', 'documents', JSON_ARRAY()))
    `);
    console.log('✅ Inserted training requirements');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    SETUP COMPLETE                         ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ All agent management tables created successfully');
    console.log('✅ Default configurations inserted');
    console.log('✅ System ready for agent registration and admin management');
    console.log('\n📋 Created Tables:');
    console.log('   • agent_types_config - Agent type configurations');
    console.log('   • agent_verification - Verification documents and status');
    console.log('   • admin_notifications - Admin notification system');
    console.log('   • agent_performance_metrics - Performance tracking');
    console.log('   • agent_commission_rules - Commission management');
    console.log('   • agent_training_requirements - Training modules');

  } catch (error) {
    console.error('💥 Error creating tables:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

createAgentTables();