/**
 * Escrow Management System API Routes
 * Handles escrow transactions, payment releases, and wallet management
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const db = require('../db');

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

/**
 * GET /api/admin/escrow/transactions
 * Get all escrow transactions
 */
router.get('/transactions', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [];

        if (status) {
            whereClause = 'WHERE e.status = ?';
            params.push(status);
        }

        const query = `
            SELECT 
                e.id, e.order_id, e.amount, e.status, e.created_at,
                e.released_at, e.release_reason, e.hold_reason,
                o.order_number, o.total_amount as order_total,
                buyer.name as buyer_name, buyer.email as buyer_email,
                seller.name as seller_name, seller.email as seller_email,
                admin.name as released_by_admin
            FROM escrow_transactions e
            JOIN orders o ON e.order_id = o.id
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN users admin ON e.released_by = admin.id
            ${whereClause}
            ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));
        const [transactions] = await db.execute(query, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM escrow_transactions e
            JOIN orders o ON e.order_id = o.id
            ${whereClause}
        `;
        const countParams = status ? [status] : [];
        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            success: true,
            transactions: transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching escrow transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch escrow transactions'
        });
    }
});

/**
 * GET /api/admin/escrow/stats
 * Get escrow statistics
 */
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN status = 'held' THEN 1 ELSE 0 END) as held_count,
                SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released_count,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_count,
                SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END) as total_held_amount,
                SUM(CASE WHEN status = 'released' THEN amount ELSE 0 END) as total_released_amount,
                SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as total_refunded_amount,
                AVG(CASE WHEN status = 'released' THEN TIMESTAMPDIFF(HOUR, created_at, released_at) ELSE NULL END) as avg_hold_time_hours
            FROM escrow_transactions
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Get recent activity
        const [recentActivity] = await db.execute(`
            SELECT 
                e.id, e.order_id, e.amount, e.status, e.created_at,
                o.order_number,
                buyer.name as buyer_name,
                seller.name as seller_name
            FROM escrow_transactions e
            JOIN orders o ON e.order_id = o.id
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            ORDER BY e.created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: stats[0] || {
                total_transactions: 0,
                held_count: 0,
                released_count: 0,
                refunded_count: 0,
                total_held_amount: 0,
                total_released_amount: 0,
                total_refunded_amount: 0,
                avg_hold_time_hours: 0
            },
            recent_activity: recentActivity
        });

    } catch (error) {
        console.error('❌ Error fetching escrow stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch escrow statistics'
        });
    }
});

/**
 * POST /api/admin/escrow/:transactionId/release
 * Release escrow payment to seller
 */
router.post('/:transactionId/release', requireAuth, requireAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const transactionId = req.params.transactionId;
        const { release_reason } = req.body;

        // Get escrow transaction details
        const [transactions] = await connection.execute(
            'SELECT id, order_id, amount, status FROM escrow_transactions WHERE id = ?',
            [transactionId]
        );

        if (transactions.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Escrow transaction not found'
            });
        }

        const transaction = transactions[0];
        if (transaction.status !== 'held') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Transaction is not in held status'
            });
        }

        // Update escrow transaction
        await connection.execute(
            'UPDATE escrow_transactions SET status = ?, released_at = NOW(), released_by = ?, release_reason = ? WHERE id = ?',
            ['released', req.user.id, release_reason || 'Manual release by admin', transactionId]
        );

        // Get order and seller details
        const [orders] = await connection.execute(
            'SELECT seller_id FROM orders WHERE id = ?',
            [transaction.order_id]
        );

        if (orders.length > 0) {
            const sellerId = orders[0].seller_id;
            
            // Update seller wallet
            await connection.execute(`
                INSERT INTO wallet_transactions 
                (user_id, type, amount, description, reference_id, created_at)
                VALUES (?, 'credit', ?, ?, ?, NOW())
            `, [sellerId, transaction.amount, `Escrow release for order`, transaction.order_id]);

            // Update seller balance
            await connection.execute(`
                INSERT INTO user_wallets (user_id, balance, updated_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                balance = balance + VALUES(balance),
                updated_at = NOW()
            `, [sellerId, transaction.amount]);
        }

        // Log the action
        await connection.execute(`
            INSERT INTO admin_actions 
            (admin_id, action_type, target_type, target_id, description, created_at)
            VALUES (?, 'escrow_release', 'escrow_transaction', ?, ?, NOW())
        `, [req.user.id, transactionId, `Released escrow payment: ${release_reason || 'Manual release'}`]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Escrow payment released successfully',
            transaction_id: transactionId
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error releasing escrow payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to release escrow payment'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/admin/escrow/:transactionId/refund
 * Refund escrow payment to buyer
 */
router.post('/:transactionId/refund', requireAuth, requireAdmin, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const transactionId = req.params.transactionId;
        const { refund_reason } = req.body;

        // Get escrow transaction details
        const [transactions] = await connection.execute(
            'SELECT id, order_id, amount, status FROM escrow_transactions WHERE id = ?',
            [transactionId]
        );

        if (transactions.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Escrow transaction not found'
            });
        }

        const transaction = transactions[0];
        if (transaction.status !== 'held') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Transaction is not in held status'
            });
        }

        // Update escrow transaction
        await connection.execute(
            'UPDATE escrow_transactions SET status = ?, released_at = NOW(), released_by = ?, release_reason = ? WHERE id = ?',
            ['refunded', req.user.id, refund_reason || 'Manual refund by admin', transactionId]
        );

        // Get order and buyer details
        const [orders] = await connection.execute(
            'SELECT buyer_id FROM orders WHERE id = ?',
            [transaction.order_id]
        );

        if (orders.length > 0) {
            const buyerId = orders[0].buyer_id;
            
            // Update buyer wallet
            await connection.execute(`
                INSERT INTO wallet_transactions 
                (user_id, type, amount, description, reference_id, created_at)
                VALUES (?, 'credit', ?, ?, ?, NOW())
            `, [buyerId, transaction.amount, `Escrow refund for order`, transaction.order_id]);

            // Update buyer balance
            await connection.execute(`
                INSERT INTO user_wallets (user_id, balance, updated_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                balance = balance + VALUES(balance),
                updated_at = NOW()
            `, [buyerId, transaction.amount]);
        }

        // Log the action
        await connection.execute(`
            INSERT INTO admin_actions 
            (admin_id, action_type, target_type, target_id, description, created_at)
            VALUES (?, 'escrow_refund', 'escrow_transaction', ?, ?, NOW())
        `, [req.user.id, transactionId, `Refunded escrow payment: ${refund_reason || 'Manual refund'}`]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Escrow payment refunded successfully',
            transaction_id: transactionId
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error refunding escrow payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refund escrow payment'
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/admin/wallets
 * Get user wallet information
 */
router.get('/wallets', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, user_type } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [];

        if (user_type) {
            whereClause = 'WHERE u.role = ?';
            params.push(user_type);
        }

        const query = `
            SELECT 
                u.id, u.name, u.email, u.role,
                COALESCE(w.balance, 0) as wallet_balance,
                w.updated_at as wallet_updated_at,
                (SELECT COUNT(*) FROM wallet_transactions wt WHERE wt.user_id = u.id) as transaction_count,
                (SELECT SUM(amount) FROM wallet_transactions wt WHERE wt.user_id = u.id AND wt.type = 'credit') as total_credits,
                (SELECT SUM(amount) FROM wallet_transactions wt WHERE wt.user_id = u.id AND wt.type = 'debit') as total_debits
            FROM users u
            LEFT JOIN user_wallets w ON u.id = w.user_id
            ${whereClause}
            ORDER BY w.balance DESC, u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));
        const [wallets] = await db.execute(query, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            ${whereClause}
        `;
        const countParams = user_type ? [user_type] : [];
        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            success: true,
            wallets: wallets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching wallet information:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wallet information'
        });
    }
});

/**
 * GET /api/admin/payment-methods
 * Get payment methods configuration
 */
router.get('/payment-methods', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [methods] = await db.execute(`
            SELECT 
                id, name, type, status, configuration,
                created_at, updated_at
            FROM payment_methods
            ORDER BY name ASC
        `);

        res.json({
            success: true,
            payment_methods: methods
        });

    } catch (error) {
        console.error('❌ Error fetching payment methods:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment methods'
        });
    }
});

/**
 * PUT /api/admin/payment-methods/:methodId
 * Update payment method configuration
 */
router.put('/payment-methods/:methodId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const methodId = req.params.methodId;
        const { name, status, configuration } = req.body;

        await db.execute(
            'UPDATE payment_methods SET name = ?, status = ?, configuration = ?, updated_at = NOW() WHERE id = ?',
            [name, status, JSON.stringify(configuration), methodId]
        );

        // Log the action
        await db.execute(`
            INSERT INTO admin_actions 
            (admin_id, action_type, target_type, target_id, description, created_at)
            VALUES (?, 'payment_method_update', 'payment_method', ?, ?, NOW())
        `, [req.user.id, methodId, `Updated payment method: ${name}`]);

        res.json({
            success: true,
            message: 'Payment method updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating payment method:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment method'
        });
    }
});

module.exports = router;