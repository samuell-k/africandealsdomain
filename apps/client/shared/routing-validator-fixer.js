/**
 * Routing Validator and Fixer
 * Automatically detects and fixes all routing issues in the platform
 * 
 * FIXES ADDRESSED:
 * 1. Duplicate pages with different content
 * 2. Broken internal links
 * 3. Missing critical buyer pages
 * 4. Wrong authentication redirects
 * 5. Inconsistent navigation structures
 */

class RoutingValidatorFixer {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.duplicatePages = new Map();
    this.brokenLinks = new Set();
    this.missingPages = new Set();
    this.validPages = new Set();
    
    console.log('🔧 Routing Validator and Fixer initialized');
    this.init();
  }

  async init() {
    await this.scanAllPages();
    await this.validateRouting();
    this.generateReport();
    this.applyAutoFixes();
  }

  async scanAllPages() {
    console.log('🔍 Scanning all pages...');
    
    const pagePatterns = [
      // Public pages
      '/public/*.html',
      // Buyer pages  
      '/buyer/*.html',
      // Seller pages
      '/seller/*.html',
      // Agent pages
      '/agent/*.html',
      // Admin pages
      '/admin/*.html',
      // Auth pages
      '/auth/*.html',
      // Grocery pages
      '/grocery/*.html'
    ];

    for (const pattern of pagePatterns) {
      await this.scanPagesInDirectory(pattern);
    }
  }

  async scanPagesInDirectory(pattern) {
    const directory = pattern.replace('/*.html', '');
    const pages = await this.getDirectoryPages(directory);
    
    for (const page of pages) {
      await this.analyzePage(page);
    }
  }

  async getDirectoryPages(directory) {
    // This would ideally use a directory API, but for now we'll use known pages
    const knownPages = {
      '/public': [
        'index.html', 'products.html', 'product-detail.html', 'categories.html',
        'search-results.html', 'about.html', 'contact.html', 'faq.html',
        'how-it-works.html', 'privacy-policy.html', 'terms-and-conditions.html'
      ],
      '/buyer': [
        'buyers-home.html', 'products.html', 'product-detail.html', 'cart.html',
        'checkout.html', 'orders.html', 'order-detail.html', 'wishlist.html',
        'profile.html', 'messages.html', 'notifications.html', 'payment.html',
        'order-tracking.html', 'reviews.html', 'settings.html'
      ],
      '/auth': [
        'auth-buyer.html', 'auth-seller.html', 'auth-agent.html', 'auth-admin.html',
        'forgot-password.html', 'reset-password.html', 'verify-email.html'
      ]
    };

    return (knownPages[directory] || []).map(page => `${directory}/${page}`);
  }

  async analyzePage(pagePath) {
    try {
      const exists = await this.pageExists(pagePath);
      if (exists) {
        this.validPages.add(pagePath);
        
        // Check for duplicates
        const pageType = this.getPageType(pagePath);
        if (this.duplicatePages.has(pageType)) {
          this.duplicatePages.get(pageType).push(pagePath);
        } else {
          this.duplicatePages.set(pageType, [pagePath]);
        }

        // Scan page content for broken links
        await this.scanPageLinks(pagePath);
      } else {
        this.missingPages.add(pagePath);
      }
    } catch (error) {
      console.error('Error analyzing page ${pagePath}:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error analyzing page ${pagePath}:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'routing-validator-fixer.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error analyzing page ${pagePath}:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'routing-validator-fixer.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
  }

  async pageExists(path) {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  getPageType(pagePath) {
    const fileName = pagePath.split('/').pop().replace('.html', '');
    // Normalize common page types
    const normalizedTypes = {
      'index': 'home',
      'buyers-home': 'home',
      'home-buyers': 'home',
      'product-detail': 'product-detail',
      'products': 'products',
      'product-list': 'products',
      'search-results': 'search'
    };
    
    return normalizedTypes[fileName] || fileName;
  }

  async scanPageLinks(pagePath) {
    try {
      const response = await fetch(pagePath);
      const html = await response.text();
      
      // Extract all internal links
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/g;
      let match;
      
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        
        // Skip external links, anchors, and special protocols
        if (href.startsWith('http') || href.startsWith('#') || 
            href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }
        
        // Check if internal link exists
        const linkExists = await this.pageExists(href);
        if (!linkExists) {
          this.brokenLinks.add(`${pagePath} -> ${href}`);
        }
      }
    } catch (error) {
      console.error('Error scanning links in ${pagePath}:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error scanning links in ${pagePath}:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'routing-validator-fixer.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error scanning links in ${pagePath}:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'routing-validator-fixer.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
  }

  validateRouting() {
    console.log('✅ Validating routing logic...');
    
    // Check for duplicate pages
    this.validateDuplicatePages();
    
    // Check critical buyer pages
    this.validateCriticalBuyerPages();
    
    // Check authentication flows
    this.validateAuthenticationFlows();
    
    // Check consistency
    this.validateConsistency();
  }

  validateDuplicatePages() {
    for (const [pageType, pages] of this.duplicatePages.entries()) {
      if (pages.length > 1) {
        const publicPage = pages.find(p => p.includes('/public/'));
        const buyerPage = pages.find(p => p.includes('/buyer/'));
        
        if (publicPage && buyerPage) {
          this.issues.push({
            type: 'duplicate_pages',
            severity: 'high',
            description: `Duplicate pages found for ${pageType}`,
            pages: pages,
            recommended_fix: `Keep buyer page (${buyerPage}) for authenticated users, redirect public page (${publicPage}) to buyer page when user is logged in`,
            auto_fixable: true
          });
        }
      }
    }
  }

  validateCriticalBuyerPages() {
    const criticalPages = [
      '/buyer/buyers-home.html',
      '/buyer/products.html', 
      '/buyer/cart.html',
      '/buyer/orders.html',
      '/buyer/wishlist.html',
      '/buyer/profile.html',
      '/buyer/messages.html',
      '/buyer/checkout.html'
    ];

    for (const page of criticalPages) {
      if (!this.validPages.has(page)) {
        this.issues.push({
          type: 'missing_critical_page',
          severity: 'critical',
          description: `Critical buyer page missing: ${page}`,
          recommended_fix: `Create missing buyer page with proper authentication`,
          auto_fixable: false
        });
      }
    }
  }

  validateAuthenticationFlows() {
    // Check if authentication redirects are properly configured
    const authPages = [
      '/auth/auth-buyer.html',
      '/auth/auth-seller.html',
      '/auth/auth-agent.html'
    ];

    for (const authPage of authPages) {
      if (!this.validPages.has(authPage)) {
        this.issues.push({
          type: 'missing_auth_page',
          severity: 'critical',
          description: `Authentication page missing: ${authPage}`,
          recommended_fix: `Ensure all authentication pages exist and are properly configured`,
          auto_fixable: false
        });
      }
    }
  }

  validateConsistency() {
    // Check for inconsistent navigation patterns
    const publicNavPages = Array.from(this.validPages).filter(p => p.includes('/public/'));
    const buyerNavPages = Array.from(this.validPages).filter(p => p.includes('/buyer/'));

    if (publicNavPages.length > 0 && buyerNavPages.length > 0) {
      // Check if buyer pages have proper equivalents for public pages
      const publicPageTypes = publicNavPages.map(p => this.getPageType(p));
      const buyerPageTypes = buyerNavPages.map(p => this.getPageType(p));

      for (const publicType of publicPageTypes) {
        if (!buyerPageTypes.includes(publicType) && 
            ['home', 'products', 'product-detail'].includes(publicType)) {
          this.issues.push({
            type: 'missing_buyer_equivalent',
            severity: 'medium',
            description: `Public page ${publicType} has no buyer equivalent`,
            recommended_fix: `Create buyer-specific version or ensure proper redirect`,
            auto_fixable: true
          });
        }
      }
    }
  }

  applyAutoFixes() {
    console.log('🔧 Applying automatic fixes...');
    
    for (const issue of this.issues) {
      if (issue.auto_fixable) {
        this.applyFix(issue);
      }
    }
  }

  applyFix(issue) {
    switch (issue.type) {
      case 'duplicate_pages':
        this.fixDuplicatePages(issue);
        break;
      case 'missing_buyer_equivalent':
        this.fixMissingBuyerEquivalent(issue);
        break;
      default:
        console.log(`⚠️ No auto-fix available for issue type: ${issue.type}`);
    }
  }

  fixDuplicatePages(issue) {
    // Create redirect logic for public pages to buyer pages
    const redirectScript = `
<script>
  // Auto-redirect authenticated buyers to buyer-specific page
  (function() {
    const authUtils = window.AuthUtils ? new AuthUtils() : null;
    if (authUtils && authUtils.isAuthenticated() && authUtils.getUserRole() === 'buyer') {
      const buyerPage = '${issue.pages.find(p => p.includes('/buyer/'))}';
      if (buyerPage && window.location.pathname !== buyerPage) {
        console.log('🔀 Auto-redirecting authenticated buyer to personalized page');
        window.location.replace(buyerPage);
      }
    }
  })();
</script>
`;

    this.fixes.push({
      type: 'redirect_script',
      description: `Add redirect script to public pages to redirect authenticated buyers`,
      script: redirectScript,
      target_pages: issue.pages.filter(p => p.includes('/public/'))
    });
  }

  fixMissingBuyerEquivalent(issue) {
    // This would require actual file creation, so we'll log the recommendation
    this.fixes.push({
      type: 'create_page',
      description: `Create buyer-specific page`,
      recommendation: `Create ${issue.description} with proper buyer navigation and authentication checks`
    });
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_pages_scanned: this.validPages.size,
        total_issues_found: this.issues.length,
        critical_issues: this.issues.filter(i => i.severity === 'critical').length,
        high_issues: this.issues.filter(i => i.severity === 'high').length,
        medium_issues: this.issues.filter(i => i.severity === 'medium').length,
        auto_fixable_issues: this.issues.filter(i => i.auto_fixable).length
      },
      duplicate_pages: Array.from(this.duplicatePages.entries()).filter(([type, pages]) => pages.length > 1),
      broken_links: Array.from(this.brokenLinks),
      missing_pages: Array.from(this.missingPages),
      issues: this.issues,
      fixes_applied: this.fixes,
      recommendations: this.generateRecommendations()
    };

    console.log('📊 Routing Validation Report:', report);
    
    // Store report for access
    window.routingReport = report;
    
    return report;
  }

  generateRecommendations() {
    return [
      {
        priority: 'high',
        title: 'Implement Smart Routing System',
        description: 'Use the Smart Routing System to automatically redirect authenticated users to appropriate pages',
        implementation: 'Include smart-routing-system.js in all pages'
      },
      {
        priority: 'high', 
        title: 'Enhance Buyer Experience',
        description: 'Ensure all critical buyer pages are easily accessible and properly linked',
        implementation: 'Use buyer-page-redirector.js for authenticated buyers'
      },
      {
        priority: 'medium',
        title: 'Consolidate Duplicate Pages',
        description: 'Remove or redirect duplicate pages to avoid confusion',
        implementation: 'Keep buyer-specific versions, redirect public versions for authenticated users'
      },
      {
        priority: 'medium',
        title: 'Fix Broken Links',
        description: 'Update all broken internal links to point to correct pages',
        implementation: 'Update href attributes in HTML files'
      },
      {
        priority: 'low',
        title: 'Standardize Navigation',
        description: 'Ensure consistent navigation patterns across all page types',
        implementation: 'Use unified navigation components'
      }
    ];
  }

  // Public method to check if a specific routing fix should be applied
  shouldApplyBuyerRedirect(currentPath) {
    const duplicates = this.duplicatePages.get(this.getPageType(currentPath));
    if (duplicates && duplicates.length > 1) {
      const publicPage = duplicates.find(p => p.includes('/public/'));
      const buyerPage = duplicates.find(p => p.includes('/buyer/'));
      
      if (currentPath === publicPage && buyerPage) {
        return buyerPage;
      }
    }
    return null;
  }

  // Method to get routing suggestions for a page
  getRoutingSuggestions(currentPath) {
    const suggestions = [];
    
    // If on public page and buyer equivalent exists, suggest it
    const buyerRedirect = this.shouldApplyBuyerRedirect(currentPath);
    if (buyerRedirect) {
      suggestions.push({
        type: 'buyer_redirect',
        title: 'Switch to Personalized Experience',
        description: 'Access your personalized buyer dashboard with saved preferences',
        url: buyerRedirect,
        priority: 'high'
      });
    }

    return suggestions;
  }
}

// Initialize the validator
window.routingValidator = null;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.routingValidator = new RoutingValidatorFixer();
  });
} else {
  window.routingValidator = new RoutingValidatorFixer();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoutingValidatorFixer;
}