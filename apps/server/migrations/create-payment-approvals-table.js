/**
 * Migration script to create payment_approvals table
 * This table stores payment proofs that need admin approval
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function createPaymentApprovalsTable() {
  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('Connected to database');

    // Check if table already exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_approvals'
    `, [process.env.DB_NAME || 'add_physical_product']);

    if (tables.length > 0) {
      console.log('payment_approvals table already exists');
      await connection.end();
      return;
    }

    // Create payment_approvals table
    await connection.execute(`
      CREATE TABLE payment_approvals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_proof VARCHAR(255),
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        processed_by INT,
        rejection_reason TEXT,
        admin_notes TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('payment_approvals table created successfully');

    // Note: We'll create the trigger separately due to prepared statement limitations
    console.log('Note: Trigger creation skipped in migration script. Please create it manually if needed.');

    // Note: We'll create the second trigger separately due to prepared statement limitations
    console.log('Note: Second trigger creation skipped in migration script. Please create it manually if needed.');

    // Close database connection
    await connection.end();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error creating payment_approvals table:', error);
    process.exit(1);
  }
}

// Run the migration
createPaymentApprovalsTable();