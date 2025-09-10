/**
 * PDA Logistics Service
 * Handles comprehensive order tracking, dual confirmations, GPS validation, 
 * OTP/QR generation, notifications, and payout management
 */

const pool = require('../db');
const crypto = require('crypto');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

class PDALogisticsService {
  constructor() {
    this.ORDER_STATUSES = {
      ORDER_PLACED: 'ORDER_PLACED',
      PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED', 
      ASSIGNED_TO_PDA: 'ASSIGNED_TO_PDA',
      PDA_EN_ROUTE_TO_SELLER: 'PDA_EN_ROUTE_TO_SELLER',
      PDA_AT_SELLER: 'PDA_AT_SELLER',
      PICKED_FROM_SELLER: 'PICKED_FROM_SELLER',
      EN_ROUTE_TO_PSM: 'EN_ROUTE_TO_PSM',
      DELIVERED_TO_PSM: 'DELIVERED_TO_PSM',
      READY_FOR_PICKUP: 'READY_FOR_PICKUP',
      EN_ROUTE_TO_BUYER: 'EN_ROUTE_TO_BUYER',
      DELIVERED_TO_BUYER: 'DELIVERED_TO_BUYER',
      COLLECTED_BY_BUYER: 'COLLECTED_BY_BUYER',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      DISPUTED: 'DISPUTED'
    };

    this.CONFIRMATION_TYPES = {
      SELLER_HANDOVER: 'SELLER_HANDOVER',
      PSM_DEPOSIT: 'PSM_DEPOSIT',
      BUYER_DELIVERY: 'BUYER_DELIVERY',
      BUYER_PICKUP: 'BUYER_PICKUP'
    };

    this.NOTIFICATION_TYPES = {
      ORDER_PLACED: 'ORDER_PLACED',
      PAYMENT_PENDING: 'PAYMENT_PENDING',
      PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
      AGENT_ASSIGNED: 'AGENT_ASSIGNED',
      PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
      EN_ROUTE_TO_SELLER: 'EN_ROUTE_TO_SELLER',
      PICKED_FROM_SELLER: 'PICKED_FROM_SELLER',
      EN_ROUTE_TO_PSM: 'EN_ROUTE_TO_PSM',
      DELIVERED_TO_PSM: 'DELIVERED_TO_PSM',
      READY_FOR_PICKUP: 'READY_FOR_PICKUP',
      EN_ROUTE_TO_BUYER: 'EN_ROUTE_TO_BUYER',
      DELIVERED_TO_BUYER: 'DELIVERED_TO_BUYER',
      ORDER_COMPLETED: 'ORDER_COMPLETED',
      PAYOUT_RELEASED: 'PAYOUT_RELEASED',
      COMMISSION_RELEASED: 'COMMISSION_RELEASED',
      EXCEPTION_OCCURRED: 'EXCEPTION_OCCURRED',
      ADMIN_ATTENTION_REQUIRED: 'ADMIN_ATTENTION_REQUIRED'
    };
  }

  /**
   * Initialize an order in the PDA logistics system
   */
  async initializeOrder(orderId, orderData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update order with PDA logistics fields
      await connection.execute(`
        UPDATE orders SET 
          detailed_status = ?,
          delivery_method = ?,
          pickup_site_id = ?,
          delivery_address = ?,
          delivery_coordinates = ?,
          delivery_distance = ?,
          delivery_notes = ?
        WHERE id = ?
      `, [
        this.ORDER_STATUSES.ORDER_PLACED,
        orderData.delivery_method || 'pickup',
        orderData.pickup_site_id || null,
        orderData.delivery_address ? JSON.stringify(orderData.delivery_address) : null,
        orderData.delivery_coordinates ? JSON.stringify(orderData.delivery_coordinates) : null,
        orderData.delivery_distance || null,
        orderData.delivery_notes || null,
        orderId
      ]);

      // Create initial status history entry
      await this.createStatusHistory(connection, orderId, null, this.ORDER_STATUSES.ORDER_PLACED, orderData.user_id, 'Order created');

      // Generate QR code for the order
      await this.generateOrderQR(connection, orderId, 'ORDER_RECEIPT', 'system');

      // Send initial notifications
      await this.sendOrderNotification(connection, orderId, this.NOTIFICATION_TYPES.ORDER_PLACED);

      await connection.commit();
      console.log(`[PDA-LOGISTICS] Order ${orderId} initialized successfully`);
      return { success: true, orderId };

    } catch (error) {
      await connection.rollback();
      console.error('[PDA-LOGISTICS] Error initializing order:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Transition order status with validations
   */
  async transitionOrderStatus(orderId, newStatus, userId, options = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current order status
      const [orders] = await connection.execute(
        'SELECT detailed_status, delivery_method, agent_id FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const currentStatus = orders[0].detailed_status;
      const deliveryMethod = orders[0].delivery_method;

      // Validate status transition
      if (!this.isValidStatusTransition(currentStatus, newStatus, deliveryMethod)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }

      // Update order status
      await connection.execute(
        'UPDATE orders SET detailed_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, orderId]
      );

      // Create status history
      await this.createStatusHistory(
        connection, orderId, currentStatus, newStatus, userId, 
        options.reason, options.location, options.metadata
      );

      // Handle special status logic
      await this.handleStatusSpecialLogic(connection, orderId, newStatus, options);

      // Send notifications
      await this.sendStatusChangeNotifications(connection, orderId, newStatus);

      await connection.commit();
      console.log(`[PDA-LOGISTICS] Order ${orderId} status changed: ${currentStatus} -> ${newStatus}`);
      
      return { 
        success: true, 
        orderId, 
        fromStatus: currentStatus, 
        toStatus: newStatus 
      };

    } catch (error) {
      await connection.rollback();
      console.error('[PDA-LOGISTICS] Error transitioning status:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Validate if status transition is allowed
   */
  isValidStatusTransition(fromStatus, toStatus, deliveryMethod) {
    const pickupTransitions = {
      [this.ORDER_STATUSES.ORDER_PLACED]: [this.ORDER_STATUSES.PAYMENT_CONFIRMED, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PAYMENT_CONFIRMED]: [this.ORDER_STATUSES.ASSIGNED_TO_PDA, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.ASSIGNED_TO_PDA]: [this.ORDER_STATUSES.PDA_EN_ROUTE_TO_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PDA_EN_ROUTE_TO_SELLER]: [this.ORDER_STATUSES.PDA_AT_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PDA_AT_SELLER]: [this.ORDER_STATUSES.PICKED_FROM_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PICKED_FROM_SELLER]: [this.ORDER_STATUSES.EN_ROUTE_TO_PSM, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.EN_ROUTE_TO_PSM]: [this.ORDER_STATUSES.DELIVERED_TO_PSM, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.DELIVERED_TO_PSM]: [this.ORDER_STATUSES.READY_FOR_PICKUP],
      [this.ORDER_STATUSES.READY_FOR_PICKUP]: [this.ORDER_STATUSES.COLLECTED_BY_BUYER],
      [this.ORDER_STATUSES.COLLECTED_BY_BUYER]: [this.ORDER_STATUSES.COMPLETED]
    };

    const homeTransitions = {
      [this.ORDER_STATUSES.ORDER_PLACED]: [this.ORDER_STATUSES.PAYMENT_CONFIRMED, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PAYMENT_CONFIRMED]: [this.ORDER_STATUSES.ASSIGNED_TO_PDA, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.ASSIGNED_TO_PDA]: [this.ORDER_STATUSES.PDA_EN_ROUTE_TO_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PDA_EN_ROUTE_TO_SELLER]: [this.ORDER_STATUSES.PDA_AT_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PDA_AT_SELLER]: [this.ORDER_STATUSES.PICKED_FROM_SELLER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.PICKED_FROM_SELLER]: [this.ORDER_STATUSES.EN_ROUTE_TO_BUYER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.EN_ROUTE_TO_BUYER]: [this.ORDER_STATUSES.DELIVERED_TO_BUYER, this.ORDER_STATUSES.CANCELLED],
      [this.ORDER_STATUSES.DELIVERED_TO_BUYER]: [this.ORDER_STATUSES.COMPLETED]
    };

    const transitions = deliveryMethod === 'home' ? homeTransitions : pickupTransitions;
    return transitions[fromStatus] && transitions[fromStatus].includes(toStatus);
  }

  /**
   * Handle special logic for certain status transitions
   */
  async handleStatusSpecialLogic(connection, orderId, newStatus, options) {
    switch (newStatus) {
      case this.ORDER_STATUSES.PAYMENT_CONFIRMED:
        // Request admin approval for manual payments
        if (options.manualPayment) {
          await this.createAdminApproval(connection, orderId, 'MANUAL_PAYMENT', options.userId);
        }
        break;

      case this.ORDER_STATUSES.DELIVERED_TO_PSM:
        // Release seller payout if configured
        const [settings] = await connection.execute(
          "SELECT setting_value FROM pda_platform_settings WHERE setting_key = 'seller_payout_on_psm_deposit'"
        );
        if (settings[0]?.setting_value === 'true') {
          await this.releasePayout(connection, orderId, 'SELLER_PAYOUT', options.userId);
        }
        break;

      case this.ORDER_STATUSES.DELIVERED_TO_BUYER:
      case this.ORDER_STATUSES.COLLECTED_BY_BUYER:
        // Release PDA commission
        await this.releasePayout(connection, orderId, 'PDA_COMMISSION', options.userId);
        break;

      case this.ORDER_STATUSES.COMPLETED:
        // Final order completion logic
        await this.completeOrder(connection, orderId);
        break;
    }
  }

  /**
   * Generate and store OTP code
   */
  async generateOTP(orderId, confirmationType, forRole, forUserId) {
    const connection = await pool.getConnection();
    try {
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes expiry

      await connection.execute(`
        INSERT INTO order_otp_codes 
        (order_id, confirmation_type, otp_code, generated_for_role, generated_for_user_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [orderId, confirmationType, otpCode, forRole, forUserId, expiresAt]);

      console.log(`[PDA-LOGISTICS] OTP generated for order ${orderId}: ${otpCode}`);
      return otpCode;

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error generating OTP:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(orderId, otpCode, confirmationType, userId) {
    const connection = await pool.getConnection();
    try {
      const [otps] = await connection.execute(`
        SELECT * FROM order_otp_codes 
        WHERE order_id = ? AND otp_code = ? AND confirmation_type = ? 
        AND is_used = FALSE AND expires_at > NOW()
      `, [orderId, otpCode, confirmationType]);

      if (otps.length === 0) {
        return { valid: false, reason: 'Invalid or expired OTP' };
      }

      // Mark OTP as used
      await connection.execute(`
        UPDATE order_otp_codes 
        SET is_used = TRUE, used_by = ?, used_at = NOW()
        WHERE id = ?
      `, [userId, otps[0].id]);

      return { valid: true, otp: otps[0] };

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error verifying OTP:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Generate QR code for order
   */
  async generateOrderQR(connection, orderId, qrType = 'ORDER_RECEIPT', forRole = 'system') {
    try {
      const qrData = {
        orderId: orderId,
        type: qrType,
        timestamp: Date.now(),
        checksum: crypto.createHash('md5').update(`${orderId}-${qrType}-${Date.now()}`).digest('hex')
      };

      const qrDataString = JSON.stringify(qrData);
      const qrImagePath = path.join(__dirname, '../uploads/qr-codes', `order-${orderId}-${Date.now()}.png`);
      
      // Ensure directory exists
      const qrDir = path.dirname(qrImagePath);
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      // Generate QR code image
      await QRCode.toFile(qrImagePath, qrDataString);
      const qrImageUrl = qrImagePath.replace(path.join(__dirname, '../'), '/');

      // Store in database
      await connection.execute(`
        INSERT INTO order_qr_codes 
        (order_id, qr_code_data, qr_image_url, qr_type, generated_for_role)
        VALUES (?, ?, ?, ?, ?)
      `, [orderId, qrDataString, qrImageUrl, qrType, forRole]);

      console.log(`[PDA-LOGISTICS] QR code generated for order ${orderId}`);
      return { qrData: qrDataString, qrImageUrl };

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Validate GPS location within radius
   */
  async validateGPSLocation(orderId, userLat, userLng, accuracy, expectedLocation) {
    try {
      const [settings] = await pool.execute(
        "SELECT setting_value FROM pda_platform_settings WHERE setting_key = 'gps_radius_tolerance'"
      );
      
      const toleranceMeters = parseInt(settings[0]?.setting_value || '100');
      
      // Calculate distance using Haversine formula
      const distance = this.calculateDistance(
        userLat, userLng, 
        expectedLocation.lat, expectedLocation.lng
      );

      const withinRadius = distance <= (toleranceMeters / 1000); // Convert to km

      // Store GPS tracking data
      await pool.execute(`
        INSERT INTO order_gps_tracking 
        (order_id, tracked_user_id, latitude, longitude, accuracy, status_at_time)
        VALUES (?, ?, ?, ?, ?, (SELECT detailed_status FROM orders WHERE id = ?))
      `, [orderId, 1, userLat, userLng, accuracy, orderId]); // TODO: Get actual user ID

      return {
        withinRadius,
        distance: Math.round(distance * 1000), // Return in meters
        tolerance: toleranceMeters
      };

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error validating GPS:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  /**
   * Create dual confirmation record
   */
  async createConfirmation(orderId, confirmationType, confirmationMethod, confirmerRole, confirmerUserId, confirmationData, gpsData = null) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        INSERT INTO order_confirmations 
        (order_id, confirmation_type, confirmation_method, confirmer_role, confirmer_user_id, 
         confirmation_data, gps_coordinates, gps_accuracy, within_radius)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId, confirmationType, confirmationMethod, confirmerRole, confirmerUserId,
        JSON.stringify(confirmationData), 
        gpsData ? JSON.stringify(gpsData.coordinates) : null,
        gpsData?.accuracy || null,
        gpsData?.withinRadius ?? true
      ]);

      console.log(`[PDA-LOGISTICS] Confirmation created: ${confirmationType} for order ${orderId}`);
      return { success: true };

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error creating confirmation:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Create status history entry
   */
  async createStatusHistory(connection, orderId, fromStatus, toStatus, changedBy, reason = null, location = null, metadata = null) {
    await connection.execute(`
      INSERT INTO order_status_history 
      (order_id, old_status, new_status, changed_by, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [
      orderId, fromStatus, toStatus, changedBy, reason
    ]);
  }

  /**
   * Send comprehensive notifications
   */
  async sendOrderNotification(connection, orderId, notificationType, additionalData = {}) {
    try {
      // Get order details and involved parties
      const [orders] = await connection.execute(`
        SELECT o.*, 
               buyer.id as buyer_id, buyer.name as buyer_name, buyer.email as buyer_email,
               seller.id as seller_id, seller.name as seller_name, seller.email as seller_email,
               agent.id as agent_id, agent.name as agent_name, agent.email as agent_email,
               psm.id as psm_id, psm.name as psm_name, psm.email as psm_email,
               ps.name as pickup_site_name
        FROM orders o
        JOIN users buyer ON o.user_id = buyer.id
        JOIN users seller ON o.seller_id = seller.id
        LEFT JOIN users agent ON o.agent_id = agent.id
        LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
        LEFT JOIN users psm ON ps.manager_user_id = psm.id
        WHERE o.id = ?
      `, [orderId]);

      if (orders.length === 0) return;

      const order = orders[0];
      const notifications = this.buildNotificationMessages(order, notificationType, additionalData);

      // Send notifications to all relevant parties
      for (const notification of notifications) {
        await connection.execute(`
          INSERT INTO enhanced_notifications 
          (user_id, user_role, notification_type, title, message, order_id, related_user_id, data, priority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          notification.userId, notification.userRole, notificationType,
          notification.title, notification.message, orderId,
          notification.relatedUserId || null,
          JSON.stringify(notification.data || {}),
          notification.priority || 'normal'
        ]);

        // Send email notification if enabled
        if (notification.sendEmail) {
          await this.sendEmailNotification(notification);
        }
      }

      console.log(`[PDA-LOGISTICS] Notifications sent for order ${orderId}, type: ${notificationType}`);

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error sending notifications:', error);
    }
  }

  /**
   * Build notification messages for different parties
   */
  buildNotificationMessages(order, notificationType, additionalData) {
    const notifications = [];
    const orderNumber = order.order_number;

    switch (notificationType) {
      case this.NOTIFICATION_TYPES.ORDER_PLACED:
        notifications.push({
          userId: order.buyer_id,
          userRole: 'buyer',
          title: 'Order Placed Successfully',
          message: `Your order ${orderNumber} has been placed. ${order.delivery_method === 'pickup' ? 'You will be notified when it\'s ready for pickup.' : 'It will be delivered to your address.'}`,
          sendEmail: true
        });
        
        notifications.push({
          userId: order.seller_id,
          userRole: 'seller',
          title: 'New Order Received',
          message: `You have a new order ${orderNumber}. A courier will be assigned to collect the item soon.`,
          sendEmail: true
        });

        // Admin notification for manual payment review
        notifications.push({
          userId: 1, // Admin user ID
          userRole: 'admin',
          title: 'Manual Payment Review Required',
          message: `Order ${orderNumber} requires payment proof review before courier assignment.`,
          priority: 'high'
        });
        break;

      case this.NOTIFICATION_TYPES.AGENT_ASSIGNED:
        notifications.push({
          userId: order.buyer_id,
          userRole: 'buyer',
          title: 'Courier Assigned',
          message: `Courier ${order.agent_name} has been assigned to your order ${orderNumber}. They will collect from the seller and ${order.delivery_method === 'pickup' ? 'deliver to pickup site' : 'deliver to your address'}.`,
          relatedUserId: order.agent_id
        });

        notifications.push({
          userId: order.agent_id,
          userRole: 'agent',
          title: 'New Order Assignment',
          message: `You have been assigned order ${orderNumber}. Please proceed to seller location for pickup.`,
          priority: 'high',
          data: { orderId: order.id }
        });

        notifications.push({
          userId: order.seller_id,
          userRole: 'seller',
          title: 'Courier Assigned',
          message: `Courier ${order.agent_name} will arrive to collect your item for order ${orderNumber}. Please have the package ready.`,
          relatedUserId: order.agent_id
        });
        break;

      case this.NOTIFICATION_TYPES.PICKED_FROM_SELLER:
        notifications.push({
          userId: order.seller_id,
          userRole: 'seller',
          title: 'Item Collected',
          message: `Your item for order ${orderNumber} has been collected by the courier. ${order.delivery_method === 'pickup' ? 'Payment will be released when delivered to pickup site.' : 'Payment will be released upon buyer confirmation.'}`,
          sendEmail: true
        });

        notifications.push({
          userId: 1, // Admin
          userRole: 'admin', 
          title: 'Item Collected from Seller',
          message: `Courier collected item from seller for order ${orderNumber}. ${order.delivery_method === 'pickup' ? 'En route to pickup site.' : 'En route to buyer.'}`,
          data: { orderId: order.id }
        });
        break;

      case this.NOTIFICATION_TYPES.DELIVERED_TO_PSM:
        notifications.push({
          userId: order.buyer_id,
          userRole: 'buyer',
          title: 'Order Ready for Pickup',
          message: `Your order ${orderNumber} is now available for pickup at ${order.pickup_site_name}. Please bring your order receipt and valid ID.`,
          priority: 'high',
          sendEmail: true,
          data: { 
            orderId: order.id,
            pickupSite: order.pickup_site_name
          }
        });

        if (order.psm_id) {
          notifications.push({
            userId: order.psm_id,
            userRole: 'psm',
            title: 'Package Delivered',
            message: `Package for order ${orderNumber} has been delivered to your pickup site. Buyer ${order.buyer_name} will come to collect it.`,
            data: { orderId: order.id }
          });
        }

        notifications.push({
          userId: 1, // Admin
          userRole: 'admin',
          title: 'Package Delivered to PSM',
          message: `Order ${orderNumber} delivered to pickup site. Ready to release seller payout.`,
          priority: 'high',
          data: { orderId: order.id, action: 'release_seller_payout' }
        });
        break;

      case this.NOTIFICATION_TYPES.DELIVERED_TO_BUYER:
        notifications.push({
          userId: order.buyer_id,
          userRole: 'buyer',
          title: 'Order Delivered',
          message: `Your order ${orderNumber} has been delivered. Thank you for shopping with us! Please rate your delivery experience.`,
          sendEmail: true
        });

        notifications.push({
          userId: order.seller_id,
          userRole: 'seller',
          title: 'Order Delivered',
          message: `Your item for order ${orderNumber} has been successfully delivered to the buyer. Payment will be released shortly.`,
          sendEmail: true
        });

        notifications.push({
          userId: order.agent_id,
          userRole: 'agent',
          title: 'Delivery Completed',
          message: `You have successfully delivered order ${orderNumber}. Your commission will be processed.`
        });
        break;

      case this.NOTIFICATION_TYPES.ORDER_COMPLETED:
        notifications.push({
          userId: order.buyer_id,
          userRole: 'buyer',
          title: 'Order Completed',
          message: `Order ${orderNumber} has been completed. Thank you for your business!`,
          data: { canRate: true }
        });

        notifications.push({
          userId: order.agent_id,
          userRole: 'agent',
          title: 'Commission Released',
          message: `Your commission for order ${orderNumber} has been released to your account.`
        });
        break;

      default:
        console.warn(`[PDA-LOGISTICS] Unknown notification type: ${notificationType}`);
    }

    return notifications;
  }

  /**
   * Send email notification (placeholder - implement with actual email service)
   */
  async sendEmailNotification(notification) {
    try {
      console.log(`[PDA-LOGISTICS] Email notification sent to user ${notification.userId}: ${notification.title}`);
      // TODO: Implement actual email sending
    } catch (error) {
      console.error('[PDA-LOGISTICS] Error sending email:', error);
    }
  }

  /**
   * Send status change notifications
   */
  async sendStatusChangeNotifications(connection, orderId, newStatus) {
    const statusNotificationMap = {
      [this.ORDER_STATUSES.PAYMENT_CONFIRMED]: this.NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
      [this.ORDER_STATUSES.ASSIGNED_TO_PDA]: this.NOTIFICATION_TYPES.AGENT_ASSIGNED,
      [this.ORDER_STATUSES.PDA_EN_ROUTE_TO_SELLER]: this.NOTIFICATION_TYPES.EN_ROUTE_TO_SELLER,
      [this.ORDER_STATUSES.PICKED_FROM_SELLER]: this.NOTIFICATION_TYPES.PICKED_FROM_SELLER,
      [this.ORDER_STATUSES.EN_ROUTE_TO_PSM]: this.NOTIFICATION_TYPES.EN_ROUTE_TO_PSM,
      [this.ORDER_STATUSES.DELIVERED_TO_PSM]: this.NOTIFICATION_TYPES.DELIVERED_TO_PSM,
      [this.ORDER_STATUSES.READY_FOR_PICKUP]: this.NOTIFICATION_TYPES.READY_FOR_PICKUP,
      [this.ORDER_STATUSES.EN_ROUTE_TO_BUYER]: this.NOTIFICATION_TYPES.EN_ROUTE_TO_BUYER,
      [this.ORDER_STATUSES.DELIVERED_TO_BUYER]: this.NOTIFICATION_TYPES.DELIVERED_TO_BUYER,
      [this.ORDER_STATUSES.COMPLETED]: this.NOTIFICATION_TYPES.ORDER_COMPLETED
    };

    const notificationType = statusNotificationMap[newStatus];
    if (notificationType) {
      await this.sendOrderNotification(connection, orderId, notificationType);
    }
  }

  /**
   * Create admin approval request
   */
  async createAdminApproval(connection, orderId, approvalType, requestedBy, requestData = {}) {
    await connection.execute(`
      INSERT INTO admin_approvals (approval_type, order_id, requested_by, request_data)
      VALUES (?, ?, ?, ?)
    `, [approvalType, orderId, requestedBy, JSON.stringify(requestData)]);

    console.log(`[PDA-LOGISTICS] Admin approval requested: ${approvalType} for order ${orderId}`);
  }

  /**
   * Release payout (seller or PDA commission)
   */
  async releasePayout(connection, orderId, payoutType, approvedBy) {
    const payoutField = payoutType === 'SELLER_PAYOUT' ? 'seller_payout_released' : 'pda_commission_released';
    const timestampField = payoutType === 'SELLER_PAYOUT' ? 'seller_payout_released_at' : 'pda_commission_released_at';

    await connection.execute(`
      UPDATE orders SET ${payoutField} = TRUE, ${timestampField} = NOW() WHERE id = ?
    `, [orderId]);

    // Create admin approval record
    await connection.execute(`
      INSERT INTO admin_approvals (approval_type, order_id, requested_by, reviewed_by, status, approved_at)
      VALUES (?, ?, ?, ?, 'approved', NOW())
    `, [payoutType, orderId, approvedBy, approvedBy]);

    console.log(`[PDA-LOGISTICS] ${payoutType} released for order ${orderId}`);
  }

  /**
   * Complete order processing
   */
  async completeOrder(connection, orderId) {
    // Ensure all payouts are released
    await connection.execute(`
      UPDATE orders SET 
        seller_payout_released = TRUE,
        seller_payout_released_at = COALESCE(seller_payout_released_at, NOW()),
        pda_commission_released = TRUE,
        pda_commission_released_at = COALESCE(pda_commission_released_at, NOW())
      WHERE id = ?
    `, [orderId]);

    console.log(`[PDA-LOGISTICS] Order ${orderId} completed successfully`);
  }

  /**
   * Get order status and tracking information
   */
  async getOrderTracking(orderId) {
    const connection = await pool.getConnection();
    try {
      // Get order details
      const [orders] = await connection.execute(`
        SELECT o.*, 
               buyer.name as buyer_name, buyer.phone as buyer_phone,
               seller.name as seller_name, seller.phone as seller_phone,
               agent.name as agent_name, agent.phone as agent_phone,
               ps.name as pickup_site_name, ps.address_line1 as pickup_address
        FROM orders o
        JOIN users buyer ON o.user_id = buyer.id
        JOIN users seller ON o.seller_id = seller.id
        LEFT JOIN users agent ON o.agent_id = agent.id
        LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
        WHERE o.id = ?
      `, [orderId]);

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      // Get status history
      const [statusHistory] = await connection.execute(`
        SELECT osh.*, u.name as changed_by_name
        FROM order_status_history osh
        JOIN users u ON osh.changed_by = u.id
        WHERE osh.order_id = ?
        ORDER BY osh.created_at ASC
      `, [orderId]);

      // Get confirmations
      const [confirmations] = await connection.execute(`
        SELECT oc.*, u.name as confirmer_name
        FROM order_confirmations oc
        JOIN users u ON oc.confirmer_user_id = u.id
        WHERE oc.order_id = ?
        ORDER BY oc.created_at DESC
      `, [orderId]);

      // Get GPS tracking
      const [gpsTracking] = await connection.execute(`
        SELECT * FROM order_gps_tracking 
        WHERE order_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `, [orderId]);

      return {
        order: orders[0],
        statusHistory,
        confirmations,
        gpsTracking
      };

    } catch (error) {
      console.error('[PDA-LOGISTICS] Error getting order tracking:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new PDALogisticsService();