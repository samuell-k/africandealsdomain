const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertLocalMarketProducts() {
  console.log('🛒 Inserting Sample Local Market Products...\n');

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

    // First, ensure we have the necessary tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id INT DEFAULT NULL,
        image_url VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        INDEX idx_parent_id (parent_id),
        INDEX idx_is_active (is_active)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INT,
        seller_id INT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        stock_quantity INT DEFAULT 0,
        min_order_quantity INT DEFAULT 1,
        max_order_quantity INT DEFAULT NULL,
        weight DECIMAL(8,2),
        dimensions VARCHAR(100),
        brand VARCHAR(100),
        model VARCHAR(100),
        color VARCHAR(50),
        size VARCHAR(50),
        material VARCHAR(100),
        condition_type ENUM('new', 'used', 'refurbished') DEFAULT 'new',
        warranty_period VARCHAR(50),
        return_policy TEXT,
        shipping_info TEXT,
        tags JSON,
        images JSON,
        specifications JSON,
        is_active BOOLEAN DEFAULT TRUE,
        is_featured BOOLEAN DEFAULT FALSE,
        is_digital BOOLEAN DEFAULT FALSE,
        marketplace_type ENUM('physical', 'grocery', 'both') DEFAULT 'physical',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_category_id (category_id),
        INDEX idx_seller_id (seller_id),
        INDEX idx_is_active (is_active),
        INDEX idx_is_featured (is_featured),
        INDEX idx_marketplace_type (marketplace_type),
        INDEX idx_price (price)
      )
    `);

    // Insert categories for local market
    const categories = [
      { name: 'Fresh Produce', description: 'Fresh fruits and vegetables from local farms' },
      { name: 'Grains & Cereals', description: 'Rice, maize, wheat, and other grains' },
      { name: 'Dairy & Eggs', description: 'Fresh milk, cheese, yogurt, and eggs' },
      { name: 'Meat & Poultry', description: 'Fresh meat, chicken, and fish' },
      { name: 'Spices & Seasonings', description: 'Local spices and cooking seasonings' },
      { name: 'Beverages', description: 'Local drinks, juices, and traditional beverages' },
      { name: 'Snacks & Sweets', description: 'Local snacks, sweets, and traditional treats' },
      { name: 'Household Items', description: 'Basic household necessities and cleaning supplies' },
      { name: 'Traditional Crafts', description: 'Handmade crafts and traditional items' },
      { name: 'Personal Care', description: 'Soaps, lotions, and personal hygiene products' }
    ];

    console.log('📂 Inserting categories...');
    for (const category of categories) {
      await connection.execute(
        'INSERT IGNORE INTO categories (name, description) VALUES (?, ?)',
        [category.name, category.description]
      );
    }
    console.log('✅ Categories inserted');

    // Create a default seller if none exists
    const [sellers] = await connection.execute('SELECT id FROM users WHERE role = "seller" LIMIT 1');
    let sellerId;
    
    if (sellers.length === 0) {
      // Create a default seller
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('seller123', 10);
      
      const [sellerResult] = await connection.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'localmarket_seller',
        'localmarket@example.com',
        hashedPassword,
        'seller',
        'Local',
        'Market',
        '+250788123456',
        1,
        1
      ]);
      sellerId = sellerResult.insertId;
      console.log('✅ Created default seller');
    } else {
      sellerId = sellers[0].id;
      console.log('✅ Using existing seller');
    }

    // Get category IDs
    const [categoryResults] = await connection.execute('SELECT id, name FROM categories');
    const categoryMap = {};
    categoryResults.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    // Sample products for local market
    const products = [
      // Fresh Produce
      {
        name: 'Fresh Tomatoes',
        description: 'Locally grown fresh tomatoes, perfect for cooking and salads',
        category: 'Fresh Produce',
        price: 800,
        original_price: 1000,
        stock_quantity: 50,
        weight: 1.0,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['fresh', 'local', 'organic', 'vegetables'],
        images: ['/images/products/tomatoes.jpg'],
        specifications: { origin: 'Rwanda', harvest_date: '2024-08-01', shelf_life: '7 days' }
      },
      {
        name: 'Sweet Bananas',
        description: 'Sweet and ripe bananas from local plantations',
        category: 'Fresh Produce',
        price: 500,
        stock_quantity: 100,
        weight: 0.5,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['fresh', 'local', 'fruit', 'sweet'],
        images: ['/images/products/bananas.jpg'],
        specifications: { origin: 'Rwanda', ripeness: 'perfect', shelf_life: '5 days' }
      },
      {
        name: 'Fresh Avocados',
        description: 'Creamy and nutritious avocados, ready to eat',
        category: 'Fresh Produce',
        price: 1200,
        original_price: 1500,
        stock_quantity: 30,
        weight: 0.3,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['fresh', 'local', 'fruit', 'healthy'],
        images: ['/images/products/avocados.jpg'],
        specifications: { origin: 'Rwanda', ripeness: 'ready', shelf_life: '4 days' }
      },
      {
        name: 'Green Vegetables Mix',
        description: 'Fresh mix of local green vegetables including spinach and kale',
        category: 'Fresh Produce',
        price: 600,
        stock_quantity: 40,
        weight: 0.5,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['fresh', 'local', 'vegetables', 'healthy'],
        images: ['/images/products/green-vegetables.jpg'],
        specifications: { origin: 'Rwanda', harvest_date: '2024-08-01', shelf_life: '3 days' }
      },

      // Grains & Cereals
      {
        name: 'Local White Rice',
        description: 'High-quality white rice grown in Rwanda',
        category: 'Grains & Cereals',
        price: 2500,
        stock_quantity: 20,
        weight: 5.0,
        brand: 'Rwanda Rice',
        condition_type: 'new',
        marketplace_type: 'grocery',
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
        marketplace_type: 'grocery',
        tags: ['flour', 'maize', 'local', 'fresh'],
        images: ['/images/products/maize-flour.jpg'],
        specifications: { origin: 'Rwanda', grind_date: '2024-08-01', shelf_life: '6 months' }
      },

      // Dairy & Eggs
      {
        name: 'Fresh Cow Milk',
        description: 'Fresh milk from local dairy farms, pasteurized',
        category: 'Dairy & Eggs',
        price: 1000,
        stock_quantity: 15,
        weight: 1.0,
        brand: 'Local Dairy',
        condition_type: 'new',
        marketplace_type: 'grocery',
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
        marketplace_type: 'grocery',
        tags: ['eggs', 'fresh', 'free-range', 'local'],
        images: ['/images/products/fresh-eggs.jpg'],
        specifications: { origin: 'Rwanda', type: 'free-range', shelf_life: '14 days', quantity: '30 pieces' }
      },

      // Meat & Poultry
      {
        name: 'Fresh Chicken',
        description: 'Fresh whole chicken from local farms',
        category: 'Meat & Poultry',
        price: 8000,
        stock_quantity: 10,
        weight: 2.0,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['chicken', 'fresh', 'local', 'poultry'],
        images: ['/images/products/fresh-chicken.jpg'],
        specifications: { origin: 'Rwanda', type: 'whole chicken', shelf_life: '2 days', weight: '2kg average' }
      },
      {
        name: 'Fresh Fish',
        description: 'Fresh fish from Lake Kivu',
        category: 'Meat & Poultry',
        price: 6000,
        stock_quantity: 8,
        weight: 1.5,
        brand: 'Lake Kivu',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['fish', 'fresh', 'local', 'lake'],
        images: ['/images/products/fresh-fish.jpg'],
        specifications: { origin: 'Lake Kivu', type: 'tilapia', shelf_life: '1 day', weight: '1.5kg average' }
      },

      // Spices & Seasonings
      {
        name: 'Local Curry Powder',
        description: 'Traditional Rwandan curry powder blend',
        category: 'Spices & Seasonings',
        price: 1500,
        stock_quantity: 20,
        weight: 0.2,
        brand: 'Traditional Spices',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['spices', 'curry', 'traditional', 'local'],
        images: ['/images/products/curry-powder.jpg'],
        specifications: { origin: 'Rwanda', blend: 'traditional', shelf_life: '18 months' }
      },
      {
        name: 'Ginger Root',
        description: 'Fresh ginger root for cooking and tea',
        category: 'Spices & Seasonings',
        price: 800,
        stock_quantity: 25,
        weight: 0.3,
        brand: 'Local Farm',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['ginger', 'fresh', 'spice', 'local'],
        images: ['/images/products/ginger-root.jpg'],
        specifications: { origin: 'Rwanda', type: 'fresh root', shelf_life: '14 days' }
      },

      // Beverages
      {
        name: 'Traditional Banana Beer',
        description: 'Traditional Rwandan banana beer (Urwagwa)',
        category: 'Beverages',
        price: 2000,
        stock_quantity: 12,
        weight: 0.5,
        brand: 'Traditional Brew',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['traditional', 'beer', 'banana', 'local'],
        images: ['/images/products/banana-beer.jpg'],
        specifications: { origin: 'Rwanda', type: 'traditional', alcohol_content: '4%', shelf_life: '30 days' }
      },
      {
        name: 'Fresh Passion Fruit Juice',
        description: 'Fresh passion fruit juice, no preservatives',
        category: 'Beverages',
        price: 1200,
        stock_quantity: 18,
        weight: 0.5,
        brand: 'Local Juice',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['juice', 'fresh', 'passion fruit', 'natural'],
        images: ['/images/products/passion-juice.jpg'],
        specifications: { origin: 'Rwanda', type: 'fresh squeezed', shelf_life: '3 days' }
      },

      // Snacks & Sweets
      {
        name: 'Roasted Groundnuts',
        description: 'Locally roasted groundnuts, perfect snack',
        category: 'Snacks & Sweets',
        price: 1000,
        stock_quantity: 30,
        weight: 0.5,
        brand: 'Local Roastery',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['groundnuts', 'roasted', 'snack', 'local'],
        images: ['/images/products/roasted-groundnuts.jpg'],
        specifications: { origin: 'Rwanda', roast_level: 'medium', shelf_life: '60 days' }
      },
      {
        name: 'Honey',
        description: 'Pure natural honey from local beekeepers',
        category: 'Snacks & Sweets',
        price: 4000,
        stock_quantity: 15,
        weight: 0.5,
        brand: 'Local Beekeepers',
        condition_type: 'new',
        marketplace_type: 'grocery',
        tags: ['honey', 'natural', 'pure', 'local'],
        images: ['/images/products/natural-honey.jpg'],
        specifications: { origin: 'Rwanda', type: 'wildflower', shelf_life: '24 months' }
      },

      // Household Items
      {
        name: 'Natural Soap',
        description: 'Handmade natural soap with local ingredients',
        category: 'Household Items',
        price: 800,
        stock_quantity: 40,
        weight: 0.1,
        brand: 'Local Crafts',
        condition_type: 'new',
        marketplace_type: 'physical',
        tags: ['soap', 'natural', 'handmade', 'local'],
        images: ['/images/products/natural-soap.jpg'],
        specifications: { origin: 'Rwanda', ingredients: 'natural oils', shelf_life: '12 months' }
      },
      {
        name: 'Woven Basket',
        description: 'Traditional woven basket for storage',
        category: 'Household Items',
        price: 5000,
        stock_quantity: 10,
        weight: 0.8,
        brand: 'Traditional Crafts',
        condition_type: 'new',
        marketplace_type: 'physical',
        tags: ['basket', 'woven', 'traditional', 'storage'],
        images: ['/images/products/woven-basket.jpg'],
        specifications: { origin: 'Rwanda', material: 'natural fiber', size: 'medium' }
      },

      // Traditional Crafts
      {
        name: 'Traditional Pottery',
        description: 'Handmade traditional pottery for cooking',
        category: 'Traditional Crafts',
        price: 8000,
        stock_quantity: 5,
        weight: 2.0,
        brand: 'Local Artisans',
        condition_type: 'new',
        marketplace_type: 'physical',
        tags: ['pottery', 'traditional', 'handmade', 'cooking'],
        images: ['/images/products/traditional-pottery.jpg'],
        specifications: { origin: 'Rwanda', material: 'clay', type: 'cooking pot', size: 'large' }
      },
      {
        name: 'Handwoven Fabric',
        description: 'Beautiful handwoven fabric with traditional patterns',
        category: 'Traditional Crafts',
        price: 12000,
        stock_quantity: 8,
        weight: 0.5,
        brand: 'Local Weavers',
        condition_type: 'new',
        marketplace_type: 'physical',
        tags: ['fabric', 'handwoven', 'traditional', 'patterns'],
        images: ['/images/products/handwoven-fabric.jpg'],
        specifications: { origin: 'Rwanda', material: 'cotton', pattern: 'traditional', length: '2 meters' }
      }
    ];

    console.log('🛍️ Inserting products...');
    let insertedCount = 0;

    for (const product of products) {
      const categoryId = categoryMap[product.category];
      if (!categoryId) {
        console.log(`⚠️ Category '${product.category}' not found, skipping product: ${product.name}`);
        continue;
      }

      try {
        await connection.execute(`
          INSERT INTO products (
            name, description, category_id, seller_id, price, discount_price,
            stock_quantity, weight, brand, \`condition\`, currency,
            tags, main_image, specifications, is_active, moq
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.name,
          product.description,
          categoryId,
          sellerId,
          product.price,
          product.original_price && product.original_price !== product.price ? product.original_price : null,
          product.stock_quantity,
          product.weight,
          product.brand,
          product.condition_type,
          'RWF', // Rwanda Francs
          product.tags.join(','), // Store as comma-separated string
          product.images[0] || null, // First image as main image
          JSON.stringify(product.specifications),
          1, // is_active
          1 // minimum order quantity
        ]);
        insertedCount++;
        console.log(`✅ Inserted: ${product.name}`);
      } catch (error) {
        console.log(`❌ Failed to insert ${product.name}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Successfully inserted ${insertedCount} products!`);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                LOCAL MARKET PRODUCTS READY                ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ ${insertedCount} products added to local market`);
    console.log('✅ Categories created and organized');
    console.log('✅ Products ready for browsing and purchasing');
    console.log('✅ Mix of grocery and physical marketplace items');

  } catch (error) {
    console.error('❌ Error inserting products:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

insertLocalMarketProducts();