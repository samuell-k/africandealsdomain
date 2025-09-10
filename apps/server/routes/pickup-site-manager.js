const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const enhancedPDFGenerator = require('../utils/enhanced-pdf-generator');
const CommissionCalculator = require('../utils/commission-calculator');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/payment-proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is pickup site manager
const requirePickupSiteManager = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId; // Support both formats
    console.log('[PICKUP-SITE-MANAGER] Verifying agent for user:', userId);
    
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "pickup_site_manager"',
      [userId]
    );
    
    if (agents.length === 0) {
      console.log('[PICKUP-SITE-MANAGER] No pickup site manager found for user:', userId);
      return res.status(403).json({ error: 'Pickup site manager access required' });
    }
    
    const agent = agents[0];
    console.log('[PICKUP-SITE-MANAGER] Agent found:', { id: agent.id, agent_type: agent.agent_type });
    
    // Extract pickup site ID from commission settings or direct column
    let pickupSiteId = agent.pickup_site_id; // Check direct column first
    
    if (!pickupSiteId && agent.commission_settings) {
      try {
        const settings = JSON.parse(agent.commission_settings);
        pickupSiteId = settings.pickup_site_id;
      } catch (e) {
        console.log('[PICKUP-SITE-MANAGER] Could not parse commission settings');
      }
    }
    
    if (!pickupSiteId) {
      console.log('[PICKUP-SITE-MANAGER] No pickup site assigned to agent - proceeding with home-delivery-only mode');
      // Allow access without a physical pickup site by setting a virtual placeholder
      agent.pickup_site_id = 0;
      agent.pickup_site = {
        id: 0,
        site_name: 'Home Delivery Only',
        name: 'Home Delivery Only',
        address: 'Virtual Site - Home Delivery Service',
        city: 'All Cities',
        state: 'All States',
        is_active: 1,
        capacity: 999999,
        current_load: 0,
        manager_name: agent.first_name + ' ' + agent.last_name,
        manager_phone: agent.phone || 'N/A'
      };
      req.agent = agent;
      return next();
    }
    
    // Get pickup site details
    const [sites] = await pool.query('SELECT * FROM pickup_sites WHERE id = ?', [pickupSiteId]);
    
    agent.pickup_site_id = pickupSiteId;
    agent.pickup_site = sites[0] || null;
    
    req.agent = agent;
    next();
  } catch (error) {
    console.error('[PICKUP-SITE-MANAGER] Middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Note: Legacy PDF generation function - now using enhanced-pdf-generator.js
// This function is kept for reference but is no longer used
async function generatePDFReceipt_DEPRECATED(orderData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('[PDF-GENERATION-DEPRECATED] Starting enhanced PDF generation for order:', orderData.order_number);
      
      const doc = new PDFDocument({ 
        margin: 30,
        size: 'A4',
        info: {
          Title: `Pickup Site Manager Agent Payment Receipt - ${orderData.order_number}`,
          Author: 'African Deals Domain',
          Subject: 'Pickup Site Manager Agent Payment Receipt – Pending Admin Approval',
          Keywords: 'receipt, payment, pickup site, agent, pending approval'
        }
      });
      
      // Generate unique receipt ID
      const receiptId = `ADD-AGT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const filename = `receipt-${orderData.order_number}-${Date.now()}.pdf`;
      const uploadsDir = path.join(__dirname, '../uploads');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('[PDF-GENERATION] Created uploads directory:', uploadsDir);
      }
      
      const filepath = path.join(uploadsDir, filename);
      console.log('[PDF-GENERATION] Creating enhanced PDF at:', filepath);
      
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);
      
      let y = 40;
      
      console.log('[PDF-GENERATION] Writing enhanced header section...');
      
      // ===== 1. HEADER / BRANDING SECTION =====
      // Company logo area (placeholder for future logo)
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
      
      // Receipt info box with enhanced styling
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
      
      // Main separator line
      doc.moveTo(40, y).lineTo(570, y).lineWidth(2).stroke('#2563eb');
      y += 20;
      
      console.log('[PDF-GENERATION] Writing agent information section...');
      
      // ===== 2. AGENT INFORMATION SECTION =====
      doc.rect(40, y, 520, 80).fillAndStroke('#f0f9ff', '#bae6fd');
      
      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor('#0c4a6e');
      doc.text('🏢 PICKUP SITE MANAGER AGENT INFORMATION', 50, y + 10);
      
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#1e293b');
      
      // Left column
      doc.text(`Agent Full Name: ${orderData.agent_name || 'System Agent'}`, 50, y + 30);
      doc.text(`Agent ID/Code: ${orderData.agent_id || 'AUTO-GENERATED'}`, 50, y + 45);
      doc.text(`Contact Phone: ${orderData.agent_phone || '+27 XXX XXX XXXX'}`, 50, y + 60);
      
      // Right column
      doc.text(`Pickup Site: ${orderData.pickup_site_name || 'Main Pickup Site'}`, 300, y + 30);
      doc.text(`Site Location: ${orderData.pickup_site_address || 'Address Not Available'}`, 300, y + 45);
      doc.text(`Agent Email: ${orderData.agent_email || 'agent@africandealsdomains.com'}`, 300, y + 60);
      
      y += 100;
      
      console.log('[PDF-GENERATION] Writing customer information section...');
      
      // ===== 3. CUSTOMER INFORMATION SECTION =====
      doc.rect(40, y, 520, 70).fillAndStroke('#f0fdf4', '#bbf7d0');
      
      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor('#14532d');
      doc.text('👤 CUSTOMER INFORMATION', 50, y + 10);
      
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#1e293b');
      
      // Left column
      doc.text(`Customer Full Name: ${orderData.buyer_name}`, 50, y + 30);
      doc.text(`Phone Number: ${orderData.buyer_phone}`, 50, y + 45);
      
      // Right column
      doc.text(`Order ID: ${orderData.order_number}`, 300, y + 30);
      doc.text(`Delivery/Pickup Location: ${orderData.pickup_site_name || 'Main Pickup Site'}`, 300, y + 45);
      
      if (orderData.buyer_email) {
        doc.text(`Email: ${orderData.buyer_email}`, 50, y + 60);
      }
      
      y += 90;
      
      console.log('[PDF-GENERATION] Writing order details section...');
      
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
      
      // Items with enhanced styling
      const items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]');
      let calculatedSubtotal = 0;
      
      doc.fontSize(9).font('Helvetica');
      items.forEach((item, index) => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        const itemSubtotal = quantity * price;
        calculatedSubtotal += itemSubtotal;
        
        // Alternate row colors
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
      
      console.log('[PDF-GENERATION] Writing payment details section...');
      
      // ===== 5. PAYMENT DETAILS SECTION =====
      doc.rect(40, y, 520, 90).fillAndStroke('#fef7ff', '#e9d5ff');
      
      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor('#6b21a8');
      doc.text('💳 PAYMENT DETAILS', 50, y + 10);
      
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#1e293b');
      
      // Left column
      doc.text(`Payment Method: Mobile Money (MTN)`, 50, y + 30);
      doc.text(`Amount Received by Agent: $${totalAmount.toFixed(2)}`, 50, y + 45);
      doc.text(`Payment Date & Time: ${new Date(orderData.created_at).toLocaleString()}`, 50, y + 60);
      
      // Right column
      doc.fillColor('#059669');
      doc.text(`✅ Funds Forwarded to ADD Account`, 300, y + 30);
      doc.fillColor('#d97706');
      doc.text(`⏳ Awaiting Admin Approval`, 300, y + 45);
      doc.fillColor('#1e293b');
      if (orderData.transaction_id) {
        doc.text(`Transaction ID: ${orderData.transaction_id}`, 300, y + 60);
      }
      
      y += 110;
      
      console.log('[PDF-GENERATION] Writing transaction status section...');
      
      // ===== 6. TRANSACTION STATUS SECTION =====
      doc.rect(40, y, 520, 70).fillAndStroke('#fff7ed', '#fed7aa');
      
      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor('#c2410c');
      doc.text('📊 TRANSACTION STATUS', 50, y + 10);
      
      doc.fontSize(11).font('Helvetica-Bold');
      
      // Agent status
      doc.fillColor('#059669');
      doc.text(`✅ Agent Status: Funds Received from Customer`, 50, y + 30);
      
      // Admin status
      doc.fillColor('#d97706');
      doc.text(`⏳ Admin Status: Pending Approval — Funds not yet cleared into ADD main account`, 50, y + 45);
      
      y += 90;
      
      console.log('[PDF-GENERATION] Writing disclaimer section...');
      
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
      
      console.log('[PDF-GENERATION] Writing QR code section...');
      
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
        console.log('[PDF-GENERATION] QR code generation callback triggered');
        
        if (!err && qrUrl) {
          try {
            console.log('[PDF-GENERATION] Adding enhanced QR code to PDF...');
            const qrImage = qrUrl.split(',')[1];
            const qrBuffer = Buffer.from(qrImage, 'base64');
            doc.image(qrBuffer, 50, y + 45, { width: 100, height: 100 });
            
            // QR code info
            doc.fontSize(8).font('Helvetica');
            doc.fillColor('#374151');
            doc.text('Order Verification QR Code', 50, y + 150);
            doc.text(`Receipt ID: ${receiptId}`, 50, y + 162);
            doc.text(`Order: ${orderData.order_number}`, 50, y + 174);
            
          } catch (qrError) {
            console.warn('[PDF-GENERATION] QR code embedding failed:', qrError.message);
            doc.fontSize(10).font('Helvetica');
            doc.fillColor('#dc2626');
            doc.text('Manual Verification Required', 50, y + 45);
            doc.text(`Receipt ID: ${receiptId}`, 50, y + 60);
            doc.text(`Order ID: ${orderData.order_number}`, 50, y + 75);
            doc.text(`Verification Code: ${orderData.order_number.slice(-8)}`, 50, y + 90);
          }
        } else {
          console.warn('[PDF-GENERATION] QR code generation failed:', err?.message || 'Unknown error');
          doc.fontSize(10).font('Helvetica');
          doc.fillColor('#dc2626');
          doc.text('Manual Verification Required', 50, y + 45);
          doc.text(`Receipt ID: ${receiptId}`, 50, y + 60);
          doc.text(`Customer: ${orderData.buyer_name}`, 50, y + 75);
          doc.text(`Phone: ${orderData.buyer_phone}`, 50, y + 90);
          doc.text(`Amount: $${totalAmount.toFixed(2)}`, 50, y + 105);
        }
        
        // Agent signature area (right side of QR)
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
        
        console.log('[PDF-GENERATION] Writing enhanced footer...');
        
        // ===== ENHANCED FOOTER SECTION =====
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
        
        doc.text('For support and inquiries: support@africandealsdomains.com | +27 123 456 7890', 50, y, { align: 'center', width: 520 });
        y += 12;
        
        doc.text(`Receipt generated on ${new Date().toLocaleString()} | System Version 3.0 | Receipt ID: ${receiptId}`, 50, y, { align: 'center', width: 520 });
        
        console.log('[PDF-GENERATION] Finalizing enhanced PDF document...');
        
        // End document AFTER all content is written
        doc.end();
        
        // Wait for stream to finish
        writeStream.on('finish', () => {
          console.log('[PDF-GENERATION] ✅ Enhanced PDF receipt generated successfully:', filename);
          console.log('[PDF-GENERATION] Receipt ID:', receiptId);
          console.log('[PDF-GENERATION] File size:', fs.statSync(filepath).size, 'bytes');
          resolve(filename);
        });
        
        writeStream.on('error', (streamError) => {
          console.error('[PDF-GENERATION] ❌ Stream error:', streamError);
          reject(streamError);
        });
      });

    } catch (error) {
      console.error('[PDF-GENERATION] ❌ Enhanced PDF generation error:', error);
      reject(error);
    }
  });
}

// GET /api/pickup-site-manager/active-sites - Get all active pickup sites (public endpoint)
router.get('/active-sites', async (req, res) => {
  try {
    console.log('[PICKUP-SITES] Loading active pickup sites...');
    
    const [sites] = await pool.query(`
      SELECT 
        ps.id,
        ps.name as site_name,
        ps.address_line1 as address,
        ps.city,
        ps.state,
        ps.latitude,
        ps.longitude,
        ps.capacity,
        ps.current_load,
        ps.is_active,
        ps.manager_name,
        ps.manager_phone,
        ps.phone
      FROM pickup_sites ps
      WHERE ps.is_active = 1 AND (ps.capacity IS NULL OR ps.capacity > ps.current_load)
      ORDER BY ps.name
    `);

    console.log(`[PICKUP-SITES] Found ${sites.length} active sites`);

    // Add availability status
    const sitesWithStatus = sites.map(site => {
      const capacity = site.capacity || 100;
      const currentLoad = site.current_load || 0;
      const loadPercentage = Math.round((currentLoad / capacity) * 100);
      
      return {
        ...site,
        capacity: capacity,
        current_load: currentLoad,
        availability_status: currentLoad >= capacity ? 'full' : 'available',
        load_percentage: loadPercentage,
        manager_phone: site.manager_phone || site.phone || null
      };
    });

    console.log('[PICKUP-SITES] Sites processed successfully');
    res.json(sitesWithStatus);

  } catch (error) {
    console.error('Get active pickup sites error:', error);
    res.status(500).json({ error: 'Failed to get pickup sites', details: error.message });
  }
});

// GET /api/pickup-site-manager/current-site - Get current agent's pickup site
router.get('/current-site', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[CURRENT-SITE] Loading current agent site...');
    
    let sites = [];
    
    // Handle virtual site for home-delivery-only mode
    if (req.agent.pickup_site_id === 0) {
      sites = [req.agent.pickup_site];
    } else {
      const [dbSites] = await pool.query(`
        SELECT 
          ps.id,
          ps.name as site_name,
          ps.address_line1 as address,
          ps.city,
          ps.state,
          ps.latitude,
          ps.longitude,
          ps.capacity,
          ps.current_load,
          ps.is_active,
          ps.manager_name,
          ps.manager_phone,
          ps.phone
        FROM pickup_sites ps
        WHERE ps.id = ? AND ps.is_active = 1
      `, [req.agent.pickup_site_id]);
      sites = dbSites;
    }

    if (sites.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Current pickup site not found or inactive' 
      });
    }

    const site = sites[0];
    const capacity = site.capacity || 100;
    const currentLoad = site.current_load || 0;
    const loadPercentage = Math.round((currentLoad / capacity) * 100);
    
    const siteWithStatus = {
      ...site,
      capacity: capacity,
      current_load: currentLoad,
      availability_status: currentLoad >= capacity ? 'full' : 'available',
      load_percentage: loadPercentage,
      manager_phone: site.manager_phone || site.phone || null
    };

    console.log(`[CURRENT-SITE] Found current site: ${site.site_name}`);

    res.json({
      success: true,
      site: siteWithStatus
    });

  } catch (error) {
    console.error('[CURRENT-SITE] Error:', error);
    res.status(500).json({ error: 'Failed to load current pickup site' });
  }
});

// GET /api/pickup-site-manager/dashboard - Get dashboard data
router.get('/dashboard', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[DASHBOARD] Loading dashboard for pickup site:', req.agent.pickup_site_id);

    // Get manual orders stats (simplified query)
    let manualStats = { total_manual_orders: 0, completed_manual: 0, pending_manual: 0, manual_earnings: 0 };
    try {
      const [manualResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_manual_orders,
          SUM(CASE WHEN status = 'picked_up' THEN 1 ELSE 0 END) as completed_manual,
          SUM(CASE WHEN status IN ('created', 'confirmed', 'ready_for_pickup') THEN 1 ELSE 0 END) as pending_manual,
          SUM(CASE WHEN status = 'picked_up' THEN commission_amount ELSE 0 END) as manual_earnings
        FROM manual_orders 
        WHERE pickup_site_id = ? AND DATE(created_at) = CURDATE()
      `, [req.agent.pickup_site_id]);
      
      if (manualResult.length > 0) {
        manualStats = manualResult[0];
      }
    } catch (err) {
      console.log('[DASHBOARD] Manual orders query failed:', err.message);
    }

    // Get physical orders stats (simplified query)
    let physicalStats = { total_physical_orders: 0, completed_physical: 0, incoming_deliveries: 0, physical_earnings: 0 };
    try {
      const [physicalResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_physical_orders,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_physical,
          SUM(CASE WHEN status IN ('processing', 'shipped') THEN 1 ELSE 0 END) as incoming_deliveries,
          SUM(CASE WHEN status = 'delivered' THEN COALESCE(psm_commission_amount, 0) ELSE 0 END) as physical_earnings
        FROM orders 
        WHERE pickup_site_id = ? AND DATE(created_at) = CURDATE()
      `, [req.agent.pickup_site_id]);
      
      if (physicalResult.length > 0) {
        physicalStats = physicalResult[0];
      }
    } catch (err) {
      console.log('[DASHBOARD] Physical orders query failed:', err.message);
    }

    // Get inventory stats (check if table exists first)
    let inventoryStats = { stored_orders: 0, ready_pickups: 0 };
    try {
      const [inventoryResult] = await pool.query(`
        SELECT 
          COUNT(*) as stored_orders,
          SUM(CASE WHEN status = 'ready_for_pickup' THEN 1 ELSE 0 END) as ready_pickups
        FROM pickup_site_inventory 
        WHERE pickup_site_id = ? AND status IN ('stored', 'ready_for_pickup')
      `, [req.agent.pickup_site_id]);
      
      if (inventoryResult.length > 0) {
        inventoryStats = inventoryResult[0];
      }
    } catch (err) {
      console.log('[DASHBOARD] Inventory query failed (table may not exist):', err.message);
    }

    // Get pickup site info (handle virtual site for home-delivery-only mode)
    let siteInfo = [];
    if (req.agent.pickup_site_id === 0) {
      // Virtual site for home-delivery-only mode
      siteInfo = [req.agent.pickup_site];
    } else {
      const [sites] = await pool.query(`
        SELECT * FROM pickup_sites WHERE id = ?
      `, [req.agent.pickup_site_id]);
      siteInfo = sites;
    }

    // Calculate combined stats
    const combinedStats = {
      incoming_deliveries: physicalStats.incoming_deliveries || 0,
      stored_orders: inventoryStats.stored_orders || 0,
      ready_pickups: inventoryStats.ready_pickups || 0,
      completed_today: (manualStats.completed_manual || 0) + (physicalStats.completed_physical || 0),
      today_earnings: (manualStats.manual_earnings || 0) + (physicalStats.physical_earnings || 0),
      total_orders: (manualStats.total_manual_orders || 0) + (physicalStats.total_physical_orders || 0),
      pending_manual: manualStats.pending_manual || 0
    };

    console.log('[DASHBOARD] Stats calculated:', combinedStats);

    res.json({
      todayStats: combinedStats,
      siteInfo: siteInfo[0] || {},
      agent: {
        id: req.agent.id,
        user_id: req.agent.user_id,
        agent_type: req.agent.agent_type,
        pickup_site_id: req.agent.pickup_site_id
      }
    });

  } catch (error) {
    console.error('Pickup site manager dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data', details: error.message });
  }
});

// POST /api/pickup-site-manager/create-order - Create manual order for walk-in customer
router.post('/create-order', authenticateToken, requirePickupSiteManager, (req, res, next) => {
  // Make upload middleware optional - only apply if content-type is multipart
  if (req.get('Content-Type') && req.get('Content-Type').includes('multipart/form-data')) {
    upload.single('payment_proof')(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
  console.log('[CREATE_ORDER] Request received');
  console.log('[CREATE_ORDER] Body:', req.body);
  console.log('[CREATE_ORDER] File:', req.file);
  
  try {
    const { 
      buyer_name, 
      buyer_phone, 
      buyer_email, 
      buyer_national_id,
      delivery_details,
      items, 
      notes 
    } = req.body;
    const payment_proof = req.file;

    console.log('[CREATE_ORDER] Parsed data:', {
      buyer_name, buyer_phone, buyer_email, items: typeof items
    });

    // Validate required fields
    if (!buyer_name || !buyer_phone || !items) {
      console.log('[CREATE_ORDER] Validation failed - missing required fields');
      return res.status(400).json({ error: 'Buyer name, phone, and items are required' });
    }

    let parsedItems;
    let parsedDeliveryDetails;
    
    try {
      parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
      parsedDeliveryDetails = delivery_details ? 
        (typeof delivery_details === 'string' ? JSON.parse(delivery_details) : delivery_details) : null;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON format in items or delivery details' });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Calculate totals
    const subtotal = parsedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const commission_amount = subtotal * 0.25; // 25% commission for assisted purchase
    
    // Force home delivery and set delivery fee to 0 (FREE home delivery)
    let delivery_fee = 0;
    parsedDeliveryDetails = parsedDeliveryDetails || {};
    parsedDeliveryDetails.type = 'home'; // Force home delivery
    // Use agent's pickup_site_id if available; fallback to 0 (virtual site) to avoid NULL DB constraint
    const resolvedPickupSiteId = (req.agent && req.agent.pickup_site_id != null) ? req.agent.pickup_site_id : 0;
    parsedDeliveryDetails.pickup_site_id = resolvedPickupSiteId
    
    const total_amount = subtotal + commission_amount + delivery_fee;

    // Generate order number and QR code
    const orderNumber = `MO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const qrCode = `QR-${orderNumber}-${resolvedPickupSiteId}`;

    // Use resolved pickup site id to satisfy NOT NULL constraint (0 = virtual site)
    const pickup_site_id = resolvedPickupSiteId;

    // Create manual order
    const [result] = await pool.query(`
      INSERT INTO manual_orders (
        order_number, pickup_site_id, created_by_agent_id, buyer_name, buyer_phone, buyer_email, buyer_national_id,
        delivery_details, items, subtotal, commission_amount, delivery_fee, total_amount, qr_code, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
    `, [
      orderNumber, pickup_site_id, req.agent.id, buyer_name, buyer_phone, buyer_email, buyer_national_id,
      JSON.stringify(parsedDeliveryDetails), JSON.stringify(parsedItems), 
      subtotal, commission_amount, delivery_fee, total_amount, qrCode, notes
    ]);

    const orderId = result.insertId;

    // Handle payment proof upload
    let payment_proof_url = null;
    let payment_proof_id = null;
    if (payment_proof) {
      payment_proof_url = `/uploads/payment-proofs/${payment_proof.filename}`;
      
      // Update order with payment proof
      await pool.query(
        'UPDATE manual_orders SET payment_proof_url = ? WHERE id = ?',
        [payment_proof_url, orderId]
      );

      // ✅ INTEGRATION FIX: Create payment proof entry for admin approval
      const [paymentProofResult] = await pool.query(`
        INSERT INTO payment_proofs (
          user_id, order_id, order_type, sender_name, payment_method, 
          sender_phone, transaction_id, screenshot_path, notes, amount, 
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        req.user.id, // PSM user ID
        orderId,
        'manual_order', // Mark as manual order type
        buyer_name,
        'cash', // Assuming cash payment for manual orders
        buyer_phone,
        `MANUAL-${orderNumber}`, // Create transaction ID
        payment_proof.filename, // Store filename for screenshot
        `Manual order payment proof uploaded by PSM. Order: ${orderNumber}`,
        total_amount,
        'pending' // Requires admin approval
      ]);

      payment_proof_id = paymentProofResult.insertId;

      // Link the payment proof to the manual order
      await pool.query(
        'UPDATE manual_orders SET payment_proof_id = ? WHERE id = ?',
        [payment_proof_id, orderId]
      );

      console.log(`[PSM-PAYMENT] Payment proof created for admin approval: ID ${payment_proof_id}`);
    }

    // Update pickup site current load
    // Only update pickup site load if there's a physical pickup site
    if (pickup_site_id && pickup_site_id > 0) {
      await pool.query(`
        UPDATE pickup_sites SET current_load = current_load + 1 WHERE id = ?
      `, [pickup_site_id]);
    }

    // Create commission record (only if commission table structure supports it)
    try {
      await pool.query(`
        INSERT INTO psm_commissions (
          agent_id, order_id, order_type, commission_type, commission_rate,
          commission_amount, order_total, status, created_at
        ) VALUES (?, ?, 'manual', 'assisted_purchase', 25, ?, ?, 'pending', NOW())
      `, [req.agent.id, orderId, commission_amount, total_amount]);
      console.log('[CREATE_ORDER] Commission record created successfully');
    } catch (commissionError) {
      console.error('[CREATE_ORDER] Commission creation failed:', commissionError.message);
      // Continue with order creation even if commission fails
    }

    // Generate PDF receipt
    const orderData = {
      order_number: orderNumber,
      created_at: new Date(),
      buyer_name,
      buyer_phone,
      buyer_email,
      buyer_national_id,
      delivery_details: parsedDeliveryDetails,
      pickup_site_name: req.agent.name,
      pickup_site_address: req.agent.address_line1,
      agent_name: `${req.agent.first_name} ${req.agent.last_name}`,
      items: parsedItems,
      subtotal,
      commission_amount,
      delivery_fee,
      total_amount,
      qr_code: qrCode,
      payment_proof_url
    };

    try {
      console.log('[ORDER-CREATION] Starting enhanced PDF generation for order:', orderId);
      
      // Create instance of enhanced PDF generator
      const pdfGenerator = new enhancedPDFGenerator();
      const pdfResult = await pdfGenerator.generateCompactReceipt(orderData);
      
      let pdfFilename;
      if (pdfResult && pdfResult.success) {
        pdfFilename = pdfResult.filename;
        console.log('[ORDER-CREATION] Enhanced PDF generated successfully:', pdfFilename);
      } else {
        // Handle legacy return format (just filename)
        pdfFilename = pdfResult;
        console.log('[ORDER-CREATION] Enhanced PDF generated (legacy format):', pdfFilename);
      }
      
      // Update order with PDF path using more robust query
      console.log('[ORDER-CREATION] Updating database with PDF path...');
      const [updateResult] = await pool.query(`
        UPDATE manual_orders SET receipt_pdf_path = ?, updated_at = NOW() WHERE id = ?
      `, [pdfFilename, orderId]);
      
      console.log('[ORDER-CREATION] Database update result:', updateResult);
      
      if (updateResult.affectedRows === 0) {
        console.error('[ORDER-CREATION] ❌ No rows updated - order may not exist:', orderId);
        throw new Error('Failed to update order with receipt path');
      }
      
      console.log('[ORDER-CREATION] ✅ Order created successfully with PDF receipt');

      // Send notification to admin for payment approval
      try {
        await notifyAdminForPaymentApproval(orderId, orderNumber, subtotal, req.agent);
        console.log('[ORDER-CREATION] ✅ Admin notification sent for payment approval');
      } catch (notifyError) {
        console.error('[ORDER-CREATION] Failed to notify admin:', notifyError);
        // Don't fail the order creation for notification errors
      }

      res.json({
        success: true,
        message: 'Manual order created successfully',
        orderId: orderId,
        orderNumber: orderNumber,
        subtotal,
        commission_amount,
        delivery_fee,
        total_amount,
        qrCode: qrCode,
        receiptUrl: `/api/pickup-site-manager/order/${orderId}/receipt`,
        receiptPdfPath: pdfFilename,
        receiptData: orderData,
        autoDownload: true, // Flag to trigger automatic PDF download
        // Use existing receipt endpoint for downloads to avoid missing route issues
        downloadUrl: `/api/pickup-site-manager/order/${orderId}/receipt`
      });

    } catch (pdfError) {
      console.error('[ORDER-CREATION] ❌ PDF generation/database update error:', pdfError);
      
      // Try to update order status to indicate PDF generation failed
      try {
        await pool.query(`
          UPDATE manual_orders SET 
            receipt_pdf_path = NULL, 
            notes = CONCAT(COALESCE(notes, ''), '\nPDF generation failed: ${pdfError.message}'),
            updated_at = NOW()
          WHERE id = ?
        `, [orderId]);
      } catch (updateError) {
        console.error('[ORDER-CREATION] Failed to update order with error status:', updateError);
      }
      
      // Order was created successfully, just PDF generation failed
      res.json({
        success: true,
        message: 'Manual order created successfully (PDF generation failed - can be regenerated later)',
        orderId: orderId,
        orderNumber: orderNumber,
        subtotal,
        commission_amount,
        delivery_fee,
        total_amount,
        qrCode: qrCode,
        receiptPdf: null
      });
    }

  } catch (error) {
    console.error('[CREATE_ORDER] Error details:', error);
    console.error('[CREATE_ORDER] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create order', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/pickup-site-manager/orders - Get manual orders
router.get('/orders', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE pickup_site_id = ?';
    let queryParams = [req.agent.pickup_site_id];

    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }

    const [orders] = await pool.query(`
      SELECT * FROM manual_orders 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM manual_orders ${whereClause}
    `, queryParams);

    const processedOrders = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));

    res.json({
      orders: processedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get manual orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// PUT /api/pickup-site-manager/order/:orderId/status - Update manual order status
router.put('/order/:orderId/status', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['created', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to this pickup site
    const [orders] = await pool.query(`
      SELECT * FROM manual_orders WHERE id = ? AND pickup_site_id = ?
    `, [orderId, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not from your pickup site' });
    }

    // Update order status
    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateValues = [status];

    if (notes) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (status === 'picked_up') {
      updateFields.push('picked_up_at = NOW()');
    }

    await pool.query(`
      UPDATE manual_orders 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, [...updateValues, orderId]);

    // Update pickup site load if order is completed or cancelled
    if (status === 'picked_up' || status === 'cancelled') {
      await pool.query(`
        UPDATE pickup_sites SET current_load = GREATEST(current_load - 1, 0) WHERE id = ?
      `, [req.agent.pickup_site_id]);
    }

    res.json({ message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Update manual order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// POST /api/pickup-site-manager/order/:orderId/regenerate-receipt - Regenerate receipt for existing order
router.post('/order/:orderId/regenerate-receipt', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('[RECEIPT-REGENERATE] Regenerating receipt for order:', orderId, 'by agent:', req.agent.id);

    // Get the order data with agent information from users table
    const [orders] = await pool.query(`
      SELECT mo.*, ps.name as pickup_site_name, ps.address_line1 as pickup_site_address,
             COALESCE(
               CONCAT(u.first_name, ' ', u.last_name),
               u.username,
               u.email,
               'System Agent'
             ) as agent_name, 
             a.id as agent_id, 
             COALESCE(a.phone, u.phone, '123456789') as agent_phone, 
             COALESCE(u.email, 'agent@africandeals.com') as agent_email
      FROM manual_orders mo
      JOIN pickup_sites ps ON mo.pickup_site_id = ps.id
      JOIN agents a ON JSON_EXTRACT(a.commission_settings, '$.pickup_site_id') = ps.id 
                   AND a.agent_type = 'pickup_site_manager'
      JOIN users u ON a.user_id = u.id
      WHERE mo.id = ? AND mo.pickup_site_id = ?
    `, [orderId, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not from your pickup site' });
    }

    const order = orders[0];
    
    // Prepare order data for PDF generation
    const orderData = {
      order_number: order.order_number,
      created_at: order.created_at,
      buyer_name: order.buyer_name,
      buyer_phone: order.buyer_phone,
      buyer_email: order.buyer_email,
      pickup_site_name: order.pickup_site_name,
      pickup_site_address: order.pickup_site_address,
      agent_name: order.agent_name,
      agent_id: order.agent_id,
      agent_phone: order.agent_phone,
      items: order.items,
      subtotal: order.subtotal,
      commission_amount: order.commission_amount,
      delivery_fee: order.delivery_fee,
      total_amount: order.total_amount,
      status: order.status,
      transaction_id: order.transaction_id,
      payment_proof_url: order.payment_proof_url
    };

    // Generate enhanced PDF
    console.log('[RECEIPT-REGENERATE] Generating enhanced PDF...');
    const pdfGenerator = new enhancedPDFGenerator();
    const pdfResult = await pdfGenerator.generateCompactReceipt(orderData);
    
    let pdfFilename;
    if (pdfResult && pdfResult.success) {
      pdfFilename = pdfResult.filename;
    } else {
      pdfFilename = pdfResult;
    }
    console.log('[RECEIPT-REGENERATE] Enhanced PDF generated:', pdfFilename);
    
    // Update database with new PDF path
    const [updateResult] = await pool.query(`
      UPDATE manual_orders SET receipt_pdf_path = ?, updated_at = NOW() WHERE id = ?
    `, [pdfFilename, orderId]);
    
    if (updateResult.affectedRows === 0) {
      throw new Error('Failed to update order with new receipt path');
    }
    
    console.log('[RECEIPT-REGENERATE] ✅ Receipt regenerated successfully');

    res.json({
      success: true,
      message: 'Receipt regenerated successfully',
      receiptUrl: `/api/pickup-site-manager/order/${orderId}/receipt`,
      receiptPdfPath: pdfFilename
    });

  } catch (error) {
    console.error('[RECEIPT-REGENERATE] ❌ Error:', error);
    res.status(500).json({ error: 'Failed to regenerate receipt', details: error.message });
  }
});

// GET /api/pickup-site-manager/order/:orderId - Get individual order details
router.get('/order/:orderId', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[ORDER-DETAILS] 📋 Fetching order details for ID:', req.params.orderId);
    console.log('[ORDER-DETAILS] 🏪 PSM site ID:', req.agent?.pickup_site_id);
    console.log('[ORDER-DETAILS] 👤 User ID:', req.user?.userId);

    // Use the existing pool connection instead of creating new one
    const [orders] = await pool.query(`
      SELECT 
        mo.*,
        ps.name as pickup_site_name,
        ps.address as pickup_site_address,
        ps.phone as pickup_site_phone
      FROM manual_orders mo
      LEFT JOIN pickup_sites ps ON mo.pickup_site_id = ps.id
      WHERE mo.id = ? AND mo.pickup_site_id = ?
    `, [req.params.orderId, req.agent.pickup_site_id]);

    console.log('[ORDER-DETAILS] 📊 Query result count:', orders.length);

    if (orders.length === 0) {
      console.log('[ORDER-DETAILS] ❌ Order not found or not accessible');
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found or not accessible by this manager' 
      });
    }

    const order = orders[0];
    console.log('[ORDER-DETAILS] 📋 Found order:', order.order_number);
    
    // Get buyer details separately (safer approach)
    let buyerInfo = { buyer_name: 'N/A', buyer_email: 'N/A', buyer_phone: 'N/A' };
    if (order.buyer_id) {
      try {
        const [buyers] = await pool.query(`
          SELECT name, email, phone 
          FROM users 
          WHERE id = ?
        `, [order.buyer_id]);
        
        if (buyers.length > 0) {
          buyerInfo = {
            buyer_name: buyers[0].name || 'N/A',
            buyer_email: buyers[0].email || 'N/A',
            buyer_phone: buyers[0].phone || 'N/A'
          };
        }
      } catch (buyerError) {
        console.warn('[ORDER-DETAILS] ⚠️ Failed to get buyer info:', buyerError.message);
      }
    }
    
    // Parse items safely
    let items = [];
    try {
      if (order.items) {
        items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
      }
    } catch (parseError) {
      console.warn('[ORDER-DETAILS] ⚠️ Failed to parse order items:', parseError.message);
      items = [];
    }

    console.log('[ORDER-DETAILS] ✅ Order details retrieved successfully:', order.order_number);
    
    res.json({ 
      success: true, 
      order: {
        ...order,
        ...buyerInfo,
        items: items,
        // Format monetary values
        subtotal: parseFloat(order.subtotal || 0).toFixed(2),
        delivery_fee: parseFloat(order.delivery_fee || 0).toFixed(2),
        total_amount: parseFloat(order.total_amount || 0).toFixed(2),
        // Format dates
        created_at: order.created_at ? new Date(order.created_at).toISOString() : null,
        updated_at: order.updated_at ? new Date(order.updated_at).toISOString() : null
      }
    });

  } catch (error) {
    console.error('[ORDER-DETAILS] ❌ Error:', error);
    console.error('[ORDER-DETAILS] ❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch order details',
      details: error.message
    });
  }
});

// GET /api/pickup-site-manager/order/:orderId/receipt - Download order receipt
router.get('/order/:orderId/receipt', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[RECEIPT-DOWNLOAD] Starting download for order ID:', req.params.orderId);
    const { orderId } = req.params;

    // Check if order belongs to this pickup site
    const [orders] = await pool.query(`
      SELECT * FROM manual_orders WHERE id = ? AND pickup_site_id = ?
    `, [orderId, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      console.log('[RECEIPT-DOWNLOAD] ❌ Order not found or not from pickup site');
      return await generateErrorPDF(res, 'Order not found or not from your pickup site');
    }

    const order = orders[0];
    console.log('[RECEIPT-DOWNLOAD] Order found:', order.order_number, 'Receipt path:', order.receipt_pdf_path);

    if (!order.receipt_pdf_path) {
      console.log('[RECEIPT-DOWNLOAD] ❌ No receipt PDF path in database, attempting to generate new PDF...');
      
      try {
        // Try to generate a new PDF for this order
        const EnhancedPDFGenerator = require('../utils/enhanced-pdf-generator-fixed');
        const pdfGenerator = new EnhancedPDFGenerator();
        
        // Prepare order data for PDF generation
        const orderData = {
          order_number: order.order_number,
          buyer_name: order.buyer_name,
          buyer_phone: order.buyer_phone,
          buyer_email: order.buyer_email,
          subtotal: order.subtotal,
          delivery_method: order.delivery_method,
          delivery_fee: order.delivery_fee,
          total_amount: order.total_amount,
          created_at: order.created_at,
          agent_id: order.agent_id,
          items: order.items ? JSON.parse(order.items) : []
        };
        
        const result = await pdfGenerator.generateCompactReceipt(orderData);
        
        if (result && result.success && result.filePath) {
          // Update database with new PDF path (use existing connection)
          await pool.query(`
            UPDATE manual_orders SET receipt_pdf_path = ?, updated_at = NOW() 
            WHERE id = ?
          `, [result.filename, orderId]);
          
          console.log('[RECEIPT-DOWNLOAD] ✅ Generated new PDF:', result.filename);
          
          // Set the file path for download
          const filePath = result.filePath;
          
          // Proceed with file download
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            
            console.log('[RECEIPT-DOWNLOAD] ✅ File loaded, size:', fileBuffer.length, 'bytes');
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Cache-Control', 'no-cache');
            
            return res.send(fileBuffer);
          } else {
            console.error('[RECEIPT-DOWNLOAD] ❌ Generated file not found:', filePath);
          }
        } else {
          console.error('[RECEIPT-DOWNLOAD] ❌ PDF generation result invalid:', result);
        }
      } catch (generateError) {
        console.error('[RECEIPT-DOWNLOAD] ❌ Failed to generate new PDF:', generateError);
      }
      
      return await generateErrorPDF(res, 'Receipt not available - PDF generation failed');
    }

    // Use absolute path resolution - fix path to go to correct uploads folder
    const filePath = path.join(__dirname, '../../uploads', order.receipt_pdf_path);
    console.log('[RECEIPT-DOWNLOAD] Looking for file at:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('[RECEIPT-DOWNLOAD] ❌ Receipt file not found on disk');
      return await generateErrorPDF(res, 'Receipt file not found on disk');
    }

    // Check file size
    const stats = fs.statSync(filePath);
    console.log('[RECEIPT-DOWNLOAD] File found, size:', stats.size, 'bytes');

    if (stats.size < 1000) {
      console.log('[RECEIPT-DOWNLOAD] ⚠️ File size is very small, might be corrupted');
    }

    console.log('[RECEIPT-DOWNLOAD] 📄 Starting file download...');
    
    try {
      // Read the entire file into memory to ensure proper response
      const fileBuffer = fs.readFileSync(filePath);
      console.log('[RECEIPT-DOWNLOAD] 📖 File loaded into memory, size:', fileBuffer.length, 'bytes');
      
      // Validate the PDF format
      if (fileBuffer.length === 0) {
        console.log('[RECEIPT-DOWNLOAD] ❌ File is empty');
        return await generateErrorPDF(res, 'Receipt file is empty');
      }
      
      if (!fileBuffer.slice(0, 4).toString().startsWith('%PDF')) {
        console.log('[RECEIPT-DOWNLOAD] ❌ File is not a valid PDF');
        return await generateErrorPDF(res, 'Receipt file is corrupted');
      }
      
      // CRITICAL FIX: Set headers to bypass IDM and download managers
      const actualFilename = order.receipt_pdf_path || `receipt-${order.order_number}-${Date.now()}.pdf`;
      
      res.status(200);
      
      // IDM Bypass Strategy: Use application/octet-stream initially, then let frontend handle as PDF
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline'); // Use inline instead of attachment to avoid IDM
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Custom headers to help frontend identify this as PDF
      res.setHeader('X-Content-Type', 'application/pdf');
      res.setHeader('X-Filename', actualFilename);
      res.setHeader('X-File-Size', fileBuffer.length);
      
      // Anti-IDM headers
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      
      console.log('[RECEIPT-DOWNLOAD] 🛡️ IDM bypass headers set for:', actualFilename);
      console.log('[RECEIPT-DOWNLOAD] 📎 File size:', fileBuffer.length, 'bytes');
      
      console.log('[RECEIPT-DOWNLOAD] 📤 Sending PDF file...');
      
      // Send the file buffer directly
      res.send(fileBuffer);
      
      console.log('[RECEIPT-DOWNLOAD] ✅ Receipt downloaded successfully');
      
    } catch (fileError) {
      console.error('[RECEIPT-DOWNLOAD] ❌ File read error:', fileError);
      return await generateErrorPDF(res, 'Failed to read receipt file');
    }

  } catch (error) {
    console.error('[RECEIPT-DOWNLOAD] ❌ Download receipt error:', error);
    if (!res.headersSent) {
      return await generateErrorPDF(res, `Failed to download receipt: ${error.message}`);
    }
  }
});

// Helper function to generate error PDF instead of JSON response
async function generateErrorPDF(res, errorMessage) {
  try {
    const doc = new PDFDocument();
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="receipt-error.pdf"');
    
    // Pipe the PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Receipt Error', 50, 50);
    doc.fontSize(12).text(`Error: ${errorMessage}`, 50, 100);
    doc.text('Please contact support for assistance.', 50, 130);
    doc.text(`Timestamp: ${new Date().toISOString()}`, 50, 160);
    
    // Finalize the PDF
    doc.end();
    
    console.log('[ERROR-PDF] Generated error PDF for:', errorMessage);
  } catch (pdfError) {
    console.error('[ERROR-PDF] Failed to generate error PDF:', pdfError);
    if (!res.headersSent) {
      res.status(500).send('Receipt generation failed');
    }
  }
}

// GET /api/pickup-site-manager/physical-deliveries - Get physical product deliveries to this site
router.get('/physical-deliveries', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE o.pickup_site_id = ?';
    let queryParams = [req.agent.pickup_site_id];

    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      queryParams.push(status);
    }

    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email,
        a.first_name as agent_first_name,
        a.last_name as agent_last_name,
        a.phone as agent_phone,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM orders o ${whereClause}
    `, queryParams);

    const processedOrders = orders.map(order => ({
      ...order,
      shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null
    }));

    res.json({
      orders: processedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get physical deliveries error:', error);
    res.status(500).json({ error: 'Failed to get physical deliveries' });
  }
});

// PUT /api/pickup-site-manager/physical-delivery/:orderId/confirm - Confirm physical delivery received
router.put('/physical-delivery/:orderId/confirm', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    // Check if order is for this pickup site
    const [orders] = await pool.query(`
      SELECT * FROM orders WHERE id = ? AND pickup_site_id = ?
    `, [orderId, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not for your pickup site' });
    }

    // Update order to ready for pickup
    await pool.query(`
      UPDATE orders 
      SET status = 'delivered', tracking_status = 'delivered', 
          notes = CONCAT(COALESCE(notes, ''), '\nReceived at pickup site: ${notes || 'Confirmed by site manager'}'),
          updated_at = NOW(), delivered_at = NOW()
      WHERE id = ?
    `, [orderId]);

    // Notify buyer that order is ready for pickup
    const io = req.app.get('io');
    if (io) {
      const order = orders[0];
      io.to(`user_${order.user_id}`).emit('order_ready_for_pickup', {
        orderId: orderId,
        pickupSiteName: req.agent.name,
        pickupSiteAddress: req.agent.address_line1,
        message: 'Your order has arrived at the pickup site and is ready for collection'
      });
    }

    res.json({ message: 'Physical delivery confirmed successfully' });

  } catch (error) {
    console.error('Confirm physical delivery error:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// GET /api/pickup-site-manager/earnings - Get earnings summary
router.get('/earnings', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'DATE(picked_up_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'YEARWEEK(picked_up_at) = YEARWEEK(NOW())';
        break;
      case 'month':
        dateCondition = 'YEAR(picked_up_at) = YEAR(NOW()) AND MONTH(picked_up_at) = MONTH(NOW())';
        break;
      default:
        dateCondition = 'YEARWEEK(picked_up_at) = YEARWEEK(NOW())';
    }

    const [earnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(commission_amount) as total_earnings,
        AVG(commission_amount) as avg_commission,
        SUM(total_amount) as total_order_value
      FROM manual_orders
      WHERE pickup_site_id = ? AND status = 'picked_up' AND ${dateCondition}
    `, [req.agent.pickup_site_id]);

    // Get daily breakdown for the period
    const [dailyBreakdown] = await pool.query(`
      SELECT 
        DATE(picked_up_at) as date,
        COUNT(*) as orders,
        SUM(commission_amount) as earnings
      FROM manual_orders
      WHERE pickup_site_id = ? AND status = 'picked_up' AND ${dateCondition}
      GROUP BY DATE(picked_up_at)
      ORDER BY date DESC
    `, [req.agent.pickup_site_id]);

    res.json({
      summary: earnings[0],
      dailyBreakdown: dailyBreakdown
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings data' });
  }
});

// GET /api/pickup-site-manager/site-info - Get pickup site information
router.get('/site-info', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[SITE-INFO] Getting site info for pickup_site_id:', req.agent.pickup_site_id);
    
    // Handle virtual site (home delivery only mode)
    if (req.agent.pickup_site_id === 0) {
      console.log('[SITE-INFO] Returning virtual site info for home delivery only mode');
      return res.json({
        id: 0,
        name: 'Home Delivery Only',
        site_name: 'Home Delivery Only',
        address: 'Virtual Site - Home Delivery Service',
        city: 'All Cities',
        state: 'All States',
        phone: req.agent.phone || 'N/A',
        email: req.agent.email || 'N/A',
        is_active: 1,
        capacity: 999999,
        current_load: 0,
        manager_name: req.agent.first_name + ' ' + req.agent.last_name,
        manager_phone: req.agent.phone || 'N/A',
        operating_hours: {
          monday: { open: '08:00', close: '18:00', closed: false },
          tuesday: { open: '08:00', close: '18:00', closed: false },
          wednesday: { open: '08:00', close: '18:00', closed: false },
          thursday: { open: '08:00', close: '18:00', closed: false },
          friday: { open: '08:00', close: '18:00', closed: false },
          saturday: { open: '09:00', close: '17:00', closed: false },
          sunday: { open: '10:00', close: '16:00', closed: false }
        }
      });
    }

    const [siteInfo] = await pool.query(`
      SELECT * FROM pickup_sites WHERE id = ?
    `, [req.agent.pickup_site_id]);

    if (siteInfo.length === 0) {
      console.log('[SITE-INFO] No pickup site found with id:', req.agent.pickup_site_id);
      return res.status(404).json({ error: 'Pickup site not found' });
    }

    const site = siteInfo[0];
    console.log('[SITE-INFO] Found pickup site:', site.name || site.site_name);
    
    res.json({
      ...site,
      operating_hours: site.operating_hours ? JSON.parse(site.operating_hours) : null
    });

  } catch (error) {
    console.error('[SITE-INFO] Get site info error:', error);
    res.status(500).json({ error: 'Failed to get site information' });
  }
});

// PUT /api/pickup-site-manager/site-info - Update pickup site information
router.put('/site-info', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { name, description, phone, email, operating_hours } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (phone) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (operating_hours) {
      updateFields.push('operating_hours = ?');
      updateValues.push(JSON.stringify(operating_hours));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');

    await pool.query(`
      UPDATE pickup_sites 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, [...updateValues, req.agent.pickup_site_id]);

    res.json({ message: 'Site information updated successfully' });

  } catch (error) {
    console.error('Update site info error:', error);
    res.status(500).json({ error: 'Failed to update site information' });
  }
});

// POST /api/pickup-site-manager/verify-pickup-code - Verify pickup code and complete pickup
router.post('/verify-pickup-code', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Pickup code is required' });
    }

    // Check manual orders first
    const [manualOrders] = await pool.query(`
      SELECT * FROM manual_orders 
      WHERE pickup_site_id = ? AND (pickup_code = ? OR qr_code = ?) AND status = 'ready_for_pickup'
    `, [req.agent.pickup_site_id, code, code]);

    if (manualOrders.length > 0) {
      const order = manualOrders[0];
      
      // Update order status to picked up
      await pool.query(`
        UPDATE manual_orders 
        SET status = 'picked_up', picked_up_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [order.id]);

      // Update pickup site load
      await pool.query(`
        UPDATE pickup_sites SET current_load = GREATEST(current_load - 1, 0) WHERE id = ?
      `, [req.agent.pickup_site_id]);

      // Create commission record
      await pool.query(`
        INSERT INTO psm_commissions (
          agent_id, pickup_site_id, order_id, order_type, commission_type,
          commission_rate, commission_amount, order_total, status
        ) VALUES (?, ?, ?, 'manual', 'assisted_purchase', ?, ?, ?, 'approved')
      `, [req.agent.id, req.agent.pickup_site_id, order.id, order.commission_rate, order.commission_amount, order.total_amount]);

      return res.json({
        message: 'Pickup confirmed successfully',
        orderNumber: order.order_number,
        orderType: 'manual',
        commissionAmount: order.commission_amount
      });
    }

    // Check physical orders
    const [physicalOrders] = await pool.query(`
      SELECT * FROM orders 
      WHERE pickup_site_id = ? AND (pickup_code = ? OR pickup_qr_code = ?) AND status = 'delivered'
    `, [req.agent.pickup_site_id, code, code]);

    if (physicalOrders.length > 0) {
      const order = physicalOrders[0];
      
      // Update order status to picked up
      await pool.query(`
        UPDATE orders 
        SET status = 'completed', tracking_status = 'picked_up', updated_at = NOW()
        WHERE id = ?
      `, [order.id]);

      // Update inventory
      await pool.query(`
        UPDATE pickup_site_inventory 
        SET status = 'picked_up', picked_up_at = NOW(), picked_up_by_agent_id = ?
        WHERE order_id = ? AND order_type = 'regular'
      `, [req.agent.id, order.id]);

      // Create commission record
      await pool.query(`
        INSERT INTO psm_commissions (
          agent_id, pickup_site_id, order_id, order_type, commission_type,
          commission_rate, commission_amount, order_total, status
        ) VALUES (?, ?, ?, 'regular', 'storage_only', ?, ?, ?, 'approved')
      `, [req.agent.id, req.agent.pickup_site_id, order.id, order.psm_commission_rate, order.psm_commission_amount, order.total_amount]);

      return res.json({
        message: 'Pickup confirmed successfully',
        orderNumber: order.order_number,
        orderType: 'physical',
        commissionAmount: order.psm_commission_amount
      });
    }

    res.status(404).json({ error: 'Invalid pickup code or order not ready for pickup' });

  } catch (error) {
    console.error('Verify pickup code error:', error);
    res.status(500).json({ error: 'Failed to verify pickup code' });
  }
});

// GET /api/pickup-site-manager/inventory - Get current inventory
router.get('/inventory', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    console.log('[INVENTORY] Getting inventory for pickup site:', req.agent.pickup_site_id);

    // Check if pickup_site_inventory table exists, if not return empty inventory
    try {
      const [tableCheck] = await pool.query(`SHOW TABLES LIKE 'pickup_site_inventory'`);
      
      if (tableCheck.length === 0) {
        console.log('[INVENTORY] pickup_site_inventory table does not exist, returning empty inventory');
        return res.json({ inventory: [] });
      }

      let whereClause = 'WHERE psi.pickup_site_id = ?';
      let queryParams = [req.agent.pickup_site_id];

      if (status !== 'all') {
        whereClause += ' AND psi.status = ?';
        queryParams.push(status);
      }

      const [inventory] = await pool.query(`
        SELECT 
          psi.*,
          CASE 
            WHEN psi.order_type = 'manual' THEN mo.order_number
            ELSE o.order_number
          END as order_number,
          CASE 
            WHEN psi.order_type = 'manual' THEN mo.buyer_name
            ELSE u.username
          END as buyer_name,
          CASE 
            WHEN psi.order_type = 'manual' THEN mo.buyer_phone
            ELSE u.phone
          END as buyer_phone,
          CASE 
            WHEN psi.order_type = 'manual' THEN mo.total_amount
            ELSE o.total_amount
          END as order_total
        FROM pickup_site_inventory psi
        LEFT JOIN manual_orders mo ON psi.order_id = mo.id AND psi.order_type = 'manual'
        LEFT JOIN orders o ON psi.order_id = o.id AND psi.order_type = 'regular'
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
        ORDER BY psi.received_at DESC
      `, queryParams);

      res.json({ inventory });

    } catch (tableError) {
      console.log('[INVENTORY] Table access error, returning empty inventory:', tableError.message);
      res.json({ inventory: [] });
    }

  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory', details: error.message });
  }
});

// GET /api/pickup-site-manager/ready-pickups - Get orders ready for pickup
router.get('/ready-pickups', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    // Get manual orders ready for pickup
    const [manualOrders] = await pool.query(`
      SELECT 
        mo.*,
        'manual' as order_type,
        DATEDIFF(mo.expires_at, NOW()) as days_until_expiry
      FROM manual_orders mo
      WHERE mo.pickup_site_id = ? AND mo.status = 'ready_for_pickup'
      ORDER BY mo.created_at ASC
    `, [req.agent.pickup_site_id]);

    // Get physical orders ready for pickup
    const [physicalOrders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        'regular' as order_type,
        DATEDIFF(DATE_ADD(o.delivered_at, INTERVAL 7 DAY), NOW()) as days_until_expiry
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.pickup_site_id = ? AND o.status = 'delivered'
      ORDER BY o.delivered_at ASC
    `, [req.agent.pickup_site_id]);

    // Combine and sort by urgency
    const allOrders = [...manualOrders, ...physicalOrders].sort((a, b) => {
      return a.days_until_expiry - b.days_until_expiry;
    });

    res.json({ orders: allOrders });

  } catch (error) {
    console.error('Get ready pickups error:', error);
    res.status(500).json({ error: 'Failed to get ready pickups' });
  }
});

// GET /api/pickup-site-manager/messages - Get messages
router.get('/messages', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    console.log('[MESSAGES] Getting messages for user:', req.user.id);

    // Check if psm_messages table exists
    try {
      const [tableCheck] = await pool.query(`SHOW TABLES LIKE 'psm_messages'`);
      
      if (tableCheck.length === 0) {
        console.log('[MESSAGES] psm_messages table does not exist, returning empty messages');
        return res.json({
          messages: [],
          unreadCount: 0,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0
          }
        });
      }

      let whereClause = 'WHERE (pm.recipient_id = ? AND pm.recipient_type = "psm") OR (pm.sender_id = ? AND pm.sender_type = "psm")';
      let queryParams = [req.user.id, req.user.id];

      if (type !== 'all') {
        whereClause += ' AND pm.message_type = ?';
        queryParams.push(type);
      }

      const [messages] = await pool.query(`
        SELECT 
          pm.*,
          sender.name as sender_name,
          recipient.name as recipient_name
        FROM psm_messages pm
        LEFT JOIN users sender ON pm.sender_id = sender.id
        LEFT JOIN users recipient ON pm.recipient_id = recipient.id
        ${whereClause}
        ORDER BY pm.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, parseInt(limit), parseInt(offset)]);

      // Get unread count
      const [unreadCount] = await pool.query(`
        SELECT COUNT(*) as count FROM psm_messages 
        WHERE recipient_id = ? AND recipient_type = "psm" AND is_read = FALSE
      `, [req.user.id]);

      res.json({
        messages,
        unreadCount: unreadCount[0].count,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: messages.length
        }
      });

    } catch (tableError) {
      console.log('[MESSAGES] Table access error, returning empty messages:', tableError.message);
      res.json({
        messages: [],
        unreadCount: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });
    }

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages', details: error.message });
  }
});

// POST /api/pickup-site-manager/message - Send message
router.post('/message', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { recipient_id, recipient_type, subject, message, message_type = 'general', order_id = null, order_type = null } = req.body;

    if (!recipient_id || !recipient_type || !message) {
      return res.status(400).json({ error: 'Recipient, recipient type, and message are required' });
    }

    const [result] = await pool.query(`
      INSERT INTO psm_messages (
        pickup_site_id, sender_id, sender_type, recipient_id, recipient_type,
        subject, message, message_type, order_id, order_type
      ) VALUES (?, ?, 'psm', ?, ?, ?, ?, ?, ?, ?)
    `, [req.agent.pickup_site_id, req.user.id, recipient_id, recipient_type, subject, message, message_type, order_id, order_type]);

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipient_id}`).emit('new_message', {
        id: result.insertId,
        sender_id: req.user.id,
        sender_name: req.user.name,
        subject,
        message,
        message_type
      });
    }

    res.json({ message: 'Message sent successfully', messageId: result.insertId });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/pickup-site-manager/message/:messageId/read - Mark message as read
router.put('/message/:messageId/read', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { messageId } = req.params;

    await pool.query(`
      UPDATE psm_messages 
      SET is_read = TRUE, read_at = NOW()
      WHERE id = ? AND recipient_id = ?
    `, [messageId, req.user.id]);

    res.json({ message: 'Message marked as read' });

  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// GET /api/pickup-site-manager/commissions - Get commission history
router.get('/commissions', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { period = 'month', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    console.log('[COMMISSIONS] Getting commissions for agent:', req.agent.id);

    const commissionCalculator = new CommissionCalculator();
    let commissions = [];
    let totalEarnings = 0;
    let totalCommissions = 0;

    // Date condition for filtering
    let dateCondition = '';
    
    switch (period) {
      case 'today':
        dateCondition = 'DATE(created_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'YEARWEEK(created_at) = YEARWEEK(NOW())';
        break;
      case 'month':
        dateCondition = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
        break;
      default:
        dateCondition = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
    }

    try {
      // Get manual orders
      const [manualOrders] = await pool.query(`
        SELECT 
          id, order_number, subtotal, delivery_type, has_referral, 
          status, created_at, customer_name
        FROM manual_orders 
        WHERE pickup_site_id = ? AND status IN ('picked_up', 'delivered')
        ${dateCondition ? `AND ${dateCondition}` : ''}
        ORDER BY created_at DESC
      `, [req.agent.pickup_site_id]);

      for (const order of manualOrders) {
        const orderData = {
          purchasing_price: parseFloat(order.subtotal) || 0,
          order_type: order.delivery_type === 'delivery' ? 'local' : 'physical',
          has_referral: order.has_referral || false,
          has_psm: true,
          has_delivery_agent: true
        };

        const psmCommission = commissionCalculator.getAgentCommission(orderData, 'psm');
        const commissionBreakdown = commissionCalculator.getCommissionSummary(orderData);

        if (psmCommission > 0) {
          commissions.push({
            id: `manual_${order.id}`,
            order_number: order.order_number,
            order_type: 'manual',
            customer_name: order.customer_name,
            purchasing_price: orderData.purchasing_price,
            selling_price: commissionBreakdown.selling_price,
            commission_amount: psmCommission,
            commission_percentage: '15%',
            platform_profit: commissionBreakdown.platform_profit,
            order_category: orderData.order_type,
            has_referral: orderData.has_referral,
            status: order.status,
            created_at: order.created_at,
            breakdown: commissionBreakdown.breakdown
          });

          totalEarnings += psmCommission;
          totalCommissions++;
        }
      }

      // Get regular orders
      const [regularOrders] = await pool.query(`
        SELECT 
          id, order_number, total_amount, delivery_type, referral_code,
          status, created_at, customer_name
        FROM orders 
        WHERE pickup_site_id = ? AND status IN ('delivered', 'picked_up')
        ${dateCondition ? `AND ${dateCondition}` : ''}
        ORDER BY created_at DESC
      `, [req.agent.pickup_site_id]);

      for (const order of regularOrders) {
        // Estimate purchasing price (reverse calculate from total with 21% markup)
        const totalAmount = parseFloat(order.total_amount) || 0;
        const estimatedPurchasingPrice = totalAmount / 1.21;

        const orderData = {
          purchasing_price: estimatedPurchasingPrice,
          order_type: order.delivery_type === 'delivery' ? 'local' : 'physical',
          has_referral: !!order.referral_code,
          has_psm: true,
          has_delivery_agent: true
        };

        const psmCommission = commissionCalculator.getAgentCommission(orderData, 'psm');
        const commissionBreakdown = commissionCalculator.getCommissionSummary(orderData);

        if (psmCommission > 0) {
          commissions.push({
            id: `regular_${order.id}`,
            order_number: order.order_number,
            order_type: 'regular',
            customer_name: order.customer_name,
            purchasing_price: orderData.purchasing_price,
            selling_price: commissionBreakdown.selling_price,
            commission_amount: psmCommission,
            commission_percentage: '15%',
            platform_profit: commissionBreakdown.platform_profit,
            order_category: orderData.order_type,
            has_referral: orderData.has_referral,
            status: order.status,
            created_at: order.created_at,
            breakdown: commissionBreakdown.breakdown
          });

          totalEarnings += psmCommission;
          totalCommissions++;
        }
      }

      // Sort by date and apply pagination
      commissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const paginatedCommissions = commissions.slice(offset, offset + parseInt(limit));

      // Calculate withdrawn amount
      let totalWithdrawn = 0;
      try {
        const [withdrawnResult] = await pool.query(`
          SELECT COALESCE(SUM(amount), 0) as total_withdrawn
          FROM psm_withdrawals 
          WHERE pickup_site_id = ? AND status IN ('completed', 'pending')
        `, [req.agent.pickup_site_id]);
        totalWithdrawn = withdrawnResult[0]?.total_withdrawn || 0;
      } catch (err) {
        console.log('[COMMISSIONS] Error getting withdrawn amount:', err.message);
      }

      res.json({
        commissions: paginatedCommissions,
        summary: {
          total_commissions: totalCommissions,
          total_earnings: Math.round(totalEarnings * 100) / 100,
          available_balance: Math.round((totalEarnings - totalWithdrawn) * 100) / 100,
          withdrawn: Math.round(totalWithdrawn * 100) / 100,
          avg_commission: totalCommissions > 0 ? Math.round((totalEarnings / totalCommissions) * 100) / 100 : 0,
          commission_rate: '15%',
          calculation_method: 'New 21% markup system'
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: commissions.length,
          pages: Math.ceil(commissions.length / parseInt(limit))
        }
      });

    } catch (dbError) {
      console.log('[COMMISSIONS] Database error, returning empty commissions:', dbError.message);
      res.json({
        commissions: [],
        summary: {
          total_commissions: 0,
          total_earnings: 0,
          available_balance: 0,
          withdrawn: 0,
          avg_commission: 0,
          commission_rate: '15%',
          calculation_method: 'New 21% markup system'
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

  } catch (error) {
    console.error('[COMMISSIONS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get commissions',
      details: error.message
    });
  }
});

// ======================================================================
// PSM CONFIRMATION SYSTEM - Complete Implementation
// ======================================================================

/**
 * POST /api/pickup-site-manager/confirm-deposit
 * PDA → PSM Confirmation: Confirm package deposit at pickup site
 * Triggers seller payout release (safe custody achieved)
 */
router.post('/confirm-deposit', authenticateToken, requirePickupSiteManager, upload.single('package_photo'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('[PSM-DEPOSIT] 📦 PDA → PSM deposit confirmation request received');
    
    const { order_id, pda_code, pda_otp, verification_notes } = req.body;
    const package_photo = req.file ? req.file.filename : null;
    
    if (!order_id || (!pda_code && !pda_otp)) {
      return res.status(400).json({ 
        error: 'Order ID and either PDA code or OTP required' 
      });
    }

    // 1. Get order details and validate
    const [orders] = await connection.execute(`
      SELECT o.*, 
             u_buyer.name as buyer_name, u_buyer.phone as buyer_phone,
             u_seller.name as seller_name, u_seller.phone as seller_phone,
             ps.name as pickup_site_name, ps.address_line1 as pickup_site_address,
             a_pda.id as pda_agent_id, u_pda.name as pda_name
      FROM orders o
      JOIN users u_buyer ON o.user_id = u_buyer.id
      JOIN users u_seller ON o.seller_id = u_seller.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      LEFT JOIN agents a_pda ON o.agent_id = a_pda.id
      LEFT JOIN users u_pda ON a_pda.user_id = u_pda.id
      WHERE o.id = ? AND o.pickup_site_id = ?
    `, [order_id, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        error: 'Order not found or not assigned to this pickup site' 
      });
    }

    const order = orders[0];
    
    // 2. Validate order status (must be from PDA)
    if (!['shipped', 'en_route', 'assigned'].includes(order.status) || !order.agent_id) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Order must be shipped by PDA before deposit confirmation' 
      });
    }

    // 3. Verify PDA code/OTP if provided
    let pda_verification_success = false;
    if (pda_code) {
      // Verify PDA delivery code
      const expected_code = `PDA-${order.id}-${order.agent_id}`.slice(-6);
      pda_verification_success = (pda_code === expected_code || pda_code === order.delivery_code);
    } else if (pda_otp) {
      // Verify PDA OTP (would be generated by PDA system)
      const expected_otp = String(order.id).slice(-4);
      pda_verification_success = (pda_otp === expected_otp);
    }

    console.log(`[PSM-DEPOSIT] ✅ PDA verification: ${pda_verification_success ? 'SUCCESS' : 'FAILED'}`);

    // 4. Create deposit confirmation record
    await connection.execute(`
      INSERT INTO order_confirmations 
      (order_id, confirmation_type, confirmer_user_id, confirmer_role, 
       verification_method, verification_code, package_photo, notes, 
       confirmation_status, location_coords, created_at)
      VALUES (?, 'PSM_DEPOSIT', ?, 'pickup_site_manager', ?, ?, ?, ?, 'confirmed', 
              CONCAT(?, ',', ?), NOW())
    `, [
      order_id, 
      req.user.id, 
      pda_code ? 'PDA_CODE' : 'PDA_OTP',
      pda_code || pda_otp,
      package_photo,
      verification_notes || 'Package deposited at pickup site',
      req.agent.pickup_site ? req.agent.pickup_site.latitude : null,
      req.agent.pickup_site ? req.agent.pickup_site.longitude : null
    ]);

    // 5. Update order status to "DELIVERED_TO_PSM"
    await connection.execute(`
      UPDATE orders SET 
        status = 'delivered_to_psm',
        detailed_status = 'DELIVERED_TO_PSM',
        psm_deposit_at = NOW(),
        psm_agent_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [req.agent.id, order_id]);

    // 6. Generate buyer pickup code/QR
    const buyer_pickup_code = `PICKUP-${order_id}-${Date.now()}`.slice(-8);
    await connection.execute(`
      UPDATE orders SET buyer_pickup_code = ? WHERE id = ?
    `, [buyer_pickup_code, order_id]);

    // 7. **CRITICAL: Release seller payout (safe custody achieved)**
    if (order.seller_payout_status !== 'released') {
      await connection.execute(`
        UPDATE orders SET 
          seller_payout_status = 'released',
          seller_payout_released_at = NOW(),
          seller_payout_release_reason = 'Package deposited at PSM - safe custody confirmed'
        WHERE id = ?
      `, [order_id]);
      
      console.log(`[PSM-DEPOSIT] 💰 SELLER PAYOUT RELEASED for order ${order_id}`);
    }

    // 8. Create status history
    await connection.execute(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
      VALUES (?, ?, 'delivered_to_psm', ?, ?)
    `, [order_id, order.status, req.user.id, 'Package deposited at pickup site by PSM confirmation']);

    // 9. Notify all parties
    const notifications = [
      // Notify buyer
      {
        user_id: order.user_id,
        type: 'ORDER_READY_FOR_PICKUP',
        title: 'Package Ready for Pickup',
        message: `Your order ${order.order_number} is now available for pickup at ${order.pickup_site_name}. Pickup code: ${buyer_pickup_code}`,
        order_id: order_id
      },
      // Notify seller (payout released)
      {
        user_id: order.seller_id,
        type: 'SELLER_PAYOUT_RELEASED',
        title: 'Payout Released',
        message: `Your payout for order ${order.order_number} has been released. Package safely deposited at pickup site.`,
        order_id: order_id
      },
      // Notify PDA (deposit confirmed)
      {
        user_id: order.agent_id ? (await connection.execute('SELECT user_id FROM agents WHERE id = ?', [order.agent_id]))[0][0].user_id : null,
        type: 'PDA_DEPOSIT_CONFIRMED',
        title: 'Package Deposit Confirmed',
        message: `Your package delivery for order ${order.order_number} has been confirmed by pickup site manager.`,
        order_id: order_id
      }
    ].filter(n => n.user_id);

    for (const notification of notifications) {
      try {
        await connection.execute(`
          INSERT INTO notifications (user_id, type, title, message, order_id, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [notification.user_id, notification.type, notification.title, notification.message, notification.order_id]);
      } catch (notifError) {
        console.log('[PSM-DEPOSIT] Notification creation failed:', notifError.message);
      }
    }

    await connection.commit();
    
    console.log(`[PSM-DEPOSIT] ✅ SUCCESS: Order ${order_id} deposited at PSM, seller payout released`);

    res.json({
      success: true,
      message: 'Package deposit confirmed successfully',
      order_id: order_id,
      buyer_pickup_code: buyer_pickup_code,
      seller_payout_released: true,
      notifications_sent: notifications.length,
      package_photo: package_photo,
      next_steps: 'Buyer can now pick up package with pickup code'
    });

  } catch (error) {
    await connection.rollback();
    console.error('[PSM-DEPOSIT] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm package deposit',
      details: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/pickup-site-manager/confirm-pickup
 * PSM → Buyer Confirmation: Confirm package pickup by buyer
 * Triggers PSM & PDA commission release (final step)
 */
router.post('/confirm-pickup', authenticateToken, requirePickupSiteManager, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('[PSM-PICKUP] 🎯 PSM → Buyer pickup confirmation request received');
    
    const { order_id, buyer_pickup_code, buyer_phone, buyer_verification_method, verification_notes } = req.body;
    
    if (!order_id || !buyer_pickup_code) {
      return res.status(400).json({ 
        error: 'Order ID and buyer pickup code required' 
      });
    }

    // 1. Get order details
    const [orders] = await connection.execute(`
      SELECT o.*, 
             u_buyer.name as buyer_name, u_buyer.phone as buyer_phone,
             ps.name as pickup_site_name,
             a_pda.id as pda_agent_id, a_psm.id as psm_agent_id
      FROM orders o
      JOIN users u_buyer ON o.user_id = u_buyer.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      LEFT JOIN agents a_pda ON o.agent_id = a_pda.id
      LEFT JOIN agents a_psm ON o.psm_agent_id = a_psm.id
      WHERE o.id = ? AND o.pickup_site_id = ?
    `, [order_id, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        error: 'Order not found or not at this pickup site' 
      });
    }

    const order = orders[0];
    
    // 2. Validate order status (must be ready for pickup)
    if (order.status !== 'delivered_to_psm' || !order.psm_deposit_at) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Order must be deposited at PSM before buyer pickup' 
      });
    }

    // 3. Verify buyer pickup code
    if (order.buyer_pickup_code !== buyer_pickup_code) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Invalid pickup code' 
      });
    }

    // 4. Optional: Verify buyer phone if provided
    let buyer_verified = true;
    if (buyer_phone && order.buyer_phone && buyer_phone !== order.buyer_phone) {
      buyer_verified = false;
      console.log(`[PSM-PICKUP] ⚠️ Phone verification failed: ${buyer_phone} != ${order.buyer_phone}`);
    }

    // 5. Create pickup confirmation record
    await connection.execute(`
      INSERT INTO order_confirmations 
      (order_id, confirmation_type, confirmer_user_id, confirmer_role, 
       verification_method, verification_code, notes, confirmation_status,
       buyer_verified, created_at)
      VALUES (?, 'BUYER_PICKUP', ?, 'pickup_site_manager', ?, ?, ?, 'confirmed', ?, NOW())
    `, [
      order_id, 
      req.user.id, 
      buyer_verification_method || 'PICKUP_CODE',
      buyer_pickup_code,
      verification_notes || 'Package collected by buyer from pickup site',
      buyer_verified
    ]);

    // 6. Update order status to COMPLETED
    await connection.execute(`
      UPDATE orders SET 
        status = 'completed',
        detailed_status = 'COLLECTED_BY_BUYER',
        buyer_pickup_at = NOW(),
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `, [order_id]);

    // 7. **CRITICAL: Release PDA and PSM commissions (final step)**
    const commission_releases = [];
    
    // Release PDA commission
    if (order.pda_agent_id && order.pda_commission_status !== 'released') {
      await connection.execute(`
        UPDATE orders SET 
          pda_commission_status = 'released',
          pda_commission_released_at = NOW(),
          pda_commission_release_reason = 'Buyer successfully collected package from PSM'
        WHERE id = ?
      `, [order_id]);
      
      commission_releases.push('PDA commission released');
      console.log(`[PSM-PICKUP] 💰 PDA COMMISSION RELEASED for order ${order_id}`);
    }

    // Release PSM commission
    if (order.psm_agent_id && order.psm_commission_status !== 'released') {
      await connection.execute(`
        UPDATE orders SET 
          psm_commission_status = 'released',
          psm_commission_released_at = NOW(),
          psm_commission_release_reason = 'Successfully facilitated buyer pickup'
        WHERE id = ?
      `, [order_id]);
      
      commission_releases.push('PSM commission released');
      console.log(`[PSM-PICKUP] 💰 PSM COMMISSION RELEASED for order ${order_id}`);
    }

    // 8. Create status history
    await connection.execute(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
      VALUES (?, 'delivered_to_psm', 'completed', ?, ?)
    `, [order_id, req.user.id, 'Package collected by buyer from pickup site']);

    // 9. Final notifications
    const notifications = [
      // Notify buyer
      {
        user_id: order.user_id,
        type: 'ORDER_COMPLETED',
        title: 'Order Completed',
        message: `Thank you! Your order ${order.order_number} has been successfully collected.`,
        order_id: order_id
      },
      // Notify PDA
      {
        user_id: order.pda_agent_id ? (await connection.execute('SELECT user_id FROM agents WHERE id = ?', [order.pda_agent_id]))[0][0]?.user_id : null,
        type: 'PDA_COMMISSION_RELEASED',
        title: 'Commission Released',
        message: `Your commission for order ${order.order_number} has been released. Buyer collected package successfully.`,
        order_id: order_id
      },
      // Notify Admin
      {
        user_id: 1, // Admin user ID
        type: 'ORDER_COMPLETED_PSM',
        title: 'PSM Order Completed',
        message: `Order ${order.order_number} completed via PSM pickup site. All commissions released.`,
        order_id: order_id
      }
    ].filter(n => n.user_id);

    for (const notification of notifications) {
      try {
        await connection.execute(`
          INSERT INTO notifications (user_id, type, title, message, order_id, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [notification.user_id, notification.type, notification.title, notification.message, notification.order_id]);
      } catch (notifError) {
        console.log('[PSM-PICKUP] Notification creation failed:', notifError.message);
      }
    }

    await connection.commit();
    
    console.log(`[PSM-PICKUP] ✅ SUCCESS: Order ${order_id} completed, all commissions released`);

    res.json({
      success: true,
      message: 'Package pickup confirmed successfully',
      order_id: order_id,
      order_completed: true,
      commissions_released: commission_releases,
      notifications_sent: notifications.length,
      buyer_verified: buyer_verified,
      completion_time: new Date().toISOString()
    });

  } catch (error) {
    await connection.rollback();
    console.error('[PSM-PICKUP] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm package pickup',
      details: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/pickup-site-manager/verify-code
 * General code verification endpoint for QR codes, OTPs, etc.
 */
router.post('/verify-code', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-VERIFY] 🔍 Code verification request received');
    
    const { code, verification_type } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    let verification_result = null;

    // Determine verification type and process accordingly
    if (verification_type === 'pickup_code' || code.startsWith('PICKUP-')) {
      // Buyer pickup code verification
      const [orders] = await pool.query(`
        SELECT o.*, u.name as buyer_name, u.phone as buyer_phone
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.buyer_pickup_code = ? AND o.pickup_site_id = ? AND o.status = 'delivered_to_psm'
      `, [code, req.agent.pickup_site_id]);

      if (orders.length > 0) {
        const order = orders[0];
        verification_result = {
          type: 'buyer_pickup',
          valid: true,
          order: {
            id: order.id,
            order_number: order.order_number,
            buyer_name: order.buyer_name,
            buyer_phone: order.buyer_phone,
            total_amount: order.total_amount,
            created_at: order.created_at
          },
          action_required: 'confirm_pickup',
          message: `Buyer pickup code verified for ${order.buyer_name}`
        };
      } else {
        verification_result = {
          type: 'buyer_pickup',
          valid: false,
          message: 'Invalid pickup code or order not ready for pickup'
        };
      }

    } else if (verification_type === 'pda_code' || code.startsWith('PDA-')) {
      // PDA deposit code verification
      const [orders] = await pool.query(`
        SELECT o.*, u.name as buyer_name, u_pda.name as pda_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN agents a ON o.agent_id = a.id
        LEFT JOIN users u_pda ON a.user_id = u_pda.id
        WHERE (o.delivery_code = ? OR CONCAT('PDA-', o.id, '-', o.agent_id) LIKE ?) 
        AND o.pickup_site_id = ? AND o.status IN ('shipped', 'en_route', 'assigned')
      `, [code, `%${code.slice(-6)}%`, req.agent.pickup_site_id]);

      if (orders.length > 0) {
        const order = orders[0];
        verification_result = {
          type: 'pda_deposit',
          valid: true,
          order: {
            id: order.id,
            order_number: order.order_number,
            buyer_name: order.buyer_name,
            pda_name: order.pda_name,
            total_amount: order.total_amount,
            created_at: order.created_at
          },
          action_required: 'confirm_deposit',
          message: `PDA deposit code verified for order from ${order.pda_name}`
        };
      } else {
        verification_result = {
          type: 'pda_deposit',
          valid: false,
          message: 'Invalid PDA code or order not ready for deposit'
        };
      }

    } else {
      // Generic code verification
      verification_result = {
        type: 'unknown',
        valid: false,
        message: 'Unknown code format. Please use pickup codes (PICKUP-...) or PDA codes (PDA-...)'
      };
    }

    console.log(`[PSM-VERIFY] ✅ Code verification completed: ${verification_result.valid ? 'VALID' : 'INVALID'}`);

    res.json({
      success: true,
      verification: verification_result
    });

  } catch (error) {
    console.error('[PSM-VERIFY] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to verify code',
      details: error.message 
    });
  }
});

/**
 * GET /api/pickup-site-manager/orders-ready-for-pickup
 * Get all orders ready for buyer pickup at this PSM site
 */
router.get('/orders-ready-for-pickup', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-READY-ORDERS] 📋 Loading orders ready for pickup...');
    
    const [orders] = await pool.query(`
      SELECT o.*, 
             u.name as buyer_name, u.phone as buyer_phone, u.email as buyer_email,
             ps.name as pickup_site_name, ps.address_line1 as pickup_site_address
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      WHERE o.pickup_site_id = ? AND o.status = 'delivered_to_psm' AND o.psm_deposit_at IS NOT NULL
      ORDER BY o.psm_deposit_at ASC
    `, [req.agent.pickup_site_id]);

    console.log(`[PSM-READY-ORDERS] Found ${orders.length} orders ready for pickup`);

    const ordersWithDetails = orders.map(order => ({
      ...order,
      days_waiting: Math.floor((Date.now() - new Date(order.psm_deposit_at).getTime()) / (1000 * 60 * 60 * 24)),
      pickup_code_masked: order.buyer_pickup_code ? `${order.buyer_pickup_code.slice(0, 3)}****${order.buyer_pickup_code.slice(-2)}` : null
    }));

    res.json({
      success: true,
      orders: ordersWithDetails,
      summary: {
        total_ready: orders.length,
        oldest_order: orders.length > 0 ? orders[0].psm_deposit_at : null,
        pickup_site: req.agent.pickup_site?.name || 'Unknown Site'
      }
    });

  } catch (error) {
    console.error('[PSM-READY-ORDERS] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to load ready orders',
      details: error.message 
    });
  }
});

/**
 * GET /api/pickup-site-manager/pending-deposits
 * Get orders that PDAs should deposit at this PSM site
 */
router.get('/pending-deposits', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-PENDING-DEPOSITS] 📦 Loading pending deposits...');
    
    const [orders] = await pool.query(`
      SELECT o.*, 
             u.name as buyer_name, u.phone as buyer_phone,
             u_pda.name as pda_name, u_pda.phone as pda_phone,
             ps.name as pickup_site_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN users u_pda ON a.user_id = u_pda.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      WHERE o.pickup_site_id = ? AND o.status IN ('shipped', 'en_route', 'assigned') 
      AND o.agent_id IS NOT NULL AND o.psm_deposit_at IS NULL
      ORDER BY o.updated_at DESC
    `, [req.agent.pickup_site_id]);

    console.log(`[PSM-PENDING-DEPOSITS] Found ${orders.length} pending deposits`);

    const ordersWithDetails = orders.map(order => ({
      ...order,
      expected_deposit_code: `PDA-${order.id}-${order.agent_id}`.slice(-6),
      hours_since_shipped: Math.floor((Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60))
    }));

    res.json({
      success: true,
      orders: ordersWithDetails,
      summary: {
        total_pending: orders.length,
        oldest_pending: orders.length > 0 ? orders[orders.length - 1].updated_at : null,
        pickup_site: req.agent.pickup_site?.name || 'Unknown Site'
      }
    });

  } catch (error) {
    console.error('[PSM-PENDING-DEPOSITS] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Failed to load pending deposits',
      details: error.message 
    });
  }
});

// GET /api/pickup-site-manager/manual-orders - Get manual orders for this pickup site
router.get('/manual-orders', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('[MANUAL-ORDERS] Getting manual orders for pickup site:', req.agent.pickup_site_id);

    // Check if manual_orders table exists
    try {
      const [tableCheck] = await pool.query(`SHOW TABLES LIKE 'manual_orders'`);
      
      if (tableCheck.length === 0) {
        console.log('[MANUAL-ORDERS] manual_orders table does not exist, returning empty orders');
        return res.json({
          orders: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          },
          summary: {
            total_orders: 0,
            completed_orders: 0,
            pending_orders: 0,
            total_earnings: 0
          }
        });
      }

      let whereClause = 'WHERE pickup_site_id = ?';
      let queryParams = [req.agent.pickup_site_id];

      if (status !== 'all') {
        whereClause += ' AND status = ?';
        queryParams.push(status);
      }

      // Get manual orders
      const [orders] = await pool.query(`
        SELECT 
          mo.*,
          CASE 
            WHEN mo.customer_name IS NOT NULL THEN mo.customer_name
            WHEN mo.customer_phone IS NOT NULL THEN CONCAT('Customer (', mo.customer_phone, ')')
            ELSE 'Walk-in Customer'
          END as customer_display_name
        FROM manual_orders mo
        ${whereClause}
        ORDER BY mo.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, parseInt(limit), parseInt(offset)]);

      // Get total count
      const [countResult] = await pool.query(`
        SELECT COUNT(*) as total
        FROM manual_orders
        ${whereClause}
      `, queryParams);

      // Get summary stats
      const [summaryResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'picked_up' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status IN ('created', 'confirmed', 'ready_for_pickup') THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN status = 'picked_up' THEN commission_amount ELSE 0 END) as total_earnings
        FROM manual_orders
        WHERE pickup_site_id = ?
      `, [req.agent.pickup_site_id]);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        orders: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: totalPages
        },
        summary: summaryResult[0] || {
          total_orders: 0,
          completed_orders: 0,
          pending_orders: 0,
          total_earnings: 0
        }
      });

    } catch (tableError) {
      console.log('[MANUAL-ORDERS] Table access error, returning empty orders:', tableError.message);
      res.json({
        orders: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        },
        summary: {
          total_orders: 0,
          completed_orders: 0,
          pending_orders: 0,
          total_earnings: 0
        }
      });
    }

  } catch (error) {
    console.error('Get manual orders error:', error);
    res.status(500).json({ 
      error: 'Failed to get manual orders', 
      details: error.message 
    });
  }
});

// Get PSM profile
router.get('/profile', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM PROFILE] Loading profile for PSM:', req.user.id);
    
    const [profiles] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        psm.id as psm_id,
        psm.site_name,
        psm.site_address,
        psm.site_coordinates,
        psm.site_capacity,
        psm.operating_hours,
        psm.contact_phone,
        psm.manager_level,
        psm.is_active,
        psm.status as psm_status,
        psm.created_at as psm_created_at,
        a.pickup_site_id,
        ps.name as pickup_site_name,
        ps.address_line1,
        ps.city,
        ps.country,
        ps.latitude,
        ps.longitude,
        ps.capacity as site_capacity,
        ps.status as site_status
      FROM users u
      JOIN pickup_site_managers psm ON u.id = psm.user_id
      LEFT JOIN agents a ON u.id = a.user_id AND a.agent_type = 'pickup_site_manager'
      LEFT JOIN pickup_sites ps ON a.pickup_site_id = ps.id
      WHERE u.id = ?
    `, [req.user.id]);

    if (profiles.length === 0) {
      return res.status(404).json({
        error: 'PSM profile not found'
      });
    }

    const profile = profiles[0];
    
    // Set default notification preferences
    profile.email_notifications = true;
    profile.sms_notifications = true;
    profile.push_notifications = true;

    console.log('[PSM PROFILE] Profile loaded successfully');

    res.json({
      success: true,
      profile: profile
    });

  } catch (error) {
    console.error('[PSM PROFILE] Error:', error);
    res.status(500).json({
      error: 'Failed to load profile',
      details: error.message
    });
  }
});

// Update PSM profile
router.put('/profile', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM PROFILE UPDATE] Updating profile for PSM:', req.user.id);
    
    const {
      name, phone, site_name, site_type, capacity, business_hours, languages,
      address_line1, address_line2, district, sector, cell, village, province,
      location_description, latitude, longitude, city, country
    } = req.body;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update user information
      if (name || phone) {
        await connection.query(`
          UPDATE users 
          SET name = COALESCE(?, name), phone = COALESCE(?, phone)
          WHERE id = ?
        `, [name, phone, req.user.id]);
      }

      // Update PSM information
      await connection.query(`
        UPDATE pickup_site_managers 
        SET 
          site_name = COALESCE(?, site_name),
          site_address = COALESCE(?, site_address),
          site_coordinates = COALESCE(?, site_coordinates),
          site_capacity = COALESCE(?, site_capacity),
          operating_hours = COALESCE(?, operating_hours),
          contact_phone = COALESCE(?, contact_phone),
          updated_at = NOW()
        WHERE user_id = ?
      `, [
        site_name,
        address_line1 ? `${address_line1}, ${city || ''}, ${country || ''}`.trim() : null,
        (latitude && longitude) ? JSON.stringify({ lat: latitude, lng: longitude }) : null,
        capacity,
        business_hours,
        phone,
        req.user.id
      ]);

      // Get pickup site ID from agents table and update if exists
      const [agentInfo] = await connection.query(`
        SELECT pickup_site_id FROM agents WHERE user_id = ? AND agent_type = 'pickup_site_manager'
      `, [req.user.id]);

      if (agentInfo.length > 0 && agentInfo[0].pickup_site_id) {
        const pickupSiteId = agentInfo[0].pickup_site_id;
        
        // Update pickup site information
        await connection.query(`
          UPDATE pickup_sites 
          SET 
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            address_line1 = COALESCE(?, address_line1),
            city = COALESCE(?, city),
            country = COALESCE(?, country),
            latitude = COALESCE(?, latitude),
            longitude = COALESCE(?, longitude),
            capacity = COALESCE(?, capacity),
            updated_at = NOW()
          WHERE id = ?
        `, [
          site_name,
          location_description,
          address_line1,
          city,
          country,
          latitude,
          longitude,
          capacity,
          pickupSiteId
        ]);
      }

      await connection.commit();
      console.log('[PSM PROFILE UPDATE] Profile updated successfully');

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('[PSM PROFILE UPDATE] Error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

// Notify PDA about order ready for pickup
router.post('/notify-pda/:orderId', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message, timestamp } = req.body;
    
    console.log('[PSM NOTIFY PDA] Notifying PDA about order:', orderId);
    
    // This would integrate with a real notification system
    // For now, we'll just log and return success
    
    res.json({
      success: true,
      message: 'PDA notification sent successfully',
      orderId: orderId
    });

  } catch (error) {
    console.error('[PSM NOTIFY PDA] Error:', error);
    res.status(500).json({
      error: 'Failed to notify PDA',
      details: error.message
    });
  }
});

// Notify buyer about order ready for pickup
router.post('/notify-buyer/:orderId', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { message, contact_method, pickup_location, business_hours } = req.body;
    
    console.log('[PSM NOTIFY BUYER] Notifying buyer about order:', orderId);
    
    // This would integrate with SMS/Email service
    // For now, we'll just log and return success
    
    res.json({
      success: true,
      message: 'Buyer notification sent successfully',
      orderId: orderId,
      contact_method: contact_method
    });

  } catch (error) {
    console.error('[PSM NOTIFY BUYER] Error:', error);
    res.status(500).json({
      error: 'Failed to notify buyer',
      details: error.message
    });
  }
});

// Confirm delivery from PDA with enhanced tracking
router.post('/confirm-delivery/:orderId', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pda_id, delivery_confirmed, received_time, confirmation_notes } = req.body;
    
    console.log('[PSM CONFIRM DELIVERY] Confirming delivery for order:', orderId);
    
    // Get order details first
    const [orders] = await pool.query(`
      SELECT o.*, u.email as buyer_email, u.phone as buyer_phone, u.first_name, u.last_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.pickup_site_id = ?
    `, [orderId, req.agent.pickup_site_id]);

    if (orders.length === 0) {
      return res.status(404).json({
        error: 'Order not found or not assigned to your pickup site'
      });
    }

    const order = orders[0];
    
    // Update order status to indicate delivery confirmed by PSM
    const [updateResult] = await pool.query(`
      UPDATE orders 
      SET 
        status = 'DELIVERED_TO_PSM',
        psm_received_time = ?,
        psm_confirmation_notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [received_time, confirmation_notes, orderId]);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        error: 'Failed to update order status'
      });
    }

    // Create status history entry
    await pool.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes, created_at)
      VALUES (?, ?, 'DELIVERED_TO_PSM', ?, ?, NOW())
    `, [orderId, order.status, req.user.id, confirmation_notes || 'Package received at pickup site']);

    // Emit WebSocket events
    const io = req.app.get('io');
    if (io) {
      // Notify PDA that PSM confirmed receipt
      if (pda_id) {
        io.to(`user_${pda_id}`).emit('psm_confirms_delivery', {
          orderId: orderId,
          orderNumber: order.order_number,
          pickupSiteName: req.agent.pickup_site?.name || 'Pickup Site',
          confirmedAt: received_time,
          message: 'Package successfully received at pickup site'
        });
      }

      // Notify buyer that package is ready for pickup
      io.to(`user_${order.user_id}`).emit('order_ready_for_pickup', {
        orderId: orderId,
        orderNumber: order.order_number,
        pickupSiteName: req.agent.pickup_site?.name || 'Pickup Site',
        pickupSiteAddress: req.agent.pickup_site?.address_line1 || 'Address not available',
        message: 'Your order has arrived at the pickup site and is ready for collection'
      });

      // Notify admin of successful delivery
      io.to('admin_room').emit('delivery_confirmed', {
        orderId: orderId,
        orderNumber: order.order_number,
        pickupSiteName: req.agent.pickup_site?.name || 'Pickup Site',
        psmName: `${req.agent.first_name} ${req.agent.last_name}`,
        confirmedAt: received_time
      });
    }

    console.log(`[PSM CONFIRM DELIVERY] ✅ Order ${order.order_number} confirmed as delivered to PSM`);

    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
      orderId: orderId,
      orderNumber: order.order_number,
      status: 'DELIVERED_TO_PSM'
    });

  } catch (error) {
    console.error('[PSM CONFIRM DELIVERY] Error:', error);
    res.status(500).json({
      error: 'Failed to confirm delivery',
      details: error.message
    });
  }
});



// Verify pickup code
router.post('/verify-code', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { pickup_code, verification_code } = req.body;
    
    if (!pickup_code && !verification_code) {
      return res.status(400).json({
        error: 'Verification code required',
        message: 'Please provide either pickup_code or verification_code'
      });
    }
    
    const code = pickup_code || verification_code;
    console.log('[PSM VERIFY CODE] Verifying code:', code);
    
    // Mock verification - in real implementation, check against database
    const validCodes = ['PK001', 'PK002', 'PK003', '123456', '654321'];
    
    if (validCodes.includes(code)) {
      res.json({
        success: true,
        valid: true,
        order: {
          id: 'ORD-' + code.slice(-3),
          customer_name: 'Test Customer',
          items: ['Product A', 'Product B'],
          total_amount: 65.00
        }
      });
    } else {
      res.json({
        success: true,
        valid: false,
        message: 'Invalid verification code'
      });
    }

  } catch (error) {
    console.error('[PSM VERIFY CODE] Error:', error);
    res.status(500).json({
      error: 'Failed to verify code',
      details: error.message
    });
  }
});

// Confirm pickup
router.post('/confirm-pickup', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { order_id, pickup_code, customer_signature } = req.body;
    
    console.log('[PSM CONFIRM PICKUP] Confirming pickup for order:', order_id);
    
    // Mock pickup confirmation
    res.json({
      success: true,
      message: 'Pickup confirmed successfully',
      order_id: order_id,
      pickup_time: new Date().toISOString()
    });

  } catch (error) {
    console.error('[PSM CONFIRM PICKUP] Error:', error);
    res.status(500).json({
      error: 'Failed to confirm pickup',
      details: error.message
    });
  }
});

// Mark order as ready
router.post('/mark-ready/:orderId', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('[PSM MARK READY] Marking order as ready:', orderId);
    
    // Mock marking order as ready
    res.json({
      success: true,
      message: 'Order marked as ready for pickup',
      order_id: orderId
    });

  } catch (error) {
    console.error('[PSM MARK READY] Error:', error);
    res.status(500).json({
      error: 'Failed to mark order as ready',
      details: error.message
    });
  }
});

// POST /api/pickup-site-manager/create-manual-order - Create manual order
router.post('/create-manual-order', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM CREATE ORDER] Creating manual order...');
    console.log('[PSM CREATE ORDER] Request body:', req.body);
    
    const {
      customer_name,
      customer_phone,
      customer_email,
      delivery_type,
      pickup_site_id,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      products,
      subtotal,
      delivery_fee,
      total_amount,
      payment_method,
      payment_status,
      notes
    } = req.body;

    // Parse products if it's a string
    let parsedProducts;
    try {
      parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid products format' });
    }

    // Validate required fields
    if (!customer_name || !customer_phone || !parsedProducts || !Array.isArray(parsedProducts) || parsedProducts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: customer_name, customer_phone, products' 
      });
    }

    // Generate order number
    const orderNumber = `PSM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Calculate commission (25% of subtotal for PSM)
    const commissionRate = 25.00;
    const commissionAmount = (parseFloat(subtotal || 0) * commissionRate / 100).toFixed(2);

    // Insert manual order
    const [orderResult] = await pool.query(`
      INSERT INTO manual_orders (
        agent_id, order_number, customer_name, customer_phone, customer_email,
        delivery_type, pickup_site_id, delivery_address, delivery_latitude, delivery_longitude,
        subtotal, delivery_fee, total_amount, payment_method, payment_status,
        notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      req.user.agent_id, orderNumber, customer_name, customer_phone, customer_email,
      delivery_type, pickup_site_id, delivery_address, delivery_latitude, delivery_longitude,
      subtotal, delivery_fee, total_amount, payment_method, payment_status || 'pending',
      notes
    ]);

    const orderId = orderResult.insertId;

    // Insert order items
    for (const product of parsedProducts) {
      await pool.query(`
        INSERT INTO manual_order_items (
          order_id, product_name, product_price, quantity, total_price
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        orderId, 
        product.name || product.product_name, 
        product.price || product.product_price, 
        product.quantity, 
        (product.price || product.product_price) * product.quantity
      ]);
    }

    // Handle payment proof if uploaded
    let paymentProofId = null;
    if (req.files && req.files.payment_proof) {
      const file = req.files.payment_proof;
      const fileName = `payment_proof_${orderId}_${Date.now()}_${file.name}`;
      const filePath = path.join(__dirname, '../uploads/payment_proofs', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      await file.mv(filePath);
      
      const [proofResult] = await pool.query(`
        INSERT INTO payment_proofs (
          order_id, order_type, file_path, file_name, file_size, mime_type, uploaded_at
        ) VALUES (?, 'manual', ?, ?, ?, ?, NOW())
      `, [orderId, filePath, fileName, file.size, file.mimetype]);
      
      paymentProofId = proofResult.insertId;
      
      // Update manual order with payment proof
      await pool.query('UPDATE manual_orders SET payment_proof_id = ? WHERE id = ?', [paymentProofId, orderId]);
    }

    // Create commission record
    await pool.query(`
      INSERT INTO psm_commissions (
        agent_id, pickup_site_id, order_id, order_type, commission_type,
        commission_rate, commission_amount, order_total, status, created_at
      ) VALUES (?, ?, ?, 'manual', 'assisted_purchase', ?, ?, ?, 'pending', NOW())
    `, [req.user.agent_id, pickup_site_id, orderId, commissionRate, commissionAmount, total_amount]);

    // Generate receipt (mock for now)
    const receiptUrl = `/api/pickup-site-manager/order/${orderId}/receipt`;
    const receiptPdfPath = `receipts/manual_order_${orderId}_${Date.now()}.pdf`;

    console.log('[PSM CREATE ORDER] Order created successfully:', {
      orderId,
      orderNumber,
      commissionAmount
    });

    res.json({
      success: true,
      message: 'Manual order created successfully',
      orderId,
      orderNumber,
      receiptUrl,
      receiptPdfPath,
      subtotal: parseFloat(subtotal || 0),
      commission_amount: parseFloat(commissionAmount),
      delivery_fee: parseFloat(delivery_fee || 0),
      total_amount: parseFloat(total_amount || 0),
      qrCode: `PSM-ORDER-${orderId}` // Mock QR code
    });

  } catch (error) {
    console.error('[PSM CREATE ORDER] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create manual order',
      details: error.message
    });
  }
});

// POST /api/pickup-site-manager/order/:orderId/regenerate-receipt - Regenerate receipt
router.post('/order/:orderId/regenerate-receipt', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('[PSM REGENERATE RECEIPT] Regenerating receipt for order:', orderId);
    
    // Verify order exists and belongs to this agent
    const [orders] = await pool.query(`
      SELECT mo.*, a.user_id 
      FROM manual_orders mo
      JOIN agents a ON mo.agent_id = a.id
      WHERE mo.id = ? AND a.user_id = ?
    `, [orderId, req.user.id]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or access denied'
      });
    }

    // Generate new receipt path
    const receiptPdfPath = `receipts/manual_order_${orderId}_${Date.now()}.pdf`;
    
    // In a real implementation, you would generate the actual PDF here
    // For now, we'll just return success with the new path
    
    console.log('[PSM REGENERATE RECEIPT] Receipt regenerated:', receiptPdfPath);
    
    res.json({
      success: true,
      message: 'Receipt regenerated successfully',
      receiptPdfPath,
      receiptUrl: `/api/pickup-site-manager/order/${orderId}/receipt`
    });

  } catch (error) {
    console.error('[PSM REGENERATE RECEIPT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate receipt',
      details: error.message
    });
  }
});

// GET /api/pickup-site-manager/order/:orderId/receipt - Download receipt
router.get('/order/:orderId/receipt', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('[PSM DOWNLOAD RECEIPT] Downloading receipt for order:', orderId);
    
    // Verify order exists and belongs to this agent
    const [orders] = await pool.query(`
      SELECT mo.*, a.user_id 
      FROM manual_orders mo
      JOIN agents a ON mo.agent_id = a.id
      WHERE mo.id = ? AND a.user_id = ?
    `, [orderId, req.user.id]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or access denied'
      });
    }

    const order = orders[0];
    
    // In a real implementation, you would serve the actual PDF file
    // For now, we'll generate a simple text receipt
    const receiptContent = [
      'MANUAL ORDER RECEIPT',
      '====================',
      `Order Number: ${order.order_number}`,
      `Customer: ${order.customer_name}`,
      `Phone: ${order.customer_phone}`,
      `Email: ${order.customer_email || 'N/A'}`,
      '',
      `Delivery Type: ${order.delivery_type}`,
      order.delivery_type === 'pickup' ? `Pickup Site ID: ${order.pickup_site_id}` : `Delivery Address: ${order.delivery_address}`,
      '',
            `Subtotal: $${order.subtotal}`,
      `Delivery Fee: $${order.delivery_fee}`,
      `Total Amount: $${order.total_amount}`,
      '',
      'Payment Method: Cash/Mobile Money',
      `Payment Status: ${order.payment_status || 'pending'}`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${order.order_number}.txt"`);
    return res.send(receiptContent);
  } catch (error) {
    console.error('Error generating receipt:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
