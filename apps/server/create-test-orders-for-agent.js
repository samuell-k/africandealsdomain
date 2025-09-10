/**
 * Create Test Orders for PDA Agent
 */

const pool = require('./db');

async function createTestOrdersForAgent() {
  try {
    console.log('📦 Creating test orders for PDA agent...');
    
    // Get the test agent
    const [agents] = await pool.execute(
      'SELECT * FROM agents WHERE agent_type = "pickup_delivery" LIMIT 1'
    );
    
    if (agents.length === 0) {
      console.log('❌ No pickup delivery agent found');
      return;
    }
    
    const agent = agents[0];
    console.log('✅ Found agent:', agent.id, 'User ID:', agent.user_id);
    
    // Get test buyers
    const [buyers] = await pool.execute(
      'SELECT * FROM users WHERE role = "buyer" LIMIT 2'
    );
    
    if (buyers.length === 0) {
      console.log('❌ No buyers found');
      return;
    }
    
    console.log('✅ Found buyers:', buyers.map(b => b.email));
    
    // Create test orders with different statuses
    const testOrders = [
      {
        user_id: buyers[0].id,
        agent_id: agent.id,
        total_amount: 45000,
        status: 'ASSIGNED_TO_PDA',
        marketplace_type: 'physical',
        delivery_address: 'Kigali City Center, Rwanda',
        currency: 'FRW'
      },
      {
        user_id: buyers[1] ? buyers[1].id : buyers[0].id,
        agent_id: agent.id,
        total_amount: 65000,
        status: 'PDA_EN_ROUTE_TO_SELLER',
        marketplace_type: 'physical',
        delivery_address: 'Nyamirambo, Kigali, Rwanda',
        currency: 'FRW'
      },
      {
        user_id: buyers[0].id,
        agent_id: agent.id,
        total_amount: 25000,
        status: 'COMPLETED',
        marketplace_type: 'physical',
        delivery_address: 'Remera, Kigali, Rwanda',
        currency: 'FRW',
        agent_commission: 2500
      }
    ];
    
    for (let i = 0; i < testOrders.length; i++) {
      const order = testOrders[i];
      const orderNumber = `TEST-PDA-${Date.now()}-${i + 1}`;
      
      const [orderResult] = await pool.execute(`
        INSERT INTO orders (user_id, agent_id, total_amount, status, marketplace_type, delivery_address, currency, agent_commission, order_number, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [order.user_id, order.agent_id, order.total_amount, order.status, order.marketplace_type, order.delivery_address, order.currency, order.agent_commission || 0, orderNumber]);
      
      console.log('✅ Test order created:', {
        id: orderResult.insertId,
        order_number: orderNumber,
        status: order.status,
        amount: order.total_amount
      });
    }
    
    console.log('\n🎉 Test orders created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test orders:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createTestOrdersForAgent().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = createTestOrdersForAgent;