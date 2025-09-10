const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixEmptyAgentCodes() {
  console.log('🔧 Fixing Empty Agent Codes...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connection established\n');

    // Find agents with empty agent_code
    const [emptyAgents] = await connection.execute(
      'SELECT id, user_id, first_name, last_name FROM agents WHERE agent_code = "" OR agent_code IS NULL'
    );

    console.log(`Found ${emptyAgents.length} agents with empty agent codes`);

    if (emptyAgents.length > 0) {
      console.log('Agents with empty codes:');
      console.table(emptyAgents);

      // Generate unique agent codes for each
      for (const agent of emptyAgents) {
        const generateAgentCode = () => {
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          return `AGT-${timestamp}${random}`;
        };

        let agentCode = generateAgentCode();
        
        // Ensure uniqueness
        let codeExists = true;
        let attempts = 0;
        while (codeExists && attempts < 10) {
          const [existingCode] = await connection.execute(
            'SELECT id FROM agents WHERE agent_code = ?',
            [agentCode]
          );
          if (existingCode.length === 0) {
            codeExists = false;
          } else {
            agentCode = generateAgentCode();
            attempts++;
          }
        }

        // Update the agent with the new code
        await connection.execute(
          'UPDATE agents SET agent_code = ? WHERE id = ?',
          [agentCode, agent.id]
        );

        console.log(`✅ Updated agent ${agent.id} (${agent.first_name} ${agent.last_name}) with code: ${agentCode}`);
      }
    }

    console.log('\n✅ All agent codes fixed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

fixEmptyAgentCodes();