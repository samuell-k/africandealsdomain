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

// Create system logs and security tables if not exists
async function ensureLogsTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                log_level ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
                category ENUM('auth', 'payment', 'order', 'user', 'system', 'security', 'api') NOT NULL,
                message TEXT NOT NULL,
                details JSON,
                user_id INT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                request_id VARCHAR(100),
                session_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_level (log_level),
                INDEX idx_category (category),
                INDEX idx_user (user_id),
                INDEX idx_created (created_at),
                INDEX idx_ip (ip_address)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS security_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_type ENUM('login_success', 'login_failed', 'password_change', 'account_locked', 
                               'suspicious_activity', 'permission_denied', 'data_access', 'system_breach') NOT NULL,
                severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                user_id INT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                location VARCHAR(255),
                description TEXT,
                metadata JSON,
                status ENUM('new', 'investigating', 'resolved', 'false_positive') DEFAULT 'new',
                resolved_by INT NULL,
                resolved_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_type (event_type),
                INDEX idx_severity (severity),
                INDEX idx_status (status),
                INDEX idx_user (user_id),
                INDEX idx_created (created_at)
            )
        `);
    } catch (error) {
        console.error('Error creating logs tables:', error);
    }
}

// Initialize tables
ensureLogsTables();

// Get system logs
router.get('/logs', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Filters
        const level = req.query.level;
        const category = req.query.category;
        const userId = req.query.user_id;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        // Build query
        let whereClause = '';
        let queryParams = [];

        const conditions = [];

        if (level) {
            conditions.push('log_level = ?');
            queryParams.push(level);
        }

        if (category) {
            conditions.push('category = ?');
            queryParams.push(category);
        }

        if (userId) {
            conditions.push('user_id = ?');
            queryParams.push(userId);
        }

        if (startDate) {
            conditions.push('DATE(created_at) >= ?');
            queryParams.push(startDate);
        }

        if (endDate) {
            conditions.push('DATE(created_at) <= ?');
            queryParams.push(endDate);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM system_logs ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get logs
        const [logs] = await pool.query(`
            SELECT 
                sl.id,
                sl.log_level,
                sl.category,
                sl.message,
                sl.details,
                sl.user_id,
                sl.ip_address,
                sl.created_at,
                u.name as user_name,
                u.email as user_email
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            ${whereClause}
            ORDER BY sl.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-LOGS] Get logs error:', error);
        res.status(500).json({ error: 'Failed to load system logs' });
    }
});

// Get security events
router.get('/security/events', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Filters
        const eventType = req.query.event_type;
        const severity = req.query.severity;
        const status = req.query.status;
        const userId = req.query.user_id;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        // Build query
        let whereClause = '';
        let queryParams = [];

        const conditions = [];

        if (eventType) {
            conditions.push('event_type = ?');
            queryParams.push(eventType);
        }

        if (severity) {
            conditions.push('severity = ?');
            queryParams.push(severity);
        }

        if (status) {
            conditions.push('status = ?');
            queryParams.push(status);
        }

        if (userId) {
            conditions.push('user_id = ?');
            queryParams.push(userId);
        }

        if (startDate) {
            conditions.push('DATE(created_at) >= ?');
            queryParams.push(startDate);
        }

        if (endDate) {
            conditions.push('DATE(created_at) <= ?');
            queryParams.push(endDate);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM security_events ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get security events
        const [events] = await pool.query(`
            SELECT 
                se.id,
                se.event_type,
                se.severity,
                se.user_id,
                se.ip_address,
                se.location,
                se.description,
                se.status,
                se.resolved_by,
                se.resolved_at,
                se.created_at,
                u.name as user_name,
                u.email as user_email,
                r.name as resolved_by_name
            FROM security_events se
            LEFT JOIN users u ON se.user_id = u.id
            LEFT JOIN users r ON se.resolved_by = r.id
            ${whereClause}
            ORDER BY se.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            events,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-LOGS] Get security events error:', error);
        res.status(500).json({ error: 'Failed to load security events' });
    }
});

// Get specific security event
router.get('/security/events/:eventId', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { eventId } = req.params;

        const [events] = await pool.query(`
            SELECT 
                se.id,
                se.event_type,
                se.severity,
                se.user_id,
                se.ip_address,
                se.user_agent,
                se.location,
                se.description,
                se.metadata,
                se.status,
                se.resolved_by,
                se.resolved_at,
                se.created_at,
                u.name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                r.name as resolved_by_name
            FROM security_events se
            LEFT JOIN users u ON se.user_id = u.id
            LEFT JOIN users r ON se.resolved_by = r.id
            WHERE se.id = ?
        `, [eventId]);

        if (events.length === 0) {
            return res.status(404).json({ error: 'Security event not found' });
        }

        res.json({ event: events[0] });
    } catch (error) {
        console.error('[ADMIN-LOGS] Get security event error:', error);
        res.status(500).json({ error: 'Failed to load security event details' });
    }
});

// Resolve security event
router.post('/security/events/:eventId/resolve', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { resolution_note } = req.body;
        const adminUserId = req.user.id;

        // Update security event
        const [result] = await pool.query(`
            UPDATE security_events 
            SET status = 'resolved', resolved_by = ?, resolved_at = NOW()
            WHERE id = ?
        `, [adminUserId, eventId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Security event not found' });
        }

        // Log the resolution
        await pool.query(`
            INSERT INTO system_logs (log_level, category, message, details, user_id)
            VALUES ('info', 'security', 'Security event resolved', ?, ?)
        `, [JSON.stringify({
            event_id: eventId,
            resolved_by: adminUserId,
            resolution_note: resolution_note || 'No additional notes'
        }), adminUserId]);

        res.json({
            success: true,
            message: 'Security event resolved successfully'
        });
    } catch (error) {
        console.error('[ADMIN-LOGS] Resolve security event error:', error);
        res.status(500).json({ error: 'Failed to resolve security event' });
    }
});

// Add system log (internal function for other routes)
async function addSystemLog(level, category, message, details = {}, userId = null, req = null) {
    try {
        const ipAddress = req ? (req.ip || req.connection.remoteAddress) : null;
        const userAgent = req ? req.get('User-Agent') : null;

        await pool.query(`
            INSERT INTO system_logs 
            (log_level, category, message, details, user_id, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [level, category, message, JSON.stringify(details), userId, ipAddress, userAgent]);
    } catch (error) {
        console.error('[SYSTEM-LOG] Add log error:', error);
    }
}

// Add security event (internal function for other routes)
async function addSecurityEvent(eventType, severity, userId, description, metadata = {}, req = null) {
    try {
        const ipAddress = req ? (req.ip || req.connection.remoteAddress) : null;
        const userAgent = req ? req.get('User-Agent') : null;

        await pool.query(`
            INSERT INTO security_events 
            (event_type, severity, user_id, ip_address, user_agent, description, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eventType, severity, userId, ipAddress, userAgent, description, JSON.stringify(metadata)]);
    } catch (error) {
        console.error('[SECURITY-EVENT] Add event error:', error);
    }
}

// Export helper functions
router.addSystemLog = addSystemLog;
router.addSecurityEvent = addSecurityEvent;

module.exports = router;