const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProductsTable() {
  console.log('🔍 Checking Products Table Structure...\n');

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

    // Check if products table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'products'");
    if (tables.length === 0) {
      console.log('❌ Products table does not exist');
      return;
    }

    // Check products table structure
    console.log('📋 Products table structure:');
    const [columns] = await connection.execute('DESCRIBE products');
    console.table(columns);

    // Check categories table
    console.log('\n📋 Categories table structure:');
    const [catColumns] = await connection.execute('DESCRIBE categories');
    console.table(catColumns);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

checkProductsTable();