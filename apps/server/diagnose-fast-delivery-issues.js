/**
 * Diagnose Fast Delivery Agent Issues
 * Checks database schema and identifies missing tables/columns
 */

const pool = require('./db');

async function diagnoseFastDeliveryIssues() {
  console.log('🔍 Diagnosing Fast Delivery Agent Issues...');
  
  try {
    // Check if grocery_orders table exists
    console.log('\n📋 Checking grocery_orders table...');
    try {
      const [rows] = await pool.query('DESCRIBE grocery_orders');
      console.log('✅ grocery_orders table exists with columns:', rows.map(r => r.Field).join(', '));
    } catch (error) {
      console.log('❌ grocery_orders table missing:', error.message);
    }

    // Check if agents table exists and has required columns
    console.log('\n👤 Checking agents table...');
    try {
      const [rows] = await pool.query('DESCRIBE agents');
      console.log('✅ agents table exists with columns:', rows.map(r => r.Field).join(', '));
      
      // Check for fast delivery agents
      const [agents] = await pool.query('SELECT COUNT(*) as count FROM agents WHERE agent_type = "fast_delivery"');
      console.log(`📊 Fast delivery agents count: ${agents[0].count}`);
    } catch (error) {
      console.log('❌ agents table issue:', error.message);
    }

    // Check if grocery_order_items table exists
    console.log('\n🛒 Checking grocery_order_items table...');
    try {
      const [rows] = await pool.query('DESCRIBE grocery_order_items');
      console.log('✅ grocery_order_items table exists with columns:', rows.map(r => r.Field).join(', '));
    } catch (error) {
      console.log('❌ grocery_order_items table missing:', error.message);
    }

    // Check for test data
    console.log('\n📊 Checking test data...');
    try {
      const [orders] = await pool.query('SELECT COUNT(*) as count FROM grocery_orders WHERE agent_id IS NULL');
      console.log(`📦 Available orders for assignment: ${orders[0].count}`);
    } catch (error) {
      console.log('❌ Error checking orders:', error.message);
    }

    // Test a simple API call simulation
    console.log('\n🧪 Testing API logic...');
    try {
      // Simulate the stats query
      const [todayStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as today_earnings
        FROM grocery_orders 
        WHERE agent_id = ? AND DATE(created_at) = CURDATE()
      `, [1]);
      console.log('✅ Stats query works:', todayStats[0]);
    } catch (error) {
      console.log('❌ Stats query failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
diagnoseFastDeliveryIssues().then(() => {
  console.log('\n🏁 Diagnosis complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Diagnosis error:', error);
  process.exit(1);
});