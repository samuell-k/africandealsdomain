const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const zonesRouter = require('./location-zones');

// Middleware to check if user is an agent
const requireAgent = (req, res, next) => {
  if (req.user && req.user.role === 'agent') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Agent role required.' });
  }
};

// Middleware to check if user is an admin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
};

// Save user location (Home, Work, Custom)
router.post('/users/:userId/location', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, lat, lng, label, address } = req.body;
    const requesterId = req.user.id;
    
    // Verify user can update this location
    if (requesterId != userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!lat || !lng || !type) {
      return res.status(400).json({ error: 'Type, latitude and longitude are required' });
    }

    // Handle different location types
    if (type === 'home') {
      await pool.query(
        'UPDATE users SET home_lat = ?, home_lng = ?, home_address = ? WHERE id = ?',
        [lat, lng, address || null, userId]
      );
    } else if (type === 'work') {
      await pool.query(
        'UPDATE users SET work_lat = ?, work_lng = ?, work_address = ? WHERE id = ?',
        [lat, lng, address || null, userId]
      );
    } else if (type === 'custom') {
      if (!label) {
        return res.status(400).json({ error: 'Label is required for custom locations' });
      }
      
      // Get existing custom locations
      const [user] = await pool.query('SELECT custom_locations FROM users WHERE id = ?', [userId]);
      let customLocations = [];
      
      if (user[0]?.custom_locations) {
        try {
          customLocations = JSON.parse(user[0].custom_locations);
        } catch (e) {
          customLocations = [];
        }
      }
      
      // Add new custom location
      customLocations.push({ label, lat, lng, address: address || null, created_at: new Date() });
      
      await pool.query(
        'UPDATE users SET custom_locations = ? WHERE id = ?',
        [JSON.stringify(customLocations), userId]
      );
    }

    // Also update current location
    await pool.query(
      `INSERT INTO user_locations (user_id, role, lat, lng, address, updated_at) 
       VALUES (?, (SELECT role FROM users WHERE id = ?), ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE lat = ?, lng = ?, address = ?, updated_at = NOW()`,
      [userId, userId, lat, lng, address, lat, lng, address]
    );

    res.status(200).json({ success: true, message: 'Location saved successfully' });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// Get user's saved locations
router.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user.id;
    
    // Verify access
    if (requesterId != userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [user] = await pool.query(
      `SELECT home_lat, home_lng, home_address, work_lat, work_lng, work_address, 
              custom_locations, role FROM users WHERE id = ?`,
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user[0];
    let customLocations = [];
    
    if (userData.custom_locations) {
      try {
        customLocations = JSON.parse(userData.custom_locations);
      } catch (e) {
        customLocations = [];
      }
    }

    // Get current location
    const [currentLocation] = await pool.query(
      'SELECT lat, lng, address, updated_at FROM user_locations WHERE user_id = ?',
      [userId]
    );

    res.status(200).json({
      home: userData.home_lat && userData.home_lng ? {
        lat: userData.home_lat,
        lng: userData.home_lng,
        address: userData.home_address
      } : null,
      work: userData.work_lat && userData.work_lng ? {
        lat: userData.work_lat,
        lng: userData.work_lng,
        address: userData.work_address
      } : null,
      custom: customLocations,
      current: currentLocation[0] || null,
      role: userData.role
    });
  } catch (error) {
    console.error('Error fetching user locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Delete custom location
router.delete('/users/:userId/location/:label', authenticateToken, async (req, res) => {
  try {
    const { userId, label } = req.params;
    const requesterId = req.user.id;
    
    if (requesterId != userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [user] = await pool.query('SELECT custom_locations FROM users WHERE id = ?', [userId]);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customLocations = [];
    if (user[0]?.custom_locations) {
      try {
        customLocations = JSON.parse(user[0].custom_locations);
      } catch (e) {
        customLocations = [];
      }
    }

    // Remove the location with matching label
    customLocations = customLocations.filter(loc => loc.label !== label);

    await pool.query(
      'UPDATE users SET custom_locations = ? WHERE id = ?',
      [JSON.stringify(customLocations), userId]
    );

    res.status(200).json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Get agent location
router.get('/agent/:agentId', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const [location] = await pool.query(
      'SELECT lat, lng, updated_at FROM user_locations WHERE user_id = ? AND role = "agent"',
      [agentId]
    );

    if (location.length === 0) {
      return res.status(404).json({ error: 'Agent location not found' });
    }

    res.status(200).json(location[0]);
  } catch (error) {
    console.error('Error fetching agent location:', error);
    res.status(500).json({ error: 'Failed to fetch agent location' });
  }
});

// Use the zones router for zone-related endpoints
router.use('/zones', zonesRouter);

// Get all active agents locations (for admin)
router.get('/agents/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [agents] = await pool.query(
      `SELECT ul.user_id, u.username, ul.lat, lng, ul.updated_at, 
              (SELECT COUNT(*) FROM orders o WHERE o.agent_id = ul.user_id AND o.status IN ('processing', 'shipped')) as active_orders 
       FROM user_locations ul 
       JOIN users u ON ul.user_id = u.id 
       WHERE ul.role = 'agent' AND ul.updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    res.status(200).json(agents);
  } catch (error) {
    console.error('Error fetching active agents:', error);
    res.status(500).json({ error: 'Failed to fetch active agents' });
  }
});

// Get order locations for tracking (buyer, seller, agent)
router.get('/orders/:orderId/locations', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Verify user has access to this order
    let orderAccessQuery;
    if (role === 'buyer') {
      orderAccessQuery = 'SELECT * FROM orders WHERE id = ? AND user_id = ?';
    } else if (role === 'seller') {
      orderAccessQuery = 'SELECT * FROM orders WHERE id = ? AND seller_id = ?';
    } else if (role === 'agent') {
      orderAccessQuery = 'SELECT * FROM orders WHERE id = ? AND agent_id = ?';
    } else if (role === 'admin') {
      orderAccessQuery = 'SELECT * FROM orders WHERE id = ?';
    }
    
    const [orderAccess] = await pool.query(
      orderAccessQuery,
      role === 'admin' ? [orderId] : [orderId, userId]
    );

    if (orderAccess.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    const order = orderAccess[0];

    // Get buyer location
    let buyerLocation = null;
    if (order.user_id) {
      const [buyerLoc] = await pool.query(
        `SELECT ul.lat, ul.lng, ul.address, ul.updated_at,
                u.home_lat, u.home_lng, u.home_address,
                u.work_lat, u.work_lng, u.work_address
         FROM user_locations ul 
         RIGHT JOIN users u ON ul.user_id = u.id
         WHERE u.id = ?`,
        [order.user_id]
      );
      
      if (buyerLoc[0]) {
        buyerLocation = {
          current: buyerLoc[0].lat && buyerLoc[0].lng ? {
            lat: buyerLoc[0].lat,
            lng: buyerLoc[0].lng,
            address: buyerLoc[0].address,
            updated_at: buyerLoc[0].updated_at
          } : null,
          home: buyerLoc[0].home_lat && buyerLoc[0].home_lng ? {
            lat: buyerLoc[0].home_lat,
            lng: buyerLoc[0].home_lng,
            address: buyerLoc[0].home_address
          } : null,
          work: buyerLoc[0].work_lat && buyerLoc[0].work_lng ? {
            lat: buyerLoc[0].work_lat,
            lng: buyerLoc[0].work_lng,
            address: buyerLoc[0].work_address
          } : null
        };
      }
    }

    // Get agent location
    let agentLocation = null;
    if (order.agent_id) {
      const [agentLoc] = await pool.query(
        'SELECT lat, lng, address, updated_at FROM user_locations WHERE user_id = ?',
        [order.agent_id]
      );
      agentLocation = agentLoc[0] || null;
    }

    // Get seller/product location
    let sellerLocation = null;
    if (order.seller_id) {
      // First try to get seller's business location
      const [sellerLoc] = await pool.query(
        `SELECT ul.lat, ul.lng, ul.address, ul.updated_at,
                u.business_lat, u.business_lng, u.business_address
         FROM user_locations ul 
         RIGHT JOIN users u ON ul.user_id = u.id
         WHERE u.id = ?`,
        [order.seller_id]
      );
      
      if (sellerLoc[0]) {
        sellerLocation = {
          current: sellerLoc[0].lat && sellerLoc[0].lng ? {
            lat: sellerLoc[0].lat,
            lng: sellerLoc[0].lng,
            address: sellerLoc[0].address,
            updated_at: sellerLoc[0].updated_at
          } : null,
          business: sellerLoc[0].business_lat && sellerLoc[0].business_lng ? {
            lat: sellerLoc[0].business_lat,
            lng: sellerLoc[0].business_lng,
            address: sellerLoc[0].business_address
          } : null
        };
      }

      // Also get product-specific locations if available
      const [productLocs] = await pool.query(
        `SELECT p.id, p.name, p.lat, p.lng, p.address
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND p.lat IS NOT NULL AND p.lng IS NOT NULL`,
        [orderId]
      );
      
      if (productLocs.length > 0) {
        sellerLocation.products = productLocs;
      }
    }

    // Get GPS tracking history
    const [gpsHistory] = await pool.query(
      'SELECT lat, lng, timestamp FROM order_gps_history WHERE order_id = ? ORDER BY timestamp ASC',
      [orderId]
    );

    res.status(200).json({
      order: {
        id: order.id,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at
      },
      buyer: buyerLocation,
      agent: agentLocation,
      seller: sellerLocation,
      gps_history: gpsHistory
    });
  } catch (error) {
    console.error('Error fetching order locations:', error);
    res.status(500).json({ error: 'Failed to fetch order locations' });
  }
});

// Get order tracking information (enhanced)
router.get('/order/:orderId/tracking', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Get agent's specific ID if the user is an agent
    let agentId = null;
    if (role === 'agent') {
      const [agent] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [userId]);
      if (agent.length > 0) {
        agentId = agent[0].id;
      }
    }

    // Verify user has access to this order
    let orderAccessQuery;
    let queryParams = [orderId, userId];

    if (role === 'buyer') {
      orderAccessQuery = 'SELECT id FROM orders WHERE id = ? AND user_id = ?';
    } else if (role === 'seller') {
      orderAccessQuery = 'SELECT id FROM orders WHERE id = ? AND seller_id = ?';
    } else if (role === 'agent') {
      orderAccessQuery = 'SELECT id FROM orders WHERE id = ? AND agent_id = ?';
      queryParams = [orderId, agentId]; // Use agent.id for the check
    } else if (role === 'admin') {
      orderAccessQuery = 'SELECT id FROM orders WHERE id = ?';
      queryParams = [orderId];
    }
    
    const [orderAccess] = await pool.query(orderAccessQuery, queryParams);

    if (orderAccess.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    // Get order details with enhanced location data
    const [orderDetails] = await pool.query(
      `SELECT o.*, 
              u_buyer.name as buyer_name, u_buyer.phone as buyer_phone,
              u_seller.name as seller_name, u_seller.phone as seller_phone,
              a_user.name as agent_name, a_user.phone as agent_phone,
              a.current_location as agent_location,
              o.delivery_location as buyer_location,
              o.pickup_location as seller_location
       FROM orders o
       LEFT JOIN users u_buyer ON o.user_id = u_buyer.id
       LEFT JOIN users u_seller ON o.seller_id = u_seller.id
       LEFT JOIN agents a ON o.agent_id = a.id
       LEFT JOIN users a_user ON a.user_id = a_user.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orderDetails.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDetails[0];

    // Parse JSON fields that might be strings from the database
    try {
      if (orderData.agent_location && typeof orderData.agent_location === 'string') {
        orderData.agent_location = JSON.parse(orderData.agent_location);
      }
      if (orderData.buyer_location && typeof orderData.buyer_location === 'string') {
        orderData.buyer_location = JSON.parse(orderData.buyer_location);
      }
      if (orderData.seller_location && typeof orderData.seller_location === 'string') {
        orderData.seller_location = JSON.parse(orderData.seller_location);
      }
    } catch (e) {
      console.error(`Error parsing location JSON for order ${orderId}:`, e);
      // Continue even if parsing fails, frontend can handle nulls
    }

    // Get GPS history for the agent's map path
    const [gpsHistory] = await pool.query(
      'SELECT lat, lng, timestamp FROM order_gps_history WHERE order_id = ? ORDER BY timestamp ASC',
      [orderId]
    );

    // Get tracking history for the timeline display
    const [trackingHistory] = await pool.query(
      'SELECT status, notes, created_at as timestamp FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC',
      [orderId]
    );

    // Get order items with product details and locations
    const [orderItems] = await pool.query(
      `SELECT oi.*, p.name as product_name, p.main_image, p.lat as product_lat, p.lng as product_lng, p.address as product_address
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const result = {
      ...orderData,
      gps_history: gpsHistory,
      tracking_history: trackingHistory,
      items: orderItems
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    res.status(500).json({ error: 'Failed to fetch order tracking' });
  }
});

// Set seller business location
router.post('/seller/business-location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, address, business_name } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Seller role required.' });
    }

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update seller's business location
    await pool.query(
      'UPDATE users SET business_lat = ?, business_lng = ?, business_address = ?, business_name = ? WHERE id = ?',
      [lat, lng, address, business_name, userId]
    );

    // Also update current location
    await pool.query(
      `INSERT INTO user_locations (user_id, role, lat, lng, address, updated_at) 
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE lat = ?, lng = ?, address = ?, updated_at = NOW()`,
      [userId, role, lat, lng, address, lat, lng, address]
    );

    res.status(200).json({ success: true, message: 'Business location updated successfully' });
  } catch (error) {
    console.error('Error updating business location:', error);
    res.status(500).json({ error: 'Failed to update business location' });
  }
});

// Set product-specific location
router.post('/products/:productId/location', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { lat, lng, address } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Verify user owns this product or is admin
    const [product] = await pool.query(
      'SELECT seller_id FROM products WHERE id = ?',
      [productId]
    );

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product[0].seller_id !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update product location
    await pool.query(
      'UPDATE products SET lat = ?, lng = ?, address = ? WHERE id = ?',
      [lat, lng, address, productId]
    );

    res.status(200).json({ success: true, message: 'Product location updated successfully' });
  } catch (error) {
    console.error('Error updating product location:', error);
    res.status(500).json({ error: 'Failed to update product location' });
  }
});

// Calculate delivery price based on distance
router.post('/calculate-delivery-price', authenticateToken, async (req, res) => {
  try {
    const { buyer_lat, buyer_lng, seller_lat, seller_lng, product_ids } = req.body;
    
    if (!buyer_lat || !buyer_lng || !seller_lat || !seller_lng) {
      return res.status(400).json({ error: 'Buyer and seller coordinates are required' });
    }

    // Calculate distance using Haversine formula
    const R = 6371; // Earth's radius in kilometers
    const dLat = (seller_lat - buyer_lat) * Math.PI / 180;
    const dLng = (seller_lng - buyer_lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(buyer_lat * Math.PI / 180) * Math.cos(seller_lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers

    // Calculate delivery price based on distance
    let basePrice = 5.00; // Base delivery price
    let pricePerKm = 1.50; // Price per kilometer
    
    // Get delivery zones to check for special pricing
    const [zones] = await pool.query(
      'SELECT name, base_price, price_per_km FROM delivery_zones WHERE ST_Contains(ST_GeomFromGeoJSON(geojson), ST_Point(?, ?))',
      [buyer_lng, buyer_lat]
    );

    if (zones.length > 0) {
      basePrice = zones[0].base_price || basePrice;
      pricePerKm = zones[0].price_per_km || pricePerKm;
    }

    const deliveryPrice = basePrice + (distance * pricePerKm);

    // Get available agents in the area
    const [availableAgents] = await pool.query(
      `SELECT u.id, u.name, ul.lat, ul.lng,
              (6371 * acos(cos(radians(?)) * cos(radians(ul.lat)) * cos(radians(ul.lng) - radians(?)) + sin(radians(?)) * sin(radians(ul.lat)))) AS distance
       FROM users u
       JOIN user_locations ul ON u.id = ul.user_id
       WHERE u.role = 'agent' AND ul.updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
       HAVING distance < 20
       ORDER BY distance ASC
       LIMIT 5`,
      [buyer_lat, buyer_lng, buyer_lat]
    );

    res.status(200).json({
      distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
      delivery_price: Math.round(deliveryPrice * 100) / 100,
      base_price: basePrice,
      price_per_km: pricePerKm,
      available_agents: availableAgents.length,
      estimated_time: Math.ceil(distance / 30 * 60), // Estimated time in minutes (30 km/h average)
      agents: availableAgents
    });
  } catch (error) {
    console.error('Error calculating delivery price:', error);
    res.status(500).json({ error: 'Failed to calculate delivery price' });
  }
});

// Confirm delivery with geolocation
router.post('/order/:orderId/confirm-delivery', authenticateToken, requireAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { lat, lng, delivery_code } = req.body;
    const agentUserId = req.user.id;
    
    if (!lat || !lng || !delivery_code) {
      return res.status(400).json({ error: 'Location and delivery code are required.' });
    }

    // Get the agent's specific ID from the agents table
    const [agent] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [agentUserId]);
    if (agent.length === 0) {
        return res.status(404).json({ error: 'Agent profile not found.' });
    }
    const agentId = agent[0].id;

    // Verify agent is assigned to this order
    const [orderAccess] = await pool.query(
      'SELECT id, delivery_code FROM orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orderAccess.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this order' });
    }

    if (orderAccess[0].delivery_code !== delivery_code) {
      return res.status(400).json({ error: 'Invalid delivery code.' });
    }

    // Update order status and add delivery confirmation details
    await pool.query(
      `UPDATE orders 
       SET status = 'delivered', 
           tracking_status = 'delivered',
           delivered_at = NOW(), 
           delivery_confirmed_at = NOW(),
           delivery_confirmed_lat = ?,
           delivery_confirmed_lng = ?
       WHERE id = ?`,
      [lat, lng, orderId]
    );

    // Add final GPS history entry
    await pool.query(
      'INSERT INTO order_gps_history (order_id, agent_id, lat, lng) VALUES (?, ?, ?, ?)',
      [orderId, agentId, lat, lng]
    );

    res.status(200).json({ success: true, message: 'Delivery confirmed successfully' });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// Save delivery zone (GeoJSON)
router.post('/zones', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, geojson } = req.body;
    const adminId = req.user.id;
    
    if (!name || !geojson) {
      return res.status(400).json({ error: 'Name and GeoJSON data are required' });
    }

    // Insert new delivery zone
    const [result] = await pool.query(
      'INSERT INTO delivery_zones (name, geojson, created_by) VALUES (?, ?, ?)',
      [name, JSON.stringify(geojson), adminId]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Delivery zone created successfully',
      zoneId: result.insertId
    });
  } catch (error) {
    console.error('Error creating delivery zone:', error);
    res.status(500).json({ error: 'Failed to create delivery zone' });
  }
});

// Get all delivery zones
router.get('/zones', authenticateToken, async (req, res) => {
  try {
    const [zones] = await pool.query(
      'SELECT id, name, geojson, created_at FROM delivery_zones'
    );

    // Parse GeoJSON strings to objects
    const parsedZones = zones.map(zone => ({
      ...zone,
      geojson: JSON.parse(zone.geojson)
    }));

    res.status(200).json(parsedZones);
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    res.status(500).json({ error: 'Failed to fetch delivery zones' });
  }
});

// Get heatmap data for admin
router.get('/heatmap', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { timeframe } = req.query; // 'day', 'week', 'month'
    
    let timeCondition;
    switch(timeframe) {
      case 'day':
        timeCondition = 'AND timestamp > DATE_SUB(NOW(), INTERVAL 1 DAY)';
        break;
      case 'week':
        timeCondition = 'AND timestamp > DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        timeCondition = 'AND timestamp > DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      default:
        timeCondition = 'AND timestamp > DATE_SUB(NOW(), INTERVAL 1 WEEK)';
    }

    // Get delivery points for heatmap
    const [heatmapData] = await pool.query(
      `SELECT lat, lng, COUNT(*) as weight 
       FROM order_gps_history 
       WHERE lat IS NOT NULL AND lng IS NOT NULL ${timeCondition}
       GROUP BY ROUND(lat, 3), ROUND(lng, 3)`
    );

    res.status(200).json(heatmapData);
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// Get distance analysis for admin
router.get('/distance-analysis', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { timeframe } = req.query; // 'day', 'week', 'month'
    
    let timeCondition;
    switch(timeframe) {
      case 'day':
        timeCondition = 'AND o.created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)';
        break;
      case 'week':
        timeCondition = 'AND o.created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        timeCondition = 'AND o.created_at > DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      default:
        timeCondition = 'AND o.created_at > DATE_SUB(NOW(), INTERVAL 1 WEEK)';
    }

    // Get distance analysis data
    const [distanceData] = await pool.query(
      `SELECT 
         u.username as agent_name,
         COUNT(DISTINCT o.id) as total_orders,
         SUM(o.shipping_cost) as total_shipping_cost,
         AVG(o.shipping_cost) as avg_shipping_cost,
         COUNT(DISTINCT ogh.id) as total_gps_points
       FROM orders o
       JOIN users u ON o.agent_id = u.id
       LEFT JOIN order_gps_history ogh ON o.id = ogh.order_id
       WHERE o.status = 'delivered' ${timeCondition}
       GROUP BY o.agent_id
       ORDER BY total_orders DESC`
    );

    res.status(200).json(distanceData);
  } catch (error) {
    console.error('Error fetching distance analysis:', error);
    res.status(500).json({ error: 'Failed to fetch distance analysis' });
  }
});

module.exports = router;