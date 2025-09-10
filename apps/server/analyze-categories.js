const mysql = require('mysql2/promise');
require('dotenv').config();

async function analyzeCategories() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306
    });

    // Get unique categories
    const [categories] = await connection.execute(`
      SELECT DISTINCT name, COUNT(*) as count
      FROM categories 
      GROUP BY name
      ORDER BY name
    `);

    console.log('📋 Unique Categories:\n');
    categories.forEach(cat => {
      console.log(`🏷️  ${cat.name} (${cat.count} entries)`);
    });

    // Get some sample products with their categories
    console.log('\n📦 Sample Products with Categories:\n');
    const [products] = await connection.execute(`
      SELECT p.id, p.name, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LIMIT 10
    `);

    products.forEach(product => {
      console.log(`• ${product.name} → ${product.category_name || 'No Category'}`);
    });

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeCategories();