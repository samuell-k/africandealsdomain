const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check admin access
const adminAuth = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Create ads/boosting tables if not exists
async function ensureAdsTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ad_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                seller_id INT NOT NULL,
                product_id INT NOT NULL,
                ad_type ENUM('featured', 'promoted', 'sponsored', 'banner') DEFAULT 'featured',
                duration_days INT DEFAULT 7,
                target_audience JSON,
                budget DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                status ENUM('pending', 'approved', 'rejected', 'active', 'expired', 'paused') DEFAULT 'pending',
                payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
                payment_reference VARCHAR(255),
                admin_notes TEXT,
                approved_by INT NULL,
                approved_at TIMESTAMP NULL,
                starts_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_seller (seller_id),
                INDEX idx_product (product_id),
                INDEX idx_status (status),
                INDEX idx_type (ad_type),
                INDEX idx_expires (expires_at)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS boosted_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad_request_id INT NOT NULL,
                product_id INT NOT NULL,
                seller_id INT NOT NULL,
                boost_type ENUM('featured', 'promoted', 'sponsored', 'banner') DEFAULT 'featured',
                boost_level INT DEFAULT 1,
                priority_score INT DEFAULT 100,
                clicks_count INT DEFAULT 0,
                views_count INT DEFAULT 0,
                conversions_count INT DEFAULT 0,
                budget_spent DECIMAL(10,2) DEFAULT 0,
                cost_per_click DECIMAL(6,4) DEFAULT 0.10,
                is_active BOOLEAN DEFAULT TRUE,
                starts_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (ad_request_id) REFERENCES ad_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_product (product_id),
                INDEX idx_seller (seller_id),
                INDEX idx_active (is_active),
                INDEX idx_expires (expires_at),
                INDEX idx_priority (priority_score)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS ad_analytics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ad_request_id INT NOT NULL,
                boosted_product_id INT NOT NULL,
                date DATE NOT NULL,
                impressions INT DEFAULT 0,
                clicks INT DEFAULT 0,
                conversions INT DEFAULT 0,
                revenue DECIMAL(10,2) DEFAULT 0,
                cost DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ad_request_id) REFERENCES ad_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (boosted_product_id) REFERENCES boosted_products(id) ON DELETE CASCADE,
                UNIQUE KEY unique_ad_date (ad_request_id, date),
                INDEX idx_date (date),
                INDEX idx_boosted_product (boosted_product_id)
            )
        `);
    } catch (error) {
        console.error('Error creating ads tables:', error);
    }
}

// Initialize tables
ensureAdsTables();

// Get ad requests (for admin approval)
router.get('/ad-requests', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Filters
        const status = req.query.status;
        const adType = req.query.ad_type;
        const sellerId = req.query.seller_id;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        // Build query
        let whereClause = '';
        let queryParams = [];

        const conditions = [];

        if (status) {
            conditions.push('ar.status = ?');
            queryParams.push(status);
        }

        if (adType) {
            conditions.push('ar.ad_type = ?');
            queryParams.push(adType);
        }

        if (sellerId) {
            conditions.push('ar.seller_id = ?');
            queryParams.push(sellerId);
        }

        if (startDate) {
            conditions.push('DATE(ar.created_at) >= ?');
            queryParams.push(startDate);
        }

        if (endDate) {
            conditions.push('DATE(ar.created_at) <= ?');
            queryParams.push(endDate);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM ad_requests ar ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get ad requests
        const [requests] = await pool.query(`
            SELECT 
                ar.id,
                ar.ad_type,
                ar.duration_days,
                ar.budget,
                ar.currency,
                ar.status,
                ar.payment_status,
                ar.admin_notes,
                ar.approved_at,
                ar.created_at,
                u.name as seller_name,
                u.email as seller_email,
                p.name as product_name,
                p.price as product_price,
                p.images as product_images,
                admin.name as approved_by_name
            FROM ad_requests ar
            JOIN users u ON ar.seller_id = u.id
            JOIN products p ON ar.product_id = p.id
            LEFT JOIN users admin ON ar.approved_by = admin.id
            ${whereClause}
            ORDER BY ar.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            ad_requests: requests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-ADS] Get ad requests error:', error);
        res.status(500).json({ error: 'Failed to load ad requests' });
    }
});

// Get specific ad request
router.get('/ad-requests/:requestId', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { requestId } = req.params;

        const [requests] = await pool.query(`
            SELECT 
                ar.*,
                u.name as seller_name,
                u.email as seller_email,
                u.phone as seller_phone,
                p.name as product_name,
                p.description as product_description,
                p.price as product_price,
                p.images as product_images,
                p.category_id,
                c.name as category_name,
                admin.name as approved_by_name
            FROM ad_requests ar
            JOIN users u ON ar.seller_id = u.id
            JOIN products p ON ar.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users admin ON ar.approved_by = admin.id
            WHERE ar.id = ?
        `, [requestId]);

        if (requests.length === 0) {
            return res.status(404).json({ error: 'Ad request not found' });
        }

        res.json({ ad_request: requests[0] });
    } catch (error) {
        console.error('[ADMIN-ADS] Get ad request error:', error);
        res.status(500).json({ error: 'Failed to load ad request details' });
    }
});

// Approve ad request
router.post('/ad-requests/:requestId/approve', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { admin_notes, custom_duration } = req.body;
        const adminUserId = req.user.id;

        // Get ad request details
        const [requests] = await pool.query(
            'SELECT * FROM ad_requests WHERE id = ? AND status = "pending"',
            [requestId]
        );

        if (requests.length === 0) {
            return res.status(404).json({ error: 'Ad request not found or already processed' });
        }

        const request = requests[0];
        const duration = custom_duration || request.duration_days;
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + (duration * 24 * 60 * 60 * 1000));

        // Start transaction
        await pool.query('START TRANSACTION');

        // Update ad request
        await pool.query(`
            UPDATE ad_requests 
            SET status = 'approved', 
                approved_by = ?, 
                approved_at = NOW(),
                admin_notes = ?,
                starts_at = ?,
                expires_at = ?
            WHERE id = ?
        `, [adminUserId, admin_notes || '', startDate, endDate, requestId]);

        // Create boosted product entry
        await pool.query(`
            INSERT INTO boosted_products 
            (ad_request_id, product_id, seller_id, boost_type, starts_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [requestId, request.product_id, request.seller_id, request.ad_type, startDate, endDate]);

        await pool.query('COMMIT');

        res.json({
            success: true,
            message: 'Ad request approved successfully',
            starts_at: startDate,
            expires_at: endDate
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('[ADMIN-ADS] Approve ad request error:', error);
        res.status(500).json({ error: 'Failed to approve ad request' });
    }
});

// Reject ad request
router.post('/ad-requests/:requestId/reject', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { admin_notes, refund_amount } = req.body;
        const adminUserId = req.user.id;

        // Update ad request
        const [result] = await pool.query(`
            UPDATE ad_requests 
            SET status = 'rejected', 
                approved_by = ?, 
                approved_at = NOW(),
                admin_notes = ?
            WHERE id = ? AND status = 'pending'
        `, [adminUserId, admin_notes || '', requestId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ad request not found or already processed' });
        }

        // TODO: Process refund if payment was made
        if (refund_amount && refund_amount > 0) {
            console.log(`[ADMIN-ADS] Refund of $${refund_amount} should be processed for request ${requestId}`);
        }

        res.json({
            success: true,
            message: 'Ad request rejected successfully'
        });
    } catch (error) {
        console.error('[ADMIN-ADS] Reject ad request error:', error);
        res.status(500).json({ error: 'Failed to reject ad request' });
    }
});

// Get boosted products
router.get('/boosted-products', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Filters
        const isActive = req.query.is_active;
        const boostType = req.query.boost_type;
        const sellerId = req.query.seller_id;

        // Build query
        let whereClause = '';
        let queryParams = [];

        const conditions = [];

        if (isActive !== undefined) {
            conditions.push('bp.is_active = ?');
            queryParams.push(isActive === 'true' ? 1 : 0);
        }

        if (boostType) {
            conditions.push('bp.boost_type = ?');
            queryParams.push(boostType);
        }

        if (sellerId) {
            conditions.push('bp.seller_id = ?');
            queryParams.push(sellerId);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM boosted_products bp ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get boosted products
        const [boostedProducts] = await pool.query(`
            SELECT 
                bp.id,
                bp.boost_type,
                bp.boost_level,
                bp.priority_score,
                bp.clicks_count,
                bp.views_count,
                bp.conversions_count,
                bp.budget_spent,
                bp.is_active,
                bp.starts_at,
                bp.expires_at,
                bp.created_at,
                p.name as product_name,
                p.price as product_price,
                p.images as product_images,
                u.name as seller_name,
                u.email as seller_email,
                ar.budget as total_budget,
                ar.status as request_status
            FROM boosted_products bp
            JOIN products p ON bp.product_id = p.id
            JOIN users u ON bp.seller_id = u.id
            JOIN ad_requests ar ON bp.ad_request_id = ar.id
            ${whereClause}
            ORDER BY bp.priority_score DESC, bp.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            boosted_products: boostedProducts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-ADS] Get boosted products error:', error);
        res.status(500).json({ error: 'Failed to load boosted products' });
    }
});

// Disable boosted product
router.post('/boosted-products/:productId/disable', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { productId } = req.params;
        const { reason } = req.body;

        // Disable boosted product
        const [result] = await pool.query(
            'UPDATE boosted_products SET is_active = FALSE WHERE id = ?',
            [productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Boosted product not found' });
        }

        // Log the action
        console.log(`[ADMIN-ADS] Disabled boosted product ${productId}. Reason: ${reason || 'No reason provided'}`);

        res.json({
            success: true,
            message: 'Boosted product disabled successfully'
        });
    } catch (error) {
        console.error('[ADMIN-ADS] Disable boosted product error:', error);
        res.status(500).json({ error: 'Failed to disable boosted product' });
    }
});

// Get ads analytics
router.get('/analytics', authenticateToken, adminAuth, async (req, res) => {
    try {
        const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = req.query.end_date || new Date().toISOString().split('T')[0];

        // Get overall statistics
        const [stats] = await pool.query(`
            SELECT 
                COUNT(DISTINCT ar.id) as total_ad_requests,
                COUNT(DISTINCT CASE WHEN ar.status = 'pending' THEN ar.id END) as pending_requests,
                COUNT(DISTINCT CASE WHEN ar.status = 'approved' THEN ar.id END) as approved_requests,
                COUNT(DISTINCT bp.id) as active_boosted_products,
                SUM(bp.views_count) as total_views,
                SUM(bp.clicks_count) as total_clicks,
                SUM(bp.conversions_count) as total_conversions,
                SUM(bp.budget_spent) as total_revenue
            FROM ad_requests ar
            LEFT JOIN boosted_products bp ON ar.id = bp.ad_request_id
            WHERE DATE(ar.created_at) BETWEEN ? AND ?
        `, [startDate, endDate]);

        // Get daily analytics
        const [dailyStats] = await pool.query(`
            SELECT 
                aa.date,
                SUM(aa.impressions) as impressions,
                SUM(aa.clicks) as clicks,
                SUM(aa.conversions) as conversions,
                SUM(aa.revenue) as revenue,
                SUM(aa.cost) as cost
            FROM ad_analytics aa
            WHERE aa.date BETWEEN ? AND ?
            GROUP BY aa.date
            ORDER BY aa.date DESC
        `, [startDate, endDate]);

        // Get top performing ads
        const [topAds] = await pool.query(`
            SELECT 
                bp.id,
                p.name as product_name,
                u.name as seller_name,
                bp.boost_type,
                bp.views_count,
                bp.clicks_count,
                bp.conversions_count,
                bp.budget_spent,
                CASE 
                    WHEN bp.clicks_count > 0 THEN ROUND((bp.conversions_count / bp.clicks_count) * 100, 2)
                    ELSE 0
                END as conversion_rate
            FROM boosted_products bp
            JOIN products p ON bp.product_id = p.id
            JOIN users u ON bp.seller_id = u.id
            WHERE bp.is_active = TRUE
            ORDER BY bp.conversions_count DESC, bp.clicks_count DESC
            LIMIT 10
        `);

        res.json({
            summary: stats[0],
            daily_analytics: dailyStats,
            top_performing_ads: topAds,
            date_range: { start_date: startDate, end_date: endDate }
        });
    } catch (error) {
        console.error('[ADMIN-ADS] Get analytics error:', error);
        res.status(500).json({ error: 'Failed to load ads analytics' });
    }
});

module.exports = router;