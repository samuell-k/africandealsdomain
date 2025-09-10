const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'adminafricandealsdomainpassword';

// Generate tokens for testing
const buyerToken = jwt.sign(
  { id: 3, role: 'buyer', email: 'mugishasimplice4@gmail.com' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

const agentToken = jwt.sign(
  { id: 10, role: 'agent', email: 'testauth@example.com' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('=== TEST TOKENS ===');
console.log('\nBuyer Token (user_id: 3):');
console.log(buyerToken);
console.log('\nAgent Token (user_id: 10):');
console.log(agentToken);

console.log('\n=== COPY THESE TO test-auth.html ===');
console.log(`Buyer: '${buyerToken}'`);
console.log(`Agent: '${agentToken}'`);