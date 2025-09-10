#!/usr/bin/env node
/**
 * Fix Missing Receipts Script
 * Regenerates PDF receipts for all orders that have NULL receipt_pdf_path
 */

const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class MissingReceiptsFixer {
  constructor() {
    this.pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  async generatePDFReceipt(orderData) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`  📄 Creating enhanced comprehensive PDF: ${orderData.order_number}`);
        
        const doc = new PDFDocument({ 
          margin: 30,
          size: 'A4',
          info: {
            Title: `Pickup Site Manager Agent Payment Receipt - ${orderData.order_number}`,
            Author: 'African Deals Domain',
            Subject: 'Pickup Site Manager Agent Payment Receipt – Pending Admin Approval'
          }
        });
        
        // Generate unique receipt ID
        const receiptId = `ADD-AGT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        const filename = `receipt-${orderData.order_number}-${Date.now()}.pdf`;
        const uploadsDir = path.join(__dirname, 'uploads');
        
        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filepath = path.join(uploadsDir, filename);
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);
        
        let y = 40;
        
        // ===== 1. HEADER / BRANDING SECTION =====
        // Company logo area (placeholder)
        doc.rect(40, y, 60, 60).stroke('#2563eb');
        doc.fontSize(8).font('Helvetica');
        doc.fillColor('#6b7280');
        doc.text('LOGO', 65, y + 25);
        
        // Brand name and title
        doc.fontSize(28).font('Helvetica-Bold');
        doc.fillColor('#2563eb');
        doc.text('AFRICAN DEALS DOMAIN', 120, y + 5);
        
        doc.fontSize(16).font('Helvetica-Bold');
        doc.fillColor('#dc2626');
        doc.text('Pickup Site Manager Agent Payment Receipt', 120, y + 35);
        
        doc.fontSize(12).font('Helvetica');
        doc.fillColor('#ef4444');
        doc.text('– Pending Admin Approval', 120, y + 55);
        
        // Receipt info box
        doc.rect(420, y, 150, 80).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fontSize(10).font('Helvetica-Bold');
        doc.fillColor('#1f2937');
        doc.text('RECEIPT DETAILS', 425, y + 5);
        
        doc.fontSize(8).font('Helvetica');
        doc.fillColor('#374151');
        doc.text(`Receipt ID: ${receiptId}`, 425, y + 20);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 425, y + 32);
        doc.text(`Order Date: ${new Date(orderData.created_at).toLocaleString()}`, 425, y + 44);
        doc.text(`Status: PENDING APPROVAL`, 425, y + 56);
        
        y += 100;
        doc.moveTo(40, y).lineTo(570, y).lineWidth(2).stroke('#2563eb');
        y += 20;
        
        // ===== 2. AGENT INFORMATION SECTION =====
        doc.rect(40, y, 520, 80).fillAndStroke('#f0f9ff', '#bae6fd');
        
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#0c4a6e');
        doc.text('🏢 PICKUP SITE MANAGER AGENT INFORMATION', 50, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.fillColor('#1e293b');
        
        doc.text(`Agent Full Name: ${orderData.agent_name || 'System Agent'}`, 50, y + 30);
        doc.text(`Agent ID/Code: ${orderData.agent_id || 'AUTO-GENERATED'}`, 50, y + 45);
        doc.text(`Contact Phone: ${orderData.agent_phone || '+27 XXX XXX XXXX'}`, 50, y + 60);
        
        doc.text(`Pickup Site: ${orderData.pickup_site_name || 'Main Pickup Site'}`, 300, y + 30);
        doc.text(`Site Location: ${orderData.pickup_site_address || 'Address Not Available'}`, 300, y + 45);
        doc.text(`Agent Email: ${orderData.agent_email || 'agent@africandealsdomains.com'}`, 300, y + 60);
        
        y += 100;
        
        // ===== 3. CUSTOMER INFORMATION SECTION =====
        doc.rect(40, y, 520, 70).fillAndStroke('#f0fdf4', '#bbf7d0');
        
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#14532d');
        doc.text('👤 CUSTOMER INFORMATION', 50, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.fillColor('#1e293b');
        
        doc.text(`Customer Full Name: ${orderData.buyer_name}`, 50, y + 30);
        doc.text(`Phone Number: ${orderData.buyer_phone}`, 50, y + 45);
        
        doc.text(`Order ID: ${orderData.order_number}`, 300, y + 30);
        doc.text(`Delivery/Pickup Location: ${orderData.pickup_site_name || 'Main Pickup Site'}`, 300, y + 45);
        
        if (orderData.buyer_email) {
          doc.text(`Email: ${orderData.buyer_email}`, 50, y + 60);
        }
        
        y += 90;
        
        // ===== 4. ORDER DETAILS SECTION =====
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#7c2d12');
        doc.text('📦 ORDER DETAILS', 50, y);
        y += 20;
        
        // Enhanced table headers
        doc.rect(40, y, 520, 20).fillAndStroke('#fef3c7', '#f59e0b');
        doc.fontSize(10).font('Helvetica-Bold');
        doc.fillColor('#92400e');
        doc.text('Product Name', 50, y + 6);
        doc.text('Qty', 280, y + 6);
        doc.text('Unit Price', 330, y + 6);
        doc.text('Subtotal', 450, y + 6);
        y += 25;
        
        // Items
        const items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]');
        let calculatedSubtotal = 0;
        
        doc.fontSize(9).font('Helvetica');
        items.forEach((item, index) => {
          const quantity = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          const itemSubtotal = quantity * price;
          calculatedSubtotal += itemSubtotal;
          
          const bgColor = index % 2 === 0 ? '#fafafa' : '#ffffff';
          doc.rect(40, y - 3, 520, 18).fill(bgColor);
          
          doc.fillColor('#374151');
          doc.text(`${index + 1}. ${item.item || 'Unknown Product'}`, 50, y);
          doc.text(quantity.toString(), 285, y);
          doc.text(`$${price.toFixed(2)}`, 335, y);
          doc.text(`$${itemSubtotal.toFixed(2)}`, 455, y);
          y += 18;
        });
        
        y += 10;
        
        // Enhanced totals section
        const subtotalAmount = parseFloat(orderData.subtotal) || calculatedSubtotal;
        const packagingFee = parseFloat(orderData.packaging_fee) || 0;
        const deliveryAmount = parseFloat(orderData.delivery_fee) || 0;
        const totalAmount = parseFloat(orderData.total_amount) || (subtotalAmount + packagingFee + deliveryAmount);
        
        // Totals box
        doc.rect(300, y, 260, 80).fillAndStroke('#f8fafc', '#cbd5e1');
        
        doc.fontSize(10).font('Helvetica');
        doc.fillColor('#374151');
        doc.text(`Subtotal:`, 310, y + 10);
        doc.text(`$${subtotalAmount.toFixed(2)}`, 480, y + 10);
        
        if (packagingFee > 0) {
          doc.text(`Packaging Fee (Fragile):`, 310, y + 25);
          doc.text(`$${packagingFee.toFixed(2)}`, 480, y + 25);
        }
        
        doc.text(`Delivery Fee:`, 310, y + 40);
        if (deliveryAmount === 0) {
          doc.fillColor('#059669');
          doc.text(`FREE (Pickup Site)`, 430, y + 40);
          doc.fillColor('#374151');
        } else {
          doc.text(`$${deliveryAmount.toFixed(2)}`, 480, y + 40);
        }
        
        // Total amount highlight
        doc.rect(305, y + 55, 250, 20).fillAndStroke('#dbeafe', '#3b82f6');
        doc.fontSize(12).font('Helvetica-Bold');
        doc.fillColor('#1e40af');
        doc.text(`TOTAL AMOUNT:`, 310, y + 60);
        doc.text(`$${totalAmount.toFixed(2)}`, 480, y + 60);
        
        y += 100;
        
        // ===== 5. PAYMENT DETAILS SECTION =====
        doc.rect(40, y, 520, 90).fillAndStroke('#fef7ff', '#e9d5ff');
        
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#6b21a8');
        doc.text('💳 PAYMENT DETAILS', 50, y + 10);
        
        doc.fontSize(10).font('Helvetica');
        doc.fillColor('#1e293b');
        
        doc.text(`Payment Method: Mobile Money (MTN)`, 50, y + 30);
        doc.text(`Amount Received by Agent: $${totalAmount.toFixed(2)}`, 50, y + 45);
        doc.text(`Payment Date & Time: ${new Date(orderData.created_at).toLocaleString()}`, 50, y + 60);
        
        doc.fillColor('#059669');
        doc.text(`✅ Funds Forwarded to ADD Account`, 300, y + 30);
        doc.fillColor('#d97706');
        doc.text(`⏳ Awaiting Admin Approval`, 300, y + 45);
        doc.fillColor('#1e293b');
        if (orderData.transaction_id) {
          doc.text(`Transaction ID: ${orderData.transaction_id}`, 300, y + 60);
        }
        
        y += 110;
        
        // ===== 6. TRANSACTION STATUS SECTION =====
        doc.rect(40, y, 520, 70).fillAndStroke('#fff7ed', '#fed7aa');
        
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#c2410c');
        doc.text('📊 TRANSACTION STATUS', 50, y + 10);
        
        doc.fontSize(11).font('Helvetica-Bold');
        doc.fillColor('#059669');
        doc.text(`✅ Agent Status: Funds Received from Customer`, 50, y + 30);
        
        doc.fillColor('#d97706');
        doc.text(`⏳ Admin Status: Pending Approval — Funds not yet cleared into ADD main account`, 50, y + 45);
        
        y += 90;
        
        // ===== 7. DISCLAIMER SECTION =====
        doc.rect(40, y, 520, 60).fillAndStroke('#fef2f2', '#fecaca');
        
        doc.fontSize(12).font('Helvetica-Bold');
        doc.fillColor('#dc2626');
        doc.text('⚠️ IMPORTANT DISCLAIMER', 50, y + 10);
        
        doc.fontSize(9).font('Helvetica');
        doc.fillColor('#7f1d1d');
        const disclaimer = `This receipt confirms that the Pickup Site Manager Agent has received the payment on behalf of African Deals Domain. Funds are pending verification and approval by ADD admin. This is not a final clearance confirmation. Customer pickup will be available only after admin approval and fund clearance.`;
        
        doc.text(disclaimer, 50, y + 25, { width: 500, align: 'justify', lineGap: 2 });
        
        y += 80;
        
        // ===== 8. QR CODE SECTION =====
        doc.rect(40, y, 520, 120).fillAndStroke('#f0f9ff', '#bae6fd');
        
        doc.fontSize(14).font('Helvetica-Bold');
        doc.fillColor('#0c4a6e');
        doc.text('📱 QR CODE VERIFICATION', 50, y + 10);
        
        doc.fontSize(9).font('Helvetica');
        doc.fillColor('#1e293b');
        doc.text('Scan this QR code for instant order verification and status tracking:', 50, y + 30);
        
        // Generate comprehensive QR code data
        const qrData = JSON.stringify({
          type: 'ADD_AGENT_PAYMENT_RECEIPT',
          receiptId: receiptId,
          orderId: orderData.order_number,
          customerName: orderData.buyer_name,
          customerPhone: orderData.buyer_phone,
          agentName: orderData.agent_name || 'System Agent',
          pickupSite: orderData.pickup_site_name || 'Main Site',
          amount: totalAmount,
          paymentMethod: 'MTN Mobile Money',
          status: 'PENDING_ADMIN_APPROVAL',
          items: items.length,
          timestamp: new Date().toISOString(),
          hash: Buffer.from(`${receiptId}-${orderData.order_number}-${totalAmount}-${orderData.buyer_phone}`).toString('base64')
        });
        
        // Generate QR code and handle completion
        QRCode.toDataURL(qrData, { 
          width: 250, 
          margin: 2,
          color: {
            dark: '#1e40af',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        }, (err, qrUrl) => {
          if (!err && qrUrl) {
            try {
              const qrImage = qrUrl.split(',')[1];
              const qrBuffer = Buffer.from(qrImage, 'base64');
              doc.image(qrBuffer, 50, y + 45, { width: 100, height: 100 });
              
              doc.fontSize(8).font('Helvetica');
              doc.fillColor('#374151');
              doc.text('Order Verification QR Code', 50, y + 150);
              doc.text(`Receipt ID: ${receiptId}`, 50, y + 162);
              doc.text(`Order: ${orderData.order_number}`, 50, y + 174);
              
            } catch (qrError) {
              doc.fontSize(10).font('Helvetica');
              doc.fillColor('#dc2626');
              doc.text('Manual Verification Required', 50, y + 45);
              doc.text(`Receipt ID: ${receiptId}`, 50, y + 60);
              doc.text(`Order ID: ${orderData.order_number}`, 50, y + 75);
            }
          } else {
            doc.fontSize(10).font('Helvetica');
            doc.fillColor('#dc2626');
            doc.text('Manual Verification Required', 50, y + 45);
            doc.text(`Receipt ID: ${receiptId}`, 50, y + 60);
            doc.text(`Customer: ${orderData.buyer_name}`, 50, y + 75);
            doc.text(`Phone: ${orderData.buyer_phone}`, 50, y + 90);
            doc.text(`Amount: $${totalAmount.toFixed(2)}`, 50, y + 105);
          }
          
          // Agent signature area
          doc.fontSize(10).font('Helvetica-Bold');
          doc.fillColor('#374151');
          doc.text('Agent Signature & Verification:', 200, y + 50);
          
          doc.fontSize(9).font('Helvetica');
          doc.text('Agent Signature:', 200, y + 70);
          doc.text('_________________________________', 200, y + 85);
          doc.text(`Date: ${new Date().toLocaleDateString()}`, 200, y + 105);
          doc.text('Time: _______________', 350, y + 105);
          doc.text('Agent Stamp/ID:', 200, y + 125);
          doc.rect(200, y + 135, 80, 30).stroke();
          
          y += 180;
          
          // ENHANCED FOOTER SECTION
          doc.moveTo(40, y).lineTo(570, y).lineWidth(2).stroke('#2563eb');
          y += 15;
          
          doc.fontSize(10).font('Helvetica-Bold');
          doc.fillColor('#2563eb');
          doc.text('AFRICAN DEALS DOMAIN - Pickup Site Manager Agent Receipt', 50, y, { align: 'center', width: 520 });
          y += 15;
          
          doc.fontSize(8).font('Helvetica');
          doc.fillColor('#6b7280');
          doc.text('Thank you for your service as a Pickup Site Manager Agent!', 50, y, { align: 'center', width: 520 });
          y += 12;
          
          doc.text('For support and inquiries: africandealsdomains.com | +27 123 456 7890', 50, y, { align: 'center', width: 520 });
          y += 12;
          
          doc.text(`Receipt generated on ${new Date().toLocaleString()} | System Version 3.0 | Receipt ID: ${receiptId}`, 50, y, { align: 'center', width: 520 });
          
          // End document
          doc.end();
          
          writeStream.on('finish', () => {
            resolve(filename);
          });
          
          writeStream.on('error', (streamError) => {
            reject(streamError);
          });
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async fixMissingReceipts() {
    console.log('🔧 Starting Missing Receipts Fix Process...');
    console.log('='.repeat(50));
    
    try {
      // Get all orders without receipt PDFs
      console.log('📋 Finding orders without receipt PDFs...');
      const [orders] = await this.pool.query(`
        SELECT mo.*, 
               ps.name as pickup_site_name, 
               ps.address_line1 as pickup_site_address
        FROM manual_orders mo
        LEFT JOIN pickup_sites ps ON mo.pickup_site_id = ps.id
        WHERE mo.receipt_pdf_path IS NULL
        ORDER BY mo.created_at DESC
      `);
      
      console.log(`📄 Found ${orders.length} orders without receipt PDFs`);
      
      if (orders.length === 0) {
        console.log('✅ All orders already have receipt PDFs!');
        return;
      }
      
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        
        console.log(`\n📦 Processing order ${i + 1}/${orders.length}: ${order.order_number}`);
        console.log(`   Customer: ${order.buyer_name}`);
        console.log(`   Total: $${order.total_amount}`);
        console.log(`   Date: ${order.created_at}`);
        
        try {
          // Prepare order data
          const orderData = {
            order_number: order.order_number,
            created_at: order.created_at,
            buyer_name: order.buyer_name,
            buyer_phone: order.buyer_phone,
            buyer_email: order.buyer_email,
            pickup_site_name: order.pickup_site_name || 'Unknown Site',
            pickup_site_address: order.pickup_site_address || 'N/A',
            agent_name: order.agent_name || 'Unknown Agent',
            agent_id: order.agent_id || 'N/A',
            agent_phone: order.agent_phone || 'N/A',
            items: order.items,
            subtotal: order.subtotal,
            commission_amount: order.commission_amount,
            delivery_fee: order.delivery_fee,
            total_amount: order.total_amount,
            status: order.status,
            transaction_id: order.transaction_id,
            payment_proof_url: order.payment_proof_url
          };
          
          // Generate PDF
          const pdfFilename = await this.generatePDFReceipt(orderData);
          
          // Update database
          const [updateResult] = await this.pool.query(`
            UPDATE manual_orders SET receipt_pdf_path = ?, updated_at = NOW() WHERE id = ?
          `, [pdfFilename, order.id]);
          
          if (updateResult.affectedRows > 0) {
            console.log(`   ✅ Receipt generated: ${pdfFilename}`);
            successCount++;
          } else {
            console.log(`   ❌ Database update failed`);
            failureCount++;
          }
          
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
          failureCount++;
        }
      }
      
      console.log('\n' + '='.repeat(50));
      console.log('📊 SUMMARY');
      console.log('='.repeat(50));
      console.log(`✅ Successfully processed: ${successCount}`);
      console.log(`❌ Failed: ${failureCount}`);
      console.log(`📄 Total orders: ${orders.length}`);
      
      if (successCount === orders.length) {
        console.log('🎉 All missing receipts have been fixed!');
      } else if (successCount > 0) {
        console.log('⚠️  Some receipts were fixed, but some failures occurred.');
      } else {
        console.log('❌ No receipts were generated successfully.');
      }
      
    } catch (error) {
      console.error('❌ Fix process error:', error.message);
    } finally {
      await this.pool.end();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new MissingReceiptsFixer();
  fixer.fixMissingReceipts().catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });
}

module.exports = MissingReceiptsFixer;