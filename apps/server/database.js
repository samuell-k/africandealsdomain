/**
 * Database connection module
 * Provides a MySQL connection pool for the application
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to execute queries
async function query(sql, params) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connection established');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

module.exports = {
  pool,
  query,
  execute: pool.execute.bind(pool)
};