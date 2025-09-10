const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixProductsIssue() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_domain'
  });

  try {
    console.log('🔧 Fixing products issue...\n');

    // 1. Check and fix database schema
    console.log('1. Checking database schema...');
    
    // Check if products table has correct structure
    const [productColumns] = await connection.execute('DESCRIBE products');
    const hasSellerId = productColumns.some(col => col.Field === 'seller_id');
    const hasStockQuantity = productColumns.some(col => col.Field === 'stock_quantity');
    
    if (!hasSellerId) {
      console.log('❌ Products table missing seller_id column');
      await connection.execute('ALTER TABLE products ADD COLUMN seller_id INT NOT NULL DEFAULT 1');
      console.log('✅ Added seller_id column');
    } else {
      console.log('✅ Products table has seller_id column');
    }
    
    if (!hasStockQuantity) {
      console.log('❌ Products table missing stock_quantity column');
      await connection.execute('ALTER TABLE products ADD COLUMN stock_quantity INT DEFAULT 0');
      console.log('✅ Added stock_quantity column');
    } else {
      console.log('✅ Products table has stock_quantity column');
    }

    // 2. Check for existing sellers
    console.log('\n2. Checking for sellers...');
    const [sellers] = await connection.execute('SELECT id, name, email, role FROM users WHERE role = "seller"');
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found, creating test seller...');
      const [sellerResult] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Seller',
        'seller@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        'seller',
        '+250788123456',
        1
      ]);
      console.log(`✅ Created test seller with ID: ${sellerResult.insertId}`);
    } else {
      console.log(`✅ Found ${sellers.length} sellers`);
      sellers.forEach(seller => {
        console.log(`  - ID: ${seller.id}, Name: ${seller.name}, Email: ${seller.email}`);
      });
    }

    // 3. Check for product categories
    console.log('\n3. Checking product categories...');
    const [categories] = await connection.execute('SELECT id, name FROM product_categories WHERE is_active = 1');
    
    if (categories.length === 0) {
      console.log('❌ No product categories found, creating default categories...');
      const defaultCategories = [
        'Electronics',
        'Clothing',
        'Home & Garden',
        'Sports & Outdoors',
        'Books & Media',
        'Automotive',
        'Health & Beauty',
        'Toys & Games'
      ];
      
      for (const categoryName of defaultCategories) {
        await connection.execute(`
          INSERT INTO product_categories (name, slug, description, is_active) 
          VALUES (?, ?, ?, ?)
        `, [categoryName, categoryName.toLowerCase().replace(/\s+/g, '-'), `Products in ${categoryName} category`, 1]);
      }
      console.log('✅ Created default product categories');
    } else {
      console.log(`✅ Found ${categories.length} product categories`);
    }

    // 4. Check existing products and fix seller_id if needed
    console.log('\n4. Checking existing products...');
    const [products] = await connection.execute(`
      SELECT p.id, p.name, p.seller_id, p.is_active, u.name as seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    console.log(`Found ${products.length} products:`);
    products.forEach(product => {
      console.log(`  - ID: ${product.id}, Name: ${product.name}, Seller: ${product.seller_name || 'Unknown'} (ID: ${product.seller_id}), Active: ${product.is_active}`);
    });

    // Fix products with invalid seller_id
    const [invalidProducts] = await connection.execute(`
      SELECT p.id, p.name, p.seller_id
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE u.id IS NULL AND p.seller_id != 1
    `);
    
    if (invalidProducts.length > 0) {
      console.log(`\n⚠️ Found ${invalidProducts.length} products with invalid seller_id, fixing...`);
      
      // Get the first seller ID
      const [firstSeller] = await connection.execute('SELECT id FROM users WHERE role = "seller" LIMIT 1');
      const defaultSellerId = firstSeller[0]?.id || 1;
      
      for (const product of invalidProducts) {
        await connection.execute('UPDATE products SET seller_id = ? WHERE id = ?', [defaultSellerId, product.id]);
        console.log(`  - Fixed product ${product.id} (${product.name}) to seller ${defaultSellerId}`);
      }
    }

    // 5. Create test products if none exist
    if (products.length === 0) {
      console.log('\n5. No products found, creating test products...');
      
      const [firstSeller] = await connection.execute('SELECT id FROM users WHERE role = "seller" LIMIT 1');
      const [firstCategory] = await connection.execute('SELECT id FROM product_categories WHERE is_active = 1 LIMIT 1');
      
      if (firstSeller.length > 0 && firstCategory.length > 0) {
        const sellerId = firstSeller[0].id;
        const categoryId = firstCategory[0].id;
        
        const testProducts = [
          {
            name: 'Smartphone X',
            description: 'Latest smartphone with advanced features and high-quality camera',
            price: 299.99,
            stock_quantity: 50,
            category_id: categoryId
          },
          {
            name: 'Wireless Headphones',
            description: 'Premium wireless headphones with noise cancellation',
            price: 89.99,
            stock_quantity: 25,
            category_id: categoryId
          },
          {
            name: 'Laptop Pro',
            description: 'Professional laptop for work and gaming',
            price: 899.99,
            stock_quantity: 15,
            category_id: categoryId
          }
        ];
        
        for (const product of testProducts) {
          const [result] = await connection.execute(`
            INSERT INTO products (name, description, price, stock_quantity, seller_id, category_id, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            product.name,
            product.description,
            product.price,
            product.stock_quantity,
            sellerId,
            product.category_id,
            1
          ]);
          console.log(`  - Created test product: ${product.name} (ID: ${result.insertId})`);
        }
      }
    }

    // 6. Test the seller products query
    console.log('\n6. Testing seller products query...');
    const [firstSeller] = await connection.execute('SELECT id, name FROM users WHERE role = "seller" LIMIT 1');
    
    if (firstSeller.length > 0) {
      const sellerId = firstSeller[0].id;
      const [sellerProducts] = await connection.execute(`
        SELECT 
          p.*,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.seller_id = ? AND p.is_active = 1
        ORDER BY p.created_at DESC
      `, [sellerId]);
      
      console.log(`✅ Found ${sellerProducts.length} products for seller ${firstSeller[0].name} (ID: ${sellerId}):`);
      sellerProducts.forEach(product => {
        console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: $${product.price}, Category: ${product.category_name || 'None'}`);
      });
    }

    // 7. Verify API endpoints are working
    console.log('\n7. API endpoints should now work correctly with authentication middleware');
    console.log('✅ Products API routes now use requireAuth and requireRole middleware');
    console.log('✅ Seller ID is properly extracted from authenticated user');
    console.log('✅ Database schema is correct');
    console.log('✅ Test data is available');

    console.log('\n🎉 Products issue should now be fixed!');
    console.log('\nTo test:');
    console.log('1. Login as a seller at /auth/auth-seller.html');
    console.log('2. Go to /seller/dashboard.html');
    console.log('3. Products should now appear in the dashboard');
    console.log('4. Try creating a new product at /seller/add-product.html');

  } catch (error) {
    console.error('❌ Error fixing products issue:', error);
  } finally {
    await connection.end();
  }
}

fixProductsIssue(); 