const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testSellerAPI() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_domain'
  });

  try {
    console.log('🧪 Testing Seller API endpoints...\n');

    // 1. Check if we have sellers
    const [sellers] = await connection.execute('SELECT id, name, email, role FROM users WHERE role = "seller" LIMIT 1');
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found, creating test seller...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Seller',
        'testseller@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        'seller',
        '+250788123456',
        1
      ]);
      console.log(`✅ Created test seller with ID: ${result.insertId}`);
    } else {
      console.log(`✅ Found seller: ${sellers[0].name} (ID: ${sellers[0].id})`);
    }

    // 2. Check if we have products for this seller
    const sellerId = sellers[0]?.id || 1;
    const [products] = await connection.execute(`
      SELECT p.id, p.name, p.price, p.stock_quantity, p.seller_id, p.is_active
      FROM products p
      WHERE p.seller_id = ? AND p.is_active = 1
      ORDER BY p.created_at DESC
    `, [sellerId]);
    
    console.log(`\n📦 Found ${products.length} products for seller ${sellerId}:`);
    products.forEach(product => {
      console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: $${product.price}, Stock: ${product.stock_quantity}`);
    });

    // 3. Test the seller products query (same as the API)
    console.log('\n🔍 Testing seller products query (API simulation)...');
    const [sellerProducts] = await connection.execute(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.main_image,
        p.created_at,
        c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
      LIMIT 10 OFFSET 0
    `, [sellerId]);
    
    console.log(`✅ API query returned ${sellerProducts.length} products:`);
    sellerProducts.forEach(product => {
      console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: $${product.price}, Category: ${product.category_name || 'None'}`);
    });

    // 4. Test seller stats query
    console.log('\n📊 Testing seller stats query...');
    
    // Get total sales
    const [salesResult] = await connection.execute(`
      SELECT COALESCE(SUM(oi.total_price), 0) as total_sales
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status IN ('delivered', 'completed')
    `, [sellerId]);
    
    // Get pending orders count
    const [pendingResult] = await connection.execute(`
      SELECT COUNT(DISTINCT o.id) as pending_count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status = 'pending'
    `, [sellerId]);
    
    // Get out of stock products count
    const [stockResult] = await connection.execute(`
      SELECT COUNT(*) as out_of_stock
      FROM products
      WHERE seller_id = ? AND stock_quantity <= 0 AND is_active = 1
    `, [sellerId]);
    
    console.log('📈 Seller Stats:');
    console.log(`  - Total Sales: $${salesResult[0]?.total_sales || 0}`);
    console.log(`  - Pending Orders: ${pendingResult[0]?.pending_count || 0}`);
    console.log(`  - Out of Stock Products: ${stockResult[0]?.out_of_stock || 0}`);

    // 5. Generate a test JWT token
    const seller = sellers[0] || { id: sellerId, role: 'seller' };
    const token = jwt.sign(
      { id: seller.id, role: seller.role }, 
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', 
      { expiresIn: '7d' }
    );
    
    console.log(`\n🔐 Generated test JWT token for seller ID: ${seller.id}`);
    console.log(`Token: ${token.substring(0, 50)}...`);

    // 6. Test authentication middleware
    console.log('\n🔐 Testing authentication middleware...');
    
    const { requireAuth, requireRole } = require('./routes/auth');
    
    try {
      // Test requireAuth
      const authReq = { headers: { authorization: `Bearer ${token}` } };
      let authPassed = false;
      
      requireAuth(authReq, { status: () => ({ json: () => {} }) }, () => {
        authPassed = true;
      });
      
      if (authPassed) {
        console.log('✅ Authentication middleware passed');
        console.log(`✅ User ID: ${authReq.user.id}, Role: ${authReq.user.role}`);
      } else {
        console.log('❌ Authentication middleware failed');
      }
      
      // Test requireRole
      let rolePassed = false;
      const roleCheck = requireRole('seller');
      roleCheck(authReq, { status: () => ({ json: () => {} }) }, () => {
        rolePassed = true;
      });
      
      if (rolePassed) {
        console.log('✅ Role middleware passed');
      } else {
        console.log('❌ Role middleware failed');
      }
      
    } catch (error) {
      console.log('❌ Authentication middleware error:', error.message);
    }

    console.log('\n🎉 Seller API test completed!');
    console.log('\nTo test the frontend:');
    console.log('1. Login as a seller at /auth/auth-seller.html');
    console.log('2. Go to /seller/dashboard.html');
    console.log('3. Check browser console for API calls');
    console.log('4. Products should now appear in the dashboard');

  } catch (error) {
    console.error('❌ Error testing seller API:', error);
  } finally {
    await connection.end();
  }
}

testSellerAPI(); 