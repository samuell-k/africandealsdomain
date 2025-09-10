const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function checkDatabaseStructure() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3333
        });

        console.log('📋 Orders table structure:');
        const [ordersColumns] = await connection.query('DESCRIBE orders');
        ordersColumns.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'}`);
        });

        console.log('\n📋 Users table structure:');
        const [usersColumns] = await connection.query('DESCRIBE users');
        usersColumns.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'}`);
        });

        console.log('\n📋 Pickup_sites table structure:');
        const [pickupSitesColumns] = await connection.query('DESCRIBE pickup_sites');
        pickupSitesColumns.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'}`);
        });

        console.log('\n📋 Sample order data:');
        const [sampleOrder] = await connection.query('SELECT * FROM orders LIMIT 1');
        if (sampleOrder.length > 0) {
            console.log('Available fields:', Object.keys(sampleOrder[0]));
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkDatabaseStructure();