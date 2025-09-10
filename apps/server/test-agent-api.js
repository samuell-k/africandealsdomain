const request = require('supertest');
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use the agents router
const agentsRouter = require('./routes/agents');
app.use('/api/agents', agentsRouter);

async function testAgentAPI() {
    console.log('🔍 Testing Agent API Endpoints...\n');

    try {
        // Test 1: Agent Registration
        console.log('1. Testing Agent Registration...');
        const registrationData = {
            first_name: 'Test',
            last_name: 'Agent',
            email: 'testagent@example.com',
            phone: '+1234567890',
            password: 'testpassword123',
            primary_territory: 'East Africa',
            vehicle_type: 'motorcycle',
            agent_type: 'both',
            commission_rate: 15.00,
            bonus_rate: 5.00,
            permissions: ['deliver', 'pickup', 'track', 'report']
        };

        const registerResponse = await request(app)
            .post('/api/agents/register')
            .send(registrationData)
            .expect('Content-Type', /json/);

        console.log('Registration Status:', registerResponse.status);
        console.log('Registration Response:', registerResponse.body);

        if (registerResponse.status === 201) {
            console.log('✅ Agent registration endpoint working');
        } else {
            console.log('❌ Agent registration failed:', registerResponse.body.error);
        }

        // Test 2: Agent Login
        console.log('\n2. Testing Agent Login...');
        const loginData = {
            email: 'testagent@example.com',
            password: 'testpassword123'
        };

        const loginResponse = await request(app)
            .post('/api/agents/login')
            .send(loginData)
            .expect('Content-Type', /json/);

        console.log('Login Status:', loginResponse.status);
        console.log('Login Response:', loginResponse.body);

        if (loginResponse.status === 200) {
            console.log('✅ Agent login endpoint working');
            console.log('Token received:', loginResponse.body.token ? 'Yes' : 'No');
        } else {
            console.log('❌ Agent login failed:', loginResponse.body.error);
        }

        // Test 3: Test with invalid credentials
        console.log('\n3. Testing Invalid Login...');
        const invalidLoginData = {
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
        };

        const invalidLoginResponse = await request(app)
            .post('/api/agents/login')
            .send(invalidLoginData)
            .expect('Content-Type', /json/);

        console.log('Invalid Login Status:', invalidLoginResponse.status);
        if (invalidLoginResponse.status === 401) {
            console.log('✅ Invalid login properly rejected');
        } else {
            console.log('❌ Invalid login not properly handled');
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