const mysql = require('mysql2/promise');

async function checkPSMUser() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: Number(process.env.DB_PORT) || 3333
  });

  try {
    console.log('🔍 Checking PSM user data...');
    
    const [agents] = await conn.query(`
      SELECT a.id as agent_id, u.id as user_id, u.username, u.email, u.role
      FROM agents a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.agent_type = 'pickup_site_manager'
    `);
    
    console.log('PSM Agents found:', agents.length);
    agents.forEach(agent => {
      console.log(`- Agent ID: ${agent.agent_id}, User ID: ${agent.user_id}`);
      console.log(`  Username: ${agent.username}`);
      console.log(`  Email: ${agent.email}`);
      console.log(`  Role: ${agent.role}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
  }
}

checkPSMUser();