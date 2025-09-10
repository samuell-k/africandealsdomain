/**
 * Check Payment Proofs in Database
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPaymentProofs() {
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
    
    // Check payment_proofs table
    console.log('\n📋 Checking payment_proofs table:');
    try {
      const [paymentProofs] = await connection.execute(`
        SELECT 
          pp.id, pp.order_id, pp.user_id, pp.payment_method, pp.status, 
          pp.screenshot_path, pp.created_at,
          o.order_number, o.total_amount,
          u.email as user_email
        FROM payment_proofs pp
        LEFT JOIN orders o ON pp.order_id = o.id
        LEFT JOIN users u ON pp.user_id = u.id
        ORDER BY pp.created_at DESC
        LIMIT 10
      `);
      
      if (paymentProofs.length === 0) {
        console.log('❌ No payment proofs found in payment_proofs table');
      } else {
        console.log(`✅ Found ${paymentProofs.length} payment proofs:`);
        paymentProofs.forEach((proof, index) => {
          console.log(`${index + 1}. ID: ${proof.id}`);
          console.log(`   Order: ${proof.order_number} (ID: ${proof.order_id})`);
          console.log(`   User: ${proof.user_email} (ID: ${proof.user_id})`);
          console.log(`   Method: ${proof.payment_method}`);
          console.log(`   Status: ${proof.status}`);
          console.log(`   Screenshot: ${proof.screenshot_path}`);
          console.log(`   Amount: ${proof.total_amount}`);
          console.log(`   Created: ${proof.created_at}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log('❌ payment_proofs table error:', error.message);
    }
    
    // Check admin_approvals table
    console.log('\n📋 Checking admin_approvals table for MANUAL_PAYMENT:');
    try {
      const [adminApprovals] = await connection.execute(`
        SELECT 
          aa.id, aa.order_id, aa.approval_type, aa.status, aa.payment_proof, 
          aa.amount, aa.requested_by, aa.created_at,
          o.order_number, o.total_amount,
          u.email as user_email
        FROM admin_approvals aa
        LEFT JOIN orders o ON aa.order_id = o.id
        LEFT JOIN users u ON aa.requested_by = u.id
        WHERE aa.approval_type = 'MANUAL_PAYMENT'
        ORDER BY aa.created_at DESC
        LIMIT 10
      `);
      
      if (adminApprovals.length === 0) {
        console.log('❌ No MANUAL_PAYMENT approvals found in admin_approvals table');
      } else {
        console.log(`✅ Found ${adminApprovals.length} MANUAL_PAYMENT approvals:`);
        adminApprovals.forEach((approval, index) => {
          console.log(`${index + 1}. ID: ${approval.id}`);
          console.log(`   Order: ${approval.order_number} (ID: ${approval.order_id})`);
          console.log(`   User: ${approval.user_email} (ID: ${approval.requested_by})`);
          console.log(`   Type: ${approval.approval_type}`);
          console.log(`   Status: ${approval.status}`);
          console.log(`   Payment Proof: ${approval.payment_proof}`);
          console.log(`   Amount: ${approval.amount || approval.total_amount}`);
          console.log(`   Created: ${approval.created_at}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log('❌ admin_approvals table error:', error.message);
    }
    
    // Check orders with payment_submitted status
    console.log('\n📋 Checking orders with payment_submitted status:');
    try {
      const [orders] = await connection.execute(`
        SELECT 
          o.id, o.order_number, o.user_id, o.status, o.payment_status, 
          o.payment_proof, o.total_amount, o.created_at,
          u.email as user_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.status = 'payment_submitted' OR o.payment_status = 'submitted'
        ORDER BY o.created_at DESC
        LIMIT 10
      `);
      
      if (orders.length === 0) {
        console.log('❌ No orders with payment_submitted status found');
      } else {
        console.log(`✅ Found ${orders.length} orders with payment submitted:`);
        orders.forEach((order, index) => {
          console.log(`${index + 1}. Order: ${order.order_number} (ID: ${order.id})`);
          console.log(`   User: ${order.user_email} (ID: ${order.user_id})`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Payment Status: ${order.payment_status}`);
          console.log(`   Payment Proof: ${order.payment_proof}`);
          console.log(`   Amount: ${order.total_amount}`);
          console.log(`   Created: ${order.created_at}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log('❌ orders table error:', error.message);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkPaymentProofs();