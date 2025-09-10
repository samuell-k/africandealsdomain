const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVerificationTable() {
  console.log('🔍 Checking Agent Verification Table Structure...\n');

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

    // Check agent_verification table structure
    console.log('📋 agent_verification table structure:');
    const [columns] = await connection.execute('DESCRIBE agent_verification');
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

checkVerificationTable();