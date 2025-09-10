const pool = require('./db');

async function checkAgent() {
  try {
    const [agents] = await pool.query('SELECT * FROM agents WHERE user_id = 311');
    console.log('Agent for user 311:', agents);
    
    const [orders] = await pool.query('SELECT id, agent_id, status FROM orders WHERE agent_id = 319 LIMIT 5');
    console.log('Orders for agent 319:', orders);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAgent();