const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function checkDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST||'localhost',
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASSWORD||'',
    database: process.env.DB_NAME||'add_physical_product',
    port: process.env.DB_PORT||3333,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
   
  try {
    console.log('🔍 Checking database structure...');
    
    // Check if products table exists
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('📋 Available tables:', tables.map(t => Object.values(t)[0]));
    
    // Check products table structure
    const [columns] = await pool.execute('DESCRIBE products');
    console.log('📊 Products table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
    });
    
    // Check if there are any products
    const [products] = await pool.execute('SELECT COUNT(*) as count FROM products');
    console.log(`📦 Total products: ${products[0].count}`);
    
    // Check categories
    const [categories] = await pool.execute('SELECT COUNT(*) as count FROM product_categories');
    console.log(`📂 Total categories: ${categories[0].count}`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 Database does not exist. Run setup-database.js first.');
    }
  }
}

checkDatabase(); 