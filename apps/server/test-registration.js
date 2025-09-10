const axios = require('axios');
const FormData = require('form-data');

async function testRegistration() {
  console.log('🧪 Testing Agent Registration Endpoint...\n');

  try {
    const formData = new FormData();
    
    // Required fields
    formData.append('agent_type', 'fast_delivery');
    formData.append('first_name', 'Test');
    formData.append('last_name', 'Agent');
    formData.append('email', 'test.agent@example.com');
    formData.append('phone', '+250788123456');
    formData.append('password', 'testpassword123');
    
    // Additional fields
    formData.append('date_of_birth', '1990-01-01');
    formData.append('gender', 'male');
    formData.append('country', 'Rwanda');
    formData.append('province', 'Kigali City');
    formData.append('district', 'Gasabo');
    formData.append('sector', 'Kimihurura');
    formData.append('village', 'Test Village');
    formData.append('street_address', '123 Test Street');
    formData.append('city', 'Kigali');
    formData.append('latitude', '-1.9441');
    formData.append('longitude', '30.0619');
    formData.append('id_type', 'national_id');
    
    // Role-specific fields for fast_delivery
    formData.append('work_zone', 'Kigali City Center');
    formData.append('max_delivery_distance', '10km');
    formData.append('work_start_time', '08:00');
    formData.append('work_end_time', '18:00');

    console.log('📤 Sending registration request...');
    
    const response = await axios.post('http://localhost:3001/api/auth/agent-registration', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 10000
    });

    console.log('✅ Registration successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('❌ Registration failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testRegistration();