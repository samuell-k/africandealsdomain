const express = require('express');
const request = require('supertest');
const path = require('path');

// Create test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load the agent registration routes
const agentRegistrationRouter = require('./routes/agent-registration');
app.use('/api/auth', agentRegistrationRouter);

async function testAgentRegistrationFlow() {
    console.log('🧪 Testing Agent Registration Flow...\n');

    try {
        // Test 1: Get agent types configuration
        console.log('1. Testing agent types configuration endpoint...');
        const configResponse = await request(app)
            .get('/api/auth/agent-types-config')
            .expect(200);

        if (configResponse.body.success && configResponse.body.data.length > 0) {
            console.log('✅ Agent types config endpoint works');
            console.log(`   Found ${configResponse.body.data.length} agent types`);
            configResponse.body.data.forEach(type => {
                console.log(`   - ${type.type_code}: ${type.type_name}`);
            });
        } else {
            console.log('❌ Agent types config endpoint failed');
            return;
        }

        // Test 2: Test agent registration with minimal data
        console.log('\n2. Testing agent registration with minimal data...');
        const testRegistrationData = {
            agent_type: 'fast_delivery',
            first_name: 'Test',
            last_name: 'Agent',
            email: `test.agent.${Date.now()}@example.com`,
            phone: '+250788123456',
            password: 'testpassword123',
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
        console.log('Registration response body:', JSON.stringify(registrationResponse.body, null, 2));

        if (registrationResponse.status === 201 && registrationResponse.body.success) {
            console.log('✅ Agent registration successful');
            console.log(`   User ID: ${registrationResponse.body.data.user_id}`);
            console.log(`   Agent ID: ${registrationResponse.body.data.agent_id}`);
            console.log(`   Status: ${registrationResponse.body.data.verification_status}`);
        } else {
            console.log('❌ Agent registration failed');
            console.log('   Error:', registrationResponse.body.error || registrationResponse.body.message);
        }

        console.log('\n🎯 Registration flow test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response body:', error.response.body);
        }
    }
}

// Run the test
testAgentRegistrationFlow();