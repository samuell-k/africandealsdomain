const mysql = require('mysql2/promise');

async function restorePromotionsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    // Restore the original promotions table for discount codes
    console.log('Restoring original promotions table for discount codes...');
    const promotionsSQL = `
      CREATE TABLE IF NOT EXISTS promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type ENUM('discount_code','flash_sale','bundle','free_shipping') NOT NULL,
        code VARCHAR(50) UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(8,2),
        discount_percentage DECIMAL(5,2),
        min_order_amount DECIMAL(10,2) DEFAULT 0.00,
        max_discount_amount DECIMAL(8,2),
        usage_limit INT,
        per_user_limit INT DEFAULT 1,
        usage_count INT DEFAULT 0,
        applicable_products LONGTEXT,
        start_date DATETIME,
        end_date DATETIME,
        status ENUM('active', 'inactive', 'expired') DEFAULT 'active',
        is_active TINYINT(1) DEFAULT 1,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_start_date (start_date),
        INDEX idx_active (is_active),
        INDEX idx_status (status),
        INDEX idx_code (code),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
      )
    `;

    await connection.execute(promotionsSQL);
    console.log('✅ Promotions table restored successfully');

    // Insert sample discount codes
    console.log('Inserting sample discount codes...');
    const sampleCodes = [
      {
        name: 'New Year 2025 Discount',
        type: 'discount_code',
        code: 'NEWYEAR2025',
        title: 'New Year 2025 - 30% Off',
        description: 'Start the year with savings! Get 30% off on all orders above RWF 100,000',
        discount_type: 'percentage',
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
        discount_value: 0.00,
        min_order_amount: 20000.00,
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
        discount_percentage: 50.00,
        min_order_amount: 50000.00,
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
          [code.name, code.type, code.code, code.title, code.description, code.discount_type, 
           code.discount_value, code.discount_percentage, code.min_order_amount, code.max_discount_amount,
           code.usage_limit, code.per_user_limit, code.start_date, code.end_date, code.status, 1]
        );
        console.log(`✅ Added discount code: ${code.code}`);
      } catch (error) {
        console.log(`⚠️  Discount code ${code.code} already exists or error occurred:`, error.message);
      }
    }

    console.log('🎉 Promotions table and discount codes setup completed successfully!');

  } catch (error) {
    console.error('❌ Error restoring promotions table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

restorePromotionsTable()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });