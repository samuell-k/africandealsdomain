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

// Get all agents (for admin)
router.get('/agents', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Filters
        const status = req.query.status;
        const agentType = req.query.agent_type;
        const location = req.query.location;
        
        let whereClause = "WHERE u.role LIKE '%agent%'";
        let queryParams = [];

        if (status) {
            whereClause += ' AND u.status = ?';
            queryParams.push(status);
        }

        if (agentType) {
            whereClause += ' AND u.role = ?';
            queryParams.push(agentType);
        }

        if (location) {
            whereClause += ' AND u.location LIKE ?';
            queryParams.push(`%${location}%`);
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM users u ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get agents
        const [agents] = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.phone,
                u.role,
                u.status,
                u.location,
                u.wallet_balance,
                u.commission_balance,
                u.created_at,
                u.last_login,
                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
                AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END) as avg_rating
            FROM users u
            LEFT JOIN orders o ON u.id = o.agent_id
            LEFT JOIN reviews r ON u.id = r.agent_id
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            agents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Get agents error:', error);
        res.status(500).json({ error: 'Failed to load agents' });
    }
});

// Get specific agent details
router.get('/agents/:agentId', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { agentId } = req.params;

        const [agents] = await pool.query(`
            SELECT 
                u.*,
                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
                COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_orders,
                SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount END) as total_revenue,
                AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END) as avg_rating,
                COUNT(DISTINCT r.id) as total_reviews
            FROM users u
            LEFT JOIN orders o ON u.id = o.agent_id
            LEFT JOIN reviews r ON u.id = r.agent_id
            WHERE u.id = ? AND u.role LIKE '%agent%'
            GROUP BY u.id
        `, [agentId]);

        if (agents.length === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Get recent orders
        const [recentOrders] = await pool.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.total_amount,
                o.created_at,
                buyer.name as buyer_name
            FROM orders o
            LEFT JOIN users buyer ON o.user_id = buyer.id
            WHERE o.agent_id = ?
            ORDER BY o.created_at DESC
            LIMIT 10
        `, [agentId]);

        // Get recent reviews
        const [recentReviews] = await pool.query(`
            SELECT 
                r.rating,
                r.comment,
                r.created_at,
                buyer.name as buyer_name
            FROM reviews r
            JOIN users buyer ON r.buyer_id = buyer.id
            WHERE r.agent_id = ?
            ORDER BY r.created_at DESC
            LIMIT 5
        `, [agentId]);

        res.json({
            agent: {
                ...agents[0],
                recent_orders: recentOrders,
                recent_reviews: recentReviews
            }
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Get agent details error:', error);
        res.status(500).json({ error: 'Failed to load agent details' });
    }
});

// Approve agent
router.post('/agents/:agentId/approve', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { admin_notes } = req.body;
        const adminUserId = req.user.id;

        // Update agent status
        const [result] = await pool.query(`
            UPDATE users 
            SET status = 'active', updated_at = NOW()
            WHERE id = ? AND role LIKE '%agent%'
        `, [agentId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Log the approval
        await pool.query(`
            INSERT INTO system_logs (log_level, category, message, details, user_id)
            VALUES ('info', 'user', 'Agent approved by admin', ?, ?)
        `, [JSON.stringify({
            agent_id: agentId,
            approved_by: adminUserId,
            admin_notes: admin_notes || 'No additional notes'
        }), adminUserId]);

        res.json({
            success: true,
            message: 'Agent approved successfully'
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Approve agent error:', error);
        res.status(500).json({ error: 'Failed to approve agent' });
    }
});

// Suspend agent
router.post('/agents/:agentId/suspend', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { reason, admin_notes } = req.body;
        const adminUserId = req.user.id;

        if (!reason) {
            return res.status(400).json({ error: 'Suspension reason is required' });
        }

        // Update agent status
        const [result] = await pool.query(`
            UPDATE users 
            SET status = 'suspended', updated_at = NOW()
            WHERE id = ? AND role LIKE '%agent%'
        `, [agentId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Log the suspension
        await pool.query(`
            INSERT INTO system_logs (log_level, category, message, details, user_id)
            VALUES ('warning', 'user', 'Agent suspended by admin', ?, ?)
        `, [JSON.stringify({
            agent_id: agentId,
            suspended_by: adminUserId,
            reason: reason,
            admin_notes: admin_notes || 'No additional notes'
        }), adminUserId]);

        res.json({
            success: true,
            message: 'Agent suspended successfully'
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Suspend agent error:', error);
        res.status(500).json({ error: 'Failed to suspend agent' });
    }
});

// Get agent registrations (pending approvals)
router.get('/agent-registrations', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const status = req.query.status || 'pending';

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM users WHERE role LIKE '%agent%' AND status = ?`,
            [status]
        );
        const total = countResult[0].total;

        // Get registrations
        const [registrations] = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.phone,
                u.role,
                u.status,
                u.location,
                u.created_at,
                u.bio,
                u.experience
            FROM users u
            WHERE u.role LIKE '%agent%' AND u.status = ?
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [status, limit, offset]);

        res.json({
            registrations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Get registrations error:', error);
        res.status(500).json({ error: 'Failed to load agent registrations' });
    }
});

// Update agent registration status
router.put('/agent-registration/:registrationId/status', authenticateToken, adminAuth, async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { status, admin_notes } = req.body;
        const adminUserId = req.user.id;

        const validStatuses = ['pending', 'approved', 'rejected', 'active', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Update registration status
        const [result] = await pool.query(`
            UPDATE users 
            SET status = ?, updated_at = NOW()
            WHERE id = ? AND role LIKE '%agent%'
        `, [status, registrationId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Agent registration not found' });
        }

        // Log the status change
        await pool.query(`
            INSERT INTO system_logs (log_level, category, message, details, user_id)
            VALUES ('info', 'user', 'Agent registration status updated', ?, ?)
        `, [JSON.stringify({
            agent_id: registrationId,
            new_status: status,
            updated_by: adminUserId,
            admin_notes: admin_notes || 'No additional notes'
        }), adminUserId]);

        res.json({
            success: true,
            message: 'Agent registration status updated successfully'
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Update registration status error:', error);
        res.status(500).json({ error: 'Failed to update registration status' });
    }
});

// Get agent types
router.get('/agent-types', authenticateToken, adminAuth, async (req, res) => {
    try {
        const agentTypes = [
            {
                id: 'agent',
                name: 'Standard Agent',
                description: 'Regular delivery agent for standard orders',
                requirements: ['Valid ID', 'Phone verification'],
                commission_rate: 5.0
            },
            {
                id: 'fast-delivery-agent',
                name: 'Fast Delivery Agent',
                description: 'Express delivery agent for urgent orders',
                requirements: ['Valid ID', 'Phone verification', 'Vehicle ownership'],
                commission_rate: 7.0
            },
            {
                id: 'pickup-delivery-agent',
                name: 'Pickup Delivery Agent',
                description: 'Agent for pickup and delivery services',
                requirements: ['Valid ID', 'Phone verification', 'Location verification'],
                commission_rate: 6.0
            },
            {
                id: 'pickup-site-manager',
                name: 'Pickup Site Manager',
                description: 'Manager for pickup site operations',
                requirements: ['Valid ID', 'Management experience', 'Location ownership'],
                commission_rate: 10.0
            }
        ];

        res.json({ agent_types: agentTypes });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Get agent types error:', error);
        res.status(500).json({ error: 'Failed to load agent types' });
    }
});

// Create new agent (admin function)
router.post('/create-agent', authenticateToken, adminAuth, async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            role,
            location,
            bio,
            experience,
            initial_status = 'active'
        } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !role) {
            return res.status(400).json({ error: 'Name, email, phone, and role are required' });
        }

        // Check if user already exists
        const [existingUsers] = await pool.query(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'User with this email or phone already exists' });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).substring(2, 15);
        
        // Create agent user
        const [result] = await pool.query(`
            INSERT INTO users 
            (name, email, phone, password, role, location, bio, experience, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [name, email, phone, tempPassword, role, location, bio, experience, initial_status]);

        // Log agent creation
        await pool.query(`
            INSERT INTO system_logs (log_level, category, message, details, user_id)
            VALUES ('info', 'user', 'Agent created by admin', ?, ?)
        `, [JSON.stringify({
            agent_id: result.insertId,
            created_by: req.user.id,
            agent_role: role,
            temp_password: tempPassword
        }), req.user.id]);

        res.json({
            success: true,
            message: 'Agent created successfully',
            agent_id: result.insertId,
            temp_password: tempPassword
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Create agent error:', error);
        res.status(500).json({ error: 'Failed to create agent' });
    }
});

// Get admin notifications
router.get('/notifications', authenticateToken, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Get pending agent registrations
        const [pendingAgents] = await pool.query(`
            SELECT COUNT(*) as count FROM users 
            WHERE role LIKE '%agent%' AND status = 'pending'
        `);

        // Get recent system alerts
        const [systemAlerts] = await pool.query(`
            SELECT COUNT(*) as count FROM system_logs 
            WHERE log_level IN ('error', 'critical') AND DATE(created_at) = CURDATE()
        `);

        // Get security events that need attention
        const [securityEvents] = await pool.query(`
            SELECT COUNT(*) as count FROM security_events 
            WHERE status = 'new' AND severity IN ('high', 'critical')
        `);

        // Get recent notifications
        const [notifications] = await pool.query(`
            SELECT 
                'agent_registration' as type,
                CONCAT('New agent registration: ', u.name) as message,
                u.created_at as created_at,
                JSON_OBJECT('agent_id', u.id, 'agent_name', u.name) as data
            FROM users u
            WHERE u.role LIKE '%agent%' AND u.status = 'pending'
            ORDER BY u.created_at DESC
            LIMIT ?
        `, [limit]);

        res.json({
            summary: {
                pending_agents: pendingAgents[0].count,
                system_alerts: systemAlerts[0].count,
                security_events: securityEvents[0].count
            },
            notifications,
            pagination: {
                page,
                limit,
                total: notifications.length,
                totalPages: Math.ceil(notifications.length / limit)
            }
        });
    } catch (error) {
        console.error('[ADMIN-AGENTS] Get notifications error:', error);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

module.exports = router;