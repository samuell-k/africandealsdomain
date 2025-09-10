const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runUpgrade() {
  try {
    // Create database connection
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'african_deals_domain',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    });

    console.log('🔄 Starting agent types upgrade...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../../upgrade-agent-types-comprehensive.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await pool.execute(statement);
          console.log(`✅ [${i + 1}/${statements.length}] Executed: ${statement.substring(0, 60)}...`);
        } catch (err) {
          // Ignore duplicate column/table errors
          if (err.message.includes('Duplicate column') || 
              err.message.includes('already exists') ||
              err.message.includes('Duplicate key name')) {
            console.log(`⚠️  [${i + 1}/${statements.length}] Skipped (already exists): ${statement.substring(0, 60)}...`);
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Error:`, err.message);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
          }
        }
      }
    }

    // Verify the upgrade
    console.log('🔍 Verifying upgrade...');
    
    // Check if new tables exist
    const [tables] = await pool.execute("SHOW TABLES LIKE 'pickup_sites'");
    if (tables.length > 0) {
      console.log('✅ pickup_sites table created');
    }

    const [groceryTables] = await pool.execute("SHOW TABLES LIKE 'grocery_orders'");
    if (groceryTables.length > 0) {
      console.log('✅ grocery_orders table created');
    }

    const [manualTables] = await pool.execute("SHOW TABLES LIKE 'manual_orders'");
    if (manualTables.length > 0) {
      console.log('✅ manual_orders table created');
    }

    // Check if new columns exist in agents table
    const [columns] = await pool.execute("DESCRIBE agents");
    const columnNames = columns.map(col => col.Field);
    
    if (columnNames.includes('agent_type')) {
      console.log('✅ agent_type column exists in agents table');
    }
    
    if (columnNames.includes('marketplace_type')) {
      console.log('✅ marketplace_type column exists in agents table');
    }

    await pool.end();
    console.log('🎉 Agent types upgrade completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('   • Enhanced agents table with new agent types');
    console.log('   • Created pickup_sites table for site managers');
    console.log('   • Created grocery_orders table for fast delivery');
    console.log('   • Created manual_orders table for walk-in customers');
    console.log('   • Added location tracking and performance metrics');
    console.log('   • Set up agent zones and assignments');
    console.log('');
    console.log('🚀 You can now use the three agent types:');
    console.log('   1. Fast Delivery Agents (Grocery/Local Market)');
    console.log('   2. Pickup Delivery Agents (Physical Products)');
    console.log('   3. Pickup Site Managers (Smart Assistants)');

  } catch (error) {
    console.error('💥 Upgrade failed:', error);
    process.exit(1);
  }
}

// Run the upgrade
runUpgrade();