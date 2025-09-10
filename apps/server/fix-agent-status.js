const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function fixAgentStatus() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Fixing agent status...');
        
        // Update agent statuses to active
        const [result] = await connection.query(`
            UPDATE agents 
            SET status = 'active' 
            WHERE user_id IN (
                SELECT id FROM users 
                WHERE email IN ('pda.test@example.com', 'psm.test@example.com')
            )
        `);
        
        console.log('✅ Updated agent statuses:', result.affectedRows, 'rows affected');
        
        // Verify the changes
        const [agents] = await connection.query(`
            SELECT a.id, a.user_id, a.agent_type, a.status, u.email 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE u.email IN ('pda.test@example.com', 'psm.test@example.com')
        `);
        
        console.log('\n📋 Agent records after update:');
        for (const agent of agents) {
            console.log(`   ${agent.email}: Type=${agent.agent_type}, Status=${agent.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error fixing agent status:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixAgentStatus();