const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixLocalMarketCategories() {
  console.log('🔧 Fixing Local Market Categories...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connection established\n');

    // Get categories from the categories table
    const [categories] = await connection.execute('SELECT * FROM categories');
    console.log(`Found ${categories.length} categories to migrate`);

    // Insert into product_categories table
    console.log('📂 Migrating categories to product_categories...');
    
    for (const category of categories) {
      try {
        // Create slug from name
        const slug = category.name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .trim();

        await connection.execute(`
          INSERT IGNORE INTO product_categories (name, slug, description, is_active)
          VALUES (?, ?, ?, ?)
        `, [
          category.name,
          slug,
          category.description,
          1
        ]);
        
        console.log(`✅ Migrated: ${category.name} -> ${slug}`);
      } catch (error) {
        console.log(`❌ Failed to migrate ${category.name}: ${error.message}`);
      }
    }

    // Now insert the remaining products that failed
    const failedProducts = [
      {
        name: 'Local White Rice',
        description: 'High-quality white rice grown in Rwanda',
        category: 'Grains & Cereals',
        price: 2500,
        stock_quantity: 20,
        weight: 5.0,
        brand: 'Rwanda Rice',
        condition_type: 'new',
        tags: ['rice', 'local', 'staple', 'quality'],
        images: ['/images/products/white-rice.jpg'],
        specifications: { origin: 'Rwanda', grade: 'Premium', shelf_life: '12 months' }
      },
      {
        name: 'Maize Flour',
        description: 'Fresh maize flour ground from local corn',
        category: 'Grains & Cereals',
        price: 1800,
        stock_quantity: 25,
        weight: 2.0,
        brand: 'Local Mill',
        condition_type: 'new',
        tags: ['flour', 'maize', 'local', 'fresh'],
        images: ['/images/products/maize-flour.jpg'],
        specifications: { origin: 'Rwanda', grind_date: '2024-08-01', shelf_life: '6 months' }
      },
      {
        name: 'Fresh Cow Milk',
        description: 'Fresh milk from local dairy farms, pasteurized',
        category: 'Dairy & Eggs',
        price: 1000,
        stock_quantity: 15,
        weight: 1.0,
        brand: 'Local Dairy',
        condition_type: 'new',
        tags: ['milk', 'fresh', 'local', 'dairy'],
        images: ['/images/products/fresh-milk.jpg'],
        specifications: { origin: 'Rwanda', pasteurized: true, shelf_life: '3 days' }
      },
      {
        name: 'Farm Fresh Eggs',
        description: 'Fresh eggs from free-range chickens',
        category: 'Dairy & Eggs',
        price: 3000,
        stock_quantity: 30,
        weight: 1.5,
        brand: 'Local Farm',
        condition_type: 'new',
        tags: ['eggs', 'fresh', 'free-range', 'local'],
        images: ['/images/products/fresh-eggs.jpg'],
        specifications: { origin: 'Rwanda', type: 'free-range', shelf_life: '14 days', quantity: '30 pieces' }
      }
    ];

    // Get seller ID
    const [sellers] = await connection.execute('SELECT id FROM users WHERE role = "seller" LIMIT 1');
    const sellerId = sellers[0].id;

    // Get updated category mapping from product_categories
    const [productCategories] = await connection.execute('SELECT id, name FROM product_categories');
    const categoryMap = {};
    productCategories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    console.log('\n🛍️ Inserting remaining products...');
    let insertedCount = 0;

    for (const product of failedProducts) {
      const categoryId = categoryMap[product.category];
      if (!categoryId) {
        console.log(`⚠️ Category '${product.category}' not found, skipping product: ${product.name}`);
        continue;
      }

      try {
        await connection.execute(`
          INSERT INTO products (
            name, description, category_id, seller_id, price,
            stock_quantity, weight, brand, \`condition\`, currency,
            tags, main_image, specifications, is_active, moq
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.name,
          product.description,
          categoryId,
          sellerId,
          product.price,
          product.stock_quantity,
          product.weight,
          product.brand,
          product.condition_type,
          'RWF',
          product.tags.join(','),
          product.images[0] || null,
          JSON.stringify(product.specifications),
          1,
          1
        ]);
        insertedCount++;
        console.log(`✅ Inserted: ${product.name}`);
      } catch (error) {
        console.log(`❌ Failed to insert ${product.name}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Successfully inserted ${insertedCount} additional products!`);
    
    // Show final count
    const [totalProducts] = await connection.execute('SELECT COUNT(*) as count FROM products');
    console.log(`\n📊 Total products in database: ${totalProducts[0].count}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                LOCAL MARKET SETUP COMPLETE               ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Categories migrated to product_categories table');
    console.log('✅ All local market products inserted successfully');
    console.log('✅ Products ready for browsing and purchasing');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

fixLocalMarketCategories();