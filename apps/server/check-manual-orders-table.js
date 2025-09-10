const mysql = require('mysql2/promise');

async function checkManualOrdersTable() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('🔍 Checking manual_orders table structure...');
    const [rows] = await pool.query('DESCRIBE manual_orders');
    
    console.log('\n📋 Manual orders table columns:');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Null === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    console.log('\n🔍 Sample order data:');
    const [orders] = await pool.query('SELECT * FROM manual_orders ORDER BY created_at DESC LIMIT 1');
    if (orders.length > 0) {
      const order = orders[0];
      console.log('\n  Latest order:');
      console.log(`    ID: ${order.id}`);
      console.log(`    Order Number: ${order.order_number}`);
      console.log(`    Items JSON: ${order.items_json}`);
      console.log(`    Buyer: ${order.buyer_name}`);
      console.log(`    Total: $${order.total_amount}`);
      
      if (order.items_json) {
        try {
          const items = JSON.parse(order.items_json);
          console.log(`    Parsed Items (${items.length}):`);
          items.forEach((item, index) => {
            console.log(`      ${index + 1}. ${item.name} x${item.quantity} @ $${item.price}`);
          });
        } catch (e) {
          console.log('    Could not parse items JSON');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkManualOrdersTable();