/**
 * Home Background Advertisement Management API
 * Handles dynamic background content for home page hero section
 * Database-driven implementation
 */
const express = require('express');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/home-ads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'home-ad-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Helper function to format ad data from database
function formatAdData(dbAd) {
  return {
    id: dbAd.id,
    title: dbAd.title,
    subtitle: dbAd.subtitle,
    description: dbAd.description,
    type: dbAd.type,
    content: dbAd.content,
    isActive: Boolean(dbAd.is_active),
    stats: {
      activeSellers: dbAd.stats_active_sellers,
      products: dbAd.stats_products,
      happyCustomers: dbAd.stats_happy_customers,
      countries: dbAd.stats_countries
    },
    buttonText: dbAd.button_text,
    buttonLink: dbAd.button_link,
    secondaryButtonText: dbAd.secondary_button_text,
    secondaryButtonLink: dbAd.secondary_button_link,
    backgroundColor: dbAd.background_color,
    overlay: dbAd.overlay_color,
    createdAt: dbAd.created_at,
    updatedAt: dbAd.updated_at,
    contentUrl: dbAd.content ? `/uploads/home-ads/${dbAd.content}` : null
  };
}

// Helper function to get active ad ID
async function getActiveAdId() {
  try {
    const [result] = await db.execute(
      'SELECT setting_value FROM home_ads_settings WHERE setting_key = ?',
      ['active_ad_id']
    );
    return result.length > 0 ? parseInt(result[0].setting_value) : null;
  } catch (error) {
    console.error('Error getting active ad ID:', error);
    return null;
  }
}

// Helper function to set active ad ID
async function setActiveAdId(adId) {
  try {
    await db.execute(
      'INSERT INTO home_ads_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      ['active_ad_id', adId.toString(), adId.toString()]
    );
    return true;
  } catch (error) {
    console.error('Error setting active ad ID:', error);
    return false;
  }
}

// GET /api/home-ads - Get all home ads (admin only)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM home_ads ORDER BY created_at DESC'
    );

    const formattedAds = rows.map(formatAdData);

    res.json({
      success: true,
      ads: formattedAds
    });
  } catch (error) {
    console.error('Error fetching home ads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch home ads'
    });
  }
});

// GET /api/home-ads/active - Get currently active home ad (public)
router.get('/active', async (req, res) => {
  try {
    const activeAdId = await getActiveAdId();
    
    if (!activeAdId) {
      return res.status(404).json({
        success: false,
        error: 'No active home ad configured'
      });
    }

    const [rows] = await db.execute(
      'SELECT * FROM home_ads WHERE id = ? AND is_active = 1',
      [activeAdId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Active home ad not found or inactive'
      });
    }

    const activeAd = formatAdData(rows[0]);

    res.json({
      success: true,
      ad: activeAd
    });
  } catch (error) {
    console.error('Error fetching active home ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active home ad'
    });
  }
});

// POST /api/home-ads - Create new home ad (admin only)
router.post('/', upload.single('content'), async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      type,
      buttonText,
      buttonLink,
      secondaryButtonText,
      secondaryButtonLink,
      backgroundColor,
      overlay,
      activeSellers,
      products,
      happyCustomers,
      countries
    } = req.body;

    // Validate required fields
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: 'Title and type are required'
      });
    }

    // Validate ad type
    const validTypes = ['default', 'image', 'slideshow', 'video'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ad type. Must be one of: ' + validTypes.join(', ')
      });
    }

    // Insert new ad into database
    const insertQuery = `
      INSERT INTO home_ads (
        title, subtitle, description, type, content, is_active,
        stats_active_sellers, stats_products, stats_happy_customers, stats_countries,
        button_text, button_link, secondary_button_text, secondary_button_link,
        background_color, overlay_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      title || "Discover Amazing Products",
      subtitle || "Connect with trusted African sellers",
      description || "Secure payments • Fast delivery • 24/7 support",
      type,
      req.file ? req.file.filename : null,
      1, // is_active
      parseInt(activeSellers) || 500,
      parseInt(products) || 10000,
      parseInt(happyCustomers) || 50000,
      parseInt(countries) || 7,
      buttonText || "Explore Products",
      buttonLink || "#discover",
      secondaryButtonText || "Join Free Today",
      secondaryButtonLink || "/auth/auth-buyer.html",
      backgroundColor || "linear-gradient(135deg, #0e2038 0%, #23325c 50%, #1e3a8a 100%)",
      overlay || "rgba(14, 32, 56, 0.1)"
    ]);

    const newAdId = result.insertId;

    // Fetch the created ad
    const [newAdRows] = await db.execute(
      'SELECT * FROM home_ads WHERE id = ?',
      [newAdId]
    );

    const newAd = formatAdData(newAdRows[0]);

    console.log('✅ NEW HOME AD CREATED:', {
      id: newAd.id,
      title: newAd.title,
      type: newAd.type,
      hasContent: !!newAd.content
    });

    res.status(201).json({
      success: true,
      message: 'Home ad created successfully',
      ad: newAd
    });
  } catch (error) {
    console.error('Error creating home ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create home ad'
    });
  }
});

// PUT /api/home-ads/:id - Update home ad (admin only)
router.put('/:id', upload.single('content'), async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    
    // Check if ad exists
    const [existingRows] = await db.execute(
      'SELECT * FROM home_ads WHERE id = ?',
      [adId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home ad not found'
      });
    }

    const existingAd = existingRows[0];
    const {
      title,
      subtitle,
      description,
      type,
      isActive,
      buttonText,
      buttonLink,
      secondaryButtonText,
      secondaryButtonLink,
      backgroundColor,
      overlay,
      activeSellers,
      products,
      happyCustomers,
      countries
    } = req.body;

    // Prepare update query
    const updateQuery = `
      UPDATE home_ads SET
        title = ?, subtitle = ?, description = ?, type = ?, is_active = ?,
        stats_active_sellers = ?, stats_products = ?, stats_happy_customers = ?, stats_countries = ?,
        button_text = ?, button_link = ?, secondary_button_text = ?, secondary_button_link = ?,
        background_color = ?, overlay_color = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const newContent = req.file ? req.file.filename : existingAd.content;

    await db.execute(updateQuery, [
      title || existingAd.title,
      subtitle || existingAd.subtitle,
      description || existingAd.description,
      type || existingAd.type,
      isActive !== undefined ? (JSON.parse(isActive) ? 1 : 0) : existingAd.is_active,
      parseInt(activeSellers) || existingAd.stats_active_sellers,
      parseInt(products) || existingAd.stats_products,
      parseInt(happyCustomers) || existingAd.stats_happy_customers,
      parseInt(countries) || existingAd.stats_countries,
      buttonText || existingAd.button_text,
      buttonLink || existingAd.button_link,
      secondaryButtonText || existingAd.secondary_button_text,
      secondaryButtonLink || existingAd.secondary_button_link,
      backgroundColor || existingAd.background_color,
      overlay || existingAd.overlay_color,
      newContent,
      adId
    ]);

    // If updating content file, delete old file
    if (req.file && existingAd.content && existingAd.content !== newContent) {
      const oldFilePath = path.join(__dirname, '../uploads/home-ads', existingAd.content);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Fetch updated ad
    const [updatedRows] = await db.execute(
      'SELECT * FROM home_ads WHERE id = ?',
      [adId]
    );

    const updatedAd = formatAdData(updatedRows[0]);

    console.log('✅ HOME AD UPDATED:', {
      id: updatedAd.id,
      title: updatedAd.title,
      type: updatedAd.type,
      isActive: updatedAd.isActive
    });

    res.json({
      success: true,
      message: 'Home ad updated successfully',
      ad: updatedAd
    });
  } catch (error) {
    console.error('Error updating home ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update home ad'
    });
  }
});

// PUT /api/home-ads/:id/activate - Set ad as active (admin only)
router.put('/:id/activate', async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    
    // Check if ad exists and is active
    const [adRows] = await db.execute(
      'SELECT id, title, is_active FROM home_ads WHERE id = ?',
      [adId]
    );

    if (adRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home ad not found'
      });
    }

    const ad = adRows[0];

    if (!ad.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Cannot activate inactive ad. Enable it first.'
      });
    }

    // Set as active ad
    const success = await setActiveAdId(adId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to set active ad'
      });
    }

    console.log('✅ HOME AD ACTIVATED:', { id: adId, title: ad.title });

    res.json({
      success: true,
      message: 'Home ad activated successfully',
      activeAdId: adId
    });
  } catch (error) {
    console.error('Error activating home ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate home ad'
    });
  }
});

// DELETE /api/home-ads/:id - Delete home ad (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    
    // Check if ad exists
    const [adRows] = await db.execute(
      'SELECT * FROM home_ads WHERE id = ?',
      [adId]
    );

    if (adRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Home ad not found'
      });
    }

    const ad = adRows[0];

    // Check if it's the only active ad
    const [activeAdsCount] = await db.execute(
      'SELECT COUNT(*) as count FROM home_ads WHERE is_active = 1'
    );

    const currentActiveId = await getActiveAdId();
    
    if (ad.id === currentActiveId && activeAdsCount[0].count === 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the only active home ad'
      });
    }

    // Delete associated file
    if (ad.content) {
      const filePath = path.join(__dirname, '../uploads/home-ads', ad.content);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from database
    await db.execute('DELETE FROM home_ads WHERE id = ?', [adId]);

    // If this was the active ad, set another one as active
    if (ad.id === currentActiveId) {
      const [nextActiveRows] = await db.execute(
        'SELECT id FROM home_ads WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
      );
      
      if (nextActiveRows.length > 0) {
        await setActiveAdId(nextActiveRows[0].id);
      }
    }

    console.log('✅ HOME AD DELETED:', { id: adId, title: ad.title });

    res.json({
      success: true,
      message: 'Home ad deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting home ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete home ad'
    });
  }
});

// GET /api/home-ads/stats - Get home ad statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const [totalRows] = await db.execute('SELECT COUNT(*) as count FROM home_ads');
    const [activeRows] = await db.execute('SELECT COUNT(*) as count FROM home_ads WHERE is_active = 1');
    const [inactiveRows] = await db.execute('SELECT COUNT(*) as count FROM home_ads WHERE is_active = 0');
    
    const [typeStats] = await db.execute(`
      SELECT type, COUNT(*) as count 
      FROM home_ads 
      GROUP BY type
    `);

    const activeAdId = await getActiveAdId();

    const adTypes = {
      default: 0,
      image: 0,
      slideshow: 0,
      video: 0
    };

    typeStats.forEach(stat => {
      adTypes[stat.type] = stat.count;
    });

    const stats = {
      totalAds: totalRows[0].count,
      activeAds: activeRows[0].count,
      inactiveAds: inactiveRows[0].count,
      currentActiveId: activeAdId,
      adTypes
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching home ad stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;