// GET /api/admin/email-templates - Get all email templates
router.get('/email-templates', enhancedErrorHandler(async (req, res) => {
    const { type, status, search, language = 'en' } = req.query;

    // Mock email templates data
    const mockTemplates = [
        {
            id: 1,
            name: 'Welcome Email',
            type: 'transactional',
            subject: 'Welcome to {{site_name}}, {{user_name}}!',
            content: '<h2>Welcome {{user_name}}!</h2><p>Thank you for joining {{site_name}}. We are excited to have you on board.</p><p>Start exploring our platform and discover amazing products!</p><br><p>Best regards,<br>The {{site_name}} Team</p>',
            status: 'active',
            language: 'en',
            priority: 'normal',
            from_email: 'welcome@africandeals.com',
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            created_by: req.user.id,
            usage_count: 1250,
            open_rate: 75.5,
            click_rate: 23.4
        },
        {
            id: 2,
            name: 'Order Confirmation',
            type: 'transactional',
            subject: 'Order #{{order_id}} Confirmed - {{site_name}}',
            content: '<h2>Order Confirmation</h2><p>Dear {{user_name}},</p><p>Thank you for your order! Your order #{{order_id}} for ${{order_total}} has been confirmed and is being processed.</p><p>You will receive a shipping notification once your order is on its way.</p><br><p>Order Details:<br>Total: ${{order_total}}<br>Date: {{current_date}}</p>',
            status: 'active',
            language: 'en',
            priority: 'high',
            from_email: 'orders@africandeals.com',
            created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
            created_by: req.user.id,
            usage_count: 3456,
            open_rate: 89.2,
            click_rate: 45.7
        },
        {
            id: 3,
            name: 'Password Reset',
            type: 'system',
            subject: 'Reset Your Password - {{site_name}}',
            content: '<h2>Password Reset Request</h2><p>Hi {{user_name}},</p><p>We received a request to reset your password. Click the button below to create a new password:</p><p><a href="{{reset_link}}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p><p>If you didn\'t request this, please ignore this email.</p><p>This link will expire in 1 hour for security.</p>',
            status: 'active',
            language: 'en',
            priority: 'urgent',
            from_email: 'security@africandeals.com',
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            created_by: req.user.id,
            usage_count: 567,
            open_rate: 92.3,
            click_rate: 78.9
        },
        {
            id: 4,
            name: 'Shipping Confirmation',
            type: 'transactional',
            subject: 'Your Order #{{order_id}} Has Shipped - {{site_name}}',
            content: '<h2>Your Order Has Shipped!</h2><p>Hello {{user_name}},</p><p>Great news! Your order #{{order_id}} has been shipped and is on its way to you.</p><p>Tracking Number: {{tracking_number}}<br>Estimated Delivery: {{delivery_date}}</p><p>You can track your package here: <a href="{{tracking_link}}">Track Package</a></p><br><p>Thank you for shopping with us!</p>',
            status: 'active',
            language: 'en',
            priority: 'high',
            from_email: 'shipping@africandeals.com',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            created_by: req.user.id,
            usage_count: 2890,
            open_rate: 88.7,
            click_rate: 62.1
        }
    ];

    // Filter templates based on query parameters
    let filteredTemplates = [...mockTemplates];
    
    if (type) {
        filteredTemplates = filteredTemplates.filter(t => t.type === type);
    }
    
    if (status) {
        filteredTemplates = filteredTemplates.filter(t => t.status === status);
    }
    
    if (language) {
        filteredTemplates = filteredTemplates.filter(t => t.language === language);
    }
    
    if (search) {
        const searchLower = search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(t => 
            t.name.toLowerCase().includes(searchLower) || 
            t.subject.toLowerCase().includes(searchLower)
        );
    }

    res.json({
        success: true,
        message: 'Email templates retrieved successfully',
        templates: filteredTemplates
    });
}));

// Export the router
module.exports = router;