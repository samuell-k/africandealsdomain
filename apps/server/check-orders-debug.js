const pool = require('./db');

async function checkOrders() {
  try {
    console.log('=== CHECKING ORDERS TABLE ===');
    const [orders] = await pool.query('SELECT id, user_id, agent_id, status, tracking_status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10');
    console.log('Orders found:', orders.length);
    orders.forEach(order => {
      console.log(`Order ${order.id}: user_id=${order.user_id}, agent_id=${order.agent_id}, status=${order.status}, tracking_status=${order.tracking_status}, amount=${order.total_amount}`);
    });
    
    console.log('\n=== CHECKING USERS TABLE ===');
    const [users] = await pool.query('SELECT id, username, role FROM users WHERE role IN ("buyer", "agent") ORDER BY id');
    console.log('Users found:', users.length);
    users.forEach(user => {
      console.log(`User ${user.id}: ${user.username} (${user.role})`);
    });
    
    console.log('\n=== CHECKING AGENTS TABLE ===');
    const [agents] = await pool.query('SELECT user_id, status, first_name, last_name FROM agents');
    console.log('Agents found:', agents.length);
    agents.forEach(agent => {
      console.log(`Agent user_id=${agent.user_id}: ${agent.first_name} ${agent.last_name} (${agent.status})`);
    });
    
    console.log('\n=== CHECKING CLAIMABLE ORDERS FOR AGENTS ===');
    const [claimableOrders] = await pool.query(`
      SELECT 
        o.id, o.user_id, o.agent_id, o.status, o.tracking_status, o.total_amount
      FROM orders o
      WHERE o.status IN ('pending', 'confirmed', 'processing')
        AND (o.agent_id IS NULL OR o.agent_id = 0)
      ORDER BY o.created_at ASC
      LIMIT 10
    `);
    console.log('Claimable orders found:', claimableOrders.length);
    claimableOrders.forEach(order => {
      console.log(`Claimable Order ${order.id}: user_id=${order.user_id}, agent_id=${order.agent_id}, status=${order.status}`);
    });
    
    console.log('\n=== CHECKING AGENT ORDERS (user_id=3) ===');
    const [agentOrders] = await pool.query(`
      SELECT 
        o.id, o.user_id, o.agent_id, o.status, o.tracking_status, o.total_amount
      FROM orders o
      WHERE o.agent_id = 3
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    console.log('Agent orders found:', agentOrders.length);
    agentOrders.forEach(order => {
      console.log(`Agent Order ${order.id}: user_id=${order.user_id}, agent_id=${order.agent_id}, status=${order.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrders();