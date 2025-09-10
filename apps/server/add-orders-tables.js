const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupOrdersTables() {
  let connection;
  
  try {
    console.log('🚀 Setting up orders and order_items tables...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    });

    console.log('✅ Connected to database');

    // Drop existing tables if they exist to ensure clean schema
    console.log('🗑️ Dropping existing orders and order_items tables...');

    // Temporarily disable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    await connection.execute('DROP TABLE IF EXISTS order_items');
    await connection.execute('DROP TABLE IF EXISTS orders');
    
    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
     
    console.log('✅ Existing tables dropped');
  
    // Create orders table with correct schema
    console.log('📋 Creating orders table...');
    await connection.execute(`
      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        shipping_address JSON,
        billing_address JSON,
        payment_method VARCHAR(50),
        tracking_number VARCHAR(100),
        estimated_delivery DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_order_number (order_number),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ Orders table created successfully');

    // Create order_items table
    console.log('📋 Creating order_items table...');
    await connection.execute(`
      CREATE TABLE order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order (order_id),
        INDEX idx_product (product_id)
      )
    `);
    console.log('✅ Order_items table created successfully');

    // Check if users table exists and has data
    console.log('👥 Checking users table...');
    const [users] = await connection.execute('SELECT id FROM users LIMIT 1');
    
    let userId;
    if (users.length === 0) {
      console.log('⚠️ No users found. Creating a test user...');
      await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, country, city, address, created_at) 
        VALUES ('Test User', 'test@example.com', '$2b$10$test', 'buyer', '+1234567890', 'Nigeria', 'Lagos', 'Test Address', NOW())
      `);
      const [newUser] = await connection.execute('SELECT id FROM users WHERE email = ?', ['test@example.com']);
      userId = newUser[0].id;
      console.log(`✅ Created test user with ID: ${userId}`);
    } else {
      userId = users[0].id;
      console.log(`✅ Using existing user with ID: ${userId}`);
    }

    // Check if products table exists and has data
    console.log('📦 Checking products table...');
    const [products] = await connection.execute('SELECT id FROM products LIMIT 1');
    
    let productId;
    if (products.length === 0) {
      console.log('⚠️ No products found. Creating a test product...');
      await connection.execute(`
        INSERT INTO products (name, description, price, currency, category_id, seller_id, main_image, created_at) 
        VALUES ('Test Product', 'A test product for orders', 99.99, 'USD', 1, ?, 'placeholder.jpg', NOW())
      `, [userId]);
      const [newProduct] = await connection.execute('SELECT id FROM products WHERE name = ?', ['Test Product']);
      productId = newProduct[0].id;
      console.log(`✅ Created test product with ID: ${productId}`);
    } else {
      productId = products[0].id;
      console.log(`✅ Using existing product with ID: ${productId}`);
    }

    // Insert sample orders
    console.log('📝 Inserting sample orders...');
    await connection.execute(`
      INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, payment_method, tracking_number, estimated_delivery, created_at) VALUES
      (?, 'ORD-2024-001', 999.99, 'delivered',
       '{"name": "John Doe", "address": "123 Main St", "city": "Lagos", "state": "Lagos", "zip": "100001", "country": "Nigeria", "phone": "+2348012345678"}',
       '{"name": "John Doe", "address": "123 Main St", "city": "Lagos", "state": "Lagos", "zip": "100001", "country": "Nigeria"}',
       'Credit Card', 'TRK123456789', '2024-01-20', '2024-01-15 10:30:00'),
      (?, 'ORD-2024-002', 1299.99, 'shipped',
       '{"name": "Jane Smith", "address": "456 Oak Ave", "city": "Nairobi", "state": "Nairobi", "zip": "00100", "country": "Kenya", "phone": "+254701234567"}',
       '{"name": "Jane Smith", "address": "456 Oak Ave", "city": "Nairobi", "state": "Nairobi", "zip": "00100", "country": "Kenya"}',
       'PayPal', 'TRK987654321', '2024-01-25', '2024-01-10 14:20:00'),
      (?, 'ORD-2024-003', 899.99, 'processing',
       '{"name": "Mike Johnson", "address": "789 Pine Rd", "city": "Accra", "state": "Greater Accra", "zip": "00233", "country": "Ghana", "phone": "+233201234567"}',
       '{"name": "Mike Johnson", "address": "789 Pine Rd", "city": "Accra", "state": "Greater Accra", "zip": "00233", "country": "Ghana"}',
       'Bank Transfer', NULL, '2024-01-30', '2024-01-05 09:15:00'),
      (?, 'ORD-2024-004', 1099.99, 'pending',
       '{"name": "Sarah Wilson", "address": "321 Elm St", "city": "Cairo", "state": "Cairo", "zip": "11511", "country": "Egypt", "phone": "+201001234567"}',
       '{"name": "Sarah Wilson", "address": "321 Elm St", "city": "Cairo", "state": "Cairo", "zip": "11511", "country": "Egypt"}',
       'Mobile Money', NULL, '2024-02-05', '2024-01-01 16:45:00')
    `, [userId, userId, userId, userId]);
    console.log('✅ Sample orders inserted successfully');

    // Get the order IDs for order items
    const [orderIds] = await connection.execute('SELECT id FROM orders ORDER BY created_at ASC');
    
    // Insert sample order items
    console.log('📦 Inserting sample order items...');
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i].id;
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = 99.99 + (i * 50);
      const totalPrice = unitPrice * quantity;
      
      await connection.execute(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at) VALUES
        (?, ?, ?, ?, ?, NOW())
      `, [orderId, productId, quantity, unitPrice, totalPrice]);
    }
    console.log('✅ Sample order items inserted successfully');

    console.log('🎉 Orders tables setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupOrdersTables(); 