/**
 * Create Sample Data for Fast Delivery Agent Testing
 * Creates real sample orders and agents for testing the system
 */

const pool = require('./db');
const bcrypt = require('bcrypt');

async function createSampleData() {
  try {
    console.log('🚀 Creating sample data for Fast Delivery Agent testing...');

    // Create sample fast delivery agent using existing user
    console.log('📝 Creating fast delivery agent...');
    
    // Get user ID for nayisabamj@gmail.com
    const [users] = await pool.query(
      'SELECT id FROM users WHERE email = "nayisabamj@gmail.com"'
    );

    if (users.length === 0) {
      console.log('❌ User nayisabamj@gmail.com not found. Please create this user first.');
      return;
    }

    const userId = users[0].id;

    // Check if agent already exists
    const [existingAgents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "fast_delivery"',
      [userId]
    );

    let agentId;
    if (existingAgents.length === 0) {

      // Create fast delivery agent
      const [agentResult] = await pool.query(`
        INSERT INTO agents (user_id, agent_type, name, phone, email, status, admin_approval_status, created_at)
        VALUES (?, 'fast_delivery', 'Fast Delivery Agent', '+250788123456', 'nayisabamj@gmail.com', 'available', 'approved', NOW())
      `, [userId]);

      agentId = agentResult.insertId;
      console.log('✅ Fast delivery agent created with ID:', agentId);
    } else {
      agentId = existingAgents[0].id;
      console.log('✅ Fast delivery agent already exists with ID:', agentId);
    }

    // Create sample buyers
    console.log('📝 Creating sample buyers...');
    const buyers = [];
    const buyerData = [
      { name: 'John Buyer', email: 'john.buyer@test.com', phone: '+250788111111' },
      { name: 'Mary Customer', email: 'mary.customer@test.com', phone: '+250788111112' },
      { name: 'David Client', email: 'david.client@test.com', phone: '+250788111113' }
    ];

    const hashedPassword = await bcrypt.hash('testpass123', 10);

    for (const buyer of buyerData) {
      // Check if buyer exists
      const [existingBuyers] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [buyer.email]
      );

      let buyerId;
      if (existingBuyers.length === 0) {
        const [buyerResult] = await pool.query(`
          INSERT INTO users (username, email, password, role, phone, created_at)
          VALUES (?, ?, ?, 'buyer', ?, NOW())
        `, [buyer.name, buyer.email, hashedPassword, buyer.phone]);
        buyerId = buyerResult.insertId;
      } else {
        buyerId = existingBuyers[0].id;
      }
      
      buyers.push({ id: buyerId, ...buyer });
    }
    console.log('✅ Sample buyers ready');

    // Create sample sellers
    console.log('📝 Creating sample sellers...');
    const sellers = [];
    const sellerData = [
      { name: 'Fresh Market Seller', email: 'fresh.market@test.com', phone: '+250788222221' },
      { name: 'Local Grocery Store', email: 'local.grocery@test.com', phone: '+250788222222' }
    ];

    for (const seller of sellerData) {
      // Check if seller exists
      const [existingSellers] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [seller.email]
      );

      let sellerId;
      if (existingSellers.length === 0) {
        const [sellerResult] = await pool.query(`
          INSERT INTO users (username, email, password, role, phone, created_at)
          VALUES (?, ?, ?, 'seller', ?, NOW())
        `, [seller.name, seller.email, hashedPassword, seller.phone]);
        sellerId = sellerResult.insertId;
      } else {
        sellerId = existingSellers[0].id;
      }
      
      sellers.push({ id: sellerId, ...seller });
    }
    console.log('✅ Sample sellers ready');

    // Create sample products
    console.log('📝 Creating sample products...');
    
    // Ensure categories exist
    await pool.query(`
      INSERT IGNORE INTO product_categories (name, description, created_at)
      VALUES ('Fresh Vegetables', 'Fresh local vegetables and greens', NOW())
    `);

    await pool.query(`
      INSERT IGNORE INTO product_categories (name, description, created_at)
      VALUES ('Fresh Fruits', 'Fresh local fruits', NOW())
    `);

    const [categories] = await pool.query(
      'SELECT id, name FROM product_categories WHERE name IN ("Fresh Vegetables", "Fresh Fruits")'
    );

    const vegetableCategoryId = categories.find(c => c.name === 'Fresh Vegetables')?.id || categories[0].id;
    const fruitCategoryId = categories.find(c => c.name === 'Fresh Fruits')?.id || categories[0].id;

    const products = [
      { name: 'Fresh Tomatoes', description: 'Locally grown fresh tomatoes', price: 2.50, category_id: vegetableCategoryId },
      { name: 'Fresh Onions', description: 'Fresh white onions', price: 1.80, category_id: vegetableCategoryId },
      { name: 'Green Peppers', description: 'Fresh green bell peppers', price: 3.00, category_id: vegetableCategoryId },
      { name: 'Bananas', description: 'Sweet ripe bananas', price: 1.20, category_id: fruitCategoryId },
      { name: 'Apples', description: 'Fresh red apples', price: 3.50, category_id: fruitCategoryId }
    ];

    for (const seller of sellers) {
      for (const product of products) {
        await pool.query(`
          INSERT IGNORE INTO products (name, description, price, category_id, seller_id, stock_quantity, created_at)
          VALUES (?, ?, ?, ?, ?, 100, NOW())
        `, [product.name, product.description, product.price, product.category_id, seller.id]);
      }
    }
    console.log('✅ Sample products created');

    // Create sample grocery orders
    console.log('📝 Creating sample grocery orders...');
    
    const deliveryAddresses = [
      { address: 'Kigali City Center, Rwanda', lat: -1.9441, lng: 30.0619 },
      { address: 'Kimisagara, Kigali, Rwanda', lat: -1.9706, lng: 30.0588 },
      { address: 'Gisozi, Kigali, Rwanda', lat: -1.9167, lng: 30.0833 },
      { address: 'Remera, Kigali, Rwanda', lat: -1.9333, lng: 30.1167 }
    ];

    const pickupAddresses = [
      { address: 'Kimironko Market, Kigali', lat: -1.9506, lng: 30.0588 },
      { address: 'Nyabugogo Market, Kigali', lat: -1.9667, lng: 30.0333 }
    ];

    // Get grocery products for orders (use existing grocery products)
    const [availableProducts] = await pool.query(`
      SELECT 
        gp.*,
        p.name,
        p.seller_id,
        u.username as seller_name 
      FROM grocery_products gp
      LEFT JOIN products p ON gp.product_id = p.id
      LEFT JOIN users u ON p.seller_id = u.id 
      WHERE gp.available_stock > 0
      AND p.is_active = 1
      LIMIT 10
    `);

    console.log(`📦 Found ${availableProducts.length} available grocery products`);
    if (availableProducts.length > 0) {
      console.log('Sample grocery product:', {
        grocery_id: availableProducts[0].id,
        product_id: availableProducts[0].product_id,
        name: availableProducts[0].name,
        seller_id: availableProducts[0].seller_id,
        seller_name: availableProducts[0].seller_name,
        unit_price: availableProducts[0].unit_price
      });
    }

    for (let i = 0; i < 8; i++) {
      const buyer = buyers[i % buyers.length];
      const deliveryAddr = deliveryAddresses[i % deliveryAddresses.length];
      const pickupAddr = pickupAddresses[i % pickupAddresses.length];
      
      // Select 2-3 random products for the order
      const orderProducts = availableProducts.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 2);
      
      console.log(`📦 Order ${i + 1}: Selected ${orderProducts.length} products from ${availableProducts.length} available`);
      
      let totalAmount = 0;
      const orderItems = [];
      
      for (const product of orderProducts) {
        console.log(`  📦 Processing grocery product: ${product.name} (Grocery ID: ${product.id}, Product ID: ${product.product_id}, Seller: ${product.seller_id})`);
        
        if (!product.seller_id) {
          console.log(`  ❌ Product ${product.name} has no seller_id, skipping...`);
          continue;
        }
        
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
        const unitPrice = parseFloat(product.unit_price);
        const itemTotal = unitPrice * quantity;
        totalAmount += itemTotal;
        
        orderItems.push({
          grocery_product_id: product.id, // Use grocery product ID
          product_name: product.name,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: itemTotal,
          seller_id: product.seller_id
        });
      }

      // Debug: Check if we have order items
      if (orderItems.length === 0) {
        console.log(`❌ No order items created for order ${i + 1}`);
        continue;
      }

      // Get seller from first product
      const sellerId = orderItems[0].seller_id;
      
      if (!sellerId) {
        console.log(`❌ No seller_id found for order ${i + 1}`);
        continue;
      }

      // Create the order
      const orderNumber = `LM${Date.now()}${i}`;
      const [orderResult] = await pool.query(`
        INSERT INTO grocery_orders (
          order_number, buyer_id, seller_id, total_amount, status,
          delivery_address, delivery_lat, delivery_lng,
          pickup_address, pickup_lat, pickup_lng,
          payment_method, buyer_notes, created_at
        ) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, 'manual', ?, NOW())
      `, [
        orderNumber,
        buyer.id,
        sellerId,
        totalAmount,
        deliveryAddr.address,
        deliveryAddr.lat,
        deliveryAddr.lng,
        pickupAddr.address,
        pickupAddr.lat,
        pickupAddr.lng,
        `Test order ${i + 1} for fast delivery - ${orderItems.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`
      ]);

      // Add order items
      for (const item of orderItems) {
        await pool.query(`
          INSERT INTO grocery_order_items (grocery_order_id, grocery_product_id, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?)
        `, [orderResult.insertId, item.grocery_product_id, item.quantity, item.unit_price, item.total_price]);
      }

      console.log(`✅ Created order ${orderNumber} with ${orderItems.length} items (Total: $${totalAmount.toFixed(2)})`);
    }

    console.log('\n🎉 SAMPLE DATA CREATION COMPLETED!');
    console.log('✅ Fast delivery agent created/verified');
    console.log('✅ Sample buyers created');
    console.log('✅ Sample sellers created');
    console.log('✅ Sample products created');
    console.log('✅ 8 sample grocery orders created');
    console.log('\n📱 You can now test the Fast Delivery Agent system!');
    console.log('\n🔑 Test Credentials:');
    console.log('   Agent: nayisabamj@gmail.com / (your existing password)');
    console.log('   Buyer: john.buyer@test.com / testpass123');
    console.log('   Seller: fresh.market@test.com / testpass123');
    console.log('\n🌐 Access the dashboard at:');
    console.log('   http://localhost:3002/agent/fast-delivery-agent-complete.html');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the script
createSampleData();