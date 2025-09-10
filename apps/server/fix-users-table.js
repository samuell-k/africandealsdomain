const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function fixUsersTable() {
  let connection;
  
  try {
    console.log('🔧 Fixing users table...');
    
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [process.env.DB_NAME || 'add_physical_product']);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing columns:', existingColumns);

    // Add missing columns
    const missingColumns = [];
    
    if (!existingColumns.includes('phone')) {
      missingColumns.push('ADD COLUMN phone VARCHAR(32)');
    }
    
    if (!existingColumns.includes('address')) {
      missingColumns.push('ADD COLUMN address TEXT');
    }
    
    if (!existingColumns.includes('city')) {
      missingColumns.push('ADD COLUMN city VARCHAR(100)');
    }
    
    if (!existingColumns.includes('country')) {
      missingColumns.push('ADD COLUMN country VARCHAR(100)');
    }

    if (missingColumns.length > 0) {
      console.log('🔧 Adding missing columns:', missingColumns);
      
      for (const column of missingColumns) {
        try {
          await connection.execute(`ALTER TABLE users ${column}`);
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'add_physical_product']);

    console.log('📋 Final users table structure:');
    finalColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('🎉 Users table fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixUsersTable(); 