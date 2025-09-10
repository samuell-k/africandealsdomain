const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/setup/delivery-tracking - Setup delivery tracking tables
router.post('/delivery-tracking', async (req, res) => {
  try {
    console.log('🚀 Setting up delivery tracking tables...');

    // 1. Add delivery tracking columns to orders table
    const orderColumns = [
      'ADD COLUMN IF NOT EXISTS agent_id INT NULL',
      'ADD COLUMN IF NOT EXISTS seller_id INT NULL',
      'ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(6) NULL',
      'ADD COLUMN IF NOT EXISTS tracking_status ENUM("pending", "assigned", "picked_up", "en_route", "arriving", "delivered", "cancelled") DEFAULT "pending"',
      'ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(8,2) DEFAULT 0.00',
      'ADD COLUMN IF NOT EXISTS pickup_location JSON NULL',
      'ADD COLUMN IF NOT EXISTS delivery_location JSON NULL',
      'ADD COLUMN IF NOT EXISTS estimated_pickup_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS actual_pickup_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL',
      'ADD COLUMN IF NOT EXISTS delivery_photo VARCHAR(255) NULL',
      'ADD COLUMN IF NOT EXISTS agent_commission DECIMAL(8,2) DEFAULT 0.00'
    ];

    for (const column of orderColumns) {
      try {
        await pool.query(`ALTER TABLE orders ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding column: ${error.message}`);
        }
      }
    }

    // 2. Create agents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_code VARCHAR(20) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        profile_image VARCHAR(255),
        
        -- Location tracking
        current_lat DECIMAL(10, 8) NULL,
        current_lng DECIMAL(11, 8) NULL,
        last_location_update TIMESTAMP NULL,
        
        -- Status and availability
        status ENUM('available', 'busy', 'offline', 'suspended') DEFAULT 'offline',
        is_active BOOLEAN DEFAULT TRUE,
        rating DECIMAL(3,2) DEFAULT 0.00,
        total_deliveries INT DEFAULT 0,
        successful_deliveries INT DEFAULT 0,
        
        -- Agent details
        vehicle_type ENUM('motorcycle', 'car', 'van', 'bicycle', 'foot') DEFAULT 'motorcycle',
        max_delivery_distance DECIMAL(8,2) DEFAULT 10.0,
        commission_rate DECIMAL(5,2) DEFAULT 15.00,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_location (current_lat, current_lng),
        INDEX idx_active (is_active)
      )
    `);

    // 3. Create agent_reviews table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        buyer_id INT NOT NULL,
        order_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_review (order_id, buyer_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_rating (rating)
      )
    `);

    // 4. Create delivery_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        message_type ENUM('text', 'image', 'location', 'system') DEFAULT 'text',
        is_agent BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_created (created_at)
      )
    `);

    // 5. Create order_tracking_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_tracking_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        agent_id INT NULL,
        status ENUM('pending', 'assigned', 'picked_up', 'en_route', 'arriving', 'delivered', 'cancelled') NOT NULL,
        location_lat DECIMAL(10, 8) NULL,
        location_lng DECIMAL(11, 8) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      )
    `);

    // 6. Create agent_earnings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_earnings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        order_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        earnings_type ENUM('delivery_fee', 'commission', 'bonus', 'tip') DEFAULT 'delivery_fee',
        status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_agent_id (agent_id),
        INDEX idx_order_id (order_id),
        INDEX idx_status (status)
      )
    `);

    // 7. Insert sample agents if none exist
    const [existingAgents] = await pool.query('SELECT COUNT(*) as count FROM agents');
    
    if (existingAgents[0].count === 0) {
      // First, ensure we have users with agent role
      const [agentUsers] = await pool.query('SELECT id FROM users WHERE role = "agent" LIMIT 3');
      
      if (agentUsers.length === 0) {
        console.log('Creating sample agent users...');
        await pool.query(`
          INSERT INTO users (name, email, password, role, phone, created_at) VALUES
          ('Agent John Doe', 'agent1@example.com', '$2b$10$test', 'agent', '+254700123456', NOW()),
          ('Agent Jane Smith', 'agent2@example.com', '$2b$10$test', 'agent', '+254700123457', NOW()),
          ('Agent Mike Wilson', 'agent3@example.com', '$2b$10$test', 'agent', '+254700123458', NOW())
        `);
        
        const [newAgentUsers] = await pool.query('SELECT id FROM users WHERE role = "agent" ORDER BY id DESC LIMIT 3');
        
        // Insert sample agents
        await pool.query(`
          INSERT INTO agents (
            agent_code, user_id, first_name, last_name, email, phone,
            current_lat, current_lng, status, rating, vehicle_type, commission_rate
          ) VALUES
          ('AGT-001', ?, 'John', 'Doe', 'agent1@example.com', '+254700123456',
           -1.2921, 36.8219, 'available', 4.5, 'motorcycle', 15.00),
          ('AGT-002', ?, 'Jane', 'Smith', 'agent2@example.com', '+254700123457',
           -1.2864, 36.8172, 'available', 4.8, 'car', 12.00),
          ('AGT-003', ?, 'Mike', 'Wilson', 'agent3@example.com', '+254700123458',
           -1.2833, 36.8167, 'busy', 4.2, 'motorcycle', 18.00)
        `, [newAgentUsers[2].id, newAgentUsers[1].id, newAgentUsers[0].id]);
      } else {
        // Use existing agent users
        await pool.query(`
          INSERT INTO agents (
            agent_code, user_id, first_name, last_name, email, phone,
            current_lat, current_lng, status, rating, vehicle_type, commission_rate
          ) VALUES
          ('AGT-001', ?, 'John', 'Doe', 'agent1@example.com', '+254700123456',
           -1.2921, 36.8219, 'available', 4.5, 'motorcycle', 15.00),
          ('AGT-002', ?, 'Jane', 'Smith', 'agent2@example.com', '+254700123457',
           -1.2864, 36.8172, 'available', 4.8, 'car', 12.00),
          ('AGT-003', ?, 'Mike', 'Wilson', 'agent3@example.com', '+254700123458',
           -1.2833, 36.8167, 'busy', 4.2, 'motorcycle', 18.00)
        `, [agentUsers[0].id, agentUsers[1] ? agentUsers[1].id : agentUsers[0].id, agentUsers[2] ? agentUsers[2].id : agentUsers[0].id]);
      }
      
      console.log('✅ Sample agents created');
    }

    // 8. Update existing orders with sample tracking data
    const [orders] = await pool.query('SELECT id FROM orders LIMIT 5');
    const [agents] = await pool.query('SELECT id FROM agents LIMIT 3');
    
    if (orders.length > 0 && agents.length > 0) {
      for (let i = 0; i < Math.min(orders.length, 3); i++) {
        const orderId = orders[i].id;
        const agentId = agents[i % agents.length].id;
        const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        await pool.query(`
          UPDATE orders SET 
            agent_id = ?,
            delivery_code = ?,
            tracking_status = 'assigned',
            delivery_fee = 5.00,
            agent_commission = 2.50,
            pickup_location = '{"lat": -1.2921, "lng": 36.8219, "address": "Seller Location, Nairobi"}',
            delivery_location = '{"lat": -1.2864, "lng": 36.8172, "address": "Buyer Location, Nairobi"}'
          WHERE id = ?
        `, [agentId, deliveryCode, orderId]);
        
        // Add tracking history
        await pool.query(`
          INSERT INTO order_tracking_history (order_id, agent_id, status, location_lat, location_lng, notes)
          VALUES (?, ?, 'assigned', -1.2921, 36.8219, 'Order assigned to agent')
        `, [orderId, agentId]);
      }
    }

    // Get summary data
    const [agentCount] = await pool.query('SELECT COUNT(*) as count FROM agents');
    const [orderCount] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE agent_id IS NOT NULL');
    
    res.json({
      success: true,
      message: 'Delivery tracking system setup completed successfully',
      summary: {
        agents_created: agentCount[0].count,
        orders_with_agents: orderCount[0].count,
        tables_created: [
          'agents',
          'agent_reviews', 
          'delivery_messages',
          'order_tracking_history',
          'agent_earnings'
        ],
        orders_table_updated: true
      }
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup delivery tracking system',
      details: error.message
    });
  }
});

// POST /api/setup/location-system - Setup location and map tracking system
router.post('/location-system', async (req, res) => {
  try {
    console.log('🚀 Setting up comprehensive location and map tracking system...');

    // 1. Add location columns to users table
    const userColumns = [
      'ADD COLUMN IF NOT EXISTS home_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS home_lng DECIMAL(11, 8) NULL', 
      'ADD COLUMN IF NOT EXISTS home_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS work_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS work_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS work_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS business_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS business_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS business_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) NULL',
      'ADD COLUMN IF NOT EXISTS custom_locations JSON NULL'
    ];

    for (const column of userColumns) {
      try {
        await pool.query(`ALTER TABLE users ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding user column: ${error.message}`);
        }
      }
    }

    // 2. Add location columns to products table
    const productColumns = [
      'ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS address TEXT NULL'
    ];

    for (const column of productColumns) {
      try {
        await pool.query(`ALTER TABLE products ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding product column: ${error.message}`);
        }
      }
    }

    // 3. Create/update user_locations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role ENUM('buyer', 'seller', 'agent', 'admin') NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        address TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_location (user_id),
        INDEX idx_role (role),
        INDEX idx_location (lat, lng),
        INDEX idx_updated (updated_at)
      )
    `);

    // 4. Create/update order_gps_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_gps_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        agent_id INT NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_location (lat, lng)
      )
    `);

    // 4b. Create/update order_tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT NULL,
        location JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `);

    // 4c. Create/update agents table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        agent_code VARCHAR(20) NULL,
        first_name VARCHAR(100) NULL,
        last_name VARCHAR(100) NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(20) NULL,
        status ENUM('available', 'busy', 'offline') DEFAULT 'offline',
        current_lat DECIMAL(10, 8) NULL,
        current_lng DECIMAL(11, 8) NULL,
        rating DECIMAL(3,2) DEFAULT 5.00,
        total_deliveries INT DEFAULT 0,
        vehicle_type VARCHAR(50) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_active TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_location (current_lat, current_lng),
        INDEX idx_active (is_active)
      )
    `);

    // 5. Create/update delivery_zones table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        geojson JSON NOT NULL,
        base_price DECIMAL(8,2) DEFAULT 5.00,
        price_per_km DECIMAL(8,2) DEFAULT 1.50,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_active (is_active)
      )
    `);

    // 6. Add delivery-related columns to orders table
    const orderColumns = [
      'ADD COLUMN IF NOT EXISTS agent_id INT NULL',
      'ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(10) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(8,2) NULL',
      'ADD COLUMN IF NOT EXISTS agent_commission DECIMAL(8,2) NULL',
      'ADD COLUMN IF NOT EXISTS pickup_location JSON NULL',
      'ADD COLUMN IF NOT EXISTS delivery_location JSON NULL',
      'ADD COLUMN IF NOT EXISTS estimated_pickup_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS pickup_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP NULL'
    ];

    for (const column of orderColumns) {
      try {
        await pool.query(`ALTER TABLE orders ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding order column: ${error.message}`);
        }
      }
    }

    // 7. Insert sample location data for existing users
    console.log('📍 Adding sample location data...');
    
    // Sample locations around Nairobi, Kenya
    const sampleLocations = [
      { lat: -1.2921, lng: 36.8219, address: 'Nairobi CBD, Kenya' },
      { lat: -1.2864, lng: 36.8172, address: 'Westlands, Nairobi, Kenya' },
      { lat: -1.3031, lng: 36.7073, address: 'Karen, Nairobi, Kenya' },
      { lat: -1.2634, lng: 36.8084, address: 'Kilimani, Nairobi, Kenya' },
      { lat: -1.2441, lng: 36.8906, address: 'Eastlands, Nairobi, Kenya' }
    ];

    // Get existing users
    const [users] = await pool.query('SELECT id, role FROM users LIMIT 10');
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const location = sampleLocations[i % sampleLocations.length];
      
      // Add some variation to coordinates
      const lat = location.lat + (Math.random() - 0.5) * 0.01;
      const lng = location.lng + (Math.random() - 0.5) * 0.01;
      
      try {
        // Update user_locations
        await pool.query(
          `INSERT INTO user_locations (user_id, role, lat, lng, address) 
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE lat = ?, lng = ?, address = ?`,
          [user.id, user.role, lat, lng, location.address, lat, lng, location.address]
        );

        // Add home/work locations for buyers
        if (user.role === 'buyer') {
          const homeLat = lat + (Math.random() - 0.5) * 0.005;
          const homeLng = lng + (Math.random() - 0.5) * 0.005;
          const workLat = lat + (Math.random() - 0.5) * 0.005;
          const workLng = lng + (Math.random() - 0.5) * 0.005;
          
          await pool.query(
            'UPDATE users SET home_lat = ?, home_lng = ?, home_address = ?, work_lat = ?, work_lng = ?, work_address = ? WHERE id = ?',
            [homeLat, homeLng, 'Home - ' + location.address, workLat, workLng, 'Work - ' + location.address, user.id]
          );
        }

        // Add business locations for sellers
        if (user.role === 'seller') {
          await pool.query(
            'UPDATE users SET business_lat = ?, business_lng = ?, business_address = ?, business_name = ? WHERE id = ?',
            [lat, lng, 'Business - ' + location.address, `Business ${user.id}`, user.id]
          );
        }
      } catch (error) {
        console.warn(`⚠️ Warning adding location for user ${user.id}: ${error.message}`);
      }
    }

    // 8. Add location data to some products
    const [products] = await pool.query('SELECT id, seller_id FROM products LIMIT 20');
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const location = sampleLocations[i % sampleLocations.length];
      
      // Add some variation
      const lat = location.lat + (Math.random() - 0.5) * 0.01;
      const lng = location.lng + (Math.random() - 0.5) * 0.01;
      
      try {
        await pool.query(
          'UPDATE products SET lat = ?, lng = ?, address = ? WHERE id = ?',
          [lat, lng, 'Product Location - ' + location.address, product.id]
        );
      } catch (error) {
        console.warn(`⚠️ Warning adding location for product ${product.id}: ${error.message}`);
      }
    }

    // Get summary data
    const [userLocationCount] = await pool.query('SELECT COUNT(*) as count FROM user_locations');
    const [productLocationCount] = await pool.query('SELECT COUNT(*) as count FROM products WHERE lat IS NOT NULL');
    const [zoneCount] = await pool.query('SELECT COUNT(*) as count FROM delivery_zones');

    console.log('✅ Location and map tracking system setup completed successfully!');
    
    res.json({
      success: true,
      message: 'Location and map tracking system setup completed successfully',
      summary: {
        user_locations: userLocationCount[0].count,
        product_locations: productLocationCount[0].count,
        delivery_zones: zoneCount[0].count,
        tables_created: [
          'user_locations',
          'order_gps_history', 
          'delivery_zones'
        ],
        tables_updated: [
          'users (added location columns)',
          'products (added location columns)',
          'orders (added delivery columns)'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup location system',
      details: error.message
    });
  }
});

module.exports = router;