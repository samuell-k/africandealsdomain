const mysql = require('mysql2/promise');
require('dotenv').config();

async function createCommissionTables() {
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
    
    // Drop and recreate commission_transactions table
    await connection.execute('DROP TABLE IF EXISTS commission_transactions');
    console.log('🗑️ Dropped existing commission_transactions table');

    await connection.execute(`
      CREATE TABLE commission_transactions (
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
      )
    `);
    console.log('✅ Created commission_transactions table');

    // Drop and recreate agent_earnings table
    await connection.execute('DROP TABLE IF EXISTS agent_earnings');
    console.log('🗑️ Dropped existing agent_earnings table');

    await connection.execute(`
      CREATE TABLE agent_earnings (
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
      )
    `);
    console.log('✅ Created agent_earnings table');

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createCommissionTables();