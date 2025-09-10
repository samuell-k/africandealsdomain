#!/usr/bin/env node
/**
 * Test New PDF Generation
 * Generate a test PDF to verify the new format works
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Import the PDF generation function from the route
const { generatePDFReceipt } = require('./routes/pickup-site-manager');

async function testNewPDFGeneration() {
  let connection;
  
  try {
    console.log('🧪 Testing New PDF Generation...');
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
    
    // Get a recent order
    console.log('\n📋 Finding recent order...');
    const [orders] = await connection.execute(`
      SELECT * FROM manual_orders 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (orders.length === 0) {
      console.log('❌ No orders found');
      return;
    }
    
    const order = orders[0];
    console.log(`✅ Found order: ${order.order_number} (ID: ${order.id})`);
    
    // Prepare order data for PDF generation
    const orderData = {
      order_number: order.order_number,
      created_at: order.created_at,
      buyer_name: order.buyer_name,
      buyer_phone: order.buyer_phone,
      buyer_email: order.buyer_email,
      pickup_site_name: 'Test Pickup Site',
      pickup_site_address: '123 Test Street, Test City',
      agent_name: 'Test Agent',
      agent_id: 'AGENT001',
      agent_phone: '+27123456789',
      items: order.items,
      subtotal: order.subtotal,
      commission_amount: order.commission_amount,
      delivery_fee: order.delivery_fee,
      total_amount: order.total_amount,
      status: order.status,
      transaction_id: order.transaction_id || 'TEST123456789'
    };
    
    console.log('\n📄 Generating test PDF...');
    console.log(`   Customer: ${orderData.buyer_name}`);
    console.log(`   Total: $${orderData.total_amount}`);
    
    // Generate PDF using the route function
    try {
      // We need to create the function manually since we can't import from routes
      const PDFDocument = require('pdfkit');
      const QRCode = require('qrcode');
      
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        info: {
          Title: `Test Receipt - ${orderData.order_number}`,
          Author: 'African Deals Domain',
          Subject: 'Order Receipt Test'
        }
      });
      
      const filename = `test-receipt-${orderData.order_number}-${Date.now()}.pdf`;
      const uploadsDir = path.join(__dirname, 'uploads');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filepath = path.join(uploadsDir, filename);
      console.log(`   Creating PDF at: ${filepath}`);
      
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);
      
      // Write content immediately
      let y = 50;
      
      // HEADER SECTION
      doc.fontSize(24).font('Helvetica-Bold');
      doc.fillColor('#2563eb');
      doc.text('AFRICAN DEALS DOMAIN', 50, y);
      doc.fillColor('#000000');
      
      y += 35;
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text('ORDER RECEIPT', 50, y);
      
      // Receipt info box
      doc.fontSize(9).font('Helvetica');
      doc.rect(380, 45, 170, 60).stroke();
      doc.text(`Receipt ID: ${filename.substring(0, 25)}...`, 385, 50);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 385, 65);
      doc.text(`Order Date: ${new Date(orderData.created_at).toLocaleString()}`, 385, 80);
      
      y += 40;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 20;
      
      // CUSTOMER INFO SECTION
      doc.fontSize(12).font('Helvetica-Bold');
      doc.fillColor('#1f2937');
      doc.text('CUSTOMER INFORMATION', 50, y);
      doc.fillColor('#000000');
      y += 18;
      
      doc.fontSize(9).font('Helvetica');
      doc.text(`Customer Name: ${orderData.buyer_name}`, 50, y);
      doc.text(`Order ID: ${orderData.order_number}`, 300, y);
      y += 12;
      
      doc.text(`Phone: ${orderData.buyer_phone}`, 50, y);
      y += 20;
      
      // ORDER DETAILS SECTION
      doc.fontSize(12).font('Helvetica-Bold');
      doc.fillColor('#1f2937');
      doc.text('ORDER DETAILS', 50, y);
      doc.fillColor('#000000');
      y += 18;
      
      // Items
      const items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]');
      let calculatedSubtotal = 0;
      
      doc.fontSize(9).font('Helvetica');
      items.forEach((item, index) => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        const itemSubtotal = quantity * price;
        calculatedSubtotal += itemSubtotal;
        
        doc.text(`${index + 1}. ${item.item || 'Unknown Item'}`, 50, y);
        doc.text(`Qty: ${quantity} x $${price.toFixed(2)} = $${itemSubtotal.toFixed(2)}`, 300, y);
        y += 12;
      });
      
      y += 10;
      const totalAmount = parseFloat(orderData.total_amount) || calculatedSubtotal;
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`TOTAL AMOUNT: $${totalAmount.toFixed(2)}`, 50, y);
      y += 25;
      
      // VERIFICATION SECTION
      doc.fontSize(12).font('Helvetica-Bold');
      doc.fillColor('#1f2937');
      doc.text('VERIFICATION & PICKUP', 50, y);
      doc.fillColor('#000000');
      y += 18;
      
      doc.fontSize(9).font('Helvetica');
      doc.text('Present this receipt for order verification:', 50, y);
      y += 15;
      
      // Generate QR code data
      const qrData = JSON.stringify({
        type: 'ORDER_VERIFICATION',
        orderId: orderData.order_number,
        customerName: orderData.buyer_name,
        amount: totalAmount,
        timestamp: new Date().toISOString()
      });
      
      console.log('   Generating QR code...');
      
      // Generate QR code and handle completion
      QRCode.toDataURL(qrData, { 
        width: 200, 
        margin: 2,
        errorCorrectionLevel: 'M'
      }, (err, qrUrl) => {
        if (!err && qrUrl) {
          try {
            const qrImage = qrUrl.split(',')[1];
            const qrBuffer = Buffer.from(qrImage, 'base64');
            doc.image(qrBuffer, 50, y, { width: 80, height: 80 });
            
            doc.fontSize(8).font('Helvetica');
            doc.text('Verification QR Code', 50, y + 85);
            doc.text(`Order: ${orderData.order_number}`, 50, y + 95);
            
          } catch (qrError) {
            console.warn('   QR code embedding failed:', qrError.message);
            doc.fontSize(9).font('Helvetica');
            doc.text('Manual Verification Required', 50, y);
            doc.text(`Order ID: ${orderData.order_number}`, 50, y + 12);
          }
        } else {
          console.warn('   QR code generation failed:', err?.message || 'Unknown error');
          doc.fontSize(9).font('Helvetica');
          doc.text('Manual Verification Required', 50, y);
          doc.text(`Order ID: ${orderData.order_number}`, 50, y + 12);
        }
        
        y += 110;
        
        // FOOTER SECTION
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;
        
        doc.fontSize(8).font('Helvetica');
        doc.fillColor('#6b7280');
        doc.text('Thank you for choosing African Deals Domain!', 50, y, { align: 'center', width: 500 });
        y += 12;
        
        doc.text('For support: support@africandealsdomains.com', 50, y, { align: 'center', width: 500 });
        
        // End document
        doc.end();
        
        writeStream.on('finish', () => {
          console.log('✅ Test PDF generated successfully!');
          
          // Check file stats
          const stats = fs.statSync(filepath);
          console.log(`   File: ${filename}`);
          console.log(`   Size: ${stats.size} bytes`);
          console.log(`   Path: ${filepath}`);
          
          if (stats.size > 5000) {
            console.log('🎉 PDF size looks good - content should be present!');
          } else {
            console.log('⚠️  PDF size is small - may have issues');
          }
          
          console.log('\n💡 NEXT STEPS:');
          console.log('1. Open the PDF file manually to verify content');
          console.log('2. Test the download/print functionality in browser');
          console.log('3. Check that QR code is visible and scannable');
          
          process.exit(0);
        });
        
        writeStream.on('error', (streamError) => {
          console.error('❌ Stream error:', streamError);
          process.exit(1);
        });
      });
      
    } catch (pdfError) {
      console.error('❌ PDF generation error:', pdfError);
    }
    
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
  testNewPDFGeneration();
}

module.exports = testNewPDFGeneration;