const pool = require('./db');
const bcrypt = require('bcrypt');

async function checkPSMCredentials() {
  try {
    console.log('🔍 Checking PSM user credentials...');
    
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.password, a.agent_type 
      FROM users u 
      JOIN agents a ON u.id = a.user_id 
      WHERE a.agent_type = 'pickup_site_manager'
    `);
    
    console.log(`Found ${rows.length} PSM users:`);
    
    for (const user of rows) {
      console.log(`\n- Email: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Password Hash: ${user.password.substring(0, 30)}...`);
      
      // Test common passwords
      const testPasswords = ['password123', 'password', '123456', 'test123'];
      
      for (const testPassword of testPasswords) {
        try {
          const isMatch = await bcrypt.compare(testPassword, user.password);
          if (isMatch) {
            console.log(`  ✅ Password matches: ${testPassword}`);
            break;
          }
        } catch (err) {
          console.log(`  ❌ Error testing password ${testPassword}:`, err.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPSMCredentials();