#!/usr/bin/env node
/**
 * Test PDF Content Script
 * Tests that PDFs are being generated with proper content
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function testPDFContent() {
  let connection;
  
  try {
    console.log('🔍 Testing PDF Content Generation...');
    console.log('='.repeat(50));
    
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    });
    
    console.log('✅ Connected to database');
    
    // Get a recent order with receipt
    console.log('\n📋 Finding recent order with receipt...');
    const [orders] = await connection.execute(`
      SELECT * FROM manual_orders 
      WHERE receipt_pdf_path IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (orders.length === 0) {
      console.log('❌ No orders with receipts found');
      return;
    }
    
    const order = orders[0];
    console.log(`✅ Found order: ${order.order_number} (ID: ${order.id})`);
    console.log(`   Receipt path: ${order.receipt_pdf_path}`);
    
    // Check if PDF file exists
    const uploadsDir = path.join(__dirname, 'uploads');
    const pdfPath = path.join(uploadsDir, order.receipt_pdf_path);
    
    console.log(`\n📄 Checking PDF file: ${pdfPath}`);
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file does not exist');
      return;
    }
    
    const stats = fs.statSync(pdfPath);
    console.log(`✅ PDF file exists`);
    console.log(`   File size: ${stats.size} bytes`);
    console.log(`   Created: ${stats.birthtime}`);
    console.log(`   Modified: ${stats.mtime}`);
    
    // Check file size - should be substantial if it has content
    if (stats.size < 1000) {
      console.log('⚠️  WARNING: PDF file is very small, may be empty or corrupted');
    } else if (stats.size < 5000) {
      console.log('⚠️  WARNING: PDF file is small, may have minimal content');
    } else {
      console.log('✅ PDF file size looks good - likely has proper content');
    }
    
    // Try to read the PDF file to check if it's valid
    console.log('\n🔍 Checking PDF file validity...');
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Check PDF header
      const pdfHeader = pdfBuffer.slice(0, 8).toString();
      if (pdfHeader.startsWith('%PDF-')) {
        console.log('✅ PDF file has valid PDF header:', pdfHeader);
      } else {
        console.log('❌ PDF file does not have valid PDF header');
        console.log('   Header found:', pdfHeader);
      }
      
      // Check for PDF trailer
      const pdfContent = pdfBuffer.toString();
      if (pdfContent.includes('%%EOF')) {
        console.log('✅ PDF file has proper EOF marker');
      } else {
        console.log('❌ PDF file missing EOF marker - may be incomplete');
      }
      
      // Check for content indicators
      const contentChecks = [
        { name: 'AFRICAN DEALS DOMAIN', found: pdfContent.includes('AFRICAN DEALS DOMAIN') },
        { name: 'ORDER RECEIPT', found: pdfContent.includes('ORDER RECEIPT') },
        { name: 'Customer Name', found: pdfContent.includes('Customer Name') },
        { name: 'Order ID', found: pdfContent.includes('Order ID') },
        { name: 'TOTAL AMOUNT', found: pdfContent.includes('TOTAL AMOUNT') },
        { name: 'QR Code or Verification', found: pdfContent.includes('VERIFICATION') || pdfContent.includes('QR') },
        { name: 'Agent Signature', found: pdfContent.includes('Agent Signature') }
      ];
      
      console.log('\n📋 Content Analysis:');
      let contentScore = 0;
      contentChecks.forEach(check => {
        const status = check.found ? '✅' : '❌';
        console.log(`   ${status} ${check.name}: ${check.found ? 'Found' : 'Missing'}`);
        if (check.found) contentScore++;
      });
      
      console.log(`\n📊 Content Score: ${contentScore}/${contentChecks.length}`);
      
      if (contentScore === contentChecks.length) {
        console.log('🎉 PDF appears to have all expected content!');
      } else if (contentScore >= contentChecks.length * 0.7) {
        console.log('⚠️  PDF has most expected content, but some elements may be missing');
      } else {
        console.log('❌ PDF appears to be missing significant content');
      }
      
    } catch (readError) {
      console.error('❌ Error reading PDF file:', readError.message);
    }
    
    // Test the download endpoint
    console.log('\n🌐 Testing download endpoint...');
    console.log(`   Endpoint: /api/pickup-site-manager/order/${order.id}/receipt`);
    console.log('   Note: This endpoint requires authentication, so manual testing needed');
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Test download/print functionality in the browser');
    console.log('2. Check browser console for any JavaScript errors');
    console.log('3. Verify authentication tokens are being sent correctly');
    console.log('4. Test with different orders to ensure consistency');
    
    console.log('\n✨ SUMMARY:');
    console.log(`- Order found: ${order.order_number}`);
    console.log(`- PDF exists: ${fs.existsSync(pdfPath) ? 'Yes' : 'No'}`);
    console.log(`- File size: ${stats.size} bytes`);
    console.log(`- Content score: ${contentScore}/${contentChecks.length}`);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  testPDFContent();
}

module.exports = testPDFContent;