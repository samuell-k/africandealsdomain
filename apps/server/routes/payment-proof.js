const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `payment-proof-${timestamp}-${randomString}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPG, PNG, GIF) and PDF files are allowed'));
    }
  }
});

// POST /api/payment-proof - Submit payment proof
router.post('/', requireAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const {
      sender_name,
      payment_method,
      sender_phone,
      transaction_id,
      notes,
      order_id,
      order_number,
      amount,
      payment_transaction_id
    } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('📤 Payment proof submission received:', {
      user: req.user.email,
      order_id,
      payment_method,
      transaction_id: transaction_id?.substring(0, 10) + '...' // Log partial for security
    });

    // Validate required fields
    if (!sender_name || !payment_method || !sender_phone || !transaction_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sender_name, payment_method, sender_phone, transaction_id'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Payment screenshot/receipt is required'
      });
    }

    // Verify user can submit for this order
    if (order_id) {
      const [orderCheck] = await pool.query(`
        SELECT id, user_id, order_number, total_amount, status 
        FROM orders 
        WHERE id = ? AND user_id = ?
      `, [order_id, userId]);

      if (orderCheck.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Order not found or you do not have permission to submit payment for this order'
        });
      }

      const order = orderCheck[0];
      console.log('✅ Order verification passed:', order.order_number);
    }

    // Check if payment proof already exists for this order
    const [existingProof] = await pool.query(`
      SELECT id, status FROM payment_proofs 
      WHERE order_id = ? AND user_id = ?
    `, [order_id, userId]);

    if (existingProof.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Payment proof already submitted for this order',
        existing_status: existingProof[0].status
      });
    }

    // Store payment proof in database
    const screenshotPath = req.file ? `/uploads/payment-proofs/${req.file.filename}` : null;
    
    const [result] = await pool.query(`
      INSERT INTO payment_proofs (
        user_id,
        order_id,
        payment_transaction_id,
        sender_name,
        payment_method,
        sender_phone,
        transaction_id,
        screenshot_path,
        notes,
        amount,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      userId,
      order_id || null,
      payment_transaction_id || null,
      sender_name,
      payment_method,
      sender_phone,
      transaction_id,
      screenshotPath,
      notes || null,
      amount || null
    ]);

    const paymentProofId = result.insertId;

    // Update order status to 'payment_submitted' if order exists
    if (order_id) {
      await pool.query(`
        UPDATE orders 
        SET status = 'payment_submitted', 
            payment_proof = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [screenshotPath, order_id]);

      console.log('📦 Order status updated to payment_submitted for order:', order_id);

      // Mirror into admin_approvals for visibility in admin dashboard
      try {
        await pool.query(`
          INSERT INTO admin_approvals (
            order_id,
            approval_type,
            status,
            payment_proof,
            amount,
            requested_by,
            created_at
          ) VALUES (?, 'MANUAL_PAYMENT', 'pending', ?, ?, ?, NOW())
        `, [order_id, screenshotPath, amount || null, userId]);
        console.log('🗂️ admin_approvals entry created for order:', order_id);
      } catch (mirrorErr) {
        console.warn('⚠️ Failed to mirror to admin_approvals:', mirrorErr.message);
      }

      // Also ensure legacy payment_approvals table is updated if it exists
      try {
        await pool.query(`
          INSERT INTO payment_approvals (order_id, payment_method, payment_proof, status, created_at)
          VALUES (?, ?, ?, 'pending', NOW())
        `, [order_id, payment_method, screenshotPath]);
        console.log('🗂️ payment_approvals entry created for order:', order_id);
      } catch (legacyErr) {
        console.warn('⚠️ payment_approvals mirror skipped or failed:', legacyErr.message);
      }
    }

    // Log the submission
    await pool.query(`
      INSERT INTO admin_activity_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, 'payment_proof_submitted', 'payment_proof', ?, ?, NOW())
    `, [
      userId,
      paymentProofId,
      JSON.stringify({
        order_id,
        payment_method,
        amount,
        transaction_id: transaction_id?.substring(0, 10) + '...'
      })
    ]);

    // Send notification email to admin (optional)
    try {
      const { sendTemplatedEmail } = require('../utils/email');
      
      await sendTemplatedEmail(
        'admin@africandealsdomain.com',
        `New Payment Proof Submitted - Order ${order_number || order_id}`,
        'admin-payment-proof-notification',
        {
          orderNumber: order_number || `#${order_id}`,
          senderName: sender_name,
          paymentMethod: payment_method,
          transactionId: transaction_id,
          amount: amount,
          adminUrl: 'https://africandealsdomain.com/admin/payments',
          verifyUrl: `https://africandealsdomain.com/admin/payment-proof/${paymentProofId}`
        }
      );
      console.log('[EMAIL SUCCESS] Admin notification sent for payment proof');
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send admin notification:', emailError.message);
      // Continue without failing - email is optional
    }

    res.json({
      success: true,
      message: 'Payment proof submitted successfully',
      data: {
        id: paymentProofId,
        status: 'pending',
        estimated_verification_time: '1-24 hours'
      }
    });

    console.log('✅ Payment proof submitted successfully:', {
      id: paymentProofId,
      user: req.user.email,
      order_id,
      payment_method
    });

  } catch (error) {
    console.error('❌ Error submitting payment proof:', error);

    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    let errorMessage = 'Failed to submit payment proof';
    let statusCode = 500;

    if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'File size too large. Maximum size is 5MB.';
      statusCode = 400;
    } else if (error.message.includes('Only images')) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection failed. Please try again.';
      statusCode = 503;
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Payment system not properly configured. Please contact support.';
      statusCode = 500;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/payment-proof/:id - Get payment proof details (for admins)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const proofId = req.params.id;
    const userRole = req.user.role;

    // Only admins can view payment proof details
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const [proofs] = await pool.query(`
      SELECT 
        pp.*,
        u.name as user_name,
        u.email as user_email,
        o.order_number,
        o.total_amount as order_amount
      FROM payment_proofs pp
      LEFT JOIN users u ON pp.user_id = u.id
      LEFT JOIN orders o ON pp.order_id = o.id
      WHERE pp.id = ?
    `, [proofId]);

    if (proofs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment proof not found'
      });
    }

    res.json({
      success: true,
      payment_proof: proofs[0]
    });

  } catch (error) {
    console.error('Error fetching payment proof:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment proof details'
    });
  }
});

// GET /api/payment-proof/pending - Get all pending payment proofs for admin
router.get('/pending', requireAuth, async (req, res) => {
  try {
    // Only admins can view pending payment proofs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const [proofs] = await pool.query(`
      SELECT 
        pp.*,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        COALESCE(o.order_number, mo.order_number) as order_number,
        COALESCE(o.total_amount, mo.total_amount) as order_amount,
        COALESCE(o.status, mo.status) as order_status,
        CASE 
          WHEN pp.order_type = 'manual_order' THEN 'Manual Order (PSM)' 
          ELSE 'Regular Order' 
        END as order_type_display
      FROM payment_proofs pp
      LEFT JOIN users u ON pp.user_id = u.id
      LEFT JOIN orders o ON pp.order_id = o.id AND pp.order_type != 'manual_order'
      LEFT JOIN manual_orders mo ON pp.order_id = mo.id AND pp.order_type = 'manual_order'
      ORDER BY pp.created_at DESC
    `);

    res.json({
      success: true,
      approvals: proofs
    });

  } catch (error) {
    console.error('Error fetching pending payment proofs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment proofs'
    });
  }
});

// POST /api/payment-proof/:id/approve - Approve payment proof
router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const proofId = req.params.id;
    const { notes } = req.body;
    const adminId = req.user.id;

    // Only admins can approve payment proofs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Get payment proof details
    const [proofs] = await pool.query(`
      SELECT pp.*, o.id as order_id, o.order_number, u.email as buyer_email
      FROM payment_proofs pp
      LEFT JOIN orders o ON pp.order_id = o.id
      LEFT JOIN users u ON pp.user_id = u.id
      WHERE pp.id = ?
    `, [proofId]);

    if (proofs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment proof not found'
      });
    }

    const proof = proofs[0];

    // Check if already processed
    if (proof.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Payment proof already ${proof.status}`
      });
    }

    // Update payment proof status
    await pool.query(`
      UPDATE payment_proofs 
      SET status = 'approved', 
          admin_id = ?, 
          admin_notes = ?, 
          processed_at = NOW()
      WHERE id = ?
    `, [adminId, notes || null, proofId]);

    // Update order status if order exists
    if (proof.order_id) {
      if (proof.order_type === 'manual_order') {
        // Update manual order status for PSM orders
        await pool.query(`
          UPDATE manual_orders 
          SET status = 'payment_approved',
              payment_verified = 1,
              updated_at = NOW()
          WHERE id = ?
        `, [proof.order_id]);

        console.log(`✅ Manual order ${proof.order_number} payment verified by admin`);

        // Approve PSM commission and credit agent balance for this manual order
        try {
          // Find pending commission for this manual order
          const [commRows] = await pool.query(`
            SELECT id, agent_id, commission_amount
            FROM psm_commissions
            WHERE order_id = ? AND order_type = 'manual' AND status = 'pending'
            ORDER BY id DESC
            LIMIT 1
          `, [proof.order_id]);

          if (commRows.length > 0) {
            const comm = commRows[0];

            // Approve commission
            await pool.query(`
              UPDATE psm_commissions
              SET status = 'approved', updated_at = NOW()
              WHERE id = ?
            `, [comm.id]);

            // Record earnings transaction
            await pool.query(`
              INSERT INTO agent_earnings (agent_id, amount, earnings_type, reference_id, status, earned_at)
              VALUES (?, ?, 'psm_manual', ?, 'available', NOW())
            `, [comm.agent_id, comm.commission_amount, proof.order_id]);

            // Update agent summary
            await pool.query(`
              UPDATE agents
              SET total_earnings = COALESCE(total_earnings, 0) + ?,
                  updated_at = NOW()
              WHERE id = ?
            `, [comm.commission_amount, comm.agent_id]);

            console.log(`💸 PSM commission approved and credited for manual order ${proof.order_number}`);
          } else {
            console.log('ℹ️ No pending PSM commission found for this manual order');
          }
        } catch (commissionError) {
          console.error('❌ Error approving/crediting PSM commission:', commissionError.message);
          // Do not fail payment approval if commission crediting fails
        }
      } else {
        // Update regular order status
        await pool.query(`
          UPDATE orders 
          SET status = 'payment_verified', 
              payment_status = 'confirmed',
              updated_at = NOW()
          WHERE id = ?
        `, [proof.order_id]);

        console.log(`✅ Order ${proof.order_number} payment verified by admin`);

        // 🎯 REFERRAL SYSTEM: Complete referral when payment is approved
        try {
          // Get order details to check for referral code
          const [orderDetails] = await pool.query(`
            SELECT o.*, u.referral_code_used 
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
          `, [proof.order_id]);

          if (orderDetails.length > 0 && orderDetails[0].referral_code_used) {
            const order = orderDetails[0];
            
            // Call referral completion API
            const axios = require('axios');
            const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
            
            try {
              const response = await axios.post(`${baseUrl}/api/referrals/complete-order-referral`, {
                order_id: proof.order_id,
                referral_code: order.referral_code_used,
                user_id: order.user_id
              });

              if (response.data.success) {
                console.log(`🎉 Referral completed for order ${proof.order_number}, referral code: ${order.referral_code_used}`);
              }
            } catch (referralError) {
              console.error('❌ Failed to complete referral:', referralError.message);
              // Don't fail payment approval if referral completion fails
            }
          }
        } catch (referralCheckError) {
          console.error('❌ Error checking referral for order:', referralCheckError.message);
          // Don't fail payment approval if referral check fails
        }
      }
    }

    // Log admin action
    await pool.query(`
      INSERT INTO admin_activity_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, 'payment_proof_approved', 'payment_proof', ?, ?, NOW())
    `, [
      adminId,
      proofId,
      JSON.stringify({
        order_number: proof.order_number,
        amount: proof.amount,
        payment_method: proof.payment_method,
        notes: notes
      })
    ]);

    // Send confirmation email to buyer (optional)
    try {
      const { sendTemplatedEmail } = require('../utils/email');
      
      if (proof.buyer_email) {
        await sendTemplatedEmail(
          proof.buyer_email,
          `Payment Verified - Order ${proof.order_number}`,
          'buyer-payment-approved',
          {
            orderNumber: proof.order_number,
            amount: proof.amount,
            paymentMethod: proof.payment_method,
            dashboardUrl: 'https://africandealsdomain.com/buyer/orders'
          }
        );
        console.log('[EMAIL SUCCESS] Payment approval notification sent to buyer');
      }
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send buyer notification:', emailError.message);
      // Continue without failing - email is optional
    }

    res.json({
      success: true,
      message: 'Payment proof approved successfully',
      data: {
        id: proofId,
        status: 'approved',
        order_status: proof.order_id ? 'payment_verified' : null
      }
    });

    console.log(`✅ Payment proof ${proofId} approved by admin ${req.user.email}`);

  } catch (error) {
    console.error('Error approving payment proof:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve payment proof'
    });
  }
});

// POST /api/payment-proof/:id/reject - Reject payment proof
router.post('/:id/reject', requireAuth, async (req, res) => {
  try {
    const proofId = req.params.id;
    const { reason } = req.body;
    const adminId = req.user.id;

    // Only admins can reject payment proofs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    // Get payment proof details
    const [proofs] = await pool.query(`
      SELECT pp.*, o.id as order_id, o.order_number, u.email as buyer_email
      FROM payment_proofs pp
      LEFT JOIN orders o ON pp.order_id = o.id
      LEFT JOIN users u ON pp.user_id = u.id
      WHERE pp.id = ?
    `, [proofId]);

    if (proofs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment proof not found'
      });
    }

    const proof = proofs[0];

    // Check if already processed
    if (proof.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Payment proof already ${proof.status}`
      });
    }

    // Update payment proof status
    await pool.query(`
      UPDATE payment_proofs 
      SET status = 'rejected', 
          admin_id = ?, 
          admin_notes = ?, 
          processed_at = NOW()
      WHERE id = ?
    `, [adminId, reason, proofId]);

    // Update order status if order exists
    if (proof.order_id) {
      if (proof.order_type === 'manual_order') {
        // Update manual order status for PSM orders
        await pool.query(`
          UPDATE manual_orders 
          SET status = 'payment_rejected',
              payment_verified = 0,
              updated_at = NOW()
          WHERE id = ?
        `, [proof.order_id]);

        console.log(`❌ Manual order ${proof.order_number} payment rejected by admin`);
      } else {
        // Update regular order status
        await pool.query(`
          UPDATE orders 
          SET status = 'payment_rejected', 
              payment_status = 'failed',
              updated_at = NOW()
          WHERE id = ?
        `, [proof.order_id]);

        console.log(`❌ Order ${proof.order_number} payment rejected by admin`);
      }
    }

    // Log admin action
    await pool.query(`
      INSERT INTO admin_activity_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, 'payment_proof_rejected', 'payment_proof', ?, ?, NOW())
    `, [
      adminId,
      proofId,
      JSON.stringify({
        order_number: proof.order_number,
        amount: proof.amount,
        payment_method: proof.payment_method,
        reason: reason
      })
    ]);

    // Send rejection email to buyer (optional)
    try {
      const { sendTemplatedEmail } = require('../utils/email');
      
      if (proof.buyer_email) {
        await sendTemplatedEmail(
          proof.buyer_email,
          `Payment Verification Failed - Order ${proof.order_number}`,
          'buyer-payment-rejected',
          {
            orderNumber: proof.order_number,
            amount: proof.amount,
            paymentMethod: proof.payment_method,
            reason: reason,
            resubmitUrl: 'https://africandealsdomain.com/buyer/payment-proof'
          }
        );
        console.log('[EMAIL SUCCESS] Payment rejection notification sent to buyer');
      }
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send buyer notification:', emailError.message);
      // Continue without failing - email is optional
    }

    res.json({
      success: true,
      message: 'Payment proof rejected',
      data: {
        id: proofId,
        status: 'rejected',
        reason: reason,
        order_status: proof.order_id ? 'payment_rejected' : null
      }
    });

    console.log(`❌ Payment proof ${proofId} rejected by admin ${req.user.email}: ${reason}`);

  } catch (error) {
    console.error('Error rejecting payment proof:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject payment proof'
    });
  }
});

// GET /api/payment-proof/stats - Get payment proof statistics for admin
router.get('/stats', requireAuth, async (req, res) => {
  try {
    // Only admins can view statistics
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Get various statistics
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_proofs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'approved' AND DATE(processed_at) = CURDATE() THEN 1 ELSE 0 END) as approved_today,
        SUM(CASE WHEN status = 'rejected' AND DATE(processed_at) = CURDATE() THEN 1 ELSE 0 END) as rejected_today,
        SUM(CASE WHEN status = 'pending' THEN COALESCE(amount, 0) ELSE 0 END) as pending_value
      FROM payment_proofs
    `);

    res.json({
      success: true,
      stats: stats[0] || {
        total_proofs: 0,
        pending_count: 0,
        approved_count: 0,
        rejected_count: 0,
        approved_today: 0,
        rejected_today: 0,
        pending_value: 0
      }
    });

  } catch (error) {
    console.error('Error fetching payment proof stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;