const mysql = require('mysql2/promise');

async function fixPromotionsData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    // Insert sample discount codes with proper null handling
    console.log('Inserting sample discount codes with proper null handling...');
    const sampleCodes = [
      {
        name: 'New Year 2025 Discount',
        type: 'discount_code',
        code: 'NEWYEAR2025',
        title: 'New Year 2025 - 30% Off',
        description: 'Start the year with savings! Get 30% off on all orders above RWF 100,000',
        discount_type: 'percentage',
        discount_value: null,
        discount_percentage: 30.00,
        min_order_amount: 100000.00,
        max_discount_amount: 50000.00,
        usage_limit: 1000,
        per_user_limit: 1,
        start_date: '2025-01-01 00:00:00',
        end_date: '2025-01-31 23:59:59',
        status: 'active'
      },
      {
        name: 'Free Shipping February',
        type: 'free_shipping',
        code: 'FREESHIP2025',
        title: 'Free Shipping All February',
        description: 'No delivery charges for the entire month of February on all orders',
        discount_type: 'fixed',
        discount_value: null,
        discount_percentage: null,
        min_order_amount: 20000.00,
        max_discount_amount: null,
        usage_limit: 2000,
        per_user_limit: 5,
        start_date: '2025-02-01 00:00:00',
        end_date: '2025-02-28 23:59:59',
        status: 'active'
      },
      {
        name: 'Electronics Flash Sale',
        type: 'flash_sale',
        code: 'ELECTRONICS50',
        title: 'Electronics Flash Sale - 50% Off',
        description: 'Limited time flash sale on all electronic items',
        discount_type: 'percentage',
        discount_value: null,
        discount_percentage: 50.00,
        min_order_amount: 50000.00,
        max_discount_amount: null,
        usage_limit: 100,
        per_user_limit: 1,
        start_date: '2025-02-15 10:00:00',
        end_date: '2025-02-17 23:59:59',
        status: 'active'
      }
    ];

    for (const code of sampleCodes) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO promotions 
           (name, type, code, title, description, discount_type, discount_value, discount_percentage, 
            min_order_amount, max_discount_amount, usage_limit, per_user_limit, start_date, end_date, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            code.name, 
            code.type, 
            code.code, 
            code.title, 
            code.description, 
            code.discount_type, 
            code.discount_value, 
            code.discount_percentage, 
            code.min_order_amount, 
            code.max_discount_amount,
            code.usage_limit, 
            code.per_user_limit, 
            code.start_date, 
            code.end_date, 
            code.status, 
            1
          ]
        );
        console.log(`✅ Added discount code: ${code.code}`);
      } catch (error) {
        console.log(`⚠️  Discount code ${code.code} already exists or error occurred:`, error.message);
      }
    }

    console.log('🎉 Discount codes setup completed successfully!');

  } catch (error) {
    console.error('❌ Error adding discount codes:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixPromotionsData()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });