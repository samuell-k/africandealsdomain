/**
 * Reset Buyer Password for Testing
 * 
 * This script resets the password for the buyer account to a known value
 * so we can proceed with E2E testing.
 */

const pool = require('./db');
const bcrypt = require('bcrypt');

async function resetBuyerPassword() {
  try {
    console.log('🔧 Resetting buyer password for testing...');
    
    const email = 'nyirabakundamarie@gmail.com';
    const newPassword = 'buyer123'; // Simple password for testing
    
    // Check if user exists
    const [users] = await pool.query('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      console.log('❌ Buyer account not found');
      process.exit(1);
    }
    
    const user = users[0];
    console.log('✅ Found buyer account:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    // Hash the new password
    console.log('🔒 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the password in database
    console.log('💾 Updating password in database...');
    const [result] = await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    
    if (result.affectedRows > 0) {
      console.log('✅ Password updated successfully!');
      console.log(`🔑 New password: "${newPassword}"`);
      console.log('🎯 You can now use these credentials for testing:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
      
      // Test the new password immediately
      console.log('\n🧪 Testing new password...');
      const testMatch = await bcrypt.compare(newPassword, hashedPassword);
      if (testMatch) {
        console.log('✅ Password verification successful');
      } else {
        console.log('❌ Password verification failed');
      }
      
    } else {
      console.log('❌ Failed to update password');
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Error resetting password:', error.message);
    process.exit(1);
  }
}

resetBuyerPassword();