const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSystemLogs() {
  console.log('🔍 Checking System Logs Table Structure...\n');

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

    // Check if system_logs table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'system_logs'");
    if (tables.length === 0) {
      console.log('❌ system_logs table does not exist');
      return;
    }

    // Check system_logs table structure
    console.log('📋 system_logs table structure:');
    const [columns] = await connection.execute('DESCRIBE system_logs');
    console.table(columns);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

checkSystemLogs();