const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const pool = require('../db');

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed!'));
    }
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is agent
const requireAgent = (req, res, next) => {
  if (req.user.role !== 'agent') {
    return res.status(403).json({ error: 'Agent access required' });
  }
  next();
};

// Middleware to get the agent-specific ID from the user ID in the token
const getAgentId = async (req, res, next) => {
  try {
    const [agent] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [req.user.id]);
    if (agent.length === 0) {
      // If agent profile doesn't exist, it might need to be created.
      // For now, we'll return an error.
      return res.status(404).json({ error: 'Agent profile not found. Please complete your agent registration.' });
    }
    req.agent = { id: agent[0].id }; // Attach agent.id to the request
    next();
  } catch (error) {
    console.error('Middleware getAgentId error:', error);
    res.status(500).json({ error: 'Internal server error while fetching agent profile' });
  }
};

// GET /api/agents/profile - Get agent profile
router.get('/profile', authenticateToken, requireAgent, async (req, res) => {
  try {
    const [agents] = await pool.query(`
      SELECT a.*, u.username, u.is_active, u.is_verified, u.last_login
      FROM users u 
      LEFT JOIN agents a ON u.id = a.user_id 
      WHERE u.id = ?
    `, [req.user.id]);

    if (agents.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = agents[0];

    res.json({
      agent: {
        ...agent,
        status: agent.status || 'offline'
      }
    });

  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/agents/status - Update agent status
router.put('/status', authenticateToken, requireAgent, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update or insert agent record
    await pool.query(`
      INSERT INTO agents (user_id, status, last_active) 
      VALUES (?, ?, NOW()) 
      ON DUPLICATE KEY UPDATE 
      status = VALUES(status), 
      last_active = VALUES(last_active)
    `, [req.user.id, status]);

    res.json({ message: 'Status updated successfully', status });

  } catch (error) {
    console.error('Update agent status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PUT /api/agents/agent-type - Set or update agent type
router.put('/agent-type', authenticateToken, requireAgent, async (req, res) => {
  try {
    const { agent_type } = req.body;
    
    // Validate agent type
    const validAgentTypes = ['fast_delivery', 'pickup_delivery', 'pickup_site_manager'];
    if (!validAgentTypes.includes(agent_type)) {
      return res.status(400).json({ error: 'Invalid agent type. Must be one of: fast_delivery, pickup_delivery, pickup_site_manager' });
    }

    // Check if agent profile exists
    const [existingAgent] = await pool.query('SELECT id, agent_type FROM agents WHERE user_id = ?', [req.user.id]);
    
    if (existingAgent.length === 0) {
      // Create agent profile with the specified type
      await pool.query(`
        INSERT INTO agents (user_id, agent_type, status, created_at) 
        VALUES (?, ?, 'offline', NOW())
      `, [req.user.id, agent_type]);
      
      console.log(`[AGENT] Created new agent profile for user ${req.user.id} with type: ${agent_type}`);
    } else {
      // Update existing agent type
      await pool.query(`
        UPDATE agents 
        SET agent_type = ?, updated_at = NOW() 
        WHERE user_id = ?
      `, [agent_type, req.user.id]);
      
      console.log(`[AGENT] Updated agent type for user ${req.user.id} from ${existingAgent[0].agent_type} to ${agent_type}`);
    }

    res.json({ 
      message: 'Agent type updated successfully', 
      agent_type: agent_type,
      action: existingAgent.length === 0 ? 'created' : 'updated'
    });

  } catch (error) {
    console.error('Update agent type error:', error);
    res.status(500).json({ error: 'Failed to update agent type' });
  }
});

// GET /api/agents/orders - Get agent's orders
router.get('/orders', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE o.agent_id = ?';
    let queryParams = [req.agent.id];

    if (status && status !== 'all') {
      if (status === 'active') {
        whereClause += ' AND o.tracking_status IN (?, ?, ?)';
        queryParams.push('assigned', 'picked_up', 'in_transit');
      } else if (status === 'delivered' || status === 'cancelled') {
        // These are final statuses in the main `status` column
        whereClause += ' AND o.status = ?';
        queryParams.push(status);
      } else {
        whereClause += ' AND o.tracking_status = ?';
        queryParams.push(status);
      }
    }

    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        COALESCE(o.delivery_fee * 0.3, 5.00) as agent_commission
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM orders o
      ${whereClause}
    `, queryParams);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get agent orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// GET /api/agents/orders/claimable - Get claimable orders
router.get('/orders/claimable', authenticateToken, requireAgent, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.name as buyer_name,
        u.name as buyer_full_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        u.home_lat as buyer_lat,
        u.home_lng as buyer_lng,
        u.home_address as buyer_address,
        COALESCE(o.delivery_fee, 10.00) as delivery_fee,
        COALESCE(o.delivery_fee * 0.3, 3.00) as agent_commission,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('pending', 'confirmed', 'processing')
        AND (o.agent_id IS NULL OR o.agent_id = 0)
      GROUP BY o.id
      ORDER BY o.created_at ASC
      LIMIT 20
    `);

    // Parse JSON fields
    const processedOrders = orders.map(order => ({
      ...order,
      pickup_location: order.pickup_location ? JSON.parse(order.pickup_location) : null,
      delivery_location: order.delivery_location ? JSON.parse(order.delivery_location) : null,
      shipping_address: order.shipping_address ? JSON.parse(order.shipping_address) : null
    }));

    res.json({ orders: processedOrders });

  } catch (error) {
    console.error('Get claimable orders error:', error);
    res.status(500).json({ error: 'Failed to get claimable orders' });
  }
});

// POST /api/agents/orders/:orderId/claim - Claim an order
router.post('/orders/:orderId/claim', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { orderId } = req.params;

    // Check if order exists and is claimable
    const [orders] = await pool.query(`
      SELECT * FROM orders 
      WHERE id = ? AND status IN ('pending', 'confirmed', 'processing') AND (agent_id IS NULL OR agent_id = 0)
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or already claimed' });
    }

    const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Claim the order and update status to shipped so buyer can track
    await pool.query(`
      UPDATE orders 
      SET agent_id = ?, status = 'shipped', tracking_status = 'assigned', delivery_code = ?, updated_at = NOW()
      WHERE id = ?
    `, [agentId, deliveryCode, orderId]);

    // Create order tracking entry
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, created_at)
      VALUES (?, 'assigned', 'Order assigned to agent', NOW())
    `, [orderId]);

    // Get order details to emit real-time update
    const [orderDetails] = await pool.query(`
      SELECT o.*, u.id as buyer_id FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE o.id = ?
    `, [orderId]);

    // Emit real-time update to buyer if socket.io is available
    if (orderDetails.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${orderDetails[0].buyer_id}`).emit('order_status_update', {
          orderId: orderId,
          status: 'shipped',
          tracking_status: 'assigned',
          message: 'Your order has been assigned to a delivery agent',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ message: 'Order claimed successfully' });

  } catch (error) {
    console.error('Claim order error:', error);
    res.status(500).json({ error: 'Failed to claim order' });
  }
});

// PUT /api/agents/orders/:orderId/status - Update order status
router.put('/orders/:orderId/status', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { orderId } = req.params;
    const { status, notes, location } = req.body;

    const validStatuses = ['assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order exists and is assigned to this agent
    const [orders] = await pool.query(`
      SELECT * FROM orders WHERE id = ? AND agent_id = ?
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Update order status
    await pool.query(`
      UPDATE orders 
      SET status = ?, tracking_status = ?, updated_at = NOW()
      WHERE id = ?
    `, [status === 'delivered' ? 'delivered' : 'shipped', status, orderId]);

    // Create tracking entry
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, location, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [orderId, status, notes || `Status updated to ${status}`, location ? JSON.stringify(location) : null]);

    // If delivered, update delivery confirmation
    if (status === 'delivered') {
      await pool.query(`
        UPDATE orders 
        SET delivered_at = NOW(),
            delivery_confirmed_at = NOW()
        WHERE id = ?
      `, [orderId]);
    }

    res.json({ message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET /api/agents/orders/:orderId - Get specific order details
router.get('/orders/:orderId', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { orderId } = req.params;

    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.name as buyer_name,
        u.name as buyer_full_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        u.home_lat, u.home_lng, u.home_address,
        COALESCE(o.delivery_fee * 0.3, 5.00) as agent_commission
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.agent_id = ?
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Get order items with seller information
    const [items] = await pool.query(`
      SELECT 
        oi.*,
        p.name as product_name, 
        p.main_image, 
        p.price as product_price,
        p.currency as product_currency,
        p.lat as product_lat, 
        p.lng as product_lng,
        p.description as product_description,
        s.name as seller_name,
        s.email as seller_email,
        s.phone as seller_phone,
        s.home_address as seller_address,
        s.home_lat as seller_lat,
        s.home_lng as seller_lng
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users s ON p.seller_id = s.id
      WHERE oi.order_id = ?
    `, [orderId]);

    // Get tracking history
    const [tracking] = await pool.query(`
      SELECT * FROM order_tracking 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `, [orderId]);

    order.items = items;
    order.tracking = tracking;

    res.json({ order });

  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

// GET /api/agents/analytics - Get agent analytics
router.get('/analytics', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Get today's stats
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
        SUM(CASE WHEN status = 'delivered' THEN COALESCE(delivery_fee * 0.3, 5.00) ELSE 0 END) as total_earnings
      FROM orders 
      WHERE agent_id = ? AND DATE(delivered_at) = CURDATE()
    `, [agentId]);

    // Get overall stats
    const [overallStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
        AVG(CASE WHEN status = 'delivered' AND delivered_at IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, created_at, delivered_at) END) as avg_delivery_time
      FROM orders 
      WHERE agent_id = ?
    `, [agentId]);

    res.json({
      analytics: {
        today: todayStats[0],
        overall: overallStats[0]
      }
    });

  } catch (error) {
    console.error('Get agent analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// PUT /api/agents/location - Update agent current location
router.put('/location', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    const agentId = req.agent.id; // Use the correct agent ID from middleware

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const locationData = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      accuracy: accuracy || null,
      timestamp: new Date().toISOString()
    };

    // Update agent location in the agents table
    await pool.query(`
      UPDATE agents 
      SET current_location = ?, last_location_update = NOW()
      WHERE id = ?
    `, [JSON.stringify(locationData), agentId]);

    // Get active orders for this agent to update their GPS history and notify buyers
    const [activeOrders] = await pool.query(
      'SELECT id, user_id as buyer_id, delivery_location FROM orders WHERE agent_id = ? AND tracking_status IN ("assigned", "picked_up", "in_transit")',
      [agentId]
    );

    for (const order of activeOrders) {
      await pool.query(
        'INSERT INTO order_gps_history (order_id, agent_id, lat, lng, timestamp) VALUES (?, ?, ?, ?, NOW())',
        [order.id, agentId, lat, lng]
      );
    }

    // Emit location update and ETA to the specific order rooms for buyers
    const io = req.app.get('io');
    if (io) {
      for (const order of activeOrders) {
        let etaMinutes = null;
        if (order.delivery_location) {
            try {
                const buyerLocation = JSON.parse(order.delivery_location);
                if (buyerLocation.lat && buyerLocation.lng) {
                    const distanceKm = calculateDistance(lat, lng, buyerLocation.lat, buyerLocation.lng);
                    const averageSpeedKmph = 30; // Assume 30 km/h average speed
                    etaMinutes = Math.round((distanceKm / averageSpeedKmph) * 60);
                }
            } catch(e) { console.error("Could not parse buyer location for ETA"); }
        }

        io.to(`order_${order.id}`).emit('agent_location_update', {
          agentId: agentId,
          location: locationData,
          eta: etaMinutes // Add ETA to the payload
        });
      }
    }

    res.json({
      success: true, 
      message: 'Location updated successfully',
      location: locationData
    });

  } catch (error) {
    console.error('Update agent location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});


// GET /api/agents/delivery-zone - Get agent's assigned delivery zone
router.get('/delivery-zone', authenticateToken, requireAgent, async (req, res) => {
  try {
    // First get agent's own ID from the agents table
    const [agentRecord] = await pool.query('SELECT delivery_zone_id FROM agents WHERE user_id = ?', [req.user.id]);
    if (agentRecord.length === 0 || !agentRecord[0].delivery_zone_id) {
      return res.status(404).json({ error: 'Agent profile or delivery zone not found' });
    }
    const zoneId = agentRecord[0].delivery_zone_id;

    // Then get the zone details
    const [zoneData] = await pool.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
    if (zoneData.length === 0) {
      return res.status(404).json({ error: 'Delivery zone details not found' });
    }

    const zone = zoneData[0];
    
    // Parse geojson if it's a string
    if (zone.geojson && typeof zone.geojson === 'string') {
        zone.geojson = JSON.parse(zone.geojson);
    }
    res.json(zone);
  } catch (error) {
    console.error('Get delivery zone error:', error);
    res.status(500).json({ error: 'Failed to get delivery zone' });
  }
});

// POST /api/agents/reviews - Submit a review for an agent
router.post('/reviews', authenticateToken, async (req, res) => {
  try {
    const { order_id, agent_id, rating, comment } = req.body;
    const buyer_id = req.user.id;

    if (!order_id || !agent_id || !rating) {
      return res.status(400).json({ error: 'Order ID, Agent ID, and rating are required.' });
    }

    // 1. Verify the buyer owns the order and it's delivered
    const [orderCheck] = await pool.query(
      'SELECT id FROM orders WHERE id = ? AND user_id = ? AND status = ?',
      [order_id, buyer_id, 'delivered']
    );

    if (orderCheck.length === 0) {
      return res.status(403).json({ error: 'You can only review delivered orders that you own.' });
    }

    // 2. Insert or update the review
    await pool.query(
      `INSERT INTO agent_reviews (order_id, agent_id, buyer_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [order_id, agent_id, buyer_id, rating, comment || null]
    );

    // 3. Recalculate and update the agent's average rating
    const [avgResult] = await pool.query(
      'SELECT AVG(rating) as average_rating FROM agent_reviews WHERE agent_id = ?',
      [agent_id]
    );

    if (avgResult.length > 0 && avgResult[0].average_rating) {
      await pool.query(
        'UPDATE agents SET average_rating = ? WHERE user_id = ?',
        [avgResult[0].average_rating, agent_id]
      );
    }

    res.status(201).json({ success: true, message: 'Thank you for your review!' });
  } catch (error) {
    console.error('Error submitting agent review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// POST /api/agents/orders/:orderId/report-issue - Report an issue with a delivery
router.post('/orders/:orderId/report-issue', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const agentId = req.agent.id;
    const { orderId } = req.params;
    const { issue_type, notes } = req.body;

    if (!issue_type) {
      return res.status(400).json({ error: 'Issue type is required.' });
    }

    // Check if order exists and is assigned to this agent
    const [orders] = await pool.query(`
      SELECT o.*, u.id as buyer_id FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.agent_id = ?
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }
    const order = orders[0];

    await connection.beginTransaction();

    // 1. Insert into order_issues table
    await connection.query(
      `INSERT INTO order_issues (order_id, agent_id, issue_type, notes) VALUES (?, ?, ?, ?)`,
      [orderId, agentId, issue_type, notes || null]
    );

    // 2. Update order tracking status
    await connection.query(
      `UPDATE orders SET tracking_status = 'delivery_issue' WHERE id = ?`,
      [orderId]
    );

    // 3. Add to order_tracking history
    await connection.query(
      `INSERT INTO order_tracking (order_id, status, notes) VALUES (?, 'delivery_issue', ?)`,
      [orderId, `Issue reported: ${issue_type}. Notes: ${notes || 'N/A'}`]
    );

    await connection.commit();

    res.json({ success: true, message: 'Issue reported successfully.' });

  } catch (error) {
    await connection.rollback();
    console.error('Error reporting delivery issue:', error);
    res.status(500).json({ error: 'Failed to report issue' });
  } finally {
    connection.release();
  }
});

// PUT /api/agents/profile - Update agent profile
router.put('/profile', authenticateToken, requireAgent, async (req, res) => {
  try {
    const {
      phone,
      address,
      city,
      country,
      vehicle_type,
      vehicle_registration,
      license_number,
      working_hours,
      emergency_contact_name,
      emergency_contact_phone,
      bank_account_number,
      bank_name,
      bank_routing_number
    } = req.body;

    // Update user table
    if (phone) {
      await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id]);
    }

    // Update or insert agent record
    const agentUpdateFields = [];
    const agentUpdateValues = [];

    if (address) {
      agentUpdateFields.push('address = ?');
      agentUpdateValues.push(address);
    }
    if (city) {
      agentUpdateFields.push('city = ?');
      agentUpdateValues.push(city);
    }
    if (country) {
      agentUpdateFields.push('country = ?');
      agentUpdateValues.push(country);
    }
    if (vehicle_type) {
      agentUpdateFields.push('vehicle_type = ?');
      agentUpdateValues.push(vehicle_type);
    }
    if (vehicle_registration) {
      agentUpdateFields.push('vehicle_registration = ?');
      agentUpdateValues.push(vehicle_registration);
    }
    if (license_number) {
      agentUpdateFields.push('license_number = ?');
      agentUpdateValues.push(license_number);
    }
    if (working_hours) {
      agentUpdateFields.push('working_hours = ?');
      agentUpdateValues.push(typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours));
    }
    if (emergency_contact_name) {
      agentUpdateFields.push('emergency_contact_name = ?');
      agentUpdateValues.push(emergency_contact_name);
    }
    if (emergency_contact_phone) {
      agentUpdateFields.push('emergency_contact_phone = ?');
      agentUpdateValues.push(emergency_contact_phone);
    }
    if (bank_account_number) {
      agentUpdateFields.push('bank_account_number = ?');
      agentUpdateValues.push(bank_account_number);
    }
    if (bank_name) {
      agentUpdateFields.push('bank_name = ?');
      agentUpdateValues.push(bank_name);
    }
    if (bank_routing_number) {
      agentUpdateFields.push('bank_routing_number = ?');
      agentUpdateValues.push(bank_routing_number);
    }

    if (agentUpdateFields.length > 0) {
      agentUpdateFields.push('updated_at = NOW()');
      agentUpdateValues.push(req.user.id);

      const updateQuery = `
        INSERT INTO agents (user_id, ${agentUpdateFields.join(', ').replace(/ = \?/g, '')}) 
        VALUES (?, ${agentUpdateFields.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE ${agentUpdateFields.join(', ')}
      `;

      await pool.query(updateQuery, [req.user.id, ...agentUpdateValues.slice(0, -1), ...agentUpdateValues]);
    }

    res.json({ 
      message: 'Profile updated successfully',
      updated_fields: agentUpdateFields.length
    });

  } catch (error) {
    console.error('Update agent profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/agents/preferences - Update agent preferences
router.put('/preferences', authenticateToken, requireAgent, async (req, res) => {
  try {
    const {
      notification_preferences,
      work_radius,
      preferred_order_types,
      auto_accept_orders,
      max_concurrent_orders
    } = req.body;

    const preferences = {
      notification_preferences: notification_preferences || {
        email: true,
        sms: true,
        push: true,
        order_assignments: true,
        payment_updates: true
      },
      work_radius: work_radius || 10,
      preferred_order_types: preferred_order_types || [],
      auto_accept_orders: auto_accept_orders || false,
      max_concurrent_orders: max_concurrent_orders || 3
    };

    await pool.query(`
      INSERT INTO agents (user_id, preferences, updated_at) 
      VALUES (?, ?, NOW()) 
      ON DUPLICATE KEY UPDATE 
      preferences = VALUES(preferences), 
      updated_at = VALUES(updated_at)
    `, [req.user.id, JSON.stringify(preferences)]);

    res.json({ 
      message: 'Preferences updated successfully',
      preferences: preferences
    });

  } catch (error) {
    console.error('Update agent preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// GET /api/agents/earnings - Get agent earnings summary
router.get('/earnings', authenticateToken, requireAgent, getAgentId, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const agentId = req.agent.id;

    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'DATE(created_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'YEARWEEK(created_at) = YEARWEEK(NOW())';
        break;
      case 'month':
        dateCondition = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
        break;
      case 'year':
        dateCondition = 'YEAR(created_at) = YEAR(NOW())';
        break;
      default:
        dateCondition = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
    }

    // Get earnings from completed orders
    const [earnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(COALESCE(delivery_fee * 0.3, 5.00)) as total_earnings,
        AVG(COALESCE(delivery_fee * 0.3, 5.00)) as avg_earning_per_order,
        MIN(created_at) as first_order_date,
        MAX(created_at) as last_order_date
      FROM orders 
      WHERE agent_id = ? AND status = 'delivered' AND ${dateCondition}
    `, [agentId]);

    // Get daily breakdown for the period
    const [dailyBreakdown] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders_count,
        SUM(COALESCE(delivery_fee * 0.3, 5.00)) as daily_earnings
      FROM orders 
      WHERE agent_id = ? AND status = 'delivered' AND ${dateCondition}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [agentId]);

    res.json({
      period: period,
      summary: earnings[0] || {
        total_orders: 0,
        total_earnings: 0,
        avg_earning_per_order: 0,
        first_order_date: null,
        last_order_date: null
      },
      daily_breakdown: dailyBreakdown
    });

  } catch (error) {
    console.error('Get agent earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings data' });
  }
});

module.exports = router;