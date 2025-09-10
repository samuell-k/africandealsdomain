# Email System Usage Guide

## Quick Start

### 1. Import the Mailer
```javascript
const { sendTemplatedEmail } = require('../utils/mailer');
```

### 2. Send an Email
```javascript
try {
  await sendTemplatedEmail(
    'recipient@example.com',
    'Email Subject',
    'template-name',
    {
      // Template variables
      userName: 'John Doe',
      // ... other variables
    }
  );
  console.log('[EMAIL SUCCESS] Email sent successfully');
} catch (error) {
  console.error('[EMAIL ERROR] Failed to send email:', error.message);
  // Don't fail the main operation if email fails
}
```

## Available Templates

### 1. Welcome Email (`welcome`)
**Usage**: New user registration
```javascript
await sendTemplatedEmail(email, subject, 'welcome', {
  userName: 'John Doe',
  userType: 'Buyer', // Buyer, Seller, Agent, Admin
  email: 'user@example.com',
  dashboardUrl: 'https://africandealsdomain.com/buyer/dashboard',
  websiteUrl: 'https://africandealsdomain.com',
  supportUrl: 'https://africandealsdomain.com/support',
  contactUrl: 'https://africandealsdomain.com/contact'
});
```

### 2. Order Confirmation (`order-confirmation`)
**Usage**: Order placement confirmation
```javascript
await sendTemplatedEmail(email, subject, 'order-confirmation', {
  userName: 'John Doe',
  orderNumber: 'ORD-12345',
  orderDate: new Date().toLocaleDateString(),
  orderItems: [
    { name: 'Product 1', quantity: 2, price: 25.99, total: 51.98 }
  ],
  subtotal: '67.48',
  shippingCost: '5.00',
  totalAmount: '72.48',
  currency: '$',
  shippingAddress: { name, address, city, state, zip, country },
  estimatedDelivery: 'Dec 25, 2024',
  orderDetailsUrl: 'https://africandealsdomain.com/buyer/orders/12345',
  trackingUrl: 'https://africandealsdomain.com/buyer/orders/12345/track',
  supportUrl: 'https://africandealsdomain.com/support',
  websiteUrl: 'https://africandealsdomain.com',
  email: 'user@example.com'
});
```

### 3. Payment Confirmation (`payment-confirmation`)
**Usage**: Payment success notification
```javascript
await sendTemplatedEmail(email, subject, 'payment-confirmation', {
  userName: 'John Doe',
  transactionId: 'TXN-67890',
  paymentDate: new Date().toLocaleDateString(),
  paymentMethod: 'Credit Card',
  orderNumber: 'ORD-12345',
  currency: '$',
  totalAmount: '72.48',
  subtotal: '67.48',
  shippingCost: '5.00',
  orderDetailsUrl: 'https://africandealsdomain.com/buyer/orders/12345',
  websiteUrl: 'https://africandealsdomain.com',
  supportUrl: 'https://africandealsdomain.com/support',
  email: 'user@example.com'
});
```

### 4. Order Delivered (`order-delivered`)
**Usage**: Delivery confirmation
```javascript
await sendTemplatedEmail(email, subject, 'order-delivered', {
  userName: 'John Doe',
  orderNumber: 'ORD-12345',
  deliveryDate: new Date().toLocaleDateString(),
  deliveryTime: new Date().toLocaleTimeString(),
  deliveredTo: 'John Doe',
  deliveryAgent: 'Agent Smith',
  agentPhone: '+1234567890',
  orderDate: 'Dec 18, 2024',
  preparedDate: 'Dec 19, 2024',
  shippedDate: 'Dec 22, 2024',
  orderDetailsUrl: 'https://africandealsdomain.com/buyer/orders/12345',
  reviewUrl: 'https://africandealsdomain.com/buyer/orders/12345/review',
  shopAgainUrl: 'https://africandealsdomain.com/products',
  supportUrl: 'https://africandealsdomain.com/support',
  websiteUrl: 'https://africandealsdomain.com',
  email: 'user@example.com'
});
```

### 5. Admin Alert (`admin-alert`)
**Usage**: System notifications for administrators
```javascript
await sendTemplatedEmail('admin@africandealsdomain.com', subject, 'admin-alert', {
  alertType: 'Order', // Order, User, System, Security
  alertTitle: 'New Order Placed',
  alertDescription: 'A new order requires processing.',
  priority: 'medium', // low, medium, high, critical
  timestamp: new Date().toLocaleString(),
  alertId: 'ORD-12345',
  systemModule: 'Order Management',
  eventType: 'Order Placement',
  severityLevel: 'Medium',
  userInfo: {
    userName: 'John Doe',
    userEmail: 'user@example.com',
    userType: 'Buyer',
    userId: '123'
  },
  recommendedActions: [
    'Review order details',
    'Assign delivery agent',
    'Monitor payment status'
  ],
  adminDashboardUrl: 'https://africandealsdomain.com/admin/dashboard',
  reviewUrl: 'https://africandealsdomain.com/admin/orders/12345',
  systemLogsUrl: 'https://africandealsdomain.com/admin/logs',
  supportUrl: 'https://africandealsdomain.com/admin/support'
});
```

### 6. Agent Order Assignment (`agent-order-assigned`)
**Usage**: Order assignment notification for delivery agents
```javascript
await sendTemplatedEmail(agentEmail, subject, 'agent-order-assigned', {
  agentName: 'Agent Smith',
  orderNumber: 'ORD-12345',
  orderDate: new Date().toLocaleDateString(),
  totalAmount: '72.48',
  currency: '$',
  expectedDelivery: 'Dec 25, 2024',
  orderItems: [
    { name: 'Product 1', quantity: 2, price: 25.99, currency: '$' }
  ],
  customerName: 'John Doe',
  customerEmail: 'customer@example.com',
  customerPhone: '+1234567890',
  customerId: '123',
  deliveryName: 'John Doe',
  deliveryAddress: '123 Test Street',
  deliveryCity: 'Test City',
  deliveryState: 'Test State',
  deliveryZip: '12345',
  deliveryCountry: 'Test Country',
  isUrgent: false,
  acceptOrderUrl: 'https://africandealsdomain.com/agent/orders/12345/accept',
  agentDashboardUrl: 'https://africandealsdomain.com/agent/dashboard',
  contactCustomerUrl: 'https://africandealsdomain.com/agent/orders/12345/contact',
  agentSupportUrl: 'https://africandealsdomain.com/agent/support',
  trainingUrl: 'https://africandealsdomain.com/agent/training',
  agentId: '456',
  email: 'agent@example.com'
});
```

### 7. Seller Product Status (`seller-product-status`)
**Usage**: Product approval/rejection notifications
```javascript
// For Approved Products
await sendTemplatedEmail(sellerEmail, subject, 'seller-product-status', {
  sellerName: 'Jane Seller',
  productName: 'Test Product',
  productId: '789',
  productCategory: 'Electronics',
  productPrice: '99.99',
  currency: '$',
  submissionDate: 'Dec 18, 2024',
  reviewDate: new Date().toLocaleDateString(),
  reviewFeedback: 'Your product meets our quality standards.',
  isApproved: true,
  sellerDashboardUrl: 'https://africandealsdomain.com/seller/dashboard',
  productUrl: 'https://africandealsdomain.com/products/789',
  promoteProductUrl: 'https://africandealsdomain.com/seller/products/789/promote',
  sellerSupportUrl: 'https://africandealsdomain.com/seller/support',
  sellerGuideUrl: 'https://africandealsdomain.com/seller/guide',
  sellerId: '321',
  email: 'seller@example.com'
});

// For Rejected Products
await sendTemplatedEmail(sellerEmail, subject, 'seller-product-status', {
  // ... same fields as above, but:
  isRejected: true,
  rejectionReasons: ['Poor image quality', 'Incomplete description'],
  editProductUrl: 'https://africandealsdomain.com/seller/products/789/edit'
});
```

## Best Practices

### 1. Error Handling
Always wrap email sending in try-catch blocks and don't let email failures break your main functionality:

```javascript
try {
  await sendTemplatedEmail(email, subject, template, data);
  console.log('[EMAIL SUCCESS] Email sent to:', email);
} catch (emailErr) {
  console.error('[EMAIL ERROR] Failed to send email:', emailErr.message);
  // Continue with main operation
}
```

### 2. Data Validation
Ensure all required template variables are provided:

```javascript
const emailData = {
  userName: user.name || 'Valued Customer',
  email: user.email,
  // ... other required fields
};

// Validate required fields
if (!emailData.userName || !emailData.email) {
  console.error('[EMAIL ERROR] Missing required email data');
  return;
}

await sendTemplatedEmail(user.email, subject, template, emailData);
```

### 3. Logging
Use consistent logging format:

```javascript
console.log('[EMAIL SUCCESS] Template sent:', template, 'to:', recipient);
console.error('[EMAIL ERROR] Template failed:', template, 'error:', error.message);
```

### 4. Testing
Test email functionality in development:

```javascript
// Run the test script
node test-email-system.js
```

## Common Issues & Solutions

### 1. Template Not Found
**Error**: `Template file not found`
**Solution**: Ensure template file exists in `templates/emails/` directory

### 2. SMTP Connection Failed
**Error**: `SMTP connection failed`
**Solution**: Check email credentials and network connectivity

### 3. Missing Variables
**Error**: Template renders with `{{variableName}}`
**Solution**: Ensure all template variables are provided in the data object

### 4. Email Not Delivered
**Possible Causes**:
- Recipient email in spam folder
- Invalid recipient email address
- SMTP rate limiting
- Email client blocking

## Environment Configuration

Ensure these environment variables are set:

```env
EMAIL_USER=africandealsdomain@gmail.com
EMAIL_PASS=wkou xamx sfbu jtyc
```

## Support

For email system issues:
1. Check the logs for error messages
2. Run the test script to verify functionality
3. Verify SMTP credentials and connection
4. Check template files for syntax errors

---

**Last Updated**: December 2024
**Version**: 1.0.0