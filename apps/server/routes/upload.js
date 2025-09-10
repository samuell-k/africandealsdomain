/**
 * Upload Routes
 * Handles file uploads for payment proofs and other documents
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Import authentication middleware
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/payment-proofs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'payment-proof-' + uniqueSuffix + extension);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/upload/payment-proof - Upload payment proof screenshot
router.post('/payment-proof', authenticateToken, upload.single('paymentProof'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/payment-proofs/${req.file.filename}`;
    const { paymentMethod, orderId } = req.body;
    
    console.log(`[UPLOAD] Payment proof uploaded by user ${req.user.id}: ${fileUrl}`, {
      paymentMethod,
      orderId
    });
    
    // If orderId is provided, update the payment transaction with the proof
    if (orderId) {
      const db = require('../db');
      
      try {
        // Begin transaction
        await db.execute('START TRANSACTION');
        
        // Update payment transaction with proof
        await db.execute(`
          UPDATE payment_transactions 
          SET payment_proof = ?, 
              updated_at = NOW()
          WHERE order_id = ?
        `, [fileUrl, orderId]);
        
        // Check if payment_approvals record exists
        const [existingApproval] = await db.execute(`
          SELECT id FROM payment_approvals 
          WHERE order_id = ? AND status = 'pending'
        `, [orderId]);
        
        if (existingApproval.length > 0) {
          // Update existing approval
          await db.execute(`
            UPDATE payment_approvals 
            SET payment_proof = ?, 
                payment_method = ?,
                updated_at = NOW()
            WHERE order_id = ? AND status = 'pending'
          `, [fileUrl, paymentMethod, orderId]);
        } else {
          // Create new payment approval
          await db.execute(`
            INSERT INTO payment_approvals (
              order_id, payment_method, payment_proof, status, created_at
            ) VALUES (?, ?, ?, 'pending', NOW())
          `, [orderId, paymentMethod, fileUrl]);
        }

        // Mirror into admin_approvals for admin UI (if not already present)
        const [existingAdminApproval] = await db.execute(`
          SELECT id FROM admin_approvals WHERE order_id = ? AND approval_type = 'MANUAL_PAYMENT' AND status = 'pending'
        `, [orderId]);
        if (existingAdminApproval.length === 0) {
          await db.execute(`
            INSERT INTO admin_approvals (
              order_id, approval_type, status, payment_proof, requested_by, created_at
            ) VALUES (?, 'MANUAL_PAYMENT', 'pending', ?, ?, NOW())
          `, [orderId, fileUrl, req.user.id]);
        }
        
        // Update order status to indicate payment proof uploaded
        await db.execute(`
          UPDATE orders 
          SET payment_status = 'pending_confirmation',
              payment_proof_uploaded = 1,
              payment_proof = ?,
              payment_proof_uploaded_at = NOW(),
              updated_at = NOW()
          WHERE id = ?
        `, [fileUrl, orderId]);
        
        // Log the action
        await db.execute(`
          INSERT INTO system_logs (level, message, details, created_at)
          VALUES (?, ?, ?, NOW())
        `, [
          'info',
          `Payment proof uploaded for order #${orderId}`,
          JSON.stringify({
            user_id: req.user.id,
            payment_method: paymentMethod,
            file_url: fileUrl,
            file_size: req.file.size
          })
        ]);
        
        // Commit transaction
        await db.execute('COMMIT');
        
        console.log(`[UPLOAD] Payment proof recorded for order #${orderId}`);
      } catch (dbError) {
        // Rollback transaction on error
        await db.execute('ROLLBACK');
        console.error('[UPLOAD] Database error while recording payment proof:', dbError);
        // Continue with the response, don't fail the upload
      }
    }
    
    res.json({
      success: true,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
  } catch (error) {
    console.error('[UPLOAD] Payment proof upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/product-image - Upload product images (for sellers)
router.post('/product-image', authenticateToken, upload.single('productImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Move to product images directory
    const productImageDir = path.join(__dirname, '../uploads/products');
    if (!fs.existsSync(productImageDir)) {
      fs.mkdirSync(productImageDir, { recursive: true });
    }

    const newPath = path.join(productImageDir, req.file.filename);
    fs.renameSync(req.file.path, newPath);

    const fileUrl = `/uploads/products/${req.file.filename}`;
    
    console.log(`[UPLOAD] Product image uploaded by user ${req.user.id}: ${fileUrl}`);
    
    res.json({
      success: true,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
    
  } catch (error) {
    console.error('[UPLOAD] Product image upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  next(error);
});

module.exports = router;