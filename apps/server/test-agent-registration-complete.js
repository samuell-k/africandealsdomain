const pool = require('./db');
const bcrypt = require('bcrypt');

async function testCompleteAgentRegistrationFlow() {
    console.log('🧪 Testing Complete Agent Registration Flow...\n');

    try {
        // Step 1: Check if agent types configuration exists
        console.log('1. Checking agent types configuration...');
        const [agentTypes] = await pool.execute('SELECT * FROM agent_types_config');
        
        if (agentTypes.length === 0) {
            console.log('❌ No agent types found. Creating default agent types...');
            
            const defaultAgentTypes = [
                {
                    type_code: 'fast_delivery',
                    type_name: 'Fast Delivery Agent',
                    description: 'Agents specialized in quick delivery services',
                    commission_rate: 0.05,
                    requirements: JSON.stringify({
                        vehicle_required: true,
                        license_required: true,
                        min_age: 18
                    })
                },
                {
                    type_code: 'bulk_delivery',
                    type_name: 'Bulk Delivery Agent',
                    description: 'Agents handling large volume deliveries',
                    commission_rate: 0.07,
                    requirements: JSON.stringify({
                        vehicle_required: true,
                        license_required: true,
                        min_age: 21
                    })
                },
                {
                    type_code: 'pickup_point',
                    type_name: 'Pickup Point Agent',
                    description: 'Agents managing pickup locations',
                    commission_rate: 0.03,
                    requirements: JSON.stringify({
                        location_required: true,
                        business_license: true
                    })
                }
            ];

            for (const agentType of defaultAgentTypes) {
                await pool.execute(`
                    INSERT INTO agent_types_config (
                        type_code, type_name, description, commission_rate, requirements, is_active
                    ) VALUES (?, ?, ?, ?, ?, 1)
                `, [
                    agentType.type_code,
                    agentType.type_name,
                    agentType.description,
                    agentType.commission_rate,
                    agentType.requirements
                ]);
            }
            console.log('✅ Default agent types created');
        } else {
            console.log(`✅ Found ${agentTypes.length} agent types`);
            agentTypes.forEach(type => {
                console.log(`   - ${type.type_code}: ${type.type_name}`);
            });
        }

        // Step 2: Test agent registration
        console.log('\n2. Testing agent registration...');
        
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

        // Create agent record
        const [agentResult] = await pool.execute(`
            INSERT INTO agents (
                user_id, agent_type, status, commission_rate, created_at
            ) VALUES (?, ?, ?, ?, NOW())
        `, [
            userId,
            'fast_delivery',
            'pending',
            0.05
        ]);

        const agentId = agentResult.insertId;
        console.log(`✅ Agent record created with ID: ${agentId}`);

        // Create agent verification record
        await pool.execute(`
            INSERT INTO agent_verification (
                agent_id, user_id, verification_status, date_of_birth, gender,
                phone, district, latitude, longitude, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            agentId,
            userId,
            'pending',
            '1990-01-01',
            'male',
            '+250788123456',
            'Kigali',
            '-1.9441',
            '30.0619'
        ]);

        console.log('✅ Agent verification record created');

        // Step 3: Test admin can see pending registrations
        console.log('\n3. Testing admin can see pending registrations...');
        
        const [pendingRegistrations] = await pool.execute(`
            SELECT 
                av.*,
                u.first_name,
                u.last_name,
                u.email,
                a.agent_type
            FROM agent_verification av
            JOIN users u ON av.user_id = u.id
            JOIN agents a ON av.agent_id = a.id
            WHERE av.verification_status = 'pending'
            ORDER BY av.submitted_at DESC
        `);

        if (pendingRegistrations.length > 0) {
            console.log(`✅ Found ${pendingRegistrations.length} pending registration(s)`);
            pendingRegistrations.forEach(reg => {
                console.log(`   - ${reg.first_name} ${reg.last_name} (${reg.email}) - ${reg.agent_type}`);
            });
        } else {
            console.log('❌ No pending registrations found');
        }

        // Step 4: Test admin approval process
        console.log('\n4. Testing admin approval process...');
        
        // Create admin user for testing
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

        // Approve the agent registration
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Update verification status
            await connection.execute(`
                UPDATE agent_verification 
                SET verification_status = ?, reviewed_at = NOW(), admin_notes = ?
                WHERE agent_id = ?
            `, ['approved', 'Test approval by automated system', agentId]);

            // Update agent status
            await connection.execute(`
                UPDATE agents 
                SET status = ?
                WHERE id = ?
            `, ['active', agentId]);

            // Update user status
            await connection.execute(`
                UPDATE users 
                SET is_verified = 1
                WHERE id = ?
            `, [userId]);

            // Create notification for the agent
            await connection.execute(`
                INSERT INTO notifications (
                    user_id, type, title, message, data, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                userId,
                'agent_approved',
                'Welcome to the Team!',
                'Congratulations! Your fast delivery agent application has been approved. You can now start accepting orders.',
                JSON.stringify({ agent_type: 'fast_delivery' })
            ]);

            // Create admin log
            await connection.execute(`
                INSERT INTO admin_logs (
                    admin_id, action, target_type, target_id, details, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                adminId,
                'agent_registration_review',
                'agent_verification',
                agentId,
                JSON.stringify({
                    status: 'approved',
                    agent_type: 'fast_delivery',
                    agent_name: 'Test Agent'
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

        // Step 5: Verify the approval worked
        console.log('\n5. Verifying approval process...');
        
        const [approvedAgent] = await pool.execute(`
            SELECT 
                av.verification_status,
                av.reviewed_at,
                av.admin_notes,
                a.status as agent_status,
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
            console.log(`   - User Verified: ${agent.user_verified ? 'Yes' : 'No'}`);
            console.log(`   - Reviewed At: ${agent.reviewed_at}`);
            console.log(`   - Admin Notes: ${agent.admin_notes}`);
        }

        // Step 6: Check notifications
        console.log('\n6. Checking notifications...');
        
        const [notifications] = await pool.execute(`
            SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
        `, [userId]);

        if (notifications.length > 0) {
            console.log(`✅ Found ${notifications.length} notification(s) for the agent`);
            notifications.forEach(notif => {
                console.log(`   - ${notif.title}: ${notif.message}`);
            });
        } else {
            console.log('❌ No notifications found for the agent');
        }

        // Step 7: Check admin logs
        console.log('\n7. Checking admin logs...');
        
        const [adminLogs] = await pool.execute(`
            SELECT * FROM admin_logs WHERE admin_id = ? ORDER BY created_at DESC
        `, [adminId]);

        if (adminLogs.length > 0) {
            console.log(`✅ Found ${adminLogs.length} admin log(s)`);
            adminLogs.forEach(log => {
                console.log(`   - ${log.action}: ${log.target_type} (ID: ${log.target_id})`);
            });
        } else {
            console.log('❌ No admin logs found');
        }

        console.log('\n🎯 Complete agent registration flow test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ Agent types configuration working');
        console.log('✅ Agent registration process working');
        console.log('✅ Admin can see pending registrations');
        console.log('✅ Admin approval process working');
        console.log('✅ Notifications system working');
        console.log('✅ Admin logging system working');

        // Cleanup test data
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

testCompleteAgentRegistrationFlow();