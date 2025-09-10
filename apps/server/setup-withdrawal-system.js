/**
 * Withdrawal System Setup Script
 * Sets up the complete withdrawal system with sample data for testing
 */

const pool = require('./db');

async function setupWithdrawalSystem() {
  try {
    console.log('🚀 Setting up Complete Withdrawal System...\n');

    // 1. Create sample test users if they don't exist
    console.log('1️⃣ Setting up test users...');
    
    // Create a test buyer with referral earnings
    const [existingBuyer] = await pool.query(`
      SELECT id FROM users WHERE email = 'test.buyer@example.com'
    `);
    
    let buyerId;
    if (existingBuyer.length === 0) {
      const [buyerResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, phone, wallet_balance, created_at)
        VALUES ('Test Buyer', 'test.buyer@example.com', '$2b$10$hash', 'buyer', '+250788123456', 50000, NOW())
      `);
      buyerId = buyerResult.insertId;
      console.log('   ✅ Created test buyer with wallet balance: 50,000 RWF');
    } else {
      buyerId = existingBuyer[0].id;
      console.log('   ✅ Test buyer already exists');
    }

    // Create a test agent/referrer
    const [existingAgent] = await pool.query(`
      SELECT id FROM users WHERE email = 'test.agent@example.com'
    `);
    
    let agentId;
    if (existingAgent.length === 0) {
      const [agentResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, phone, created_at)
        VALUES ('Test Agent', 'test.agent@example.com', '$2b$10$hash', 'buyer', '+250788654321', NOW())
      `);
      agentId = agentResult.insertId;
      console.log('   ✅ Created test agent/referrer');
    } else {
      agentId = existingAgent[0].id;
      console.log('   ✅ Test agent already exists');
    }

    // 2. Create sample referral link
    console.log('\n2️⃣ Setting up referral system...');
    
    const [existingLink] = await pool.query(`
      SELECT id FROM referral_links WHERE user_id = ?
    `, [agentId]);
    
    let referralCode;
    if (existingLink.length === 0) {
      referralCode = `REF${agentId}${Date.now().toString().slice(-6)}`;
      await pool.query(`
        INSERT INTO referral_links (user_id, referral_code, status, generated_at, created_at)
        VALUES (?, ?, 'active', NOW(), NOW())
      `, [agentId, referralCode]);
      console.log(`   ✅ Created referral link: ${referralCode}`);
    } else {
      const [linkData] = await pool.query(`
        SELECT referral_code FROM referral_links WHERE id = ?
      `, [existingLink[0].id]);
      referralCode = linkData[0].referral_code;
      console.log(`   ✅ Using existing referral code: ${referralCode}`);
    }

    // 3. Create sample product for testing
    console.log('\n3️⃣ Setting up test product...');
    
    const [existingProduct] = await pool.query(`
      SELECT id FROM products WHERE name = 'Test Product for Referrals'
    `);
    
    let productId;
    if (existingProduct.length === 0) {
      const [productResult] = await pool.query(`
        INSERT INTO products (name, description, price, category_id, seller_id, status, created_at)
        VALUES ('Test Product for Referrals', 'A test product for referral system testing', 25000, 1, 1, 'active', NOW())
      `);
      productId = productResult.insertId;
      console.log('   ✅ Created test product: 25,000 RWF');
    } else {
      productId = existingProduct[0].id;
      console.log('   ✅ Test product already exists');
    }

    // 4. Create sample order with referral
    console.log('\n4️⃣ Creating sample referral order...');
    
    const orderNumber = `ORD${Date.now()}`;
    const [orderResult] = await pool.query(`
      INSERT INTO orders (
        order_number, user_id, total_amount, status, 
        referral_code, payment_status, created_at
      ) VALUES (?, ?, ?, 'pending', ?, 'pending', NOW())
    `, [orderNumber, buyerId, 25000, referralCode]);
    
    const orderId = orderResult.insertId;
    console.log(`   ✅ Created sample order: ${orderNumber} with referral code`);

    // Add order item
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, created_at)
      VALUES (?, ?, 1, 25000, 25000, NOW())
    `, [orderId, productId]);

    // 5. Simulate order payment approval and commission processing
    console.log('\n5️⃣ Processing referral commission...');
    
    // Update order to paid status
    await pool.query(`
      UPDATE orders 
      SET payment_status = 'approved', status = 'processing', updated_at = NOW()
      WHERE id = ?
    `, [orderId]);

    // Calculate and create referral commission
    const orderTotal = 25000;
    const platformMargin = orderTotal * 0.21; // 21% platform margin
    const referralCommission = platformMargin * 0.15; // 15% of platform margin

    // Record referral purchase
    const [referralLinkData] = await pool.query(`
      SELECT id FROM referral_links WHERE referral_code = ?
    `, [referralCode]);

    await pool.query(`
      INSERT INTO referral_purchases (
        referral_link_id, order_id, commission_amount, status, created_at
      ) VALUES (?, ?, ?, 'completed', NOW())
    `, [referralLinkData[0].id, orderId, referralCommission]);

    // Create agent earnings record
    await pool.query(`
      INSERT INTO agent_earnings (
        agent_id, order_id, earnings_type, amount, status, created_at
      ) VALUES (?, ?, 'referral', ?, 'paid', NOW())
    `, [agentId, orderId, referralCommission]);

    console.log(`   ✅ Referral commission processed: ${referralCommission.toLocaleString()} RWF`);

    // 6. Create sample withdrawal requests
    console.log('\n6️⃣ Creating sample withdrawal requests...');
    
    // Create referral withdrawal request
    await pool.query(`
      INSERT INTO referral_withdrawals (
        user_id, amount, payment_method, payment_details, notes, status, created_at
      ) VALUES (?, ?, 'mobile_money', ?, 'Test referral withdrawal', 'pending', NOW())
    `, [
      agentId, 
      Math.floor(referralCommission), 
      JSON.stringify({
        account_number: '+250788654321',
        account_name: 'Test Agent'
      })
    ]);

    // Create wallet withdrawal request
    await pool.query(`
      INSERT INTO wallet_withdrawals (
        user_id, amount, payment_method, payment_details, notes, status, created_at
      ) VALUES (?, ?, 'bank_transfer', ?, 'Test wallet withdrawal', 'pending', NOW())
    `, [
      buyerId, 
      15000, 
      JSON.stringify({
        account_number: '1234567890',
        account_name: 'Test Buyer',
        bank_name: 'Bank of Kigali'
      })
    ]);

    console.log('   ✅ Created sample referral withdrawal request');
    console.log('   ✅ Created sample wallet withdrawal request');

    // 7. Display system status
    console.log('\n7️⃣ System Status Summary...');
    
    // Get current balances
    const [agentBalance] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN ae.status = 'paid' THEN ae.amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN rw.status = 'completed' THEN rw.amount ELSE 0 END), 0) as total_withdrawn
      FROM agent_earnings ae
      LEFT JOIN referral_withdrawals rw ON ae.agent_id = rw.user_id
      WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
    `, [agentId]);

    const [buyerWallet] = await pool.query(`
      SELECT wallet_balance FROM users WHERE id = ?
    `, [buyerId]);

    const availableReferralBalance = agentBalance[0].total_earned - agentBalance[0].total_withdrawn;

    console.log(`   📊 Agent Referral Balance: ${availableReferralBalance.toLocaleString()} RWF`);
    console.log(`   📊 Buyer Wallet Balance: ${buyerWallet[0].wallet_balance.toLocaleString()} RWF`);

    // Get pending withdrawals count
    const [pendingWithdrawals] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM referral_withdrawals WHERE status = 'pending') as referral_pending,
        (SELECT COUNT(*) FROM wallet_withdrawals WHERE status = 'pending') as wallet_pending
    `);

    console.log(`   📊 Pending Referral Withdrawals: ${pendingWithdrawals[0].referral_pending}`);
    console.log(`   📊 Pending Wallet Withdrawals: ${pendingWithdrawals[0].wallet_pending}`);

    // 8. Display access URLs
    console.log('\n8️⃣ Access URLs for Testing...');
    console.log('   🌐 User Referral Dashboard: /buyer/referrals.html');
    console.log('   🌐 User Wallet Dashboard: /buyer/wallet.html');
    console.log('   🌐 Admin Referral Management: /admin/referral-payments.html');
    console.log('   🌐 Admin Withdrawal Management: /admin/withdrawal-management.html');

    // 9. API Testing Commands
    console.log('\n9️⃣ API Testing Commands...');
    console.log('   Test referral balance: GET /api/referrals/withdrawal-balance');
    console.log('   Test withdrawal request: POST /api/referrals/request-withdrawal');
    console.log('   Test admin pending: GET /api/referrals/admin/pending-payments');
    console.log('   Test admin process: POST /api/referrals/admin/process-payment');

    console.log('\n🎉 WITHDRAWAL SYSTEM SETUP COMPLETE!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Login as admin to test withdrawal approval');
    console.log('   3. Login as test users to test withdrawal requests');
    console.log('   4. Test the complete referral flow');

    console.log('\n🔐 Test Credentials:');
    console.log('   Test Buyer: test.buyer@example.com');
    console.log('   Test Agent: test.agent@example.com');
    console.log(`   Referral Code: ${referralCode}`);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupWithdrawalSystem()
    .then(() => {
      console.log('\n✅ Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupWithdrawalSystem;