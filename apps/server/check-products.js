const pool = require('./db');

async function checkProducts() {
  try {
    // Check product-related tables
    const [tables] = await pool.query('SHOW TABLES LIKE "%product%"');
    console.log('📋 Product-related tables:');
    tables.forEach(row => console.log(`  - ${Object.values(row)[0]}`));
    
    // Check if products table exists and has data
    try {
      const [products] = await pool.query('SELECT COUNT(*) as count FROM products');
      console.log(`\n📦 Products table has ${products[0].count} records`);
      
      if (products[0].count > 0) {
        const [sampleProducts] = await pool.query('SELECT id, name, seller_id FROM products LIMIT 5');
        console.log('\n📋 Sample products:');
        sampleProducts.forEach(p => console.log(`  - ID: ${p.id}, Name: ${p.name}, Seller: ${p.seller_id}`));
      }
    } catch (err) {
      console.log('❌ Products table does not exist or is empty');
    }
    
    // Check categories
    try {
      const [categories] = await pool.query('SELECT COUNT(*) as count FROM categories');
      console.log(`\n📂 Categories table has ${categories[0].count} records`);
    } catch (err) {
      console.log('❌ Categories table does not exist');
    }
    
    // Check users with seller role
    const [sellers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = "seller"');
    console.log(`\n👥 Sellers: ${sellers[0].count} records`);
    
    // Check grocery_order_items table structure
    try {
      const [orderItemsColumns] = await pool.query('DESCRIBE grocery_order_items');
      console.log('\n📋 grocery_order_items columns:');
      orderItemsColumns.forEach(row => console.log(`  - ${row.Field} (${row.Type})`));
    } catch (err) {
      console.log('❌ grocery_order_items table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkProducts();