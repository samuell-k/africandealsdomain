const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function debugAgentsTable() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Debugging Agents Table...');
        
        // Check if agents table exists and what it contains
        try {
            const [agents] = await connection.query('SELECT * FROM agents LIMIT 10');
            console.log(`📋 Found ${agents.length} agents:`);
            agents.forEach(agent => {
                console.log(`  - Agent ID: ${agent.id}, User ID: ${agent.user_id}, Type: ${agent.agent_type || 'N/A'}`);
            });
        } catch (error) {
            console.log('❌ Agents table error:', error.message);
        }
        
        // Check pickup_delivery_agents table
        try {
            const [pdaAgents] = await connection.query('SELECT * FROM pickup_delivery_agents LIMIT 10');
            console.log(`\n📋 Found ${pdaAgents.length} PDA agents:`);
            pdaAgents.forEach(agent => {
                console.log(`  - PDA ID: ${agent.id}, User ID: ${agent.user_id}, Name: ${agent.name || 'N/A'}`);
            });
        } catch (error) {
            console.log('❌ pickup_delivery_agents table error:', error.message);
        }
        
        // Check users table for our PDA user
        const [users] = await connection.query(`
            SELECT id, name, email, role, agent_type 
            FROM users 
            WHERE email = 'pda.test@example.com'
        `);
        
        if (users.length > 0) {
            const user = users[0];
            console.log(`\n👤 PDA User Details:`);
            console.log(`  - User ID: ${user.id}`);
            console.log(`  - Name: ${user.name}`);
            console.log(`  - Email: ${user.email}`);
            console.log(`  - Role: ${user.role}`);
            console.log(`  - Agent Type: ${user.agent_type}`);
            
            // Check if there's a corresponding agent record
            try {
                const [agentRecord] = await connection.query(`
                    SELECT * FROM agents WHERE user_id = ?
                `, [user.id]);
                
                if (agentRecord.length > 0) {
                    console.log(`  - Agent Record ID: ${agentRecord[0].id}`);
                } else {
                    console.log('  - No agent record found, creating one...');
                    
                    // Create agent record
                    const [result] = await connection.query(`
                        INSERT INTO agents (user_id, agent_type, created_at) 
                        VALUES (?, ?, NOW())
                    `, [user.id, 'pickup_delivery_agent']);
                    
                    console.log(`  - Created agent record with ID: ${result.insertId}`);
                }
            } catch (error) {
                console.log('❌ Error checking/creating agent record:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugAgentsTable();