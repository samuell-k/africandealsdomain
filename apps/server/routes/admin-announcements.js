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

// Create announcements table if not exists
async function ensureAnnouncementsTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                announcement_type ENUM('general', 'maintenance', 'promotion', 'warning', 'update') DEFAULT 'general',
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                target_audience ENUM('all', 'buyers', 'sellers', 'agents', 'admins') DEFAULT 'all',
                status ENUM('draft', 'scheduled', 'active', 'expired', 'cancelled') DEFAULT 'draft',
                scheduled_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_status (status),
                INDEX idx_type (announcement_type),
                INDEX idx_audience (target_audience),
                INDEX idx_scheduled (scheduled_at),
                INDEX idx_expires (expires_at)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notification_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                subject VARCHAR(255) NOT NULL,
                template_type ENUM('email', 'sms', 'push', 'in_app') NOT NULL,
                content TEXT NOT NULL,
                variables JSON,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_type (template_type),
                INDEX idx_active (is_active)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS campaign_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                campaign_name VARCHAR(100) NOT NULL,
                campaign_type ENUM('announcement', 'promotion', 'notification') NOT NULL,
                target_audience ENUM('all', 'buyers', 'sellers', 'agents', 'admins', 'custom') DEFAULT 'all',
                total_recipients INT DEFAULT 0,
                sent_count INT DEFAULT 0,
                delivered_count INT DEFAULT 0,
                failed_count INT DEFAULT 0,
                opened_count INT DEFAULT 0,
                clicked_count INT DEFAULT 0,
                status ENUM('preparing', 'sending', 'completed', 'failed', 'cancelled') DEFAULT 'preparing',
                started_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_type (campaign_type),
                INDEX idx_status (status),
                INDEX idx_created_by (created_by)
            )
        `);
    } catch (error) {
        console.error('Error creating announcements tables:', error);
    }
}

// Initialize tables
ensureAnnouncementsTables();

// Get announcements
router.get('/announcements', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Filters
        const status = req.query.status;
        const type = req.query.type;
        const audience = req.query.audience;

        let whereClause = '';
        let queryParams = [];

        const conditions = [];

        if (status) {
            conditions.push('status = ?');
            queryParams.push(status);
        }

        if (type) {
            conditions.push('announcement_type = ?');
            queryParams.push(type);
        }

        if (audience) {
            conditions.push('target_audience = ?');
            queryParams.push(audience);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM announcements ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get announcements
        const [announcements] = await pool.query(`
            SELECT 
                a.id,
                a.title,
                a.message,
                a.announcement_type,
                a.priority,
                a.target_audience,
                a.status,
                a.scheduled_at,
                a.expires_at,
                a.created_at,
                a.updated_at,
                u.name as created_by_name
            FROM announcements a
            JOIN users u ON a.created_by = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            announcements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Get announcements error:', error);
        res.status(500).json({ error: 'Failed to load announcements' });
    }
});

// Create announcement
router.post('/announcements', authenticateToken, adminAuth, async (req, res) => {
    try {
        const {
            title,
            message,
            announcement_type = 'general',
            priority = 'medium',
            target_audience = 'all',
            scheduled_at,
            expires_at
        } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const status = scheduled_at ? 'scheduled' : 'active';

        const [result] = await pool.query(`
            INSERT INTO announcements 
            (title, message, announcement_type, priority, target_audience, status, scheduled_at, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, message, announcement_type, priority, target_audience, status, scheduled_at, expires_at, req.user.id]);

        res.json({
            success: true,
            message: 'Announcement created successfully',
            announcement_id: result.insertId
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Create announcement error:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// Update announcement
router.put('/announcements/:announcementId', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { announcementId } = req.params;
        const {
            title,
            message,
            announcement_type,
            priority,
            target_audience,
            status,
            scheduled_at,
            expires_at
        } = req.body;

        const [result] = await pool.query(`
            UPDATE announcements 
            SET title = COALESCE(?, title),
                message = COALESCE(?, message),
                announcement_type = COALESCE(?, announcement_type),
                priority = COALESCE(?, priority),
                target_audience = COALESCE(?, target_audience),
                status = COALESCE(?, status),
                scheduled_at = ?,
                expires_at = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [title, message, announcement_type, priority, target_audience, status, scheduled_at, expires_at, announcementId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({
            success: true,
            message: 'Announcement updated successfully'
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Update announcement error:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// Delete announcement
router.delete('/announcements/:announcementId', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { announcementId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM announcements WHERE id = ?',
            [announcementId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

// Get notification templates
router.get('/notification-templates', authenticateToken, adminAuth, async (req, res) => {
    try {
        const [templates] = await pool.query(`
            SELECT 
                nt.id,
                nt.name,
                nt.subject,
                nt.template_type,
                nt.content,
                nt.variables,
                nt.is_active,
                nt.created_at,
                nt.updated_at,
                u.name as created_by_name
            FROM notification_templates nt
            JOIN users u ON nt.created_by = u.id
            ORDER BY nt.template_type, nt.name
        `);

        res.json({ notification_templates: templates });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Get notification templates error:', error);
        res.status(500).json({ error: 'Failed to load notification templates' });
    }
});

// Create notification template
router.post('/notification-templates', authenticateToken, adminAuth, async (req, res) => {
    try {
        const {
            name,
            subject,
            template_type,
            content,
            variables = {}
        } = req.body;

        if (!name || !subject || !template_type || !content) {
            return res.status(400).json({ error: 'Name, subject, type, and content are required' });
        }

        const [result] = await pool.query(`
            INSERT INTO notification_templates 
            (name, subject, template_type, content, variables, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [name, subject, template_type, content, JSON.stringify(variables), req.user.id]);

        res.json({
            success: true,
            message: 'Notification template created successfully',
            template_id: result.insertId
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Create template error:', error);
        res.status(500).json({ error: 'Failed to create notification template' });
    }
});

// Get campaign logs
router.get('/campaign-logs', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM campaign_logs');
        const total = countResult[0].total;

        // Get campaign logs
        const [campaigns] = await pool.query(`
            SELECT 
                cl.id,
                cl.campaign_name,
                cl.campaign_type,
                cl.target_audience,
                cl.total_recipients,
                cl.sent_count,
                cl.delivered_count,
                cl.failed_count,
                cl.opened_count,
                cl.clicked_count,
                cl.status,
                cl.started_at,
                cl.completed_at,
                cl.created_at,
                u.name as created_by_name,
                CASE 
                    WHEN cl.sent_count > 0 THEN ROUND((cl.delivered_count / cl.sent_count) * 100, 2)
                    ELSE 0
                END as delivery_rate,
                CASE 
                    WHEN cl.delivered_count > 0 THEN ROUND((cl.opened_count / cl.delivered_count) * 100, 2)
                    ELSE 0
                END as open_rate
            FROM campaign_logs cl
            JOIN users u ON cl.created_by = u.id
            ORDER BY cl.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            campaigns,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Get campaign logs error:', error);
        res.status(500).json({ error: 'Failed to load campaign logs' });
    }
});

// Send announcement to users (create campaign)
router.post('/announcements/:announcementId/send', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { announcementId } = req.params;

        // Get announcement details
        const [announcements] = await pool.query(
            'SELECT * FROM announcements WHERE id = ?',
            [announcementId]
        );

        if (announcements.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const announcement = announcements[0];

        // Get target users based on audience
        let targetQuery = 'SELECT id, email, name FROM users WHERE status = "active"';
        const queryParams = [];

        if (announcement.target_audience !== 'all') {
            if (announcement.target_audience === 'agents') {
                targetQuery += ' AND role LIKE "%agent%"';
            } else {
                targetQuery += ' AND role = ?';
                queryParams.push(announcement.target_audience.slice(0, -1)); // Remove 's' from 'buyers', 'sellers'
            }
        }

        const [targetUsers] = await pool.query(targetQuery, queryParams);

        // Create campaign log
        const [campaignResult] = await pool.query(`
            INSERT INTO campaign_logs 
            (campaign_name, campaign_type, target_audience, total_recipients, status, started_at, created_by)
            VALUES (?, 'announcement', ?, ?, 'sending', NOW(), ?)
        `, [announcement.title, announcement.target_audience, targetUsers.length, req.user.id]);

        const campaignId = campaignResult.insertId;

        // Simulate sending (in real implementation, you'd integrate with email/SMS services)
        let sentCount = 0;
        let deliveredCount = 0;

        for (const user of targetUsers) {
            try {
                // Simulate sending logic
                console.log(`[CAMPAIGN] Sending announcement "${announcement.title}" to ${user.email}`);
                sentCount++;
                
                // Simulate 90% delivery rate
                if (Math.random() > 0.1) {
                    deliveredCount++;
                }
            } catch (error) {
                console.error(`[CAMPAIGN] Failed to send to ${user.email}:`, error);
            }
        }

        // Update campaign log
        await pool.query(`
            UPDATE campaign_logs 
            SET sent_count = ?, delivered_count = ?, failed_count = ?, status = 'completed', completed_at = NOW()
            WHERE id = ?
        `, [sentCount, deliveredCount, sentCount - deliveredCount, campaignId]);

        res.json({
            success: true,
            message: 'Announcement sent successfully',
            campaign_id: campaignId,
            stats: {
                total_recipients: targetUsers.length,
                sent_count: sentCount,
                delivered_count: deliveredCount,
                failed_count: sentCount - deliveredCount
            }
        });
    } catch (error) {
        console.error('[ADMIN-ANNOUNCEMENTS] Send announcement error:', error);
        res.status(500).json({ error: 'Failed to send announcement' });
    }
});

module.exports = router;