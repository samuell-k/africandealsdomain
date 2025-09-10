const mysql = require('mysql2/promise');

async function testRegenerateQuery() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('🧪 Testing regenerate receipt query...');
    
    // First, check how agents are linked to pickup sites
    console.log('\n1. Checking PSM agents and their commission settings:');
    const [agents] = await pool.query(`
      SELECT a.id, a.user_id, a.agent_type, a.commission_settings 
      FROM agents a 
      WHERE a.agent_type = 'pickup_site_manager' 
      LIMIT 3
    `);
    
    agents.forEach(agent => {
      console.log(`   Agent ID: ${agent.id}, User ID: ${agent.user_id}`);
      console.log(`   Commission: ${agent.commission_settings}`);
      
      if (agent.commission_settings) {
        try {
          const settings = JSON.parse(agent.commission_settings);
          console.log(`   Pickup Site ID: ${settings.pickup_site_id}`);
        } catch (e) {
          console.log('   Could not parse commission settings');
        }
      }
    });
    
    // Now test the final corrected query
    console.log('\n2. Testing final corrected query:');
    const [orders] = await pool.query(`
      SELECT mo.*, ps.name as pickup_site_name, ps.address_line1 as pickup_site_address,
             COALESCE(
               CONCAT(u.first_name, ' ', u.last_name),
               u.username,
               u.email,
               'System Agent'
             ) as agent_name, 
             a.id as agent_id, 
             COALESCE(a.phone, u.phone, '123456789') as agent_phone, 
             COALESCE(u.email, 'agent@africandeals.com') as agent_email
      FROM manual_orders mo
      JOIN pickup_sites ps ON mo.pickup_site_id = ps.id
      JOIN agents a ON JSON_EXTRACT(a.commission_settings, '$.pickup_site_id') = ps.id 
                   AND a.agent_type = 'pickup_site_manager'
      JOIN users u ON a.user_id = u.id
      WHERE mo.id = ? AND mo.pickup_site_id = ?
    `, [25, 3]);

    if (orders.length === 0) {
      console.log('❌ No orders found with the corrected query');
      
      // Try a simpler approach
      console.log('\n3. Trying simpler approach - get order first:');
      const [simpleOrders] = await pool.query(`
        SELECT mo.*, ps.name as pickup_site_name, ps.address_line1 as pickup_site_address
        FROM manual_orders mo
        JOIN pickup_sites ps ON mo.pickup_site_id = ps.id
        WHERE mo.id = ?
      `, [25]);
      
      if (simpleOrders.length > 0) {
        console.log('✅ Order found:', simpleOrders[0].order_number);
        console.log('   Pickup site:', simpleOrders[0].pickup_site_name);
        
        // Now find the agent for this pickup site
        const [siteAgents] = await pool.query(`
          SELECT a.*, u.first_name, u.last_name, u.phone as user_phone, u.email
          FROM agents a
          JOIN users u ON a.user_id = u.id
          WHERE a.agent_type = 'pickup_site_manager'
            AND JSON_EXTRACT(a.commission_settings, '$.pickup_site_id') = ?
        `, [simpleOrders[0].pickup_site_id]);
        
        if (siteAgents.length > 0) {
          console.log('✅ Agent found:', siteAgents[0].first_name, siteAgents[0].last_name);
        } else {
          console.log('❌ No agent found for this pickup site');
        }
      }
    } else {
      console.log('✅ Query successful! Found order:', orders[0].order_number);
      console.log('   Agent name:', orders[0].agent_name);
      console.log('   Agent phone:', orders[0].agent_phone);
      console.log('   Agent email:', orders[0].agent_email);
      console.log('   Pickup site:', orders[0].pickup_site_name);
    }

  } catch (error) {
    console.error('❌ Query error:', error.message);
  } finally {
    await pool.end();
  }
}

testRegenerateQuery();