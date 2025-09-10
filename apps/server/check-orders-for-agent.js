const pool = require('./db');

async function checkOrdersForAgent() {
  try {
    console.log('Checking orders available for fast delivery agents...\n');

    // Check all orders
    const [allOrders] = await pool.query(`
      SELECT id, order_number, status, delivery_type, agent_id, total_amount, created_at
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('Recent orders:');
    allOrders.forEach(order => {
      console.log(`  ${order.order_number}: ${order.status}, delivery_type: ${order.delivery_type || 'NULL'}, agent_id: ${order.agent_id || 'NULL'}, $${order.total_amount}`);
    });

    // Check orders that should be available for fast delivery
    const [availableOrders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id IS NULL 
      AND o.status IN ('pending', 'confirmed')
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    console.log('\nOrders available for assignment (no delivery_type filter):');
    availableOrders.forEach(order => {
      console.log(`  ${order.order_number}: ${order.status}, delivery_type: ${order.delivery_type || 'NULL'}, buyer: ${order.buyer_name}, $${order.total_amount}`);
    });

    // Check orders specifically for fast delivery
    const [fastDeliveryOrders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id IS NULL 
      AND o.status IN ('pending', 'confirmed')
      AND o.delivery_type = 'fast_delivery'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    console.log('\nOrders available for fast delivery:');
    if (fastDeliveryOrders.length === 0) {
      console.log('  No fast delivery orders found');
      
      // Update some orders to be fast delivery
      console.log('\nUpdating some orders to fast_delivery type...');
      const [updateResult] = await pool.query(`
        UPDATE orders 
        SET delivery_type = 'fast_delivery' 
        WHERE agent_id IS NULL 
        AND status IN ('pending', 'confirmed')
        AND (delivery_type IS NULL OR delivery_type = 'standard')
        LIMIT 5
      `);
      
      console.log(`✅ Updated ${updateResult.affectedRows} orders to fast_delivery type`);
      
      // Check again
      const [updatedOrders] = await pool.query(`
        SELECT 
          o.*,
          u.username as buyer_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.agent_id IS NULL 
        AND o.status IN ('pending', 'confirmed')
        AND o.delivery_type = 'fast_delivery'
        ORDER BY o.created_at DESC
        LIMIT 5
      `);
      
      console.log('\nUpdated fast delivery orders:');
      updatedOrders.forEach(order => {
        console.log(`  ${order.order_number}: ${order.status}, buyer: ${order.buyer_name}, $${order.total_amount}`);
      });
      
    } else {
      fastDeliveryOrders.forEach(order => {
        console.log(`  ${order.order_number}: ${order.status}, buyer: ${order.buyer_name}, $${order.total_amount}`);
      });
    }

    console.log('\n✅ Order check completed!');

  } catch (error) {
    console.error('❌ Error checking orders:', error);
  } finally {
    process.exit(0);
  }
}

checkOrdersForAgent();