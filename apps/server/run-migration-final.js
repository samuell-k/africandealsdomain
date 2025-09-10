const mysql = require('mysql2/promise');

// Load environment variables
require('dotenv').config();

// Try both database names (singular and plural)
const possibleDatabases = [
  process.env.DB_NAME || 'add_physical_product',
  'add_physical_products',
  'add_physical_product'
];

async function findAndConnectToDatabase() {
  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306
  };

  console.log(`🔍 Searching for database...`);
  console.log(`📍 Host: ${baseConfig.host}:${baseConfig.port}`);
  console.log(`👤 User: ${baseConfig.user}`);

  for (const dbName of possibleDatabases) {
    try {
      console.log(`🔄 Trying database: ${dbName}`);
      const connection = await mysql.createConnection({
        ...baseConfig,
        database: dbName
      });
      
      // Test the connection by checking if products table exists
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      `, [dbName]);
      
      if (tables.length > 0) {
        console.log(`✅ Found database: ${dbName} with products table`);
        return { connection, dbName };
      } else {
        console.log(`⚠️  Database ${dbName} exists but no products table found`);
        await connection.end();
      }
    } catch (error) {
      console.log(`❌ Database ${dbName} not accessible: ${error.message}`);
    }
  }
  
  throw new Error('No suitable database found');
}

async function applyDatabaseMigration() {
  let connection;
  let dbName;
  
  try {
    console.log('🚀 ADD Physical Products - Database Migration');
    console.log('==========================================\n');
    
    // Find and connect to the correct database
    const dbConnection = await findAndConnectToDatabase();
    connection = dbConnection.connection;
    dbName = dbConnection.dbName;
    
    console.log(`\n📋 Checking current database structure for: ${dbName}`);
    
    // Check products table columns
    const [productColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);
    
    console.log(`\nCurrent products table has ${productColumns.length} columns:`);
    productColumns.forEach((col, index) => {
      console.log(`  ${index + 1}. ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // Define new columns to add
    const newProductColumns = [
      {
        name: 'features',
        definition: 'TEXT',
        position: 'AFTER description',
        description: 'Key product features'
      },
      {
        name: 'specifications_text',
        definition: 'TEXT',
        position: 'AFTER features',
        description: 'Technical specifications'
      },
      {
        name: 'whats_included',
        definition: 'TEXT',
        position: 'AFTER specifications_text',
        description: 'What\'s included in the box'
      },
      {
        name: 'usage_instructions',
        definition: 'TEXT',
        position: 'AFTER whats_included',
        description: 'Usage instructions'
      },
      {
        name: 'warranty_period',
        definition: 'VARCHAR(50)',
        position: 'AFTER usage_instructions',
        description: 'Warranty period'
      },
      {
        name: 'return_policy',
        definition: 'VARCHAR(50)',
        position: 'AFTER warranty_period',
        description: 'Return policy'
      },
      {
        name: 'base_price',
        definition: 'DECIMAL(10,2)',
        position: 'AFTER price',
        description: 'Original seller price before platform fees'
      }
    ];
    
    // Check which columns already exist
    const existingProductColumns = productColumns.map(col => col.COLUMN_NAME.toLowerCase());
    
    console.log('\n🔧 Adding new columns to products table...');
    
    let addedColumns = 0;
    let existingColumns = 0;
    
    // Add missing columns to products table
    for (const column of newProductColumns) {
      if (!existingProductColumns.includes(column.name.toLowerCase())) {
        try {
          const sql = `ALTER TABLE products ADD COLUMN ${column.name} ${column.definition} ${column.position}`;
          await connection.execute(sql);
          console.log(`✅ Added: ${column.name} - ${column.description}`);
          addedColumns++;
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  Column ${column.name} already exists`);
            existingColumns++;
          } else {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
          }
        }
      } else {
        console.log(`⏭️  Column ${column.name} already exists`);
        existingColumns++;
      }
    }
    
    // Update base_price for existing products
    console.log('\n💰 Updating base_price for existing products...');
    try {
      const [updateResult] = await connection.execute(`
        UPDATE products 
        SET base_price = CASE 
          WHEN base_price IS NULL OR base_price = 0 THEN 
            CASE 
              WHEN price > 0 THEN ROUND(price / 1.21, 2)
              ELSE price
            END
          ELSE base_price
        END
        WHERE base_price IS NULL OR base_price = 0
      `);
      console.log(`✅ Updated base_price for ${updateResult.affectedRows} products`);
    } catch (error) {
      console.log(`⚠️  Error updating base_price: ${error.message}`);
    }
    
    // Handle product_images table
    console.log('\n🖼️  Checking product_images table...');
    
    try {
      const [imageColumns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_images'
        ORDER BY ORDINAL_POSITION
      `, [dbName]);
      
      const existingImageColumns = imageColumns.map(col => col.COLUMN_NAME.toLowerCase());
      
      if (!existingImageColumns.includes('sort_order')) {
        try {
          await connection.execute('ALTER TABLE product_images ADD COLUMN sort_order INT DEFAULT 0 AFTER is_main');
          console.log('✅ Added sort_order column to product_images table');
          
          // Update sort_order for existing images
          await connection.execute('UPDATE product_images SET sort_order = id WHERE sort_order = 0');
          console.log('✅ Updated sort_order for existing images');
        } catch (error) {
          console.log(`⚠️  Error adding sort_order: ${error.message}`);
        }
      } else {
        console.log('⏭️  sort_order column already exists in product_images');
      }
    } catch (error) {
      console.log(`⚠️  product_images table not found or error: ${error.message}`);
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration results...');
    
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      AND COLUMN_NAME IN ('features', 'specifications_text', 'whats_included', 'usage_instructions', 'warranty_period', 'return_policy', 'base_price')
      ORDER BY ORDINAL_POSITION
    `, [dbName]);
    
    console.log('New columns in products table:');
    verifyColumns.forEach(col => {
      console.log(`  ✅ ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // Check sample data
    const [sampleProducts] = await connection.execute(`
      SELECT id, name, price, base_price, features, warranty_period, return_policy
      FROM products 
      LIMIT 3
    `);
    
    console.log('\nSample product data:');
    if (sampleProducts.length > 0) {
      sampleProducts.forEach(product => {
        console.log(`  📦 ID: ${product.id} - ${product.name}`);
        console.log(`     💰 Price: $${product.price} | Base: $${product.base_price || 'NULL'}`);
        console.log(`     🔧 Features: ${product.features || 'NULL'}`);
        console.log(`     🛡️  Warranty: ${product.warranty_period || 'NULL'}`);
        console.log(`     🔄 Returns: ${product.return_policy || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('  📭 No products found in database');
    }
    
    console.log('🎉 Database migration completed successfully!');
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Added ${addedColumns} new columns`);
    console.log(`  ⏭️  ${existingColumns} columns already existed`);
    console.log(`  🗄️  Database: ${dbName}`);
    console.log(`  📋 Total product columns: ${productColumns.length + addedColumns}`);
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. 🌐 Test seller add-product form at /seller/add-product.html');
    console.log('  2. 👁️  Test buyer product-detail page');
    console.log('  3. 📝 Create sample products with new information');
    console.log('  4. 🧪 Use test-product-form.html for testing');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
applyDatabaseMigration();