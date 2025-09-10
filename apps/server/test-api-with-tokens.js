const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

async function testAPIWithTokens() {
  let connection;
  
  try {
    // Database configuration
    const dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    };

    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');

    // Get test users
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 1');
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 1');
    
    if (buyers.length === 0 || sellers.length === 0) {
      console.log('❌ No test users found');
      return;
    }

    const buyerId = buyers[0].id;
    const sellerId = sellers[0].id;

    console.log(`👤 Buyer: ${buyers[0].name} (ID: ${buyerId})`);
    console.log(`👤 Seller: ${sellers[0].name} (ID: ${sellerId})`);

    // Generate real tokens using the same secret as the server
    const JWT_SECRET = process.env.JWT_SECRET || 'adminafricandealsdomainpassword';
    const buyerToken = jwt.sign({ id: buyerId, role: 'buyer' }, JWT_SECRET, { expiresIn: '1h' });
    const sellerToken = jwt.sign({ id: sellerId, role: 'seller' }, JWT_SECRET, { expiresIn: '1h' });
    
    console.log('\n🔑 Generated Tokens:');
    console.log('Buyer Token:', buyerToken);
    console.log('Seller Token:', sellerToken);

    // Test buyer messages API
    console.log('\n📋 Testing Buyer Messages API...');
    try {
      const buyerResponse = await fetch('http://localhost:3001/api/messages', {
        headers: {
          'Authorization': `Bearer ${buyerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (buyerResponse.ok) {
        const buyerData = await buyerResponse.json();
        console.log(`✅ Buyer API Success: ${buyerData.messages?.length || 0} messages`);
        if (buyerData.messages && buyerData.messages.length > 0) {
          console.log('📧 Sample messages:');
          buyerData.messages.slice(0, 3).forEach(msg => {
            console.log(`   - "${msg.subject}" from ${msg.sender_name || 'Unknown'}`);
          });
        }
      } else {
        const errorData = await buyerResponse.json();
        console.log(`❌ Buyer API Failed: ${errorData.error || buyerResponse.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Buyer API Error: ${error.message}`);
    }

    // Test seller messages API
    console.log('\n📋 Testing Seller Messages API...');
    try {
      const sellerResponse = await fetch('http://localhost:3001/api/seller/messages', {
        headers: {
          'Authorization': `Bearer ${sellerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (sellerResponse.ok) {
        const sellerData = await sellerResponse.json();
        console.log(`✅ Seller API Success: ${sellerData.messages?.length || 0} messages`);
        if (sellerData.messages && sellerData.messages.length > 0) {
          console.log('📧 Sample messages:');
          sellerData.messages.slice(0, 3).forEach(msg => {
            console.log(`   - "${msg.subject}" from ${msg.sender_name || 'Unknown'}`);
          });
        }
      } else {
        const errorData = await sellerResponse.json();
        console.log(`❌ Seller API Failed: ${errorData.error || sellerResponse.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Seller API Error: ${error.message}`);
    }

    // Test sending a message
    console.log('\n📋 Testing Message Sending...');
    try {
      const messageData = {
        recipient_id: buyerId,
        subject: 'API Test Message',
        content: 'This is a test message sent via API with real token.',
        order_id: null
      };

      const sendResponse = await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sellerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (sendResponse.ok) {
        const sendData = await sendResponse.json();
        console.log(`✅ Message sent successfully! Message ID: ${sendData.message_id}`);
      } else {
        const errorData = await sendResponse.json();
        console.log(`❌ Failed to send message: ${errorData.error || sendResponse.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Error sending message: ${error.message}`);
    }

    console.log('\n🎉 API Testing Complete!');
    console.log('\n💡 You can now use these tokens in your browser:');
    console.log('1. Open browser console');
    console.log('2. Set localStorage.setItem("authToken", "BUYER_TOKEN_HERE")');
    console.log('3. Test the messaging system in the browser');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('⚠️  Fetch not available, install node-fetch or use Node.js 18+');
  process.exit(1);
}

testAPIWithTokens(); 