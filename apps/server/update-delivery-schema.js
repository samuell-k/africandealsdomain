const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function updateDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_db'
  });

  try {
    console.log('🔄 Updating database schema for delivery confirmation...');

    // Add delivery confirmation columns to orders table
    await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS delivery_confirmation_data JSON
    `);
    console.log('✅ Added delivery confirmation columns to orders table');

    // Create agent_reviews table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agent_reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        agent_id INT NOT NULL,
        buyer_id INT NOT NULL,
        order_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        UNIQUE KEY unique_review (agent_id, buyer_id, order_id)
      )
    `);
    console.log('✅ Created agent_reviews table');

    // Create delivery_issues table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_issues (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        buyer_id INT NOT NULL,
        agent_id INT,
        issue_description TEXT NOT NULL,
        agent_info JSON,
        status ENUM('open', 'investigating', 'resolved', 'closed') DEFAULT 'open',
        reported_at TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP NULL,
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created delivery_issues table');

    // Add rating and review columns to agents table
    await connection.execute(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS total_reviews INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS successful_deliveries INT DEFAULT 0
    `);
    console.log('✅ Added rating columns to agents table');

    // Generate delivery codes for existing shipped orders
    await connection.execute(`
      UPDATE orders 
      SET delivery_code = LPAD(FLOOR(RAND() * 1000000), 6, '0')
      WHERE status = 'shipped' AND delivery_code IS NULL
    `);
    console.log('✅ Generated delivery codes for existing orders');

    console.log('🎉 Database schema updated successfully for delivery confirmation!');
    
  } catch (error) {
    console.error('❌ Database update error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

updateDatabase();