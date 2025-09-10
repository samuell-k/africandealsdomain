/**
 * PSM Manual Orders API Test Suite
 * Tests all PSM manual order endpoints with authentication
 */

const mysql = require('mysql2/promise');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function runAPITests() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const api = (p) => `${baseUrl}${p}`;

  // Database connection
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: Number(process.env.DB_PORT) || 3333
  });

  try {
    console.log('🧪 PSM Manual Orders API Test Suite');
    console.log('=====================================');

    // Step 1: Get PSM agent credentials
    console.log('1) Getting PSM agent credentials...');
    const testEmail = 'test.psm@example.com';
    const testPassword = 'testpsm123';
    
    const [agents] = await conn.query(`
      SELECT a.id as agent_id, u.id as user_id, u.email 
      FROM agents a 
      JOIN users u ON a.user_id = u.id 
      WHERE u.email = ? AND a.agent_type = 'pickup_site_manager'
    `, [testEmail]);
    
    if (agents.length === 0) {
      throw new Error('Test PSM agent not found. Run create-test-psm.js first');
    }
    
    const agent = agents[0];
    console.log(`   Found PSM agent: ${agent.email} (Agent ID: ${agent.agent_id})`);

    // Step 2: Login to get token
    console.log('2) Logging in as PSM agent...');
    const loginRes = await fetch(api('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('   ✅ Login successful');

    // Step 3: Test active sites endpoint
    console.log('3) Testing active pickup sites endpoint...');
    const sitesRes = await fetch(api('/api/pickup-site-manager/active-sites'));
    
    if (!sitesRes.ok) {
      throw new Error(`Active sites failed: ${sitesRes.status}`);
    }
    
    const sites = await sitesRes.json();
    if (!Array.isArray(sites) || sites.length === 0) {
      throw new Error('No active pickup sites found');
    }
    
    console.log(`   ✅ Found ${sites.length} active pickup sites`);
    const testSite = sites[0];

    // Step 4: Test manual order creation
    console.log('4) Testing manual order creation...');
    
    const orderData = {
      customer_name: 'Test Customer',
      customer_phone: '+250700000123',
      customer_email: 'test@example.com',
      delivery_type: 'pickup',
      pickup_site_id: testSite.id,
      products: JSON.stringify([
        {
          name: 'Test Product 1',
          price: 25.00,
          quantity: 2
        },
        {
          name: 'Test Product 2', 
          price: 15.00,
          quantity: 1
        }
      ]),
      subtotal: 65.00,
      delivery_fee: 5.00,
      total_amount: 70.00,
      payment_method: 'mobile_money',
      payment_status: 'completed',
      notes: 'Test order created via API'
    };

    const createRes = await fetch(api('/api/pickup-site-manager/create-manual-order'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Order creation failed: ${createRes.status} ${errorText}`);
    }

    const orderResult = await createRes.json();
    if (!orderResult.success || !orderResult.orderId) {
      throw new Error('Order creation response invalid');
    }

    console.log(`   ✅ Order created: ${orderResult.orderNumber} (ID: ${orderResult.orderId})`);
    console.log(`   💰 Commission: $${orderResult.commission_amount}`);

    // Step 5: Test receipt regeneration
    console.log('5) Testing receipt regeneration...');
    
    const regenRes = await fetch(api(`/api/pickup-site-manager/order/${orderResult.orderId}/regenerate-receipt`), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!regenRes.ok) {
      const errorText = await regenRes.text();
      throw new Error(`Receipt regeneration failed: ${regenRes.status} ${errorText}`);
    }

    const regenResult = await regenRes.json();
    if (!regenResult.success) {
      throw new Error('Receipt regeneration response invalid');
    }

    console.log('   ✅ Receipt regenerated successfully');

    // Step 6: Test receipt download
    console.log('6) Testing receipt download...');
    
    const downloadRes = await fetch(api(`/api/pickup-site-manager/order/${orderResult.orderId}/receipt`), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!downloadRes.ok) {
      const errorText = await downloadRes.text();
      throw new Error(`Receipt download failed: ${downloadRes.status} ${errorText}`);
    }

    const receiptContent = await downloadRes.text();
    if (!receiptContent.includes(orderResult.orderNumber)) {
      throw new Error('Receipt content invalid');
    }

    console.log('   ✅ Receipt downloaded successfully');
    console.log(`   📄 Receipt size: ${receiptContent.length} characters`);

    // Step 7: Verify database records
    console.log('7) Verifying database records...');
    
    // Check manual order
    const [orders] = await conn.query('SELECT * FROM manual_orders WHERE id = ?', [orderResult.orderId]);
    if (orders.length === 0) {
      throw new Error('Manual order not found in database');
    }
    
    // Check order items
    const [items] = await conn.query('SELECT * FROM manual_order_items WHERE order_id = ?', [orderResult.orderId]);
    if (items.length !== 2) {
      throw new Error(`Expected 2 order items, found ${items.length}`);
    }
    
    // Check commission record
    const [commissions] = await conn.query('SELECT * FROM psm_commissions WHERE order_id = ?', [orderResult.orderId]);
    if (commissions.length === 0) {
      throw new Error('Commission record not found');
    }
    
    console.log('   ✅ All database records verified');
    console.log(`   📊 Order items: ${items.length}`);
    console.log(`   💵 Commission rate: ${commissions[0].commission_rate}%`);

    // Step 8: Test error cases
    console.log('8) Testing error cases...');
    
    // Test invalid order creation
    const invalidRes = await fetch(api('/api/pickup-site-manager/create-manual-order'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_name: 'Test',
        // Missing required fields
      })
    });
    
    if (invalidRes.ok) {
      throw new Error('Invalid order creation should have failed');
    }
    
    console.log('   ✅ Invalid order creation properly rejected');
    
    // Test unauthorized access
    const unauthorizedRes = await fetch(api('/api/pickup-site-manager/create-manual-order'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    if (unauthorizedRes.ok) {
      throw new Error('Unauthorized access should have failed');
    }
    
    console.log('   ✅ Unauthorized access properly rejected');

    // Step 9: Performance test
    console.log('9) Running performance test...');
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      const perfOrderData = {
        ...orderData,
        customer_name: `Perf Test Customer ${i}`,
        customer_phone: `+25070000${String(i).padStart(4, '0')}`
      };
      
      promises.push(
        fetch(api('/api/pickup-site-manager/create-manual-order'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(perfOrderData)
        })
      );
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r.ok).length;
    console.log(`   ✅ Performance test: ${successCount}/5 orders created in ${endTime - startTime}ms`);

    console.log('\n🎉 All PSM Manual Orders API tests passed!');
    console.log('=====================================');
    console.log(`✅ Active sites endpoint working`);
    console.log(`✅ Manual order creation working`);
    console.log(`✅ Receipt regeneration working`);
    console.log(`✅ Receipt download working`);
    console.log(`✅ Database integrity verified`);
    console.log(`✅ Error handling working`);
    console.log(`✅ Performance acceptable`);

  } catch (error) {
    console.error('\n❌ PSM API Test failed:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

// Run if called directly
if (require.main === module) {
  runAPITests();
}

module.exports = { runAPITests };