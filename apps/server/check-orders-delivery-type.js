const pool = require('./db');

async function checkOrdersDeliveryType() {
  try {
    console.log('Checking orders delivery types...');
    
    // Check delivery types in orders
    const [deliveryTypes] = await pool.query(`
      SELECT delivery_type, COUNT(*) as count 
      FROM orders 
      GROUP BY delivery_type
    `);
    
    console.log('\nDelivery types in orders:');
    deliveryTypes.forEach(type => {
      console.log(`  ${type.delivery_type || 'NULL'}: ${type.count} orders`);
    });
    
    // Check orders without agent_id
    const [availableOrders] = await pool.query(`
      SELECT id, order_number, delivery_type, status, agent_id, total_amount
      FROM orders 
      WHERE agent_id IS NULL 
      AND status IN ('pending', 'confirmed')
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\nAvailable orders (no agent assigned):');
    availableOrders.forEach(order => {
      console.log(`  Order ${order.id}: ${order.order_number} - ${order.delivery_type || 'NULL'} - ${order.status} - $${order.total_amount}`);
    });
    
    // Update some orders to have fast_delivery type for testing
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
      SELECT id, order_number, delivery_type, status, total_amount
      FROM orders 
      WHERE agent_id IS NULL 
      AND status IN ('pending', 'confirmed')
      AND delivery_type = 'fast_delivery'
      LIMIT 5
    `);
    
    console.log('\nFast delivery orders available:');
    updatedOrders.forEach(order => {
      console.log(`  Order ${order.id}: ${order.order_number} - $${order.total_amount}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrdersDeliveryType();