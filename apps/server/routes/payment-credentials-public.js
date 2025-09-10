const express = require('express');
const router = express.Router();
const db = require('../db.js');

console.log('🔧 [PAYMENT-CREDENTIALS-PUBLIC] Loading public payment credentials routes...');

// Enhanced error handler for public routes
const enhancedErrorHandler = (routeHandler) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            console.log(`📡 [PAYMENT-CREDENTIALS-PUBLIC] ${req.method} ${req.originalUrl}`);
            
            await routeHandler(req, res, next);
            
            const duration = Date.now() - startTime;
            console.log(`⚡ [PAYMENT-CREDENTIALS-PUBLIC] Request completed in ${duration}ms`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ [PAYMENT-CREDENTIALS-PUBLIC] ERROR in ${req.method} ${req.originalUrl}`);
            console.error(`⏱️ [PAYMENT-CREDENTIALS-PUBLIC] Failed after ${duration}ms`);
            console.error(`💥 [PAYMENT-CREDENTIALS-PUBLIC] Error details:`, {
                message: error.message,
                stack: error.stack,
                sql: error.sql || 'N/A',
                sqlMessage: error.sqlMessage || 'N/A',
                code: error.code || 'UNKNOWN'
            });
            
            // Log to database if possible
            try {
                await db.execute(`
                    INSERT INTO system_logs (log_level, message, details, created_at)
                    VALUES (?, ?, ?, NOW())
                `, [
                    'error',
                    `Payment Credentials Public API Error: ${req.method} ${req.originalUrl}`,
                    JSON.stringify({
                        error: error.message,
                        stack: error.stack,
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    })
                ]);
            } catch (logError) {
                console.error('Failed to log error to database:', logError);
            }
            
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error : 'An unexpected error occurred'
            });
        }
    };
};

// GET /api/payment-credentials/public - Get public payment credentials (No auth required)
router.get('/public', enhancedErrorHandler(async (req, res) => {
    console.log('📋 [PAYMENT-CREDENTIALS-PUBLIC] Fetching public payment credentials...');
    
    try {
        const [credentials] = await db.execute(`
            SELECT credential_type, provider, credential_data, is_enabled, updated_at
            FROM payment_credentials
            WHERE is_enabled = true
            ORDER BY credential_type, provider
        `);
        
        // Structure the credentials for frontend consumption
        const structuredCredentials = {
            mobile_money: {},
            bank_transfer: {}
        };
        
        credentials.forEach(credential => {
            const data = JSON.parse(credential.credential_data);
            structuredCredentials[credential.credential_type][credential.provider] = {
                ...data,
                enabled: credential.is_enabled
            };
        });
        
        // Get the latest update timestamp
        const [latestUpdate] = await db.execute(`
            SELECT MAX(updated_at) as last_updated
            FROM payment_credentials
        `);
        
        console.log('✅ [PAYMENT-CREDENTIALS-PUBLIC] Public payment credentials fetched successfully');
        console.log(`📊 [PAYMENT-CREDENTIALS-PUBLIC] Found ${credentials.length} enabled credentials`);
        
        res.json({
            success: true,
            message: 'Payment credentials retrieved successfully',
            credentials: structuredCredentials,
            last_updated: latestUpdate[0]?.last_updated || null,
            total_credentials: credentials.length
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS-PUBLIC] Error fetching public payment credentials:', error);
        throw error;
    }
}));

// GET /api/payment-credentials/status - Get payment credentials status (No auth required)
router.get('/status', enhancedErrorHandler(async (req, res) => {
    console.log('📊 [PAYMENT-CREDENTIALS-PUBLIC] Fetching payment credentials status...');
    
    try {
        const [stats] = await db.execute(`
            SELECT 
                credential_type,
                COUNT(*) as total,
                SUM(CASE WHEN is_enabled = true THEN 1 ELSE 0 END) as enabled,
                MAX(updated_at) as last_updated
            FROM payment_credentials
            GROUP BY credential_type
        `);
        
        const statusSummary = {
            mobile_money: { total: 0, enabled: 0, last_updated: null },
            bank_transfer: { total: 0, enabled: 0, last_updated: null }
        };
        
        stats.forEach(stat => {
            statusSummary[stat.credential_type] = {
                total: stat.total,
                enabled: stat.enabled,
                last_updated: stat.last_updated
            };
        });
        
        // Overall status
        const totalEnabled = stats.reduce((sum, stat) => sum + stat.enabled, 0);
        const overallStatus = totalEnabled > 0 ? 'active' : 'inactive';
        
        console.log('✅ [PAYMENT-CREDENTIALS-PUBLIC] Payment credentials status fetched successfully');
        
        res.json({
            success: true,
            message: 'Payment credentials status retrieved successfully',
            status: overallStatus,
            summary: statusSummary,
            total_enabled: totalEnabled
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS-PUBLIC] Error fetching payment credentials status:', error);
        throw error;
    }
}));

console.log('✅ [PAYMENT-CREDENTIALS-PUBLIC] Public payment credentials routes loaded successfully');

module.exports = router;