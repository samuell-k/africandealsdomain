const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST||'localhost',
  user: process.env.DB_USER||'root',
  password: process.env.DB_PASSWORD||'',
  database: process.env.DB_NAME||'add_physical_product',
  port: process.env.DB_PORT|| 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Only use options that are 100% compatible with MySQL2
  idleTimeout: 600000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});   

// Add error handling for the pool
pool.on('connection', function (connection) {
  console.log('✅ Database connected as id ' + connection.threadId);
});

pool.on('error', function(err) {
  console.error('❌ Database pool error:', err.code);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Database connection lost, reconnecting...');
  } else {
    throw err;
  }
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database pool initialized successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Failed to initialize database pool:', err.message);
  });
          
module.exports = pool; 