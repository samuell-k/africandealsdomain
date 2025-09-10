const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAgentsTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Connected to database');

    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop and recreate agents table
    await connection.execute('DROP TABLE IF EXISTS agents');
    console.log('🗑️ Dropped existing agents table');
    
    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    await connection.execute(`
      CREATE TABLE agents (
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
      )
    `);
    console.log('✅ Created agents table with correct structure');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createAgentsTable();