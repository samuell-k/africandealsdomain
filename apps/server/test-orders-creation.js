const mysql = require('mysql2/promise');
require('dotenv').config();

async function testOrdersCreation() {
  console.log('🧪 Testing Orders Creation and Seller Access...\n');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'african_deals_domain'
    });

    console.log('✅ Database connected');

    // 1. Check if we have sellers and buyers
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 2');
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 2');
    
    console.log(`Found ${sellers.length} sellers and ${buyers.length} buyers`);

    if (sellers.length === 0) {
      console.log('⚠️ No sellers found. Creating test seller...');
      const [sellerResult] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Seller',
        'testseller@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'seller',
        '+250788123456',
        1
      ]);
      sellers.push({ id: sellerResult.insertId, name: 'Test Seller', email: 'testseller@example.com' });
      console.log(`✅ Created test seller with ID: ${sellerResult.insertId}`);
    }

    if (buyers.length === 0) {
      console.log('⚠️ No buyers found. Creating test buyer...');
      const [buyerResult] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Buyer',
        'testbuyer@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'buyer',
        '+250788123457',
        1
      ]);
      buyers.push({ id: buyerResult.insertId, name: 'Test Buyer', email: 'testbuyer@example.com' });
      console.log(`✅ Created test buyer with ID: ${buyerResult.insertId}`);
    }

    // 2. Check if sellers have products
    for (const seller of sellers) {
      const [products] = await connection.execute(`
        SELECT id, name, price, stock_quantity FROM products 
        WHERE seller_id = ? AND is_active = 1
      `, [seller.id]);
      
      console.log(`Seller ${seller.name} has ${products.length} products`);
      
      if (products.length === 0) {
        console.log(`⚠️ No products for seller ${seller.name}. Creating test product...`);
        
        // Get a category first
        const [categories] = await connection.execute('SELECT id FROM product_categories LIMIT 1');
        const categoryId = categories[0]?.id || 1;
        
        const [productResult] = await connection.execute(`
          INSERT INTO products (name, description, price, stock_quantity, seller_id, category_id, is_active) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'Test Product for ' + seller.name,
          'This is a test product created for testing orders',
          99.99,
          50,
          seller.id,
          categoryId,
          1
        ]);
        
        products.push({ 
          id: productResult.insertId, 
          name: 'Test Product for ' + seller.name, 
          price: 99.99, 
          stock_quantity: 50 
        });
        
        console.log(`✅ Created test product with ID: ${productResult.insertId}`);
      }
    }

    // 3. Create test orders
    console.log('\n📦 Creating test orders...');
    
    for (const buyer of buyers) {
      for (const seller of sellers) {
        const [sellerProducts] = await connection.execute(`
          SELECT id, name, price FROM products 
          WHERE seller_id = ? AND is_active = 1
        `, [seller.id]);
        
        if (sellerProducts.length > 0) {
          const product = sellerProducts[0];
          const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Create order
          const [orderResult] = await connection.execute(`
            INSERT INTO orders (user_id, order_number, total_amount, status) 
            VALUES (?, ?, ?, ?)
          `, [buyer.id, orderNumber, product.price, 'pending']);
          
          const orderId = orderResult.insertId;
          
          // Create order item
          await connection.execute(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) 
            VALUES (?, ?, ?, ?, ?)
          `, [orderId, product.id, 1, product.price, product.price]);
          
          console.log(`✅ Created order #${orderNumber} for buyer ${buyer.name} from seller ${seller.name}`);
        }
      }
    }

    // 4. Test seller orders query (simulate API)
    console.log('\n🔍 Testing seller orders query...');
    
    for (const seller of sellers) {
      const [orders] = await connection.execute(`
        SELECT DISTINCT
          o.id,
          o.order_number,
          o.total_amount,
          o.status,
          o.created_at,
          u.name as buyer_name,
          u.email as buyer_email
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN users u ON o.user_id = u.id
        WHERE p.seller_id = ?
        ORDER BY o.created_at DESC
      `, [seller.id]);
      
      console.log(`Seller ${seller.name} has ${orders.length} orders:`);
      orders.forEach(order => {
        console.log(`  - Order #${order.order_number}: $${order.total_amount} (${order.status}) - Buyer: ${order.buyer_name}`);
      });
    }

    // 5. Verify data isolation
    console.log('\n🔒 Verifying data isolation...');
    
    for (const seller of sellers) {
      // Get orders for this seller
      const [sellerOrders] = await connection.execute(`
        SELECT DISTINCT o.id FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE p.seller_id = ?
      `, [seller.id]);
      
      // Check if any other seller can see these orders
      for (const otherSeller of sellers) {
        if (otherSeller.id !== seller.id) {
          const [otherSellerOrders] = await connection.execute(`
            SELECT DISTINCT o.id FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE p.seller_id = ? AND o.id IN (?)
          `, [otherSeller.id, sellerOrders.map(o => o.id)]);
          
          if (otherSellerOrders.length > 0) {
            console.error(`❌ SECURITY ISSUE: Seller ${otherSeller.name} can see orders from seller ${seller.name}`);
          } else {
            console.log(`✅ Data isolation verified: Seller ${otherSeller.name} cannot see orders from seller ${seller.name}`);
          }
        }
      }
    }

    console.log('\n🎉 Orders creation and seller access test completed!');
    console.log('\nTo test in browser:');
    console.log('1. Login as a seller');
    console.log('2. Go to /seller/orders.html');
    console.log('3. Verify orders are displayed correctly');
    console.log('4. Check browser console for API calls');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await connection.end();
  }
}

testOrdersCreation(); 