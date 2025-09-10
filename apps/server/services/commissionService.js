/**
 * Universal Commission and Revenue Service
 * Handles all commission calculations for both Physical Products and Local/Grocery Marketplace
 */

const pool = require('../db');

class CommissionService {
  
  /**
   * Get current commission rates from platform settings
   */
  static async getCommissionRates() {
    try {
      const [rates] = await pool.query(`
        SELECT setting_key, setting_value, setting_type 
        FROM platform_settings 
        WHERE category = 'commission' AND is_editable = TRUE
      `);
      
      const ratesObj = {};
      rates.forEach(rate => {
        const value = rate.setting_type === 'number' ? parseFloat(rate.setting_value) : rate.setting_value;
        ratesObj[rate.setting_key] = value;
      });
      
      return ratesObj;
    } catch (error) {
      console.error('Error fetching commission rates:', error);
      // Return default rates if database fails
      return {
        default_platform_margin: 21.00,
        home_delivery_additional_fee: 6.00,
        system_maintenance_fee: 1.00,
        fast_delivery_agent_rate: 70.00,
        psm_helped_rate: 25.00,
        psm_received_rate: 15.00,
        pickup_delivery_agent_rate: 70.00
      };
    }
  }

  /**
   * Calculate final buyer price with FREE delivery model
   * @param {number} finalPrice - Final product price (already includes 21% platform fee)
   * @param {string} deliveryType - 'pickup' or 'home_delivery'
   * @param {string} marketplaceType - 'physical' or 'local_grocery'
   */
  static async calculateBuyerPrice(finalPrice, deliveryType = 'pickup', marketplaceType = 'physical') {
    try {
      const rates = await this.getCommissionRates();
      
      // Calculate base price (reverse calculate from final price)
      const basePrice = finalPrice / 1.21; // Remove 21% to get original seller price
      const platformMargin = finalPrice - basePrice; // 21% platform fee
      
      // All delivery fees are now FREE to attract customers
      const deliveryFee = 0; // Always 0 - fees included in product price
      
      return {
        basePrice: parseFloat(basePrice.toFixed(2)), // Original seller price
        platformMargin: parseFloat(platformMargin.toFixed(2)), // 21% platform fee
        deliveryFee: 0, // Always FREE
        finalPrice: parseFloat(finalPrice.toFixed(2)), // What buyer pays (no additional fees)
        displayPrice: parseFloat(finalPrice.toFixed(2)), // Same as final price
        sellerPayout: parseFloat(basePrice.toFixed(2)), // What seller receives (original price)
        customerVisibleDeliveryFee: 0 // Always show FREE to customers
      };
    } catch (error) {
      console.error('Error calculating buyer price:', error);
      throw new Error('Failed to calculate pricing');
    }
  }

  /**
   * Calculate and distribute commissions for an order
   * @param {number} orderId - Order ID
   * @param {number} finalAmount - Final amount paid by customer (includes 21% platform fee)
   * @param {string} deliveryType - 'pickup' or 'home_delivery'
   * @param {object} involvedAgents - Object containing agent IDs and their roles
   */
  static async calculateOrderCommissions(orderId, finalAmount, deliveryType, involvedAgents = {}) {
    try {
      const rates = await this.getCommissionRates();
      const commissions = [];
      
      // Calculate base price and platform margin from final amount
      const baseAmount = finalAmount / 1.21; // Original seller price
      const platformMargin = finalAmount - baseAmount; // 21% platform fee
      
      // 2. System maintenance fee (1% of platform margin)
      const systemMaintenance = (platformMargin * rates.system_maintenance_fee) / 100;
      
      // 3. Remaining margin for distribution (20% of platform margin)
      const remainingMargin = platformMargin - systemMaintenance;
      
      // Add platform margin commission
      commissions.push({
        order_id: orderId,
        commission_type: 'platform_margin',
        base_amount: baseAmount,
        commission_percentage: rates.default_platform_margin,
        commission_amount: platformMargin,
        status: 'calculated'
      });
      
      // Add system maintenance commission
      commissions.push({
        order_id: orderId,
        commission_type: 'system_maintenance',
        base_amount: platformMargin,
        commission_percentage: rates.system_maintenance_fee,
        commission_amount: systemMaintenance,
        status: 'calculated'
      });
      
      // 4. Home delivery fee if applicable (6% of base price)
      if (deliveryType === 'home_delivery') {
        const homeDeliveryFee = (baseAmount * rates.home_delivery_additional_fee) / 100;
        commissions.push({
          order_id: orderId,
          commission_type: 'home_delivery_fee',
          base_amount: baseAmount,
          commission_percentage: rates.home_delivery_additional_fee,
          commission_amount: homeDeliveryFee,
          status: 'calculated'
        });
        
        // Fast delivery agent gets 70% of remaining 20% margin
        if (involvedAgents.fastDeliveryAgent) {
          const agentCommission = (remainingMargin * rates.fast_delivery_agent_rate) / 100;
          commissions.push({
            order_id: orderId,
            commission_type: 'fast_delivery_agent',
            agent_id: involvedAgents.fastDeliveryAgent,
            agent_type: 'fast_delivery',
            base_amount: remainingMargin,
            commission_percentage: rates.fast_delivery_agent_rate,
            commission_amount: agentCommission,
            status: 'pending'
          });
        }
      }
      
      // 5. Pickup Site Manager commissions (Physical Products only)
      if (deliveryType === 'pickup' && involvedAgents.pickupSiteManager) {
        const psmRate = involvedAgents.psmHelped ? rates.psm_helped_rate : rates.psm_received_rate;
        const psmCommission = (remainingMargin * psmRate) / 100;
        
        commissions.push({
          order_id: orderId,
          commission_type: 'pickup_site_manager',
          agent_id: involvedAgents.pickupSiteManager,
          agent_type: 'pickup_site_manager',
          base_amount: remainingMargin,
          commission_percentage: psmRate,
          commission_amount: psmCommission,
          status: 'pending',
          notes: involvedAgents.psmHelped ? 'Helped buyer with purchase' : 'Received product for pickup'
        });
      }
      
      // 6. Pickup Delivery Agent (who brings products to PSM)
      if (involvedAgents.pickupDeliveryAgent) {
        const deliveryAgentCommission = (remainingMargin * rates.pickup_delivery_agent_rate) / 100;
        commissions.push({
          order_id: orderId,
          commission_type: 'pickup_delivery_agent',
          agent_id: involvedAgents.pickupDeliveryAgent,
          agent_type: 'pickup_delivery',
          base_amount: remainingMargin,
          commission_percentage: rates.pickup_delivery_agent_rate,
          commission_amount: deliveryAgentCommission,
          status: 'pending'
        });
      }
      
      // Insert all commissions into database
      for (const commission of commissions) {
        await pool.query(`
          INSERT INTO commission_transactions (
            order_id, agent_id, commission_type, amount, percentage, base_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          commission.order_id,
          commission.agent_id || null,
          commission.commission_type,
          commission.commission_amount,
          commission.commission_percentage,
          commission.base_amount,
          commission.status === 'calculated' ? 'pending' : commission.status
        ]);
        
        // Create agent earnings record if agent is involved
        if (commission.agent_id && commission.status === 'pending') {
          await pool.query(`
            INSERT INTO agent_earnings (
              agent_id, order_id, amount, earnings_type, status
            ) VALUES (?, ?, ?, ?, 'pending')
          `, [
            commission.agent_id,
            commission.order_id,
            commission.commission_amount,
            commission.agent_type || 'delivery'
          ]);
        }
      }
      
      return {
        success: true,
        totalCommissions: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
        commissions: commissions
      };
      
    } catch (error) {
      console.error('Error calculating order commissions:', error);
      throw new Error('Failed to calculate commissions');
    }
  }

  /**
   * Get commission breakdown for an order
   */
  static async getOrderCommissions(orderId) {
    try {
      const [commissions] = await pool.query(`
        SELECT 
          ct.*,
          u.name as agent_name,
          u.email as agent_email
        FROM commission_transactions ct
        LEFT JOIN users u ON ct.agent_id = u.id
        WHERE ct.order_id = ?
        ORDER BY ct.created_at
      `, [orderId]);
      
      return commissions;
    } catch (error) {
      console.error('Error fetching order commissions:', error);
      throw new Error('Failed to fetch commission data');
    }
  }

  /**
   * Get agent earnings summary
   */
  static async getAgentEarnings(agentId) {
    try {
      const [earnings] = await pool.query(`
        SELECT 
          ae.*,
          o.order_number,
          u.name as agent_name,
          u.email as agent_email
        FROM agent_earnings ae
        JOIN orders o ON ae.order_id = o.id
        JOIN users u ON ae.agent_id = u.id
        WHERE ae.agent_id = ?
        ORDER BY ae.created_at DESC
      `, [agentId]);
      
      return earnings;
    } catch (error) {
      console.error('Error fetching agent earnings:', error);
      throw new Error('Failed to fetch earnings data');
    }
  }

  /**
   * Update commission rates (Admin only)
   */
  static async updateCommissionRates(rates, adminId) {
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        for (const [key, value] of Object.entries(rates)) {
          await connection.query(`
            UPDATE platform_settings 
            SET setting_value = ?, updated_at = NOW()
            WHERE setting_key = ? AND category = 'commission'
          `, [value.toString(), key]);
        }
        
        // Log the change
        await connection.query(`
          INSERT INTO system_logs (level, message, details, user_id)
          VALUES ('info', 'Commission rates updated', ?, ?)
        `, [JSON.stringify(rates), adminId]);
        
        await connection.commit();
        return { success: true, message: 'Commission rates updated successfully' };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error updating commission rates:', error);
      throw new Error('Failed to update commission rates');
    }
  }

  /**
   * Get commission analytics for admin dashboard
   */
  static async getCommissionAnalytics(startDate, endDate) {
    try {
      const [analytics] = await pool.query(`
        SELECT 
          DATE(o.created_at) as date,
          COUNT(o.id) as total_orders,
          SUM(o.total_amount) as total_revenue,
          SUM(CASE WHEN ct.commission_type = 'platform_margin' THEN ct.amount ELSE 0 END) as platform_margin_earned,
          SUM(CASE WHEN ct.commission_type = 'fast_delivery' THEN ct.amount ELSE 0 END) as agent_commissions_paid,
          SUM(CASE WHEN ct.commission_type = 'system_maintenance' THEN ct.amount ELSE 0 END) as system_maintenance_fees,
          (SUM(CASE WHEN ct.commission_type = 'platform_margin' THEN ct.amount ELSE 0 END) - 
           SUM(CASE WHEN ct.agent_id IS NOT NULL THEN ct.amount ELSE 0 END) - 
           SUM(CASE WHEN ct.commission_type = 'system_maintenance' THEN ct.amount ELSE 0 END)) as net_platform_profit
        FROM orders o
        LEFT JOIN commission_transactions ct ON o.id = ct.order_id
        WHERE o.created_at BETWEEN ? AND ?
        GROUP BY DATE(o.created_at)
        ORDER BY date DESC
      `, [startDate, endDate]);
      
      return analytics;
    } catch (error) {
      console.error('Error fetching commission analytics:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  /**
   * Check if agent is certified for specific type
   */
  static async isAgentCertified(agentId, certificationType) {
    try {
      const [certification] = await pool.query(`
        SELECT id FROM agent_certifications 
        WHERE agent_id = ? AND certification_type = ? 
        AND admin_approval_status = 'approved' AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      `, [agentId, certificationType]);
      
      return certification.length > 0;
    } catch (error) {
      console.error('Error checking agent certification:', error);
      return false;
    }
  }

  /**
   * Process product pricing for display - commission already included in prices
   */
  static async processProductPricing(products, deliveryType = 'pickup') {
    try {
      return products.map(product => {
        let displayPrice = 0;
        const rawPricePrimary = parseFloat(product.price) || 0;
        const rawPriceAlt1 = parseFloat(product.unit_price) || 0;
        const rawPriceAlt2 = parseFloat(product.discount_price) || 0;
        const rawPriceAlt3 = parseFloat(product.final_price) || 0;
        const rawPriceAlt4 = parseFloat(product.selling_price) || 0;
        const rawPrice = rawPricePrimary || rawPriceAlt1 || rawPriceAlt2 || rawPriceAlt3 || rawPriceAlt4 || 0;

        const basePrice = product.base_price !== undefined && product.base_price !== null
          ? parseFloat(product.base_price)
          : NaN;

        // If base_price exists and > 0, enforce final price = base * 1.21 for buyer-facing views
        if (!isNaN(basePrice) && basePrice > 0) {
          displayPrice = Math.round(basePrice * 1.21);
        } else if (rawPrice > 0) {
          // Heuristic: decide whether rawPrice is final or base
          const approxBase = rawPrice / 1.21;
          const reapply = Math.round(approxBase * 1.21);
          if (Math.abs(reapply - rawPrice) <= 1) {
            // raw looks like final (already includes 21%)
            displayPrice = rawPrice;
          } else {
            // raw looks like base; show buyer final price including 21%
            displayPrice = Math.round(rawPrice * 1.21);
          }
        }

        // Handle discount price normalization if it exists
        let normalizedDiscountPrice = null;
        if (product.discount_price && parseFloat(product.discount_price) > 0) {
          const rawDiscountPrice = parseFloat(product.discount_price);
          const discountBasePrice = product.discount_base_price !== undefined && product.discount_base_price !== null
            ? parseFloat(product.discount_base_price)
            : NaN;

          if (!isNaN(discountBasePrice) && discountBasePrice > 0) {
            normalizedDiscountPrice = Math.round(discountBasePrice * 1.21);
          } else {
            // Apply same heuristic as main price
            const approxDiscountBase = rawDiscountPrice / 1.21;
            const reapplyDiscount = Math.round(approxDiscountBase * 1.21);
            if (Math.abs(reapplyDiscount - rawDiscountPrice) <= 1) {
              // discount price looks like final (already includes 21%)
              normalizedDiscountPrice = rawDiscountPrice;
            } else {
              // discount price looks like base; show buyer final price including 21%
              normalizedDiscountPrice = Math.round(rawDiscountPrice * 1.21);
            }
          }
        }

        // For local market products, ensure proper unit pricing
        if (product.unit_type) {
          product.price = displayPrice; // Keep unit price as final buyer price
          product.unit_price = displayPrice; // Ensure both fields exist
        }

        const result = {
          ...product,
          price: parseFloat(displayPrice.toFixed(2)),
          display_price: parseFloat(displayPrice.toFixed(2)),
          commission_included: true,
          delivery_fee: 0
        };

        // Add normalized discount price if it exists
        if (normalizedDiscountPrice !== null) {
          result.discount_price = parseFloat(normalizedDiscountPrice.toFixed(2));
        }

        return result;
      });
    } catch (error) {
      console.error('Error processing product pricing:', error);
      return products;
    }
  }
}

module.exports = CommissionService;