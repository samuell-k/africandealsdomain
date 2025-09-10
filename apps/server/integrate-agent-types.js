// Integration script to add the new agent types routes to the main server app
const fs = require('fs');
const path = require('path');

// Read the current app.js file
const appPath = path.join(__dirname, 'app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// Check if agent types routes are already integrated
if (appContent.includes('agent-types')) {
    console.log('Agent types routes already integrated');
    process.exit(0);
}

// Find the position to insert new routes (after existing routes)
const routesSection = appContent.indexOf('// Routes');
if (routesSection === -1) {
    console.error('Could not find routes section in app.js');
    process.exit(1);
}

// Add the new route imports
const newImports = `
// Agent Types Routes
const agentTypesRoutes = require('./routes/agent-types');
const pickupDeliveryRoutes = require('./routes/pickup-delivery-agent');
const pickupSiteRoutes = require('./routes/pickup-site-manager');
const adminAgentTypesRoutes = require('./routes/admin-agent-types');
`;

// Add the new route usage
const newRoutes = `
// Agent Types API Routes
app.use('/api/agent-types', agentTypesRoutes);
app.use('/api/pickup-delivery', pickupDeliveryRoutes);
app.use('/api/pickup-site', pickupSiteRoutes);
app.use('/api/admin/agent-types', adminAgentTypesRoutes);
`;

// Insert the imports after the existing route imports
const lastImportIndex = appContent.lastIndexOf('require(\'./routes/');
const endOfLastImport = appContent.indexOf('\n', lastImportIndex);
appContent = appContent.slice(0, endOfLastImport) + newImports + appContent.slice(endOfLastImport);

// Insert the route usage after the existing route usage
const lastRouteIndex = appContent.lastIndexOf('app.use(\'/api/');
const endOfLastRoute = appContent.indexOf('\n', lastRouteIndex);
appContent = appContent.slice(0, endOfLastRoute) + newRoutes + appContent.slice(endOfLastRoute);

// Write the updated app.js file
fs.writeFileSync(appPath, appContent);

console.log('Successfully integrated agent types routes into app.js');
console.log('New routes added:');
console.log('- /api/agent-types/* (Fast delivery agent routes)');
console.log('- /api/pickup-delivery/* (Pickup delivery agent routes)');
console.log('- /api/pickup-site/* (Pickup site manager routes)');
console.log('- /api/admin/agent-types/* (Admin agent management routes)');
