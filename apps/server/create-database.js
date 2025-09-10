const mysql = require('mysql2/promise');

async function createDatabase() {
  let connection;
  
  try {
    console.log('🔌 Connecting to MySQL...');
    
    // Connect without specifying database
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      port: 3333
    });

    console.log('✅ Connected to MySQL');

    // Create database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS add_physical_product');
    console.log('✅ Database created/verified');

    // Use the database
    await connection.execute('USE add_physical_product');

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INT NOT NULL,
        brand VARCHAR(255),
        sku VARCHAR(100),
        condition ENUM('new', 'used', 'refurbished') DEFAULT 'new',
        price DECIMAL(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        discount_price DECIMAL(12,2),
        moq INT DEFAULT 1,
        stock_quantity INT DEFAULT 0,
        weight DECIMAL(8,2),
        length DECIMAL(8,2),
        width DECIMAL(8,2),
        height DECIMAL(8,2),
        origin_country VARCHAR(10),
        tags TEXT,
        certifications TEXT,
        main_image VARCHAR(255),
        seller_id INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Products table created');

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('buyer', 'seller', 'admin', 'agent') DEFAULT 'buyer',
        phone VARCHAR(32),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create cart table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_product (user_id, product_id)
      )
    `);
    console.log('✅ Cart table created');

    // Create product_categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        parent_id INT NULL,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Product categories table created');

    // Insert sample data
    await connection.execute(`
      INSERT IGNORE INTO users (name, email, password, role) VALUES
      ('Test Buyer', 'buyer@test.com', '$2b$10$example', 'buyer'),
      ('Test Seller', 'seller@test.com', '$2b$10$example', 'seller')
    `);
    console.log('✅ Sample users created');

    await connection.execute(`
      INSERT IGNORE INTO product_categories (name, slug, description) VALUES
      ('Electronics', 'electronics', 'Electronic devices and accessories'),
      ('Clothing', 'clothing', 'Apparel and fashion items')
    `);
    console.log('✅ Sample categories created');

    await connection.execute(`
      INSERT IGNORE INTO products (name, description, category_id, price, main_image, seller_id) VALUES
      ('iPhone 15 Pro', 'Latest iPhone with advanced features', 1, 999.99, 'iphone.jpg', 2),
      ('MacBook Air M2', 'Powerful laptop for professionals', 1, 1299.99, 'macbook.jpg', 2)
    `);
    console.log('✅ Sample products created');

    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

createDatabase(); 