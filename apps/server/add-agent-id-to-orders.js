const mysql = require('mysql2/promise');

async function addAgentIdToOrders() {
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

    // Check if agent_id column already exists
    try {
      const [ordersResult] = await connection.execute('DESCRIBE orders');
      const agentIdColumn = ordersResult.find(col => col.Field === 'agent_id');
      
      if (agentIdColumn) {
        console.log('✅ Orders table already has agent_id column');
        return;
      }
    } catch (error) {
      console.log('❌ Could not check orders table:', error.message);
      return;
    }

    // Add agent_id column to orders table
    console.log('📝 Adding agent_id column to orders table...');
    
    try {
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN agent_id INT NULL,
        ADD INDEX idx_agent (agent_id),
        ADD CONSTRAINT fk_orders_agent 
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      
      console.log('✅ Successfully added agent_id column to orders table');
      
      // Verify the column was added
      const [verifyResult] = await connection.execute('DESCRIBE orders');
      const newAgentIdColumn = verifyResult.find(col => col.Field === 'agent_id');
      
      if (newAgentIdColumn) {
        console.log('✅ Verified: agent_id column exists in orders table');
        console.log('Column details:', newAgentIdColumn);
      } else {
        console.log('❌ agent_id column was not added successfully');
      }
      
    } catch (error) {
      console.log('❌ Failed to add agent_id column:', error.message);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addAgentIdToOrders(); 