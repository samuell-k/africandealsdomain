const pool = require('./db');

async function checkAdminLogsTable() {
    try {
        console.log('Checking admin_logs table structure...');
        
        const [structure] = await pool.execute('DESCRIBE admin_logs');
        console.log('\nadmin_logs table structure:');
        structure.forEach(row => {
            console.log(`${row.Field}: ${row.Type} ${row.Null} ${row.Key} ${row.Default || ''}`);
        });

        // Check if target_type and target_id columns exist
        const hasTargetType = structure.some(col => col.Field === 'target_type');
        const hasTargetId = structure.some(col => col.Field === 'target_id');

        console.log(`\nColumn checks:`);
        console.log(`target_type exists: ${hasTargetType}`);
        console.log(`target_id exists: ${hasTargetId}`);

        if (!hasTargetType) {
            console.log('\nAdding target_type column...');
            await pool.execute(`
                ALTER TABLE admin_logs 
                ADD COLUMN target_type VARCHAR(50) NULL AFTER action
            `);
            console.log('✅ target_type column added');
        }

        if (!hasTargetId) {
            console.log('\nAdding target_id column...');
            await pool.execute(`
                ALTER TABLE admin_logs 
                ADD COLUMN target_id INT NULL AFTER target_type
            `);
            console.log('✅ target_id column added');
        }

        if (!hasTargetType || !hasTargetId) {
            console.log('\nUpdated admin_logs table structure:');
            const [newStructure] = await pool.execute('DESCRIBE admin_logs');
            newStructure.forEach(row => {
                console.log(`${row.Field}: ${row.Type} ${row.Null} ${row.Key} ${row.Default || ''}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkAdminLogsTable();