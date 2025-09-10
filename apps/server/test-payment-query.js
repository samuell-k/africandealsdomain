/**
 * Test Payment Query Directly
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testPaymentQuery() {
  try {
    console.log('🔍 Connecting to database...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    console.log('✅ Connected to database');
    
    // Test the exact query from admin-payments.js
    console.log('\n📋 Testing payment_proofs query:');
    const [paymentProofs] = await connection.execute(`
      SELECT 
        pp.id,
        pp.order_id,
        'MANUAL_PAYMENT' as approval_type,
        pp.status,
        pp.screenshot_path as payment_proof,
        pp.amount,
        pp.user_id as requested_by,
        pp.created_at,
        pp.updated_at,
        o.order_number,
        o.total_amount,
        o.delivery_method,
        o.payment_proof as o_payment_proof,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.username as requester_username,
        requester.email as requester_email,
        requester.phone as requester_phone,
        buyer.first_name as buyer_first_name,
        buyer.last_name as buyer_last_name,
        buyer.phone as buyer_phone,
        seller.first_name as seller_first_name,
        seller.last_name as seller_last_name,
        seller.phone as seller_phone
      FROM payment_proofs pp
      LEFT JOIN orders o ON pp.order_id = o.id
      LEFT JOIN users requester ON pp.user_id = requester.id
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      WHERE pp.status = 'pending'
      ORDER BY pp.created_at DESC
      LIMIT 10
    `);
    
    console.log(`✅ Found ${paymentProofs.length} payment proofs:`);
    
    paymentProofs.forEach((proof, index) => {
      console.log(`\n${index + 1}. Payment Proof ID: ${proof.id}`);
      console.log(`   Order: ${proof.order_number} (ID: ${proof.order_id})`);
      console.log(`   Requester: ${proof.requester_first_name} ${proof.requester_last_name} (${proof.requester_email})`);
      console.log(`   Status: ${proof.status}`);
      console.log(`   Amount: ${proof.amount || proof.total_amount}`);
      console.log(`   Screenshot: ${proof.payment_proof}`);
      console.log(`   Created: ${proof.created_at}`);
    });
    
    // Test the processing logic
    console.log('\n🔄 Testing processing logic:');
    const processedPayments = paymentProofs.map(payment => {
      const requesterName = `${payment.requester_first_name || ''} ${payment.requester_last_name || ''}`.trim() || 
                           payment.requester_username || 'Unknown';
      
      // Normalize payment proof URL
      let paymentProofUrl = null;
      const rawProof = payment.screenshot_path || payment.payment_proof || payment.o_payment_proof;
      if (rawProof) {
        if (rawProof.startsWith('http')) {
          paymentProofUrl = rawProof;
        } else if (rawProof.startsWith('/uploads')) {
          paymentProofUrl = rawProof;
        } else if (rawProof.includes('/')) {
          paymentProofUrl = rawProof;
        } else {
          paymentProofUrl = `/uploads/payment-proofs/${rawProof}`;
        }
      }
      
      return {
        id: payment.id,
        order_id: payment.order_id,
        order_number: payment.order_number,
        approval_type: payment.approval_type,
        status: payment.status,
        requester_name: requesterName,
        requester_email: payment.requester_email,
        amount: payment.amount || payment.total_amount || 0,
        payment_proof_url: paymentProofUrl,
        created_at: payment.created_at
      };
    });
    
    console.log('\n✅ Processed payments:');
    processedPayments.forEach((payment, index) => {
      console.log(`\n${index + 1}. Processed Payment:`);
      console.log(`   ID: ${payment.id}`);
      console.log(`   Order: ${payment.order_number} (${payment.order_id})`);
      console.log(`   Type: ${payment.approval_type}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Requester: ${payment.requester_name} (${payment.requester_email})`);
      console.log(`   Amount: ${payment.amount}`);
      console.log(`   Payment Proof URL: ${payment.payment_proof_url}`);
    });
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

testPaymentQuery();