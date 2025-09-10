const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAgentsColumns() {
    console.log('🔍 Checking agents table columns...');
    
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3333,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Get table structure
        const [columns] = await pool.query('DESCRIBE agents');
        
        console.log('\n📋 Agents table columns:');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

checkAgentsColumns();