/**
 * Setup Wallet Withdrawals Table
 */

const pool = require('./db');

async function setupWalletWithdrawalsTable() {
  try {
    console.log('🔧 Setting up wallet withdrawals table...');
    
    // Create wallet_withdrawals table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS wallet_withdrawals (
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
    
    console.log('✅ wallet_withdrawals table created/verified');
    
    console.log('\n🎉 Wallet withdrawals setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up wallet withdrawals:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  setupWalletWithdrawalsTable().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = setupWalletWithdrawalsTable;