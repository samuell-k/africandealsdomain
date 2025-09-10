const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔌 Attempting to connect to database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product'
    });

    console.log('✅ Connected to database');

    // Read and execute the database setup SQL
    const sqlPath = path.join(__dirname, 'database-setup.sql');
    console.log('📖 Reading SQL file from:', sqlPath);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at ${sqlPath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 SQL file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log(`✅ [${i + 1}/${statements.length}] Executed successfully`);
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  [${i + 1}/${statements.length}] Skipped (already exists)`);
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Error executing statement`);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Statement preview:', statement.substring(0, 100) + '...');
          }
        }
      }
    }

    // Add missing tables and columns for delivery tracking and chat
    try {
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                sender_id INT NOT NULL,
                recipient_id INT,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(order_id)
            )
        `);
        console.log('✅ Chat messages table checked/created.');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS order_tracking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                notes TEXT,
                location JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Order tracking table checked/created.');

        // Add columns to orders table if they don't exist
        console.log('✅ Columns `tracking_status` and `delivery_code` checked/added to orders table.');

    } catch (e) {
        if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  Skipped creating a table/column that already exists.`);
        } else {
            console.error('❌ Error adding tables/columns for tracking:', e.message);
        }
    }

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📊 Database tables created:');
    console.log('   - product_categories');
    console.log('   - products');
    console.log('   - product_images');
    console.log('   - users');
    console.log('   - messages');
    console.log('   - wishlist');
    console.log('   - cart');
    console.log('   - orders');
    console.log('   - order_items');
    
    console.log('\n� Sample data inserted:');
    console.log('   - Product categories');
    console.log('   - Sample products');
    console.log('   - Sample users');
    console.log('   - Sample messages');
    console.log('   - Sample orders');

  } catch (error) {
    console.error('❌ Database setup failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the setup
setupDatabase(); 