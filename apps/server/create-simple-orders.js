/**
 * Create Simple Grocery Orders for Fast Delivery Agent Testing
 */

const pool = require('./db');

async function createSimpleOrders() {
  try {
    console.log('🚀 Creating simple grocery orders for testing...');

    // Get existing users
    const [buyers] = await pool.query('SELECT id, username FROM users WHERE role = "buyer" LIMIT 3');
    const [sellers] = await pool.query('SELECT id, username FROM users WHERE role = "seller" LIMIT 2');
    
    if (buyers.length === 0 || sellers.length === 0) {
      console.log('❌ Need at least 1 buyer and 1 seller. Please create users first.');
      return;
    }

    console.log(`✅ Found ${buyers.length} buyers and ${sellers.length} sellers`);

    // Create 5 simple grocery orders
    for (let i = 0; i < 5; i++) {
      const buyer = buyers[i % buyers.length];
      const seller = sellers[i % sellers.length];
      
      const orderNumber = `LM${Date.now()}${i}`;
      const totalAmount = (Math.random() * 50 + 10).toFixed(2); // $10-60
      
      const deliveryAddresses = [
        { address: 'Kigali City Center, Rwanda', lat: -1.9441, lng: 30.0619 },
        { address: 'Kimisagara, Kigali, Rwanda', lat: -1.9706, lng: 30.0588 },
        { address: 'Gisozi, Kigali, Rwanda', lat: -1.9167, lng: 30.0833 },
        { address: 'Remera, Kigali, Rwanda', lat: -1.9333, lng: 30.1167 }
      ];

      const pickupAddresses = [
        { address: 'Kimironko Market, Kigali', lat: -1.9506, lng: 30.0588 },
        { address: 'Nyabugogo Market, Kigali', lat: -1.9667, lng: 30.0333 }
      ];

      const deliveryAddr = deliveryAddresses[i % deliveryAddresses.length];
      const pickupAddr = pickupAddresses[i % pickupAddresses.length];

      // Create the order
      const [orderResult] = await pool.query(`
        INSERT INTO grocery_orders (
          order_number, buyer_id, seller_id, total_amount, status,
          delivery_address, delivery_lat, delivery_lng,
          pickup_address, pickup_lat, pickup_lng,
          payment_method, buyer_notes, created_at
        ) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, 'manual', ?, NOW())
      `, [
        orderNumber,
        buyer.id,
        seller.id,
        totalAmount,
        deliveryAddr.address,
        deliveryAddr.lat,
        deliveryAddr.lng,
        pickupAddr.address,
        pickupAddr.lat,
        pickupAddr.lng,
        `Test grocery order ${i + 1} - Fresh produce delivery`
      ]);

      console.log(`✅ Created order ${orderNumber} - $${totalAmount} (Buyer: ${buyer.username}, Seller: ${seller.username})`);
    }

    console.log('\n🎉 SIMPLE ORDERS CREATED SUCCESSFULLY!');
    console.log('✅ 5 grocery orders ready for fast delivery agents');
    console.log('\n📱 You can now test the Fast Delivery Agent system!');
    console.log('\n🔑 Test with existing user credentials');
    console.log('\n🌐 Access the agent dashboard and check for available orders');

  } catch (error) {
    console.error('❌ Error creating simple orders:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the script
createSimpleOrders();