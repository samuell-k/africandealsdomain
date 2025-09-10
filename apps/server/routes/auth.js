const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { sendTemplatedEmail } = require('../utils/mailer');

// Centralized long-lived JWT generation
const TOKEN_EXP_DAYS = parseInt(process.env.JWT_EXP_DAYS || '365', 10); // default: 365 days
function signLongLivedToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (TOKEN_EXP_DAYS * 24 * 60 * 60);
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      iat: now,
      exp,
    },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
  );
}
   
// Register (all roles)
router.post('/register', async (req, res, next) => {
  try {
    console.log('[AUTH DEBUG] Registration attempt:', { email: req.body.email, role: req.body.role });
    
    const { name, email, password, role, phone, referral_code } = req.body;
    
    // Enhanced validation
    if (!name || !email || !password || !role) {
      console.log('[AUTH ERROR] Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!['buyer','seller','agent','admin'].includes(role)) {
      console.log('[AUTH ERROR] Invalid role:', role);
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      console.log('[AUTH ERROR] Invalid email format:', email);
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 6) {
      console.log('[AUTH ERROR] Password too short');
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
      const [existing] = await pool.query('SELECT id, role FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        console.log('[AUTH ERROR] Email already registered:', email);
        return res.status(409).json({ error: 'Email already registered' });
      }
    } catch (dbErr) {
      console.error('[DB ERROR] Check existing user failed:', dbErr.message);
      if (dbErr.message.includes('ER_NO_SUCH_TABLE')) {
        console.error("[DB ERROR] 'users' table missing. Attempting to create...");
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            role VARCHAR(32),
            phone VARCHAR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`);
          console.log("[DB FIX] 'users' table created.");
        } catch (createErr) {
          console.error('[DB ERROR] Failed to create users table:', createErr.message);
          return res.status(500).json({ error: 'Database error: users table missing and could not be created.' });
        }
      } else {
        return res.status(500).json({ error: 'Database error: ' + dbErr.message });
      }
    }
    
    const hash = await bcrypt.hash(password, 10);
    console.log('[AUTH DEBUG] Password hashed successfully');
    
    // Validate referral code if provided
    let referralInfo = null;
    if (referral_code) {
      try {
        // Check if referral code exists (either in referrals or product_shares)
        const [referrals] = await pool.query(`
          SELECT r.id, r.referrer_id, r.bonus_type, r.product_id, 'referral' as source
          FROM referrals r
          WHERE r.referral_code = ? AND r.status = 'pending'
          
          UNION
          
          SELECT ps.id, ps.user_id as referrer_id, 'product_share' as bonus_type, ps.product_id, 'product_share' as source
          FROM product_shares ps
          WHERE ps.referral_code = ?
        `, [referral_code, referral_code]);

        if (referrals.length > 0) {
          referralInfo = referrals[0];
          console.log('[REFERRAL] Valid referral code found:', referral_code);
        } else {
          console.log('[REFERRAL] Invalid referral code:', referral_code);
          // Don't fail registration for invalid referral code, just ignore it
        }
      } catch (referralErr) {
        console.error('[REFERRAL ERROR] Failed to validate referral code:', referralErr.message);
        // Don't fail registration if referral validation fails
      }
    }
    
    try {
      // First, ensure the users table has the referral_code_used column
      try {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN referral_code_used VARCHAR(20) NULL,
          ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00
        `);
        console.log('[DB] Added referral columns to users table');
      } catch (alterErr) {
        if (!alterErr.message.includes('Duplicate column name')) {
          console.log('[DB] Referral columns already exist or error:', alterErr.message);
        }
      }

      const [result] = await pool.query(
        'INSERT INTO users (name, email, password, role, phone, referral_code_used, wallet_balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, hash, role, phone || null, referral_code || null, 0.00]
      );
      
      const user = { id: result.insertId, name, email, role, phone, referral_code_used: referral_code };
      
      // If registering as agent, create agent profile
      if (role === 'agent') {
        try {
          await pool.query(`
            INSERT INTO agents (user_id, first_name, last_name, email, phone, status, agent_type, created_at)
            VALUES (?, ?, ?, ?, ?, 'offline', NULL, NOW())
            ON DUPLICATE KEY UPDATE
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            email = VALUES(email),
            phone = VALUES(phone)
          `, [
            user.id,
            req.body.first_name || name.split(' ')[0] || '',
            req.body.last_name || name.split(' ')[1] || '',
            email,
            phone
          ]);
          console.log('[AUTH SUCCESS] Agent profile created for user:', user.id);
        } catch (agentErr) {
          console.error('[AUTH WARNING] Failed to create agent profile:', agentErr.message);
          // Don't fail registration if agent profile creation fails
        }
      }

      // 🎯 REFERRAL SYSTEM: Mark referral as registered if valid referral code was used
      if (referralInfo) {
        try {
          if (referralInfo.source === 'referral') {
            // Update existing referral record
            await pool.query(`
              UPDATE referrals 
              SET status = 'registered', referee_id = ?
              WHERE referral_code = ?
            `, [user.id, referral_code]);
          } else if (referralInfo.source === 'product_share') {
            // Create new referral record for product share
            await pool.query(`
              INSERT INTO referrals (
                referrer_id, referee_id, referral_code, status, bonus_type, product_id
              ) VALUES (?, ?, ?, 'registered', 'product_share', ?)
            `, [referralInfo.referrer_id, user.id, referral_code, referralInfo.product_id]);
          }

          // Update product share statistics
          await pool.query(`
            UPDATE product_shares 
            SET registrations_count = registrations_count + 1
            WHERE referral_code = ?
          `, [referral_code]);

          // Update referral clicks to mark as converted
          await pool.query(`
            UPDATE referral_clicks 
            SET converted_to_registration = TRUE, user_id = ?
            WHERE referral_code = ? AND user_id IS NULL
          `, [user.id, referral_code]);

          // Update referral sessions to mark as registered
          await pool.query(`
            UPDATE referral_sessions 
            SET status = 'registered', user_id = ?
            WHERE referral_code = ? AND user_id IS NULL
          `, [user.id, referral_code]);

          console.log(`[REFERRAL] Registration completed for referral code: ${referral_code}`);
        } catch (referralUpdateErr) {
          console.error('[REFERRAL ERROR] Failed to update referral on registration:', referralUpdateErr.message);
          // Don't fail registration if referral update fails
        }
      }
      
      const token = signLongLivedToken(user);
      
      // Send welcome email
      try {
        const dashboardUrls = {
          buyer: 'https://africandealsdomain.com/buyer/dashboard',
          seller: 'https://africandealsdomain.com/seller/dashboard',
          agent: 'https://africandealsdomain.com/agent/dashboard',
          admin: 'https://africandealsdomain.com/admin/dashboard'
        };
        
        await sendTemplatedEmail(
          email,
          `Welcome to African Deals Domain, ${name}!`,
          'welcome',
          {
            userName: name,
            userType: role.charAt(0).toUpperCase() + role.slice(1),
            email: email,
            dashboardUrl: dashboardUrls[role] || 'https://africandealsdomain.com',
            websiteUrl: 'https://africandealsdomain.com',
            supportUrl: 'https://africandealsdomain.com/support',
            contactUrl: 'https://africandealsdomain.com/contact'
          }
        );
        console.log('[EMAIL SUCCESS] Welcome email sent to:', email);
      } catch (emailErr) {
        console.error('[EMAIL ERROR] Failed to send welcome email:', emailErr.message);
        // Don't fail registration if email fails
      }
      
      // Send admin alert for new agent/seller registrations
      if (role === 'agent' || role === 'seller') {
        try {
          await sendTemplatedEmail(
            'admin@africandealsdomain.com',
            `New ${role.charAt(0).toUpperCase() + role.slice(1)} Registration - ${name}`,
            'admin-alert',
            {
              alertType: 'Registration',
              alertTitle: `New ${role.charAt(0).toUpperCase() + role.slice(1)} Registration`,
              alertDescription: `A new ${role} has registered on the platform and may require verification.`,
              priority: 'medium',
              timestamp: new Date().toLocaleString(),
              alertId: `REG-${Date.now()}`,
              systemModule: 'User Registration',
              eventType: `${role.charAt(0).toUpperCase() + role.slice(1)} Registration`,
              severityLevel: 'Medium',
              userInfo: {
                userName: name,
                userEmail: email,
                userType: role.charAt(0).toUpperCase() + role.slice(1),
                userId: user.id,
                registrationDate: new Date().toLocaleDateString(),
                userPhone: phone || 'Not provided'
              },
              recommendedActions: [
                `Review the new ${role} profile`,
                'Verify contact information',
                'Send welcome message if appropriate',
                'Monitor initial activity'
              ],
              adminDashboardUrl: 'https://africandealsdomain.com/admin/dashboard',
              reviewUrl: `https://africandealsdomain.com/admin/users/${user.id}`,
              systemLogsUrl: 'https://africandealsdomain.com/admin/logs',
              supportUrl: 'https://africandealsdomain.com/admin/support'
            }
          );
          console.log('[EMAIL SUCCESS] Admin alert sent for new', role);
        } catch (emailErr) {
          console.error('[EMAIL ERROR] Failed to send admin alert:', emailErr.message);
        }
      }    
        
      // Get redirect URL from referral session if exists, or from localStorage fallback
      let redirectUrl = null;
      if (referralInfo) {
        try {
          const [sessions] = await pool.query(`
            SELECT redirect_url, product_id FROM referral_sessions 
            WHERE referral_code = ?
            ORDER BY updated_at DESC LIMIT 1
          `, [referral_code]);
          
          if (sessions.length > 0) {
            const sess = sessions[0];
            if (sess.redirect_url) {
              redirectUrl = sess.redirect_url;
            } else if (sess.product_id) {
              // Fallback to product detail page
              redirectUrl = `/buyer/product-detail.html?id=${sess.product_id}&ref=${referral_code}`;
            }
          }
        } catch (err) {
          console.error('[REFERRAL] Failed to get redirect URL:', err);
        }
      }

      console.log('[AUTH SUCCESS] User registered:', { id: user.id, email: user.email, role: user.role });
      return res.json({ 
        token, 
        user,
        redirectUrl: redirectUrl
      });
      
    } catch (dbErr) {
      console.error('[DB ERROR] Insert user failed:', dbErr.message);
      if (dbErr.message.includes('ER_NO_SUCH_TABLE')) {
        return res.status(500).json({ error: 'Database error: users table missing.' });
      }
      if (dbErr.message.includes('ER_BAD_FIELD_ERROR')) {
        console.error('[DB ERROR] Missing column in users table:', dbErr.message);
        return res.status(500).json({ error: 'Database error: missing column in users table.' });
      }
      return res.status(500).json({ error: 'Database error: ' + dbErr.message });
    }
  } catch (err) {
    console.error('[AUTH ERROR] Registration failed:', err.message);
    next(err);
  }
});

// Login (all roles)
router.post('/login', async (req, res, next) => {
  const startTime = Date.now();
  try {
    console.log('[AUTH] 🔐 Login attempt started:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('[AUTH] ❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Step 1: Query user (with timeout)
    console.log('[AUTH] 📊 Querying user...');
    let users;
    try {
      [users] = await Promise.race([
        pool.query('SELECT * FROM users WHERE email = ?', [email]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
      ]);
    } catch (dbErr) {
      console.error('[AUTH] ❌ Query users failed:', dbErr.message);
      if (dbErr.message.includes('ER_NO_SUCH_TABLE')) {
        console.error("[AUTH] 🔧 'users' table missing. Creating...");
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            role VARCHAR(32),
            phone VARCHAR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`);
          console.log("[AUTH] ✅ 'users' table created.");
          return res.status(400).json({ error: 'User table was missing. Please try again.' });
        } catch (createErr) {
          console.error('[AUTH] ❌ Failed to create users table:', createErr.message);
          return res.status(500).json({ error: 'Database error: users table missing and could not be created.' });
        }
      } else {
        return res.status(500).json({ error: 'Database error: ' + dbErr.message });
      }
    }
    
    if (!users || users.length === 0) {
      console.log('[AUTH] ❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    console.log('[AUTH] ✅ User found:', { id: user.id, role: user.role });
    
    // Step 2: Password verification with legacy/plaintext fallback and auto-migration
    console.log('[AUTH] 🔒 Verifying password...');
    let match = false;
    try {
      // Prefer password_hash if present; fallback to password
      let passwordToCheck = user.password_hash || user.password;
      if (!passwordToCheck) {
        console.log('[AUTH] ❌ No password value found for user:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Normalize legacy PHP bcrypt prefix $2y$ to $2b$ for node-bcrypt compatibility
      if (typeof passwordToCheck === 'string' && passwordToCheck.startsWith('$2y$')) {
        passwordToCheck = '$2b$' + passwordToCheck.slice(4);
      }

      const looksLikeBcrypt = typeof passwordToCheck === 'string' && passwordToCheck.startsWith('$2');

      if (looksLikeBcrypt) {
        // Standard bcrypt compare with timeout guard
        match = await Promise.race([
          bcrypt.compare(password, passwordToCheck),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Password verification timeout')), 10000))
        ]);
      } else {
        // Fallback: stored password appears to be plaintext or non-bcrypt legacy
        // Perform safe equality check and auto-migrate to bcrypt if it matches
        if (password === String(passwordToCheck)) {
          match = true;
          try {
            const newHash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [newHash, user.id]);
            console.log(`[AUTH] 🔄 Autowired password migration to bcrypt completed for user ${user.id}`);
          } catch (migrateErr) {
            console.warn('[AUTH] ⚠️ Password migration failed (will still allow login this time):', migrateErr.message);
          }
        } else {
          match = false;
        }
      }
    } catch (bcryptErr) {
      console.error('[AUTH] ❌ Password verification failed:', bcryptErr.message);
      if (bcryptErr.message.includes('timeout')) {
        return res.status(500).json({ error: 'Authentication timeout. Please try again.' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!match) {
      console.log('[AUTH] ❌ Password mismatch for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Step 3: Agent profile check (async, non-blocking)
    if (user.role === 'agent') {
      console.log('[AUTH] 🤖 Checking agent profile...');
      // Don't await this - do it asynchronously to not block login
      setImmediate(async () => {
        try {
          const [agentProfile] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [user.id]);
          if (agentProfile.length === 0) {
            console.log(`[AUTH] 🔧 Creating agent profile for user ${user.id}...`);
            await pool.query(`
              INSERT INTO agents (user_id, first_name, last_name, email, phone, status, agent_type)
              VALUES (?, ?, ?, ?, ?, 'offline', NULL)
            `, [
              user.id,
              user.name.split(' ')[0] || '',
              user.name.split(' ')[1] || '',
              user.email,
              user.phone
            ]);
            console.log(`[AUTH] ✅ Agent profile created for user ${user.id}.`);
          }
        } catch (agentErr) {
          console.error(`[AUTH] ❌ Failed to auto-create agent profile for user ${user.id}:`, agentErr.message);
        }
      });
    }
    
    // Step 4: Generate JWT token
    console.log('[AUTH] 🎫 Generating token...');
    
    // Long-lived token based on JWT_EXP_DAYS (default 365 days)
    console.log(`[AUTH] 🕒 Token expiration set to: ${TOKEN_EXP_DAYS} days for role: ${user.role}`);
    const token = signLongLivedToken(user);
    
    const loginTime = Date.now() - startTime;
    console.log(`[AUTH] ✅ Login successful in ${loginTime}ms:`, { id: user.id, email: user.email, role: user.role });
    
    // Get agent type if user is an agent or admin with agent privileges
    let agentType = null;
    if (user.role === 'agent' || user.role === 'admin') {
      try {
        const [agentData] = await pool.query('SELECT agent_type FROM agents WHERE user_id = ?', [user.id]);
        if (agentData.length > 0) {
          agentType = agentData[0].agent_type;
          console.log(`[AUTH] 🎯 Found agent type for ${user.role}: ${agentType}`);
        } else {
          console.log(`[AUTH] 📋 No agent record found for user ${user.id} (${user.role})`);
        }
        // Fallback to users.agent_type if agents.agent_type is null
        if (!agentType) {
          const [userRows] = await pool.query('SELECT agent_type FROM users WHERE id = ?', [user.id]);
          if (userRows.length > 0 && userRows[0].agent_type) {
            agentType = userRows[0].agent_type;
            console.log(`[AUTH] 🔄 Using fallback users.agent_type: ${agentType}`);
          }
        }
      } catch (agentErr) {
        console.warn('[AUTH] Could not fetch agent type:', agentErr.message);
      }
    }
    
    // Check for pending referral session redirect
    let redirectUrl = null;
    if (user.role === 'buyer') {
      try {
        const [sessions] = await pool.query(`
          SELECT redirect_url FROM referral_sessions 
          WHERE user_id = ? AND status IN ('clicked', 'registered')
          ORDER BY updated_at DESC LIMIT 1
        `, [user.id]);
        
        if (sessions.length > 0 && sessions[0].redirect_url) {
          redirectUrl = sessions[0].redirect_url;
          console.log(`[AUTH] 🔗 Found referral redirect URL: ${redirectUrl}`);
        }
      } catch (err) {
        console.error('[REFERRAL] Failed to get redirect URL:', err);
      }
    }

    return res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        phone: user.phone,
        agent_type: agentType
      },
      redirectUrl: redirectUrl
    });
    
  } catch (err) {
    const loginTime = Date.now() - startTime;
    console.error(`[AUTH] ❌ Login failed after ${loginTime}ms:`, err.message);
    return res.status(500).json({ error: 'Authentication error. Please try again.' });
  }
});

// Agent-specific login endpoint (for PDA testing)
router.post('/agent-login', async (req, res, next) => {
  const startTime = Date.now();
  try {
    console.log('[AUTH] 🤖 Agent login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('[AUTH] ❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Query user with agent role check
    console.log('[AUTH] 📊 Querying agent user...');
    let users;
    try {
      [users] = await Promise.race([
        pool.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, 'agent']),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
      ]);
    } catch (dbErr) {
      console.error('[AUTH] ❌ Query agent failed:', dbErr.message);
      return res.status(500).json({ error: 'Database error: ' + dbErr.message });
    }
    
    if (!users || users.length === 0) {
      console.log('[AUTH] ❌ Agent not found:', email);
      return res.status(401).json({ error: 'Invalid agent credentials' });
    }
    
    const user = users[0];
    console.log('[AUTH] ✅ Agent found:', { id: user.id, role: user.role });
    
    // Password verification
    console.log('[AUTH] 🔒 Verifying password...');
    let match;
    try {
      match = await Promise.race([
        bcrypt.compare(password, user.password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Password verification timeout')), 10000))
      ]);
    } catch (bcryptErr) {
      console.error('[AUTH] ❌ Password verification failed:', bcryptErr.message);
      return res.status(401).json({ error: 'Invalid agent credentials' });
    }
    
    if (!match) {
      console.log('[AUTH] ❌ Password mismatch for agent:', email);
      return res.status(401).json({ error: 'Invalid agent credentials' });
    }

    // Get agent profile
    console.log('[AUTH] 🤖 Fetching agent profile...');
    let agentProfile = null;
    try {
      const [agentData] = await pool.query('SELECT * FROM agents WHERE user_id = ?', [user.id]);
      if (agentData.length > 0) {
        agentProfile = agentData[0];
        console.log(`[AUTH] ✅ Agent profile found: ${agentProfile.agent_type}`);
      } else {
        console.log(`[AUTH] ⚠️ No agent profile found, creating one...`);
        // Create agent profile if it doesn't exist
        await pool.query(`
          INSERT INTO agents (user_id, phone, status, agent_type, created_at, updated_at)
          VALUES (?, ?, 'offline', 'pickup_delivery', NOW(), NOW())
        `, [user.id, user.phone || '+250788910639']);
        
        const [newAgentData] = await pool.query('SELECT * FROM agents WHERE user_id = ?', [user.id]);
        agentProfile = newAgentData[0];
        console.log(`[AUTH] ✅ Agent profile created`);
      }
    } catch (agentErr) {
      console.error('[AUTH] ❌ Agent profile error:', agentErr.message);
      // Continue without agent profile for now
    }
    
    // Generate JWT token
    console.log('[AUTH] 🎫 Generating token...');
    const token = signLongLivedToken(user);
    
    const loginTime = Date.now() - startTime;
    console.log(`[AUTH] ✅ Agent login successful in ${loginTime}ms:`, { id: user.id, email: user.email });
    
    return res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        phone: user.phone
      },
      agent: agentProfile ? {
        id: agentProfile.id,
        name: user.name,
        agent_type: agentProfile.agent_type,
        status: agentProfile.status,
        phone: agentProfile.phone || user.phone
      } : null
    });
    
  } catch (err) {
    const loginTime = Date.now() - startTime;
    console.error(`[AUTH] ❌ Agent login failed after ${loginTime}ms:`, err.message);
    return res.status(500).json({ error: 'Agent authentication error. Please try again.' });
  }
});

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Role middleware
function requireRole(...roles) {
  return (req, res, next) => {
    // Flatten roles array in case it's passed as an array
    const flatRoles = roles.flat();
    if (!req.user || !flatRoles.includes(req.user.role)) {
      console.log(`[AUTH] Role check failed. User role: ${req.user?.role}, Required roles: ${flatRoles.join(', ')}`);
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Token refresh endpoint
router.post('/refresh-token', requireAuth, async (req, res) => {
  try {
    console.log('[AUTH] 🔄 Refreshing token for user:', req.user.id);
    
    // Verify user still exists and is active
    const [users] = await pool.query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // Generate new long-lived token
    console.log(`[AUTH] 🕒 New token expiration set to: ${TOKEN_EXP_DAYS} days for role: ${user.role}`);
    const newToken = signLongLivedToken(user);
    
    console.log('[AUTH] ✅ Token refreshed successfully for user:', user.email);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      expiresIn: `${TOKEN_EXP_DAYS} days`
    });
    
  } catch (error) {
    console.error('[AUTH] ❌ Token refresh failed:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Token verification endpoint
router.get('/verify', requireAuth, async (req, res) => {
  try {
    console.log('[AUTH] 🔍 Verifying token for user:', req.user.id);
    
    // Verify user still exists and is active
    const [users] = await pool.query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      message: 'Token is valid',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      tokenExpiry: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null
    });
    
  } catch (error) {
    console.error('[AUTH] ❌ Token verification failed:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

// Logout endpoint (no server state to clear for JWT, but respond OK for client flow)
router.post('/logout', requireAuth, async (req, res) => {
  try {
    console.log('[AUTH] 🚪 Logout requested for user:', req.user.id);
    // With stateless JWT, there's nothing to invalidate server-side unless using a blacklist.
    // We just respond success so client can clear local storage.
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('[AUTH] Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Profile (all roles)
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, phone, address, city, country FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    next(err);
  }
});

// Auth check endpoint
router.get('/check', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[AUTH] /api/auth/check: No token provided');
    return res.status(401).json({ error: 'No token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    console.log('[AUTH] /api/auth/check: Token valid for user:', user);
    res.json(user);
  } catch (err) {
    console.warn('[AUTH] /api/auth/check: Invalid or expired token:', err.message);
    if (process.env.NODE_ENV === 'development') console.error(err.stack);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Token validation endpoint (used by frontend auth-utils.js)
router.get('/validate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[AUTH] /api/auth/validate: No token provided');
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.warn('[AUTH] /api/auth/validate: Invalid token format');
    return res.status(401).json({ success: false, error: 'Invalid token format' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    console.log('[AUTH] /api/auth/validate: Token valid for user:', decoded.id);
    
    // Get fresh user data from database
    try {
      const [users] = await pool.query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [decoded.id]);
      if (users.length === 0) {
        console.warn('[AUTH] /api/auth/validate: User not found in database:', decoded.id);
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      
      const user = users[0];
      console.log('[AUTH] /api/auth/validate: User data refreshed:', { id: user.id, role: user.role });
      
      // Get agent type if user is an agent
      let agentType = null;
      if (user.role === 'agent') {
        try {
          const [agentData] = await pool.query('SELECT agent_type FROM agents WHERE user_id = ?', [user.id]);
          if (agentData.length > 0) {
            agentType = agentData[0].agent_type;
          }
        } catch (agentErr) {
          console.warn('[AUTH] Could not fetch agent type for validation:', agentErr.message);
        }
      }
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          agent_type: agentType
        },
        tokenExpiry: decoded && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
      });
    } catch (dbErr) {
      console.error('[AUTH] /api/auth/validate: Database error:', dbErr.message);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } catch (err) {
    console.warn('[AUTH] /api/auth/validate: Invalid or expired token:', err.message);
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

// Verify endpoint (alias for validate - used by some dashboards)
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[AUTH] /api/auth/verify: No token provided');
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.warn('[AUTH] /api/auth/verify: Invalid token format');
    return res.status(401).json({ success: false, error: 'Invalid token format' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    console.log('[AUTH] /api/auth/verify: Token valid for user:', decoded.id);
    
    // Get fresh user data from database
    try {
      const [users] = await pool.query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [decoded.id]);
      if (users.length === 0) {
        console.warn('[AUTH] /api/auth/verify: User not found in database:', decoded.id);
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      
      const user = users[0];
      console.log('[AUTH] /api/auth/verify: User data refreshed:', { id: user.id, role: user.role });
      
      // Get agent type if user is an agent
      let agentType = null;
      if (user.role === 'agent') {
        try {
          const [agentData] = await pool.query('SELECT agent_type FROM agents WHERE user_id = ?', [user.id]);
          if (agentData.length > 0) {
            agentType = agentData[0].agent_type;
          }
        } catch (agentErr) {
          console.warn('[AUTH] Could not fetch agent type for verify:', agentErr.message);
        }
      }
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          agent_type: agentType
        },
        tokenExpiry: decoded && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
      });
    } catch (dbErr) {
      console.error('[AUTH] /api/auth/verify: Database error:', dbErr.message);
      res.status(500).json({ success: false, error: 'Database error' });
    }
  } catch (err) {
    console.warn('[AUTH] /api/auth/verify: Invalid or expired token:', err.message);
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  console.log('[AUTH] /api/auth/logout: User logged out');
  // Since we're using JWT tokens, logout is handled client-side by removing the token
  // We could implement a token blacklist here if needed for enhanced security
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==================== PASSWORD RESET FUNCTIONALITY ====================

// Forgot password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      // Still return success for security (don't reveal if email exists)
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    }

    const user = users[0];
    
    // Generate reset token and OTP
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Store reset token in database
    try {
      // Create password_resets table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          reset_token VARCHAR(64) NOT NULL,
          otp_code VARCHAR(6) NOT NULL,
          expires_at DATETIME NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_token (reset_token),
          INDEX idx_otp (otp_code),
          INDEX idx_user_id (user_id)
        )
      `);
      
      // Clean up old reset tokens for this user
      await pool.query('DELETE FROM password_resets WHERE user_id = ? OR expires_at < NOW()', [user.id]);
      
      // Insert new reset token
      await pool.query(
        'INSERT INTO password_resets (user_id, reset_token, otp_code, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, resetToken, otp, expiresAt]
      );
    } catch (dbErr) {
      console.error('[AUTH] Error storing reset token:', dbErr.message);
      return res.status(500).json({ error: 'Database error occurred' });
    }

    // Send reset email with both link and OTP
    try {
      const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password.html?token=${resetToken}`;
      
      await sendTemplatedEmail(
        email,
        'Password Reset Request - ADD Physical Products',
        'password-reset',
        {
          userName: user.name,
          resetLink: resetLink,
          otpCode: otp,
          expiryTime: '1 hour',
          supportEmail: 'support@africandealsdomain.com',
          websiteUrl: 'https://africandealsdomain.com'
        }
      );
      
      console.log('[AUTH] Password reset email sent to:', email);
    } catch (emailErr) {
      console.error('[AUTH] Failed to send reset email:', emailErr.message);
      // Still continue - user might use OTP method
    }

    res.json({ 
      success: true, 
      message: 'Password reset instructions have been sent to your email.',
      // In development, also return OTP (remove in production)
      ...(process.env.NODE_ENV === 'development' && { otp: otp })
    });

  } catch (error) {
    console.error('[AUTH] Forgot password error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, otp } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (!token && !otp) {
      return res.status(400).json({ error: 'Reset token or OTP is required' });
    }

    let resetRecord = null;

    if (token) {
      // Find reset record by token
      const [records] = await pool.query(`
        SELECT pr.*, u.id as user_id, u.email, u.name 
        FROM password_resets pr 
        JOIN users u ON pr.user_id = u.id 
        WHERE pr.reset_token = ? AND pr.used = FALSE AND pr.expires_at > NOW()
      `, [token]);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      resetRecord = records[0];
    } else if (otp) {
      // Find reset record by OTP
      const [records] = await pool.query(`
        SELECT pr.*, u.id as user_id, u.email, u.name 
        FROM password_resets pr 
        JOIN users u ON pr.user_id = u.id 
        WHERE pr.otp_code = ? AND pr.used = FALSE AND pr.expires_at > NOW()
        ORDER BY pr.created_at DESC LIMIT 1
      `, [otp]);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired OTP code' });
      }
      
      resetRecord = records[0];
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, resetRecord.user_id]);

    // Mark reset token as used
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = ?', [resetRecord.id]);

    // Send confirmation email
    try {
      await sendTemplatedEmail(
        resetRecord.email,
        'Password Reset Successful - ADD Physical Products',
        'password-reset-success',
        {
          userName: resetRecord.name,
          resetTime: new Date().toLocaleString(),
          loginUrl: `${req.protocol}://${req.get('host')}/auth/auth-buyer.html`,
          supportEmail: 'support@africandealsdomain.com'
        }
      );
      console.log('[AUTH] Password reset confirmation sent to:', resetRecord.email);
    } catch (emailErr) {
      console.error('[AUTH] Failed to send confirmation email:', emailErr.message);
    }

    console.log(`[AUTH] Password reset successful for user ${resetRecord.user_id}`);
    res.json({ success: true, message: 'Your password has been reset successfully. You can now log in with your new password.' });

  } catch (error) {
    console.error('[AUTH] Reset password error:', error);
    res.status(500).json({ error: 'An error occurred while resetting your password' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;
    
    if (!otp) {
      return res.status(400).json({ error: 'OTP code is required' });
    }

    // Find valid OTP
    const [records] = await pool.query(`
      SELECT pr.*, u.id as user_id, u.email, u.name 
      FROM password_resets pr 
      JOIN users u ON pr.user_id = u.id 
      WHERE pr.otp_code = ? AND pr.used = FALSE AND pr.expires_at > NOW()
      ORDER BY pr.created_at DESC LIMIT 1
    `, [otp]);
    
    if (records.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }
    
    const resetRecord = records[0];
    
    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      resetToken: resetRecord.reset_token,
      userEmail: resetRecord.email
    });

  } catch (error) {
    console.error('[AUTH] Verify OTP error:', error);
    res.status(500).json({ error: 'An error occurred while verifying OTP' });
  }
});

// Change password endpoint (for authenticated users via settings)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current user data
    const [users] = await pool.query('SELECT id, name, email, password FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, user.id]);

    // Send confirmation email
    try {
      await sendTemplatedEmail(
        user.email,
        'Password Changed Successfully - ADD Physical Products',
        'password-change-success',
        {
          userName: user.name,
          changeTime: new Date().toLocaleString(),
          userRole: req.user.role,
          supportEmail: 'support@africandealsdomain.com'
        }
      );
      console.log('[AUTH] Password change confirmation sent to:', user.email);
    } catch (emailErr) {
      console.error('[AUTH] Failed to send password change confirmation:', emailErr.message);
    }

    console.log(`[AUTH] Password changed successfully for user ${user.id}`);
    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.status(500).json({ error: 'An error occurred while changing your password' });
  }
});

module.exports = { router, requireAuth, requireRole }; 