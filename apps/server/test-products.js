const mysql = require('mysql2/promise');
require('dotenv').config();

async function testProducts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_domain'
  });

  try {
    console.log('Testing products database...');

    // Check if products table exists
    const [tables] = await connection.execute('SHOW TABLES LIKE "products"');
    if (tables.length === 0) {
      console.log('❌ Products table does not exist');
      return;
    }
    console.log('✅ Products table exists');

    // Check if users table exists
    const [userTables] = await connection.execute('SHOW TABLES LIKE "users"');
    if (userTables.length === 0) {
      console.log('❌ Users table does not exist');
      return;
    }
    console.log('✅ Users table exists');

    // Check for sellers
    const [sellers] = await connection.execute('SELECT id, name, email, role FROM users WHERE role = "seller"');
    console.log(`Found ${sellers.length} sellers:`);
    sellers.forEach(seller => {
      console.log(`  - ID: ${seller.id}, Name: ${seller.name}, Email: ${seller.email}`);
    });

    // Check for products
    const [products] = await connection.execute(`
      SELECT p.id, p.name, p.price, p.seller_id, p.is_active, u.name as seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    console.log(`\nFound ${products.length} products:`);
    products.forEach(product => {
      console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: ${product.price}, Seller: ${product.seller_name} (ID: ${product.seller_id}), Active: ${product.is_active}`);
    });

    // Test seller products query
    if (sellers.length > 0) {
      const sellerId = sellers[0].id;
      console.log(`\nTesting seller products query for seller ID ${sellerId}:`);
      
      const [sellerProducts] = await connection.execute(`
        SELECT 
          p.*,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.seller_id = ? AND p.is_active = 1
        ORDER BY p.created_at DESC
      `, [sellerId]);
      
      console.log(`Found ${sellerProducts.length} products for seller ${sellerId}:`);
      sellerProducts.forEach(product => {
        console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: ${product.price}, Category: ${product.category_name}`);
      });
    }

    // Check product_categories
    const [categories] = await connection.execute('SELECT id, name FROM product_categories WHERE is_active = 1');
    console.log(`\nFound ${categories.length} active categories:`);
    categories.forEach(category => {
      console.log(`  - ID: ${category.id}, Name: ${category.name}`);
    });

  } catch (error) {
    console.error('Error testing products:', error);
  } finally {
    await connection.end();
  }
}

testProducts(); 