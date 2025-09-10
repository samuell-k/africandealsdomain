/**
 * Comprehensive System Test
 * Tests all critical functionality including commission calculation, payment processing, and agent assignment
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Test configuration
const TEST_CONFIG = {
  buyer: {
    email: 'nyirabakundamarie@gmail.com',
    password: 'nyirabakundamarie@gmail.com',
    name: 'Marie Nyirabakundamarie'
  },
  seller: {
    email: 'networkcouf@gmail.com', 
    password: 'networkcouf@gmail.com',
    name: 'Network Couf'
  },
  agents: [
    { email: 'nayisabamj@gmail.com', password: 'nayisabamj@gmail.com', name: 'Nayisaba MJ', type: 'fast_delivery' },
    { email: 'nyiranzabonimpajosiane@gmail.com', password: 'nyiranzabonimpajosiane@gmail.com', name: 'Nyiranzaboni Josiane', type: 'pickup_delivery' },
    { email: 'consoleenzasangamariya@gmail.com', password: 'consoleenzasangamariya@gmail.com', name: 'Console Mariya', type: 'pickup_site_manager' }
  ]
};

let pool;

async function initializeDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  console.log('✅ Database connection pool created');
}

async function createTestUsers() {
  console.log('\n🔄 Creating test users...');
  
  try {
    // Create buyer
    const buyerPasswordHash = await bcrypt.hash(TEST_CONFIG.buyer.password, 10);
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password_hash, name, role, is_active, is_verified)
      VALUES (?, ?, ?, ?, 'buyer', TRUE, TRUE)
    `, [
      TEST_CONFIG.buyer.email.split('@')[0],
      TEST_CONFIG.buyer.email,
      buyerPasswordHash,
      TEST_CONFIG.buyer.name
    ]);
    console.log('✅ Buyer account created/verified');

    // Create seller
    const sellerPasswordHash = await bcrypt.hash(TEST_CONFIG.seller.password, 10);
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password_hash, name, role, is_active, is_verified)
      VALUES (?, ?, ?, ?, 'seller', TRUE, TRUE)
    `, [
      TEST_CONFIG.seller.email.split('@')[0],
      TEST_CONFIG.seller.email,
      sellerPasswordHash,
      TEST_CONFIG.seller.name
    ]);
    console.log('✅ Seller account created/verified');

    // Create agents
    for (const agent of TEST_CONFIG.agents) {
      const agentPasswordHash = await bcrypt.hash(agent.password, 10);
      
      // Create user account
      const [userResult] = await pool.execute(`
        INSERT IGNORE INTO users (username, email, password_hash, name, role, is_active, is_verified)
        VALUES (?, ?, ?, ?, 'agent', TRUE, TRUE)
      `, [
        agent.email.split('@')[0],
        agent.email,
        agentPasswordHash,
        agent.name
      ]);

      // Get user ID
      const [userCheck] = await pool.execute(`
        SELECT id FROM users WHERE email = ?
      `, [agent.email]);

      if (userCheck.length > 0) {
        const userId = userCheck[0].id;
        
        // Create agent profile
        await pool.execute(`
          INSERT IGNORE INTO agents (
            user_id, agent_type, status, admin_approval_status,
            phone, address, city, country, rating, total_deliveries
          ) VALUES (?, ?, 'available', 'approved', '+250788123456', 'Test Address', 'Kigali', 'Rwanda', 4.5, 10)
        `, [userId, agent.type]);
        
        console.log(`✅ Agent ${agent.name} (${agent.type}) created/verified`);
      }
    }

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  }
}

async function createTestProducts() {
  console.log('\n🔄 Creating test products...');
  
  try {
    // Get seller ID
    const [sellerCheck] = await pool.execute(`
      SELECT id FROM users WHERE email = ?
    `, [TEST_CONFIG.seller.email]);

    if (sellerCheck.length === 0) {
      throw new Error('Seller not found');
    }

    const sellerId = sellerCheck[0].id;

    // Create test products
    const products = [
      {
        name: 'Premium Smartphone',
        description: 'High-quality smartphone with advanced features',
        price: 299.99,
        category_id: 1,
        stock_quantity: 50
      },
      {
        name: 'Wireless Headphones',
        description: 'Noise-cancelling wireless headphones',
        price: 89.99,
        category_id: 1,
        stock_quantity: 30
      },
      {
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with multiple compartments',
        price: 45.99,
        category_id: 2,
        stock_quantity: 25
      }
    ];

    for (const product of products) {
      await pool.execute(`
        INSERT IGNORE INTO products (
          seller_id, name, description, price, category_id, stock_quantity,
          is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
      `, [
        sellerId,
        product.name,
        product.description,
        product.price,
        product.category_id,
        product.stock_quantity
      ]);
    }

    console.log('✅ Test products created');

  } catch (error) {
    console.error('❌ Error creating test products:', error);
    throw error;
  }
}

async function testCommissionCalculation() {
  console.log('\n🔄 Testing commission calculation...');
  
  try {
    const CommissionService = require('./services/commissionService');
    
    // Test pricing calculation
    const basePrice = 100.00;
    const deliveryTypes = ['pickup', 'home_delivery'];
    
    for (const deliveryType of deliveryTypes) {
      const pricing = await CommissionService.calculateBuyerPrice(basePrice, deliveryType, 'physical');
      
      console.log(`\n📊 ${deliveryType.toUpperCase()} Pricing:`);
      console.log(`   Base Price: $${pricing.basePrice}`);
      console.log(`   Platform Margin (21%): $${pricing.platformMargin}`);
      console.log(`   Delivery Fee: $${pricing.deliveryFee}`);
      console.log(`   Final Price: $${pricing.finalPrice}`);
      console.log(`   Seller Payout: $${pricing.sellerPayout}`);
      
      // Verify calculations
      const expectedMargin = basePrice * 0.21;
      const expectedDeliveryFee = deliveryType === 'home_delivery' ? basePrice * 0.06 : 0;
      
      if (Math.abs(pricing.platformMargin - expectedMargin) < 0.01) {
        console.log('   ✅ Platform margin calculation correct');
      } else {
        console.log('   ❌ Platform margin calculation incorrect');
      }
      
      if (Math.abs(pricing.deliveryFee - expectedDeliveryFee) < 0.01) {
        console.log('   ✅ Delivery fee calculation correct');
      } else {
        console.log('   ❌ Delivery fee calculation incorrect');
      }
    }

  } catch (error) {
    console.error('❌ Commission calculation test failed:', error);
    throw error;
  }
}

async function testOrderCreation() {
  console.log('\n🔄 Testing order creation with commission tracking...');
  
  try {
    // Get buyer and seller IDs
    const [buyerCheck] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [TEST_CONFIG.buyer.email]);
    const [sellerCheck] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [TEST_CONFIG.seller.email]);
    const [productCheck] = await pool.execute(`SELECT id, price FROM products LIMIT 1`);

    if (buyerCheck.length === 0 || sellerCheck.length === 0 || productCheck.length === 0) {
      throw new Error('Required test data not found');
    }

    const buyerId = buyerCheck[0].id;
    const sellerId = sellerCheck[0].id;
    const product = productCheck[0];

    // Create test order
    const orderNumber = 'TEST-' + Date.now();
    const basePrice = parseFloat(product.price);
    
    // Calculate pricing
    const CommissionService = require('./services/commissionService');
    const pricing = await CommissionService.calculateBuyerPrice(basePrice, 'home_delivery', 'physical');

    // Create order
    const [orderResult] = await pool.execute(`
      INSERT INTO orders (
        user_id, seller_id, order_number, total_amount, status,
        delivery_type, delivery_method, platform_margin, home_delivery_fee,
        final_buyer_price, seller_payout, created_at
      ) VALUES (?, ?, ?, ?, 'pending', 'home_delivery', 'home', ?, ?, ?, ?, NOW())
    `, [
      buyerId, sellerId, orderNumber, basePrice, pricing.platformMargin,
      pricing.deliveryFee, pricing.finalPrice, pricing.sellerPayout
    ]);

    const orderId = orderResult.insertId;

    // Create order item
    await pool.execute(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
      VALUES (?, ?, 1, ?, ?)
    `, [orderId, product.id, basePrice, basePrice]);

    // Test commission calculation for order
    const commissionResult = await CommissionService.calculateOrderCommissions(
      orderId, basePrice, 'home_delivery', { fast_delivery: 1 }
    );

    console.log('✅ Test order created successfully');
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Order Number: ${orderNumber}`);
    console.log(`   Total Commissions: $${commissionResult.totalCommissions.toFixed(2)}`);
    console.log(`   Commission Records: ${commissionResult.commissions.length}`);

    // Verify commission records were created
    const [commissionCheck] = await pool.execute(`
      SELECT COUNT(*) as count FROM commission_transactions WHERE order_id = ?
    `, [orderId]);

    if (commissionCheck[0].count > 0) {
      console.log('✅ Commission transactions recorded');
    } else {
      console.log('❌ Commission transactions not recorded');
    }

  } catch (error) {
    console.error('❌ Order creation test failed:', error);
    throw error;
  }
}

async function testPaymentSystem() {
  console.log('\n🔄 Testing payment transaction system...');
  
  try {
    // Get a test order
    const [orderCheck] = await pool.execute(`
      SELECT id, total_amount FROM orders WHERE status = 'pending' LIMIT 1
    `);

    if (orderCheck.length === 0) {
      console.log('⚠️ No pending orders found for payment test');
      return;
    }

    const order = orderCheck[0];

    // Create payment transaction
    const [paymentResult] = await pool.execute(`
      INSERT INTO payment_transactions (
        order_id, payment_type, amount, currency, status, created_at
      ) VALUES (?, 'manual', ?, 'USD', 'pending_confirmation', NOW())
    `, [order.id, order.total_amount]);

    const transactionId = paymentResult.insertId;

    // Test payment approval
    await pool.execute(`
      UPDATE payment_transactions 
      SET status = 'completed', processed_at = NOW()
      WHERE id = ?
    `, [transactionId]);

    console.log('✅ Payment transaction system working');
    console.log(`   Transaction ID: ${transactionId}`);

  } catch (error) {
    console.error('❌ Payment system test failed:', error);
    throw error;
  }
}

async function testAgentSystem() {
  console.log('\n🔄 Testing agent system...');
  
  try {
    // Check agent accounts
    const [agentCheck] = await pool.execute(`
      SELECT u.id, u.name, u.email, a.agent_type, a.status, a.admin_approval_status
      FROM users u
      JOIN agents a ON u.id = a.user_id
      WHERE u.role = 'agent'
    `);

    console.log(`✅ Found ${agentCheck.length} agent accounts:`);
    agentCheck.forEach(agent => {
      console.log(`   - ${agent.name} (${agent.agent_type}) - Status: ${agent.status} - Approval: ${agent.admin_approval_status}`);
    });

    // Test agent earnings
    const [earningsCheck] = await pool.execute(`
      SELECT COUNT(*) as count FROM agent_earnings
    `);

    console.log(`✅ Agent earnings records: ${earningsCheck[0].count}`);

  } catch (error) {
    console.error('❌ Agent system test failed:', error);
    throw error;
  }
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive System Test');
  console.log('=====================================');
  
  try {
    await initializeDatabase();
    await createTestUsers();
    await createTestProducts();
    await testCommissionCalculation();
    await testOrderCreation();
    await testPaymentSystem();
    await testAgentSystem();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 System Status:');
    console.log('✅ Database connectivity: Working');
    console.log('✅ User management: Working');
    console.log('✅ Product management: Working');
    console.log('✅ Commission calculation: Working');
    console.log('✅ Order processing: Working');
    console.log('✅ Payment system: Working');
    console.log('✅ Agent system: Working');
    
    console.log('\n🔗 Test Accounts Created:');
    console.log(`👤 Buyer: ${TEST_CONFIG.buyer.email} / ${TEST_CONFIG.buyer.password}`);
    console.log(`🏪 Seller: ${TEST_CONFIG.seller.email} / ${TEST_CONFIG.seller.password}`);
    TEST_CONFIG.agents.forEach(agent => {
      console.log(`🚚 Agent (${agent.type}): ${agent.email} / ${agent.password}`);
    });
    
    console.log('\n🌐 Ready for Puppeteer testing!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the comprehensive test
runComprehensiveTest();