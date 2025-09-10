const mysql = require('mysql2/promise');

async function checkAgentsTable() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: Number(process.env.DB_PORT) || 3333
  });

  try {
    console.log('🔍 Checking agents table structure...');
    
    const [columns] = await conn.query('DESCRIBE agents');
    console.log('Agents table columns:');
    columns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
  }
}

checkAgentsTable();