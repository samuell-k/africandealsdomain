const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

// Middleware to verify admin authentication
const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        
        // Handle different possible userId property names in JWT (match auth-middleware pattern)
        const userId = decoded.id || decoded.userId;
        
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Invalid token format' });
        }
        
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute(
            'SELECT id, role, status FROM users WHERE id = ? AND (role = "admin" OR role = "super_admin") AND status = "active"',
            [userId]
        );
        await connection.end();

        if (users.length === 0) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        req.adminId = userId;
        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// Get all agent applications with pagination and filtering
router.get('/agent-applications', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const {
            page = 1,
            limit = 10,
            status,
            agent_type,
            search,
            date_from,
            date_to,
            sort_by = 'created_at',
            sort_order = 'DESC'
        } = req.query;

        // Build WHERE clause
        let whereConditions = [];
        let queryParams = [];

        if (status) {
            whereConditions.push('aa.status = ?');
            queryParams.push(status);
        }

        if (agent_type) {
            whereConditions.push('aa.agent_type = ?');
            queryParams.push(agent_type);
        }

        if (search) {
            whereConditions.push('(aa.first_name LIKE ? OR aa.last_name LIKE ? OR aa.email LIKE ? OR aa.application_ref LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (date_from) {
            whereConditions.push('aa.created_at >= ?');
            queryParams.push(date_from);
        }

        if (date_to) {
            whereConditions.push('aa.created_at <= ?');
            queryParams.push(date_to + ' 23:59:59');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get total count
        const [countResult] = await connection.execute(`
            SELECT COUNT(*) as total
            FROM agent_applications aa
            ${whereClause}
        `, queryParams);

        const totalApplications = countResult[0].total;
        const totalPages = Math.ceil(totalApplications / limit);
        const offset = (page - 1) * limit;

        // Get applications with summary data
        const [applications] = await connection.execute(`
            SELECT 
                aa.id,
                aa.application_ref,
                aa.agent_type,
                aa.status,
                aa.first_name,
                aa.last_name,
                aa.email,
                aa.phone,
                aa.city,
                aa.state,
                aa.country,
                aa.created_at,
                aa.updated_at,
                aa.reviewed_at,
                CONCAT(reviewer.name) as reviewed_by_name,
                COUNT(aad.id) as document_count,
                SUM(CASE WHEN aad.is_verified = 1 THEN 1 ELSE 0 END) as verified_documents
            FROM agent_applications aa
            LEFT JOIN users reviewer ON aa.reviewed_by = reviewer.id
            LEFT JOIN agent_application_documents aad ON aa.id = aad.application_id
            ${whereClause}
            GROUP BY aa.id, aa.application_ref, aa.agent_type, aa.status, aa.first_name, aa.last_name, 
                     aa.email, aa.phone, aa.city, aa.state, aa.country, aa.created_at, aa.updated_at, 
                     aa.reviewed_at, reviewer.name
            ORDER BY aa.${sort_by} ${sort_order}
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            applications: applications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalApplications: totalApplications,
                limit: parseInt(limit),
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching agent applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent applications'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get application statistics
router.get('/agent-applications/stats', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [stats] = await connection.execute(`
            SELECT 
                status,
                COUNT(*) as count
            FROM agent_applications
            GROUP BY status
        `);

        const [todayStats] = await connection.execute(`
            SELECT 
                COUNT(*) as today_applications
            FROM agent_applications
            WHERE DATE(created_at) = CURDATE()
        `);

        const [weekStats] = await connection.execute(`
            SELECT 
                COUNT(*) as week_applications
            FROM agent_applications
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        const [monthStats] = await connection.execute(`
            SELECT 
                COUNT(*) as month_applications
            FROM agent_applications
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Format statistics
        const statusStats = {};
        stats.forEach(stat => {
            statusStats[stat.status] = stat.count;
        });

        res.json({
            success: true,
            stats: {
                pending: statusStats.pending || 0,
                under_review: statusStats.under_review || 0,
                approved: statusStats.approved || 0,
                rejected: statusStats.rejected || 0,
                cancelled: statusStats.cancelled || 0,
                today: todayStats[0].today_applications,
                week: weekStats[0].week_applications,
                month: monthStats[0].month_applications,
                total: Object.values(statusStats).reduce((sum, count) => sum + count, 0)
            }
        });

    } catch (error) {
        console.error('Error fetching application statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application statistics'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get single application details
router.get('/agent-applications/:id', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [applications] = await connection.execute(`
            SELECT 
                aa.*,
                CONCAT(reviewer.name) as reviewed_by_name,
                reviewer.email as reviewed_by_email
            FROM agent_applications aa
            LEFT JOIN users reviewer ON aa.reviewed_by = reviewer.id
            WHERE aa.id = ?
        `, [req.params.id]);

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        const application = applications[0];

        // Get application documents
        const [documents] = await connection.execute(`
            SELECT 
                id, document_type, filename, original_name, file_size, 
                mime_type, is_verified, verified_at, verification_notes,
                created_at
            FROM agent_application_documents
            WHERE application_id = ?
            ORDER BY document_type, created_at
        `, [req.params.id]);

        // Get status history
        const [statusHistory] = await connection.execute(`
            SELECT 
                aash.*,
                CONCAT(u.name) as changed_by_name
            FROM agent_application_status_history aash
            LEFT JOIN users u ON aash.changed_by = u.id
            WHERE aash.application_id = ?
            ORDER BY aash.created_at DESC
        `, [req.params.id]);

        res.json({
            success: true,
            application: {
                ...application,
                documents: documents,
                statusHistory: statusHistory
            }
        });

    } catch (error) {
        console.error('Error fetching application details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application details'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get application documents
router.get('/agent-applications/:id/documents', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [documents] = await connection.execute(`
            SELECT 
                aad.*,
                CONCAT(verifier.name) as verified_by_name
            FROM agent_application_documents aad
            LEFT JOIN users verifier ON aad.verified_by = verifier.id
            WHERE aad.application_id = ?
            ORDER BY aad.document_type, aad.created_at
        `, [req.params.id]);

        res.json({
            success: true,
            documents: documents
        });

    } catch (error) {
        console.error('Error fetching application documents:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch application documents'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Approve application
router.post('/agent-applications/:id/approve', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const { notes } = req.body;
        const applicationId = req.params.id;
        const adminId = req.adminId;

        // Manual approval process (fallback if stored procedure doesn't exist)
        await connection.beginTransaction();
        
        try {
            // Get application details
            const [applications] = await connection.execute(
                'SELECT user_id, agent_type, email, first_name FROM agent_applications WHERE id = ? AND status = ?',
                [applicationId, 'pending']
            );
            
            if (applications.length === 0) {
                throw new Error('Application not found or already processed');
            }
            
            const { user_id, agent_type, email, first_name } = applications[0];
            
            // Update application status
            await connection.execute(
                'UPDATE agent_applications SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?',
                ['approved', adminId, notes || null, applicationId]
            );
            
            // All agent types use the 'agent' role, with agent_type specifying the specific type
            const userRole = 'agent';
            
            // Update user status and role
            await connection.execute(`
                UPDATE users 
                SET status = 'active',
                    role = ?,
                    agent_type = ?,
                    approved_at = NOW(),
                    approved_by = ?
                WHERE id = ?
            `, [userRole, agent_type, adminId, user_id]);
            
            // Create agent-specific record based on type
            if (agent_type === 'pickup_delivery') {
                await connection.execute(
                    'INSERT INTO pickup_delivery_agents (user_id, is_available, created_at) VALUES (?, TRUE, NOW()) ON DUPLICATE KEY UPDATE is_available = TRUE',
                    [user_id]
                );
            } else if (agent_type === 'fast_delivery') {
                await connection.execute(
                    'INSERT INTO fast_delivery_agents (user_id, is_available, created_at) VALUES (?, TRUE, NOW()) ON DUPLICATE KEY UPDATE is_available = TRUE',
                    [user_id]
                );
            } else if (agent_type === 'pickup_site_manager') {
                await connection.execute(
                    'INSERT INTO pickup_site_managers (user_id, is_active, created_at) VALUES (?, TRUE, NOW()) ON DUPLICATE KEY UPDATE is_active = TRUE',
                    [user_id]
                );
            }
            
            // Create general agent record (simplified - no agent_code for now)
            await connection.execute(
                'INSERT INTO agents (user_id, status, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE status = ?',
                [user_id, 'active', 'active']
            );
            
            await connection.commit();
            console.log(`✅ Agent application ${applicationId} approved successfully for user ${user_id}`);
            
        } catch (approvalError) {
            await connection.rollback();
            throw approvalError;
        }

        // Send approval email (implement email service)
        try {
            await sendApprovalEmail(applicationId);
        } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
        }

        res.json({
            success: true,
            message: 'Application approved successfully'
        });

    } catch (error) {
        console.error('Error approving application:', error);
        
        if (error.message.includes('Application not found')) {
            res.status(404).json({
                success: false,
                error: 'Application not found or already processed'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to approve application'
            });
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Reject application
router.post('/agent-applications/:id/reject', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const { reason, notes } = req.body;
        const applicationId = req.params.id;
        const adminId = req.adminId;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }

        // Call the stored procedure
        await connection.execute(
            'CALL RejectAgentApplication(?, ?, ?, ?)',
            [applicationId, adminId, reason, notes || null]
        );

        // Send rejection email (implement email service)
        try {
            await sendRejectionEmail(applicationId, reason, notes);
        } catch (emailError) {
            console.error('Failed to send rejection email:', emailError);
        }

        res.json({
            success: true,
            message: 'Application rejected successfully'
        });

    } catch (error) {
        console.error('Error rejecting application:', error);
        
        if (error.message.includes('Application not found')) {
            res.status(404).json({
                success: false,
                error: 'Application not found or already processed'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to reject application'
            });
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Update application status
router.put('/agent-applications/:id/status', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const { status, notes } = req.body;
        const applicationId = req.params.id;
        const adminId = req.adminId;

        const validStatuses = ['pending', 'under_review', 'approved', 'rejected', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        await connection.beginTransaction();

        // Update application status
        const [result] = await connection.execute(`
            UPDATE agent_applications 
            SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
            WHERE id = ?
        `, [status, adminId, notes || null, applicationId]);

        if (result.affectedRows === 0) {
            throw new Error('Application not found');
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Application status updated successfully'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        
        console.error('Error updating application status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update application status'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Verify document
router.post('/agent-applications/documents/:documentId/verify', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const { notes } = req.body;
        const documentId = req.params.documentId;
        const adminId = req.adminId;

        const [result] = await connection.execute(`
            UPDATE agent_application_documents 
            SET is_verified = 1, verified_by = ?, verified_at = NOW(), verification_notes = ?
            WHERE id = ?
        `, [adminId, notes || null, documentId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        res.json({
            success: true,
            message: 'Document verified successfully'
        });

    } catch (error) {
        console.error('Error verifying document:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify document'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// View document
router.get('/agent-applications/documents/:documentId/view', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [documents] = await connection.execute(`
            SELECT file_path, original_name, mime_type
            FROM agent_application_documents
            WHERE id = ?
        `, [req.params.documentId]);

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const document = documents[0];
        
        // Check if file exists
        try {
            await fs.access(document.file_path);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);
        res.sendFile(path.resolve(document.file_path));

    } catch (error) {
        console.error('Error viewing document:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to view document'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Download document
router.get('/agent-applications/documents/:documentId/download', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [documents] = await connection.execute(`
            SELECT file_path, original_name, mime_type
            FROM agent_application_documents
            WHERE id = ?
        `, [req.params.documentId]);

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const document = documents[0];
        
        // Check if file exists
        try {
            await fs.access(document.file_path);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${document.original_name}"`);
        res.sendFile(path.resolve(document.file_path));

    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download document'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get document preview (for images)
router.get('/agent-applications/documents/:documentId/preview', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [documents] = await connection.execute(`
            SELECT file_path, original_name, mime_type
            FROM agent_application_documents
            WHERE id = ? AND mime_type LIKE 'image/%'
        `, [req.params.documentId]);

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        const document = documents[0];
        
        // Check if file exists
        try {
            await fs.access(document.file_path);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.sendFile(path.resolve(document.file_path));

    } catch (error) {
        console.error('Error getting document preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get document preview'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Export applications to CSV
router.get('/agent-applications/export/csv', verifyAdmin, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const { status, agent_type, date_from, date_to } = req.query;

        // Build WHERE clause for filtering
        let whereConditions = [];
        let queryParams = [];

        if (status) {
            whereConditions.push('aa.status = ?');
            queryParams.push(status);
        }

        if (agent_type) {
            whereConditions.push('aa.agent_type = ?');
            queryParams.push(agent_type);
        }

        if (date_from) {
            whereConditions.push('aa.created_at >= ?');
            queryParams.push(date_from);
        }

        if (date_to) {
            whereConditions.push('aa.created_at <= ?');
            queryParams.push(date_to + ' 23:59:59');
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const [applications] = await connection.execute(`
            SELECT 
                aa.application_ref,
                aa.first_name,
                aa.last_name,
                aa.email,
                aa.phone,
                aa.agent_type,
                aa.status,
                aa.city,
                aa.state,
                aa.country,
                aa.bank_name,
                aa.account_holder,
                aa.created_at,
                aa.reviewed_at,
                CONCAT(reviewer.name) as reviewed_by_name
            FROM agent_applications aa
            LEFT JOIN users reviewer ON aa.reviewed_by = reviewer.id
            ${whereClause}
            ORDER BY aa.created_at DESC
        `, queryParams);

        // Generate CSV content
        const csvHeaders = [
            'Application Ref', 'First Name', 'Last Name', 'Email', 'Phone',
            'Agent Type', 'Status', 'City', 'State', 'Country',
            'Bank Name', 'Account Holder', 'Submitted Date', 'Reviewed Date', 'Reviewed By'
        ];

        const csvRows = applications.map(app => [
            app.application_ref,
            app.first_name,
            app.last_name,
            app.email,
            app.phone,
            app.agent_type,
            app.status,
            app.city || '',
            app.state || '',
            app.country || '',
            app.bank_name || '',
            app.account_holder || '',
            app.created_at ? new Date(app.created_at).toISOString().split('T')[0] : '',
            app.reviewed_at ? new Date(app.reviewed_at).toISOString().split('T')[0] : '',
            app.reviewed_by_name || ''
        ]);

        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="agent-applications-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting applications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export applications'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Email service functions (placeholders - implement with your email service)
async function sendApprovalEmail(applicationId) {
    // Implement email sending logic for approval
    console.log(`Sending approval email for application ${applicationId}`);
    return Promise.resolve();
}

async function sendRejectionEmail(applicationId, reason, notes) {
    // Implement email sending logic for rejection
    console.log(`Sending rejection email for application ${applicationId}, reason: ${reason}`);
    return Promise.resolve();
}

module.exports = router;