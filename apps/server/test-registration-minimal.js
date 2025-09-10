const axios = require('axios');

async function testMinimalRegistration() {
  console.log('🧪 Testing Minimal Agent Registration...\n');

  const testData = {
    agent_type: 'fast_delivery',
    first_name: 'Test',
    last_name: 'Agent',
    email: `test.minimal.${Date.now()}@example.com`,
    phone: '+250788123456',
    password: 'testpassword123',
    date_of_birth: '1990-01-01',
    gender: 'male',
    country: 'Rwanda',
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Kimihurura',
    village: 'Test Village',
    street_address: '123 Test Street',
    city: 'Kigali',
    latitude: '-1.9441',
    longitude: '30.0619',
    id_type: 'national_id',
    work_zone: 'Kigali City Center',
    max_delivery_distance: '10km',
    work_start_time: '08:00',
    work_end_time: '18:00'
  };

  console.log('📝 Sending minimal test data:', Object.keys(testData));

  try {
    const response = await axios.post('http://localhost:3001/api/agent-registration/register', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Registration successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.log('❌ Registration failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testMinimalRegistration();