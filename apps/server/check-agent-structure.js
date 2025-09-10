const pool = require('./db');

async function checkAgentStructure() {
  try {
    console.log('=== CHECKING AGENTS TABLE STRUCTURE ===');
    const [agentColumns] = await pool.query('DESCRIBE agents');
    console.log('Agents table columns:');
    agentColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} (${col.Key})`);
    });
    
    console.log('\n=== CHECKING ORDERS TABLE STRUCTURE ===');
    const [orderColumns] = await pool.query('DESCRIBE orders');
    console.log('Orders table columns:');
    orderColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} (${col.Key})`);
    });
    
    console.log('\n=== CHECKING AGENT-ORDER RELATIONSHIP ===');
    const [agentOrderRelation] = await pool.query(`
      SELECT 
        a.id as agent_table_id,
        a.user_id as agent_user_id,
        a.first_name,
        a.last_name,
        o.id as order_id,
        o.agent_id as order_agent_id,
        o.user_id as order_user_id,
        o.status
      FROM agents a
      LEFT JOIN orders o ON a.id = o.agent_id OR a.user_id = o.agent_id
      WHERE a.user_id IN (6, 7, 10)
      ORDER BY a.user_id, o.id
    `);
    
    console.log('Agent-Order relationships:');
    agentOrderRelation.forEach(rel => {
      console.log(`Agent ${rel.agent_user_id} (${rel.first_name} ${rel.last_name}): Order ${rel.order_id} (agent_id=${rel.order_agent_id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAgentStructure();