/**
 * Setup Agent Withdrawal Tables
 */

const pool = require('./db');

async function setupWithdrawalTables() {
  try {
    console.log('🔧 Setting up agent withdrawal tables...');
    
    // Create agent_withdrawals table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS agent_withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_details JSON,
        notes TEXT,
        status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
        admin_notes TEXT,
        processed_by INT,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_agent_id (agent_id),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `);
    
    console.log('✅ agent_withdrawals table created/verified');
    
    // Create admin_notifications table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at)
      )
    `);
    
    console.log('✅ admin_notifications table created/verified');
    
    // Update orders table to ensure agent_commission column exists
    try {
      await pool.execute(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS agent_commission DECIMAL(10,2) DEFAULT 0
      `);
      console.log('✅ agent_commission column added to orders table');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log('⚠️ agent_commission column might already exist:', error.message);
      }
    }
    
    // Update our test orders to have commission
    await pool.execute(`
      UPDATE orders 
      SET agent_commission = CASE 
        WHEN total_amount > 0 THEN total_amount * 0.10 
        ELSE 1000 
      END 
      WHERE agent_id = 319 AND (agent_commission IS NULL OR agent_commission = 0)
    `);
    
    console.log('✅ Test orders updated with commission');
    
    console.log('\n🎉 Withdrawal tables setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up withdrawal tables:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  setupWithdrawalTables().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = setupWithdrawalTables;