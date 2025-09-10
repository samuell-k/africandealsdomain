const mysql = require('mysql2/promise');

async function updateTestPSM() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: Number(process.env.DB_PORT) || 3333
  });

  try {
    console.log('🔧 Updating test PSM agent...');
    
    const testEmail = 'test.psm@example.com';
    
    // Get a pickup site to assign
    const [sites] = await conn.query('SELECT id, name FROM pickup_sites WHERE is_active = TRUE LIMIT 1');
    if (sites.length === 0) {
      throw new Error('No active pickup sites found');
    }
    
    const pickupSite = sites[0];
    console.log(`Found pickup site: ${pickupSite.name} (ID: ${pickupSite.id})`);
    
    // Update the agent with pickup site
    const [result] = await conn.query(`
      UPDATE agents a
      JOIN users u ON a.user_id = u.id
      SET a.pickup_site_id = ?, a.can_create_manual_orders = TRUE, a.status = 'available', a.admin_approval_status = 'approved'
      WHERE u.email = ? AND a.agent_type = 'pickup_site_manager'
    `, [pickupSite.id, testEmail]);
    
    if (result.affectedRows === 0) {
      throw new Error('No PSM agent found to update');
    }
    
    console.log('✅ Test PSM agent updated successfully');
    console.log(`   Assigned to pickup site: ${pickupSite.name} (ID: ${pickupSite.id})`);
    
    // Verify the update
    const [agents] = await conn.query(`
      SELECT a.id, a.pickup_site_id, a.can_create_manual_orders, a.status, a.admin_approval_status, u.email
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE u.email = ? AND a.agent_type = 'pickup_site_manager'
    `, [testEmail]);
    
    if (agents.length > 0) {
      const agent = agents[0];
      console.log('📋 Agent status:');
      console.log(`   Agent ID: ${agent.id}`);
      console.log(`   Pickup Site ID: ${agent.pickup_site_id}`);
      console.log(`   Can Create Orders: ${agent.can_create_manual_orders ? 'Yes' : 'No'}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Approval: ${agent.admin_approval_status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
}

updateTestPSM();