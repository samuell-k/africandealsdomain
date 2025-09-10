const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function createTestPDA() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🚚 Creating test Pickup Delivery Agent...');
        
        // Check if PDA already exists
        const [existingPDA] = await connection.query(
            'SELECT id FROM users WHERE email = "pda.test@example.com"'
        );
        
        if (existingPDA.length > 0) {
            console.log('✅ Test PDA already exists with ID:', existingPDA[0].id);
            return;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash('testpda123', 10);
        
        // Create PDA user
        const [result] = await connection.query(`
            INSERT INTO users (name, email, password, role, agent_type, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())
        `, ['Test PDA Agent', 'pda.test@example.com', hashedPassword, 'agent', 'pickup_delivery_agent']);
        
        const pdaId = result.insertId;
        console.log('✅ Created PDA user with ID:', pdaId);
        
        // Check if agents table exists and create agent profile
        try {
            const [agentResult] = await connection.query(`
                INSERT INTO agents (
                    user_id, 
                    agent_code, 
                    agent_type, 
                    status, 
                    phone, 
                    vehicle_type,
                    max_distance,
                    working_hours,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                pdaId, 
                `PDA${pdaId.toString().padStart(4, '0')}`, 
                'pickup_delivery_agent', 
                'active', 
                '+250788123456',
                'motorcycle',
                15,
                'business_hours'
            ]);
            
            console.log('✅ Created agent profile with ID:', agentResult.insertId);
        } catch (agentError) {
            console.log('⚠️  Could not create agent profile (table might not exist):', agentError.message);
        }
        
        console.log('🎉 Test PDA created successfully!');
        console.log('📧 Email: pda.test@example.com');
        console.log('🔑 Password: testpda123');
        
    } catch (error) {
        console.error('❌ Error creating test PDA:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createTestPDA();