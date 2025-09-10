/**
 * Delivery Confirmation System API Routes
 * Handles delivery confirmation workflow for orders
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Configure multer for delivery proof uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/delivery-proofs');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `delivery-proof-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Middleware to verify authentication
const verifyAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adminafricandealsdomainpassword');
        
        const userId = decoded.id || decoded.userId;
        const [users] = await pool.execute(
            'SELECT id, email, role FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        console.error('❌ Auth verification failed:', error);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Middleware to verify agent role
const verifyAgent = (req, res, next) => {
    if (req.user.role !== 'agent') {
        return res.status(403).json({ success: false, message: 'Agent access required' });
    }
    next();
};

// Middleware to verify admin role
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// Agent: Submit delivery confirmation
router.post('/submit', verifyAuth, verifyAgent, upload.single('delivery_proof'), async (req, res) => {
    try {
        const { order_id, delivery_notes, customer_signature, delivery_location } = req.body;
        const agent_id = req.user.id;

        console.log(`📦 Agent ${agent_id} submitting delivery confirmation for order ${order_id}`);

        if (!order_id) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Verify order exists and is assigned to this agent
        const [orders] = await pool.execute(`
            SELECT id, status, user_id, total_amount
            FROM orders 
            WHERE id = ? AND status IN ('shipped', 'out_for_delivery')
        `, [order_id]);

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not ready for delivery confirmation'
            });
        }

        const order = orders[0];

        // Create delivery confirmation record
        const delivery_proof_url = req.file ? `/uploads/delivery-proofs/${req.file.filename}` : null;
        
        const [result] = await pool.execute(`
            INSERT INTO delivery_confirmations 
            (order_id, agent_id, delivery_proof_url, delivery_notes, customer_signature, 
             delivery_location, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending_verification', NOW(), NOW())
        `, [order_id, agent_id, delivery_proof_url, delivery_notes, customer_signature, delivery_location]);

        const confirmation_id = result.insertId;

        // Update order status to delivered (pending admin verification)
        await pool.execute(`
            UPDATE orders 
            SET status = 'delivered', updated_at = NOW()
            WHERE id = ?
        `, [order_id]);

        // Log activity
        await pool.execute(`
            INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
            VALUES (?, 'delivery_confirmation_submitted', ?, NOW())
        `, [agent_id, JSON.stringify({
            order_id: order_id,
            confirmation_id: confirmation_id,
            has_proof: !!req.file
        })]);

        console.log(`✅ Delivery confirmation submitted: ${confirmation_id}`);

        res.json({
            success: true,
            message: 'Delivery confirmation submitted successfully',
            confirmation_id: confirmation_id,
            data: {
                order_id: order_id,
                status: 'pending_verification',
                delivery_proof_url: delivery_proof_url
            }
        });

    } catch (error) {
        console.error('❌ Error submitting delivery confirmation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit delivery confirmation',
            error: error.message
        });
    }
});

// Admin: Get pending delivery confirmations
router.get('/pending', verifyAuth, verifyAdmin, async (req, res) => {
    try {
        console.log('📋 Admin fetching pending delivery confirmations...');

        const [confirmations] = await pool.execute(`
            SELECT 
                dc.*,
                o.total_amount,
                o.user_id as buyer_id,
                buyer.name as buyer_name,
                buyer.email as buyer_email,
                buyer.phone as buyer_phone,
                agent.name as agent_name,
                agent.email as agent_email
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            LEFT JOIN users buyer ON o.user_id = buyer.id
            LEFT JOIN users agent ON dc.agent_id = agent.id
            WHERE dc.status = 'pending_verification'
            ORDER BY dc.created_at DESC
        `);

        console.log(`✅ Found ${confirmations.length} pending delivery confirmations`);

        res.json({
            success: true,
            confirmations: confirmations,
            total: confirmations.length
        });

    } catch (error) {
        console.error('❌ Error fetching pending delivery confirmations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending delivery confirmations',
            error: error.message
        });
    }
});

// Admin: Approve delivery confirmation
router.post('/:confirmationId/approve', verifyAuth, verifyAdmin, async (req, res) => {
    try {
        const confirmationId = req.params.confirmationId;
        const { admin_notes } = req.body;
        const admin_id = req.user.id;

        console.log(`✅ Admin ${admin_id} approving delivery confirmation: ${confirmationId}`);

        // Get confirmation details
        const [confirmations] = await pool.execute(`
            SELECT dc.*, o.user_id as buyer_id, o.total_amount
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            WHERE dc.id = ? AND dc.status = 'pending_verification'
        `, [confirmationId]);

        if (confirmations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Delivery confirmation not found or already processed'
            });
        }

        const confirmation = confirmations[0];

        // Update confirmation status
        await pool.execute(`
            UPDATE delivery_confirmations 
            SET status = 'approved', admin_id = ?, admin_notes = ?, 
                verified_at = NOW(), updated_at = NOW()
            WHERE id = ?
        `, [admin_id, admin_notes, confirmationId]);

        // Update order status to completed
        await pool.execute(`
            UPDATE orders 
            SET status = 'completed', updated_at = NOW()
            WHERE id = ?
        `, [confirmation.order_id]);

        // Log admin activity
        await pool.execute(`
            INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
            VALUES (?, 'delivery_confirmation_approved', ?, NOW())
        `, [admin_id, JSON.stringify({
            confirmation_id: confirmationId,
            order_id: confirmation.order_id,
            admin_notes: admin_notes
        })]);

        console.log(`✅ Delivery confirmation approved: ${confirmationId}`);

        res.json({
            success: true,
            message: 'Delivery confirmation approved successfully'
        });

    } catch (error) {
        console.error('❌ Error approving delivery confirmation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve delivery confirmation',
            error: error.message
        });
    }
});

// Admin: Reject delivery confirmation
router.post('/:confirmationId/reject', verifyAuth, verifyAdmin, async (req, res) => {
    try {
        const confirmationId = req.params.confirmationId;
        const { admin_notes, reason } = req.body;
        const admin_id = req.user.id;

        console.log(`❌ Admin ${admin_id} rejecting delivery confirmation: ${confirmationId}`);

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        // Get confirmation details
        const [confirmations] = await pool.execute(`
            SELECT dc.*, o.user_id as buyer_id
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            WHERE dc.id = ? AND dc.status = 'pending_verification'
        `, [confirmationId]);

        if (confirmations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Delivery confirmation not found or already processed'
            });
        }

        const confirmation = confirmations[0];

        // Update confirmation status
        await pool.execute(`
            UPDATE delivery_confirmations 
            SET status = 'rejected', admin_id = ?, admin_notes = ?, 
                rejection_reason = ?, verified_at = NOW(), updated_at = NOW()
            WHERE id = ?
        `, [admin_id, admin_notes, reason, confirmationId]);

        // Revert order status back to shipped
        await pool.execute(`
            UPDATE orders 
            SET status = 'shipped', updated_at = NOW()
            WHERE id = ?
        `, [confirmation.order_id]);

        // Log admin activity
        await pool.execute(`
            INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
            VALUES (?, 'delivery_confirmation_rejected', ?, NOW())
        `, [admin_id, JSON.stringify({
            confirmation_id: confirmationId,
            order_id: confirmation.order_id,
            reason: reason,
            admin_notes: admin_notes
        })]);

        console.log(`❌ Delivery confirmation rejected: ${confirmationId}`);

        res.json({
            success: true,
            message: 'Delivery confirmation rejected successfully'
        });

    } catch (error) {
        console.error('❌ Error rejecting delivery confirmation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject delivery confirmation',
            error: error.message
        });
    }
});

// Get delivery confirmation details
router.get('/:confirmationId', verifyAuth, async (req, res) => {
    try {
        const confirmationId = req.params.confirmationId;

        console.log(`📋 Fetching delivery confirmation details: ${confirmationId}`);

        const [confirmations] = await pool.execute(`
            SELECT 
                dc.*,
                o.total_amount,
                o.user_id as buyer_id,
                buyer.name as buyer_name,
                buyer.email as buyer_email,
                buyer.phone as buyer_phone,
                agent.name as agent_name,
                agent.email as agent_email,
                admin.name as admin_name
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            LEFT JOIN users buyer ON o.user_id = buyer.id
            LEFT JOIN users agent ON dc.agent_id = agent.id
            LEFT JOIN users admin ON dc.admin_id = admin.id
            WHERE dc.id = ?
        `, [confirmationId]);

        if (confirmations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Delivery confirmation not found'
            });
        }

        console.log(`✅ Delivery confirmation details loaded: ${confirmationId}`);

        res.json({
            success: true,
            confirmation: confirmations[0]
        });

    } catch (error) {
        console.error('❌ Error fetching delivery confirmation details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery confirmation details',
            error: error.message
        });
    }
});

// Agent: Get my delivery confirmations
router.get('/agent/my-confirmations', verifyAuth, verifyAgent, async (req, res) => {
    try {
        const agent_id = req.user.id;
        const status = req.query.status;

        console.log(`📋 Agent ${agent_id} fetching delivery confirmations...`);

        let whereClause = 'WHERE dc.agent_id = ?';
        let queryParams = [agent_id];

        if (status) {
            whereClause += ' AND dc.status = ?';
            queryParams.push(status);
        }

        const [confirmations] = await pool.execute(`
            SELECT 
                dc.*,
                o.total_amount,
                buyer.name as buyer_name,
                buyer.phone as buyer_phone
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            LEFT JOIN users buyer ON o.user_id = buyer.id
            ${whereClause}
            ORDER BY dc.created_at DESC
        `, queryParams);

        console.log(`✅ Found ${confirmations.length} delivery confirmations for agent ${agent_id}`);

        res.json({
            success: true,
            confirmations: confirmations,
            total: confirmations.length
        });

    } catch (error) {
        console.error('❌ Error fetching agent delivery confirmations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery confirmations',
            error: error.message
        });
    }
});

module.exports = router;