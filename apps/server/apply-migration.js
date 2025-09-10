const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_products',
  multipleStatements: true
};

async function applyDatabaseMigration() {
  let connection;
  
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');
    console.log(`📍 Database: ${dbConfig.database} on ${dbConfig.host}`);
    
    // Check current database structure
    console.log('\n📋 Checking current database structure...');
    
    // Check products table columns
    const [productColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    console.log('Current products table columns:');
    productColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });
    
    // Check product_images table columns
    const [imageColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_images'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    console.log('\nCurrent product_images table columns:');
    imageColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
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
    
    // Add missing columns to products table
    for (const column of newProductColumns) {
      if (!existingProductColumns.includes(column.name.toLowerCase())) {
        try {
          const sql = `ALTER TABLE products ADD COLUMN ${column.name} ${column.definition} ${column.position}`;
          await connection.execute(sql);
          console.log(`✅ Added column: ${column.name} - ${column.description}`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  Column ${column.name} already exists`);
          } else {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
          }
        }
      } else {
        console.log(`⏭️  Column ${column.name} already exists`);
      }
    }
    
    // Update base_price for existing products
    console.log('\n💰 Updating base_price for existing products...');
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
    
    // Handle product_images table
    console.log('\n🖼️  Checking product_images table...');
    const existingImageColumns = imageColumns.map(col => col.COLUMN_NAME.toLowerCase());
    
    if (!existingImageColumns.includes('sort_order')) {
      try {
        await connection.execute('ALTER TABLE product_images ADD COLUMN sort_order INT DEFAULT 0 AFTER is_main');
        console.log('✅ Added sort_order column to product_images table');
        
        // Update sort_order for existing images
        await connection.execute('UPDATE product_images SET sort_order = id WHERE sort_order = 0');
        console.log('✅ Updated sort_order for existing images');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  sort_order column already exists in product_images');
        } else {
          console.error('❌ Error adding sort_order column:', error.message);
        }
      }
    } else {
      console.log('⏭️  sort_order column already exists in product_images');
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration results...');
    
    const [verifyColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'
      AND COLUMN_NAME IN ('features', 'specifications_text', 'whats_included', 'usage_instructions', 'warranty_period', 'return_policy', 'base_price')
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);
    
    console.log('New columns added to products table:');
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
        console.log(`  - ID: ${product.id}, Name: ${product.name}`);
        console.log(`    Price: $${product.price}, Base Price: $${product.base_price || 'NULL'}`);
        console.log(`    Features: ${product.features || 'NULL'}`);
        console.log(`    Warranty: ${product.warranty_period || 'NULL'}`);
        console.log(`    Returns: ${product.return_policy || 'NULL'}`);
      });
    } else {
      console.log('  No products found in database');
    }
    
    console.log('\n🎉 Database migration completed successfully!');
    console.log('\n📝 Summary of changes:');
    console.log('  ✅ Added 7 new columns to products table');
    console.log('  ✅ Added sort_order column to product_images table');
    console.log('  ✅ Updated base_price for existing products');
    console.log('  ✅ All changes are backward compatible');
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Test the seller add-product form');
    console.log('  2. Test the buyer product-detail page');
    console.log('  3. Create sample products with new information');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
console.log('🚀 ADD Physical Products - Database Migration');
console.log('==========================================\n');

applyDatabaseMigration();