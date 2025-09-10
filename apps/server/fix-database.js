const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function fixDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST||'localhost',
    user: process.env.DB_USER||'root',
    password: process.env.DB_PASSWORD||'',
    database: process.env.DB_NAME||'add_physical_product',
    port: process.env.DB_PORT||3333,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔧 Fixing database structure...');
    
    // Backup existing data
    const [existingProducts] = await pool.execute('SELECT * FROM products');
    console.log(`📦 Backing up ${existingProducts.length} existing products...`);
    
    // Drop dependent tables first (in reverse order of dependencies)
    console.log('🗑️ Dropping dependent tables...');
    await pool.execute('DROP TABLE IF EXISTS product_images');
    await pool.execute('DROP TABLE IF EXISTS order_items');
    await pool.execute('DROP TABLE IF EXISTS products');
    
    // Create products table with correct structure
    console.log('🏗️ Creating products table with correct structure...');
    await pool.execute(`
      CREATE TABLE products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category_id INT NOT NULL,
        brand VARCHAR(255),
        sku VARCHAR(100),
        \`condition\` ENUM('new', 'used', 'refurbished') DEFAULT 'new',
        price DECIMAL(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        discount_price DECIMAL(12,2),
        moq INT DEFAULT 1,
        stock INT DEFAULT 0,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES product_categories(id),
        FOREIGN KEY (seller_id) REFERENCES users(id),
        INDEX idx_category (category_id),
        INDEX idx_seller (seller_id),
        INDEX idx_active (is_active),
        INDEX idx_price (price),
        INDEX idx_created (created_at)
      )
    `);
    
    console.log('✅ Products table recreated with correct structure');
    
    // Create product_images table
    console.log('🖼️ Creating product_images table...');
    await pool.execute(`
      CREATE TABLE product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product (product_id)
      )
    `);
    
    console.log('✅ Product images table created');
    
    // Create order_items table (if it existed before)
    console.log('📦 Creating order_items table...');
    await pool.execute(`
      CREATE TABLE order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_order (order_id),
        INDEX idx_product (product_id)
      )
    `);
    
    console.log('✅ Order items table created');
    
    // Restore existing products with default category_id = 1 (Electronics)
    if (existingProducts.length > 0) {
      console.log('🔄 Restoring existing products...');
      for (const product of existingProducts) {
        await pool.execute(`
          INSERT INTO products (
            name, description, category_id, brand, sku, \`condition\`,
            price, currency, stock, seller_id, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.name,
          product.description,
          1, // Default to Electronics category
          null, // brand
          null, // sku
          'new', // condition
          product.price,
          'USD', // currency
          product.stock || 0,
          product.seller_id,
          true, // is_active
          product.created_at
        ]);
      }
      console.log(`✅ Restored ${existingProducts.length} products`);
    }
    
    await pool.end();
    console.log('🎉 Database structure fixed successfully!');
  } catch (error) {
    console.error('❌ Database fix failed:', error.message);
    await pool.end();
  }
}

fixDatabase(); 