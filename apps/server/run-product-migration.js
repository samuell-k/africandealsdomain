const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function runMigration() {
  try {
    console.log('🔄 Running product detail migration...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'african_deals_db',
      multipleStatements: true
    });

    const sql = fs.readFileSync('./migrations/add-product-detail-tables.sql', 'utf8');
    
    // Split SQL statements and execute them one by one
    const statements = sql.split(';').filter(statement => statement.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log('✅ Executed statement successfully');
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('ℹ️  Statement already applied:', error.message);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Product detail migration completed successfully');
    await connection.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();