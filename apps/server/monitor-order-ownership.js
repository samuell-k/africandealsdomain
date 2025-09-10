const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

class OrderOwnershipMonitor {
  constructor() {
    this.pool = null;
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.isRunning = false;
  }

  async connect() {
    try {
      this.pool = await mysql.createPool(dbConfig);
      console.log('✅ Database connected for order ownership monitoring');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async checkForProblematicOrders() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          o.created_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE u.role != 'buyer'
      `);

      if (rows.length > 0) {
        console.log('🚨 ALERT: Found orders assigned to non-buyers!');
        console.log('Problematic orders:', rows);
        
        // Log to system_logs table
        for (const order of rows) {
          await this.pool.execute(`
            INSERT INTO system_logs (message, created_at) 
            VALUES (?, NOW())
          `, [`CRITICAL: Order ${order.order_id} (${order.order_number}) assigned to ${order.user_email} (role: ${order.user_role})`]);
        }

        return {
          hasIssues: true,
          count: rows.length,
          orders: rows
        };
      } else {
        console.log('✅ No problematic orders found');
        return {
          hasIssues: false,
          count: 0,
          orders: []
        };
      }
    } catch (error) {
      console.error('❌ Error checking for problematic orders:', error.message);
      throw error;
    }
  }

  async verifyOrderCreation(buyerId, orderId) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT 
          o.id,
          o.user_id,
          u.name,
          u.email,
          u.role
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [orderId]);

      if (rows.length === 0) {
        console.error(`🚨 Order ${orderId} not found!`);
        return false;
      }

      const order = rows[0];
      
      if (order.user_id !== buyerId) {
        console.error(`🚨 CRITICAL: Order ${orderId} assigned to wrong user!`);
        console.error(`Expected buyer: ${buyerId}, Actual user: ${order.user_id} (${order.email})`);
        return false;
      }

      if (order.role !== 'buyer') {
        console.error(`🚨 CRITICAL: Order ${orderId} assigned to non-buyer!`);
        console.error(`User ${order.email} has role: ${order.role}`);
        return false;
      }

      console.log(`✅ Order ${orderId} correctly assigned to buyer ${order.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error verifying order creation:', error.message);
      return false;
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log('⚠️ Monitoring is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting order ownership monitoring...');

    // Initial check
    await this.checkForProblematicOrders();

    // Set up periodic monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        await this.checkForProblematicOrders();
      } catch (error) {
        console.error('❌ Error in monitoring cycle:', error.message);
      }
    }, this.checkInterval);

    console.log(`⏰ Monitoring active - checking every ${this.checkInterval / 1000} seconds`);
  }

  async stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Order ownership monitoring stopped');
  }

  async getSystemLogs(limit = 10) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT message, created_at 
        FROM system_logs 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);

      return rows;
    } catch (error) {
      console.error('❌ Error fetching system logs:', error.message);
      return [];
    }
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Export for use in other files
module.exports = OrderOwnershipMonitor;

// If run directly, start monitoring
if (require.main === module) {
  const monitor = new OrderOwnershipMonitor();
  
  async function main() {
    try {
      await monitor.connect();
      await monitor.startMonitoring();
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down monitor...');
        await monitor.stopMonitoring();
        await monitor.cleanup();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error.message);
      process.exit(1);
    }
  }

  main();
} 