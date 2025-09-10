const pool = require('./db');

async function setupReferralTables() {
  try {
    console.log('Setting up referral system tables...');

    // Create referral_links table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_links (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        product_id INT,
        referral_code VARCHAR(255) UNIQUE NOT NULL,
        platform ENUM('whatsapp', 'facebook', 'copy', 'other') DEFAULT 'copy',
        generated_at DATETIME NOT NULL,
        usage_count INT DEFAULT 0,
        last_used_at DATETIME NULL,
        status ENUM('active', 'inactive', 'expired') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_referral_code (referral_code),
        INDEX idx_product_id (product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create referral_purchases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referral_purchases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        referral_link_id INT NOT NULL,
        order_id INT NOT NULL,
        purchase_amount DECIMAL(10,2) NOT NULL,
        commission_amount DECIMAL(10,2) NOT NULL,
        purchased_at DATETIME NOT NULL,
        status ENUM('pending', 'confirmed', 'paid', 'cancelled') DEFAULT 'pending',
        paid_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_referral_link_id (referral_link_id),
        INDEX idx_order_id (order_id),
        INDEX idx_status (status),
        FOREIGN KEY (referral_link_id) REFERENCES referral_links(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add referral_code column to orders table if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN referral_code VARCHAR(255) NULL,
        ADD INDEX idx_referral_code (referral_code)
      `);
      console.log('Added referral_code column to orders table');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') {
        console.log('referral_code column might already exist in orders table');
      }
    }

    // Update commission_transactions table to support referral commissions
    try {
      await pool.query(`
        ALTER TABLE commission_transactions 
        MODIFY COLUMN commission_type ENUM(
          'platform_margin', 
          'system_maintenance', 
          'home_delivery_fee', 
          'fast_delivery_agent', 
          'pickup_site_manager', 
          'pickup_delivery_agent',
          'referral_commission'
        ) NOT NULL
      `);
      console.log('Updated commission_transactions table to support referral commissions');
    } catch (error) {
      console.log('commission_transactions table might already support referral commissions');
    }

    // Update agent_earnings table to support referral earnings
    try {
      await pool.query(`
        ALTER TABLE agent_earnings 
        MODIFY COLUMN earnings_type ENUM(
          'delivery', 
          'pickup_site_management', 
          'fast_delivery',
          'referral'
        ) DEFAULT 'delivery'
      `);
      console.log('Updated agent_earnings table to support referral earnings');
    } catch (error) {
      console.log('agent_earnings table might already support referral earnings');
    }

    console.log('✅ Referral system tables setup completed successfully!');
    
    // Test the tables
    console.log('\n📊 Testing referral tables...');
    
    const [referralLinksCount] = await pool.query('SELECT COUNT(*) as count FROM referral_links');
    const [referralPurchasesCount] = await pool.query('SELECT COUNT(*) as count FROM referral_purchases');
    
    console.log(`📈 Referral Links: ${referralLinksCount[0].count} records`);
    console.log(`💰 Referral Purchases: ${referralPurchasesCount[0].count} records`);
    
  } catch (error) {
    console.error('❌ Error setting up referral tables:', error);
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupReferralTables()
    .then(() => {
      console.log('\n🎉 Referral system setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupReferralTables };