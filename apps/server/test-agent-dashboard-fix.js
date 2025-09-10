const mysql = require('mysql2/promise');

async function testAgentDashboardFix() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connected successfully');

    // Test 1: Check if agents table has data
    console.log('\n🔍 Test 1: Checking agents table...');
    try {
      const [agents] = await connection.execute('SELECT COUNT(*) as count FROM agents');
      console.log(`✅ Agents table has ${agents[0].count} records`);
      
      if (agents[0].count > 0) {
        const [agentData] = await connection.execute('SELECT id, agent_code, first_name, last_name FROM agents LIMIT 1');
        console.log('✅ Sample agent data:', agentData[0]);
      }
    } catch (error) {
      console.log('❌ Agents table query failed:', error.message);
    }

    // Test 2: Check if orders table has agent_id column
    console.log('\n🔍 Test 2: Checking orders table agent_id column...');
    try {
      const [ordersResult] = await connection.execute('DESCRIBE orders');
      const agentIdColumn = ordersResult.find(col => col.Field === 'agent_id');
      if (agentIdColumn) {
        console.log('✅ Orders table has agent_id column:', agentIdColumn);
      } else {
        console.log('❌ Orders table does not have agent_id column');
      }
    } catch (error) {
      console.log('❌ Orders table check failed:', error.message);
    }

    // Test 3: Test the dashboard query that was failing
    console.log('\n🔍 Test 3: Testing dashboard query...');
    try {
      // First, get an agent ID
      const [agents] = await connection.execute('SELECT id FROM agents LIMIT 1');
      if (agents.length > 0) {
        const agentId = agents[0].id;
        console.log(`✅ Using agent ID: ${agentId}`);
        
        // Test the exact query from the dashboard
        const [recentOrders] = await connection.execute(`
          SELECT o.*, u.first_name, u.last_name, u.email
          FROM orders o
          JOIN users u ON o.user_id = u.id
          WHERE o.agent_id = ?
          ORDER BY o.created_at DESC
          LIMIT 10
        `, [agentId]);
        
        console.log(`✅ Dashboard query successful! Found ${recentOrders.length} orders for agent ${agentId}`);
        
        if (recentOrders.length > 0) {
          console.log('✅ Sample order data:', {
            id: recentOrders[0].id,
            order_number: recentOrders[0].order_number,
            status: recentOrders[0].status,
            customer_name: `${recentOrders[0].first_name} ${recentOrders[0].last_name}`
          });
        }
      } else {
        console.log('⚠️ No agents found in database');
      }
    } catch (error) {
      console.log('❌ Dashboard query failed:', error.message);
    }

    // Test 4: Test the orders query that was failing
    console.log('\n🔍 Test 4: Testing orders query...');
    try {
      const [agents] = await connection.execute('SELECT id FROM agents LIMIT 1');
      if (agents.length > 0) {
        const agentId = agents[0].id;
        
        // Test the exact query from the orders route
        const [orders] = await connection.execute(`
          SELECT o.*, u.first_name, u.last_name, u.email, u.phone
          FROM orders o
          JOIN users u ON o.user_id = u.id
          WHERE o.agent_id = ?
          ORDER BY o.created_at DESC
          LIMIT 20 OFFSET 0
        `, [agentId]);
        
        console.log(`✅ Orders query successful! Found ${orders.length} orders for agent ${agentId}`);
      } else {
        console.log('⚠️ No agents found in database');
      }
    } catch (error) {
      console.log('❌ Orders query failed:', error.message);
    }

    // Test 5: Test agent_earnings table
    console.log('\n🔍 Test 5: Testing agent_earnings table...');
    try {
      const [earnings] = await connection.execute('SELECT COUNT(*) as count FROM agent_earnings');
      console.log(`✅ Agent_earnings table has ${earnings[0].count} records`);
    } catch (error) {
      console.log('❌ Agent_earnings query failed:', error.message);
    }

    // Test 6: Test agent_activities table
    console.log('\n🔍 Test 6: Testing agent_activities table...');
    try {
      const [activities] = await connection.execute('SELECT COUNT(*) as count FROM agent_activities');
      console.log(`✅ Agent_activities table has ${activities[0].count} records`);
    } catch (error) {
      console.log('❌ Agent_activities query failed:', error.message);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testAgentDashboardFix(); 