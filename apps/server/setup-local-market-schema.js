const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function setupLocalMarketSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_db'
  });

  try {
    console.log('🏪 Setting up Local Market database schema...');

    // Create local_market_categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(20),
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_name (name)
      )
    `);
    console.log('✅ Created local_market_categories table');

    // Create local_market_products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        seller_id INT NOT NULL,
        category_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        unit_type VARCHAR(50) NOT NULL DEFAULT 'piece',
        stock_quantity INT NOT NULL DEFAULT 0,
        minimum_order INT DEFAULT 1,
        maximum_order INT DEFAULT NULL,
        main_image VARCHAR(500),
        images JSON,
        is_organic BOOLEAN DEFAULT FALSE,
        is_local_produce BOOLEAN DEFAULT TRUE,
        expiry_date DATE NULL,
        storage_requirements TEXT,
        nutritional_info JSON,
        origin_location VARCHAR(200),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES local_market_categories(id) ON DELETE RESTRICT,
        INDEX idx_seller (seller_id),
        INDEX idx_category (category_id),
        INDEX idx_active (is_active),
        INDEX idx_price (price),
        INDEX idx_stock (stock_quantity)
      )
    `);
    console.log('✅ Created local_market_products table');

    // Create local_market_orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        buyer_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        delivery_address TEXT NOT NULL,
        delivery_phone VARCHAR(20),
        delivery_notes TEXT,
        delivery_latitude DECIMAL(10,8),
        delivery_longitude DECIMAL(11,8),
        payment_method ENUM('mobile_money', 'bank_transfer', 'cash_on_delivery') DEFAULT 'mobile_money',
        payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
        payment_proof VARCHAR(500),
        payment_reference VARCHAR(100),
        status ENUM('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled') DEFAULT 'pending',
        agent_id INT NULL,
        delivery_code VARCHAR(10),
        delivered_at TIMESTAMP NULL,
        delivery_confirmed_at TIMESTAMP NULL,
        delivery_confirmation_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        INDEX idx_buyer (buyer_id),
        INDEX idx_status (status),
        INDEX idx_payment_status (payment_status),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ Created local_market_orders table');

    // Create local_market_order_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        seller_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES local_market_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES local_market_products(id) ON DELETE RESTRICT,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_order (order_id),
        INDEX idx_product (product_id),
        INDEX idx_seller (seller_id)
      )
    `);
    console.log('✅ Created local_market_order_items table');

    // Create local_market_order_tracking table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_order_tracking (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT,
        location_lat DECIMAL(10,8),
        location_lng DECIMAL(11,8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES local_market_orders(id) ON DELETE CASCADE,
        INDEX idx_order (order_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ Created local_market_order_tracking table');

    // Create local_market_reviews table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS local_market_reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        buyer_id INT NOT NULL,
        seller_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES local_market_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES local_market_products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_review (order_id, buyer_id, product_id),
        INDEX idx_seller (seller_id),
        INDEX idx_product (product_id),
        INDEX idx_rating (rating)
      )
    `);
    console.log('✅ Created local_market_reviews table');

    // Insert default categories
    const defaultCategories = [
      { name: 'Fresh Fruits', description: 'Fresh seasonal fruits', icon: 'fas fa-apple-alt', color: '#f59e0b' },
      { name: 'Vegetables', description: 'Fresh vegetables and greens', icon: 'fas fa-carrot', color: '#10b981' },
      { name: 'Dairy & Eggs', description: 'Milk, cheese, eggs and dairy products', icon: 'fas fa-cheese', color: '#3b82f6' },
      { name: 'Meat & Poultry', description: 'Fresh meat and poultry', icon: 'fas fa-drumstick-bite', color: '#dc2626' },
      { name: 'Fish & Seafood', description: 'Fresh fish and seafood', icon: 'fas fa-fish', color: '#0ea5e9' },
      { name: 'Grains & Cereals', description: 'Rice, wheat, maize and other grains', icon: 'fas fa-seedling', color: '#d97706' },
      { name: 'Spices & Herbs', description: 'Fresh and dried spices and herbs', icon: 'fas fa-pepper-hot', color: '#dc2626' },
      { name: 'Beverages', description: 'Fresh juices and local drinks', icon: 'fas fa-glass-whiskey', color: '#7c3aed' },
      { name: 'Bakery', description: 'Fresh bread and baked goods', icon: 'fas fa-bread-slice', color: '#92400e' },
      { name: 'Snacks', description: 'Local snacks and treats', icon: 'fas fa-cookie-bite', color: '#f59e0b' }
    ];

    for (const category of defaultCategories) {
      await connection.execute(`
        INSERT IGNORE INTO local_market_categories (name, description, icon, color)
        VALUES (?, ?, ?, ?)
      `, [category.name, category.description, category.icon, category.color]);
    }
    console.log('✅ Inserted default categories');

    // Insert sample products (optional)
    const sampleProducts = [
      {
        seller_id: 1, // Assuming user ID 1 exists
        category_id: 1, // Fresh Fruits
        name: 'Fresh Bananas',
        description: 'Sweet and ripe bananas from local farms',
        price: 500,
        unit_type: 'bunch',
        stock_quantity: 50,
        is_organic: true,
        origin_location: 'Kigali, Rwanda'
      },
      {
        seller_id: 1,
        category_id: 2, // Vegetables
        name: 'Fresh Tomatoes',
        description: 'Red ripe tomatoes perfect for cooking',
        price: 800,
        unit_type: 'kg',
        stock_quantity: 30,
        is_organic: false,
        origin_location: 'Musanze, Rwanda'
      },
      {
        seller_id: 1,
        category_id: 3, // Dairy & Eggs
        name: 'Farm Fresh Eggs',
        description: 'Free-range chicken eggs from local farms',
        price: 200,
        unit_type: 'piece',
        stock_quantity: 100,
        is_organic: true,
        origin_location: 'Nyagatare, Rwanda'
      }
    ];

    // Check if user ID 1 exists before inserting sample products
    const [users] = await connection.execute('SELECT id FROM users LIMIT 1');
    if (users.length > 0) {
      const userId = users[0].id;
      
      for (const product of sampleProducts) {
        product.seller_id = userId;
        await connection.execute(`
          INSERT IGNORE INTO local_market_products (
            seller_id, category_id, name, description, price, unit_type, 
            stock_quantity, is_organic, origin_location
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.seller_id, product.category_id, product.name, product.description,
          product.price, product.unit_type, product.stock_quantity, 
          product.is_organic, product.origin_location
        ]);
      }
      console.log('✅ Inserted sample products');
    }

    console.log('🎉 Local Market database schema setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupLocalMarketSchema();