const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function testPSMAuth() {
    let connection;
    
    try {
        console.log('🔧 Testing PSM authentication...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Find the PSM test user
        const [users] = await connection.query(
            'SELECT id, email, name FROM users WHERE email = ?',
            ['psm.test@example.com']
        );
        
        if (users.length === 0) {
            console.log('❌ PSM test user not found');
            return;
        }
        
        const user = users[0];
        console.log('📋 Found PSM user:', user);
        
        // Check agent record
        const [agents] = await connection.query(
            'SELECT * FROM agents WHERE user_id = ? AND agent_type = ?',
            [user.id, 'pickup_site_manager']
        );
        
        if (agents.length === 0) {
            console.log('❌ No PSM agent record found');
            return;
        }
        
        const agent = agents[0];
        console.log('📋 Found PSM agent:', agent);
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                userId: user.id, 
                email: user.email, 
                name: user.name,
                role: 'agent',
                agentType: 'pickup_site_manager'
            },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            { expiresIn: '24h' }
        );
        
        console.log('🎉 Generated JWT token:');
        console.log(token);
        
        // Test the token by making a request to site-info
        console.log('\n🧪 Testing API call...');
        
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('http://localhost:3002/api/pickup-site-manager/site-info', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('📊 API Response Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Response Data:', data);
            } else {
                const errorText = await response.text();
                console.log('❌ API Error:', errorText);
            }
        } catch (fetchError) {
            console.log('⚠️ Could not test API call:', fetchError.message);
            console.log('💡 You can test manually with this token in the browser');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run test
testPSMAuth();