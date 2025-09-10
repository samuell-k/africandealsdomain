/**
 * Page Validator and Link Fixer
 * Validates all pages and fixes broken links and routing issues
 */

class PageValidator {
  constructor() {
    this.router = window.unifiedRouter;
    this.validationResults = {
      totalPages: 0,
      validPages: 0,
      invalidPages: [],
      brokenLinks: [],
      missingPages: [],
      duplicateRoutes: [],
      fixedLinks: []
    };
    this.pageMap = new Map();
    this.routeMap = new Map();
    this.init();
  }

  init() {
    console.log('🔍 Page Validator initialized');
    this.validateCurrentPage();
    this.setupLinkValidation();
  }

  validateCurrentPage() {
    const currentPath = window.location.pathname;
    const isValid = this.isValidPage(currentPath);
    
    if (!isValid) {
      console.warn(`Invalid page detected: ${currentPath}`);
      this.fixCurrentPage();
    } else {
      this.validatePageLinks();
    }
  }

  isValidPage(path) {
    // List of known valid pages
    const validPages = [
      // Public pages
      '/', '/public/index.html', '/public/about.html', '/public/contact.html',
      '/public/faq.html', '/public/how-it-works.html', '/public/privacy-policy.html',
      '/public/terms-and-conditions.html', '/public/shipping-policy.html',
      '/public/returns-policy.html', '/public/categories.html', '/public/products.html',
      '/public/product-detail.html', '/public/search-results.html',

      // Auth pages
      '/auth/auth-buyer.html', '/auth/auth-seller.html', '/auth/auth-agent.html',
      '/auth/auth-admin.html', '/auth/forgot-password.html', '/auth/reset-password.html',
      '/auth/verify-email.html', '/auth/verify-phone.html', '/auth/404.html',
      '/auth/access-denied.html', '/auth/maintenance.html', '/auth/coming-soon.html',

      // Buyer pages
      '/buyer/buyers-home.html', '/buyer/products.html', '/buyer/product-detail.html',
      '/buyer/cart.html', '/buyer/checkout.html', '/buyer/payment.html', '/buyer/payment-new.html',
      '/buyer/payment-mobile.html', '/buyer/payment-escrow.html', '/buyer/orders.html',
      '/buyer/order-detail.html', '/buyer/order-success.html', '/buyer/track-order.html',
      '/buyer/wishlist.html', '/buyer/profile.html', '/buyer/edit-profile.html',
      '/buyer/settings.html', '/buyer/wallet.html', '/buyer/messages.html',
      '/buyer/notifications.html', '/buyer/reviews.html', '/buyer/write-review.html',
      '/buyer/support.html', '/buyer/local-market.html',

      // Seller pages
      '/seller/dashboard.html', '/seller/add-product.html', '/seller/add-local-market-product.html',
      '/seller/edit-product.html', '/seller/products.html', '/seller/inventory.html',
      '/seller/orders.html', '/seller/order-detail.html', '/seller/analytics.html',
      '/seller/promotions.html', '/seller/boosted-products.html', '/seller/payouts.html',
      '/seller/commission.html', '/seller/returns.html', '/seller/returns-detail.html',
      '/seller/reviews.html', '/seller/messages.html', '/seller/notifications.html',
      '/seller/profile.html', '/seller/edit-profile.html', '/seller/settings.html',
      '/seller/wallet.html', '/seller/support.html', '/seller/business-location.html',
      '/seller/store-location.html',

      // Agent pages
      '/agent/dashboard.html', '/agent/local-market-dashboard.html', '/agent/orders.html',
      '/agent/order-detail.html', '/agent/deliveries.html', '/agent/deliveries-detail.html',
      '/agent/pickups.html', '/agent/pickups-detail.html', '/agent/earnings.html',
      '/agent/schedule.html', '/agent/schedules.html', '/agent/schedules-detail.html',
      '/agent/location-tracking.html', '/agent/messages.html', '/agent/messages-new.html',
      '/agent/notifications.html', '/agent/notifications-new.html', '/agent/profile.html',
      '/agent/profile-new.html', '/agent/edit-profile.html', '/agent/settings.html',
      '/agent/wallet.html', '/agent/support.html', '/agent/support-tickets.html',
      '/agent/support-tickets-detail.html', '/agent/support-tickets-new.html',
      '/agent/track-order.html', '/agent/verification.html',

      // Admin pages
      '/admin/dashboard.html', '/admin/dashboard.html', '/admin/user-management.html',
      '/admin/user-detail.html', '/admin/user-edit.html', '/admin/user-management.html',
      '/admin/sellers.html', '/admin/seller-detail.html', '/admin/seller-edit.html',
      '/admin/agents.html', '/admin/agent-detail.html', '/admin/agent-edit.html',
      '/admin/agent-tracking.html', '/admin/products.html', '/admin/product-detail.html',
      '/admin/product-edit.html', '/admin/product-management.html', '/admin/categories.html',
      '/admin/category-management.html', '/admin/orders.html', '/admin/order-detail.html',
      '/admin/order-edit.html', '/admin/order-management.html', '/admin/payments.html',
      '/admin/payment-methods.html', '/admin/payment-monitoring.html', '/admin/shipping.html',
      '/admin/shipping-management.html', '/admin/shipping-rules.html', '/admin/shipping-insights.html',
      '/admin/delivery-zones.html', '/admin/reviews.html', '/admin/review-detail.html',
      '/admin/promotions.html', '/admin/marketing.html', '/admin/announcements-management.html',
      '/admin/blog-announcement-publishing.html', '/admin/ads-boosting-approval.html',
      '/admin/reports.html', '/admin/support-tickets.html', '/admin/support-tickets/support-tickets.html',
      '/admin/support-tickets/support-tickets-detail.html', '/admin/live-chat-monitoring.html',
      '/admin/logs.html', '/admin/logs/logs.html', '/admin/admin-logs-security.html',
      '/admin/security-monitoring.html', '/admin/system-errors/system-errors.html',
      '/admin/settings.html', '/admin/system-settings.html', '/admin/system-testing.html',
      '/admin/multi-currency-settings.html', '/admin/theme-customization.html',
      '/admin/cms-management.html', '/admin/email-sms-templates.html',
      '/admin/tax-commission.html', '/admin/local-market-admin.html',
      '/admin/grocery-management.html', '/admin/location-dashboard.html',

      // Grocery/Local Market pages
      '/grocery/local-market-home.html', '/grocery/grocery-home.html', '/grocery/products.html',
      '/grocery/grocery-products.html', '/grocery/grocery-product-detail.html',
      '/grocery/cart.html', '/grocery/grocery-cart-preview.html', '/grocery/checkout.html',
      '/grocery/grocery-checkout.html', '/grocery/orders.html', '/grocery/grocery-orders.html',
      '/grocery/grocery-order-detail.html', '/grocery/order-success.html',
      '/grocery/grocery-categories.html', '/grocery/grocery-messages.html',
      '/grocery/grocery-message-thread.html', '/grocery/grocery-notifications.html',
      '/grocery/grocery-reviews.html', '/grocery/grocery-returns.html',
      '/grocery/grocery-return-detail.html', '/grocery/grocery-returns-policy.html',
      '/grocery/grocery-support.html'
    ];

    return validPages.includes(path);
  }

  fixCurrentPage() {
    const currentPath = window.location.pathname;
    
    // Try to find a similar valid page
    const similarPage = this.findSimilarPage(currentPath);
    
    if (similarPage) {
      console.log(`Redirecting to similar page: ${similarPage}`);
      window.location.replace(similarPage);
    } else {
      // Redirect to appropriate fallback
      const fallback = this.getFallbackPage(currentPath);
      console.log(`Redirecting to fallback: ${fallback}`);
      window.location.replace(fallback);
    }
  }

  findSimilarPage(path) {
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return '/public/index.html';
    }

    const role = segments[0];
    const page = segments[1];

    // Try role-based fallbacks
    const roleFallbacks = {
      buyer: '/buyer/buyers-home.html',
      seller: '/seller/dashboard.html',
      agent: '/agent/dashboard.html',
      admin: '/admin/dashboard.html',
      public: '/public/index.html',
      grocery: '/grocery/local-market-home.html'
    };

    if (roleFallbacks[role]) {
      return roleFallbacks[role];
    }

    // Try to fix common page name issues
    if (page) {
      const fixedPage = this.fixPageName(page);
      const fixedPath = `/${role}/${fixedPage}`;
      if (this.isValidPage(fixedPath)) {
        return fixedPath;
      }
    }

    return null;
  }

  fixPageName(page) {
    // Common page name fixes
    const fixes = {
      'home': 'buyers-home.html',
      'dashboard': 'dashboard.html',
      'products': 'products.html',
      'product': 'products.html',
      'orders': 'orders.html',
      'order': 'orders.html',
      'cart': 'cart.html',
      'checkout': 'checkout.html',
      'profile': 'profile.html',
      'settings': 'settings.html',
      'messages': 'messages.html',
      'notifications': 'notifications.html',
      'support': 'support.html',
      'wallet': 'wallet.html',
      'analytics': 'analytics.html',
      'inventory': 'inventory.html',
      'reviews': 'reviews.html'
    };

    const baseName = page.replace('.html', '');
    return fixes[baseName] || page;
  }

  getFallbackPage(path) {
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length > 0) {
      const role = segments[0];
      
      const fallbacks = {
        buyer: '/buyer/buyers-home.html',
        seller: '/seller/dashboard.html',
        agent: '/agent/dashboard.html',
        admin: '/admin/dashboard.html',
        grocery: '/grocery/local-market-home.html',
        auth: '/auth/auth-buyer.html'
      };

      return fallbacks[role] || '/public/index.html';
    }

    return '/public/index.html';
  }

  validatePageLinks() {
    const links = document.querySelectorAll('a[href]');
    const brokenLinks = [];
    const fixedLinks = [];

    links.forEach(link => {
      const href = link.getAttribute('href');
      
      // Skip external links and special protocols
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
        return;
      }

      // Check if link is valid
      if (!this.isValidPage(href)) {
        const fixedHref = this.fixLink(href);
        
        if (fixedHref && fixedHref !== href) {
          link.setAttribute('href', fixedHref);
          
          // Add data-route if missing
          if (!link.hasAttribute('data-route')) {
            const route = this.pathToRoute(fixedHref);
            if (route) {
              link.setAttribute('data-route', route);
            }
          }
          
          fixedLinks.push({
            original: href,
            fixed: fixedHref,
            element: link
          });
        } else {
          brokenLinks.push({
            href: href,
            element: link,
            text: link.textContent.trim()
          });
        }
      }
    });

    this.validationResults.brokenLinks = brokenLinks;
    this.validationResults.fixedLinks = fixedLinks;

    if (fixedLinks.length > 0) {
      console.log(`✅ Fixed ${fixedLinks.length} broken links`);
    }

    if (brokenLinks.length > 0) {
      console.warn(`⚠️ Found ${brokenLinks.length} broken links that couldn't be fixed`);
    }
  }

  fixLink(href) {
    // Try to fix common link issues
    const fixes = [
      // Fix missing .html extension
      (link) => {
        if (!link.includes('.html') && !link.includes('?') && !link.includes('#')) {
          return link + '.html';
        }
        return null;
      },
      
      // Fix incorrect paths
      (link) => {
        const segments = link.split('/').filter(Boolean);
        if (segments.length >= 2) {
          const role = segments[0];
          const page = segments[1];
          
          // Try common role/page combinations
          const commonPages = {
            buyer: ['buyers-home.html', 'products.html', 'cart.html', 'orders.html', 'profile.html'],
            seller: ['dashboard.html', 'products.html', 'add-product.html', 'orders.html', 'analytics.html'],
            agent: ['dashboard.html', 'orders.html', 'deliveries.html', 'earnings.html'],
            admin: ['dashboard.html', 'user-management.html', 'products.html', 'orders.html', 'settings.html'],
            public: ['index.html', 'about.html', 'contact.html', 'products.html', 'categories.html'],
            grocery: ['local-market-home.html', 'products.html', 'cart.html', 'checkout.html']
          };
          
          if (commonPages[role]) {
            const fixedPage = this.findClosestMatch(page, commonPages[role]);
            if (fixedPage) {
              return `/${role}/${fixedPage}`;
            }
          }
        }
        return null;
      },
      
      // Fix grocery/local market links
      (link) => {
        if (link.includes('local-market') || link.includes('grocery')) {
          if (link.includes('/buyer/local-market')) {
            return link.replace('/buyer/local-market', '/grocery/local-market-home.html');
          }
          if (link.includes('/grocery/') && !link.includes('.html')) {
            return link + '.html';
          }
        }
        return null;
      }
    ];

    for (const fix of fixes) {
      const fixedLink = fix(href);
      if (fixedLink && this.isValidPage(fixedLink)) {
        return fixedLink;
      }
    }

    return null;
  }

  findClosestMatch(target, options) {
    const targetLower = target.toLowerCase().replace('.html', '');
    
    // Exact match
    for (const option of options) {
      if (option.toLowerCase().replace('.html', '') === targetLower) {
        return option;
      }
    }

    // Partial match
    for (const option of options) {
      const optionLower = option.toLowerCase().replace('.html', '');
      if (optionLower.includes(targetLower) || targetLower.includes(optionLower)) {
        return option;
      }
    }

    return null;
  }

  pathToRoute(path) {
    // Convert path to route key
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return 'home';
    }

    const role = segments[0];
    const page = segments[1]?.replace('.html', '');

    if (role === 'public') {
      return page ? `public.${page}` : 'home';
    }

    if (['buyer', 'seller', 'agent', 'admin'].includes(role)) {
      if (!page || page === 'dashboard' || (role === 'buyer' && page === 'buyers-home')) {
        return `${role}.dashboard`;
      }
      
      // Map common page names to route keys
      const pageMap = {
        'product-list': 'products',
        'add-product': 'add-product',
        'add-grocery-product': 'add-product',
        'buyers-home': 'dashboard',
        'order-detail': 'order-detail',
        'track-order': 'track-order',
        'edit-profile': 'edit-profile'
      };

      const routePage = pageMap[page] || page;
      return `${role}.${routePage}`;
    }

    if (role === 'grocery') {
      const groceryPageMap = {
        'local-market-home': 'dashboard',
        'grocery-product-list': 'products',
        'grocery-product-detail': 'product-detail',
        'grocery-checkout': 'checkout',
        'grocery-orders': 'orders',
        'grocery-order-detail': 'order-detail'
      };

      const routePage = groceryPageMap[page] || page;
      return `buyer.${routePage}`;
    }

    if (role === 'auth') {
      const authPageMap = {
        'auth-buyer': 'login',
        'auth-seller': 'login-seller',
        'auth-agent': 'login-agent',
        'auth-admin': 'login-admin',
        'forgot-password': 'forgot-password',
        'reset-password': 'reset-password',
        'verify-email': 'verify-email',
        'verify-phone': 'verify-phone'
      };

      const routePage = authPageMap[page] || page;
      return `auth.${routePage}`;
    }

    return null;
  }

  setupLinkValidation() {
    // Validate links when page loads
    document.addEventListener('DOMContentLoaded', () => {
      this.validatePageLinks();
    });

    // Validate links when they're clicked
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link) {
        const href = link.getAttribute('href');
        
        // Skip external links
        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }

        // Check if link is valid
        if (!this.isValidPage(href)) {
          e.preventDefault();
          
          const fixedHref = this.fixLink(href);
          if (fixedHref) {
            console.log(`Fixed broken link: ${href} → ${fixedHref}`);
            link.setAttribute('href', fixedHref);
            
            // Navigate to fixed link
            if (this.router) {
              const route = this.pathToRoute(fixedHref);
              if (route) {
                this.router.navigate(route);
              } else {
                window.location.href = fixedHref;
              }
            } else {
              window.location.href = fixedHref;
            }
          } else {
            console.warn(`Broken link detected: ${href}`);
            // Navigate to fallback
            const fallback = this.getFallbackPage(href);
            window.location.href = fallback;
          }
        }
      }
    });
  }

  // Create missing pages
  createMissingPages() {
    const missingPages = this.identifyMissingPages();
    
    missingPages.forEach(page => {
      console.log(`Creating missing page: ${page.path}`);
      this.createPageTemplate(page);
    });
  }

  identifyMissingPages() {
    const requiredPages = [
      // Essential buyer pages for local market
      { path: '/grocery/grocery-product-detail.html', template: 'product-detail', role: 'buyer' },
      { path: '/grocery/grocery-cart-preview.html', template: 'cart', role: 'buyer' },
      
      // Essential seller pages for local market
      { path: '/seller/add-local-market-product.html', template: 'add-product', role: 'seller' },
      
      // Essential agent pages for local market
      { path: '/agent/local-market-dashboard.html', template: 'dashboard', role: 'agent' }
    ];

    return requiredPages.filter(page => !this.isValidPage(page.path));
  }

  createPageTemplate(pageInfo) {
    // This would create basic page templates
    // For now, we'll just log what needs to be created
    console.log(`Template needed for: ${pageInfo.path} (${pageInfo.template} for ${pageInfo.role})`);
  }

  // Validation report
  generateValidationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      currentPage: window.location.pathname,
      isCurrentPageValid: this.isValidPage(window.location.pathname),
      brokenLinksCount: this.validationResults.brokenLinks.length,
      fixedLinksCount: this.validationResults.fixedLinks.length,
      brokenLinks: this.validationResults.brokenLinks,
      fixedLinks: this.validationResults.fixedLinks,
      recommendations: this.generateRecommendations()
    };

    console.log('📊 Page Validation Report:', report);
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.validationResults.brokenLinks.length > 0) {
      recommendations.push('Fix broken links to improve user experience');
    }

    if (this.validationResults.fixedLinks.length > 0) {
      recommendations.push('Review automatically fixed links for accuracy');
    }

    if (!this.isValidPage(window.location.pathname)) {
      recommendations.push('Current page path is invalid and should be fixed');
    }

    return recommendations;
  }

  // Public API
  validatePage(path = window.location.pathname) {
    return this.isValidPage(path);
  }

  fixPageLinks() {
    this.validatePageLinks();
    return this.validationResults.fixedLinks.length;
  }

  getValidationResults() {
    return this.validationResults;
  }
}

// Create global instance
window.pageValidator = new PageValidator();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageValidator;
}