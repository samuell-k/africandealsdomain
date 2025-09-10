/**
 * Create Test Orders for Existing Users
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestOrders() {
  try {
    console.log('🧪 CREATING TEST ORDERS FOR EXISTING USERS');
    console.log('==========================================\n');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    // Get existing buyer users
    const [buyers] = await connection.execute(`
      SELECT id, name, email 
      FROM users 
      WHERE role = 'buyer' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('✅ Found buyers:', buyers.length);
    
    if (buyers.length === 0) {
      console.log('❌ No buyers found. Creating a test buyer first...');
      
      // Create a test buyer
      const [insertResult] = await connection.execute(`
        INSERT INTO users (name, email, password, phone, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        'Test Buyer with Orders',
        'testbuyer.withorders@example.com',
        '$2b$10$rQZ9QmZ9QmZ9QmZ9QmZ9Qu', // hashed 'password123'
        '+1234567890',
        'buyer'
      ]);
      
      buyers.push({
        id: insertResult.insertId,
        name: 'Test Buyer with Orders',
        email: 'testbuyer.withorders@example.com'
      });
      
      console.log('✅ Created test buyer with ID:', insertResult.insertId);
    }
    
    // Create test orders for each buyer
    for (const buyer of buyers) {
      console.log(`\n📋 Creating orders for ${buyer.name} (${buyer.email})`);
      
      // Create 3-5 orders per buyer
      const orderCount = Math.floor(Math.random() * 3) + 3; // 3-5 orders
      
      for (let i = 0; i < orderCount; i++) {
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const totalAmount = (Math.random() * 500 + 50).toFixed(2); // $50-$550
        const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
        const paymentStatuses = ['pending', 'confirmed', 'paid'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const paymentStatus = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
        
        // Create order
        const [orderResult] = await connection.execute(`
          INSERT INTO orders (
            user_id, 
            order_number, 
            total_amount, 
            status, 
            payment_status,
            payment_method,
            shipping_address,
            billing_address,
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          buyer.id,
          orderNumber,
          totalAmount,
          status,
          paymentStatus,
          'manual_payment',
          JSON.stringify({
            street: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            zip: '12345',
            country: 'Test Country'
          }),
          JSON.stringify({
            street: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            zip: '12345',
            country: 'Test Country'
          })
        ]);
        
        const orderId = orderResult.insertId;
        
        // Create 1-3 order items per order
        const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 items
        
        for (let j = 0; j < itemCount; j++) {
          const itemPrice = (Math.random() * 100 + 10).toFixed(2); // $10-$110
          const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
          
          await connection.execute(`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              unit_price,
              total_price
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            orderId,
            Math.floor(Math.random() * 100) + 1, // Random product ID
            quantity,
            itemPrice,
            (itemPrice * quantity).toFixed(2)
          ]);
        }
        
        console.log(`  ✅ Created order ${orderNumber} - $${totalAmount} (${status}/${paymentStatus}) with ${itemCount} items`);
      }
      
      console.log(`  📊 Created ${orderCount} orders for ${buyer.name}`);
    }
    
    // Verify the created orders
    console.log('\n📊 VERIFICATION');
    console.log('===============');
    
    const [totalOrdersAfter] = await connection.execute('SELECT COUNT(*) as count FROM orders');
    console.log('✅ Total orders in database:', totalOrdersAfter[0].count);
    
    const [ordersPerBuyer] = await connection.execute(`
      SELECT 
        u.name,
        u.email,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'buyer'
      GROUP BY u.id, u.name, u.email
      HAVING order_count > 0
      ORDER BY order_count DESC
    `);
    
    console.log('\n✅ Orders per buyer:');
    ordersPerBuyer.forEach(buyer => {
      console.log(`  ${buyer.name} (${buyer.email}): ${buyer.order_count} orders, $${buyer.total_spent} total`);
    });
    
    await connection.end();
    
    console.log('\n🎉 TEST ORDERS CREATED SUCCESSFULLY!');
    console.log('\n🔗 Test the buyer orders page:');
    console.log('1. Login with any of the buyer accounts');
    console.log('2. Navigate to the orders page');
    console.log('3. You should now see orders displayed');
    
  } catch (error) {
    console.error('❌ Error creating test orders:', error.message);
  }
}

createTestOrders();