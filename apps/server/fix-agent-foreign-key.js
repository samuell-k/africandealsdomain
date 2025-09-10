const mysql = require('mysql2/promise');

async function fixAgentForeignKey() {
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

    // Drop the existing foreign key constraint
    console.log('📝 Dropping existing foreign key constraint...');
    
    try {
      await connection.execute(`
        ALTER TABLE orders 
        DROP FOREIGN KEY fk_orders_agent
      `);
      console.log('✅ Dropped existing foreign key constraint');
    } catch (error) {
      console.log('⚠️ Could not drop foreign key (might not exist):', error.message);
    }

    // Add the correct foreign key constraint
    console.log('📝 Adding correct foreign key constraint...');
    
    try {
      await connection.execute(`
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_agent 
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
      `);
      
      console.log('✅ Successfully added correct foreign key constraint');
      
      // Verify the constraint
      const [constraints] = await connection.execute(`
        SELECT 
          CONSTRAINT_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'agent_id'
      `);
      
      if (constraints.length > 0) {
        console.log('✅ Verified foreign key constraint:', constraints[0]);
      } else {
        console.log('❌ Foreign key constraint was not added successfully');
      }
      
    } catch (error) {
      console.log('❌ Failed to add foreign key constraint:', error.message);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAgentForeignKey(); 