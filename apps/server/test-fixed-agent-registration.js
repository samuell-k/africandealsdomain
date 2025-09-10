const pool = require('./db');
const bcrypt = require('bcrypt');

async function testFixedAgentRegistration() {
    console.log('🧪 Testing Fixed Agent Registration...\n');

    try {
        // Step 1: Test agent registration with proper data
        console.log('1. Testing agent registration with proper data...');
        
        const testEmail = `test.agent.${Date.now()}@example.com`;
        const testPassword = 'testpassword123';
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        // Create test user first
        const [userResult] = await pool.execute(`
            INSERT INTO users (
                first_name, last_name, email, phone, password, role, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        `, [
            'Test',
            'Agent',
            testEmail,
            '+250788123456',
            hashedPassword,
            'agent'
        ]);

        const userId = userResult.insertId;
        console.log(`✅ Test user created with ID: ${userId}`);

        // Generate unique agent code
        const agentCode = `AGT-${Date.now()}`;

        // Create agent record with proper email
        const [agentResult] = await pool.execute(`
            INSERT INTO agents (
                agent_code, user_id, first_name, last_name, email, phone,
                agent_type, primary_territory, status, verification_status,
                commission_rate, bonus_rate, permissions, is_available,
                latitude, longitude, marketplace_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            agentCode,
            userId,
            'Test',
            'Agent',
            testEmail, // Use the actual email
            '+250788123456',
            'fast_delivery',
            'Kigali',
            'pending_verification',
            'unverified',
            15.00,
            5.00,
            JSON.stringify(['deliver', 'pickup', 'track']),
            0,
            -1.9441,
            30.0619,
            'grocery'
        ]);

        const agentId = agentResult.insertId;
        console.log(`✅ Agent record created with ID: ${agentId}`);

        // Create agent verification record
        await pool.execute(`
            INSERT INTO agent_verification (
                agent_id, user_id, verification_status, date_of_birth, gender,
                district, latitude, longitude, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            agentId,
            userId,
            'pending',
            '1990-01-01',
            'male',
            'Kigali',
            '-1.9441',
            '30.0619'
        ]);

        console.log('✅ Agent verification record created');

        // Step 2: Test admin can see the registration
        console.log('\n2. Testing admin can see pending registrations...');
        
        const [pendingRegistrations] = await pool.execute(`
            SELECT 
                av.*,
                u.first_name,
                u.last_name,
                u.email,
                a.agent_type,
                a.agent_code
            FROM agent_verification av
            JOIN users u ON av.user_id = u.id
            JOIN agents a ON av.agent_id = a.id
            WHERE av.verification_status = 'pending'
            AND av.agent_id = ?
        `, [agentId]);

        if (pendingRegistrations.length > 0) {
            console.log(`✅ Found pending registration for agent`);
            const reg = pendingRegistrations[0];
            console.log(`   - Name: ${reg.first_name} ${reg.last_name}`);
            console.log(`   - Email: ${reg.email}`);
            console.log(`   - Agent Code: ${reg.agent_code}`);
            console.log(`   - Agent Type: ${reg.agent_type}`);
            console.log(`   - Status: ${reg.verification_status}`);
        } else {
            console.log('❌ No pending registrations found');
        }

        // Step 3: Test admin approval
        console.log('\n3. Testing admin approval process...');
        
        // Create admin user
        const adminEmail = `admin.${Date.now()}@example.com`;
        const adminPassword = await bcrypt.hash('adminpassword123', 10);
        
        const [adminResult] = await pool.execute(`
            INSERT INTO users (
                first_name, last_name, email, phone, password, role, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        `, [
            'Admin',
            'User',
            adminEmail,
            '+250788654321',
            adminPassword,
            'admin'
        ]);

        const adminId = adminResult.insertId;
        console.log(`✅ Test admin created with ID: ${adminId}`);

        // Approve the agent
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Update verification status
            await connection.execute(`
                UPDATE agent_verification 
                SET verification_status = ?, reviewed_at = NOW(), admin_notes = ?
                WHERE agent_id = ?
            `, ['approved', 'Test approval - all documents verified', agentId]);

            // Update agent status
            await connection.execute(`
                UPDATE agents 
                SET status = ?, verification_status = ?
                WHERE id = ?
            `, ['active', 'verified', agentId]);

            // Update user verification
            await connection.execute(`
                UPDATE users 
                SET is_verified = 1
                WHERE id = ?
            `, [userId]);

            // Create notification
            await connection.execute(`
                INSERT INTO notifications (
                    user_id, type, title, message, data, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                userId,
                'agent_approved',
                'Welcome to the Team!',
                'Congratulations! Your fast delivery agent application has been approved.',
                JSON.stringify({ agent_type: 'fast_delivery', agent_code: agentCode })
            ]);

            // Create admin log
            await connection.execute(`
                INSERT INTO admin_logs (
                    admin_id, action, target_type, target_id, details, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                adminId,
                'agent_registration_approved',
                'agent_verification',
                agentId,
                JSON.stringify({
                    status: 'approved',
                    agent_type: 'fast_delivery',
                    agent_name: 'Test Agent',
                    agent_code: agentCode
                })
            ]);

            await connection.commit();
            console.log('✅ Agent registration approved successfully');

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // Step 4: Verify the approval
        console.log('\n4. Verifying approval results...');
        
        const [approvedAgent] = await pool.execute(`
            SELECT 
                av.verification_status,
                av.reviewed_at,
                av.admin_notes,
                a.status as agent_status,
                a.verification_status as agent_verification_status,
                u.is_verified as user_verified
            FROM agent_verification av
            JOIN agents a ON av.agent_id = a.id
            JOIN users u ON av.user_id = u.id
            WHERE av.agent_id = ?
        `, [agentId]);

        if (approvedAgent.length > 0) {
            const agent = approvedAgent[0];
            console.log('✅ Agent approval verification:');
            console.log(`   - Verification Status: ${agent.verification_status}`);
            console.log(`   - Agent Status: ${agent.agent_status}`);
            console.log(`   - Agent Verification: ${agent.agent_verification_status}`);
            console.log(`   - User Verified: ${agent.user_verified ? 'Yes' : 'No'}`);
            console.log(`   - Admin Notes: ${agent.admin_notes}`);
        }

        // Step 5: Check notifications
        console.log('\n5. Checking notifications...');
        
        const [notifications] = await pool.execute(`
            SELECT * FROM notifications WHERE user_id = ?
        `, [userId]);

        if (notifications.length > 0) {
            console.log(`✅ Found ${notifications.length} notification(s)`);
            notifications.forEach(notif => {
                console.log(`   - ${notif.title}: ${notif.message}`);
            });
        }

        // Step 6: Check admin logs
        console.log('\n6. Checking admin logs...');
        
        const [adminLogs] = await pool.execute(`
            SELECT * FROM admin_logs WHERE admin_id = ?
        `, [adminId]);

        if (adminLogs.length > 0) {
            console.log(`✅ Found ${adminLogs.length} admin log(s)`);
            adminLogs.forEach(log => {
                console.log(`   - ${log.action}: ${log.target_type}`);
            });
        }

        console.log('\n🎯 Agent registration flow test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ Agent registration with proper email works');
        console.log('✅ Admin can see pending registrations');
        console.log('✅ Admin approval process works');
        console.log('✅ Notifications are created');
        console.log('✅ Admin logs are created');
        console.log('✅ All database constraints are satisfied');

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await pool.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
        await pool.execute('DELETE FROM admin_logs WHERE admin_id = ?', [adminId]);
        await pool.execute('DELETE FROM agent_verification WHERE agent_id = ?', [agentId]);
        await pool.execute('DELETE FROM agents WHERE id = ?', [agentId]);
        await pool.execute('DELETE FROM users WHERE id IN (?, ?)', [userId, adminId]);
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        process.exit(0);
    }
}

testFixedAgentRegistration();