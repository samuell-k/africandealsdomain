const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function fixProductsTable() {
  let connection;
  
  try {
    console.log('🔧 Fixing products table...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Connected to database');

    // Check if columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
    `, [process.env.DB_NAME || 'add_physical_product']);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing columns:', existingColumns);

    // Add missing columns
    const missingColumns = [];
    
    if (!existingColumns.includes('stock_quantity')) {
      missingColumns.push('ADD COLUMN stock_quantity INT DEFAULT 100');
    }
    
    if (!existingColumns.includes('currency')) {
      missingColumns.push('ADD COLUMN currency VARCHAR(10) DEFAULT "USD"');
    }

    if (missingColumns.length > 0) {
      console.log('🔧 Adding missing columns:', missingColumns);
      
      for (const column of missingColumns) {
        try {
          await connection.execute(`ALTER TABLE products ${column}`);
          console.log(`✅ Added column: ${column}`);
        } catch (error) {
          console.error(`❌ Failed to add column ${column}:`, error.message);
        }
      }
    } else {
      console.log('✅ All required columns already exist');
    }

    // Verify the table structure
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'add_physical_product']);

    console.log('📋 Final products table structure:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('🎉 Products table fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixProductsTable(); 