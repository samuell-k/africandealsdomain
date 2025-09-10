/**
 * Location Zones API Routes
 * Handles delivery zone management for the e-commerce platform
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isAdmin, isAgent } = require('../middleware/auth');

/**
 * Get all delivery zones
 * @route GET /api/location/zones
 * @access Private (Admin, Agent)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT z.*, 
                   GROUP_CONCAT(za.agent_id) as assigned_agents
            FROM delivery_zones z
            LEFT JOIN zone_agent_assignments za ON z.id = za.zone_id
        `;
        
        // If agent, only return zones assigned to them
        if (req.user.role === 'agent') {
            query += ` WHERE za.agent_id = ? `;
        }
        
        query += ` GROUP BY z.id`;
        
        let zones;
        if (req.user.role === 'agent') {
            zones = await db.query(query, [req.user.id]);
        } else {
            zones = await db.query(query);
        }
        
        // Process assigned agents
        zones = zones.map(zone => {
            if (zone.assigned_agents) {
                zone.assigned_agents = zone.assigned_agents.split(',').map(id => parseInt(id));
            } else {
                zone.assigned_agents = [];
            }
            return zone;
        });
        
        res.json({ zones });
    } catch (error) {
        console.error('Error fetching delivery zones:', error);
        res.status(500).json({ error: 'Failed to fetch delivery zones' });
    }
});

/**
 * Get a specific delivery zone by ID
 * @route GET /api/location/zones/:id
 * @access Private (Admin, Agent)
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const zoneId = req.params.id;
        
        // Get zone details
        const query = `
            SELECT z.*, 
                   GROUP_CONCAT(za.agent_id) as assigned_agents
            FROM delivery_zones z
            LEFT JOIN zone_agent_assignments za ON z.id = za.zone_id
            WHERE z.id = ?
            GROUP BY z.id
        `;
        
        const [zone] = await db.query(query, [zoneId]);
        
        if (!zone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        
        // Check if agent has access to this zone
        if (req.user.role === 'agent') {
            const assignedAgents = zone.assigned_agents ? zone.assigned_agents.split(',').map(id => parseInt(id)) : [];
            if (!assignedAgents.includes(req.user.id)) {
                return res.status(403).json({ error: 'You do not have access to this zone' });
            }
        }
        
        // Process assigned agents
        if (zone.assigned_agents) {
            zone.assigned_agents = zone.assigned_agents.split(',').map(id => parseInt(id));
        } else {
            zone.assigned_agents = [];
        }
        
        res.json({ zone });
    } catch (error) {
        console.error('Error fetching delivery zone:', error);
        res.status(500).json({ error: 'Failed to fetch delivery zone' });
    }
});

/**
 * Create a new delivery zone
 * @route POST /api/location/zones
 * @access Private (Admin)
 */
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, description, color, geojson, agents } = req.body;
        
        // Validate required fields
        if (!name || !geojson) {
            return res.status(400).json({ error: 'Name and GeoJSON are required' });
        }
        
        // Insert zone
        const result = await db.query(
            'INSERT INTO delivery_zones (name, description, color, geojson) VALUES (?, ?, ?, ?)',
            [name, description || '', color || '#3388ff', JSON.stringify(geojson)]
        );
        
        const zoneId = result.insertId;
        
        // Assign agents if provided
        if (agents && agents.length > 0) {
            const values = agents.map(agentId => [zoneId, agentId]);
            await db.query(
                'INSERT INTO zone_agent_assignments (zone_id, agent_id) VALUES ?',
                [values]
            );
        }
        
        // Get the created zone
        const [zone] = await db.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
        
        res.status(201).json({ 
            message: 'Delivery zone created successfully',
            zone: {
                ...zone,
                assigned_agents: agents || []
            }
        });
    } catch (error) {
        console.error('Error creating delivery zone:', error);
        res.status(500).json({ error: 'Failed to create delivery zone' });
    }
});

/**
 * Update a delivery zone
 * @route PUT /api/location/zones/:id
 * @access Private (Admin)
 */
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const zoneId = req.params.id;
        const { name, description, color, geojson } = req.body;
        
        // Validate required fields
        if (!name || !geojson) {
            return res.status(400).json({ error: 'Name and GeoJSON are required' });
        }
        
        // Check if zone exists
        const [existingZone] = await db.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
        
        if (!existingZone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        
        // Update zone
        await db.query(
            'UPDATE delivery_zones SET name = ?, description = ?, color = ?, geojson = ? WHERE id = ?',
            [name, description || '', color || '#3388ff', JSON.stringify(geojson), zoneId]
        );
        
        // Get the updated zone
        const [zone] = await db.query(
            `SELECT z.*, GROUP_CONCAT(za.agent_id) as assigned_agents
             FROM delivery_zones z
             LEFT JOIN zone_agent_assignments za ON z.id = za.zone_id
             WHERE z.id = ?
             GROUP BY z.id`,
            [zoneId]
        );
        
        // Process assigned agents
        if (zone.assigned_agents) {
            zone.assigned_agents = zone.assigned_agents.split(',').map(id => parseInt(id));
        } else {
            zone.assigned_agents = [];
        }
        
        res.json({ 
            message: 'Delivery zone updated successfully',
            zone
        });
    } catch (error) {
        console.error('Error updating delivery zone:', error);
        res.status(500).json({ error: 'Failed to update delivery zone' });
    }
});

/**
 * Update delivery zone details (name, description, color)
 * @route PUT /api/location/zones/:id/details
 * @access Private (Admin)
 */
router.put('/:id/details', authenticateToken, isAdmin, async (req, res) => {
    try {
        const zoneId = req.params.id;
        const { name, description, color } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Check if zone exists
        const [existingZone] = await db.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
        
        if (!existingZone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        
        // Update zone details
        await db.query(
            'UPDATE delivery_zones SET name = ?, description = ?, color = ? WHERE id = ?',
            [name, description || '', color || '#3388ff', zoneId]
        );
        
        // Get the updated zone
        const [zone] = await db.query(
            `SELECT z.*, GROUP_CONCAT(za.agent_id) as assigned_agents
             FROM delivery_zones z
             LEFT JOIN zone_agent_assignments za ON z.id = za.zone_id
             WHERE z.id = ?
             GROUP BY z.id`,
            [zoneId]
        );
        
        // Process assigned agents
        if (zone.assigned_agents) {
            zone.assigned_agents = zone.assigned_agents.split(',').map(id => parseInt(id));
        } else {
            zone.assigned_agents = [];
        }
        
        res.json({ 
            message: 'Delivery zone details updated successfully',
            zone
        });
    } catch (error) {
        console.error('Error updating delivery zone details:', error);
        res.status(500).json({ error: 'Failed to update delivery zone details' });
    }
});

/**
 * Delete a delivery zone
 * @route DELETE /api/location/zones/:id
 * @access Private (Admin)
 */
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const zoneId = req.params.id;
        
        // Check if zone exists
        const [existingZone] = await db.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
        
        if (!existingZone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        
        // Delete zone agent assignments
        await db.query('DELETE FROM zone_agent_assignments WHERE zone_id = ?', [zoneId]);
        
        // Delete zone
        await db.query('DELETE FROM delivery_zones WHERE id = ?', [zoneId]);
        
        res.json({ message: 'Delivery zone deleted successfully' });
    } catch (error) {
        console.error('Error deleting delivery zone:', error);
        res.status(500).json({ error: 'Failed to delete delivery zone' });
    }
});

/**
 * Assign agents to a delivery zone
 * @route PUT /api/location/zones/:id/agents
 * @access Private (Admin)
 */
router.put('/:id/agents', authenticateToken, isAdmin, async (req, res) => {
    try {
        const zoneId = req.params.id;
        const { agents } = req.body;
        
        if (!Array.isArray(agents)) {
            return res.status(400).json({ error: 'Agents must be an array' });
        }
        
        // Check if zone exists
        const [existingZone] = await db.query('SELECT * FROM delivery_zones WHERE id = ?', [zoneId]);
        
        if (!existingZone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        
        // Start transaction
        await db.query('START TRANSACTION');
        
        try {
            // Delete existing assignments
            await db.query('DELETE FROM zone_agent_assignments WHERE zone_id = ?', [zoneId]);
            
            // Insert new assignments if any
            if (agents.length > 0) {
                const values = agents.map(agentId => [zoneId, agentId]);
                await db.query(
                    'INSERT INTO zone_agent_assignments (zone_id, agent_id) VALUES ?',
                    [values]
                );
            }
            
            // Commit transaction
            await db.query('COMMIT');
            
            // Get the updated zone
            const [zone] = await db.query(
                `SELECT z.*, GROUP_CONCAT(za.agent_id) as assigned_agents
                 FROM delivery_zones z
                 LEFT JOIN zone_agent_assignments za ON z.id = za.zone_id
                 WHERE z.id = ?
                 GROUP BY z.id`,
                [zoneId]
            );
            
            // Process assigned agents
            if (zone.assigned_agents) {
                zone.assigned_agents = zone.assigned_agents.split(',').map(id => parseInt(id));
            } else {
                zone.assigned_agents = [];
            }
            
            res.json({ 
                message: 'Agent assignments updated successfully',
                zone
            });
        } catch (error) {
            // Rollback transaction on error
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error assigning agents to zone:', error);
        res.status(500).json({ error: 'Failed to assign agents to zone' });
    }
});

/**
 * Import delivery zones from GeoJSON
 * @route POST /api/location/zones/import
 * @access Private (Admin)
 */
router.post('/import', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { geojson } = req.body;
        
        if (!geojson) {
            return res.status(400).json({ error: 'GeoJSON data is required' });
        }
        
        // Validate GeoJSON type
        if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature') {
            return res.status(400).json({ error: 'Invalid GeoJSON format' });
        }
        
        // Start transaction
        await db.query('START TRANSACTION');
        
        try {
            let importedCount = 0;
            
            // Process features
            const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
            
            for (const feature of features) {
                // Extract properties
                const properties = feature.properties || {};
                const name = properties.name || `Imported Zone ${Date.now()}`;
                const description = properties.description || '';
                const color = properties.color || '#3388ff';
                
                // Create a new GeoJSON object with just this feature
                const featureGeoJson = {
                    type: 'FeatureCollection',
                    features: [feature]
                };
                
                // Insert zone
                await db.query(
                    'INSERT INTO delivery_zones (name, description, color, geojson) VALUES (?, ?, ?, ?)',
                    [name, description, color, JSON.stringify(featureGeoJson)]
                );
                
                importedCount++;
            }
            
            // Commit transaction
            await db.query('COMMIT');
            
            res.json({ 
                message: `Successfully imported ${importedCount} zones`,
                importedCount
            });
        } catch (error) {
            // Rollback transaction on error
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error importing delivery zones:', error);
        res.status(500).json({ error: 'Failed to import delivery zones' });
    }
});

/**
 * Get agents for assignment to zones
 * @route GET /api/location/zones/agents
 * @access Private (Admin)
 */
router.get('/agents/list', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Get all agents
        const agents = await db.query(
            `SELECT id, name, email, phone, profile_image 
             FROM users 
             WHERE role = 'agent' AND status = 'active'`
        );
        
        res.json({ agents });
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

module.exports = router;