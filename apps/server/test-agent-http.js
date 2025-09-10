const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAgentHTTP() {
    console.log('🔍 Testing Agent HTTP Endpoints...\n');

    const baseUrl = 'http://localhost:3000';

    try {
        // Test 1: Agent Registration
        console.log('1. Testing Agent Registration...');
        const registrationData = {
            first_name: 'HTTP',
            last_name: 'Test',
            email: 'httptest@example.com',
            phone: '+1234567890',
            password: 'testpassword123',
            primary_territory: 'East Africa',
            vehicle_type: 'motorcycle',
            agent_type: 'both',
            commission_rate: 15.00,
            bonus_rate: 5.00,
            permissions: ['deliver', 'pickup', 'track', 'report']
        };

        const registerResponse = await fetch(`${baseUrl}/api/agents/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });

        console.log('Registration Status:', registerResponse.status);
        const registerResult = await registerResponse.json();
        console.log('Registration Response:', registerResult);

        if (registerResponse.status === 201) {
            console.log('✅ Agent registration endpoint working');
        } else {
            console.log('❌ Agent registration failed:', registerResult.error);
        }

        // Test 2: Agent Login
        console.log('\n2. Testing Agent Login...');
        const loginData = {
            email: 'httptest@example.com',
            password: 'testpassword123'
        };

        const loginResponse = await fetch(`${baseUrl}/api/agents/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        console.log('Login Status:', loginResponse.status);
        const loginResult = await loginResponse.json();
        console.log('Login Response:', loginResult);

        if (loginResponse.status === 200) {
            console.log('✅ Agent login endpoint working');
            console.log('Token received:', loginResult.token ? 'Yes' : 'No');
        } else {
            console.log('❌ Agent login failed:', loginResult.error);
        }

        // Test 3: Test with invalid credentials
        console.log('\n3. Testing Invalid Login...');
        const invalidLoginData = {
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
        };

        const invalidLoginResponse = await fetch(`${baseUrl}/api/agents/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invalidLoginData)
        });

        console.log('Invalid Login Status:', invalidLoginResponse.status);
        const invalidLoginResult = await invalidLoginResponse.json();
        if (invalidLoginResponse.status === 401) {
            console.log('✅ Invalid login properly rejected');
        } else {
            console.log('❌ Invalid login not properly handled');
        }

        console.log('\n🎯 Agent HTTP test completed!');

    } catch (error) {
        console.error('❌ Agent HTTP test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        process.exit(0);
    }
}

testAgentHTTP();