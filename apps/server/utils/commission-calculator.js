/**
 * Commission Calculator Utility
 * 
 * Commission Structure:
 * - Platform markup: 21% on purchasing price
 * - Total platform profit = Selling Price - Purchasing Price
 * - Commission distribution from platform profit:
 *   - Fast Delivery Agent (local orders): 50%
 *   - Pickup Delivery Agent (physical orders): 70%
 *   - Site Manager Agent: 15%
 *   - Referral Buyer: 15%
 *   - Platform Commission: 15%
 * 
 * Note: If any commission is skipped, it goes to platform commission
 */

class CommissionCalculator {
  constructor() {
    this.PLATFORM_MARKUP = 0.21; // 21%
    this.COMMISSION_RATES = {
      FAST_DELIVERY_AGENT: 0.50,    // 50% for local market delivery
      PICKUP_DELIVERY_AGENT: 0.70,  // 70% for physical product delivery
      SITE_MANAGER_AGENT: 0.15,     // 15% for PSM
      REFERRAL_BUYER: 0.15,          // 15% for referral
      PLATFORM_BASE: 0.15            // 15% base platform commission
    };
  }

  /**
   * Calculate all commissions for an order
   * @param {Object} orderData - Order information
   * @param {number} orderData.purchasing_price - Base purchasing price
   * @param {string} orderData.order_type - 'local' or 'physical'
   * @param {boolean} orderData.has_referral - Whether order has referral
   * @param {boolean} orderData.has_psm - Whether PSM was involved
   * @param {boolean} orderData.has_delivery_agent - Whether delivery agent was involved
   * @returns {Object} Commission breakdown
   */
  calculateCommissions(orderData) {
    const {
      purchasing_price,
      order_type = 'physical',
      has_referral = false,
      has_psm = false,
      has_delivery_agent = true
    } = orderData;

    // Calculate selling price with 21% markup
    const sellingPrice = purchasing_price * (1 + this.PLATFORM_MARKUP);
    const platformProfit = sellingPrice - purchasing_price;

    // Initialize commission breakdown
    const commissions = {
      purchasing_price: purchasing_price,
      selling_price: sellingPrice,
      platform_profit: platformProfit,
      seller_payout: purchasing_price,
      fast_delivery_agent: 0,
      pickup_delivery_agent: 0,
      site_manager_agent: 0,
      referral_buyer: 0,
      platform_commission: 0,
      total_distributed: 0
    };

    // Calculate commissions based on platform profit
    // 1. Delivery Agent Commission
    if (has_delivery_agent) {
      if (order_type === 'local') {
        // Fast Delivery Agent for local orders
        commissions.fast_delivery_agent = platformProfit * this.COMMISSION_RATES.FAST_DELIVERY_AGENT;
      } else {
        // Pickup Delivery Agent for physical orders
        commissions.pickup_delivery_agent = platformProfit * this.COMMISSION_RATES.PICKUP_DELIVERY_AGENT;
      }
    }

    // 2. Site Manager Agent Commission
    if (has_psm) {
      commissions.site_manager_agent = platformProfit * this.COMMISSION_RATES.SITE_MANAGER_AGENT;
    }

    // 3. Referral Buyer Commission
    if (has_referral) {
      commissions.referral_buyer = platformProfit * this.COMMISSION_RATES.REFERRAL_BUYER;
    }

    // 4. Platform Commission - Calculate as remainder to ensure total equals platform profit
    const distributedCommissions = 
      commissions.fast_delivery_agent +
      commissions.pickup_delivery_agent +
      commissions.site_manager_agent +
      commissions.referral_buyer;
    
    commissions.platform_commission = platformProfit - distributedCommissions;

    // Special handling for local orders without referral
    if (order_type === 'local' && !has_referral) {
      // Recalculate: FDA gets 50%, platform gets remaining 50%
      commissions.fast_delivery_agent = platformProfit * 0.5;
      commissions.platform_commission = platformProfit - commissions.fast_delivery_agent - commissions.site_manager_agent;
    }

    // Calculate total distributed
    commissions.total_distributed = 
      commissions.fast_delivery_agent +
      commissions.pickup_delivery_agent +
      commissions.site_manager_agent +
      commissions.referral_buyer +
      commissions.platform_commission;

    // Round all values to 2 decimal places
    Object.keys(commissions).forEach(key => {
      if (typeof commissions[key] === 'number') {
        commissions[key] = Math.round(commissions[key] * 100) / 100;
      }
    });

    return commissions;
  }

  /**
   * Calculate commission for a specific agent type
   * @param {Object} orderData - Order information
   * @param {string} agentType - 'psm', 'delivery', 'referral'
   * @returns {number} Commission amount for the agent
   */
  getAgentCommission(orderData, agentType) {
    const commissions = this.calculateCommissions(orderData);
    
    switch (agentType) {
      case 'psm':
        return commissions.site_manager_agent;
      case 'delivery':
        return orderData.order_type === 'local' 
          ? commissions.fast_delivery_agent 
          : commissions.pickup_delivery_agent;
      case 'referral':
        return commissions.referral_buyer;
      default:
        return 0;
    }
  }

  /**
   * Get commission breakdown summary
   * @param {Object} orderData - Order information
   * @returns {Object} Summary with percentages and amounts
   */
  getCommissionSummary(orderData) {
    const commissions = this.calculateCommissions(orderData);
    const { platform_profit } = commissions;

    return {
      order_type: orderData.order_type,
      purchasing_price: commissions.purchasing_price,
      selling_price: commissions.selling_price,
      platform_profit: platform_profit,
      breakdown: {
        delivery_agent: {
          type: orderData.order_type === 'local' ? 'Fast Delivery' : 'Pickup Delivery',
          percentage: orderData.order_type === 'local' ? '50%' : '70%',
          amount: orderData.order_type === 'local' 
            ? commissions.fast_delivery_agent 
            : commissions.pickup_delivery_agent
        },
        site_manager: {
          percentage: '15%',
          amount: commissions.site_manager_agent
        },
        referral: {
          percentage: '15%',
          amount: commissions.referral_buyer
        },
        platform: {
          percentage: 'Variable (15% + skipped)',
          amount: commissions.platform_commission
        }
      },
      total_distributed: commissions.total_distributed,
      verification: Math.abs(commissions.total_distributed - platform_profit) < 0.01
    };
  }
}

module.exports = CommissionCalculator;