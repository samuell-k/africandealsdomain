/**
 * Enhanced Email System for Agent Notifications
 * Production-ready SMTP with multiple providers, queuing, and agent-specific templates
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class EnhancedMailer {
    constructor() {
        this.transporter = null;
        this.emailQueue = [];
        this.isProcessingQueue = false;
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds
        
        this.config = this.loadConfiguration();
        this.initialize();
    }

    /**
     * Load email configuration with multiple provider support
     */
    loadConfiguration() {
        // Priority: Environment variables -> Default Gmail setup
        const config = {
            provider: process.env.EMAIL_PROVIDER || 'gmail',
            
            // Gmail Configuration
            gmail: {
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER || 'africandealsdomain@gmail.com',
                    pass: process.env.GMAIL_APP_PASSWORD || 'wkou xamx sfbu jtyc'
                }
            },

            // Outlook/Hotmail Configuration
            outlook: {
                service: 'hotmail',
                auth: {
                    user: process.env.OUTLOOK_USER || '',
                    pass: process.env.OUTLOOK_PASSWORD || ''
                }
            },

            // Custom SMTP Configuration
            smtp: {
                host: process.env.SMTP_HOST || '',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true' || false,
                auth: {
                    user: process.env.SMTP_USER || '',
                    pass: process.env.SMTP_PASSWORD || ''
                }
            },

            // SendGrid Configuration
            sendgrid: {
                host: 'smtp.sendgrid.net',
                port: 587,
                secure: false,
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY || ''
                }
            },

            // Mailgun Configuration
            mailgun: {
                host: 'smtp.mailgun.org',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.MAILGUN_USER || '',
                    pass: process.env.MAILGUN_PASSWORD || ''
                }
            },

            // Default sender info
            sender: {
                name: process.env.EMAIL_SENDER_NAME || 'African Deals Domain',
                address: process.env.EMAIL_SENDER_ADDRESS || 'africandealsdomain@gmail.com'
            }
        };

        return config;
    }

    /**
     * Initialize email transporter
     */
    async initialize() {
        try {
            const selectedConfig = this.config[this.config.provider];
            
            if (!selectedConfig) {
                throw new Error(`Email provider '${this.config.provider}' not configured`);
            }

            this.transporter = nodemailer.createTransport(selectedConfig);
            
            // Verify connection (but don't fail if it doesn't work immediately)
            try {
                await this.verifyConnection();
                console.log(`✅ Enhanced Email System ready with ${this.config.provider.toUpperCase()}`);
            } catch (verifyError) {
                console.log(`⚠️ Email system initialized but connection verification failed: ${verifyError.message}`);
                console.log('💡 Emails may still work, but check your configuration');
            }
            
            // Start queue processor
            this.startQueueProcessor();
            
        } catch (error) {
            console.error('❌ Email system initialization failed:', error.message);
            console.log('💡 Tip: Check your email configuration in .env file');
            
            // Fallback to default configuration
            await this.initializeFallback();
        }
    }

    /**
     * Fallback initialization with current working config
     */
    async initializeFallback() {
        console.log('🔄 Attempting fallback email configuration...');
        
        try {
            const fallbackConfig = {
                service: 'gmail',
                auth: {
                    user: 'africandealsdomain@gmail.com',
                    pass: 'wkou xamx sfbu jtyc'
                }
            };

            this.transporter = nodemailer.createTransport(fallbackConfig);
            
            try {
                await this.verifyConnection();
                console.log('✅ Fallback email configuration successful');
            } catch (verifyError) {
                console.log('⚠️ Fallback configuration created but verification failed');
                console.log('💡 Emails may still work during actual sending');
            }
        } catch (error) {
            console.error('❌ Fallback email configuration failed:', error.message);
            console.log('💡 Creating basic transporter without verification');
            
            // Create basic transporter as last resort
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'africandealsdomain@gmail.com',
                    pass: 'wkou xamx sfbu jtyc'
                }
            });
        }
    }

    /**
     * Verify email connection
     */
    async verifyConnection() {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized');
        }

        return new Promise((resolve, reject) => {
            this.transporter.verify((error, success) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(success);
                }
            });
        });
    }

    /**
     * Send email with enhanced error handling and retry logic
     */
    async sendEmail(to, subject, html, text = null, priority = 'normal') {
        const emailData = {
            to,
            subject,
            html,
            text: text || this.stripHtml(html),
            priority,
            attempts: 0,
            timestamp: new Date()
        };

        if (priority === 'high') {
            // Send immediately for high priority emails
            return await this.processSingleEmail(emailData);
        } else {
            // Add to queue for normal priority
            this.emailQueue.push(emailData);
            console.log(`📧 Email queued for ${to}: ${subject}`);
            return { success: true, queued: true };
        }
    }

    /**
     * Process a single email with retry logic
     */
    async processSingleEmail(emailData) {
        const { to, subject, html, text, attempts = 0 } = emailData;

        try {
            const mailOptions = {
                from: {
                    name: this.config.sender.name,
                    address: this.config.sender.address
                },
                to: to,
                subject: subject,
                html: html,
                text: text
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent successfully to ${to}: ${subject}`);
            
            return { 
                success: true, 
                messageId: result.messageId,
                attempts: attempts + 1
            };

        } catch (error) {
            console.error(`❌ Email send failed (attempt ${attempts + 1}): ${error.message}`);
            
            if (attempts < this.retryAttempts) {
                console.log(`🔄 Retrying email to ${to} in ${this.retryDelay/1000} seconds...`);
                
                await this.delay(this.retryDelay);
                emailData.attempts = attempts + 1;
                return await this.processSingleEmail(emailData);
            } else {
                console.error(`❌ Email to ${to} failed after ${this.retryAttempts} attempts`);
                return { 
                    success: false, 
                    error: error.message,
                    attempts: attempts + 1
                };
            }
        }
    }

    /**
     * Start queue processor for background email sending
     */
    startQueueProcessor() {
        if (this.isProcessingQueue) return;

        this.isProcessingQueue = true;
        
        const processQueue = async () => {
            while (this.emailQueue.length > 0) {
                const emailData = this.emailQueue.shift();
                await this.processSingleEmail(emailData);
                
                // Small delay between emails to avoid rate limiting
                await this.delay(1000);
            }
            
            this.isProcessingQueue = false;
            
            // Check again in 10 seconds
            setTimeout(() => {
                if (this.emailQueue.length > 0) {
                    this.startQueueProcessor();
                }
            }, 10000);
        };

        processQueue().catch(error => {
            console.error('❌ Queue processor error:', error);
            this.isProcessingQueue = false;
        });
    }

    /**
     * Load and process email template with enhanced variable replacement
     */
    loadTemplate(templateName, variables = {}) {
        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);
            
            if (!fs.existsSync(templatePath)) {
                console.warn(`⚠️ Template ${templateName} not found, using default`);
                return this.getDefaultTemplate(variables);
            }

            let template = fs.readFileSync(templatePath, 'utf8');
            
            // Enhanced variable replacement with nested object support
            template = this.processTemplateVariables(template, variables);
            
            return template;
            
        } catch (error) {
            console.error(`❌ Failed to load template ${templateName}:`, error.message);
            return this.getDefaultTemplate(variables);
        }
    }

    /**
     * Process template variables with nested object support
     */
    processTemplateVariables(template, variables) {
        // Simple variable replacement {{variable}}
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, variables[key] || '');
        });

        // Nested object support {{object.property}}
        const nestedRegex = /{{([^}]+)}}/g;
        template = template.replace(nestedRegex, (match, path) => {
            const value = this.getNestedValue(variables, path);
            return value !== undefined ? value : match;
        });

        // Date formatting {{date|format}}
        template = template.replace(/{{date\|([^}]+)}}/g, (match, format) => {
            return this.formatDate(new Date(), format);
        });

        return template;
    }

    /**
     * Get nested object value by path
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    /**
     * Format date for templates
     */
    formatDate(date, format) {
        const options = {
            'short': { year: 'numeric', month: 'short', day: 'numeric' },
            'long': { year: 'numeric', month: 'long', day: 'numeric' },
            'full': { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        };

        return date.toLocaleDateString('en-US', options[format] || options.short);
    }

    /**
     * Send templated email
     */
    async sendTemplatedEmail(to, subject, templateName, variables = {}, priority = 'normal') {
        const html = this.loadTemplate(templateName, variables);
        return await this.sendEmail(to, subject, html, null, priority);
    }

    // === AGENT-SPECIFIC EMAIL FUNCTIONS ===

    /**
     * Send order assignment notification to agent
     */
    async sendOrderAssignmentToAgent(agentEmail, orderData, agentData) {
        const variables = {
            agentName: agentData.name || agentData.username,
            agentType: agentData.agent_type,
            orderNumber: orderData.order_number,
            customerName: orderData.customer_name,
            customerPhone: orderData.customer_phone,
            deliveryAddress: orderData.delivery_address,
            totalAmount: orderData.total_amount,
            orderItems: orderData.items,
            estimatedDeliveryTime: orderData.estimated_delivery_time,
            specialInstructions: orderData.special_instructions,
            date: new Date()
        };

        const subject = `New Order Assignment #${orderData.order_number} - ${agentData.agent_type.replace('_', ' ').toUpperCase()}`;
        
        return await this.sendTemplatedEmail(
            agentEmail, 
            subject, 
            'agent-order-assigned', 
            variables,
            'high' // High priority for order assignments
        );
    }

    /**
     * Send delivery completion confirmation
     */
    async sendDeliveryCompletionToCustomer(customerEmail, orderData, agentData) {
        const variables = {
            customerName: orderData.customer_name,
            orderNumber: orderData.order_number,
            agentName: agentData.name,
            agentPhone: agentData.phone,
            deliveryTime: new Date().toLocaleString(),
            totalAmount: orderData.total_amount,
            trackingUrl: `${process.env.BASE_URL}/track/${orderData.order_number}`
        };

        const subject = `Order Delivered Successfully #${orderData.order_number}`;
        
        return await this.sendTemplatedEmail(
            customerEmail,
            subject,
            'order-delivered',
            variables
        );
    }

    /**
     * Send agent status change notification
     */
    async sendAgentStatusNotification(agentEmail, statusData) {
        const variables = {
            agentName: statusData.name,
            newStatus: statusData.status,
            statusReason: statusData.reason,
            effectiveDate: new Date(),
            supportContact: 'support@africandealsdomain.com'
        };

        const subject = `Agent Status Update: ${statusData.status.toUpperCase()}`;
        
        return await this.sendTemplatedEmail(
            agentEmail,
            subject,
            'agent-status-update',
            variables
        );
    }

    /**
     * Send commission/earnings report
     */
    async sendEarningsReport(agentEmail, earningsData) {
        const variables = {
            agentName: earningsData.name,
            period: earningsData.period,
            totalOrders: earningsData.totalOrders,
            totalEarnings: earningsData.totalEarnings,
            averageRating: earningsData.averageRating,
            bonusEarnings: earningsData.bonusEarnings,
            nextPaymentDate: earningsData.nextPaymentDate,
            ordersBreakdown: earningsData.ordersBreakdown
        };

        const subject = `Your Earnings Report - ${earningsData.period}`;
        
        return await this.sendTemplatedEmail(
            agentEmail,
            subject,
            'agent-earnings-report',
            variables
        );
    }

    /**
     * Send welcome email to new agent
     */
    async sendAgentWelcomeEmail(agentEmail, agentData) {
        const variables = {
            agentName: agentData.name,
            agentType: agentData.agent_type.replace('_', ' ').toUpperCase(),
            loginUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/auth/auth-agent.html`,
            dashboardUrl: this.getAgentDashboardUrl(agentData.agent_type),
            supportEmail: 'support@africandealsdomain.com',
            whatsappSupport: '+1234567890' // Replace with actual support number
        };

        const subject = `Welcome to African Deals Domain - ${agentData.agent_type.replace('_', ' ')} Agent`;
        
        return await this.sendTemplatedEmail(
            agentEmail,
            subject,
            'agent-welcome',
            variables,
            'high'
        );
    }

    /**
     * Get dashboard URL for agent type
     */
    getAgentDashboardUrl(agentType) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
        const dashboards = {
            'fast_delivery': '/agent/fast-delivery-agent-complete.html',
            'pickup_delivery': '/agent/pickup-delivery-dashboard.html',
            'pickup_site_manager': '/agent/pickup-site-manager-dashboard.html'
        };
        
        return `${baseUrl}${dashboards[agentType] || '/agent/dashboard.html'}`;
    }

    /**
     * Send bulk notification to all agents
     */
    async sendBulkAgentNotification(agentEmails, subject, templateName, variables = {}) {
        const results = [];
        
        for (const email of agentEmails) {
            try {
                const result = await this.sendTemplatedEmail(email, subject, templateName, variables);
                results.push({ email, success: true, result });
            } catch (error) {
                results.push({ email, success: false, error: error.message });
            }
            
            // Small delay between bulk emails
            await this.delay(500);
        }
        
        console.log(`📧 Bulk notification sent to ${results.filter(r => r.success).length}/${results.length} agents`);
        return results;
    }

    /**
     * Test email configuration
     */
    async testEmailConfiguration() {
        console.log('\n🧪 Testing Email Configuration...');
        
        const testEmail = process.env.TEST_EMAIL || 'test@africandealsdomain.com';
        const testResult = await this.sendEmail(
            testEmail,
            '✅ Email System Test - African Deals Domain',
            `
            <h2 style="color: #0e2038;">Email System Test Successful! 🎉</h2>
            <p>This confirms that your email configuration is working correctly.</p>
            <p><strong>Provider:</strong> ${this.config.provider.toUpperCase()}</p>
            <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>System:</strong> African Deals Domain Agent Notification System</p>
            <hr>
            <p style="color: #666; font-size: 14px;">This is an automated test email.</p>
            `,
            null,
            'high'
        );

        if (testResult.success) {
            console.log('✅ Email system test PASSED');
            console.log(`   📧 Test email sent to: ${testEmail}`);
            console.log(`   📨 Message ID: ${testResult.messageId}`);
        } else {
            console.log('❌ Email system test FAILED');
            console.log(`   Error: ${testResult.error}`);
        }

        return testResult;
    }

    // === UTILITY METHODS ===

    /**
     * Strip HTML tags for plain text
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Delay function for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.emailQueue.length,
            isProcessing: this.isProcessingQueue,
            provider: this.config.provider
        };
    }

    /**
     * Get default template for fallback
     */
    getDefaultTemplate(variables = {}) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${variables.subject || 'African Deals Domain'}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #0e2038 0%, #23325c 100%); padding: 30px; text-align: center; }
                .logo { font-size: 32px; margin-bottom: 10px; }
                .brand-name { color: #ffffff; font-size: 24px; font-weight: bold; margin: 0; }
                .content { padding: 40px 30px; }
                .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
                .btn { background-color: #0e2038; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🛍️</div>
                    <h1 class="brand-name">African Deals Domain</h1>
                </div>
                <div class="content">
                    <h2>Hello ${variables.userName || variables.agentName || 'Valued Partner'}!</h2>
                    <p>${variables.message || 'Thank you for being part of the African Deals Domain family.'}</p>
                    ${variables.actionUrl ? `<a href="${variables.actionUrl}" class="btn">Take Action</a>` : ''}
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
}

// Create singleton instance
const enhancedMailer = new EnhancedMailer();

module.exports = enhancedMailer;