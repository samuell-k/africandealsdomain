const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Create wallet transactions table if not exists
async function ensureWalletTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                transaction_type ENUM('credit', 'debit') NOT NULL,
                transaction_category ENUM('topup', 'payment', 'refund', 'commission', 'referral_bonus', 'withdrawal') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                balance_before DECIMAL(12,2) NOT NULL,
                balance_after DECIMAL(12,2) NOT NULL,
                reference_id VARCHAR(100),
                reference_type ENUM('order', 'commission', 'referral', 'manual') DEFAULT 'manual',
                payment_method VARCHAR(50),
                payment_reference VARCHAR(255),
                status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                description TEXT,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_type (transaction_type),
                INDEX idx_category (transaction_category),
                INDEX idx_status (status),
                INDEX idx_created (created_at),
                INDEX idx_reference (reference_id, reference_type)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_topup_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method ENUM('mobile_money', 'bank_transfer', 'card', 'crypto') NOT NULL,
                payment_details JSON,
                status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                reference_code VARCHAR(50) UNIQUE,
                external_reference VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_status (status),
                INDEX idx_reference (reference_code)
            )
        `);
    } catch (error) {
        console.error('Error creating wallet tables:', error);
    }
}

// Initialize tables
ensureWalletTables();

// Get wallet balance
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current balance from users table
        const [users] = await pool.query(
            'SELECT wallet_balance, commission_balance FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        
        // Get recent transactions
        const [recentTransactions] = await pool.query(`
            SELECT 
                transaction_type,
                transaction_category,
                amount,
                currency,
                status,
                description,
                created_at
            FROM wallet_transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `, [userId]);

        res.json({
            wallet_balance: parseFloat(user.wallet_balance) || 0,
            commission_balance: parseFloat(user.commission_balance) || 0,
            total_balance: (parseFloat(user.wallet_balance) || 0) + (parseFloat(user.commission_balance) || 0),
            currency: 'USD',
            recent_transactions: recentTransactions
        });
    } catch (error) {
        console.error('[WALLET] Balance error:', error);
        res.status(500).json({ error: 'Failed to load wallet balance' });
    }
});

// Get wallet transactions
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Filters
        const type = req.query.type; // 'credit' or 'debit'
        const category = req.query.category;
        const status = req.query.status;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        // Build query
        let whereClause = 'WHERE user_id = ?';
        let queryParams = [userId];

        if (type) {
            whereClause += ' AND transaction_type = ?';
            queryParams.push(type);
        }

        if (category) {
            whereClause += ' AND transaction_category = ?';
            queryParams.push(category);
        }

        if (status) {
            whereClause += ' AND status = ?';
            queryParams.push(status);
        }

        if (startDate) {
            whereClause += ' AND DATE(created_at) >= ?';
            queryParams.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND DATE(created_at) <= ?';
            queryParams.push(endDate);
        }

        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM wallet_transactions ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        // Get transactions
        const [transactions] = await pool.query(`
            SELECT 
                id,
                transaction_type,
                transaction_category,
                amount,
                currency,
                balance_before,
                balance_after,
                reference_id,
                reference_type,
                payment_method,
                payment_reference,
                status,
                description,
                created_at,
                updated_at
            FROM wallet_transactions 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        res.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[WALLET] Transactions error:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

// Get specific transaction
router.get('/transactions/:transactionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { transactionId } = req.params;

        const [transactions] = await pool.query(`
            SELECT 
                id,
                transaction_type,
                transaction_category,
                amount,
                currency,
                balance_before,
                balance_after,
                reference_id,
                reference_type,
                payment_method,
                payment_reference,
                status,
                description,
                metadata,
                created_at,
                updated_at
            FROM wallet_transactions 
            WHERE id = ? AND user_id = ?
        `, [transactionId, userId]);

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({ transaction: transactions[0] });
    } catch (error) {
        console.error('[WALLET] Transaction detail error:', error);
        res.status(500).json({ error: 'Failed to load transaction details' });
    }
});

// Create wallet topup request
router.post('/topup', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, payment_method, payment_details } = req.body;

        // Validate amount
        const topupAmount = parseFloat(amount);
        if (!topupAmount || topupAmount < 1) {
            return res.status(400).json({ error: 'Minimum topup amount is $1' });
        }

        if (topupAmount > 10000) {
            return res.status(400).json({ error: 'Maximum topup amount is $10,000' });
        }

        // Validate payment method
        const validMethods = ['mobile_money', 'bank_transfer', 'card', 'crypto'];
        if (!validMethods.includes(payment_method)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }

        // Generate reference code
        const referenceCode = `TOP${userId}${Date.now()}`;

        // Create topup request
        const [result] = await pool.query(`
            INSERT INTO wallet_topup_requests 
            (user_id, amount, payment_method, payment_details, reference_code)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, topupAmount, payment_method, JSON.stringify(payment_details || {}), referenceCode]);

        // For demo purposes, automatically approve small amounts
        if (topupAmount <= 100) {
            await this.processTopup(result.insertId);
        }

        res.json({
            success: true,
            topup_request_id: result.insertId,
            reference_code: referenceCode,
            amount: topupAmount,
            payment_method,
            status: topupAmount <= 100 ? 'completed' : 'pending',
            message: topupAmount <= 100 ? 
                'Topup completed successfully!' : 
                'Topup request submitted. Please complete payment to proceed.'
        });
    } catch (error) {
        console.error('[WALLET] Topup error:', error);
        res.status(500).json({ error: 'Failed to create topup request' });
    }
});

// Process a topup (internal function)
async function processTopup(topupRequestId) {
    try {
        // Get topup request
        const [requests] = await pool.query(
            'SELECT * FROM wallet_topup_requests WHERE id = ? AND status = "pending"',
            [topupRequestId]
        );

        if (requests.length === 0) {
            throw new Error('Topup request not found');
        }

        const request = requests[0];

        // Get current balance
        const [users] = await pool.query(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [request.user_id]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const currentBalance = parseFloat(users[0].wallet_balance) || 0;
        const newBalance = currentBalance + request.amount;

        // Start transaction
        await pool.query('START TRANSACTION');

        // Update user balance
        await pool.query(
            'UPDATE users SET wallet_balance = ? WHERE id = ?',
            [newBalance, request.user_id]
        );

        // Create wallet transaction record
        await pool.query(`
            INSERT INTO wallet_transactions 
            (user_id, transaction_type, transaction_category, amount, balance_before, balance_after, 
             reference_id, reference_type, payment_method, status, description)
            VALUES (?, 'credit', 'topup', ?, ?, ?, ?, 'manual', ?, 'completed', 'Wallet topup')
        `, [request.user_id, request.amount, currentBalance, newBalance, topupRequestId, request.payment_method]);

        // Update topup request status
        await pool.query(
            'UPDATE wallet_topup_requests SET status = "completed", completed_at = NOW() WHERE id = ?',
            [topupRequestId]
        );

        await pool.query('COMMIT');

        console.log(`[WALLET] Processed topup ${topupRequestId}: $${request.amount} for user ${request.user_id}`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('[WALLET] Process topup error:', error);
        throw error;
    }
}

// Deduct from wallet (internal function for orders)
router.post('/deduct', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, order_id, description } = req.body;

        const deductAmount = parseFloat(amount);
        if (!deductAmount || deductAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get current balance
        const [users] = await pool.query(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = parseFloat(users[0].wallet_balance) || 0;

        if (currentBalance < deductAmount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        const newBalance = currentBalance - deductAmount;

        // Start transaction
        await pool.query('START TRANSACTION');

        // Update user balance
        await pool.query(
            'UPDATE users SET wallet_balance = ? WHERE id = ?',
            [newBalance, userId]
        );

        // Create wallet transaction record
        await pool.query(`
            INSERT INTO wallet_transactions 
            (user_id, transaction_type, transaction_category, amount, balance_before, balance_after, 
             reference_id, reference_type, status, description)
            VALUES (?, 'debit', 'payment', ?, ?, ?, ?, 'order', 'completed', ?)
        `, [userId, deductAmount, currentBalance, newBalance, order_id, description || 'Payment for order']);

        await pool.query('COMMIT');

        res.json({
            success: true,
            amount_deducted: deductAmount,
            new_balance: newBalance,
            message: 'Payment completed successfully'
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('[WALLET] Deduct error:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

// Request wallet withdrawal
router.post('/withdraw', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, payment_method, payment_details, notes } = req.body;

        const withdrawAmount = parseFloat(amount);
        if (!withdrawAmount || withdrawAmount <= 0) {
            return res.status(400).json({ error: 'Invalid withdrawal amount' });
        }

        if (withdrawAmount > 1000000) {
            return res.status(400).json({ error: 'Maximum withdrawal amount is 1,000,000 RWF' });
        }

        // Validate payment method
        const validMethods = ['mobile_money', 'bank_transfer'];
        if (!validMethods.includes(payment_method)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }

        // Validate payment details
        if (!payment_details || !payment_details.account_number) {
            return res.status(400).json({ error: 'Payment details with account number are required' });
        }

        // Get current balance
        const [users] = await pool.query(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = parseFloat(users[0].wallet_balance) || 0;

        if (currentBalance < withdrawAmount) {
            return res.status(400).json({ 
                error: `Insufficient wallet balance. Available: ${currentBalance.toLocaleString()} RWF` 
            });
        }

        // Check for pending withdrawal requests
        const [pendingResult] = await pool.query(`
            SELECT COUNT(*) as pending_count
            FROM wallet_withdrawals
            WHERE user_id = ? AND status IN ('pending', 'processing')
        `, [userId]);

        if (pendingResult[0].pending_count > 0) {
            return res.status(400).json({
                error: 'You have a pending withdrawal request. Please wait for it to be processed.'
            });
        }

        // Create withdrawal request
        const [result] = await pool.query(`
            INSERT INTO wallet_withdrawals (
                user_id, amount, payment_method, payment_details, notes, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())
        `, [
            userId, 
            withdrawAmount, 
            payment_method, 
            JSON.stringify(payment_details), 
            notes || null
        ]);

        // Create admin notification
        try {
            await pool.query(`
                INSERT INTO admin_notifications (
                    type, title, message, data, created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `, [
                'wallet_withdrawal_request',
                'New Wallet Withdrawal Request',
                `User has requested withdrawal of ${withdrawAmount.toLocaleString()} RWF from wallet`,
                JSON.stringify({
                    withdrawal_id: result.insertId,
                    user_id: userId,
                    amount: withdrawAmount,
                    payment_method: payment_method
                })
            ]);
        } catch (notificationError) {
            console.warn('Failed to create admin notification:', notificationError);
        }

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            withdrawal_id: result.insertId,
            amount: withdrawAmount,
            status: 'pending',
            estimated_processing_time: '1-3 business days'
        });

    } catch (error) {
        console.error('[WALLET] Withdrawal request error:', error);
        res.status(500).json({ error: 'Failed to process withdrawal request' });
    }
});

// Get wallet withdrawal history
router.get('/withdrawals', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Get withdrawal history
        const [withdrawals] = await pool.query(`
            SELECT 
                ww.id,
                ww.amount,
                ww.payment_method,
                ww.payment_details,
                ww.status,
                ww.admin_notes,
                ww.created_at,
                ww.processed_at,
                admin.name as processed_by_name
            FROM wallet_withdrawals ww
            LEFT JOIN users admin ON ww.processed_by = admin.id
            WHERE ww.user_id = ?
            ORDER BY ww.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);

        // Get total count for pagination
        const [countResult] = await pool.query(`
            SELECT COUNT(*) as total
            FROM wallet_withdrawals
            WHERE user_id = ?
        `, [userId]);

        // Format payment details for display
        const formattedWithdrawals = withdrawals.map(withdrawal => ({
            ...withdrawal,
            payment_details: withdrawal.payment_details ? JSON.parse(withdrawal.payment_details) : null,
            amount_formatted: new Intl.NumberFormat('en-US').format(withdrawal.amount),
            status_badge: {
                pending: { color: 'yellow', text: 'Pending Review' },
                processing: { color: 'blue', text: 'Processing' },
                completed: { color: 'green', text: 'Completed' },
                rejected: { color: 'red', text: 'Rejected' }
            }[withdrawal.status] || { color: 'gray', text: withdrawal.status }
        }));

        res.json({
            success: true,
            withdrawals: formattedWithdrawals,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(countResult[0].total / limit),
                total_records: countResult[0].total,
                per_page: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('[WALLET] Withdrawal history error:', error);
        res.status(500).json({ error: 'Failed to load withdrawal history' });
    }
});

module.exports = router;