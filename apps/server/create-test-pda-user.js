/**
 * Create Test PDA User - Server Version
 */

const pool = require('./db');
const bcrypt = require('bcrypt');

async function createTestPDAUser() {
  try {
    console.log('👤 Creating test PDA user...');
    
    // Check if test user already exists
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      ['test-pda@example.com']
    );

    if (existingUsers.length > 0) {
      console.log('✅ Test PDA user already exists');
      console.log('User ID:', existingUsers[0].id);
      console.log('Email:', existingUsers[0].email);
      console.log('Role:', existingUsers[0].role);
      
      // Check if agent record exists
      const [existingAgents] = await pool.execute(
        'SELECT * FROM agents WHERE user_id = ?',
        [existingUsers[0].id]
      );
      
      if (existingAgents.length > 0) {
        console.log('✅ Agent record exists');
        console.log('Agent ID:', existingAgents[0].id);
        console.log('Agent Type:', existingAgents[0].agent_type);
      } else {
        console.log('⚠️ Creating missing agent record...');
        await pool.execute(`
          INSERT INTO agents (user_id, agent_type, status, admin_approval_status, created_at) 
          VALUES (?, ?, ?, ?, NOW())
        `, [existingUsers[0].id, 'pickup_delivery', 'active', 'approved']);
        console.log('✅ Agent record created');
      }
      
      return existingUsers[0];
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create user
    const [userResult] = await pool.execute(`
      INSERT INTO users (name, email, password, phone, role, agent_type, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'Test PDA Agent',
      'test-pda@example.com',
      hashedPassword,
      '+250788123456',
      'agent',
      'pickup_delivery'
    ]);
    
    const userId = userResult.insertId;
    console.log('✅ User created with ID:', userId);
    
    // Create agent record
    const [agentResult] = await pool.execute(`
      INSERT INTO agents (user_id, agent_type, status, admin_approval_status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [userId, 'pickup_delivery', 'active', 'approved']);
    
    const agentId = agentResult.insertId;
    console.log('✅ Agent record created with ID:', agentId);
    
    // Create test buyer users and orders
    console.log('👥 Creating test buyer users...');
    
    const testBuyers = [
      {
        name: 'Test Buyer 1',
        email: 'buyer1@example.com',
        phone: '+250788111111'
      },
      {
        name: 'Test Buyer 2', 
        email: 'buyer2@example.com',
        phone: '+250788222222'
      }
    ];
    
    const buyerIds = [];
    for (const buyer of testBuyers) {
      // Check if buyer exists
      const [existingBuyer] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [buyer.email]
      );
      
      if (existingBuyer.length > 0) {
        buyerIds.push(existingBuyer[0].id);
        console.log('✅ Buyer already exists:', buyer.email);
      } else {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const [buyerResult] = await pool.execute(`
          INSERT INTO users (name, email, password, phone, role, created_at, updated_at) 
          VALUES (?, ?, ?, ?, 'buyer', NOW(), NOW())
        `, [buyer.name, buyer.email, hashedPassword, buyer.phone]);
        
        buyerIds.push(buyerResult.insertId);
        console.log('✅ Test buyer created:', buyer.email, 'ID:', buyerResult.insertId);
      }
    }
    
    // Create test orders for buyers
    console.log('📦 Creating test orders...');
    
    const testOrders = [
      {
        user_id: buyerIds[0],
        total_amount: 50000,
        status: 'CONFIRMED',
        marketplace_type: 'physical',
        delivery_address: 'Kigali City Center, Rwanda',
        currency: 'FRW'
      },
      {
        user_id: buyerIds[1],
        total_amount: 75000,
        status: 'CONFIRMED',
        marketplace_type: 'physical',
        delivery_address: 'Nyamirambo, Kigali, Rwanda',
        currency: 'FRW'
      },
      {
        user_id: buyerIds[0],
        total_amount: 35000,
        status: 'ASSIGNED_TO_PDA',
        marketplace_type: 'physical',
        delivery_address: 'Remera, Kigali, Rwanda',
        currency: 'FRW',
        agent_id: agentId
      }
    ];
    
    for (const order of testOrders) {
      const [orderResult] = await pool.execute(`
        INSERT INTO orders (user_id, total_amount, status, marketplace_type, delivery_address, currency, agent_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [order.user_id, order.total_amount, order.status, order.marketplace_type, order.delivery_address, order.currency, order.agent_id || null]);
      
      console.log('✅ Test order created with ID:', orderResult.insertId);
    }
    
    console.log('\n🎉 Test PDA user setup completed!');
    console.log('📧 Email: test-pda@example.com');
    console.log('🔑 Password: password123');
    console.log('👤 Role: agent (pickup_delivery)');
    
    return { id: userId, email: 'test-pda@example.com' };
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createTestPDAUser().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = createTestPDAUser;