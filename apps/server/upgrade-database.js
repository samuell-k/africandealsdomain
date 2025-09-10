const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function upgradeDatabase() {
  console.log('🚀 Starting database upgrade...');
  
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333,
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    const sqlFile = path.join(__dirname, '../../location-chat-payment-upgrade.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon and filter empty statements
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await connection.execute(statement);
          console.log(`✅ [${i+1}/${statements.length}] Executed: ${statement.substring(0, 60)}...`);
        } catch (err) {
          if (err.message.includes('Duplicate column') || 
              err.message.includes('already exists') ||
              err.message.includes('Duplicate key')) {
            console.log(`⚠️ [${i+1}/${statements.length}] Skipped (already exists): ${statement.substring(0, 60)}...`);
          } else {
            console.error(`❌ [${i+1}/${statements.length}] Error: ${err.message}`);
          }
        }
      }
    }

    await connection.end();
    console.log('🎉 Database upgrade completed successfully!');
    
  } catch (error) {
    console.error('❌ Database upgrade failed:', error.message);
    process.exit(1);
  }
}

upgradeDatabase();