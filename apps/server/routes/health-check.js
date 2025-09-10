/**
 * Health Check Endpoint
 * System health monitoring for production
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Health check endpoint
router.get('/health', async (req, res) => {
    const healthCheck = {
        timestamp: new Date().toISOString(),
        status: 'OK',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {}
    };

    try {
        // Database health check
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        healthCheck.checks.database = { status: 'OK', message: 'Database connection successful' };
    } catch (error) {
        healthCheck.checks.database = { status: 'ERROR', message: error.message };
        healthCheck.status = 'ERROR';
    }

    // File system health check
    try {
        const fs = require('fs').promises;
        await fs.access('./uploads');
        healthCheck.checks.filesystem = { status: 'OK', message: 'File system accessible' };
    } catch (error) {
        healthCheck.checks.filesystem = { status: 'WARNING', message: 'Upload directory not accessible' };
    }

    // Memory usage check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    if (memoryUsageMB > 500) { // Alert if using more than 500MB
        healthCheck.checks.memory = { status: 'WARNING', message: `High memory usage: ${memoryUsageMB}MB` };
    } else {
        healthCheck.checks.memory = { status: 'OK', message: `Memory usage: ${memoryUsageMB}MB` };
    }

    const statusCode = healthCheck.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
});

// Readiness check (for Kubernetes/Docker)
router.get('/ready', async (req, res) => {
    try {
        // Check if all critical services are ready
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        res.status(200).json({ status: 'READY', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'NOT_READY', error: error.message });
    }
});

// Liveness check (for Kubernetes/Docker)
router.get('/live', (req, res) => {
    res.status(200).json({ status: 'ALIVE', timestamp: new Date().toISOString() });
});

module.exports = router;
