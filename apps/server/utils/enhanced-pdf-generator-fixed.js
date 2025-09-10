const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const util = require('util');
const mysql = require('mysql2/promise');

// Promisify QRCode generation for better error handling
const generateQR = util.promisify(QRCode.toDataURL);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

class EnhancedPDFGeneratorFixed {
  constructor() {
    // Professional Color Palette
    this.config = {
      colors: {
        primary: '#0d0b38',       // African Deals Domain brand color
        primaryLight: '#2d2b58',  // Lighter primary for gradients
        secondary: '#059669',     // Success green  
        warning: '#d97706',       // Warning orange
        error: '#dc2626',         // Error red
        text: '#1f2937',          // Dark gray
        textLight: '#6b7280',     // Light gray  
        lightBg: '#f8fafc',       // Light background
        border: '#e5e7eb',        // Light border
        accent: '#3b82f6',        // Blue accent
        success: '#10b981',       // Success green
        white: '#ffffff'
      },
      layout: {
        margin: 35,
        contentWidth: 555,        // A4 width - margins
        maxHeight: 750,           // Max height to fit on one page
        logoSize: 60,             // Company logo size
        qrSize: 120,              // QR code size
        sectionSpacing: 12,       // Space between sections
        cornerRadius: 6           // Rounded corners
      },
      fonts: {
        heading: { size: 14, font: 'Helvetica-Bold' },
        subheading: { size: 12, font: 'Helvetica-Bold' },
        body: { size: 10, font: 'Helvetica' },
        small: { size: 8, font: 'Helvetica' },
        large: { size: 16, font: 'Helvetica-Bold' }
      },
      currency: {
        symbol: 'FRW',
        locale: 'rw-RW'
      }
    };

    // Track errors for debugging
    this.generationErrors = [];
    this.currentY = this.config.layout.margin;
  }

  // Format currency properly for Rwanda
  formatCurrency(amount) {
    const numAmount = parseFloat(amount) || 0;
    return `${this.config.currency.symbol} ${Math.round(numAmount).toLocaleString()}`;
  }

  // Fetch real agent information from database
  async fetchAgentInfo(agentId) {
    let connection = null;
    try {
      console.log('[ENHANCED-PDF] 🔍 Fetching real agent info for ID:', agentId);
      
      connection = await mysql.createConnection(dbConfig);
      
      // Get agent details with pickup site info
      const [agentRows] = await connection.execute(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.city,
          u.address,
          u.profile_image,
          at.agent_type,
          at.commission_rate,
          ps.name as pickup_site_name,
          ps.address as pickup_site_address,
          ps.coordinates as pickup_site_coordinates,
          ps.contact_phone as pickup_site_phone
        FROM users u
        LEFT JOIN agent_types at ON u.agent_type_id = at.id
        LEFT JOIN pickup_sites ps ON u.pickup_site_id = ps.id
        WHERE u.id = ? AND u.user_type = 'agent' AND u.is_active = 1
      `, [agentId]);

      if (agentRows.length > 0) {
        const agent = agentRows[0];
        console.log('[ENHANCED-PDF] ✅ Agent info fetched successfully:', agent.name);
        return {
          id: agent.id,
          name: agent.name || 'Unknown Agent',
          email: agent.email || 'No email provided',
          phone: agent.phone || '+250 XXX XXX XXX',
          city: agent.city || 'Kigali',
          address: agent.address || 'Rwanda',
          agent_type: agent.agent_type || 'Pickup Site Manager',
          commission_rate: parseFloat(agent.commission_rate) || 25,
          pickup_site: {
            name: agent.pickup_site_name || 'Downtown Collection Point',
            address: agent.pickup_site_address || 'Kigali, Rwanda',
            coordinates: agent.pickup_site_coordinates || null,
            phone: agent.pickup_site_phone || agent.phone
          }
        };
      } else {
        console.warn('[ENHANCED-PDF] ⚠️ Agent not found, using fallback data');
        return this.getFallbackAgentInfo();
      }

    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Error fetching agent info:', error.message);
      return this.getFallbackAgentInfo();
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  // Fallback agent info when database fetch fails
  getFallbackAgentInfo() {
    return {
      id: 'N/A',
      name: 'System Agent',
      email: 'system@africandealsdomain.com',
      phone: '+250 XXX XXX XXX',
      city: 'Kigali',
      address: 'Rwanda',
      agent_type: 'Pickup Site Manager',
      commission_rate: 25,
      pickup_site: {
        name: 'Downtown Collection Point',
        address: 'Kigali, Rwanda',
        coordinates: null,
        phone: '+250 XXX XXX XXX'
      }
    };
  }

  // Fetch delivery fee settings from admin configuration
  async fetchDeliverySettings() {
    let connection = null;
    try {
      connection = await mysql.createConnection(dbConfig);
      
      const [settings] = await connection.execute(`
        SELECT setting_key, setting_value, setting_type
        FROM platform_settings
        WHERE category = 'delivery'
      `);

      const deliveryConfig = {
        home_delivery_percentage: 6,     // Default: 6% of order value
        pickup_delivery_free: true,      // Pickup is always free
        local_products_free: true,       // Local products free delivery
        free_delivery_threshold: 0       // Minimum order for free delivery
      };

      // Apply admin settings
      settings.forEach(setting => {
        const key = setting.setting_key;
        const value = setting.setting_type === 'number' ? parseFloat(setting.setting_value) : 
                     setting.setting_type === 'boolean' ? setting.setting_value === 'true' : 
                     setting.setting_value;
        
        if (deliveryConfig.hasOwnProperty(key)) {
          deliveryConfig[key] = value;
        }
      });

      console.log('[ENHANCED-PDF] ✅ Delivery settings loaded:', deliveryConfig);
      return deliveryConfig;

    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Error fetching delivery settings:', error.message);
      // Return default settings
      return {
        home_delivery_percentage: 6,
        pickup_delivery_free: true,
        local_products_free: true,
        free_delivery_threshold: 0
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  // Calculate proper delivery fee based on admin settings
  calculateDeliveryFee(deliveryData, settings) {
    const {
      delivery_method,
      distance_km,
      total_weight_kg,
      has_fragile_items,
      subtotal
    } = deliveryData;

    // Pickup delivery is always FREE
    if (delivery_method === 'pickup') {
      return {
        total_fee: 0,
        breakdown: {
          base_fee: 0,
          distance_fee: 0,
          weight_fee: 0,
          fragile_fee: 0,
          notes: 'FREE pickup delivery'
        }
      };
    }

    // Home delivery calculations
    if (delivery_method === 'home') {
      // Check for free delivery threshold
      if (subtotal >= settings.free_delivery_threshold && settings.free_delivery_threshold > 0) {
        return {
          total_fee: 0,
          breakdown: {
            base_fee: 0,
            distance_fee: 0,
            weight_fee: 0,
            fragile_fee: 0,
            notes: `FREE delivery (order over ${this.formatCurrency(settings.free_delivery_threshold)})`
          }
        };
      }

      const baseFee = settings.base_fee;
      const distanceFee = Math.round((distance_km || 5) * settings.per_km_fee);
      const weightFee = total_weight_kg > 5 ? Math.round((total_weight_kg - 5) * settings.per_kg_fee) : 0;
      const fragileFee = has_fragile_items ? settings.fragile_fee : 0;
      
      const totalFee = Math.max(baseFee + distanceFee + weightFee + fragileFee, settings.min_fee);

      return {
        total_fee: totalFee,
        breakdown: {
          base_fee: baseFee,
          distance_fee: distanceFee,
          weight_fee: weightFee,
          fragile_fee: fragileFee,
          notes: `Home delivery (${distance_km || 5}km, ${total_weight_kg || 1}kg${has_fragile_items ? ', fragile items' : ''})`
        }
      };
    }

    // Default: no delivery fee
    return {
      total_fee: 0,
      breakdown: {
        base_fee: 0,
        distance_fee: 0,
        weight_fee: 0,
        fragile_fee: 0,
        notes: 'Standard delivery'
      }
    };
  }

  // Validate and enhance order data with real information
  async validateOrderData(orderData) {
    console.log('[ENHANCED-PDF] 🔍 Validating and enhancing order data...');
    
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!orderData.order_number) {
      errors.push('order_number is required');
    }

    // Validate and parse items safely
    let items = [];
    try {
      if (Array.isArray(orderData.items)) {
        items = orderData.items;
      } else if (typeof orderData.items === 'string') {
        items = JSON.parse(orderData.items || '[]');
      } else {
        items = [];
      }
    } catch (parseError) {
      warnings.push(`Items JSON parse failed: ${parseError.message}`);
      items = [];
    }

    // Fetch real agent information
    const agentInfo = await this.fetchAgentInfo(orderData.agent_id);

    // Fetch delivery settings for proper calculation
    const deliverySettings = await this.fetchDeliverySettings();

    // Calculate proper delivery fee
    const deliveryData = {
      delivery_method: orderData.delivery_method || 'pickup',
      distance_km: parseFloat(orderData.delivery_distance) || 5,
      total_weight_kg: parseFloat(orderData.total_weight) || 1,
      has_fragile_items: orderData.has_fragile_items === true || orderData.has_fragile_items === 'true',
      subtotal: parseFloat(orderData.subtotal) || 0
    };

    const deliveryCalculation = this.calculateDeliveryFee(deliveryData, deliverySettings);

    // Enhanced sanitized data object
    const sanitizedData = {
      order_number: orderData.order_number || 'N/A',
      items: items,
      subtotal: parseFloat(orderData.subtotal) || 0,
      delivery_fee: deliveryCalculation.total_fee,
      delivery_breakdown: deliveryCalculation.breakdown,
      total_amount: parseFloat(orderData.subtotal || 0) + deliveryCalculation.total_fee,
      commission_included: true, // Flag that commission is pre-calculated
      
      // Buyer information
      buyer_name: orderData.buyer_name || 'N/A',
      buyer_phone: orderData.buyer_phone || 'N/A',
      buyer_email: orderData.buyer_email || 'N/A',
      buyer_address: orderData.buyer_address || '',
      
      // Real agent information
      agent: agentInfo,
      
      // Delivery information
      delivery_method: orderData.delivery_method || 'pickup',
      delivery_address: orderData.delivery_address || orderData.buyer_address || '',
      delivery_coordinates: orderData.delivery_coordinates ? 
        JSON.parse(orderData.delivery_coordinates) : null,
      delivery_distance: parseFloat(orderData.delivery_distance) || null,
      delivery_notes: orderData.delivery_notes || '',
      
      // Order metadata
      created_at: orderData.created_at || new Date().toISOString(),
      status: orderData.status || 'PENDING',
      payment_method: orderData.payment_method || 'Mobile Money',
      
      // System information
      currency: this.config.currency.symbol,
      timezone: 'CAT', // Central Africa Time
      locale: 'rw-RW'
    };

    // Recalculate totals if missing or incorrect
    if (sanitizedData.items.length > 0) {
      let calculatedSubtotal = 0;
      sanitizedData.items.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price) || 0;
        calculatedSubtotal += quantity * price;
      });
      
      if (sanitizedData.subtotal === 0) {
        sanitizedData.subtotal = calculatedSubtotal;
        sanitizedData.total_amount = calculatedSubtotal + sanitizedData.delivery_fee;
      }
    }

    if (errors.length > 0) {
      console.warn('[ENHANCED-PDF] ⚠️ Validation errors:', errors);
    }
    if (warnings.length > 0) {
      console.warn('[ENHANCED-PDF] ⚠️ Validation warnings:', warnings);
    }

    console.log('[ENHANCED-PDF] ✅ Order data enhanced with real agent info and proper calculations');
    return sanitizedData;
  }

  // Generate enhanced receipt with all fixes
  async generateCompactReceipt(orderData) {
    let doc = null;
    let writeStream = null;
    let filepath = null;

    try {
      console.log('[ENHANCED-PDF] 🚀 Starting enhanced receipt generation with real data...');

      // Validate and enhance data with real information
      const sanitizedData = await this.validateOrderData(orderData);
      
      // Initialize PDF document
      doc = new PDFDocument({ 
        margin: this.config.layout.margin,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Receipt - ${sanitizedData.order_number}`,
          Author: 'African Deals Domain',
          Subject: 'Enhanced Payment Receipt - Rwanda',
          Keywords: 'receipt, payment, delivery, agent, rwanda, frw',
          Creator: 'African Deals Domain PDF System v3.0',
          Producer: 'Enhanced PDF Generator - Fixed Edition'
        }
      });

      // Setup file paths
      const receiptId = `ADD-RW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const filename = `receipt-${sanitizedData.order_number}-${Date.now()}.pdf`;
      const uploadsDir = path.join(__dirname, '../../uploads');
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('[ENHANCED-PDF] 📁 Created uploads directory');
      }
      
      filepath = path.join(uploadsDir, filename);
      
      // Setup write stream with error handling
      writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // Critical: Setup stream error handlers immediately
      writeStream.on('error', (streamError) => {
        console.error('[ENHANCED-PDF] ❌ Write stream error:', streamError);
        throw streamError;
      });

      // Reset Y position for new document
      this.currentY = this.config.layout.margin;
      this.generationErrors = [];

      console.log('[ENHANCED-PDF] 📄 Building enhanced PDF sections...');

      // Build PDF sections with real data
      this.currentY = await this.drawBrandedHeader(doc, receiptId, sanitizedData);
      this.currentY = await this.drawCustomerAgentInfo(doc, sanitizedData, this.currentY);
      this.currentY = await this.drawOrderSummary(doc, sanitizedData, this.currentY);
      this.currentY = await this.drawDeliveryDetails(doc, sanitizedData, this.currentY);
      this.currentY = await this.drawPaymentDetails(doc, sanitizedData, this.currentY);
      this.currentY = await this.drawStatusSection(doc, sanitizedData, this.currentY);
      this.currentY = await this.drawQRAndSignatures(doc, sanitizedData, receiptId, this.currentY);
      
      // Add watermark
      await this.addWatermark(doc);
      
      // Add footer with proper currency
      this.drawFooter(doc, receiptId, sanitizedData);

      // Add error section if there were issues
      if (this.generationErrors.length > 0) {
        this.drawErrorSection(doc, this.generationErrors);
      }

      console.log('[ENHANCED-PDF] 🔚 Finalizing enhanced PDF document...');
      
      // Critical: Always end the document
      doc.end();
      console.log('[ENHANCED-PDF] ✅ Document.end() called successfully');

      // Return promise that resolves when file is written
      return new Promise((resolve, reject) => {
        writeStream.on('finish', async () => {
          try {
            console.log('[ENHANCED-PDF] 📝 Write stream finished - validating file...');
            
            // Validate file was created and has content
            if (!fs.existsSync(filepath)) {
              throw new Error('PDF file was not created on disk');
            }
            
            const stats = fs.statSync(filepath);
            console.log('[ENHANCED-PDF] 📊 Final file size:', stats.size, 'bytes');
            
            if (stats.size === 0) {
              throw new Error('Generated PDF file is empty (0 bytes)');
            }
            
            // Validate PDF format
            const buffer = fs.readFileSync(filepath);
            if (!buffer.slice(0, 4).toString().startsWith('%PDF')) {
              throw new Error('Generated file is not a valid PDF format');
            }
            
            console.log('[ENHANCED-PDF] 🎉 Enhanced PDF generation completed successfully:', filename);
            console.log('[ENHANCED-PDF] 📍 File path:', filepath);
            
            resolve({
              success: true,
              filename: filename,
              filePath: filepath,
              fileSize: stats.size
            });
            
          } catch (validationError) {
            console.error('[ENHANCED-PDF] ❌ File validation failed:', validationError);
            reject(validationError);
          }
        });

        writeStream.on('error', (streamError) => {
          console.error('[ENHANCED-PDF] ❌ Stream error during finalization:', streamError);
          reject(streamError);
        });

        // Fallback timeout to prevent hanging
        setTimeout(() => {
          reject(new Error('PDF generation timeout - file may not have been written'));
        }, 20000);
      });

    } catch (error) {
      console.error('[ENHANCED-PDF] 💥 Critical error during enhanced PDF generation:', error);
      
      // Ensure document is ended even on error
      if (doc) {
        try {
          doc.end();
        } catch (endError) {
          console.error('[ENHANCED-PDF] ❌ Error ending document:', endError);
        }
      }
      
      // Clean up failed file
      if (filepath && fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
          console.log('[ENHANCED-PDF] 🗑️ Cleaned up incomplete file');
        } catch (unlinkError) {
          console.error('[ENHANCED-PDF] ❌ Could not clean up file:', unlinkError);
        }
      }
      
      throw error;
    }
  }

  // Enhanced branded header with proper branding
  async drawBrandedHeader(doc, receiptId, orderData) {
    try {
      console.log('[ENHANCED-PDF] 🎨 Drawing branded header with FRW currency...');
      
      const y = this.currentY;
      const { colors, layout } = this.config;
      
      // Main header background with gradient effect
      doc.rect(layout.margin, y, layout.contentWidth, 90)
         .fillAndStroke(colors.primary, colors.primary);
      
      // Simulate gradient with overlapping rectangles
      doc.rect(layout.margin, y, layout.contentWidth, 30)
         .fillAndStroke(colors.primaryLight, colors.primaryLight);
      
      // Company logo (load from correct path)
      try {
        const logoPath = path.join(__dirname, '../../client/public/images/add_logo.jpg');
        console.log('[ENHANCED-PDF] 🖼️ Looking for logo at:', logoPath);
        
        if (fs.existsSync(logoPath)) {
          console.log('[ENHANCED-PDF] ✅ Logo found, adding to PDF');
          doc.image(logoPath, layout.margin + 10, y + 15, { 
            width: layout.logoSize, 
            height: layout.logoSize,
            fit: [layout.logoSize, layout.logoSize]
          });
        } else {
          console.log('[ENHANCED-PDF] ⚠️ Logo not found, using placeholder');
          // Professional logo placeholder
          doc.roundedRect(layout.margin + 10, y + 15, layout.logoSize, layout.logoSize, 8)
             .fillAndStroke(colors.white, colors.border);
          
          doc.fontSize(14).font('Helvetica-Bold')
             .fillColor(colors.primary)
             .text('ADD', layout.margin + 22, y + 38);
        }
      } catch (logoError) {
        console.warn('[ENHANCED-PDF] ⚠️ Logo load failed:', logoError.message);
        // Fallback logo placeholder
        doc.roundedRect(layout.margin + 10, y + 15, layout.logoSize, layout.logoSize, 8)
           .fillAndStroke(colors.white, colors.border);
        
        doc.fontSize(14).font('Helvetica-Bold')
           .fillColor(colors.primary)
           .text('ADD', layout.margin + 22, y + 38);
      }

      // Company name and title
      doc.fontSize(this.config.fonts.large.size)
         .font(this.config.fonts.large.font)
         .fillColor(colors.white)
         .text('AFRICAN DEALS DOMAIN', layout.margin + layout.logoSize + 20, y + 15);

      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.white)
         .text('Enhanced Payment Receipt - Rwanda', layout.margin + layout.logoSize + 20, y + 35);

      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font)
         .fillColor('#e5e7eb')
         .text('No Hidden Fees • Commission Pre-included', layout.margin + layout.logoSize + 20, y + 50);

      // Receipt ID and date (right aligned)
      const rightX = layout.margin + layout.contentWidth - 10;
      
      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.white);
      
      const receiptText = `Receipt ID: ${receiptId}`;
      const dateText = `Generated: ${new Date().toLocaleString('en-RW', { timeZone: 'Africa/Kigali' })}`;
      
      doc.text(receiptText, rightX - doc.widthOfString(receiptText), y + 15);
      doc.fontSize(this.config.fonts.small.size)
         .text(dateText, rightX - doc.widthOfString(dateText), y + 30);

      return y + 100;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Header drawing error:', error);
      this.generationErrors.push(`Header: ${error.message}`);
      return this.currentY + 90;
    }
  }

  // Enhanced customer and agent info with real agent data
  async drawCustomerAgentInfo(doc, orderData, y) {
    try {
      console.log('[ENHANCED-PDF] 👥 Drawing customer and real agent info...');
      
      const { colors, layout } = this.config;
      const sectionHeight = 120;
      
      // Background
      doc.roundedRect(layout.margin, y, layout.contentWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke(colors.lightBg, colors.border);
      
      // Customer info (left column)
      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.primary)
         .text('CUSTOMER INFORMATION', layout.margin + 15, y + 12);

      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.text);

      doc.text(`Name: ${orderData.buyer_name}`, layout.margin + 15, y + 35);
      doc.text(`Phone: ${orderData.buyer_phone}`, layout.margin + 15, y + 50);
      if (orderData.buyer_email && orderData.buyer_email !== 'N/A') {
        doc.text(`Email: ${orderData.buyer_email}`, layout.margin + 15, y + 65);
      }

      // Agent info (right column) - REAL DATA
      const agentX = layout.margin + 280;
      
      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.primary)
         .text(`${orderData.agent.agent_type.toUpperCase()}`, agentX, y + 12);

      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.text);

      doc.text(`Name: ${orderData.agent.name}`, agentX, y + 35);
      doc.text(`Phone: ${orderData.agent.phone}`, agentX, y + 50);
      doc.text(`Location: ${orderData.agent.city}`, agentX, y + 65);
      doc.text(`Agent ID: ${orderData.agent.id}`, agentX, y + 80);

      // Pickup site info (if applicable)
      if (orderData.delivery_method === 'pickup') {
        doc.fontSize(this.config.fonts.small.size)
           .fillColor(colors.secondary);
        doc.text(`Pickup Site: ${orderData.agent.pickup_site.name}`, layout.margin + 15, y + 85);
        doc.text(`Address: ${orderData.agent.pickup_site.address}`, layout.margin + 15, y + 100);
      }

      return y + sectionHeight + layout.sectionSpacing;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Customer/Agent info error:', error);
      this.generationErrors.push(`Customer/Agent Info: ${error.message}`);
      return y + 120 + layout.sectionSpacing;
    }
  }

  // Enhanced order summary with FRW currency and proper totals
  async drawOrderSummary(doc, orderData, y) {
    try {
      console.log('[ENHANCED-PDF] 📋 Drawing order summary with FRW currency...');
      
      const { colors, layout } = this.config;
      const sectionHeight = Math.min(150 + (orderData.items.length * 20), 300);
      
      // Section background
      doc.roundedRect(layout.margin, y, layout.contentWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke(colors.lightBg, colors.border);
      
      // Section header
      doc.fontSize(this.config.fonts.heading.size)
         .font(this.config.fonts.heading.font)
         .fillColor(colors.primary)
         .text('ORDER SUMMARY', layout.margin + 15, y + 12);

      let currentTableY = y + 35;
      
      // Table header
      const headerHeight = 18;
      doc.rect(layout.margin + 10, currentTableY, layout.contentWidth - 20, headerHeight)
         .fillAndStroke('#f3f4f6', colors.border);
      
      doc.fontSize(this.config.fonts.small.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.text);
      
      doc.text('#', layout.margin + 15, currentTableY + 6);
      doc.text('Product', layout.margin + 45, currentTableY + 6);
      doc.text('Qty', layout.margin + 300, currentTableY + 6);
      doc.text('Unit Price', layout.margin + 350, currentTableY + 6);
      doc.text('Total', layout.margin + 450, currentTableY + 6);
      
      currentTableY += headerHeight;
      
      // Table rows with FRW currency
      const rowHeight = 18;
      orderData.items.forEach((item, index) => {
        const quantity = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.price) || 0;
        const total = quantity * price;
        
        // Alternating row colors
        const bgColor = index % 2 === 0 ? colors.white : '#f9fafb';
        doc.rect(layout.margin + 10, currentTableY, layout.contentWidth - 20, rowHeight)
           .fillAndStroke(bgColor, colors.border);
        
        doc.fontSize(this.config.fonts.small.size)
           .font(this.config.fonts.body.font)
           .fillColor(colors.text);
        
        doc.text(`${index + 1}`, layout.margin + 15, currentTableY + 5);
        doc.text(String(item.name || item.item || 'Product').substring(0, 30), layout.margin + 45, currentTableY + 5);
        doc.text(quantity.toString(), layout.margin + 300, currentTableY + 5);
        doc.text(this.formatCurrency(price), layout.margin + 350, currentTableY + 5);
        doc.text(this.formatCurrency(total), layout.margin + 450, currentTableY + 5);
        
        currentTableY += rowHeight;
      });
      
      // Totals section with FRW and no hidden commissions
      const totalsY = currentTableY + 15;
      const totalsWidth = 250;
      const totalsX = layout.margin + layout.contentWidth - totalsWidth;
      
      doc.roundedRect(totalsX, totalsY, totalsWidth, 80, layout.cornerRadius)
         .fillAndStroke('#f8fafc', colors.border);
      
      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.text);
      
      // Subtotal (commission already included)
      doc.text('Products Total:', totalsX + 10, totalsY + 10);
      doc.text(this.formatCurrency(orderData.subtotal), totalsX + 160, totalsY + 10);
      
      // Note about commission
      doc.fontSize(this.config.fonts.small.size)
         .fillColor(colors.secondary)
         .text('(Platform commission included)', totalsX + 10, totalsY + 25);
      
      // Delivery fee
      doc.fontSize(this.config.fonts.body.size)
         .fillColor(colors.text)
         .text('Delivery:', totalsX + 10, totalsY + 40);
      
      if (orderData.delivery_fee === 0) {
        doc.fillColor(colors.secondary).text('FREE', totalsX + 160, totalsY + 40);
      } else {
        doc.fillColor(colors.text).text(this.formatCurrency(orderData.delivery_fee), totalsX + 160, totalsY + 40);
      }
      
      // Total highlight
      doc.roundedRect(totalsX + 5, totalsY + 55, totalsWidth - 10, 20, 4)
         .fillAndStroke('#dbeafe', colors.primary);
      
      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.primary);
      
      doc.text('TOTAL:', totalsX + 10, totalsY + 62);
      doc.text(this.formatCurrency(orderData.total_amount), totalsX + 150, totalsY + 62);
      
      return totalsY + 85;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Order summary error:', error);
      this.generationErrors.push(`Order Summary: ${error.message}`);
      return y + 200;
    }
  }

  // NEW: Enhanced delivery details with coordinates and proper calculations
  async drawDeliveryDetails(doc, orderData, y) {
    try {
      console.log('[ENHANCED-PDF] 🚚 Drawing delivery details with coordinates...');
      
      const { colors, layout } = this.config;
      const sectionHeight = orderData.delivery_method === 'home' ? 120 : 80;
      
      // Section background
      doc.roundedRect(layout.margin, y, layout.contentWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke('#f0f9ff', '#bae6fd');
      
      // Section header
      doc.fontSize(this.config.fonts.heading.size)
         .font(this.config.fonts.heading.font)
         .fillColor(colors.primary)
         .text('DELIVERY INFORMATION', layout.margin + 15, y + 12);

      if (orderData.delivery_method === 'pickup') {
        // Pickup delivery details
        doc.fontSize(this.config.fonts.body.size)
           .font(this.config.fonts.body.font)
           .fillColor(colors.text);

        doc.text(`Method: Pickup Delivery (FREE)`, layout.margin + 15, y + 35);
        doc.text(`Pickup Site: ${orderData.agent.pickup_site.name}`, layout.margin + 15, y + 50);
        doc.text(`Address: ${orderData.agent.pickup_site.address}`, layout.margin + 15, y + 65);

        if (orderData.agent.pickup_site.phone) {
          doc.text(`Contact: ${orderData.agent.pickup_site.phone}`, layout.margin + 300, y + 35);
        }

      } else if (orderData.delivery_method === 'home') {
        // Home delivery details with coordinates and breakdown
        doc.fontSize(this.config.fonts.body.size)
           .font(this.config.fonts.body.font)
           .fillColor(colors.text);

        doc.text(`Method: Home Delivery`, layout.margin + 15, y + 35);
        doc.text(`Address: ${orderData.delivery_address || orderData.buyer_address}`, layout.margin + 15, y + 50);
        
        if (orderData.delivery_coordinates) {
          const coords = orderData.delivery_coordinates;
          doc.text(`Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, layout.margin + 15, y + 65);
        }

        if (orderData.delivery_distance) {
          doc.text(`Distance: ${orderData.delivery_distance} km`, layout.margin + 300, y + 35);
        }

        // Delivery fee breakdown
        const breakdown = orderData.delivery_breakdown;
        if (breakdown && breakdown.notes) {
          doc.fontSize(this.config.fonts.small.size)
             .fillColor(colors.textLight)
             .text(breakdown.notes, layout.margin + 15, y + 80);

          if (orderData.delivery_fee > 0) {
            let breakdownY = y + 95;
            if (breakdown.base_fee > 0) {
              doc.text(`Base fee: ${this.formatCurrency(breakdown.base_fee)}`, layout.margin + 15, breakdownY);
              breakdownY += 12;
            }
            if (breakdown.distance_fee > 0) {
              doc.text(`Distance fee: ${this.formatCurrency(breakdown.distance_fee)}`, layout.margin + 150, y + 95);
            }
            if (breakdown.weight_fee > 0) {
              doc.text(`Weight fee: ${this.formatCurrency(breakdown.weight_fee)}`, layout.margin + 250, y + 95);
            }
            if (breakdown.fragile_fee > 0) {
              doc.text(`Fragile fee: ${this.formatCurrency(breakdown.fragile_fee)}`, layout.margin + 350, y + 95);
            }
          }
        }
      }

      return y + sectionHeight + layout.sectionSpacing;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Delivery details error:', error);
      this.generationErrors.push(`Delivery Details: ${error.message}`);
      return y + 80 + layout.sectionSpacing;
    }
  }

  // Enhanced payment details with FRW currency
  async drawPaymentDetails(doc, orderData, y) {
    try {
      console.log('[ENHANCED-PDF] 💳 Drawing payment details with FRW...');
      
      const { colors, layout } = this.config;
      const sectionHeight = 70;
      
      // Payment section background
      doc.roundedRect(layout.margin, y, layout.contentWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke('#fef7ff', '#e9d5ff');
      
      // Section header
      doc.fontSize(this.config.fonts.heading.size)
         .font(this.config.fonts.heading.font)
         .fillColor(colors.primary)
         .text('PAYMENT DETAILS', layout.margin + 15, y + 12);
      
      // Payment info in columns
      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.text);
      
      // Left column
      doc.text(`Method: ${orderData.payment_method}`, layout.margin + 15, y + 35);
      doc.text(`Amount: ${this.formatCurrency(orderData.total_amount)}`, layout.margin + 15, y + 50);
      
      // Right column
      doc.text(`Payment Time: ${new Date(orderData.created_at).toLocaleString('en-RW', { 
        timeZone: 'Africa/Kigali',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, layout.margin + 300, y + 35);
      
      // Status indicator
      doc.fontSize(this.config.fonts.small.size)
         .fillColor(colors.warning)
         .text('⚠️ Awaiting Admin Approval', layout.margin + 300, y + 50);
      
      return y + sectionHeight + layout.sectionSpacing;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Payment details error:', error);
      this.generationErrors.push(`Payment Details: ${error.message}`);
      return y + 70 + layout.sectionSpacing;
    }
  }

  // Status section with enhanced information
  async drawStatusSection(doc, orderData, y) {
    try {
      console.log('[ENHANCED-PDF] 📊 Drawing status section...');
      
      const { colors, layout } = this.config;
      const sectionHeight = 60;
      
      // Status background
      doc.roundedRect(layout.margin, y, layout.contentWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke('#fff7ed', '#fed7aa');
      
      // Title
      doc.fontSize(this.config.fonts.heading.size)
         .font(this.config.fonts.heading.font)
         .fillColor(colors.primary)
         .text('TRANSACTION STATUS', layout.margin + 15, y + 12);
      
      // Status indicators
      doc.fontSize(this.config.fonts.body.size)
         .font(this.config.fonts.body.font);
      
      // Agent status (left)
      doc.fillColor(colors.secondary)
         .text(`✅ ${orderData.agent.agent_type}: Payment Received`, layout.margin + 15, y + 35);
      
      // Admin status (right)
      doc.fillColor(colors.warning)
         .text('⏳ Admin: Pending Approval', layout.margin + 300, y + 35);
      
      return y + sectionHeight + layout.sectionSpacing;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ Status section error:', error);
      this.generationErrors.push(`Status Section: ${error.message}`);
      return y + 60 + layout.sectionSpacing;
    }
  }

  // Enhanced QR code with Rwanda-specific data
  async drawQRAndSignatures(doc, orderData, receiptId, y) {
    console.log('[ENHANCED-PDF] 🔲 Drawing QR code with Rwanda data...');
    
    const { colors, layout } = this.config;
    const sectionHeight = 80;
    
    try {
      // QR data with Rwanda-specific information
      const qrData = JSON.stringify({
        receiptId: receiptId,
        orderNumber: orderData.order_number,
        amount: orderData.total_amount,
        currency: 'FRW',
        country: 'Rwanda',
        agentId: orderData.agent.id,
        timestamp: Date.now(),
        verifyUrl: `https://africandealsdomain.com/verify/${receiptId}`,
        hash: Buffer.from(`${receiptId}-${orderData.order_number}-${orderData.total_amount}-FRW`).toString('base64').slice(0, 16)
      });

      // Generate QR code with timeout protection
      let qrBuffer = null;
      try {
        console.log('[ENHANCED-PDF] 📱 Generating QR code with Rwanda data...');
        
        const qrUrl = await Promise.race([
          generateQR(qrData, { 
            width: layout.qrSize,
            margin: 2,
            color: {
              dark: colors.primary,
              light: colors.white
            },
            errorCorrectionLevel: 'H'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('QR generation timeout')), 3000)
          )
        ]);
        
        qrBuffer = Buffer.from(qrUrl.split(',')[1], 'base64');
        console.log('[ENHANCED-PDF] ✅ QR code generated successfully');
        
      } catch (qrError) {
        console.warn('[ENHANCED-PDF] ⚠️ QR generation failed:', qrError.message);
        qrBuffer = null;
      }

      // QR Code section (left)
      const qrX = layout.margin;
      const qrWidth = 200;
      
      doc.roundedRect(qrX, y, qrWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke(colors.lightBg, colors.border);
      
      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.primary)
         .text('QR VERIFICATION', qrX + 10, y + 8);
      
      if (qrBuffer) {
        // Draw QR code
        doc.image(qrBuffer, qrX + 10, y + 25, { width: 50, height: 50 });
        
        // QR info
        doc.fontSize(this.config.fonts.small.size)
           .font(this.config.fonts.body.font)
           .fillColor(colors.text);
        
        doc.text(`Receipt: ${receiptId.slice(-8)}`, qrX + 70, y + 30);
        doc.text(`Order: ${orderData.order_number.slice(-8)}`, qrX + 70, y + 45);
        doc.text('Scan to verify (Rwanda)', qrX + 70, y + 60);
        
      } else {
        // QR placeholder
        doc.roundedRect(qrX + 10, y + 25, 50, 50, 4)
           .fillAndStroke(colors.white, colors.border);
        
        doc.fontSize(this.config.fonts.small.size)
           .fillColor(colors.textLight)
           .text('QR\nCode', qrX + 28, y + 45);
      }
      
      // Signatures section (right)
      const sigX = layout.margin + qrWidth + 15;
      const sigWidth = layout.contentWidth - qrWidth - 15;
      
      doc.roundedRect(sigX, y, sigWidth, sectionHeight, layout.cornerRadius)
         .fillAndStroke(colors.lightBg, colors.border);
      
      doc.fontSize(this.config.fonts.subheading.size)
         .font(this.config.fonts.subheading.font)
         .fillColor(colors.primary)
         .text('SIGNATURES', sigX + 10, y + 8);
      
      // Signature boxes
      doc.fontSize(this.config.fonts.small.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.text);
      
      doc.text(`${orderData.agent.agent_type}:`, sigX + 10, y + 30);
      doc.text(orderData.agent.name, sigX + 10, y + 55);
      doc.text('_________________', sigX + 10, y + 65);
      
      // Customer signature
      doc.text('Customer:', sigX + 180, y + 30);
      doc.text(orderData.buyer_name, sigX + 180, y + 55);
      doc.text('_________________', sigX + 180, y + 65);
      
      return y + sectionHeight + layout.sectionSpacing;
      
    } catch (error) {
      console.error('[ENHANCED-PDF] ❌ QR and signatures error:', error);
      this.generationErrors.push(`QR Code: ${error.message}`);
      return y + 80 + layout.sectionSpacing;
    }
  }

  // Enhanced watermark
  async addWatermark(doc) {
    try {
      console.log('[ENHANCED-PDF] 🌊 Adding enhanced watermark...');
      
      // Save the current state
      doc.save();
      
      // Set transparency for watermark
      doc.fillOpacity(0.1);
      
      // Rotate and draw watermark
      doc.rotate(45, { origin: [300, 400] });
      doc.fontSize(40)
         .font('Helvetica-Bold')
         .fillColor(this.config.colors.primary)
         .text('AFRICAN DEALS DOMAIN - RWANDA', 50, 380);
      
      // Restore the previous state
      doc.restore();
      
    } catch (error) {
      console.warn('[ENHANCED-PDF] ⚠️ Watermark error:', error.message);
    }
  }

  // Enhanced footer with proper currency and location
  drawFooter(doc, receiptId, orderData) {
    try {
      console.log('[ENHANCED-PDF] 🦶 Drawing enhanced footer...');
      
      const footerY = 750;
      const { colors } = this.config;
      
      // Footer line
      doc.moveTo(this.config.layout.margin, footerY)
         .lineTo(this.config.layout.margin + this.config.layout.contentWidth, footerY)
         .strokeColor(colors.border)
         .stroke();
      
      // Footer text
      doc.fontSize(this.config.fonts.small.size)
         .font(this.config.fonts.body.font)
         .fillColor(colors.textLight);
      
      doc.text('African Deals Domain • Rwanda • No Hidden Fees • Commission Pre-included', 
               this.config.layout.margin, footerY + 10);
      doc.text(`Generated: ${new Date().toISOString()} • Receipt: ${receiptId} • Currency: FRW`, 
               this.config.layout.margin, footerY + 25);
      
    } catch (error) {
      console.warn('[ENHANCED-PDF] ⚠️ Footer error:', error.message);
    }
  }

  // Error section for debugging
  drawErrorSection(doc, errors) {
    if (errors.length === 0) return;
    
    try {
      console.log('[ENHANCED-PDF] ⚠️ Adding error section...');
      
      const errorY = 700;
      doc.fontSize(this.config.fonts.small.size)
         .fillColor(this.config.colors.error)
         .text('Generation Warnings: ' + errors.join(', '), this.config.layout.margin, errorY);
         
    } catch (error) {
      console.warn('[ENHANCED-PDF] ⚠️ Error section failed:', error.message);
    }
  }
}

module.exports = EnhancedPDFGeneratorFixed;