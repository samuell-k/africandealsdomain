const pool = require('./db');

async function testBuyerOrdersAPI() {
  try {
    console.log('=== TESTING BUYER ORDERS API ===\n');
    
    // Test for buyer with user_id = 3
    const buyerId = 3;
    console.log(`--- Testing Buyer: user_id ${buyerId} ---`);
    
    // Check orders for this buyer (same query as in orders.js)
    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.tracking_status,
        o.agent_id,
        o.delivery_code,
        o.created_at,
        o.updated_at,
        o.shipping_address,
        o.billing_address,
        o.payment_method,
        o.tracking_number,
        o.estimated_delivery,
        o.delivered_at,
        o.pickup_location,
        o.delivery_location,
        a.first_name as agent_first_name,
        a.last_name as agent_last_name,
        a.phone as agent_phone,
        a.status as agent_status,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [buyerId]);

    console.log(`📦 Orders found for buyer ${buyerId}: ${orders.length}`);
    orders.forEach(order => {
      const agentName = order.agent_first_name && order.agent_last_name 
        ? `${order.agent_first_name} ${order.agent_last_name}` 
        : 'No agent assigned';
      console.log(`   Order ${order.id}: ${order.order_number || 'No order number'}, status=${order.status}, tracking=${order.tracking_status}, agent=${agentName}, amount=$${order.total_amount}`);
    });
    
    // Check if there are any order_items for these orders
    console.log('\n=== CHECKING ORDER ITEMS ===');
    const [allOrderItems] = await pool.query(`
      SELECT oi.order_id, COUNT(*) as item_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = ?
      GROUP BY oi.order_id
    `, [buyerId]);
    
    console.log(`📋 Order items found: ${allOrderItems.length} orders have items`);
    allOrderItems.forEach(item => {
      console.log(`   Order ${item.order_id}: ${item.item_count} items`);
    });
    
    // Check user details
    console.log('\n=== CHECKING USER DETAILS ===');
    const [userDetails] = await pool.query(`
      SELECT id, username, name, email, role, is_active
      FROM users 
      WHERE id = ?
    `, [buyerId]);
    
    if (userDetails.length > 0) {
      const user = userDetails[0];
      console.log(`👤 User ${user.id}: ${user.username || user.name || user.email}, role=${user.role}, active=${user.is_active}`);
    } else {
      console.log(`❌ User ${buyerId} not found`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBuyerOrdersAPI();