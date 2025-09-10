const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAdminFinal() {
    console.log('🔍 Final Admin API Test...\n');

    const baseUrl = 'http://localhost:3002'; // Note: Server is running on port 3002

    try {
        // Test 1: Admin Registration
        console.log('1. Testing Admin Registration...');
        const registrationData = {
            name: 'Admin Test User',
            email: 'adminfinal@example.com',
            password: 'testpassword123',
            role: 'admin',
            phone: '+1234567890'
        };

        const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });

        console.log('Registration Status:', registerResponse.status);
        const registerResult = await registerResponse.json();
        console.log('Registration Response:', registerResult);

        if (registerResponse.status === 200) {
            console.log('✅ Admin registration endpoint working');
        } else {
            console.log('❌ Admin registration failed:', registerResult.error);
        }

        // Test 2: Admin Login
        console.log('\n2. Testing Admin Login...');
        const loginData = {
            email: 'adminfinal@example.com',
            password: 'testpassword123'
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
            console.log('✅ Admin login endpoint working');
            console.log('Token received:', loginResult.token ? 'Yes' : 'No');
            
            // Test 3: Verify token works
            console.log('\n3. Testing token verification...');
            const profileResponse = await fetch(`${baseUrl}/api/auth/profile`, {
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
            console.log('❌ Admin login failed:', loginResult.error);
        }

        // Test 4: Test with invalid credentials
        console.log('\n4. Testing Invalid Login...');
        const invalidLoginData = {
            email: 'adminfinal@example.com',
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

        // Test 5: Test your specific admin credentials
        console.log('\n5. Testing Your Admin Credentials...');
        const yourLoginData = {
            email: 'nyiranzabonimpajosiane@gmail.com',
            password: 'nyiranzabonimpajosiane@gmail.com'
        };

        const yourLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(yourLoginData)
        });

        console.log('Your Login Status:', yourLoginResponse.status);
        const yourLoginResult = await yourLoginResponse.json();
        console.log('Your Login Response:', yourLoginResult);

        if (yourLoginResponse.status === 200) {
            console.log('✅ Your admin login working!');
            console.log('User role:', yourLoginResult.user.role);
            console.log('User name:', yourLoginResult.user.name);
        } else {
            console.log('❌ Your admin login failed:', yourLoginResult.error);
        }

        console.log('\n🎯 Final admin API test completed!');

    } catch (error) {
        console.error('❌ Final admin API test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        process.exit(0);
    }
}

testAdminFinal();