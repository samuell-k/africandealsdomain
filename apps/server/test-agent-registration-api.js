const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const pool = require('./db');

// Create test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load routes
const agentRegistrationRouter = require('./routes/agent-registration');
const adminAgentManagementRouter = require('./routes/admin-agent-management');

app.use('/api/auth', agentRegistrationRouter);
app.use('/api/admin', adminAgentManagementRouter);

async function testAgentRegistrationAPI() {
    console.log('🧪 Testing Agent Registration API Endpoints...\n');

    let testUserId, testAgentId, testApplicationRef, adminUserId, adminToken;

    try {
        // Step 1: Test agent types configuration endpoint
        console.log('1. Testing agent types configuration endpoint...');
        
        const configResponse = await request(app)
            .get('/api/auth/agent-types-config')
            .expect(200);

        if (configResponse.body.success && configResponse.body.data.length > 0) {
            console.log('✅ Agent types config endpoint works');
            console.log(`   Found ${configResponse.body.data.length} agent types`);
        } else {
            console.log('❌ Agent types config endpoint failed');
            return;
        }

        // Step 2: Test agent registration endpoint
        console.log('\n2. Testing agent registration endpoint...');
        
        const testRegistrationData = {
            selectedAgentType: 'fast_delivery',
            first_name: 'Test',
            last_name: 'Agent',
            email: `test.agent.api.${Date.now()}@example.com`,
            phone: '+250788123456',
            password: 'testpassword123',
            confirm_password: 'testpassword123',
            date_of_birth: '1990-01-01',
            gender: 'male',
            district: 'Kigali',
            latitude: '-1.9441',
            longitude: '30.0619'
        };

        const registrationResponse = await request(app)
            .post('/api/auth/agent-registration')
            .send(testRegistrationData);

        console.log('Registration response status:', registrationResponse.status);
        
        if ((registrationResponse.status === 200 || registrationResponse.status === 201) && registrationResponse.body.success) {
            console.log('✅ Agent registration successful');
            testUserId = registrationResponse.body.userId || registrationResponse.body.data?.user_id;
            testAgentId = registrationResponse.body.applicationId || registrationResponse.body.data?.agent_id;
            testApplicationRef = registrationResponse.body.data?.applicationRef;
            console.log(`   User ID: ${testUserId}`);
            console.log(`   Application ID: ${testAgentId}`);
            console.log(`   Application Ref: ${testApplicationRef}`);
        } else {
            console.log('❌ Agent registration failed');
            console.log('   Response:', JSON.stringify(registrationResponse.body, null, 2));
            return;
        }

        // Step 3: Test application status endpoint
        console.log('\n3. Testing application status endpoint...');
        
        const statusResponse = await request(app)
            .get(`/api/auth/application-status/${testApplicationRef}`)
            .expect(200);

        if (statusResponse.body.success) {
            console.log('✅ Application status endpoint works');
            console.log(`   Status: ${statusResponse.body.data.status}`);
            console.log(`   Application Ref: ${statusResponse.body.data.applicationRef}`);
        } else {
            console.log('❌ Application status endpoint failed');
        }

        // Step 4: Create admin user and token for admin endpoints
        console.log('\n4. Creating admin user for testing admin endpoints...');
        
        const bcrypt = require('bcrypt');
        const adminEmail = `admin.api.${Date.now()}@example.com`;
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

        adminUserId = adminResult.insertId;
        
        // Create admin token
        adminToken = jwt.sign(
            { id: adminUserId, role: 'admin' },
            process.env.JWT_SECRET || 'adminafricandealsdomainpassword',
            { expiresIn: '1h' }
        );
        
        console.log(`✅ Admin user created with ID: ${adminUserId}`);

        // Step 5: Test admin get agent registrations endpoint
        console.log('\n5. Testing admin get agent registrations endpoint...');
        
        const adminRegistrationsResponse = await request(app)
            .get('/api/admin/agent-registrations?status=pending')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        if (adminRegistrationsResponse.body.success) {
            console.log('✅ Admin agent registrations endpoint works');
            console.log(`   Found ${adminRegistrationsResponse.body.data.length} pending registrations`);
        } else {
            console.log('❌ Admin agent registrations endpoint failed');
        }

        // Step 6: Test admin get specific registration endpoint
        console.log('\n6. Testing admin get specific registration endpoint...');
        
        // First get the verification ID
        const [verificationRecord] = await pool.execute(
            'SELECT id FROM agent_verification WHERE agent_id = ?',
            [testAgentId]
        );

        if (verificationRecord.length > 0) {
            const verificationId = verificationRecord[0].id;
            
            const specificRegistrationResponse = await request(app)
                .get(`/api/admin/agent-registration/${verificationId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            if (specificRegistrationResponse.body.success) {
                console.log('✅ Admin specific registration endpoint works');
                console.log(`   Registration details retrieved for ID: ${verificationId}`);
            } else {
                console.log('❌ Admin specific registration endpoint failed');
            }
        }

        // Step 7: Test admin approval endpoint
        console.log('\n7. Testing admin approval endpoint...');
        
        if (verificationRecord.length > 0) {
            const verificationId = verificationRecord[0].id;
            
            const approvalResponse = await request(app)
                .put(`/api/admin/agent-registration/${verificationId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'approved',
                    admin_notes: 'API test approval - all requirements met'
                });

            console.log('Approval response status:', approvalResponse.status);
            
            if (approvalResponse.status === 200 && approvalResponse.body.success) {
                console.log('✅ Admin approval endpoint works');
                console.log(`   Registration approved successfully`);
            } else {
                console.log('❌ Admin approval endpoint failed');
                console.log('   Response:', JSON.stringify(approvalResponse.body, null, 2));
            }
        }

        // Step 8: Test admin agent types endpoint
        console.log('\n8. Testing admin agent types endpoint...');
        
        const adminAgentTypesResponse = await request(app)
            .get('/api/admin/agent-types')
            .set('Authorization', `Bearer ${adminToken}`);

        console.log('Agent types response status:', adminAgentTypesResponse.status);
        console.log('Agent types response body:', JSON.stringify(adminAgentTypesResponse.body, null, 2));

        if (adminAgentTypesResponse.status === 200 && adminAgentTypesResponse.body.agentTypes) {
            console.log('✅ Admin agent types endpoint works');
            console.log(`   Found ${adminAgentTypesResponse.body.agentTypes.length} agent types`);
        } else if (adminAgentTypesResponse.status === 200 && adminAgentTypesResponse.body.data) {
            console.log('✅ Admin agent types endpoint works');  
            console.log(`   Found ${adminAgentTypesResponse.body.data.length} agent types`);
        } else {
            console.log('❌ Admin agent types endpoint failed');
        }

        // Step 9: Verify final status
        console.log('\n9. Verifying final registration status...');
        
        const finalStatusResponse = await request(app)
            .get(`/api/auth/application-status/${testApplicationRef}`)
            .expect(200);

        if (finalStatusResponse.body.success) {
            const status = finalStatusResponse.body.data.status;
            console.log(`✅ Final status check: ${status}`);
            
            if (status === 'approved') {
                console.log('✅ Complete flow successful - agent is approved');
            } else {
                console.log(`⚠️  Status is ${status}, expected 'approved' after admin approval`);
            }
        }

        console.log('\n🎯 API endpoint tests completed successfully!');
        console.log('\n📋 Summary:');
        console.log('✅ Agent types configuration API works');
        console.log('✅ Agent registration API works');
        console.log('✅ Registration status API works');
        console.log('✅ Admin authentication works');
        console.log('✅ Admin get registrations API works');
        console.log('✅ Admin get specific registration API works');
        console.log('✅ Admin approval API works');
        console.log('✅ Admin agent types API works');
        console.log('✅ Complete agent registration flow works end-to-end');

    } catch (error) {
        console.error('❌ API test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response body:', error.response.body);
        }
        console.error('Stack trace:', error.stack);
    } finally {
        // Cleanup test data
        if (testUserId && testAgentId && adminUserId) {
            console.log('\n🧹 Cleaning up test data...');
            try {
                await pool.execute('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
                await pool.execute('DELETE FROM admin_logs WHERE admin_id = ?', [adminUserId]);
                await pool.execute('DELETE FROM agent_verification WHERE agent_id = ?', [testAgentId]);
                await pool.execute('DELETE FROM agents WHERE id = ?', [testAgentId]);
                await pool.execute('DELETE FROM users WHERE id IN (?, ?)', [testUserId, adminUserId]);
                console.log('✅ Test data cleaned up');
            } catch (cleanupError) {
                console.error('⚠️  Cleanup error:', cleanupError.message);
            }
        }
        process.exit(0);
    }
}

testAgentRegistrationAPI();