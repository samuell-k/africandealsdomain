const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function testYourAgent() {
    console.log('🔍 Testing Your Agent Credentials...\n');

    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

    try { 
        const email = 'nyiranzabonimpajosiane@gmail.com';
        const password = 'nyiranzabonimpajosiane@gmail.com';
        
        // Check your user account
        console.log('1. Checking your user account...');
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.log('❌ User account not found');
            return;
        }
        
        const user = users[0];
        console.log('✅ User account found:');
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Name: ${user.name}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Role: ${user.role}`);
        
        // Check if there's an agent record
        console.log('\n2. Checking agent record...');
        const [agents] = await db.query('SELECT * FROM agents WHERE email = ?', [email]);
        
        if (agents.length === 0) {
            console.log('⚠️ No agent record found, creating one...');
            
            // Generate agent code
            const [maxResult] = await db.query('SELECT MAX(CAST(SUBSTRING(agent_code, 5) AS UNSIGNED)) as max_num FROM agents');
            const maxNum = maxResult[0].max_num || 0;
            const agentCode = `AGT-${String(maxNum + 1).padStart(3, '0')}`;
            
            // Create agent record
            const [agentResult] = await db.query(
                `INSERT INTO agents (
                    agent_code, user_id, first_name, last_name, email, phone,
                    agent_type, vehicle_type, primary_territory,
                    commission_rate, bonus_rate, permissions, status, verification_status, is_available
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    agentCode, user.id, 'Your', 'Name', email, '+1234567890',
                    'both', 'motorcycle', 'East Africa',
                    15.00, 5.00, JSON.stringify(['deliver', 'pickup', 'track', 'report']),
                    'active', 'verified', true
                ]
            );
            
            console.log('✅ Agent record created');
            console.log(`   - Agent ID: ${agentResult.insertId}`);
            console.log(`   - Agent Code: ${agentCode}`);
        } else {
            console.log('✅ Agent record found:');
            console.log(`   - Agent ID: ${agents[0].id}`);
            console.log(`   - Agent Code: ${agents[0].agent_code}`);
        }
        
        // Test login with your credentials
        console.log('\n3. Testing login with your credentials...');
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (validPassword) {
            console.log('✅ Password verification successful');
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    role: user.role,
                    name: user.name
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            // Verify the token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            console.log('✅ JWT token generated and verified');
            console.log(`   - Token payload:`, decoded);
            
            console.log('\n🎯 Your agent authentication is working perfectly!');
            console.log(`   - Email: ${user.email}`);
            console.log(`   - Role: ${user.role}`);
            console.log(`   - Name: ${user.name}`);
            console.log(`   - Status: Ready to use ✅`);
            
        } else {
            console.log('❌ Password verification failed');
            console.log('   - This might be due to bcrypt library mismatch');
        }
        
    } catch (error) {
        console.error('❌ Error testing your agent credentials:', error.message);
    } finally {
        process.exit(0);
    }
}

testYourAgent();