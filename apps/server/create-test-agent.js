const pool = require('./db');
const bcrypt = require('bcrypt');

async function createTestAgent() {
  try {
    console.log('🔧 Creating test Fast Delivery Agent...');
    
    // Check if test agent already exists
    const [existingUsers] = await pool.query(`
      SELECT u.*, a.id as agent_id, a.agent_type
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      WHERE u.email = 'fastdelivery.test@example.com'
    `);
    
    if (existingUsers.length > 0) {
      console.log('✅ Test agent already exists:');
      console.table(existingUsers);
      return;
    }
    
    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    const [userResult] = await pool.query(`
      INSERT INTO users (username, email, password_hash, role, phone, created_at)
      VALUES ('fastdelivery_test', 'fastdelivery.test@example.com', ?, 'agent', '0788123456', NOW())
    `, [hashedPassword]);
    
    const userId = userResult.insertId;
    console.log(`✅ Created test user with ID: ${userId}`);
    
    // Create fast delivery agent
    const [agentResult] = await pool.query(`
      INSERT INTO agents (
        user_id, agent_type, phone, 
        admin_approval_status, is_available, status, created_at
      ) VALUES (?, 'fast_delivery', '0788123456', 'approved', 1, 'available', NOW())
    `, [userId]);
    
    const agentId = agentResult.insertId;
    console.log(`✅ Created test Fast Delivery Agent with ID: ${agentId}`);
    
    // Verify creation
    const [verification] = await pool.query(`
      SELECT u.*, a.id as agent_id, a.agent_type, a.admin_approval_status
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      WHERE u.email = 'fastdelivery.test@example.com'
    `);
    
    console.log('\n📋 Test Agent Created:');
    console.table(verification);
    
    console.log('\n🔑 Login Credentials:');
    console.log('Email: fastdelivery.test@example.com');
    console.log('Password: testpassword123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

createTestAgent();