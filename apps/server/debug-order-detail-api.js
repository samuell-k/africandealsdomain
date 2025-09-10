const pool = require('./db');
const jwt = require('jsonwebtoken');

async function debugOrderDetailAPI() {
  try {
    console.log('🔍 DEBUGGING ORDER DETAIL API');
    console.log('==============================\n');
    
    // Get sample orders and users
    const [orders] = await pool.query(`
      SELECT 
        o.id, 
        o.order_number, 
        o.user_id, 
        o.status,
        u.email,
        u.role,
        COALESCE(u.name, u.username) as user_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE u.role = 'buyer'
      ORDER BY o.created_at DESC 
      LIMIT 5
    `);
    
    console.log('📦 Orders with buyer users:');
    console.table(orders);
    
    if (orders.length === 0) {
      console.log('❌ No orders found with buyer users');
      return;
    }
    
    // Test with first order
    const testOrder = orders[0];
    console.log(`\n🧪 Testing API logic for Order ID: ${testOrder.id}, User ID: ${testOrder.user_id}`);
    
    // Simulate the API query
    const [apiResult] = await pool.query(`
      SELECT 
        o.*,
        COALESCE(u.name, u.username) as buyer_name,
        u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.user_id = ?
    `, [testOrder.id, testOrder.user_id]);
    
    if (apiResult.length > 0) {
      console.log('✅ API query successful');
      console.log('Order details:', {
        id: apiResult[0].id,
        order_number: apiResult[0].order_number,
        buyer_name: apiResult[0].buyer_name,
        buyer_email: apiResult[0].buyer_email,
        status: apiResult[0].status,
        total_amount: apiResult[0].total_amount
      });
      
      // Get order items
      const [orderItems] = await pool.query(`
        SELECT 
          oi.*,
          p.name as product_name,
          p.price as product_price
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [testOrder.id]);
      
      console.log(`\n📋 Order items (${orderItems.length} items):`);
      if (orderItems.length > 0) {
        console.table(orderItems.map(item => ({
          id: item.id,
          product_name: item.product_name || 'Unknown Product',
          quantity: item.quantity,
          price: item.price
        })));
      } else {
        console.log('⚠️  No order items found');
      }
      
    } else {
      console.log('❌ API query failed - no matching order');
    }
    
    // Test JWT token creation for this user
    console.log(`\n🔐 Testing JWT token for User ID: ${testOrder.user_id}`);
    
    const tokenPayload = {
      id: testOrder.user_id,
      email: testOrder.email,
      role: testOrder.role
    };
    
    const testToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    console.log('✅ Test token created');
    console.log('Token payload:', tokenPayload);
    
    // Test token verification
    try {
      const decoded = jwt.verify(testToken, process.env.JWT_SECRET || 'your-secret-key');
      console.log('✅ Token verification successful');
      console.log('Decoded token:', decoded);
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
    }
    
    console.log('\n📋 TESTING INSTRUCTIONS');
    console.log('========================');
    console.log('1. Login as buyer with email:', testOrder.email);
    console.log('2. Navigate to orders page: http://localhost:3001/buyer/orders.html');
    console.log('3. Click "View Details" on order:', testOrder.order_number);
    console.log('4. URL should be: http://localhost:3001/buyer/order-detail.html?id=' + testOrder.id);
    console.log('5. Check browser console for any errors');
    
    console.log('\n🔧 TROUBLESHOOTING');
    console.log('==================');
    console.log('If "Order not found" error occurs:');
    console.log('- Check if user is logged in with correct account');
    console.log('- Verify JWT token contains correct user ID');
    console.log('- Check browser network tab for API request details');
    console.log('- Ensure order belongs to the logged-in user');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugOrderDetailAPI();