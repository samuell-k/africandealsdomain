const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function fixOrderItemsTable() {
  let connection;
  
  try {
    console.log('🔧 Fixing order_items table...');
     
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_items'
    `, [process.env.DB_NAME || 'add_physical_product']);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing columns:', existingColumns);

    // Check if we need to update the table structure
    if (existingColumns.includes('price_at_time') && !existingColumns.includes('unit_price')) {
      console.log('🔧 Updating order_items table structure...');
      
      // Add new columns
      await connection.execute('ALTER TABLE order_items ADD COLUMN unit_price DECIMAL(12,2)');
      await connection.execute('ALTER TABLE order_items ADD COLUMN total_price DECIMAL(12,2)');
      
      // Copy data from old columns to new columns
      await connection.execute(`
        UPDATE order_items 
        SET unit_price = price_at_time, 
            total_price = price_at_time * quantity
        WHERE unit_price IS NULL
      `);
      
      // Drop old columns
      await connection.execute('ALTER TABLE order_items DROP COLUMN price_at_time');
      await connection.execute('ALTER TABLE order_items DROP COLUMN currency_at_time');
      
      console.log('✅ Updated order_items table structure');
    } else if (existingColumns.includes('unit_price')) {
      console.log('✅ Order_items table already has correct structure');
    } else {
      console.log('⚠️ Order_items table structure is different than expected');
    }

    // Verify the table structure
    const [finalColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_items'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'add_physical_product']);

    console.log('📋 Final order_items table structure:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
 
    console.log('🎉 Order_items table fix completed successfully!');
     
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixOrderItemsTable(); 