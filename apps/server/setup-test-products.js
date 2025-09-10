/**
 * Setup Test Products for E2E Testing
 * Creates products for the seller networkcouf@gmail.com
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

class TestProductSetup {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    };
  }

  async setup() {
    let connection;
    
    try {
      console.log('🔄 Setting up test products for E2E testing...');
      
      connection = await mysql.createConnection(this.dbConfig);
      console.log('✅ Connected to database');

      // Get seller ID
      const [seller] = await connection.execute(
        'SELECT id FROM users WHERE email = ?', 
        ['networkcouf@gmail.com']
      );
      
      if (seller.length === 0) {
        throw new Error('Seller networkcouf@gmail.com not found');
      }
      
      const sellerId = seller[0].id;
      console.log(`✅ Found seller ID: ${sellerId}`);

      // Check existing products
      const [existingProducts] = await connection.execute(
        'SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND status = "active"', 
        [sellerId]
      );
      
      console.log(`📦 Existing active products for seller: ${existingProducts[0].count}`);

      if (existingProducts[0].count < 3) {
        console.log('🔄 Creating test products...');
        await this.createTestProducts(connection, sellerId);
      } else {
        console.log('✅ Sufficient products already exist');
      }

      // Also create grocery/menu items
      await this.createGroceryItems(connection, sellerId);

      console.log('🎉 Test products setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  async createTestProducts(connection, sellerId) {
    const products = [
      {
        name: 'Premium Smartphone - Galaxy Pro',
        description: 'High-end smartphone with advanced camera and long battery life. Perfect for photography enthusiasts and professionals.',
        price: 299000, // RWF
        category: 'Electronics',
        subcategory: 'Mobile Phones',
        stock_quantity: 15,
        images: '/uploads/products/smartphone.jpg'
      },
      {
        name: 'Professional Laptop - UltraBook 15"',
        description: 'Powerful laptop for development, design, and business. Intel i7 processor, 16GB RAM, 512GB SSD.',
        price: 850000, // RWF
        category: 'Electronics',
        subcategory: 'Computers',
        stock_quantity: 8,
        images: '/uploads/products/laptop.jpg'
      },
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'Premium wireless headphones with noise cancellation and premium sound quality.',
        price: 65000, // RWF
        category: 'Electronics',
        subcategory: 'Audio',
        stock_quantity: 25,
        images: '/uploads/products/headphones.jpg'
      },
      {
        name: 'Men\'s Casual T-Shirt',
        description: 'Comfortable cotton t-shirt available in multiple colors and sizes.',
        price: 8500, // RWF
        category: 'Clothing',
        subcategory: 'Men\'s Wear',
        stock_quantity: 50,
        images: '/uploads/products/tshirt.jpg'
      },
      {
        name: 'Kitchen Blender Set',
        description: 'Multi-function kitchen blender with various attachments for smoothies, soups, and more.',
        price: 45000, // RWF
        category: 'Home & Kitchen',
        subcategory: 'Appliances',
        stock_quantity: 12,
        images: '/uploads/products/blender.jpg'
      }
    ];

    for (const product of products) {
      await connection.execute(`
        INSERT INTO products (
          seller_id, name, description, price, category, subcategory,
          stock_quantity, images, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
      `, [
        sellerId, 
        product.name, 
        product.description, 
        product.price, 
        product.category, 
        product.subcategory,
        product.stock_quantity, 
        product.images
      ]);
      
      console.log(`✅ Created product: ${product.name}`);
    }
  }

  async createGroceryItems(connection, sellerId) {
    // Check if grocery_products table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'grocery_products'
    `);

    if (tables[0].count === 0) {
      // Create grocery_products table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS grocery_products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          seller_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          category VARCHAR(100),
          preparation_time INT DEFAULT 30,
          available BOOLEAN DEFAULT TRUE,
          image_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created grocery_products table');
    }

    // Check existing grocery products
    const [existingGrocery] = await connection.execute(
      'SELECT COUNT(*) as count FROM grocery_products WHERE seller_id = ? AND available = TRUE', 
      [sellerId]
    );

    if (existingGrocery[0].count < 3) {
      const groceryItems = [
        {
          name: 'Fresh Mixed Vegetable Salad',
          description: 'Fresh mixed greens with tomatoes, cucumbers, and house dressing',
          price: 3500, // RWF
          category: 'Salads',
          preparation_time: 15,
          image_url: '/uploads/grocery/salad.jpg'
        },
        {
          name: 'Grilled Chicken Rice Bowl',
          description: 'Tender grilled chicken with steamed rice and vegetables',
          price: 5500, // RWF
          category: 'Main Course',
          preparation_time: 25,
          image_url: '/uploads/grocery/chicken-rice.jpg'
        },
        {
          name: 'Fresh Fruit Smoothie',
          description: 'Blend of seasonal fruits with yogurt and honey',
          price: 2800, // RWF
          category: 'Beverages',
          preparation_time: 10,
          image_url: '/uploads/grocery/smoothie.jpg'
        },
        {
          name: 'Local Fish Stew',
          description: 'Traditional Rwandan fish stew with vegetables and spices',
          price: 6800, // RWF
          category: 'Main Course',
          preparation_time: 35,
          image_url: '/uploads/grocery/fish-stew.jpg'
        }
      ];

      for (const item of groceryItems) {
        await connection.execute(`
          INSERT INTO grocery_products (
            seller_id, name, description, price, category, 
            preparation_time, available, image_url, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, NOW(), NOW())
        `, [
          sellerId,
          item.name,
          item.description,
          item.price,
          item.category,
          item.preparation_time,
          item.image_url
        ]);
        
        console.log(`✅ Created grocery item: ${item.name}`);
      }
    } else {
      console.log('✅ Sufficient grocery items already exist');
    }
  }
}

// Run the setup
const setup = new TestProductSetup();

setup.setup().then(() => {
  console.log('\n🎉 Test products ready for E2E testing!');
  console.log('📦 Physical products created for networkcouf@gmail.com');
  console.log('🍽️ Grocery/menu items created for local market testing');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Setup failed:', error);
  process.exit(1);
});