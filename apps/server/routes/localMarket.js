const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { authenticateToken, isBuyer, isSeller, isAgent, isAdmin } = require('../middleware/auth');

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

// Place grocery order
router.post('/place-order', authenticateToken, async (req, res) => {
  try {
    const {
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      delivery_phone,
      preferred_delivery_time,
      special_instructions,
      payment_method = 'cash_on_delivery'
    } = req.body;
    
    const userId = req.user.id;
    
    if (!delivery_address || !delivery_latitude || !delivery_longitude) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address and location are required'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    try {
      // Get cart items
      const [cartItems] = await connection.execute(`
        SELECT 
          gci.*,
          gp.product_name,
          gp.unit_type,
          gp.seller_id,
          gp.available_stock,
          u.name as seller_name,
          u.latitude as seller_latitude,
          u.longitude as seller_longitude
        FROM grocery_cart_items gci
        LEFT JOIN grocery_products gp ON gci.grocery_product_id = gp.id
        LEFT JOIN users u ON gp.seller_id = u.id
        WHERE gci.buyer_id = ?
      `, [userId]);
      
      if (cartItems.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }
      
      // Calculate order totals
      const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
      
      // Get platform settings
      const [settings] = await connection.execute(`
        SELECT * FROM local_market_settings WHERE id = 1
      `);
      
      const platformSettings = settings[0] || {
        platform_commission_rate: 1.0,
        default_packaging_fee: 200,
        agent_base_earning: 1000,
        agent_per_km_bonus: 100
      };
      
      const platformCommission = subtotal * (platformSettings.platform_commission_rate / 100);
      const packagingFee = platformSettings.default_packaging_fee;
      
      // Calculate delivery distance and fee
      const avgSellerLat = cartItems.reduce((sum, item) => sum + parseFloat(item.seller_latitude), 0) / cartItems.length;
      const avgSellerLng = cartItems.reduce((sum, item) => sum + parseFloat(item.seller_longitude), 0) / cartItems.length;
      
      const distance = calculateDistance(avgSellerLat, avgSellerLng, delivery_latitude, delivery_longitude);
      const deliveryFee = platformSettings.agent_base_earning + (distance * platformSettings.agent_per_km_bonus);
      
      const total = subtotal + platformCommission + packagingFee + deliveryFee;
      
      // Generate order number
      const orderNumber = 'LM' + Date.now() + Math.floor(Math.random() * 1000);
      
      // Create order
      const [orderResult] = await connection.execute(`
        INSERT INTO grocery_orders (
          order_number,
          buyer_id,
          subtotal,
          platform_commission,
          packaging_fee,
          delivery_fee,
          total_amount,
          delivery_address,
          delivery_latitude,
          delivery_longitude,
          delivery_phone,
          preferred_delivery_time,
          special_instructions,
          payment_method,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
      `, [
        orderNumber,
        userId,
        subtotal,
        platformCommission,
        packagingFee,
        deliveryFee,
        total,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_phone,
        preferred_delivery_time,
        special_instructions,
        payment_method
      ]);
      
      const orderId = orderResult.insertId;
      
      // Create order items
      for (const item of cartItems) {
        await connection.execute(`
          INSERT INTO grocery_order_items (
            grocery_order_id,
            grocery_product_id,
            seller_id,
            quantity,
            unit_price,
            total_price,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
          orderId,
          item.grocery_product_id,
          item.seller_id,
          item.quantity,
          item.unit_price,
          item.total_price
        ]);
        
        // Update product stock
        await connection.execute(`
          UPDATE grocery_products
          SET available_stock = available_stock - ?
          WHERE id = ?
        `, [item.quantity, item.grocery_product_id]);
      }
      
      // Clear cart
      await connection.execute(`
        DELETE FROM grocery_cart_items WHERE buyer_id = ?
      `, [userId]);
      
      // Manual assignment required: do NOT auto-assign nearest agent
      // Agents will claim orders via their dashboard (fast-delivery-agent or localMarketAgent routes)
      await connection.commit();
      await connection.end();
      
      res.json({
        success: true,
        message: 'Order placed successfully',
        order: {
          id: orderId,
          order_number: orderNumber,
          total_amount: total,
          status: 'pending',
          agent_assigned: false
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order'
    });
  }
});

// Get user's grocery orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let whereCondition = 'go.buyer_id = ?';
    let queryParams = [userId];
    
    if (status) {
      whereCondition += ' AND go.status = ?';
      queryParams.push(status);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);
    
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as agent_name,
        u.phone as agent_phone,
        COUNT(goi.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.agent_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE ${whereCondition}
      GROUP BY go.id
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    // Get order items for each order
    for (let order of orders) {
      const [items] = await connection.execute(`
        SELECT 
          goi.*,
          gp.product_name,
          gp.unit_type,
          gp.main_image,
          u.name as seller_name
        FROM grocery_order_items goi
        LEFT JOIN grocery_products gp ON goi.grocery_product_id = gp.id
        LEFT JOIN users u ON goi.seller_id = u.id
        WHERE goi.grocery_order_id = ?
      `, [order.id]);
      
      order.items = items;
    }
    
    await connection.end();
    
    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Get single order details
router.get('/order/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as agent_name,
        u.phone as agent_phone,
        u.email as agent_email,
        u.latitude as agent_latitude,
        u.longitude as agent_longitude
      FROM grocery_orders go
      LEFT JOIN users u ON go.agent_id = u.id
      WHERE go.id = ? AND go.buyer_id = ?
    `, [id, userId]);
    
    if (orders.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orders[0];
    
    // Get order items
    const [items] = await connection.execute(`
      SELECT 
        goi.*,
        gp.product_name,
        gp.unit_type,
        gp.main_image,
        u.name as seller_name,
        u.city as seller_city
      FROM grocery_order_items goi
      LEFT JOIN grocery_products gp ON goi.grocery_product_id = gp.id
      LEFT JOIN users u ON goi.seller_id = u.id
      WHERE goi.grocery_order_id = ?
    `, [id]);
    
    order.items = items;
    
    // Get order tracking history
    const [tracking] = await connection.execute(`
      SELECT * FROM grocery_order_tracking
      WHERE grocery_order_id = ?
      ORDER BY created_at ASC
    `, [id]);
    
    order.tracking = tracking;
    
    await connection.end();
    
    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
});

// Cancel order
router.post('/order/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    try {
      // Check if order can be cancelled
      const [orders] = await connection.execute(`
        SELECT * FROM grocery_orders
        WHERE id = ? AND buyer_id = ? AND status IN ('pending', 'assigned')
      `, [id, userId]);
      
      if (orders.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled'
        });
      }
      
      const order = orders[0];
      
      // Restore product stock
      const [orderItems] = await connection.execute(`
        SELECT grocery_product_id, quantity
        FROM grocery_order_items
        WHERE grocery_order_id = ?
      `, [id]);
      
      for (const item of orderItems) {
        await connection.execute(`
          UPDATE grocery_products
          SET available_stock = available_stock + ?
          WHERE id = ?
        `, [item.quantity, item.grocery_product_id]);
      }
      
      // Update order status
      await connection.execute(`
        UPDATE grocery_orders
        SET status = 'cancelled', cancellation_reason = ?, cancelled_at = NOW()
        WHERE id = ?
      `, [reason, id]);
      
      // Free up agent if assigned
      if (order.agent_id) {
        await connection.execute(`
          UPDATE users
          SET agent_status = 'online'
          WHERE id = ?
        `, [order.agent_id]);
      }
      
      // Add tracking entry
      await connection.execute(`
        INSERT INTO grocery_order_tracking (grocery_order_id, status, message, created_at)
        VALUES (?, 'cancelled', ?, NOW())
      `, [id, `Order cancelled by buyer. Reason: ${reason}`]);
      
      await connection.commit();
      await connection.end();
      
      res.json({
        success: true,
        message: 'Order cancelled successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
});

// Get available orders for agents
router.get('/available-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verify user is an agent
    const connection = await mysql.createConnection(dbConfig);
    
    const [users] = await connection.execute(`
      SELECT role, latitude, longitude FROM users WHERE id = ?
    `, [userId]);
    
    if (users.length === 0 || users[0].role !== 'agent') {
      await connection.end();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Agent role required.'
      });
    }
    
    const agent = users[0];
    
    if (!agent.latitude || !agent.longitude) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: 'Agent location not set'
      });
    }
    
    // Get available orders within 30km radius
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        COUNT(goi.id) as item_count,
        (6371 * acos(cos(radians(?)) * cos(radians(go.delivery_latitude)) * cos(radians(go.delivery_longitude) - radians(?)) + sin(radians(?)) * sin(radians(go.delivery_latitude)))) AS distance_km
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE go.status = 'pending' AND go.agent_id IS NULL
      GROUP BY go.id
      HAVING distance_km <= 30
      ORDER BY distance_km ASC, go.created_at ASC
    `, [agent.latitude, agent.longitude, agent.latitude]);
    
    // Calculate estimated delivery time for each order
    for (let order of orders) {
      order.estimated_time = Math.ceil(order.distance_km * 3); // 3 minutes per km estimate
    }
    
    await connection.end();
    
    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching available orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available orders'
    });
  }
});

// Accept order (for agents)
router.post('/accept-order/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    try {
      // Verify user is an agent and available
      const [agents] = await connection.execute(`
        SELECT role, agent_status FROM users WHERE id = ?
      `, [userId]);
      
      if (agents.length === 0 || agents[0].role !== 'agent' || agents[0].agent_status !== 'online') {
        await connection.rollback();
        await connection.end();
        return res.status(403).json({
          success: false,
          message: 'Agent not available to accept orders'
        });
      }
      
      // Check if order is still available
      const [orders] = await connection.execute(`
        SELECT * FROM grocery_orders
        WHERE id = ? AND status = 'pending' AND agent_id IS NULL
      `, [id]);
      
      if (orders.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Order is no longer available'
        });
      }
      
      // Assign order to agent
      await connection.execute(`
        UPDATE grocery_orders
        SET agent_id = ?, agent_assigned_at = NOW(), status = 'assigned'
        WHERE id = ?
      `, [userId, id]);
      
      // Update agent status
      await connection.execute(`
        UPDATE users
        SET agent_status = 'busy'
        WHERE id = ?
      `, [userId]);
      
      // Add tracking entry
      await connection.execute(`
        INSERT INTO grocery_order_tracking (grocery_order_id, status, message, created_at)
        VALUES (?, 'assigned', 'Order assigned to agent', NOW())
      `, [id]);
      
      await connection.commit();
      await connection.end();
      
      res.json({
        success: true,
        message: 'Order accepted successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept order'
    });
  }
});

// Get local market products
router.get('/products', async (req, res) => {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      category_id, 
      search, 
      lat, 
      lng, 
      max_distance = 50 
    } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let whereConditions = ['p.is_active = 1'];
    let queryParams = [];
    
    // Filter by category if provided
    if (category_id) {
      whereConditions.push('p.category_id = ?');
      queryParams.push(category_id);
    }
    
    // Search filter
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Build distance calculation if location provided
    let distanceSelect = '';
    let distanceOrderBy = '';
    if (lat && lng) {
      distanceSelect = `, (6371 * acos(cos(radians(?)) * cos(radians(COALESCE(u.latitude, 0))) * cos(radians(COALESCE(u.longitude, 0)) - radians(?)) + sin(radians(?)) * sin(radians(COALESCE(u.latitude, 0))))) AS distance_km`;
      distanceOrderBy = ', distance_km ASC';
      queryParams.unshift(parseFloat(lat), parseFloat(lng), parseFloat(lat));
      
      // Add distance filter
      whereConditions.push(`(6371 * acos(cos(radians(?)) * cos(radians(COALESCE(u.latitude, 0))) * cos(radians(COALESCE(u.longitude, 0)) - radians(?)) + sin(radians(?)) * sin(radians(COALESCE(u.latitude, 0))))) <= ?`);
      queryParams.push(parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(max_distance));
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Add limit and offset to params
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const query = `
      SELECT 
        p.id,
        p.product_id,
        p.name as product_name,
        p.description as product_description,
        COALESCE(gp.unit_price, p.price) as unit_price,
        COALESCE(gp.unit_type, 'piece') as unit_type,
        p.currency,
        COALESCE(gp.available_stock, p.stock_quantity) as available_stock,
        p.brand,
        p.main_image,
        p.tags,
        p.specifications,
        COALESCE(gp.created_at, p.created_at) as created_at,
        u.id as seller_id,
        CONCAT(u.first_name, ' ', u.last_name) as seller_name,
        u.phone as seller_phone,
        u.address as seller_location,
        u.city as seller_city,
        u.latitude as lat,
        u.longitude as lng,
        COALESCE(gc.name, pc.name) as category_name,
        CASE WHEN gp.id IS NOT NULL THEN 'grocery' ELSE 'regular' END as product_type
        ${distanceSelect}
      FROM products p
      LEFT JOIN grocery_products gp ON p.id = gp.product_id
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN grocery_categories gc ON p.category_id = gc.id
      ${whereClause}
      ORDER BY COALESCE(gp.created_at, p.created_at) DESC${distanceOrderBy}
      LIMIT ? OFFSET ?
    `;
    
    const [products] = await connection.execute(query, queryParams);
    
    // Format products for frontend
    const formattedProducts = products.map(product => ({
      id: product.id,
      product_id: product.product_id,
      product_name: product.product_name,
      description: product.product_description,
      unit_price: parseFloat(product.unit_price),
      unit_type: product.unit_type,
      currency: product.currency || 'RWF',
      available_stock: product.available_stock,
      stock_quantity: product.available_stock,
      brand: product.brand,
      main_image: product.main_image,
      tags: product.tags ? product.tags.split(',') : [],
      specifications: product.specifications ? JSON.parse(product.specifications) : {},
      category_name: product.category_name,
      seller_id: product.seller_id,
      seller_name: product.seller_name,
      seller_phone: product.seller_phone,
      seller_location: product.seller_location,
      seller_city: product.seller_city,
      latitude: product.lat,
      longitude: product.lng,
      distance_km: product.distance_km || null,
      estimated_delivery_fee: product.distance_km ? Math.round(1000 + (product.distance_km * 100)) : null,
      current_boost_level: 0, // Default boost level
      product_type: product.product_type,
      created_at: product.created_at
    }));
    
    await connection.end();
    
    res.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length,
      has_more: formattedProducts.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('Error fetching local market products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get product categories
router.get('/categories', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [categories] = await connection.execute(`
      SELECT 
        pc.id,
        pc.name,
        pc.description,
        pc.slug,
        COUNT(p.id) as product_count
      FROM product_categories pc
      LEFT JOIN products p ON pc.id = p.category_id AND p.is_active = 1
      WHERE pc.is_active = 1
      GROUP BY pc.id, pc.name, pc.description, pc.slug
      ORDER BY pc.name ASC
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      categories: categories
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

module.exports = router;