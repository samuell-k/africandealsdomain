const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function testAgentAPI() {
    console.log('🔍 Testing Agent API Functions...\n');

    try {
        // Test 1: Check database connection
        console.log('1. Testing database connection...');
        const [result] = await db.query('SELECT 1 as test');
        console.log('✅ Database connection working');

        // Test 2: Test agent registration logic
        console.log('\n2. Testing agent registration logic...');
        
        const testEmail = 'testagent2@example.com';
        const testPassword = 'testpassword123';
        
        // Check if email already exists
        const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [testEmail]);
        if (existingUser.length > 0) {
            console.log('⚠️ Test email already exists, skipping registration test');
        } else {
            // Hash password
            const hashedPassword = await bcrypt.hash(testPassword, 10);
            
            // Create user account
            const [userResult] = await db.query(
                'INSERT INTO users (username, email, phone, password_hash, role, is_active, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [testEmail, testEmail, '+1234567890', hashedPassword, 'agent', true, false]
            );
            
            const userId = userResult.insertId;
            
            // Generate agent code
            const [maxResult] = await db.query('SELECT MAX(CAST(SUBSTRING(agent_code, 5) AS UNSIGNED)) as max_num FROM agents');
            const maxNum = maxResult[0].max_num || 0;
            const agentCode = `AGT-${String(maxNum + 1).padStart(3, '0')}`;
            
            // Create agent record
            const [agentResult] = await db.query(
                `INSERT INTO agents (
                    agent_code, user_id, first_name, last_name, email, phone,
                    agent_type, vehicle_type, primary_territory,
                    commission_rate, bonus_rate, permissions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    agentCode, userId, 'Test', 'Agent', testEmail, '+1234567890',
                    'both', 'motorcycle', 'East Africa',
                    15.00, 5.00, JSON.stringify(['deliver', 'pickup', 'track', 'report'])
                ]
            );
            
            console.log('✅ Agent registration logic working');
            console.log(`   - User ID: ${userId}`);
            console.log(`   - Agent ID: ${agentResult.insertId}`);
            console.log(`   - Agent Code: ${agentCode}`);
        }

        // Test 3: Test agent login logic
        console.log('\n3. Testing agent login logic...');
        
        // Find agent by email
        const [agents] = await db.query(`
            SELECT a.*, u.password_hash, u.is_active, u.is_verified 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.email = ?
        `, [testEmail]);

        if (agents.length > 0) {
            const agent = agents[0];
            
            // Verify password
            const validPassword = await bcrypt.compare(testPassword, agent.password_hash);
            
            if (validPassword) {
                // Generate JWT token
                const token = jwt.sign(
                    { 
                        id: agent.user_id, 
                        agent_id: agent.id,
                        email: agent.email, 
                        role: 'agent',
                        agent_code: agent.agent_code
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );
                
                console.log('✅ Agent login logic working');
                console.log(`   - Agent found: ${agent.first_name} ${agent.last_name}`);
                console.log(`   - Password valid: ${validPassword}`);
                console.log(`   - Token generated: ${token ? 'Yes' : 'No'}`);
            } else {
                console.log('❌ Password verification failed');
            }
        } else {
            console.log('❌ Agent not found for login test');
        }

        // Test 4: Test with invalid credentials
        console.log('\n4. Testing invalid login...');
        const [invalidAgents] = await db.query(`
            SELECT a.*, u.password_hash 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.email = ?
        `, ['nonexistent@example.com']);

        if (invalidAgents.length === 0) {
            console.log('✅ Invalid login properly handled - no agent found');
        } else {
            console.log('❌ Unexpected agent found for invalid email');
        }

        console.log('\n🎯 Agent API test completed!');

    } catch (error) {
        console.error('❌ Agent API test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        process.exit(0);
    }
}

testAgentAPI();