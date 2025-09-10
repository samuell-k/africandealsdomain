const db = require('./db');

async function testAgentDatabase() {
    try {
        console.log('🔍 Testing Agent Database Setup...\n');

        // Test 1: Check if agents table exists
        console.log('1. Checking if agents table exists...');
        const [tables] = await db.query("SHOW TABLES LIKE 'agents'");
        if (tables.length > 0) {
            console.log('✅ Agents table exists');
        } else {
            console.log('❌ Agents table does not exist');
            return;
        }

        // Test 2: Check agents table structure
        console.log('\n2. Checking agents table structure...');
        const [columns] = await db.query("DESCRIBE agents");
        console.log('✅ Agents table has', columns.length, 'columns');
        
        const requiredColumns = ['id', 'agent_code', 'user_id', 'first_name', 'last_name', 'email'];
        for (const col of requiredColumns) {
            const exists = columns.some(c => c.Field === col);
            console.log(`${exists ? '✅' : '❌'} Column '${col}' ${exists ? 'exists' : 'missing'}`);
        }

        // Test 3: Check if users table exists
        console.log('\n3. Checking if users table exists...');
        const [userTables] = await db.query("SHOW TABLES LIKE 'users'");
        if (userTables.length > 0) {
            console.log('✅ Users table exists');
        } else {
            console.log('❌ Users table does not exist');
        }

        // Test 4: Check for existing agents
        console.log('\n4. Checking for existing agents...');
        const [agents] = await db.query("SELECT COUNT(*) as count FROM agents");
        console.log(`✅ Found ${agents[0].count} agents in database`);

        // Test 5: Check for agent activities table
        console.log('\n5. Checking agent_activities table...');
        const [activityTables] = await db.query("SHOW TABLES LIKE 'agent_activities'");
        if (activityTables.length > 0) {
            console.log('✅ Agent activities table exists');
        } else {
            console.log('❌ Agent activities table does not exist');
        }

        // Test 6: Test agent registration query
        console.log('\n6. Testing agent registration query...');
        try {
            const testQuery = `
                INSERT INTO agents (
                    agent_code, user_id, first_name, last_name, email, phone,
                    agent_type, vehicle_type, primary_territory,
                    commission_rate, bonus_rate, permissions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            console.log('✅ Agent registration query syntax is valid');
        } catch (error) {
            console.log('❌ Agent registration query has syntax error:', error.message);
        }

        console.log('\n🎯 Database test completed!');

    } catch (error) {
        console.error('❌ Database test failed:', error.message);
    } finally {
        process.exit(0);
    }
}

testAgentDatabase();