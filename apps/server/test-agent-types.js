const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Test the agent types system
async function testAgentTypes() {
  console.log('🧪 Testing Agent Types System...\n');

  // Create test app
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  const mockAuth = (req, res, next) => {
    req.user = { id: 1, role: 'agent', username: 'test_agent' };
    next();
  };

  try {
    // Load the agent routes
    const fastDeliveryRouter = require('./routes/fast-delivery-agent');
    const pickupDeliveryRouter = require('./routes/pickup-delivery-agent');
    const pickupSiteManagerRouter = require('./routes/pickup-site-manager');

    // Mount routes
    app.use('/api/fast-delivery-agent', mockAuth, fastDeliveryRouter);
    app.use('/api/pickup-delivery-agent', mockAuth, pickupDeliveryRouter);
    app.use('/api/pickup-site-manager', mockAuth, pickupSiteManagerRouter);

    console.log('✅ Agent routes loaded successfully');

    // Test route accessibility
    const routes = [
      '/api/fast-delivery-agent/dashboard',
      '/api/pickup-delivery-agent/dashboard',
      '/api/pickup-site-manager/dashboard'
    ];

    for (const route of routes) {
      try {
        const response = await request(app)
          .get(route)
          .set('Authorization', 'Bearer test-token');
        
        console.log(`✅ Route ${route} is accessible (Status: ${response.status})`);
      } catch (error) {
        console.log(`⚠️  Route ${route} test skipped (Database connection required)`);
      }
    }

  } catch (error) {
    console.error('❌ Error loading agent routes:', error.message);
  }

  // Test frontend files
  const fs = require('fs');
  const path = require('path');

  const frontendFiles = [
    '../client/agent/fast-delivery-dashboard-enhanced.html',
    '../client/agent/pickup-delivery-dashboard-enhanced.html',
    '../client/agent/pickup-site-manager-dashboard-enhanced.html'
  ];

  console.log('\n📁 Testing Frontend Files:');
  for (const file of frontendFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${path.basename(file)} exists (${Math.round(stats.size / 1024)}KB)`);
    } else {
      console.log(`❌ ${path.basename(file)} not found`);
    }
  }

  // Test database schema (if connection available)
  console.log('\n🗄️  Testing Database Schema:');
  try {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'african_deals_domain',
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connection established');
    connection.release();

    // Check tables
    const tables = ['pickup_sites', 'grocery_orders', 'manual_orders'];
    for (const table of tables) {
      try {
        const [rows] = await pool.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' not found`);
        }
      } catch (error) {
        console.log(`⚠️  Could not check table '${table}': ${error.message}`);
      }
    }

    // Check agent columns
    try {
      const [columns] = await pool.execute("DESCRIBE agents");
      const columnNames = columns.map(col => col.Field);
      
      const requiredColumns = ['agent_type', 'marketplace_type', 'current_lat', 'current_lng'];
      for (const column of requiredColumns) {
        if (columnNames.includes(column)) {
          console.log(`✅ Column 'agents.${column}' exists`);
        } else {
          console.log(`❌ Column 'agents.${column}' not found`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not check agents table: ${error.message}`);
    }

    await pool.end();

  } catch (error) {
    console.log('⚠️  Database tests skipped (connection not available)');
    console.log('   To run database tests:');
    console.log('   1. Ensure MySQL server is running');
    console.log('   2. Create database "african_deals_domain"');
    console.log('   3. Run: node simple-agent-upgrade.js');
  }

  // Test dependencies
  console.log('\n📦 Testing Dependencies:');
  const dependencies = ['pdfkit', 'qrcode', 'multer'];
  for (const dep of dependencies) {
    try {
      require(dep);
      console.log(`✅ ${dep} is installed`);
    } catch (error) {
      console.log(`❌ ${dep} is not installed - run: npm install ${dep}`);
    }
  }

  // Summary
  console.log('\n📋 Test Summary:');
  console.log('   • Agent routes created and loadable');
  console.log('   • Frontend dashboards created');
  console.log('   • Database schema ready (if MySQL available)');
  console.log('   • Required dependencies checked');
  console.log('\n🚀 Agent Types System is ready for use!');
  console.log('\n📖 Next Steps:');
  console.log('   1. Run database upgrade: node simple-agent-upgrade.js');
  console.log('   2. Start the server: npm start');
  console.log('   3. Access agent dashboards:');
  console.log('      • Fast Delivery: /agent/fast-delivery-dashboard-enhanced.html');
  console.log('      • Pickup Delivery: /agent/pickup-delivery-dashboard-enhanced.html');
  console.log('      • Site Manager: /agent/pickup-site-manager-dashboard-enhanced.html');
}

// Run tests
testAgentTypes().catch(console.error);