/**
 * Setup Referral Withdrawals Table
 */

const pool = require('./db');

async function setupReferralWithdrawalsTable() {
  try {
    console.log('🔧 Setting up referral withdrawals table...');
    
    // Create referral_withdrawals table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS referral_withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method ENUM('mobile_money', 'bank_transfer') NOT NULL,
        payment_details JSON,
        notes TEXT,
        status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
        admin_notes TEXT,
        processed_by INT,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    console.log('✅ referral_withdrawals table created/verified');
    
    // Ensure admin_notifications table exists (if not already created)
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
    
    // Ensure agent_earnings table exists with referral support
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS agent_earnings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          agent_id INT NOT NULL,
          order_id INT,
          amount DECIMAL(12,2) NOT NULL,
          earnings_type ENUM('delivery', 'pickup_site_management', 'fast_delivery', 'referral') DEFAULT 'delivery',
          status ENUM('pending', 'paid') DEFAULT 'pending',
          paid_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_agent_id (agent_id),
          INDEX idx_order_id (order_id),
          INDEX idx_status (status),
          INDEX idx_earnings_type (earnings_type),
          FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ agent_earnings table created/verified');
    } catch (error) {
      // Table might already exist, try to add referral support
      try {
        await pool.execute(`
          ALTER TABLE agent_earnings 
          MODIFY COLUMN earnings_type ENUM('delivery', 'pickup_site_management', 'fast_delivery', 'referral') DEFAULT 'delivery'
        `);
        console.log('✅ agent_earnings table updated with referral support');
      } catch (alterError) {
        console.log('⚠️ agent_earnings table might already have referral support');
      }
    }
    
    console.log('\n🎉 Referral withdrawals setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up referral withdrawals:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  setupReferralWithdrawalsTable().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = setupReferralWithdrawalsTable;