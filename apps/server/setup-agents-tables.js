const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupAgentsTables() {
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

    // Read the agents table creation SQL
    const agentsTableSQL = fs.readFileSync(path.join(__dirname, 'create-agents-table.sql'), 'utf8');
    
    // Split the SQL into individual statements
    const statements = agentsTableSQL.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await connection.execute(statement);
          console.log(`✅ Executed statement ${i + 1}`);
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1} failed (might already exist):`, error.message);
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    
    const tablesToCheck = ['agents', 'agent_activities', 'agent_earnings', 'agent_ratings', 'agent_schedules', 'agent_territories'];
    
    for (const table of tablesToCheck) {
      try {
        const [result] = await connection.execute(`DESCRIBE ${table}`);
        console.log(`✅ ${table} table exists with ${result.length} columns`);
      } catch (error) {
        console.log(`❌ ${table} table does not exist:`, error.message);
      }
    }

    // Test if orders table has agent_id column
    try {
      const [ordersResult] = await connection.execute('DESCRIBE orders');
      const agentIdColumn = ordersResult.find(col => col.Field === 'agent_id');
      if (agentIdColumn) {
        console.log('✅ Orders table has agent_id column');
      } else {
        console.log('❌ Orders table does not have agent_id column');
      }
    } catch (error) {
      console.log('❌ Orders table does not exist:', error.message);
    }

    console.log('\n🎉 Agents tables setup completed!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupAgentsTables(); 