const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Promisify QRCode generation for better error handling
const generateQR = util.promisify(QRCode.toDataURL);

class EnhancedPDFGenerator {
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
        margin: 20,
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
      }
    };

    // Track errors for debugging
    this.generationErrors = [];
    this.currentY = this.config.layout.margin;
  }

  // [ORIGINAL FILE BACKUP - CONTENT TRUNCATED FOR BREVITY]