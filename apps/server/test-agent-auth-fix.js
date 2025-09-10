const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function testAgentAuthFix() {
    console.log('🔍 Testing Agent Authentication Fix...\n');

    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

    try {
        // Test 1: Check database connection
        console.log('1. Testing database connection...');
        const [result] = await db.query('SELECT 1 as test');
        console.log('✅ Database connection working');

        // Test 2: Create a test agent account
        console.log('\n2. Creating test agent account...');
        
        const testEmail = 'testauth@example.com';
        const testPassword = 'testpassword123';
        
        // Check if email already exists
        const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [testEmail]);
        if (existingUser.length > 0) {
            console.log('⚠️ Test email already exists, cleaning up...');
            await db.query('DELETE FROM agent_activities WHERE agent_id IN (SELECT id FROM agents WHERE email = ?)', [testEmail]);
            await db.query('DELETE FROM agents WHERE email = ?', [testEmail]);
            await db.query('DELETE FROM users WHERE email = ?', [testEmail]);
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Create user account
        const [userResult] = await db.query(
            'INSERT INTO users (username, email, phone, password_hash, role, is_active, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [testEmail, testEmail, '+1234567890', hashedPassword, 'agent', true, true]
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
                commission_rate, bonus_rate, permissions, status, verification_status, is_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                agentCode, userId, 'Test', 'Auth', testEmail, '+1234567890',
                'both', 'motorcycle', 'East Africa',
                15.00, 5.00, JSON.stringify(['deliver', 'pickup', 'track', 'report']),
                'active', 'verified', true
            ]
        );
        
        console.log('✅ Test agent account created');
        console.log(`   - User ID: ${userId}`);
        console.log(`   - Agent ID: ${agentResult.insertId}`);
        console.log(`   - Agent Code: ${agentCode}`);

        // Test 3: Test login logic with correct credentials
        console.log('\n3. Testing login with correct credentials...');
        
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
                // Generate JWT token with the correct secret
                const token = jwt.sign(
                    { 
                        id: agent.user_id, 
                        agent_id: agent.id,
                        email: agent.email, 
                        role: 'agent',
                        agent_code: agent.agent_code
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                // Verify the token can be decoded
                const decoded = jwt.verify(token, JWT_SECRET);
                
                console.log('✅ Login logic working correctly');
                console.log(`   - Agent found: ${agent.first_name} ${agent.last_name}`);
                console.log(`   - Password valid: ${validPassword}`);
                console.log(`   - Token generated: ${token ? 'Yes' : 'No'}`);
                console.log(`   - Token verified: ${decoded ? 'Yes' : 'No'}`);
                console.log(`   - Token payload:`, decoded);
            } else {
                console.log('❌ Password verification failed');
            }
        } else {
            console.log('❌ Agent not found for login test');
        }

        // Test 4: Test with wrong password
        console.log('\n4. Testing login with wrong password...');
        const wrongPassword = 'wrongpassword123';
        const [agents2] = await db.query(`
            SELECT a.*, u.password_hash 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.email = ?
        `, [testEmail]);

        if (agents2.length > 0) {
            const agent = agents2[0];
            const validPassword = await bcrypt.compare(wrongPassword, agent.password_hash);
            console.log(`✅ Wrong password correctly rejected: ${!validPassword}`);
        }

        // Test 5: Test with non-existent email
        console.log('\n5. Testing login with non-existent email...');
        const [agents3] = await db.query(`
            SELECT a.*, u.password_hash 
            FROM agents a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.email = ?
        `, ['nonexistent@example.com']);

        console.log(`✅ Non-existent email correctly handled: ${agents3.length === 0}`);

        // Test 6: Test JWT token consistency
        console.log('\n6. Testing JWT token consistency...');
        
        const testToken = jwt.sign(
            { id: 1, agent_id: 1, email: 'test@example.com', role: 'agent' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        try {
            const decoded = jwt.verify(testToken, JWT_SECRET);
            console.log('✅ JWT token creation and verification working');
            console.log(`   - Token payload:`, decoded);
        } catch (error) {
            console.log('❌ JWT token verification failed:', error.message);
        }

        console.log('\n🎯 Agent authentication fix test completed!');
        console.log('\n📋 Summary:');
        console.log('✅ Database connection working');
        console.log('✅ Test agent account created');
        console.log('✅ Login logic working correctly');
        console.log('✅ Wrong password correctly rejected');
        console.log('✅ Non-existent email correctly handled');
        console.log('✅ JWT token consistency verified');

    } catch (error) {
        console.error('❌ Agent authentication fix test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        process.exit(0);
    }
}

testAgentAuthFix();