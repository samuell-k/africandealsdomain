const mysql = require('mysql2/promise');

async function updateServicesSchema() {
  let connection;
  
  try {
    console.log('🔌 Updating other_services table schema...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    });

    console.log('✅ Connected to database');

    // Check if image_url column already exists
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'add_physical_product' AND TABLE_NAME = 'other_services' AND COLUMN_NAME = 'image_url'"
    );

    if (columns.length === 0) {
      // Add image_url column
      await connection.execute(
        'ALTER TABLE other_services ADD COLUMN image_url VARCHAR(500) AFTER link'
      );
      console.log('✅ Added image_url column to other_services table');
    } else {
      console.log('✅ image_url column already exists in other_services table');
    }

    console.log('🎉 Services schema update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating services schema:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  updateServicesSchema()
    .then(() => {
      console.log('✅ Schema update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema update failed:', error);
      process.exit(1);
    });
}

module.exports = updateServicesSchema;