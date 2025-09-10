const pool = require('./db');
const bcrypt = require('bcrypt');

async function checkUserCredentials() {
  try {
    console.log('🔍 Checking user credentials...');
    
    // Get the test user
    const [users] = await pool.query(`
      SELECT u.*, a.id as agent_id, a.agent_type
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      WHERE u.email = 'fastdelivery.test@example.com'
    `);
    
    if (users.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const user = users[0];
    console.log('📋 User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Role:', user.role);
    console.log('Agent ID:', user.agent_id);
    console.log('Agent Type:', user.agent_type);
    
    // Test password
    const testPassword = 'testpassword123';
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`\n🔐 Password test for "${testPassword}":`, isValid ? '✅ Valid' : '❌ Invalid');
    
    // Try some common passwords
    const commonPasswords = ['password123', 'test123', 'admin123'];
    for (const pwd of commonPasswords) {
      const valid = await bcrypt.compare(pwd, user.password_hash);
      if (valid) {
        console.log(`✅ Found working password: "${pwd}"`);
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

checkUserCredentials();