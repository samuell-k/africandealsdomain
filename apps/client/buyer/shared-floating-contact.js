/**
 * Shared Floating Contact Script for All Buyer Pages
 * Auto-loads the floating contact component
 */

(function() {
  'use strict';

  // Auto-load floating contact component on all buyer pages
  function loadFloatingContact() {
    // Check if component is already loaded
    if (window.FloatingContact && typeof window.FloatingContact.init === 'function') {
      console.log('[SHARED-FLOATING] FloatingContact already loaded, initializing...');
      window.FloatingContact.init();
      return;
    }

    // Load the component script
    const script = document.createElement('script');
    script.src = '/buyer/floating-contact-component.js';
    script.onload = function() {
      console.log('[SHARED-FLOATING] FloatingContact component loaded successfully');
      // Component should auto-initialize
    };
    script.onerror = function() {
      console.error('[SHARED-FLOATING] Failed to load FloatingContact component');
    };
    
    document.head.appendChild(script);
  }

  // Page-specific customizations
  function customizeForPage() {
    const currentPage = window.location.pathname;
    
    // Customize messages based on page
    if (currentPage.includes('product-detail')) {
      // Product detail specific messages will be handled by the component
      console.log('[SHARED-FLOATING] Product detail page detected');
    } else if (currentPage.includes('cart')) {
      console.log('[SHARED-FLOATING] Cart page detected');
    } else if (currentPage.includes('orders')) {
      console.log('[SHARED-FLOATING] Orders page detected');
    } else {
      console.log('[SHARED-FLOATING] General buyer page detected');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadFloatingContact();
      customizeForPage();
    });
  } else {
    loadFloatingContact();
    customizeForPage();
  }

  console.log('[SHARED-FLOATING] Shared floating contact script loaded');

})();