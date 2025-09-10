const pool = require('./db');

async function testAgentOrdersAPI() {
  try {
    console.log('=== TESTING AGENT ORDERS API FIX ===\n');
    
    // Test for each agent
    const agents = [
      { user_id: 6, name: 'Your Name' },
      { user_id: 7, name: 'Test Agent' },
      { user_id: 10, name: 'Test Auth' }
    ];
    
    for (const agent of agents) {
      console.log(`--- Testing Agent: ${agent.name} (user_id: ${agent.user_id}) ---`);
      
      // Get agent's ID from agents table
      const [agentInfo] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [agent.user_id]);
      
      if (agentInfo.length === 0) {
        console.log(`❌ Agent profile not found for user_id ${agent.user_id}`);
        continue;
      }
      
      const agentId = agentInfo[0].id;
      console.log(`✅ Agent ID: ${agentId}`);
      
      // Check orders assigned to this agent
      const [orders] = await pool.query(`
        SELECT 
          o.id, o.user_id, o.agent_id, o.status, o.tracking_status, o.total_amount,
          u.username as buyer_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.agent_id = ?
        ORDER BY o.created_at DESC
      `, [agentId]);
      
      console.log(`📦 Orders found: ${orders.length}`);
      orders.forEach(order => {
        console.log(`   Order ${order.id}: buyer=${order.buyer_name || 'Unknown'}, status=${order.status}, amount=$${order.total_amount}`);
      });
      
      // Test analytics
      const [analytics] = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
          SUM(CASE WHEN status = 'delivered' THEN COALESCE(delivery_fee * 0.3, 5.00) ELSE 0 END) as total_earnings
        FROM orders 
        WHERE agent_id = ?
      `, [agentId]);
      
      console.log(`📊 Analytics: Total=${analytics[0].total_orders}, Completed=${analytics[0].completed_orders}, Earnings=$${analytics[0].total_earnings || 0}`);
      console.log('');
    }
    
    console.log('=== TESTING CLAIMABLE ORDERS ===');
    const [claimableOrders] = await pool.query(`
      SELECT 
        o.id, o.user_id, o.status, o.total_amount,
        u.username as buyer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status IN ('pending', 'confirmed', 'processing')
        AND (o.agent_id IS NULL OR o.agent_id = 0)
      ORDER BY o.created_at ASC
    `);
    
    console.log(`🎯 Claimable orders found: ${claimableOrders.length}`);
    claimableOrders.forEach(order => {
      console.log(`   Order ${order.id}: buyer=${order.buyer_name || 'Unknown'}, status=${order.status}, amount=$${order.total_amount}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAgentOrdersAPI();