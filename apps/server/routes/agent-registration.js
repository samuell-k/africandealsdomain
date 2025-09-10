const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/agent-applications');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 10 // Maximum 10 files
    },
    fileFilter: function (req, file, cb) {
        // Allow images and PDFs
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, JPG, PNG) and PDF files are allowed'));
        }
    }
});

// Error handling middleware for multer
const handleUploadErrors = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(413).json({
                    success: false,
                    error: 'File too large. Maximum file size is 5MB'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(413).json({
                    success: false,
                    error: 'Too many files. Maximum 10 files allowed'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    error: 'Unexpected file field'
                });
            default:
                return res.status(400).json({
                    success: false,
                    error: `File upload error: ${error.message}`
                });
        }
    } else if (error.message.includes('Only images')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    next(error);
};

// Agent registration endpoint
router.post('/agent-registration', 
    upload.fields([
        { name: 'profile_photo', maxCount: 1 },
        { name: 'id_document_front', maxCount: 1 },
        { name: 'id_document_back', maxCount: 1 },
        { name: 'drivers_license', maxCount: 1 },
        { name: 'vehicle_registration', maxCount: 1 },
        { name: 'business_license', maxCount: 1 },
        { name: 'bank_statement', maxCount: 1 }
    ]), 
    handleUploadErrors,
    async (req, res) => {
    let connection;
    
    try {
        // Validation functions
        const validateAgentType = (type) => {
            const validTypes = ['fast_delivery', 'pickup_delivery', 'pickup_site_manager'];
            return validTypes.includes(type);
        };

        const validateEmail = (email) => {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return emailRegex.test(email);
        };

        const validateRequired = (fields) => {
            const missing = [];
            for (const [key, value] of Object.entries(fields)) {
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    missing.push(key);
                }
            }
            return missing;
        };

        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        const {
            // Agent type
            selectedAgentType,
            
            // Personal information
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            gender,
            id_type,
            id_number,
            
            // Address
            street_address,
            city,
            state,
            country,
            postal_code,
            
            // Location
            latitude,
            longitude,
            
            // Bank information
            bank_name,
            account_number,
            account_holder,
            routing_number,
            
            // Agent-specific fields
            delivery_radius,
            max_orders_per_day,
            pickup_zone,
            delivery_zone,
            transport_capacity,
            max_orders_per_trip,
            site_name,
            opening_hours,
            closing_hours,
            operating_days,
            
            // Vehicle information (if applicable)
            hasVehicle,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            vehicle_plate,
            vehicle_color,
            
            // Security
            password,
            confirm_password
        } = req.body;

        // Comprehensive Validation
        
        // 1. Validate agent type
        if (!validateAgentType(selectedAgentType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid agent type. Must be one of: fast_delivery, pickup_delivery, pickup_site_manager'
            });
        }

        // 2. Validate required fields
        const requiredFields = {
            first_name,
            last_name,
            email,
            phone,
            password,
            selectedAgentType,
            latitude,
            longitude
        };
        
        const missingFields = validateRequired(requiredFields);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // 3. Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // 4. Validate password match
        if (password !== confirm_password) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }

        // 5. Validate location coordinates
        if (!latitude || !longitude || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
            return res.status(400).json({
                success: false,
                error: 'Valid location coordinates are required'
            });
        }

        // Check if email already exists
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            throw new Error('Email already registered');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate application reference number
        const applicationRef = 'APP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        // Create user record (pending status)
        const [userResult] = await connection.execute(`
            INSERT INTO users (
                name, email, phone, password, role, status, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'agent', 'pending', NOW(), NOW())
        `, [
            `${first_name} ${last_name}`,
            email,
            phone,
            hashedPassword
        ]);

        const userId = userResult.insertId;

        // Create agent application record
        const [applicationResult] = await connection.execute(`
            INSERT INTO agent_applications (
                user_id, application_ref, agent_type, status,
                first_name, last_name, email, phone, date_of_birth, gender,
                id_type, id_number, street_address, city, state, country, postal_code,
                latitude, longitude, bank_name, account_number, account_holder, routing_number,
                delivery_radius, max_orders_per_day, pickup_zone, delivery_zone,
                transport_capacity, max_orders_per_trip, site_name, opening_hours, closing_hours,
                operating_days, has_vehicle, vehicle_type, vehicle_make, vehicle_model,
                vehicle_year, vehicle_plate, vehicle_color, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            userId, applicationRef, selectedAgentType,
            first_name, last_name, email, phone, date_of_birth || null, gender || null,
            id_type || null, id_number || null, street_address || null, city || null, state || null, country || null, postal_code || null,
            parseFloat(latitude), parseFloat(longitude), bank_name || null, account_number || null, account_holder || null, routing_number || null,
            delivery_radius || null, max_orders_per_day || null, pickup_zone || null, delivery_zone || null,
            transport_capacity || null, max_orders_per_trip || null, site_name || null, opening_hours || null, closing_hours || null,
            Array.isArray(operating_days) ? operating_days.join(',') : operating_days || null,
            hasVehicle === 'true' || hasVehicle === true ? 1 : 0,
            vehicle_type || null, vehicle_make || null, vehicle_model || null,
            vehicle_year || null, vehicle_plate || null, vehicle_color || null
        ]);

        const applicationId = applicationResult.insertId;

        // Handle file uploads
        const uploadedFiles = {};
        if (req.files) {
            for (const [fieldName, files] of Object.entries(req.files)) {
                if (files && files.length > 0) {
                    const file = files[0];
                    uploadedFiles[fieldName] = {
                        filename: file.filename,
                        originalname: file.originalname,
                        path: file.path,
                        size: file.size,
                        mimetype: file.mimetype
                    };

                    // Save file information to database
                    await connection.execute(`
                        INSERT INTO agent_application_documents (
                            application_id, document_type, filename, original_name,
                            file_path, file_size, mime_type, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [
                        applicationId,
                        fieldName,
                        file.filename,
                        file.originalname,
                        file.path,
                        file.size,
                        file.mimetype
                    ]);
                }
            }
        }

        // Create notification for admin (optional - don't fail if table doesn't exist)
        try {
            await connection.execute(`
                INSERT INTO admin_notifications (
                    type, title, message, data, status, created_at
                ) VALUES (?, ?, ?, ?, 'unread', NOW())
            `, [
                'agent_application',
                'New Agent Application',
                `New ${selectedAgentType.replace('_', ' ')} application from ${first_name} ${last_name}`,
                JSON.stringify({
                    applicationId: applicationId,
                    applicationRef: applicationRef,
                    agentType: selectedAgentType,
                    applicantName: `${first_name} ${last_name}`,
                    applicantEmail: email,
                    applicantPhone: phone
                })
            ]);
        } catch (notificationError) {
            console.warn('Failed to create admin notification:', notificationError.message);
            // Don't fail the registration if notification creation fails
        }

        await connection.commit();

        // Send confirmation email (implement email service)
        try {
            await sendApplicationConfirmationEmail(email, first_name, applicationRef);
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the registration if email fails
        }

        res.json({
            success: true,
            message: 'Application submitted successfully',
            applicationId: applicationId,
            userId: userId,
            data: {
                applicationRef: applicationRef,
                status: 'pending',
                estimatedReviewTime: '2-3 business days'
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        
        console.error('Agent registration error:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            for (const files of Object.values(req.files)) {
                for (const file of files) {
                    try {
                        await fs.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Failed to delete uploaded file:', unlinkError);
                    }
                }
            }
        }

        res.status(400).json({
            success: false,
            error: error.message || 'Registration failed'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get agent types configuration
router.get('/agent-types-config', async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [agentTypes] = await connection.execute(`
            SELECT 
                id, type_code, type_name, description, commission_rate,
                requirements, benefits, is_active, created_at
            FROM agent_types 
            WHERE is_active = 1
            ORDER BY display_order ASC, type_name ASC
        `);

        res.json({
            success: true,
            data: agentTypes
        });

    } catch (error) {
        console.error('Error fetching agent types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent types configuration'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Check application status
router.get('/application-status/:applicationRef', async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        const [applications] = await connection.execute(`
            SELECT 
                aa.application_ref, aa.status, aa.agent_type, aa.first_name, aa.last_name,
                aa.created_at, aa.updated_at, aa.review_notes, aa.reviewed_by, aa.reviewed_at
            FROM agent_applications aa
            WHERE aa.application_ref = ?
        `, [req.params.applicationRef]);

        if (applications.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        const application = applications[0];

        res.json({
            success: true,
            data: {
                applicationRef: application.application_ref,
                status: application.status,
                agentType: application.agent_type,
                applicantName: `${application.first_name} ${application.last_name}`,
                submittedAt: application.created_at,
                lastUpdated: application.updated_at,
                reviewNotes: application.review_notes,
                reviewedAt: application.reviewed_at
            }
        });

    } catch (error) {
        console.error('Error checking application status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check application status'
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Email service function (placeholder - implement with your email service)
async function sendApplicationConfirmationEmail(email, firstName, applicationRef) {
    // Implement email sending logic here
    // This could use nodemailer, SendGrid, AWS SES, etc.
    console.log(`Sending confirmation email to ${email} for application ${applicationRef}`);
    
    // Example email content:
    const emailContent = {
        to: email,
        subject: 'Agent Application Received - ADD Platform',
        html: `
            <h2>Application Received Successfully</h2>
            <p>Dear ${firstName},</p>
            <p>Thank you for applying to become an agent with ADD Platform.</p>
            <p><strong>Application Reference:</strong> ${applicationRef}</p>
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Our team will review your application within 2-3 business days</li>
                <li>We will verify your documents and information</li>
                <li>You will receive an email notification with the decision</li>
                <li>If approved, you will receive login credentials and onboarding instructions</li>
            </ul>
            <p>You can check your application status anytime using your reference number.</p>
            <p>Best regards,<br>ADD Platform Team</p>
        `
    };
    
    // Implement actual email sending here
    return Promise.resolve();
}

module.exports = router;