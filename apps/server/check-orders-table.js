const mysql = require('mysql2/promise');

async function checkOrdersTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== ORDERS TABLE STRUCTURE ===');
    const [columns] = await connection.execute('DESCRIBE orders');
    
    console.log('Columns in orders table:');
    columns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check if promo_code column exists
    const promoColumn = columns.find(col => col.Field === 'promo_code');
    if (!promoColumn) {
      console.log('\n❌ promo_code column does not exist in orders table');
      console.log('✅ Adding promo_code column...');
      
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN promo_code VARCHAR(50) NULL,
        ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00,
        ADD INDEX idx_promo_code (promo_code)
      `);
      
      console.log('✅ Added promo_code and discount_amount columns to orders table');
    } else {
      console.log('\n✅ promo_code column already exists');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkOrdersTable();