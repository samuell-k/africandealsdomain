const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setupTestData() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: Number(process.env.DB_PORT) || 3333
  });

  try {
    console.log('🔄 Setting up test data...');
    
    // Check if we have PSM agents
    const [agents] = await conn.query("SELECT id FROM agents WHERE agent_type='pickup_site_manager' LIMIT 1");
    
    if (agents.length === 0) {
      console.log('📝 Creating test PSM agent...');
      
      // First create a user
      const hashedPassword = await bcrypt.hash('testpassword', 10);
      const [userResult] = await conn.query(
        `INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['testpsm', 'testpsm@test.com', hashedPassword, 'agent', 'Test', 'PSM', '+250700000001', true]
      );
      
      // Then create the agent
      const [agentResult] = await conn.query(
        `INSERT INTO agents (user_id, agent_type, commission_rate, is_active) 
         VALUES (?, ?, ?, ?)`,
        [userResult.insertId, 'pickup_site_manager', 25.00, true]
      );
      
      console.log('✅ Created PSM agent with ID:', agentResult.insertId);
    } else {
      console.log('✅ PSM agent already exists');
    }
    
    // Check if we have pickup sites
    const [sites] = await conn.query("SELECT id FROM pickup_sites WHERE is_active=TRUE LIMIT 1");
    
    if (sites.length === 0) {
      console.log('📝 Creating test pickup site...');
      
      const [siteResult] = await conn.query(
        `INSERT INTO pickup_sites (name, description, address_line1, city, country, contact_phone, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Test Pickup Site', 'Test site for PSM orders', '123 Test Street', 'Kigali', 'Rwanda', '+250700000002', true]
      );
      
      console.log('✅ Created pickup site with ID:', siteResult.insertId);
    } else {
      console.log('✅ Pickup site already exists');
    }
    
    console.log('🎉 Test data setup completed');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

setupTestData();