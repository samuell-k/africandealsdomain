const pool = require('./db');

async function fixOrdersDeliveryType() {
  try {
    console.log('Fixing orders delivery type...\n');

    // Update NULL delivery_type orders to fast_delivery
    const [updateResult1] = await pool.query(`
      UPDATE orders 
      SET delivery_type = 'fast_delivery' 
      WHERE delivery_type IS NULL 
      AND agent_id IS NULL 
      AND status IN ('pending', 'confirmed')
      LIMIT 10
    `);
    
    console.log(`✅ Updated ${updateResult1.affectedRows} orders with NULL delivery_type to fast_delivery`);

    // Update some home_delivery orders to fast_delivery for testing
    const [updateResult2] = await pool.query(`
      UPDATE orders 
      SET delivery_type = 'fast_delivery' 
      WHERE delivery_type = 'home_delivery' 
      AND agent_id IS NULL 
      AND status IN ('pending', 'confirmed')
      LIMIT 5
    `);
    
    console.log(`✅ Updated ${updateResult2.affectedRows} home_delivery orders to fast_delivery`);

    // Check the results
    const [fastDeliveryOrders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.delivery_type,
        o.total_amount,
        o.agent_commission,
        o.platform_commission,
        u.username as buyer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id IS NULL 
      AND o.status IN ('pending', 'confirmed')
      AND o.delivery_type = 'fast_delivery'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    console.log(`\n📋 Fast delivery orders available: ${fastDeliveryOrders.length}`);
    fastDeliveryOrders.forEach(order => {
      console.log(`  ${order.order_number}: $${order.total_amount}, commission: $${order.agent_commission || 'Not calculated'}`);
    });

    // Calculate commissions for orders that don't have them
    console.log('\n💰 Calculating commissions for orders...');
    
    // Get commission settings
    const [commissionSettings] = await pool.query(`
      SELECT * FROM commission_settings WHERE setting_type = 'fast_delivery_agent' LIMIT 1
    `);
    
    const agentCommissionRate = commissionSettings.length > 0 ? 
      parseFloat(commissionSettings[0].commission_rate) : 0.70; // Default 70%

    const [platformSettings] = await pool.query(`
      SELECT * FROM commission_settings WHERE setting_type = 'platform_commission' LIMIT 1
    `);
    
    const platformCommissionRate = platformSettings.length > 0 ? 
      parseFloat(platformSettings[0].commission_rate) : 0.21; // Default 21%

    console.log(`Agent commission rate: ${(agentCommissionRate * 100).toFixed(1)}%`);
    console.log(`Platform commission rate: ${(platformCommissionRate * 100).toFixed(1)}%`);

    // Update orders with calculated commissions
    for (const order of fastDeliveryOrders) {
      if (!order.agent_commission || order.agent_commission === 0) {
        const platformCommission = order.total_amount * platformCommissionRate;
        const agentCommission = platformCommission * agentCommissionRate;
        
        await pool.query(`
          UPDATE orders 
          SET platform_commission = ?, agent_commission = ?
          WHERE id = ?
        `, [platformCommission, agentCommission, order.id]);
        
        console.log(`  Updated ${order.order_number}: platform=$${platformCommission.toFixed(2)}, agent=$${agentCommission.toFixed(2)}`);
      }
    }

    console.log('\n✅ Orders delivery type and commissions fixed!');

  } catch (error) {
    console.error('❌ Error fixing orders:', error);
  } finally {
    process.exit(0);
  }
}

fixOrdersDeliveryType();