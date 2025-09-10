const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'african_deals_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function setupLocalMarketData() {
  try {
    console.log('🏪 Setting up Local Market test data...');

    // Create local_market_categories table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS local_market_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        color VARCHAR(50),
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create local_market_products table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS local_market_products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        unit_type VARCHAR(50) DEFAULT 'piece',
        stock_quantity INT DEFAULT 0,
        minimum_order INT DEFAULT 1,
        maximum_order INT DEFAULT 100,
        main_image VARCHAR(500),
        images JSON,
        category_id INT,
        seller_id INT,
        is_organic BOOLEAN DEFAULT FALSE,
        is_local_produce BOOLEAN DEFAULT TRUE,
        expiry_date DATE,
        storage_requirements TEXT,
        nutritional_info JSON,
        origin_location VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES local_market_categories(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
    `);

    // Insert sample categories
    const categories = [
      { name: 'Vegetables', description: 'Fresh vegetables and greens', icon: 'fas fa-carrot', color: '#10b981' },
      { name: 'Fruits', description: 'Fresh seasonal fruits', icon: 'fas fa-apple-alt', color: '#f59e0b' },
      { name: 'Dairy', description: 'Milk, cheese, eggs and dairy products', icon: 'fas fa-glass-whiskey', color: '#3b82f6' },
      { name: 'Bakery', description: 'Fresh bread and baked goods', icon: 'fas fa-bread-slice', color: '#8b5cf6' },
      { name: 'Meat & Fish', description: 'Fresh meat and seafood', icon: 'fas fa-fish', color: '#ef4444' },
      { name: 'Grains & Cereals', description: 'Rice, beans, flour and grains', icon: 'fas fa-seedling', color: '#84cc16' }
    ];

    for (const category of categories) {
      await pool.execute(`
        INSERT IGNORE INTO local_market_categories (name, description, icon, color)
        VALUES (?, ?, ?, ?)
      `, [category.name, category.description, category.icon, category.color]);
    }

    // Create a test seller user if it doesn't exist
    await pool.execute(`
      INSERT IGNORE INTO users (id, username, email, password, full_name, role, is_active, city, address, latitude, longitude, rating, total_sales)
      VALUES 
      (1001, 'localmarket1', 'localmarket1@test.com', '$2b$10$dummy', 'Local Farm Market', 'seller', 1, 'Kigali', 'Kimisagara, Kigali', -1.9441, 30.0619, 4.5, 150),
      (1002, 'localmarket2', 'localmarket2@test.com', '$2b$10$dummy', 'Fruit Paradise', 'seller', 1, 'Kigali', 'Nyamirambo, Kigali', -1.9500, 30.0700, 4.8, 200),
      (1003, 'localmarket3', 'localmarket3@test.com', '$2b$10$dummy', 'Dairy Fresh', 'seller', 1, 'Kigali', 'Kacyiru, Kigali', -1.9300, 30.0800, 4.6, 120),
      (1004, 'localmarket4', 'localmarket4@test.com', '$2b$10$dummy', 'City Bakery', 'seller', 1, 'Kigali', 'City Center, Kigali', -1.9400, 30.0600, 4.3, 80)
    `);

    // Get category IDs
    const [categoryRows] = await pool.execute('SELECT id, name FROM local_market_categories');
    const categoryMap = {};
    categoryRows.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    // Insert sample products
    const products = [
      {
        name: 'Fresh Tomatoes',
        description: 'Locally grown fresh tomatoes, perfect for cooking and salads',
        price: 800,
        unit_type: 'kg',
        stock_quantity: 50,
        category: 'Vegetables',
        seller_id: 1001,
        is_organic: true
      },
      {
        name: 'Fresh Bananas',
        description: 'Sweet and ripe bananas from local farms',
        price: 500,
        unit_type: 'bunch',
        stock_quantity: 30,
        category: 'Fruits',
        seller_id: 1002,
        is_organic: false
      },
      {
        name: 'Fresh Milk',
        description: 'Pure fresh milk from local dairy farms',
        price: 600,
        unit_type: 'liter',
        stock_quantity: 20,
        category: 'Dairy',
        seller_id: 1003,
        is_organic: true
      },
      {
        name: 'Whole Wheat Bread',
        description: 'Freshly baked whole wheat bread',
        price: 1200,
        unit_type: 'loaf',
        stock_quantity: 15,
        category: 'Bakery',
        seller_id: 1004,
        is_organic: false
      },
      {
        name: 'Fresh Carrots',
        description: 'Crunchy and sweet carrots, rich in vitamins',
        price: 700,
        unit_type: 'kg',
        stock_quantity: 40,
        category: 'Vegetables',
        seller_id: 1001,
        is_organic: true
      },
      {
        name: 'Fresh Eggs',
        description: 'Farm-fresh eggs from free-range chickens',
        price: 300,
        unit_type: 'dozen',
        stock_quantity: 25,
        category: 'Dairy',
        seller_id: 1003,
        is_organic: true
      },
      {
        name: 'Sweet Potatoes',
        description: 'Nutritious sweet potatoes, great for roasting',
        price: 600,
        unit_type: 'kg',
        stock_quantity: 35,
        category: 'Vegetables',
        seller_id: 1001,
        is_organic: true
      },
      {
        name: 'Fresh Oranges',
        description: 'Juicy oranges packed with vitamin C',
        price: 800,
        unit_type: 'kg',
        stock_quantity: 45,
        category: 'Fruits',
        seller_id: 1002,
        is_organic: false
      }
    ];

    for (const product of products) {
      await pool.execute(`
        INSERT IGNORE INTO local_market_products 
        (name, description, price, unit_type, stock_quantity, category_id, seller_id, is_organic, main_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.name,
        product.description,
        product.price,
        product.unit_type,
        product.stock_quantity,
        categoryMap[product.category],
        product.seller_id,
        product.is_organic,
        '/public/images/logo.png' // Using logo as placeholder
      ]);
    }

    console.log('✅ Local Market test data setup completed!');
    
    // Verify data
    const [productCount] = await pool.execute('SELECT COUNT(*) as count FROM local_market_products');
    const [categoryCount] = await pool.execute('SELECT COUNT(*) as count FROM local_market_categories');
    
    console.log(`📊 Created ${categoryCount[0].count} categories and ${productCount[0].count} products`);

  } catch (error) {
    console.error('❌ Error setting up Local Market data:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupLocalMarketData();