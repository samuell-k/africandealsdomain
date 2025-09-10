/**
 * Complete Database Setup Script
 * Initializes all tables and default data for the ADD Physical Products platform
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔄 Starting complete database setup...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
       port: process.env.DB_PORT || 3333,
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Read and execute main database setup
    const setupSQL = fs.readFileSync(path.join(__dirname, 'database-setup.sql'), 'utf8');
    
    // Split SQL into individual statements and execute them one by one
    const statements = setupSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await connection.execute(statement);
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?\s*\(/i)?.[1];
            console.log(`✅ Table '${tableName}' created/verified`);
          }
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️ SQL Warning (statement ${i + 1}):`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Main database schema created');

    // Read and execute agent tables setup
    const agentTablesSQL = fs.readFileSync(path.join(__dirname, 'create-agent-tables.js'), 'utf8');
    // Extract SQL from the JavaScript file (this is a workaround)
    const agentSQLMatch = agentTablesSQL.match(/await pool\.execute\(`([\s\S]*?)`\)/g);
    
    if (agentSQLMatch) {
      for (const sqlMatch of agentSQLMatch) {
        const sql = sqlMatch.match(/`([\s\S]*?)`/)[1];
        if (sql.trim().startsWith('CREATE TABLE') || sql.trim().startsWith('INSERT')) {
          try {
            await connection.execute(sql);
            console.log('✅ Agent table created/updated');
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.warn('⚠️ Agent table warning:', error.message);
            }
          }
        }
      }
    }

    // Verify critical tables exist
    const criticalTables = [
      'users', 'products', 'orders', 'order_items', 'payment_transactions',
      'commission_transactions', 'agent_earnings', 'platform_settings',
      'payment_logs', 'agents', 'pickup_sites'
    ];

    console.log('🔍 Verifying critical tables...');
    for (const table of criticalTables) {
      const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.error(`❌ Critical table '${table}' is missing!`);
      }
    }

    // Insert default admin user if not exists
    const [adminCheck] = await connection.execute(`
      SELECT id FROM users WHERE email = 'admin@addphysicalproducts.com'
    `);

    if (adminCheck.length === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.execute(`
        INSERT INTO users (username, email, password_hash, role, is_active, is_verified)
        VALUES ('admin', 'admin@addphysicalproducts.com', ?, 'admin', TRUE, TRUE)
      `, [hashedPassword]);
      
      console.log('✅ Default admin user created');
      console.log('📧 Admin Email: admin@addphysicalproducts.com');
      console.log('🔑 Admin Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Verify platform settings
    const [settingsCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM platform_settings WHERE category = 'commission'
    `);

    if (settingsCheck[0].count > 0) {
      console.log('✅ Commission settings configured');
    } else {
      console.error('❌ Commission settings missing!');
    }

    // Create sample pickup sites if none exist
    const [pickupSitesCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM pickup_sites
    `);

    if (pickupSitesCheck[0].count === 0) {
      await connection.execute(`
        INSERT INTO pickup_sites (name, address_line1, city, country, capacity, is_active) VALUES
        ('Downtown Pickup Center', '123 Main Street', 'Kigali', 'Rwanda', 100, TRUE),
        ('Mall Pickup Point', '456 Shopping Mall', 'Kigali', 'Rwanda', 50, TRUE),
        ('University Pickup Hub', '789 University Ave', 'Kigali', 'Rwanda', 75, TRUE)
      `);
      console.log('✅ Sample pickup sites created');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Access admin panel: http://localhost:3001/admin/dashboard.html');
    console.log('3. Login with admin@addphysicalproducts.com / admin123');
    console.log('4. Configure payment methods and agent approvals');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
setupDatabase();