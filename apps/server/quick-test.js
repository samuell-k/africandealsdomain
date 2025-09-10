const mysql = require('mysql2/promise');
require('dotenv').config();

async function quickTest() {
  console.log('🧪 Quick test of seller API...');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'african_deals_domain'
    });

    console.log('✅ Database connected');

    // Check sellers
    const [sellers] = await connection.execute('SELECT id, name, email, role FROM users WHERE role = "seller" LIMIT 1');
    console.log(`Found ${sellers.length} sellers`);

    if (sellers.length > 0) {
      const sellerId = sellers[0].id;
      console.log(`Testing with seller ID: ${sellerId}`);

      // Check products for this seller
      const [products] = await connection.execute(`
        SELECT p.id, p.name, p.price, p.stock_quantity, p.seller_id, p.is_active
        FROM products p
        WHERE p.seller_id = ? AND p.is_active = 1
        ORDER BY p.created_at DESC
      `, [sellerId]);
      
      console.log(`Found ${products.length} products for seller ${sellerId}:`);
      products.forEach(product => {
        console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: $${product.price}, Stock: ${product.stock_quantity}`);
      });

      // Test the exact query used by the API
      const [apiProducts] = await connection.execute(`
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
      
      console.log(`API query returned ${apiProducts.length} products`);
    }

    await connection.end();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest(); 