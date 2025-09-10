/**
 * Authentication middleware
 * Provides JWT token verification and role-based access control
 */   

const jwt = require('jsonwebtoken');
 
 // Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[AUTH MIDDLEWARE] No token provided for:', req.path);
    // Always return JSON for API requests - check multiple indicators
    const isApiRequest = req.path.startsWith('/api/') || 
                        req.headers['content-type'] === 'application/json' || 
                        req.headers['accept']?.includes('application/json') ||
                        req.xhr === true ||
                        req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
      // Ensure JSON content type is set
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
        message: 'Authentication token is required',
        success: false
      });
    } else {
      // For page requests, redirect to appropriate login
      const loginPage = req.path.includes('/admin/') ? '/auth/auth-admin.html' : 
                       req.path.includes('/seller/') ? '/auth/auth-seller.html' :
                       req.path.includes('/agent/') ? '/auth/auth-agent.html' : 
                       '/auth/auth-buyer.html';
      return res.redirect(loginPage);
    }
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    req.user = decoded;
    console.log('[AUTH MIDDLEWARE] Token valid for user:', decoded.id, 'role:', decoded.role);
    next();
  } catch (error) {
    console.log('[AUTH MIDDLEWARE] Invalid token for:', req.path, 'Error:', error.message);
    // Always return JSON for API requests - check multiple indicators
    const isApiRequest = req.path.startsWith('/api/') || 
                        req.headers['content-type'] === 'application/json' || 
                        req.headers['accept']?.includes('application/json') ||
                        req.xhr === true ||
                        req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
      // Ensure JSON content type is set
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired',
        success: false
      });
    } else {
      // For page requests, redirect to appropriate login
      const loginPage = req.path.includes('/admin/') ? '/auth/auth-admin.html' : 
                       req.path.includes('/seller/') ? '/auth/auth-seller.html' :
                       req.path.includes('/agent/') ? '/auth/auth-agent.html' : 
                       '/auth/auth-buyer.html';
      return res.redirect(loginPage);
    }
  }
};

// Check if user is an admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    console.log('[AUTH MIDDLEWARE] Admin access denied for user:', req.user?.id, 'role:', req.user?.role);
    res.setHeader('Content-Type', 'application/json');
    res.status(403).json({ 
      error: 'Access denied. Admin role required.',
      code: 'INSUFFICIENT_ROLE',
      required: 'admin',
      current: req.user?.role || 'none',
      success: false
    });
  }
};

// Check if user is an agent
const isAgent = (req, res, next) => {
  if (req.user && req.user.role === 'agent') {
    next();
  } else {
    console.log('[AUTH MIDDLEWARE] Agent access denied for user:', req.user?.id, 'role:', req.user?.role);
    res.setHeader('Content-Type', 'application/json');
    res.status(403).json({ 
      error: 'Access denied. Agent role required.',
      code: 'INSUFFICIENT_ROLE',
      required: 'agent',
      current: req.user?.role || 'none',
      success: false
    });
  }
};

// Check if user is a seller
const isSeller = (req, res, next) => {
  if (req.user && req.user.role === 'seller') {
    next();
  } else {
    console.log('[AUTH MIDDLEWARE] Seller access denied for user:', req.user?.id, 'role:', req.user?.role);
    res.setHeader('Content-Type', 'application/json');
    res.status(403).json({ 
      error: 'Access denied. Seller role required.',
      code: 'INSUFFICIENT_ROLE',
      required: 'seller',
      current: req.user?.role || 'none',
      success: false
    });
  }
};

// Check if user is a buyer
const isBuyer = (req, res, next) => {
  if (req.user && req.user.role === 'buyer') {
    next();
  } else {
    console.log('[AUTH MIDDLEWARE] Buyer access denied for user:', req.user?.id, 'role:', req.user?.role);
    res.setHeader('Content-Type', 'application/json');
    res.status(403).json({ 
      error: 'Access denied. Buyer role required.',
      code: 'INSUFFICIENT_ROLE',
      required: 'buyer',
      current: req.user?.role || 'none',
      success: false
    });
  }
};

// Alias for compatibility with new routes
const requireAuth = authenticateToken;

// Generic role checker function
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  isAdmin,
  isAgent,
  isSeller,
  isBuyer,
  requireAuth,
  requireRole
};