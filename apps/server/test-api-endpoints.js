const jwt = require('jsonwebtoken');

async function testAPIEndpoints() {
  try {
    console.log('=== TESTING API ENDPOINTS ===\n');
    
    // Create test tokens for buyer and agent
    require('dotenv').config();
    const JWT_SECRET = process.env.JWT_SECRET || 'adminafricandealsdomainpassword';
    
    const buyerToken = jwt.sign(
      { id: 3, role: 'buyer', email: 'mugishasimplice4@gmail.com' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const agentToken = jwt.sign(
      { id: 10, role: 'agent', email: 'testauth@example.com' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('🔑 Generated test tokens');
    console.log('Buyer token (user_id 3):', buyerToken.substring(0, 50) + '...');
    console.log('Agent token (user_id 10):', agentToken.substring(0, 50) + '...');
    
    // Test buyer orders endpoint
    console.log('\n--- Testing Buyer Orders API ---');
    try {
      const buyerResponse = await fetch('http://localhost:3001/api/orders', {
        headers: {
          'Authorization': `Bearer ${buyerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (buyerResponse.ok) {
        const buyerData = await buyerResponse.json();
        console.log(`✅ Buyer orders API: ${buyerData.orders?.length || 0} orders found`);
        if (buyerData.orders && buyerData.orders.length > 0) {
          buyerData.orders.slice(0, 3).forEach(order => {
            console.log(`   Order ${order.id}: ${order.status}, $${order.total_amount}`);
          });
        }
      } else {
        console.log(`❌ Buyer orders API failed: ${buyerResponse.status} ${buyerResponse.statusText}`);
        const errorText = await buyerResponse.text();
        console.log('Error:', errorText);
      }
    } catch (error) {
      console.log('❌ Buyer orders API error:', error.message);
    }
    
    // Test agent orders endpoint
    console.log('\n--- Testing Agent Orders API ---');
    try {
      const agentResponse = await fetch('http://localhost:3001/api/agents/orders', {
        headers: {
          'Authorization': `Bearer ${agentToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (agentResponse.ok) {
        const agentData = await agentResponse.json();
        console.log(`✅ Agent orders API: ${agentData.orders?.length || 0} orders found`);
        if (agentData.orders && agentData.orders.length > 0) {
          agentData.orders.slice(0, 3).forEach(order => {
            console.log(`   Order ${order.id}: ${order.status}, $${order.total_amount}`);
          });
        }
      } else {
        console.log(`❌ Agent orders API failed: ${agentResponse.status} ${agentResponse.statusText}`);
        const errorText = await agentResponse.text();
        console.log('Error:', errorText);
      }
    } catch (error) {
      console.log('❌ Agent orders API error:', error.message);
    }
    
    // Test claimable orders endpoint
    console.log('\n--- Testing Claimable Orders API ---');
    try {
      const claimableResponse = await fetch('http://localhost:3001/api/agents/orders/claimable', {
        headers: {
          'Authorization': `Bearer ${agentToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (claimableResponse.ok) {
        const claimableData = await claimableResponse.json();
        console.log(`✅ Claimable orders API: ${claimableData.orders?.length || 0} orders found`);
        if (claimableData.orders && claimableData.orders.length > 0) {
          claimableData.orders.forEach(order => {
            console.log(`   Order ${order.id}: ${order.status}, $${order.total_amount}`);
          });
        }
      } else {
        console.log(`❌ Claimable orders API failed: ${claimableResponse.status} ${claimableResponse.statusText}`);
        const errorText = await claimableResponse.text();
        console.log('Error:', errorText);
      }
    } catch (error) {
      console.log('❌ Claimable orders API error:', error.message);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAPIEndpoints();