const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugProfileIssue() {
    console.log('🔍 Debugging Profile Issue...');
    
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3333,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Check if our test user exists
        console.log('\n👤 Checking test user...');
        const [users] = await pool.query(`
            SELECT id, username, email, role, agent_type 
            FROM users 
            WHERE email = 'pda.test@example.com'
        `);
        
        if (users.length === 0) {
            console.log('❌ Test user not found');
            return;
        }
        
        const user = users[0];
        console.log('✅ Test user found:', user);
        
        // Check agents table
        console.log('\n🤖 Checking agents table...');
        const [agents] = await pool.query(`
            SELECT * FROM agents WHERE user_id = ?
        `, [user.id]);
        
        if (agents.length === 0) {
            console.log('❌ No agent record found for user');
            
            // Create agent record
            console.log('🔨 Creating agent record...');
            await pool.query(`
                INSERT INTO agents (
                    user_id, 
                    agent_type, 
                    status, 
                    admin_approval_status,
                    rating,
                    total_deliveries,
                    completed_deliveries,
                    is_available,
                    vehicle_type,
                    license_number,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                user.id,
                'pickup_delivery_agent',
                'active',
                'approved',
                4.5,
                10,
                8,
                1,
                'motorcycle',
                'PDA123456'
            ]);
            console.log('✅ Agent record created');
        } else {
            console.log('✅ Agent record found:', agents[0]);
        }
        
        // Test the profile query
        console.log('\n🧪 Testing profile query...');
        const [profileTest] = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.name,
                u.email,
                u.phone,
                u.address,
                u.city,
                u.country,
                u.created_at,
                a.rating,
                a.total_deliveries,
                a.completed_deliveries,
                a.current_location,
                a.is_available as agent_status,
                a.vehicle_type,
                a.license_number,
                a.vehicle_registration,
                a.insurance_number,
                a.agent_type,
                a.status,
                a.admin_approval_status
            FROM users u
            LEFT JOIN agents a ON u.id = a.user_id
            WHERE u.id = ? AND (a.agent_type = 'pickup_delivery' OR a.agent_type = 'pickup_delivery_agent')
        `, [user.id]);
        
        if (profileTest.length === 0) {
            console.log('❌ Profile query returned no results');
            
            // Try without agent_type filter
            console.log('🔍 Trying without agent_type filter...');
            const [profileTest2] = await pool.query(`
                SELECT 
                    u.id,
                    u.username,
                    u.name,
                    u.email,
                    u.phone,
                    a.agent_type
                FROM users u
                LEFT JOIN agents a ON u.id = a.user_id
                WHERE u.id = ?
            `, [user.id]);
            
            if (profileTest2.length > 0) {
                console.log('✅ User found with agent_type:', profileTest2[0].agent_type);
            }
        } else {
            console.log('✅ Profile query successful:', profileTest[0]);
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugProfileIssue();