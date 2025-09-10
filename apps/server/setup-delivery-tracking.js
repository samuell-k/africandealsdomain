const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDeliveryTracking() {
  console.log('🚀 Setting up Agent ↔ Buyer Delivery Tracking System...');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333,
    multipleStatements: true
  };

  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');

    // 1. Update orders table to support delivery tracking
    console.log('📋 Updating orders table for delivery tracking...');
    
    // Add new columns to orders table
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
        await connection.execute(`ALTER TABLE orders ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding column: ${error.message}`);
        }
      }
    }

    // Add indexes for performance
    try {
      await connection.execute('ALTER TABLE orders ADD INDEX idx_agent_id (agent_id)');
      await connection.execute('ALTER TABLE orders ADD INDEX idx_seller_id (seller_id)');
      await connection.execute('ALTER TABLE orders ADD INDEX idx_tracking_status (tracking_status)');
      await connection.execute('ALTER TABLE orders ADD INDEX idx_delivery_code (delivery_code)');
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) {
        console.warn(`⚠️ Warning adding index: ${error.message}`);
      }
    }

    // 2. Create/Update agents table with tracking capabilities
    console.log('👥 Setting up agents table...');
    
    await connection.execute(`
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
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_status (status),
        INDEX idx_location (current_lat, current_lng),
        INDEX idx_active (is_active)
      )
    `);

    // 3. Create agent_reviews table
    console.log('⭐ Creating agent reviews table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        buyer_id INT NOT NULL,
        order_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        UNIQUE KEY unique_review (order_id, buyer_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_rating (rating)
      )
    `);

    // 4. Create messages table for agent-buyer communication
    console.log('💬 Setting up messaging system...');
    
    await connection.execute(`
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
        
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_created (created_at)
      )
    `);

    // 5. Create order tracking history table
    console.log('📍 Creating order tracking history...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_tracking_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        agent_id INT NULL,
        status ENUM('pending', 'assigned', 'picked_up', 'en_route', 'arriving', 'delivered', 'cancelled') NOT NULL,
        location_lat DECIMAL(10, 8) NULL,
        location_lng DECIMAL(11, 8) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      )
    `);

    // 6. Create agent earnings table
    console.log('💰 Setting up agent earnings tracking...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_earnings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        order_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        earnings_type ENUM('delivery_fee', 'commission', 'bonus', 'tip') DEFAULT 'delivery_fee',
        status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_agent_id (agent_id),
        INDEX idx_order_id (order_id),
        INDEX idx_status (status)
      )
    `);

    // 7. Insert sample agents if none exist
    console.log('👤 Setting up sample agents...');
    
    const [existingAgents] = await connection.execute('SELECT COUNT(*) as count FROM agents');
    
    if (existingAgents[0].count === 0) {
      // First, ensure we have users with agent role
      const [agentUsers] = await connection.execute('SELECT id FROM users WHERE role = "agent" LIMIT 3');
      
      if (agentUsers.length === 0) {
        console.log('Creating sample agent users...');
        await connection.execute(`
          INSERT INTO users (name, email, password, role, phone, created_at) VALUES
          ('Agent John Doe', 'agent1@example.com', '$2b$10$test', 'agent', '+254700123456', NOW()),
          ('Agent Jane Smith', 'agent2@example.com', '$2b$10$test', 'agent', '+254700123457', NOW()),
          ('Agent Mike Wilson', 'agent3@example.com', '$2b$10$test', 'agent', '+254700123458', NOW())
        `);
        
        const [newAgentUsers] = await connection.execute('SELECT id FROM users WHERE role = "agent" ORDER BY id DESC LIMIT 3');
        
        // Insert sample agents
        await connection.execute(`
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
        await connection.execute(`
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
    console.log('📦 Updating existing orders with tracking data...');
    
    const [orders] = await connection.execute('SELECT id FROM orders LIMIT 5');
    const [agents] = await connection.execute('SELECT id FROM agents LIMIT 3');
    
    if (orders.length > 0 && agents.length > 0) {
      for (let i = 0; i < Math.min(orders.length, 3); i++) {
        const orderId = orders[i].id;
        const agentId = agents[i % agents.length].id;
        const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        await connection.execute(`
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
        await connection.execute(`
          INSERT INTO order_tracking_history (order_id, agent_id, status, location_lat, location_lng, notes)
          VALUES (?, ?, 'assigned', -1.2921, 36.8219, 'Order assigned to agent')
        `, [orderId, agentId]);
      }
    }

    console.log('✅ Database setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Orders table updated with delivery tracking fields');
    console.log('   - Agents table created with location tracking');
    console.log('   - Agent reviews system ready');
    console.log('   - Delivery messaging system ready');
    console.log('   - Order tracking history enabled');
    console.log('   - Agent earnings tracking ready');
    console.log('   - Sample data inserted');
    
    // Display sample data
    const [agentCount] = await connection.execute('SELECT COUNT(*) as count FROM agents');
    const [orderCount] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE agent_id IS NOT NULL');
    
    console.log(`\n📈 Current Data:`);
    console.log(`   - Agents: ${agentCount[0].count}`);
    console.log(`   - Orders with agents: ${orderCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the setup
setupDeliveryTracking();