/**
 * Enhanced Authentication Middleware
 * Provides consistent authentication across all protected routes
 */

const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'adminafricandealsdomainpassword';

/**
 * Enhanced JWT Authentication Middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔐 [AUTH] Starting authentication check');
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ [AUTH] No token provided');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid access token'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ [AUTH] Token verified, user ID:', decoded.id || decoded.userId);
    
    // Get user details from database
    const userId = decoded.id || decoded.userId;
    const [users] = await pool.query(
      'SELECT id, username, email, name, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      console.log('❌ [AUTH] User not found in database:', userId);
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'User account not found'
      });
    }

    const user = users[0];
    req.user = {
      id: user.id,
      userId: user.id, // For backward compatibility
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      ...decoded // Include any other JWT payload data
    };

    console.log('✅ [AUTH] Authentication successful for:', user.username);
    next();
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login first'
      });
    }

    const userRole = req.user.role;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!rolesArray.includes(userRole)) {
      console.log(`❌ [AUTH] Access denied. User role: ${userRole}, Required: ${rolesArray.join(', ')}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires ${rolesArray.join(' or ')} role`
      });
    }

    console.log(`✅ [AUTH] Role authorization passed for ${userRole}`);
    next();
  };
};

/**
 * Agent-specific authentication middleware
 */
const requireAgent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login first'
      });
    }

    const userId = req.user.id;
    
    // Check if user has any agent record
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (agents.length === 0) {
      return res.status(403).json({ 
        error: 'Agent access required',
        message: 'You need to register as an agent to access this resource'
      });
    }

    req.agent = agents[0];
    console.log(`✅ [AUTH] Agent access granted for type: ${agents[0].agent_type}`);
    next();
  } catch (error) {
    console.error('❌ [AUTH] Agent verification error:', error);
    res.status(500).json({ 
      error: 'Authorization error',
      message: 'Failed to verify agent status'
    });
  }
};

/**
 * Admin authentication middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please login first'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This action requires administrator privileges'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAgent,
  requireAdmin,
  JWT_SECRET
};