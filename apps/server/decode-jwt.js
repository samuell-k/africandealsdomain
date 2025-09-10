const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTI0LCJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiU2ltcGxlIEFkbWluIiwiaWF0IjoxNzU0ODQ5MzA5LCJleHAiOjE3NTU0NTQxMDl9.W0NVL05vpZ8Tm3pdSKi_JGWzp0QHYA6hsQzUiD5gcto';

try {
    const decoded = jwt.verify(token, 'adminafricandealsdomainpassword');
    console.log('Decoded token with correct secret:', decoded);
} catch (error) {
    console.error('Token verification with correct secret failed:', error.message);
}

try {
    const decoded = jwt.verify(token, 'your-super-secret-jwt-key-change-this-in-production');
    console.log('Decoded token with fallback secret:', decoded);
} catch (error) {
    console.error('Token verification with fallback secret failed:', error.message);
}

// Also try decoding without verification to see the payload
const payload = jwt.decode(token);
console.log('Token payload (unverified):', payload);