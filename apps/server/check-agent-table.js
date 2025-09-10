const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function checkAgentTable() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Checking agents table structure...');
        
        // Get table structure
        const [columns] = await connection.query('DESCRIBE agents');
        
        console.log('\n📋 Agents table columns:');
        for (const col of columns) {
            console.log(`   ${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default} ${col.Extra}`);
        }
        
        // Check current agent records
        const [agents] = await connection.query(`
            SELECT a.id, a.user_id, a.agent_type, a.status, u.email 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE u.email IN ('pda.test@example.com', 'psm.test@example.com')
        `);
        
        console.log('\n📋 Current agent records:');
        for (const agent of agents) {
            console.log(`   ID: ${agent.id}, Email: ${agent.email}, Type: ${agent.agent_type}, Status: '${agent.status}'`);
        }
        
        // Try to update with different status values
        console.log('\n🔧 Trying to update status...');
        
        try {
            await connection.query(`
                UPDATE agents 
                SET status = 'online' 
                WHERE user_id IN (
                    SELECT id FROM users 
                    WHERE email = 'pda.test@example.com'
                )
            `);
            console.log('✅ Updated PDA status to online');
        } catch (error) {
            console.log('❌ Failed to update PDA status:', error.message);
        }
        
        try {
            await connection.query(`
                UPDATE agents 
                SET status = 'available' 
                WHERE user_id IN (
                    SELECT id FROM users 
                    WHERE email = 'psm.test@example.com'
                )
            `);
            console.log('✅ Updated PSM status to available');
        } catch (error) {
            console.log('❌ Failed to update PSM status:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Error checking agent table:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkAgentTable();