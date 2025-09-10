/**
 * End-to-End Test: Buyer completes local market order, FDA delivers, admin approves payouts
 * No mock data: relies on running server with test DB seeded appropriately.
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const API = BASE_URL + '/api';

// Helper to make authed requests
async function req(method, url, token, data, headers={}) {
  const cfg = {
    method,
    url: API + url,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    data
  };
  const res = await axios(cfg);
  return res.data;
}

async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function run() {
  console.log('🚀 E2E: Buyer -> Seller -> FDA -> Admin approvals flow');

  // 1) Login or use test tokens
  const buyerToken = process.env.BUYER_TOKEN;
  const agentToken = process.env.AGENT_TOKEN;
  const adminToken = process.env.ADMIN_TOKEN;
  if (!buyerToken || !agentToken || !adminToken) {
    throw new Error('Please set BUYER_TOKEN, AGENT_TOKEN, ADMIN_TOKEN env vars for real E2E run.');
  }

  // 2) Buyer places a local market order
  const orderPayload = {
    items: [
      { product_id: 1, product_name: 'Tomatoes', quantity: 2, price: 1500, seller_id: 2, seller_name: 'Joseph' },
      { product_id: 2, product_name: 'Onions', quantity: 1, price: 800, seller_id: 2, seller_name: 'Joseph' }
    ],
    delivery_info: { delivery_address: 'Kigali, Nyamirambo, House 42' },
    totals: { products_total: 3800, platform_fee: 200, packaging_fee: 0, delivery_fee: 500, grand_total: 4500 }
  };
  const placed = await req('POST', '/local-market-orders/orders', buyerToken, orderPayload);
  if (!placed.success) throw new Error('Order placement failed');
  const orderId = placed.order_id;
  console.log('🛒 Placed order:', orderId);

  // 3) Simulate payment proof submission and admin confirmation (if needed by your flow)
  await req('POST', `/local-market-orders/orders/${orderId}/payment-proof`, buyerToken, {
    payment_method: 'mobile_money', transaction_id: 'TX-' + Date.now(), payment_phone: '+250700000001', amount: 4500, proof_image: 'base64:image'
  });
  console.log('💳 Payment proof submitted');

  // 4) Seller prepares and sets ready_for_pickup
  await req('POST', `/local-market-orders/seller/orders/${orderId}/status`, adminToken, { status: 'preparing' });
  await req('POST', `/local-market-orders/seller/orders/${orderId}/status`, adminToken, { status: 'ready_for_pickup' });
  console.log('📦 Seller set ready_for_pickup');

  // 5) FDA agent accepts the order
  const accepted = await req('POST', `/fast-delivery-agent/accept-order/${orderId}`, agentToken, { orderType: 'local_market' });
  if (!accepted.success) throw new Error('Agent could not accept order');
  console.log('🏍️ Agent accepted order');

  // 6) Generate seller pickup code and verify handover
  const genPickup = await req('POST', `/fda-local-market/generate-seller-pickup-code/${orderId}`, agentToken);
  const pickupCode = genPickup.pickupCode;
  const verifyPickup = await req('POST', `/fda-local-market/verify-seller-pickup/${orderId}`, agentToken, {
    pickupCode,
    sellerConfirmation: 'Handover confirmed'
  });
  if (!verifyPickup.success) throw new Error('Seller handover verification failed');
  console.log('🤝 Seller handover verified; payout awaiting admin approval');

  // 7) Generate buyer delivery code and confirm delivery
  const genDelivery = await req('POST', `/fda-local-market/generate-buyer-delivery-code/${orderId}`, agentToken);
  const deliveryCode = genDelivery.deliveryCode;
  const confirmDelivery = await req('POST', `/fda-local-market/confirm-buyer-delivery/${orderId}`, agentToken, {
    deliveryCode,
    buyerConfirmation: 'Delivered successfully',
    buyerSignature: 'signed-by-buyer'
  });
  if (!confirmDelivery.success) throw new Error('Buyer delivery confirmation failed');
  console.log('🏁 Buyer delivery confirmed; payouts pending admin approval');

  // 8) Admin fetches pending approvals
  const pending = await req('GET', '/admin/pda-approvals/pending', adminToken);
  const payoutApproval = pending.approvals.find(a => a.order_id == orderId && a.approval_type === 'SELLER_PAYOUT');
  const fdaApproval = pending.approvals.find(a => a.order_id == orderId && a.approval_type === 'FDA_COMMISSION');
  if (!payoutApproval || !fdaApproval) throw new Error('Missing pending approvals');

  // 9) Admin approves both
  await req('POST', `/admin/pda-approvals/${payoutApproval.id}/approve`, adminToken, { reviewNotes: 'OK' });
  await req('POST', `/admin/pda-approvals/${fdaApproval.id}/approve`, adminToken, { reviewNotes: 'OK' });
  console.log('✅ Admin approved payouts');

  // 10) Verify order reflects released statuses
  const orderDetails = await req('GET', `/orders/${orderId}`, adminToken);
  const o = orderDetails.order || orderDetails.data || {};
  console.log('🔎 Order payout states:', {
    seller_payout_status: o.seller_payout_status,
    fda_commission_status: o.fda_commission_status,
    completed_at: o.completed_at
  });

  if (o.seller_payout_status !== 'released') throw new Error('Seller payout not released');
  if (o.fda_commission_status !== 'released' && o.pda_commission_released !== true) throw new Error('Agent commission not released');

  console.log('🎉 E2E flow passed: buyer purchased and received order, payouts released after approvals');
}

if (require.main === module) {
  run().catch(err => {
    console.error('E2E test failed:', err.message);
    process.exit(1);
  });
}