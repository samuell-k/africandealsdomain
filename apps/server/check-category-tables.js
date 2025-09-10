const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkCategoryTables() {
  console.log('🔍 Checking Category Tables...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connection established\n');

    // Check all tables with 'categor' in name
    const [tables] = await connection.execute("SHOW TABLES LIKE '%categor%'");
    console.log('📋 Category-related tables:');
    console.table(tables);

    // Check foreign key constraints on products table
    console.log('\n🔗 Foreign key constraints on products table:');
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'add_physical_product' 
      AND TABLE_NAME = 'products' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.table(constraints);

    // Check if product_categories table exists and its structure
    const [productCatTables] = await connection.execute("SHOW TABLES LIKE 'product_categories'");
    if (productCatTables.length > 0) {
      console.log('\n📋 product_categories table structure:');
      const [prodCatColumns] = await connection.execute('DESCRIBE product_categories');
      console.table(prodCatColumns);

      console.log('\n📊 Existing product_categories:');
      const [prodCategories] = await connection.execute('SELECT * FROM product_categories LIMIT 10');
      console.table(prodCategories);
    }

    // Check categories table content
    console.log('\n📊 Categories table content:');
    const [categories] = await connection.execute('SELECT * FROM categories LIMIT 10');
    console.table(categories);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

checkCategoryTables();