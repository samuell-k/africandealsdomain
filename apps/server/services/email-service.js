/**
 * Email Service Implementation
 * Replaces placeholder email functions with real email sending
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    async init() {
        if (!process.env.EMAIL_HOST) {
            console.warn('⚠️ Email service not configured. Set EMAIL_* environment variables.');
            return;
        }

        this.transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verify connection
        try {
            await this.transporter.verify();
            console.log('✅ Email service initialized successfully');
        } catch (error) {
            console.error('❌ Email service initialization failed:', error.message);
        }
    }

    async sendEmail(to, subject, html, text = null) {
        if (!this.transporter) {
            console.log(`📧 [EMAIL PLACEHOLDER] To: ${to}, Subject: ${subject}`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent successfully to ${to}: ${subject}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    // Agent application confirmation email
    async sendAgentApplicationConfirmation(email, name, applicationId) {
        const subject = 'Agent Application Received - ADD Physical Products';
        const html = `
            <h2>Application Received</h2>
            <p>Dear ${name},</p>
            <p>Thank you for your interest in becoming an agent with ADD Physical Products.</p>
            <p><strong>Application ID:</strong> ${applicationId}</p>
            <p>Your application is currently under review. We will notify you once a decision has been made.</p>
            <p>If you have any questions, please contact our support team.</p>
            <br>
            <p>Best regards,<br>ADD Physical Products Team</p>
        `;
        
        return await this.sendEmail(email, subject, html);
    }

    // Agent application approval email
    async sendAgentApplicationApproval(email, name, agentType) {
        const subject = 'Agent Application Approved - Welcome to ADD Physical Products';
        const html = `
            <h2>Congratulations! Your Application Has Been Approved</h2>
            <p>Dear ${name},</p>
            <p>We are pleased to inform you that your application to become a <strong>${agentType}</strong> has been approved.</p>
            <p>You can now access your agent dashboard and start working with us.</p>
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Log in to your agent dashboard</li>
                <li>Complete your profile setup</li>
                <li>Review the agent guidelines</li>
                <li>Start accepting orders</li>
            </ul>
            <p>Welcome to the ADD Physical Products team!</p>
            <br>
            <p>Best regards,<br>ADD Physical Products Team</p>
        `;
        
        return await this.sendEmail(email, subject, html);
    }

    // Agent application rejection email
    async sendAgentApplicationRejection(email, name, reason = null) {
        const subject = 'Agent Application Update - ADD Physical Products';
        const html = `
            <h2>Application Status Update</h2>
            <p>Dear ${name},</p>
            <p>Thank you for your interest in becoming an agent with ADD Physical Products.</p>
            <p>After careful review, we regret to inform you that we cannot approve your application at this time.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>You are welcome to reapply in the future when circumstances change.</p>
            <p>Thank you for your understanding.</p>
            <br>
            <p>Best regards,<br>ADD Physical Products Team</p>
        `;
        
        return await this.sendEmail(email, subject, html);
    }

    // Order notification emails
    async sendOrderNotification(email, orderDetails) {
        const subject = `Order Update - ${orderDetails.orderNumber}`;
        const html = `
            <h2>Order Status Update</h2>
            <p>Dear Customer,</p>
            <p>Your order <strong>${orderDetails.orderNumber}</strong> has been updated.</p>
            <p><strong>Status:</strong> ${orderDetails.status}</p>
            <p><strong>Total:</strong> $${orderDetails.total}</p>
            <p>You can track your order status in your account dashboard.</p>
            <br>
            <p>Best regards,<br>ADD Physical Products Team</p>
        `;
        
        return await this.sendEmail(email, subject, html);
    }
}

// Export singleton instance
module.exports = new EmailService();
