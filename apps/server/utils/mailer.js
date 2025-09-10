const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'africandealsdomain@gmail.com',
    pass: 'wkou xamx sfbu jtyc'
  }
};

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send email with HTML template
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text fallback (optional)
 * @returns {Promise} - Email sending result
 */
async function sendEmail(to, subject, html, text = null) {
  try {
    const mailOptions = {
      from: {
        name: 'African Deals Domain',
        address: 'africandealsdomain@gmail.com'
      },
      to: to,
      subject: subject,
      html: html,
      text: text || stripHtml(html)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}: ${subject}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Load and process email template
 * @param {string} templateName - Template file name
 * @param {object} variables - Variables to replace in template
 * @returns {string} - Processed HTML template
 */
function loadTemplate(templateName, variables = {}) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, variables[key] || '');
    });
    
    return template;
  } catch (error) {
    console.error(`❌ Failed to load template ${templateName}:`, error.message);
    return getDefaultTemplate(variables);
  }
}

/**
 * Send templated email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} templateName - Template name
 * @param {object} variables - Template variables
 * @returns {Promise} - Email sending result
 */
async function sendTemplatedEmail(to, subject, templateName, variables = {}) {
  const html = loadTemplate(templateName, variables);
  return await sendEmail(to, subject, html);
}

/**
 * Strip HTML tags for plain text fallback
 * @param {string} html - HTML content
 * @returns {string} - Plain text
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Get default email template
 * @param {object} variables - Template variables
 * @returns {string} - Default HTML template
 */
function getDefaultTemplate(variables = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${variables.subject || 'African Deals Domain'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #0e2038 0%, #23325c 100%); padding: 30px; text-align: center; }
        .logo { width: 60px; height: 60px; margin: 0 auto 15px; background-color: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .brand-name { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🛍️</div>
          <h1 class="brand-name">African Deals Domain</h1>
        </div>
        <div class="content">
          <h2>Hello ${variables.userName || 'Valued Customer'}!</h2>
          <p>${variables.message || 'Thank you for using African Deals Domain.'}</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 African Deals Domain. All rights reserved.</p>
          <p>Empowering Africa's businesses and communities through seamless e-commerce.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Enhanced Agent-Specific Email Functions
 */

/**
 * Send order assignment notification to agent
 */
async function sendOrderAssignmentToAgent(agentEmail, orderData, agentData) {
  const variables = {
    agentName: agentData.name || agentData.username,
    agentType: agentData.agent_type?.replace('_', ' ').toUpperCase(),
    orderNumber: orderData.order_number,
    customerName: orderData.customer_name,
    customerPhone: orderData.customer_phone,
    deliveryAddress: orderData.delivery_address,
    totalAmount: orderData.total_amount,
    orderItems: orderData.items || [],
    estimatedDeliveryTime: orderData.estimated_delivery_time,
    specialInstructions: orderData.special_instructions,
    acceptOrderUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/agent/orders.html?accept=${orderData.order_number}`,
    dashboardUrl: getAgentDashboardUrl(agentData.agent_type),
    date: new Date().toLocaleString()
  };

  const subject = `🚨 New Order Assignment #${orderData.order_number} - ${agentData.agent_type?.replace('_', ' ').toUpperCase()}`;
  
  return await sendTemplatedEmail(
    agentEmail, 
    subject, 
    'agent-order-assigned', 
    variables
  );
}

/**
 * Send delivery completion confirmation to customer
 */
async function sendDeliveryCompletionToCustomer(customerEmail, orderData, agentData) {
  const variables = {
    customerName: orderData.customer_name,
    orderNumber: orderData.order_number,
    agentName: agentData.name,
    agentPhone: agentData.phone,
    deliveryTime: new Date().toLocaleString(),
    totalAmount: orderData.total_amount,
    trackingUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/track/${orderData.order_number}`
  };

  const subject = `✅ Order Delivered Successfully #${orderData.order_number}`;
  
  return await sendTemplatedEmail(
    customerEmail,
    subject,
    'order-delivered',
    variables
  );
}

/**
 * Send agent status change notification
 */
async function sendAgentStatusNotification(agentEmail, statusData) {
  const variables = {
    agentName: statusData.name,
    newStatus: statusData.status,
    statusReason: statusData.reason,
    effectiveDate: new Date().toLocaleString(),
    supportContact: 'support@africandealsdomain.com'
  };

  const subject = `📋 Agent Status Update: ${statusData.status.toUpperCase()}`;
  
  return await sendTemplatedEmail(
    agentEmail,
    subject,
    'agent-status-update',
    variables
  );
}

/**
 * Send commission/earnings report
 */
async function sendEarningsReport(agentEmail, earningsData) {
  const variables = {
    agentName: earningsData.name,
    period: earningsData.period,
    totalOrders: earningsData.totalOrders,
    totalEarnings: earningsData.totalEarnings,
    averageRating: earningsData.averageRating,
    bonusEarnings: earningsData.bonusEarnings,
    nextPaymentDate: earningsData.nextPaymentDate,
    ordersBreakdown: earningsData.ordersBreakdown,
    dashboardUrl: process.env.BASE_URL ? `${process.env.BASE_URL}/agent/earnings.html` : 'http://localhost:3002/agent/earnings.html',
    earningsUrl: process.env.BASE_URL ? `${process.env.BASE_URL}/agent/earnings.html` : 'http://localhost:3002/agent/earnings.html'
  };

  const subject = `💰 Your Earnings Report - ${earningsData.period}`;
  
  return await sendTemplatedEmail(
    agentEmail,
    subject,
    'agent-earnings-report',
    variables
  );
}

/**
 * Send welcome email to new agent
 */
async function sendAgentWelcomeEmail(agentEmail, agentData) {
  const variables = {
    agentName: agentData.name,
    agentType: agentData.agent_type?.replace('_', ' ').toUpperCase(),
    loginUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/auth/auth-agent.html`,
    dashboardUrl: getAgentDashboardUrl(agentData.agent_type),
    supportEmail: 'support@africandealsdomain.com',
    whatsappSupport: '+254700000000' // Replace with actual support number
  };

  const subject = `🎉 Welcome to African Deals Domain - ${agentData.agent_type?.replace('_', ' ')} Agent`;
  
  return await sendTemplatedEmail(
    agentEmail,
    subject,
    'agent-welcome',
    variables
  );
}

/**
 * Send bulk notification to multiple agents
 */
async function sendBulkAgentNotification(agentEmails, subject, templateName, variables = {}) {
  const results = [];
  
  for (const email of agentEmails) {
    try {
      const result = await sendTemplatedEmail(email, subject, templateName, variables);
      results.push({ email, success: true, result });
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({ email, success: false, error: error.message });
    }
  }
  
  console.log(`📧 Bulk notification sent to ${results.filter(r => r.success).length}/${results.length} agents`);
  return results;
}

/**
 * Get dashboard URL for agent type
 */  
function getAgentDashboardUrl(agentType) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  const dashboards = {
    'fast_delivery': '/agent/fast-delivery-agent-complete.html',
    'pickup_delivery': '/agent/pickup-delivery-dashboard.html',
    'pickup_site_manager': '/agent/psm-dashboard.html'
  };
  
  return `${baseUrl}${dashboards[agentType] || '/agent/dashboard.html'}`;
}

/**
 * Test email configuration and send test email
 */
async function testEmailConfiguration(testEmail = 'test@africandealsdomain.com') {
  console.log('\n🧪 Testing Email Configuration...');
  
  try {
    // Test connection
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    
    // Send test email
    const testResult = await sendEmail(
      testEmail,
      '✅ Email System Test - African Deals Domain',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #0e2038 0%, #2d5aa0 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🎉 Email System Test Successful!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">African Deals Domain - Agent Notification System</p>
        </div>
        <div style="padding: 30px;">
          <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <strong>✅ Configuration Working Perfectly!</strong><br>
            Your email system is ready for production use.
          </div>
          <h3>✅ What's Working:</h3>
          <ul>
            <li>SMTP connection established</li>
            <li>Email delivery confirmed</li>
            <li>Template system ready</li>
            <li>Agent notifications configured</li>
          </ul>
          <p style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>Test Time:</strong> ${new Date().toLocaleString()}<br>
            <strong>Provider:</strong> ${process.env.EMAIL_PROVIDER || 'Gmail'}<br>
            <strong>Status:</strong> Fully Operational
          </p>
        </div>
        <div style="background: #0e2038; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">© 2024 African Deals Domain. All rights reserved.</p>
        </div>
      </div>
      `
    );

    if (testResult.success) {
      console.log(`✅ Test email sent successfully to: ${testEmail}`);
      console.log(`📨 Message ID: ${testResult.messageId}`);
      return { success: true, messageId: testResult.messageId };
    } else {
      console.log('❌ Test email failed');
      return { success: false, error: testResult.error };
    }

  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  sendTemplatedEmail,
  loadTemplate,
  // Enhanced Agent Functions
  sendOrderAssignmentToAgent,
  sendDeliveryCompletionToCustomer,
  sendAgentStatusNotification,
  sendEarningsReport,
  sendAgentWelcomeEmail,
  sendBulkAgentNotification,
  testEmailConfiguration,
  getAgentDashboardUrl
};