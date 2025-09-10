const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testYourAgentHTTP() {
    console.log('🔍 Testing Your Agent Login via HTTP...\n');

    const baseUrl = 'http://localhost:3002'; // Server is running on port 3002

    try {
        // Test 1: Agent Login with your credentials
        console.log('1. Testing Agent Login...');
        const loginData = {
            email: 'nyiranzabonimpajosiane@gmail.com',
            password: 'nyiranzabonimpajosiane@gmail.com'
        };

        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
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
            console.log('✅ Agent login successful!');
            console.log('Token received:', loginResult.token ? 'Yes' : 'No');
            console.log('Agent details:', loginResult.agent);
            
            // Test 2: Verify token works
            console.log('\n2. Testing token verification...');
            const profileResponse = await fetch(`${baseUrl}/api/agents/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${loginResult.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Profile Status:', profileResponse.status);
            if (profileResponse.status === 200) {
                console.log('✅ Token verification working');
            } else {
                console.log('❌ Token verification failed');
            }
        } else {
            console.log('❌ Agent login failed:', loginResult.error);
        }

        // Test 3: Test with wrong password
        console.log('\n3. Testing Invalid Login...');
        const invalidLoginData = {
            email: 'nyiranzabonimpajosiane@gmail.com',
            password: 'wrongpassword'
        };

        const invalidLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
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

        console.log('\n🎯 Your agent HTTP test completed!');

    } catch (error) {
        console.error('❌ Agent HTTP test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        process.exit(0);
    }
}

testYourAgentHTTP();