const express = require('express');
const router = express.Router();
const pool = require('../db'); // Use the shared database pool
const jwt = require('jsonwebtoken');

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adminafricandealsdomainpassword');
    
    const [users] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? AND role = ?',
      [decoded.id, 'admin']
    );

    if (users.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/admin/create-agent - Create new agent directly by admin
router.post('/create-agent', authenticateAdmin, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      agent_type,
      district,
      latitude,
      longitude,
      work_zone,
      max_delivery_distance,
      available_days,
      max_orders_per_trip,
      site_name,
      site_type,
      site_address,
      site_capacity,
      operating_hours
    } = req.body;

    console.log('[ADMIN] Creating new agent:', { email, agent_type, first_name, last_name });

    // Validate required fields
    if (!first_name || !last_name || !email || !phone || !password || !agent_type) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['first_name', 'last_name', 'email', 'phone', 'password', 'agent_type']
      });
    }

    // Validate agent type
    const validAgentTypes = ['fast_delivery', 'pickup_delivery', 'pickup_site_manager'];
    if (!validAgentTypes.includes(agent_type)) {
      return res.status(400).json({ 
        error: 'Invalid agent type',
        validTypes: validAgentTypes
      });
    }

    // Check if email already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user account
    const [userResult] = await pool.execute(`
      INSERT INTO users (
        name, email, password, role, phone, 
        is_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      `${first_name} ${last_name}`,
      email,
      hashedPassword,
      'agent',
      phone,
      1 // Admin-created agents are pre-verified
    ]);

    const userId = userResult.insertId;

    // Agent will be identified by their user ID and agent ID

    // Create agent profile
    const [agentResult] = await pool.execute(`
      INSERT INTO agents (
        user_id, agent_type, phone, status, admin_approval_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'offline', 'approved', NOW(), NOW())
    `, [userId, agent_type, phone]);

    const agentId = agentResult.insertId;

    // Store role-specific data based on agent type
    let roleSpecificData = {};
    
    switch(agent_type) {
      case 'fast_delivery':
        roleSpecificData = {
          work_zone: work_zone || 'Not specified',
          max_delivery_distance: max_delivery_distance || 10,
          available_days: available_days ? JSON.stringify(available_days) : JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
        };
        break;
      case 'pickup_delivery':
        roleSpecificData = {
          max_orders_per_trip: max_orders_per_trip || 5
        };
        break;
      case 'pickup_site_manager':
        roleSpecificData = {
          site_name: site_name || 'Default Site',
          site_type: site_type || 'pickup_point',
          street_address: site_address || 'Address not specified',
          opening_hours: opening_hours || '08:00',
          closing_hours: closing_hours || '18:00',
          operating_days: operating_days ? JSON.stringify(operating_days) : JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
        };
        break;
    }

    // Store agent verification data (admin-created agents are auto-approved)
    const verificationData = {
      agent_id: agentId,
      user_id: userId,
      verification_status: 'approved',
      district: district,
      admin_notes: 'Agent created directly by admin - pre-approved',
      ...roleSpecificData
    };

    // Build dynamic insert query based on agent type
    const columns = Object.keys(verificationData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(verificationData);

    await pool.execute(`
      INSERT INTO agent_verification (
        ${columns.join(', ')}, submitted_at, reviewed_at
      ) VALUES (${placeholders}, NOW(), NOW())
    `, values);

    console.log(`[ADMIN] Successfully created agent: ${email} (${agent_type})`);

    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: agentId,
        user_id: userId,
        email: email,
        name: `${first_name} ${last_name}`,
        agent_type: agent_type,
        status: 'offline',
        admin_approval_status: 'approved'
      }
    });

  } catch (error) {
    console.error('[ADMIN] Error creating agent:', error);
    res.status(500).json({ 
      error: 'Failed to create agent',
      details: error.message
    });
  }
});

// GET /api/admin/agent-types - Get available agent types for admin
router.get('/agent-types', authenticateAdmin, async (req, res) => {
  try {
    const agentTypes = [
      {
        type_code: 'fast_delivery',
        type_name: 'Fast Delivery Agent',
        description: 'Handle grocery and local market deliveries with quick turnaround times',
        marketplace_type: 'grocery',
        requirements: [
          'Motorcycle or bicycle',
          'Valid driving license',
          'Mobile phone with GPS',
          'Available for flexible hours'
        ],
        benefits: [
          'Higher commission rates',
          'Flexible working hours',
          'Quick payment processing',
          'Performance bonuses'
        ]
      },
      {
        type_code: 'pickup_delivery',
        type_name: 'Pickup Delivery Agent',
        description: 'Collect and deliver physical products from sellers to buyers',
        marketplace_type: 'physical',
        requirements: [
          'Vehicle (motorcycle, car, or van)',
          'Valid driving license',
          'Mobile phone with GPS',
          'Physical fitness for handling packages'
        ],
        benefits: [
          'Steady income stream',
          'Order protection system',
          'Delivery tracking tools',
          'Customer support assistance'
        ]
      },
      {
        type_code: 'pickup_site_manager',
        type_name: 'Pickup Site Manager',
        description: 'Manage pickup locations and assist customers as community agents',
        marketplace_type: 'both',
        requirements: [
          'Fixed location or shop',
          'Customer service skills',
          'Mobile phone',
          'Basic computer literacy'
        ],
        benefits: [
          'Fixed location work',
          'Community engagement',
          'Steady customer base',
          'Management responsibilities'
        ]
      }
    ];

    res.json({ agentTypes });
  } catch (error) {
    console.error('[ADMIN] Error fetching agent types:', error);
    res.status(500).json({ error: 'Failed to fetch agent types' });
  }
});

// Get all agent registrations
router.get('/agent-registrations', authenticateAdmin, async (req, res) => {
  try {
    const { status, agent_type, date } = req.query;
    
    let query = `
      SELECT 
        av.id,
        av.verification_status,
        av.submitted_at,
        av.reviewed_at,
        av.admin_notes,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        a.agent_type
      FROM agent_verification av
      JOIN users u ON av.user_id = u.id
      JOIN agents a ON av.agent_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND av.verification_status = ?';
      params.push(status);
    }
    
    if (agent_type) {
      query += ' AND a.agent_type = ?';
      params.push(agent_type);
    }
    
    if (date) {
      query += ' AND DATE(av.submitted_at) = ?';
      params.push(date);
    }
    
    query += ' ORDER BY av.submitted_at DESC';
    
    const [registrations] = await pool.execute(query, params);

    res.json({
      success: true,
      data: registrations
    });

  } catch (error) {
    console.error('Error fetching agent registrations:', error);
    res.status(500).json({ error: 'Failed to fetch agent registrations' });
  }
});

// Get specific agent registration details
router.get('/agent-registration/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [registrations] = await pool.execute(`
      SELECT 
        av.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        a.agent_type
      FROM agent_verification av
      JOIN users u ON av.user_id = u.id
      JOIN agents a ON av.agent_id = a.id
      WHERE av.id = ?
    `, [id]);

    if (registrations.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      success: true,
      data: registrations[0]
    });

  } catch (error) {
    console.error('Error fetching registration details:', error);
    res.status(500).json({ error: 'Failed to fetch registration details' });
  }
});

// Update agent registration status
router.put('/agent-registration/:id/status', authenticateAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status, admin_notes, rejection_reason } = req.body;

    // Validate status
    const validStatuses = ['pending', 'under_review', 'approved', 'rejected', 'requires_resubmission'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update verification record
    await connection.execute(`
      UPDATE agent_verification 
      SET verification_status = ?, 
          admin_notes = ?, 
          rejection_reason = ?,
          reviewed_by = ?, 
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [status, admin_notes || null, rejection_reason || null, req.adminId, id]);

    // Get registration details
    const [registrations] = await connection.execute(`
      SELECT av.agent_id, av.user_id, u.first_name, u.last_name, u.email, a.agent_type
      FROM agent_verification av
      JOIN users u ON av.user_id = u.id
      JOIN agents a ON av.agent_id = a.id
      WHERE av.id = ?
    `, [id]);

    if (registrations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Registration not found' });
    }

    const registration = registrations[0];

    // If approved, activate the agent
    if (status === 'approved') {
      await connection.execute(`
        UPDATE agents 
        SET is_verified = TRUE, 
            is_available = TRUE
        WHERE id = ?
      `, [registration.agent_id]);

      await connection.execute(`
        UPDATE users 
        SET is_verified = TRUE
        WHERE id = ?
      `, [registration.user_id]);

      // Create welcome notification for the agent
      await connection.execute(`
        INSERT INTO notifications (
          user_id, type, title, message, data, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        registration.user_id,
        'agent_approved',
        'Welcome to the Team!',
        `Congratulations! Your ${registration.agent_type.replace('_', ' ')} agent application has been approved. You can now start accepting orders.`,
        JSON.stringify({ agent_type: registration.agent_type })
      ]);

      // Get agent type configuration for commission setup
      const [agentTypeConfig] = await connection.execute(`
        SELECT commission_rate FROM agent_types_config WHERE type_code = ?
      `, [registration.agent_type]);

      if (agentTypeConfig.length > 0) {
        // Set up initial commission rate
        await connection.execute(`
          UPDATE agents 
          SET commission_rate = ?
          WHERE id = ?
        `, [agentTypeConfig[0].commission_rate, registration.agent_id]);
      }
    }

    // Create admin log
    await connection.execute(`
      INSERT INTO admin_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      req.adminId,
      'agent_registration_review',
      'agent_verification',
      id,
      JSON.stringify({
        status: status,
        agent_type: registration.agent_type,
        agent_name: `${registration.first_name} ${registration.last_name}`
      })
    ]);

    await connection.commit();

    res.json({
      success: true,
      message: `Registration ${status} successfully`
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating registration status:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  } finally {
    connection.release();
  }
});

// POST /api/admin/agent-registrations/:id/approve - Approve agent application
router.post('/agent-registrations/:id/approve', authenticateAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const applicationId = req.params.id;
    const { reviewNotes } = req.body;
    const adminId = req.adminId;
    
    // Get application details
    const [applications] = await connection.execute(`
      SELECT aa.*, u.id as user_id 
      FROM agent_applications aa 
      JOIN users u ON aa.user_id = u.id 
      WHERE aa.id = ?
    `, [applicationId]);
    
    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = applications[0];
    
    // Update application status
    await connection.execute(`
      UPDATE agent_applications 
      SET status = 'approved', 
          review_notes = ?, 
          reviewed_by = ?, 
          reviewed_at = NOW(), 
          updated_at = NOW()
      WHERE id = ?
    `, [reviewNotes || 'Application approved', adminId, applicationId]);
    
    // Update user status to active agent
    await connection.execute(`
      UPDATE users 
      SET status = 'approved', 
          is_active = 1,
          updated_at = NOW()
      WHERE id = ?
    `, [application.user_id]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Application approved successfully'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error approving application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  } finally {
    connection.release();
  }
});

// POST /api/admin/agent-registrations/:id/reject - Reject agent application
router.post('/agent-registrations/:id/reject', authenticateAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const applicationId = req.params.id;
    const { reviewNotes } = req.body;
    const adminId = req.adminId;
    
    // Get application details
    const [applications] = await connection.execute(`
      SELECT aa.*, u.id as user_id 
      FROM agent_applications aa 
      JOIN users u ON aa.user_id = u.id 
      WHERE aa.id = ?
    `, [applicationId]);
    
    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const application = applications[0];
    
    // Update application status
    await connection.execute(`
      UPDATE agent_applications 
      SET status = 'rejected', 
          review_notes = ?, 
          reviewed_by = ?, 
          reviewed_at = NOW(), 
          updated_at = NOW()
      WHERE id = ?
    `, [reviewNotes || 'Application rejected', adminId, applicationId]);
    
    // Update user status to rejected
    await connection.execute(`
      UPDATE users 
      SET status = 'rejected', 
          updated_at = NOW()
      WHERE id = ?
    `, [application.user_id]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Application rejected successfully'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  } finally {
    connection.release();
  }
});

// Duplicate route removed - using the hardcoded one above

// Create or update agent type
router.post('/agent-types', authenticateAdmin, async (req, res) => {
  try {
    const {
      id,
      type_code,
      type_name,
      description,
      commission_rate,
      marketplace_type,
      requirements,
      benefits,
      is_active
    } = req.body;

    // Validate required fields
    if (!type_code || !type_name || !commission_rate || !marketplace_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Parse JSON fields
    let parsedRequirements, parsedBenefits;
    try {
      parsedRequirements = typeof requirements === 'string' ? JSON.parse(requirements) : requirements;
      parsedBenefits = typeof benefits === 'string' ? JSON.parse(benefits) : benefits;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON in requirements or benefits' });
    }

    if (id) {
      // Update existing agent type
      await pool.execute(`
        UPDATE agent_types_config 
        SET type_code = ?, type_name = ?, description = ?, commission_rate = ?, 
            marketplace_type = ?, requirements = ?, benefits = ?, is_active = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [
        type_code, type_name, description, commission_rate,
        marketplace_type, JSON.stringify(parsedRequirements), 
        JSON.stringify(parsedBenefits), is_active ? 1 : 0, id
      ]);
    } else {
      // Create new agent type
      await pool.execute(`
        INSERT INTO agent_types_config (
          type_code, type_name, description, commission_rate, marketplace_type,
          requirements, benefits, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        type_code, type_name, description, commission_rate, marketplace_type,
        JSON.stringify(parsedRequirements), JSON.stringify(parsedBenefits), is_active ? 1 : 0
      ]);
    }

    // Log the action
    await pool.execute(`
      INSERT INTO admin_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      req.adminId,
      id ? 'agent_type_updated' : 'agent_type_created',
      'agent_types_config',
      id || null,
      JSON.stringify({ type_code, type_name, commission_rate })
    ]);

    res.json({
      success: true,
      message: `Agent type ${id ? 'updated' : 'created'} successfully`
    });

  } catch (error) {
    console.error('Error saving agent type:', error);
    res.status(500).json({ error: 'Failed to save agent type' });
  } finally {
    await connection.end();
  }
});

// Toggle agent type status
router.put('/agent-types/:id/toggle', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    await connection.execute(`
      UPDATE agent_types_config 
      SET is_active = ?, updated_at = NOW()
      WHERE id = ?
    `, [is_active ? 1 : 0, id]);

    // Log the action
    await connection.execute(`
      INSERT INTO admin_logs (
        admin_id, action, target_type, target_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      req.adminId,
      'agent_type_toggled',
      'agent_types_config',
      id,
      JSON.stringify({ is_active })
    ]);

    res.json({
      success: true,
      message: `Agent type ${is_active ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Error toggling agent type status:', error);
    res.status(500).json({ error: 'Failed to toggle agent type status' });
  } finally {
    await connection.end();
  }
});

// Get commission rules
router.get('/commission-rules', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    const [rules] = await connection.execute(`
      SELECT * FROM agent_commission_rules 
      ORDER BY agent_type, rule_type
    `);

    res.json({
      success: true,
      data: rules
    });

  } catch (error) {
    console.error('Error fetching commission rules:', error);
    res.status(500).json({ error: 'Failed to fetch commission rules' });
  } finally {
    await connection.end();
  }
});

// Create or update commission rule
router.post('/commission-rules', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    const {
      id,
      agent_type,
      rule_name,
      rule_type,
      commission_rate,
      fixed_amount,
      min_threshold,
      max_threshold,
      conditions,
      valid_from,
      valid_until,
      is_active
    } = req.body;

    // Parse conditions if it's a string
    let parsedConditions;
    try {
      parsedConditions = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON in conditions' });
    }

    if (id) {
      // Update existing rule
      await connection.execute(`
        UPDATE agent_commission_rules 
        SET agent_type = ?, rule_name = ?, rule_type = ?, commission_rate = ?,
            fixed_amount = ?, min_threshold = ?, max_threshold = ?, conditions = ?,
            valid_from = ?, valid_until = ?, is_active = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        agent_type, rule_name, rule_type, commission_rate || null,
        fixed_amount || null, min_threshold || null, max_threshold || null,
        JSON.stringify(parsedConditions), valid_from, valid_until, is_active ? 1 : 0, id
      ]);
    } else {
      // Create new rule
      await connection.execute(`
        INSERT INTO agent_commission_rules (
          agent_type, rule_name, rule_type, commission_rate, fixed_amount,
          min_threshold, max_threshold, conditions, valid_from, valid_until,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        agent_type, rule_name, rule_type, commission_rate || null,
        fixed_amount || null, min_threshold || null, max_threshold || null,
        JSON.stringify(parsedConditions), valid_from, valid_until, is_active ? 1 : 0
      ]);
    }

    res.json({
      success: true,
      message: `Commission rule ${id ? 'updated' : 'created'} successfully`
    });

  } catch (error) {
    console.error('Error saving commission rule:', error);
    res.status(500).json({ error: 'Failed to save commission rule' });
  } finally {
    await connection.end();
  }
});

// Get admin notifications
router.get('/notifications', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    const [notifications] = await connection.execute(`
      SELECT * FROM admin_notifications 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  } finally {
    await connection.end();
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    const { id } = req.params;

    await connection.execute(`
      UPDATE admin_notifications 
      SET is_read = TRUE, read_at = NOW()
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  } finally {
    await connection.end();
  }
});

// Get agent performance analytics
router.get('/agent-performance', authenticateAdmin, async (req, res) => {
  const connection = await getDbConnection();
  
  try {
    // Get overall performance metrics
    const [overallMetrics] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT a.id) as total_agents,
        COUNT(DISTINCT CASE WHEN a.is_available = 1 THEN a.id END) as active_agents,
        AVG(apm.customer_rating) as avg_rating,
        SUM(apm.total_earnings) as total_earnings,
        SUM(apm.commission_earned) as total_commission
      FROM agents a
      LEFT JOIN agent_performance_metrics apm ON a.id = apm.agent_id
      WHERE a.is_verified = 1
    `);

    // Get performance by agent type
    const [performanceByType] = await connection.execute(`
      SELECT 
        a.agent_type,
        COUNT(DISTINCT a.id) as agent_count,
        AVG(apm.customer_rating) as avg_rating,
        SUM(apm.total_orders) as total_orders,
        SUM(apm.completed_orders) as completed_orders,
        SUM(apm.total_earnings) as total_earnings
      FROM agents a
      LEFT JOIN agent_performance_metrics apm ON a.id = apm.agent_id
      WHERE a.is_verified = 1
      GROUP BY a.agent_type
    `);

    // Get top performers
    const [topPerformers] = await connection.execute(`
      SELECT 
        u.first_name,
        u.last_name,
        a.agent_type,
        SUM(apm.total_orders) as total_orders,
        AVG(apm.customer_rating) as avg_rating,
        SUM(apm.total_earnings) as total_earnings
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN agent_performance_metrics apm ON a.id = apm.agent_id
      WHERE a.is_verified = 1
      GROUP BY a.id
      ORDER BY total_earnings DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overall: overallMetrics[0],
        by_type: performanceByType,
        top_performers: topPerformers
      }
    });

  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({ error: 'Failed to fetch performance analytics' });
  } finally {
    await connection.end();
  }
});

module.exports = router;