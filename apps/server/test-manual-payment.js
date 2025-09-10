const pool = require('./db');

async function testManualPaymentSystem() {
  try {
    console.log('🧪 Testing Manual Payment Approval System...');
    
    // Check if payment_approvals table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'payment_approvals'");
    console.log('📋 Payment approvals table exists:', tables.length > 0);
    
    // Check orders with payment status
    const [orders] = await pool.query(`
      SELECT id, order_number, payment_status, status, payment_proof 
      FROM orders 
      WHERE payment_status IN ('pending', 'awaiting_approval', 'rejected') 
      LIMIT 5
    `);
    console.log('📦 Orders with payment status:', orders.length);
    orders.forEach(order => {
      console.log(`  - Order ${order.order_number}: ${order.payment_status} (${order.status})`);
    });
    
    // Check payment approvals
    const [approvals] = await pool.query(`
      SELECT pa.*, o.order_number 
      FROM payment_approvals pa 
      LEFT JOIN orders o ON pa.order_id = o.id 
      LIMIT 5
    `);
    console.log('💳 Payment approvals:', approvals.length);
    approvals.forEach(approval => {
      console.log(`  - Order ${approval.order_number}: ${approval.status}`);
    });
    
    console.log('✅ Manual Payment System Test Complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testManualPaymentSystem();