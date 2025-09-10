const mysql = require('mysql2/promise');
require('dotenv').config();

async function addSampleData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_domain'
  });

  try {
    console.log('Adding sample data...');

    // Add sample seller user
    const [sellerResult] = await connection.execute(`
      INSERT IGNORE INTO users (name, email, password, role, phone, is_active, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      'John Seller',
      'seller@example.com',
      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
      'seller',
      '+250788123456',
      1
    ]);

    let sellerId;
    if (sellerResult.insertId) {
      sellerId = sellerResult.insertId;
    } else {
      // Get existing seller
      const [existingSeller] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        ['seller@example.com']
      );
      sellerId = existingSeller[0].id;
    }

    // Add sample buyer user
    const [buyerResult] = await connection.execute(`
      INSERT IGNORE INTO users (name, email, password, role, phone, is_active, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      'Alice Buyer',
      'buyer@example.com',
      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
      'buyer',
      '+250788654321',
      1
    ]);

    let buyerId;
    if (buyerResult.insertId) {
      buyerId = buyerResult.insertId;
    } else {
      // Get existing buyer
      const [existingBuyer] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        ['buyer@example.com']
      );
      buyerId = existingBuyer[0].id;
    }

    // Add sample products
    const [productResult] = await connection.execute(`
      INSERT IGNORE INTO products (name, description, price, stock_quantity, seller_id, category_id, main_image, is_active, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      'Smartphone X',
      'Latest smartphone with advanced features',
      299.99,
      50,
      sellerId,
      1, // Electronics category
      '/uploads/main_image-1753524938895-978979006.jpg',
      1
    ]);

    let productId;
    if (productResult.insertId) {
      productId = productResult.insertId;
    } else {
      // Get existing product
      const [existingProduct] = await connection.execute(
        'SELECT id FROM products WHERE name = ?',
        ['Smartphone X']
      );
      productId = existingProduct[0].id;
    }

    // Add sample order
    const [orderResult] = await connection.execute(`
      INSERT IGNORE INTO orders (user_id, order_number, total_amount, status, created_at) 
      VALUES (?, ?, ?, ?, NOW())
    `, [
      buyerId,
      'ORD-2024-001',
      299.99,
      'delivered'
    ]);

    let orderId;
    if (orderResult.insertId) {
      orderId = orderResult.insertId;
    } else {
      // Get existing order
      const [existingOrder] = await connection.execute(
        'SELECT id FROM orders WHERE order_number = ?',
        ['ORD-2024-001']
      );
      orderId = existingOrder[0].id;
    }

    // Add sample order item
    await connection.execute(`
      INSERT IGNORE INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at) 
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      orderId,
      productId,
      1,
      299.99,
      299.99
    ]);

    // Add sample messages
    await connection.execute(`
      INSERT IGNORE INTO messages (sender_id, recipient_id, subject, content, is_read, created_at) 
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      buyerId,
      sellerId,
      'Product Inquiry',
      'Hi, I have a question about the Smartphone X. Is it available in blue color?',
      0
    ]);

    await connection.execute(`
      INSERT IGNORE INTO messages (sender_id, recipient_id, subject, content, is_read, created_at) 
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      buyerId,
      sellerId,
      'Order Status',
      'When will my order be shipped?',
      0
    ]);

    console.log('✅ Sample data added successfully!');
    console.log(`Seller ID: ${sellerId}`);
    console.log(`Buyer ID: ${buyerId}`);
    console.log(`Product ID: ${productId}`);
    console.log(`Order ID: ${orderId}`);

  } catch (error) {
    console.error('Error adding sample data:', error);
  } finally {
    await connection.end();
  }
}

// Run the script
addSampleData(); 