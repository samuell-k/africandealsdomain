const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Database connection function
async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333
  });
}

// Multer setup for file uploads
const getUploadStorage = (subfolder) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, `../uploads/${subfolder}`);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const prefix = subfolder === 'partners-promotions' ? 'promotion' : 'service';
      cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
};

// Configure uploads for different types
const uploadPromotion = multer({ 
  storage: getUploadStorage('partners-promotions'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const uploadService = multer({ 
  storage: getUploadStorage('other-services'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Legacy upload for backwards compatibility
const upload = uploadPromotion;

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
  // This should be replaced with proper admin authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }
  // For now, we'll skip token verification but in production this should verify the JWT
  next();
};

// =============== PARTNERS ROUTES ===============

// Get all partners (public route)
router.get('/partners', async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [partners] = await connection.execute(
      'SELECT id, name, description, logo_url, link, is_active, display_order, created_at FROM partners WHERE is_active = TRUE ORDER BY display_order ASC, created_at DESC'
    );
    
    res.json({
      success: true,
      partners: partners
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch partners',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get all partners for admin (includes inactive)
router.get('/admin/partners', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [partners] = await connection.execute(
      'SELECT p.*, u.username as created_by_name FROM partners p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.display_order ASC, p.created_at DESC'
    );
    
    res.json({
      success: true,
      partners: partners
    });
  } catch (error) {
    console.error('Error fetching partners for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch partners',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Create new partner
router.post('/admin/partners', requireAdmin, upload.single('logo'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { name, description, link, display_order, is_active } = req.body;
    
    if (!name || !link) {
      return res.status(400).json({
        success: false,
        message: 'Name and link are required'
      });
    }

    const logo_url = req.file ? `/uploads/partners-promotions/${req.file.filename}` : null;
    
    // Convert is_active properly
    const activeStatus = is_active === 'true' || is_active === true || is_active === '1';
    
    console.log('Creating partner with data:', {
      name, description, link, display_order, is_active, activeStatus, logo_url
    });
    
    const [result] = await connection.execute(
      'INSERT INTO partners (name, description, logo_url, link, display_order, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, logo_url, link, display_order || 0, activeStatus, req.user?.id || null]
    );

    res.json({
      success: true,
      message: 'Partner created successfully',
      partner_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create partner',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Update partner
router.put('/admin/partners/:id', requireAdmin, upload.single('logo'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    const { name, description, link, display_order, is_active } = req.body;
    
    // Get current partner data
    const [currentPartner] = await connection.execute('SELECT * FROM partners WHERE id = ?', [id]);
    if (currentPartner.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    const logo_url = req.file ? `/uploads/partners-promotions/${req.file.filename}` : currentPartner[0].logo_url;
    
    // Convert is_active properly
    const activeStatus = is_active === 'true' || is_active === true || is_active === '1';
    
    console.log('Updating partner with data:', {
      id, name, description, link, display_order, is_active, activeStatus
    });
    
    await connection.execute(
      'UPDATE partners SET name = ?, description = ?, logo_url = ?, link = ?, display_order = ?, is_active = ? WHERE id = ?',
      [name, description, logo_url, link, display_order || 0, activeStatus, id]
    );

    // Delete old logo if new one was uploaded
    if (req.file && currentPartner[0].logo_url) {
      const oldLogoPath = path.join(__dirname, '../', currentPartner[0].logo_url);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    res.json({
      success: true,
      message: 'Partner updated successfully'
    });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update partner',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete partner
router.delete('/admin/partners/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    
    // Get partner data to delete associated files
    const [partner] = await connection.execute('SELECT logo_url FROM partners WHERE id = ?', [id]);
    if (partner.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    await connection.execute('DELETE FROM partners WHERE id = ?', [id]);

    // Delete logo file
    if (partner[0].logo_url) {
      const logoPath = path.join(__dirname, '../../', partner[0].logo_url);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    res.json({
      success: true,
      message: 'Partner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete partner',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// =============== PROMOTIONS ROUTES ===============

// Get active promotional campaigns (public route)
router.get('/promotional-campaigns', async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [promotions] = await connection.execute(
      `SELECT id, title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, created_at 
       FROM promotional_campaigns 
       WHERE is_active = TRUE 
       AND (valid_from IS NULL OR valid_from <= NOW()) 
       AND (valid_until IS NULL OR valid_until >= NOW()) 
       ORDER BY display_order ASC, created_at DESC`
    );
    
    res.json({
      success: true,
      promotions: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Legacy route for backward compatibility
router.get('/promotions', async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [promotions] = await connection.execute(
      `SELECT id, title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, created_at 
       FROM promotional_campaigns 
       WHERE is_active = TRUE 
       AND (valid_from IS NULL OR valid_from <= NOW()) 
       AND (valid_until IS NULL OR valid_until >= NOW()) 
       ORDER BY display_order ASC, created_at DESC`
    );
    
    res.json({
      success: true,
      promotions: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get all promotional campaigns for admin
router.get('/admin/promotional-campaigns', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [promotions] = await connection.execute(
      'SELECT p.*, u.username as created_by_name FROM promotional_campaigns p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.display_order ASC, p.created_at DESC'
    );
    
    res.json({
      success: true,
      promotions: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Create new promotional campaign
router.post('/admin/promotional-campaigns', requireAdmin, upload.single('image'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { title, description, link, promotion_type, discount_percentage, valid_from, valid_until, display_order, is_active } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const image_url = req.file ? `/uploads/partners-promotions/${req.file.filename}` : null;
    
    // Convert is_active properly
    const activeStatus = is_active === 'true' || is_active === true || is_active === '1';
    
    console.log('Creating promotion with data:', {
      title, description, link, promotion_type, discount_percentage, valid_from, valid_until, display_order, is_active, activeStatus, image_url
    });
    
    const [result] = await connection.execute(
      'INSERT INTO promotional_campaigns (title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, display_order, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, image_url, link, promotion_type || 'Special Offer', discount_percentage || null, valid_from || null, valid_until || null, display_order || 0, activeStatus, req.user?.id || null]
    );

    res.json({
      success: true,
      message: 'Promotion created successfully',
      promotion_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promotion',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Update promotional campaign
router.put('/admin/promotional-campaigns/:id', requireAdmin, upload.single('image'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    const { title, description, link, promotion_type, discount_percentage, valid_from, valid_until, display_order, is_active } = req.body;
    
    // Get current promotion data
    const [currentPromotion] = await connection.execute('SELECT * FROM promotional_campaigns WHERE id = ?', [id]);
    if (currentPromotion.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const image_url = req.file ? `/uploads/partners-promotions/${req.file.filename}` : currentPromotion[0].image_url;
    
    // Convert is_active properly
    const activeStatus = is_active === 'true' || is_active === true || is_active === '1';
    
    console.log('Updating promotion with data:', {
      id, title, description, link, promotion_type, discount_percentage, valid_from, valid_until, display_order, is_active, activeStatus
    });
    
    await connection.execute(
      'UPDATE promotional_campaigns SET title = ?, description = ?, image_url = ?, link = ?, promotion_type = ?, discount_percentage = ?, valid_from = ?, valid_until = ?, display_order = ?, is_active = ? WHERE id = ?',
      [title, description, image_url, link, promotion_type || 'Special Offer', discount_percentage || null, valid_from || null, valid_until || null, display_order || 0, activeStatus, id]
    );

    // Delete old image if new one was uploaded
    if (req.file && currentPromotion[0].image_url) {
      const oldImagePath = path.join(__dirname, '../', currentPromotion[0].image_url);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    res.json({
      success: true,
      message: 'Promotion updated successfully'
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promotion',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete promotional campaign
router.delete('/admin/promotional-campaigns/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    
    // Get promotion data to delete associated files
    const [promotion] = await connection.execute('SELECT image_url FROM promotional_campaigns WHERE id = ?', [id]);
    if (promotion.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    await connection.execute('DELETE FROM promotional_campaigns WHERE id = ?', [id]);

    // Delete image file
    if (promotion[0].image_url) {
      const imagePath = path.join(__dirname, '../../', promotion[0].image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promotion',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// =============== OTHER SERVICES ROUTES ===============

// Get active other services (public route)
router.get('/other-services', async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [services] = await connection.execute(
      'SELECT id, name, description, icon, link, image_url, created_at FROM other_services WHERE is_active = TRUE ORDER BY display_order ASC, created_at DESC'
    );
    
    res.json({
      success: true,
      services: services
    });
  } catch (error) {
    console.error('Error fetching other services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch other services',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get all other services for admin
router.get('/admin/other-services', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [services] = await connection.execute(
      'SELECT s.*, u.username as created_by_name FROM other_services s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.display_order ASC, s.created_at DESC'
    );
    
    res.json({
      success: true,
      services: services
    });
  } catch (error) {
    console.error('Error fetching other services for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch other services',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Create new other service
router.post('/admin/other-services', requireAdmin, uploadService.single('image'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { name, description, icon, link, display_order, is_active } = req.body;
    
    if (!name || !link) {
      return res.status(400).json({
        success: false,
        message: 'Name and link are required'
      });
    }

    // Handle image upload
    const image_url = req.file ? `/uploads/other-services/${req.file.filename}` : null;
    
    console.log('Creating service with data:', {
      name, description, icon, link, display_order, is_active, image_url
    });
    
    const [result] = await connection.execute(
      'INSERT INTO other_services (name, description, icon, link, display_order, is_active, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, icon || '🔗', link, display_order || 0, is_active !== 'false' ? true : false, image_url, req.user?.id || null]
    );

    res.json({
      success: true,
      message: 'Service created successfully',
      service_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Update other service
router.put('/admin/other-services/:id', requireAdmin, uploadService.single('image'), async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    const { name, description, icon, link, display_order, is_active } = req.body;
    
    console.log('Updating service with data:', {
      id, name, description, icon, link, display_order, is_active
    });
    
    // Get current service data
    const [currentService] = await connection.execute('SELECT * FROM other_services WHERE id = ?', [id]);
    if (currentService.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Handle image upload
    let image_url = currentService[0].image_url; // Keep existing image by default
    if (req.file) {
      image_url = `/uploads/other-services/${req.file.filename}`;
      
      // Delete old image file if exists
      if (currentService[0].image_url) {
        const oldImagePath = path.join(__dirname, '../..', currentService[0].image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('Deleted old service image:', oldImagePath);
        }
      }
    }
    
    // Convert is_active properly
    const activeStatus = is_active === 'true' || is_active === true || is_active === '1';
    
    const [result] = await connection.execute(
      'UPDATE other_services SET name = ?, description = ?, icon = ?, link = ?, display_order = ?, is_active = ?, image_url = ? WHERE id = ?',
      [name, description, icon || '🔗', link, display_order || 0, activeStatus, image_url, id]
    );

    console.log('Service update result:', { affectedRows: result.affectedRows, activeStatus });

    res.json({
      success: true,
      message: 'Service updated successfully'
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete other service
router.delete('/admin/other-services/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;
    
    // Get service data to delete associated files
    const [service] = await connection.execute('SELECT image_url FROM other_services WHERE id = ?', [id]);
    if (service.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await connection.execute('DELETE FROM other_services WHERE id = ?', [id]);

    // Delete image file if exists
    if (service[0].image_url) {
      const imagePath = path.join(__dirname, '../..', service[0].image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('Deleted service image:', imagePath);
      }
    }

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;