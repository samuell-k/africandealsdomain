const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function testManualOrderCreation() {
    let connection;
    
    try {
        console.log('🔧 Testing PSM Manual Order Creation...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Find the PSM test user
        const [users] = await connection.query(
            'SELECT id, email, name FROM users WHERE email = ?',
            ['psm.test@example.com']
        );
        
        if (users.length === 0) {
            console.log('❌ PSM test user not found');
            return;
        }
        
        const user = users[0];
        console.log('📋 Found PSM user:', user);
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                userId: user.id, 
                email: user.email, 
                name: user.name,
                role: 'agent',
                agentType: 'pickup_site_manager'
            },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            { expiresIn: '24h' }
        );
        
        console.log('🎉 Generated JWT token for testing');
        
        // Test manual order creation
        console.log('\n🧪 Testing Manual Order Creation...');
        
        try {
            const fetch = (await import('node-fetch')).default;
            const FormData = (await import('form-data')).default;
            
            // Create form data for the order
            const formData = new FormData();
            formData.append('buyer_name', 'Test Customer');
            formData.append('buyer_phone', '+250788999888');
            formData.append('buyer_email', 'test.customer@example.com');
            formData.append('buyer_national_id', 'ID123456789');
            
            // Delivery details
            const deliveryDetails = {
                type: 'home_delivery',
                address: 'KG 456 St, Kigali, Rwanda',
                coordinates: { lat: -1.9441, lng: 30.0619 },
                instructions: 'Call when you arrive'
            };
            formData.append('delivery_details', JSON.stringify(deliveryDetails));
            
            // Order items
            const items = [
                {
                    item: 'Test Product 1',
                    quantity: 2,
                    price: 25.50,
                    description: 'Test product for manual order'
                },
                {
                    item: 'Test Product 2',
                    quantity: 1,
                    price: 15.00,
                    description: 'Another test product'
                }
            ];
            formData.append('items', JSON.stringify(items));
            formData.append('notes', 'Test manual order created via API test');
            
            const response = await fetch('http://localhost:3002/api/pickup-site-manager/create-order', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            console.log('📊 Manual Order Creation Response Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Manual Order Created Successfully!');
                console.log('📋 Order Details:', {
                    orderId: data.orderId,
                    orderNumber: data.orderNumber,
                    subtotal: data.subtotal,
                    deliveryFee: data.delivery_fee,
                    totalAmount: data.total_amount,
                    commissionAmount: data.commission_amount
                });
                
                if (data.receiptUrl) {
                    console.log('📄 Receipt URL:', data.receiptUrl);
                }
                
                // Test order retrieval
                console.log('\n🧪 Testing Order Retrieval...');
                const orderResponse = await fetch(`http://localhost:3002/api/pickup-site-manager/orders`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (orderResponse.ok) {
                    const ordersData = await orderResponse.json();
                    console.log('✅ Orders Retrieved Successfully!');
                    console.log('📋 Total Orders:', ordersData.orders?.length || 0);
                    if (ordersData.orders && ordersData.orders.length > 0) {
                        console.log('📋 Latest Order:', ordersData.orders[0]);
                    }
                } else {
                    const orderError = await orderResponse.text();
                    console.log('❌ Order Retrieval Error:', orderError);
                }
                
            } else {
                const errorText = await response.text();
                console.log('❌ Manual Order Creation Error:', errorText);
                
                try {
                    const errorData = JSON.parse(errorText);
                    console.log('📋 Error Details:', errorData);
                } catch (parseError) {
                    console.log('📋 Raw Error Response:', errorText);
                }
            }
            
        } catch (fetchError) {
            console.log('⚠️ Could not test manual order creation:', fetchError.message);
            console.log('💡 Make sure the server is running on port 3002');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run test
testManualOrderCreation();