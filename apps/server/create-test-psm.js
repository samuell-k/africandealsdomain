const pool = require('./db');
const bcrypt = require('bcrypt');

async function createTestPSM() {
  try {
    console.log('🔧 Creating test PSM user...');
    
    const email = 'psm.test.new@example.com';
    const password = 'testpsm123';
    const name = 'Test PSM User';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    
    if (existing.length > 0) {
      console.log('❌ User already exists with email:', email);
      
      // Update the password instead
      await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
      console.log('✅ Updated password for existing user');
      
      const [user] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      const userId = user[0].id;
      
      // Check if agent record exists
      const [agentExists] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [userId]);
      
      if (agentExists.length === 0) {
        // Create agent record
        await pool.query(`
          INSERT INTO agents (user_id, agent_type, status, created_at) 
          VALUES (?, 'pickup_site_manager', 'approved', NOW())
        `, [userId]);
        console.log('✅ Created agent record');
      }
      
    } else {
      // Create new user
      const [userResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, created_at) 
        VALUES (?, ?, ?, 'agent', NOW())
      `, [name, email, hashedPassword]);
      
      const userId = userResult.insertId;
      console.log('✅ Created user with ID:', userId);
      
      // Create agent record
      await pool.query(`
        INSERT INTO agents (user_id, agent_type, status, created_at) 
        VALUES (?, 'pickup_site_manager', 'approved', NOW())
      `, [userId]);
      
      console.log('✅ Created agent record');
    }
    
    console.log('🎉 Test PSM user ready!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestPSM();