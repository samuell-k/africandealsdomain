/**
 * Delivery Method Notifications
 * Handles email notifications for delivery method selection and updates
 */
 
const { sendTemplatedEmail } = require('./mailer');

class DeliveryNotifications {
  
  /**
   * Send delivery method confirmation email
   */
  static async sendDeliveryMethodConfirmation(orderData, deliveryData, userEmail) {
    try {
      const isPickup = deliveryData.method === 'pickup';
      
      const emailData = {
        to: userEmail,
        subject: `Delivery Method Confirmed - Order ${orderData.orderNumber}`,
        template: 'delivery-method-confirmation',
        data: {
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName || 'Valued Customer',
          deliveryMethod: deliveryData.method,
          isPickup: isPickup,
          isHomeDelivery: !isPickup,
          
          // Pickup specific data
          pickupSiteName: deliveryData.pickupSiteName || '',
          pickupAddress: deliveryData.pickupAddress || '',
          pickupInstructions: 'Please bring a valid ID for pickup verification.',
          
          // Home delivery specific data
          homeAddress: deliveryData.homeAddress || '',
          deliveryFee: deliveryData.deliveryFee || 0,
          estimatedDelivery: deliveryData.estimatedDelivery || 'Within 3-5 business days',
          
          // Order summary
          orderItems: orderData.items || [],
          subtotal: orderData.subtotal || 0,
          totalAmount: orderData.total || 0,
          
          // Company info
          companyName: 'African Deals Domain',
          supportEmail: 'support@addphysicalproducts.com',
          supportPhone: '+234-800-ADD-HELP',
          websiteUrl: 'https://addphysicalproducts.com'
        }
      };
      
      // mailer.sendTemplatedEmail expects (to, subject, templateName, variables)
      await sendTemplatedEmail(
        emailData.to,
        emailData.subject,
        emailData.template,
        emailData.data
      );
      console.log(`✅ Delivery method confirmation email sent to ${userEmail}`);
      
    } catch (error) {
      console.error('❌ Failed to send delivery method confirmation email:', error);
      throw error;
    }
  }
  
  /**
   * Send pickup ready notification
   */
  static async sendPickupReadyNotification(orderData, pickupSiteData, userEmail) {
    try {
      const emailData = {
        to: userEmail,
        subject: `Your Order is Ready for Pickup - ${orderData.orderNumber}`,
        template: 'pickup-ready-notification',
        data: {
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName || 'Valued Customer',
          pickupSiteName: pickupSiteData.name,
          pickupAddress: pickupSiteData.address,
          pickupPhone: pickupSiteData.phone,
          pickupHours: pickupSiteData.operatingHours || 'Monday - Friday: 9AM - 6PM',
          pickupCode: orderData.pickupCode || orderData.orderNumber,
          requiredDocuments: 'Valid ID and order confirmation',
          expiryDate: orderData.pickupExpiryDate || 'Within 7 days',
          
          companyName: 'African Deals Domain',
          supportEmail: 'support@addphysicalproducts.com',
          supportPhone: '+234-800-ADD-HELP'
        }
      };
      
      await sendTemplatedEmail(
        emailData.to,
        emailData.subject,
        emailData.template,
        emailData.data
      );
      console.log(`✅ Pickup ready notification sent to ${userEmail}`);
      
    } catch (error) {
      console.error('❌ Failed to send pickup ready notification:', error);
      throw error;
    }
  }
  
  /**
   * Send home delivery tracking notification
   */
  static async sendDeliveryTrackingNotification(orderData, trackingData, userEmail) {
    try {
      const emailData = {
        to: userEmail,
        subject: `Delivery Update - Order ${orderData.orderNumber}`,
        template: 'delivery-tracking-notification',
        data: {
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName || 'Valued Customer',
          trackingStatus: trackingData.status,
          statusMessage: trackingData.message,
          agentName: trackingData.agentName || 'Delivery Agent',
          agentPhone: trackingData.agentPhone || '',
          estimatedArrival: trackingData.estimatedArrival || '',
          deliveryAddress: orderData.deliveryAddress || '',
          trackingUrl: `https://addphysicalproducts.com/buyer/track-order.html?order=${orderData.orderNumber}`,
          
          companyName: 'African Deals Domain',
          supportEmail: 'support@addphysicalproducts.com',
          supportPhone: '+234-800-ADD-HELP'
        }
      };
      
      await sendTemplatedEmail(
        emailData.to,
        emailData.subject,
        emailData.template,
        emailData.data
      );
      console.log(`✅ Delivery tracking notification sent to ${userEmail}`);
      
    } catch (error) {
      console.error('❌ Failed to send delivery tracking notification:', error);
      throw error;
    }
  }
  
  /**
   * Send delivery method change notification
   */
  static async sendDeliveryMethodChangeNotification(orderData, oldMethod, newMethod, userEmail) {
    try {
      const emailData = {
        to: userEmail,
        subject: `Delivery Method Updated - Order ${orderData.orderNumber}`,
        template: 'delivery-method-change',
        data: {
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName || 'Valued Customer',
          oldDeliveryMethod: oldMethod,
          newDeliveryMethod: newMethod,
          changeReason: orderData.changeReason || 'Customer request',
          effectiveDate: new Date().toLocaleDateString(),
          
          companyName: 'African Deals Domain',
          supportEmail: 'support@addphysicalproducts.com',
          supportPhone: '+234-800-ADD-HELP'
        }
      };
      
      await sendTemplatedEmail(
        emailData.to,
        emailData.subject,
        emailData.template,
        emailData.data
      );
      console.log(`✅ Delivery method change notification sent to ${userEmail}`);
      
    } catch (error) {
      console.error('❌ Failed to send delivery method change notification:', error);
      throw error;
    }
  }
  
  /**
   * Send admin notification for delivery method selections
   */
  static async sendAdminDeliveryNotification(orderData, deliveryData) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@addphysicalproducts.com';
      
      const emailData = {
        to: adminEmail,
        subject: `New Order with ${deliveryData.method} Delivery - ${orderData.orderNumber}`,
        template: 'admin-delivery-notification',
        data: {
          orderNumber: orderData.orderNumber,
          customerEmail: orderData.customerEmail,
          deliveryMethod: deliveryData.method,
          orderValue: orderData.total,
          pickupSiteId: deliveryData.pickupSiteId || null,
          deliveryAddress: deliveryData.homeAddress || null,
          deliveryFee: deliveryData.deliveryFee || 0,
          orderDate: new Date().toLocaleDateString(),
          
          dashboardUrl: 'https://addphysicalproducts.com/admin/orders.html'
        }
      };
      
      await sendTemplatedEmail(
        emailData.to,
        emailData.subject,
        emailData.template,
        emailData.data
      );
      console.log(`✅ Admin delivery notification sent for order ${orderData.orderNumber}`);
      
    } catch (error) {
      console.error('❌ Failed to send admin delivery notification:', error);
      // Don't throw error for admin notifications to avoid blocking user flow
    }
  }
}

module.exports = DeliveryNotifications;