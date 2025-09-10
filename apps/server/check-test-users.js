const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function checkTestUsers() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Checking test users...');
        
        const testEmails = ['pda.test@example.com', 'psm.test@example.com'];
        
        for (const email of testEmails) {
            const [users] = await connection.query(
                'SELECT id, name, email, role, phone, created_at FROM users WHERE email = ?',
                [email]
            );
            
            if (users.length > 0) {
                const user = users[0];
                console.log(`\n✅ User found: ${email}`);
                console.log(`   ID: ${user.id}`);
                console.log(`   Name: ${user.name}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Phone: ${user.phone}`);
                console.log(`   Created: ${user.created_at}`);
                
                // Check agent record
                const [agents] = await connection.query(
                    'SELECT id, agent_type, status, pickup_site_id FROM agents WHERE user_id = ?',
                    [user.id]
                );
                
                if (agents.length > 0) {
                    console.log(`   Agent Record: ID=${agents[0].id}, Type=${agents[0].agent_type}, Status=${agents[0].status}, Site=${agents[0].pickup_site_id}`);
                } else {
                    console.log(`   ❌ No agent record found`);
                }
                
                // Check PSM record if applicable
                if (email.includes('psm')) {
                    const [psms] = await connection.query(
                        'SELECT id, site_name, status FROM pickup_site_managers WHERE user_id = ?',
                        [user.id]
                    );
                    
                    if (psms.length > 0) {
                        console.log(`   PSM Record: ID=${psms[0].id}, Site=${psms[0].site_name}, Status=${psms[0].status}`);
                    } else {
                        console.log(`   ❌ No PSM record found`);
                    }
                }
            } else {
                console.log(`❌ User not found: ${email}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking test users:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkTestUsers();