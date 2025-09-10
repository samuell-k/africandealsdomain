const mysql = require('mysql2/promise');
require('dotenv').config();

async function createSimpleAgentsTable() {
  console.log('🗄️  Creating Simple Agents Table for Registration...\n');

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

    // Create simple agents table that matches registration endpoint
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        agent_type ENUM('fast_delivery', 'pickup_delivery', 'pickup_site') NOT NULL,
        marketplace_type ENUM('grocery', 'physical', 'both') DEFAULT 'both',
        is_available BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        current_lat DECIMAL(10, 8),
        current_lng DECIMAL(11, 8),
        trust_level DECIMAL(3,2) DEFAULT 0.00,
        can_create_orders BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_agent_type (agent_type),
        INDEX idx_is_available (is_available),
        INDEX idx_is_verified (is_verified)
      )
    `);
    console.log('✅ Created simple agents table');

    // Create system_logs table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_type VARCHAR(50) NOT NULL,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_log_type (log_type),
        INDEX idx_user_id (user_id),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ Created system_logs table');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    SETUP COMPLETE                         ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Simple agents table created successfully');
    console.log('✅ System logs table created successfully');
    console.log('✅ Agent registration endpoint should now work');

  } catch (error) {
    console.error('💥 Error creating tables:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

createSimpleAgentsTable();