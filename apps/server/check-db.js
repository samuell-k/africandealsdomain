const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  console.log('📋 Existing tables:');
  const [tables] = await pool.execute('SHOW TABLES');
  tables.forEach(table => console.log('  -', Object.values(table)[0]));

  // Check if buyers table exists, if not create it
  const buyersTableExists = tables.some(table => Object.values(table)[0] === 'buyers');
  
  if (!buyersTableExists) {
    console.log('\n🔧 Creating buyers table...');
    await pool.execute(`
      CREATE TABLE buyers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        shipping_address JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Buyers table created');
  }

  await pool.end();
}

checkDatabase().catch(console.error);