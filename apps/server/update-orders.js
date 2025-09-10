const pool = require('./db');

async function updateOrders() {
  try {
    await pool.query('UPDATE orders SET agent_id = 319 WHERE id IN (201, 202, 203)');
    console.log('✅ Orders updated to use agent ID 319');
    
    const [orders] = await pool.query('SELECT id, agent_id, status FROM orders WHERE agent_id = 319');
    console.log('Orders for agent 319:', orders);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateOrders();