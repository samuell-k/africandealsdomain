const pool = require('./db');

async function checkGroceryProducts() {
  try {
    console.log('Checking test sellers...');
    const [sellers] = await pool.query('SELECT id, username, email FROM users WHERE role = "seller" AND is_test = 1');
    console.log('Test sellers:', sellers);
    
    console.log('\nChecking grocery products...');
    const [count] = await pool.query('SELECT COUNT(*) as count FROM grocery_products');
    console.log('Grocery products count:', count[0].count);
    
    if (count[0].count > 0) {
      const [products] = await pool.query(`
        SELECT gp.*, p.seller_id, p.name 
        FROM grocery_products gp 
        LEFT JOIN products p ON gp.product_id = p.id 
        LIMIT 5
      `);
      console.log('Sample grocery products with sellers:', products.map(p => ({
        grocery_id: p.id,
        product_id: p.product_id,
        name: p.name,
        seller_id: p.seller_id,
        unit_price: p.unit_price
      })));
    } else {
      console.log('No grocery products found. Need to create some first.');
    }
    
    // Check if we need to create grocery products from regular products
    const [regularProducts] = await pool.query('SELECT COUNT(*) as count FROM products WHERE marketplace_type = "local_grocery"');
    console.log('Regular products marked as local_grocery:', regularProducts[0].count);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkGroceryProducts();