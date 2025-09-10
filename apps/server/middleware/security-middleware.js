/**
 * Security Middleware
 * Comprehensive security configuration for production
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Rate limiting configuration
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};

// Security headers configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
};

// Request size limiting
const requestSizeLimit = '10mb';

// Export middleware functions
module.exports = {
    // General rate limiting
    generalRateLimit: createRateLimit(),
    
    // Strict rate limiting for auth endpoints
    authRateLimit: createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts'),
    
    // API rate limiting
    apiRateLimit: createRateLimit(15 * 60 * 1000, 1000, 'API rate limit exceeded'),
    
    // CORS middleware
    cors: cors(corsOptions),
    
    // Security headers
    helmet: helmet(helmetConfig),
    
    // Request size limiting
    requestSizeLimit,
    
    // Input validation middleware
    validateInput: (req, res, next) => {
        // Basic input sanitization
        if (req.body) {
            for (const key in req.body) {
                if (typeof req.body[key] === 'string') {
                    // Remove potentially dangerous characters
                    req.body[key] = req.body[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
                    req.body[key] = req.body[key].replace(/<[^>]*>/g, '');
                }
            }
        }
        next();
    },
    
    // File upload security
    fileUploadSecurity: {
        limits: {
            fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
            files: 5
        },
        fileFilter: (req, file, cb) => {
            // Allowed file types
            const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
            const extname = allowedTypes.test(file.originalname.toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype);
            
            if (mimetype && extname) {
                return cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only images and documents are allowed.'));
            }
        }
    }
};
