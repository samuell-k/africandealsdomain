const pool = require('./db');

async function testSQLQueries() {
  try {
    console.log('🧪 Testing SQL queries directly...');
    
    const agentId = 319;
    
    // Test 1: Simple query without joins
    console.log('\n1️⃣ Testing simple orders query...');
    const [simpleOrders] = await pool.query(`
      SELECT * FROM orders WHERE agent_id = ? LIMIT 5
    `, [agentId]);
    console.log('Simple orders result:', simpleOrders.length, 'orders found');
    
    // Test 2: Query with user join only
    console.log('\n2️⃣ Testing orders with user join...');
    const [ordersWithUser] = await pool.query(`
      SELECT o.*, u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id = ?
      LIMIT 5
    `, [agentId]);
    console.log('Orders with user join result:', ordersWithUser.length, 'orders found');
    
    // Test 3: Check if order_items table exists
    console.log('\n3️⃣ Checking order_items table...');
    try {
      const [orderItems] = await pool.query('SELECT COUNT(*) as count FROM order_items LIMIT 1');
      console.log('Order items table exists, count:', orderItems[0].count);
    } catch (error) {
      console.log('Order items table issue:', error.message);
    }
    
    // Test 4: Full query with order_items join
    console.log('\n4️⃣ Testing full query with order_items join...');
    try {
      const [fullQuery] = await pool.query(`
        SELECT o.*, 
               u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
               GROUP_CONCAT(CONCAT(oi.product_name, ' (', oi.quantity, ')') SEPARATOR ', ') as items_summary
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.agent_id = ? 
          AND o.status IN ('ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM', 'READY_FOR_PICKUP')
          AND o.marketplace_type = 'physical'
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `, [agentId]);
      console.log('Full query result:', fullQuery.length, 'orders found');
      if (fullQuery.length > 0) {
        console.log('Sample order:', {
          id: fullQuery[0].id,
          status: fullQuery[0].status,
          buyer_name: fullQuery[0].buyer_name,
          items_summary: fullQuery[0].items_summary
        });
      }
    } catch (error) {
      console.log('Full query error:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSQLQueries();