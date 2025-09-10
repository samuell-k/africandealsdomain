/**
 * Real-World Test Data Generator for Pickup Delivery Agent Dashboard
 * Creates realistic test scenarios with actual database interactions
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

class PickupDeliveryTestDataGenerator {
    constructor() {
        this.connection = null;
        this.testUsers = [];
        this.testOrders = [];
        this.testProducts = [];
    }

    // Initialize database connection
    async init() {
        try {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'add_physical_product',
                port: process.env.DB_PORT || 3306
            });

            console.log('✅ Database connection established for testing');
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            return false;
        }
    }

    // Create test pickup delivery agents
    async createTestAgents() {
        console.log('🔧 Creating test pickup delivery agents...');
        
        const testAgents = [
            {
                name: 'John Doe',
                email: 'john.pda@test.com',
                phone: '+1234567890',
                password: 'TestAgent123!',
                role: 'pickup_delivery_agent',
                status: 'active',
                location: 'New York, NY',
                vehicle_type: 'motorcycle',
                license_number: 'PDA001',
                rating: 4.8,
                total_deliveries: 150
            },
            {
                name: 'Sarah Johnson',
                email: 'sarah.pda@test.com',
                phone: '+1234567891',
                password: 'TestAgent123!',
                role: 'pickup_delivery_agent',
                status: 'active',
                location: 'Los Angeles, CA',
                vehicle_type: 'van',
                license_number: 'PDA002',
                rating: 4.9,
                total_deliveries: 200
            },
            {
                name: 'Mike Wilson',
                email: 'mike.pda@test.com',
                phone: '+1234567892',
                password: 'TestAgent123!',
                role: 'pickup_delivery_agent',
                status: 'offline',
                location: 'Chicago, IL',
                vehicle_type: 'bicycle',
                license_number: 'PDA003',
                rating: 4.7,
                total_deliveries: 89
            }
        ];

        for (const agent of testAgents) {
            try {
                const hashedPassword = await bcrypt.hash(agent.password, 10);
                
                const [result] = await this.connection.execute(`
                    INSERT INTO users (name, email, phone, password, role, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone),
                    status = VALUES(status)
                `, [agent.name, agent.email, agent.phone, hashedPassword, agent.role, agent.status]);

                // Get the user ID
                const [userRows] = await this.connection.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [agent.email]
                );

                if (userRows.length > 0) {
                    const userId = userRows[0].id;
                    
                    // Insert or update agent-specific data
                    await this.connection.execute(`
                        INSERT INTO pickup_delivery_agents (
                            user_id, location, vehicle_type, license_number, 
                            rating, total_deliveries, is_available, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
                        ON DUPLICATE KEY UPDATE
                        location = VALUES(location),
                        vehicle_type = VALUES(vehicle_type),
                        rating = VALUES(rating),
                        total_deliveries = VALUES(total_deliveries),
                        is_available = TRUE
                    `, [userId, agent.location, agent.vehicle_type, agent.license_number, agent.rating, agent.total_deliveries]);

                    this.testUsers.push({ ...agent, id: userId });
                    console.log(`✅ Created test agent: ${agent.name} (${agent.email})`);
                }
            } catch (error) {
                console.error(`❌ Failed to create agent ${agent.email}:`, error.message);
            }
        }
    }

    // Create test buyers and sellers
    async createTestBuyersAndSellers() {
        console.log('🔧 Creating test buyers and sellers...');
        
        const testUsers = [
            // Buyers
            {
                name: 'Alice Smith',
                email: 'alice.buyer@test.com',
                phone: '+1234567893',
                role: 'buyer',
                address: '123 Main St, New York, NY 10001'
            },
            {
                name: 'Bob Johnson',
                email: 'bob.buyer@test.com',
                phone: '+1234567894',
                role: 'buyer',
                address: '456 Oak Ave, Los Angeles, CA 90210'
            },
            // Sellers
            {
                name: 'Carol Electronics',
                email: 'carol.seller@test.com',
                phone: '+1234567895',
                role: 'seller',
                address: '789 Business Blvd, Chicago, IL 60601'
            },
            {
                name: 'Dave Sports Store',
                email: 'dave.seller@test.com',
                phone: '+1234567896',
                role: 'seller',
                address: '321 Commerce St, Miami, FL 33101'
            }
        ];

        for (const user of testUsers) {
            try {
                const hashedPassword = await bcrypt.hash('TestUser123!', 10);
                
                await this.connection.execute(`
                    INSERT INTO users (name, email, phone, password, role, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'active', NOW())
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone)
                `, [user.name, user.email, user.phone, hashedPassword, user.role]);

                console.log(`✅ Created test ${user.role}: ${user.name}`);
            } catch (error) {
                console.error(`❌ Failed to create ${user.role} ${user.email}:`, error.message);
            }
        }
    }

    // Create test products
    async createTestProducts() {
        console.log('🔧 Creating test products...');
        
        // Get seller IDs
        const [sellers] = await this.connection.execute(
            "SELECT id FROM users WHERE role = 'seller' AND email LIKE '%test.com'"
        );

        if (sellers.length === 0) {
            console.log('❌ No test sellers found, skipping product creation');
            return;
        }

        const testProducts = [
            {
                name: 'iPhone 15 Pro',
                description: 'Latest iPhone with advanced camera system',
                price: 999.99,
                category: 'Electronics',
                stock_quantity: 50,
                weight: 0.2,
                dimensions: '15x7x0.8 cm'
            },
            {
                name: 'Nike Air Max 270',
                description: 'Comfortable running shoes with air cushioning',
                price: 150.00,
                category: 'Sports',
                stock_quantity: 100,
                weight: 0.5,
                dimensions: '30x20x12 cm'
            },
            {
                name: 'Samsung 4K TV 55"',
                description: 'Ultra HD Smart TV with HDR support',
                price: 799.99,
                category: 'Electronics',
                stock_quantity: 25,
                weight: 15.5,
                dimensions: '123x71x8 cm'
            },
            {
                name: 'Adidas Football',
                description: 'Official size football for professional play',
                price: 29.99,
                category: 'Sports',
                stock_quantity: 200,
                weight: 0.4,
                dimensions: '22x22x22 cm'
            }
        ];

        for (let i = 0; i < testProducts.length; i++) {
            const product = testProducts[i];
            const seller = sellers[i % sellers.length];
            
            try {
                // Get or create category
                let categoryId = 1; // Default category
                try {
                    const [categoryRows] = await this.connection.execute(`
                        SELECT id FROM categories WHERE name = ? LIMIT 1
                    `, [product.category]);
                    
                    if (categoryRows.length > 0) {
                        categoryId = categoryRows[0].id;
                    } else {
                        // Create category if it doesn't exist
                        const [categoryResult] = await this.connection.execute(`
                            INSERT INTO categories (name, description, created_at) 
                            VALUES (?, ?, NOW())
                        `, [product.category, `${product.category} products`]);
                        categoryId = categoryResult.insertId;
                    }
                } catch (categoryError) {
                    console.log(`ℹ️  Using default category for ${product.name}:`, categoryError.message);
                }

                const [result] = await this.connection.execute(`
                    INSERT INTO products (
                        seller_id, name, description, price, category, category_id,
                        stock_quantity, weight, dimensions, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW())
                `, [
                    seller.id, product.name, product.description, product.price,
                    product.category, categoryId, product.stock_quantity, product.weight, product.dimensions
                ]);

                this.testProducts.push({ ...product, id: result.insertId, seller_id: seller.id });
                console.log(`✅ Created test product: ${product.name}`);
            } catch (error) {
                console.error(`❌ Failed to create product ${product.name}:`, error.message);
            }
        }
    }

    // Create test orders with various statuses
    async createTestOrders() {
        console.log('🔧 Creating test orders...');
        
        // Get buyers and products
        const [buyers] = await this.connection.execute(
            "SELECT id, name, email FROM users WHERE role = 'buyer' AND email LIKE '%test.com'"
        );
        
        const [products] = await this.connection.execute(
            "SELECT id, name, price, seller_id FROM products WHERE status = 'approved'"
        );

        if (buyers.length === 0 || products.length === 0) {
            console.log('❌ No test buyers or products found, skipping order creation');
            return;
        }

        const orderStatuses = [
            'PAYMENT_CONFIRMED',
            'ASSIGNED_TO_PDA',
            'PDA_EN_ROUTE_TO_SELLER',
            'PDA_AT_SELLER',
            'PICKED_FROM_SELLER',
            'EN_ROUTE_TO_PSM',
            'DELIVERED_TO_PSM',
            'READY_FOR_PICKUP',
            'EN_ROUTE_TO_BUYER',
            'DELIVERED_TO_BUYER',
            'COMPLETED'
        ];

        const deliveryMethods = ['pickup', 'home_delivery'];
        const confirmationMethods = ['OTP', 'QR', 'GPS', 'PHOTO', 'SIGNATURE'];

        // Create 20 test orders
        for (let i = 0; i < 20; i++) {
            const buyer = buyers[Math.floor(Math.random() * buyers.length)];
            const product = products[Math.floor(Math.random() * products.length)];
            const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
            const deliveryMethod = deliveryMethods[Math.floor(Math.random() * deliveryMethods.length)];
            const confirmationMethod = confirmationMethods[Math.floor(Math.random() * confirmationMethods.length)];
            const quantity = Math.floor(Math.random() * 3) + 1;
            const totalAmount = (product.price * quantity).toFixed(2);

            try {
                // Generate unique order number
                const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                
                // Create order (using user_id instead of buyer_id for the main field)
                const [orderResult] = await this.connection.execute(`
                    INSERT INTO orders (
                        order_number, user_id, buyer_id, seller_id, total_amount, status, 
                        delivery_method, confirmation_method, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [orderNumber, buyer.id, buyer.id, product.seller_id, totalAmount, status, deliveryMethod, confirmationMethod]);

                const orderId = orderResult.insertId;

                // Create order items (check if price column exists, otherwise use different column name)
                try {
                    await this.connection.execute(`
                        INSERT INTO order_items (
                            order_id, product_id, quantity, price, created_at
                        ) VALUES (?, ?, ?, ?, NOW())
                    `, [orderId, product.id, quantity, product.price]);
                } catch (priceError) {
                    // Try with unit_price instead
                    await this.connection.execute(`
                        INSERT INTO order_items (
                            order_id, product_id, quantity, unit_price, created_at
                        ) VALUES (?, ?, ?, ?, NOW())
                    `, [orderId, product.id, quantity, product.price]);
                }

                // Assign to random PDA if status requires it
                if (['ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER'].includes(status)) {
                    const randomAgent = this.testUsers[Math.floor(Math.random() * this.testUsers.length)];
                    if (randomAgent) {
                        await this.connection.execute(`
                            UPDATE orders SET assigned_pda_id = ? WHERE id = ?
                        `, [randomAgent.id, orderId]);
                    }
                }

                this.testOrders.push({
                    id: orderId,
                    buyer_name: buyer.name,
                    buyer_email: buyer.email,
                    product_name: product.name,
                    quantity,
                    total_amount: totalAmount,
                    status,
                    delivery_method: deliveryMethod,
                    confirmation_method: confirmationMethod
                });

                console.log(`✅ Created test order #${orderId}: ${product.name} (${status})`);
            } catch (error) {
                console.error(`❌ Failed to create order:`, error.message);
            }
        }
    }

    // Create pickup sites
    async createTestPickupSites() {
        console.log('🔧 Creating test pickup sites...');
        
        const pickupSites = [
            {
                name: 'Downtown Pickup Center',
                address: '100 Main St, New York, NY 10001',
                latitude: 40.7128,
                longitude: -74.0060,
                operating_hours: JSON.stringify({
                    monday: { open: '09:00', close: '20:00' },
                    tuesday: { open: '09:00', close: '20:00' },
                    wednesday: { open: '09:00', close: '20:00' },
                    thursday: { open: '09:00', close: '20:00' },
                    friday: { open: '09:00', close: '20:00' },
                    saturday: { open: '10:00', close: '18:00' },
                    sunday: { open: '12:00', close: '17:00' }
                }),
                capacity: 500,
                status: 'active'
            },
            {
                name: 'Mall Pickup Point',
                address: '200 Shopping Blvd, Los Angeles, CA 90210',
                latitude: 34.0522,
                longitude: -118.2437,
                operating_hours: JSON.stringify({
                    monday: { open: '10:00', close: '21:00' },
                    tuesday: { open: '10:00', close: '21:00' },
                    wednesday: { open: '10:00', close: '21:00' },
                    thursday: { open: '10:00', close: '21:00' },
                    friday: { open: '10:00', close: '21:00' },
                    saturday: { open: '10:00', close: '21:00' },
                    sunday: { open: '11:00', close: '19:00' }
                }),
                capacity: 300,
                status: 'active'
            },
            {
                name: 'University Pickup Hub',
                address: '300 Campus Dr, Chicago, IL 60601',
                latitude: 41.8781,
                longitude: -87.6298,
                operating_hours: JSON.stringify({
                    monday: { open: '08:00', close: '18:00' },
                    tuesday: { open: '08:00', close: '18:00' },
                    wednesday: { open: '08:00', close: '18:00' },
                    thursday: { open: '08:00', close: '18:00' },
                    friday: { open: '08:00', close: '18:00' },
                    saturday: { open: '09:00', close: '15:00' },
                    sunday: { open: '12:00', close: '16:00' }
                }),
                capacity: 200,
                status: 'active'
            }
        ];

        for (const site of pickupSites) {
            try {
                await this.connection.execute(`
                    INSERT INTO pickup_sites (
                        name, address, latitude, longitude, operating_hours, 
                        capacity, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    operating_hours = VALUES(operating_hours),
                    capacity = VALUES(capacity)
                `, [
                    site.name, site.address, site.latitude, site.longitude,
                    site.operating_hours, site.capacity, site.status
                ]);

                console.log(`✅ Created pickup site: ${site.name}`);
            } catch (error) {
                console.error(`❌ Failed to create pickup site ${site.name}:`, error.message);
            }
        }
    }

    // Generate test statistics
    async generateTestStatistics() {
        console.log('📊 Generating test statistics...');
        
        try {
            // Count orders by status
            const [statusCounts] = await this.connection.execute(`
                SELECT status, COUNT(*) as count 
                FROM orders 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY status
            `);

            console.log('\n📈 Order Status Distribution:');
            statusCounts.forEach(row => {
                console.log(`   ${row.status}: ${row.count} orders`);
            });

            // Count agents by status
            const [agentCounts] = await this.connection.execute(`
                SELECT u.status, COUNT(*) as count 
                FROM users u 
                WHERE u.role = 'pickup_delivery_agent' 
                GROUP BY u.status
            `);

            console.log('\n👥 Agent Status Distribution:');
            agentCounts.forEach(row => {
                console.log(`   ${row.status}: ${row.count} agents`);
            });

            // Calculate average delivery time (mock data)
            console.log('\n⏱️  Performance Metrics:');
            console.log('   Average Pickup Time: 25 minutes');
            console.log('   Average Delivery Time: 45 minutes');
            console.log('   Success Rate: 98.5%');

        } catch (error) {
            console.error('❌ Failed to generate statistics:', error.message);
        }
    }

    // Run all test data creation
    async runFullTestSetup() {
        console.log('🚀 Starting full test data setup...\n');
        
        const success = await this.init();
        if (!success) {
            console.log('❌ Failed to initialize database connection');
            return;
        }

        await this.createTestAgents();
        await this.createTestBuyersAndSellers();
        await this.createTestProducts();
        await this.createTestOrders();
        await this.createTestPickupSites();
        await this.generateTestStatistics();

        console.log('\n✅ Test data setup completed successfully!');
        console.log('\n📋 Test Credentials:');
        console.log('   Agent 1: john.pda@test.com / TestAgent123!');
        console.log('   Agent 2: sarah.pda@test.com / TestAgent123!');
        console.log('   Agent 3: mike.pda@test.com / TestAgent123!');
        
        await this.connection.end();
    }

    // Clean up test data
    async cleanupTestData() {
        console.log('🧹 Cleaning up test data...');
        
        try {
            // Disable foreign key checks temporarily
            await this.connection.execute("SET FOREIGN_KEY_CHECKS = 0");
            
            // Delete in reverse order to handle foreign key constraints
            // First, get test user IDs
            const [testUsers] = await this.connection.execute("SELECT id FROM users WHERE email LIKE '%test.com'");
            const testUserIds = testUsers.map(u => u.id);
            
            if (testUserIds.length > 0) {
                const userIdList = testUserIds.join(',');
                
                // Delete order items first
                await this.connection.execute(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (${userIdList}))`);
                
                // Delete orders
                await this.connection.execute(`DELETE FROM orders WHERE user_id IN (${userIdList})`);
                
                // Delete products
                await this.connection.execute(`DELETE FROM products WHERE seller_id IN (${userIdList})`);
                
                // Delete pickup delivery agents
                await this.connection.execute(`DELETE FROM pickup_delivery_agents WHERE user_id IN (${userIdList})`);
                
                // Delete users
                await this.connection.execute(`DELETE FROM users WHERE id IN (${userIdList})`);
            }
            
            // Delete pickup sites
            await this.connection.execute("DELETE FROM pickup_sites WHERE name LIKE '%Pickup%'");
            
            // Re-enable foreign key checks
            await this.connection.execute("SET FOREIGN_KEY_CHECKS = 1");
            
            console.log('✅ Test data cleaned up successfully');
        } catch (error) {
            console.error('❌ Failed to cleanup test data:', error.message);
            // Re-enable foreign key checks even if cleanup failed
            try {
                await this.connection.execute("SET FOREIGN_KEY_CHECKS = 1");
            } catch (fkError) {
                console.error('❌ Failed to re-enable foreign key checks:', fkError.message);
            }
        }
        
        await this.connection.end();
    }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    const generator = new PickupDeliveryTestDataGenerator();
    
    switch (command) {
        case 'setup':
            await generator.runFullTestSetup();
            break;
        case 'cleanup':
            await generator.init();
            await generator.cleanupTestData();
            break;
        default:
            console.log('Usage:');
            console.log('  node test-pickup-delivery-real-data.js setup   - Create test data');
            console.log('  node test-pickup-delivery-real-data.js cleanup - Remove test data');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PickupDeliveryTestDataGenerator;