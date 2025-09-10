const pool = require('./db');

async function checkAgentCredentials() {
  try {
    console.log('Checking fast delivery agents...');
    const [agents] = await pool.query(`
      SELECT u.id, u.email, u.username, a.agent_type, a.status 
      FROM users u 
      LEFT JOIN agents a ON u.id = a.user_id 
      WHERE a.agent_type = 'fast_delivery'
    `);
    
    console.log('Fast delivery agents:', agents);
    
    if (agents.length > 0) {
      console.log('\nTesting login with first agent...');
      const agent = agents[0];
      console.log(`Email: ${agent.email}`);
      console.log('Try these passwords: testpass123, password123, or your actual password');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkAgentCredentials();