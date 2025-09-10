/**
 * Enhanced Image Handling Utilities
 * Provides robust image loading with fallbacks and error handling
 */

// Enhanced Image URL Processing Function
function processImageUrl(imageUrl, type = 'general') {
  if (!imageUrl) return null;
  
  // If already a complete URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // If starts with /, make it relative to server
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // Otherwise, assume it's a relative path and prepend /uploads/
  return '/uploads/' + imageUrl;
}

// Create fallback element for failed images
function createImageFallback(type, name, className = '') {
  const fallback = document.createElement('div');
  fallback.className = className + ' flex items-center justify-center text-white font-bold';
  
  switch(type) {
    case 'partner':
      fallback.className += ' bg-gradient-to-br from-blue-500 to-purple-600';
      fallback.innerHTML = `<span class="text-lg">${name.charAt(0).toUpperCase()}</span>`;
      break;
    case 'service':
      fallback.className += ' bg-gradient-to-br from-green-500 to-blue-600';
      fallback.innerHTML = `<span class="text-2xl">🔗</span>`;
      break;
    case 'promotion':
      fallback.className += ' bg-gradient-to-br from-orange-500 to-red-600';
      fallback.innerHTML = `<span class="text-2xl">🎯</span>`;
      break;
    case 'product':
      fallback.className += ' bg-gradient-to-br from-gray-400 to-gray-600';
      fallback.innerHTML = `<span class="text-xl">📦</span>`;
      break;
    default:
      fallback.className += ' bg-gradient-to-br from-gray-500 to-gray-700';
      fallback.innerHTML = `<span class="text-xl">📷</span>`;
  }
  
  return fallback;
}

// Enhanced image error handler
function handleImageError(imgElement, fallbackType, name) {
  imgElement.style.display = 'none';
  
  // Create fallback element
  const fallback = createImageFallback(fallbackType, name, imgElement.className);
  
  // Insert fallback after the image
  imgElement.parentNode.insertBefore(fallback, imgElement.nextSibling);
}

// Initialize image error handlers for existing images
function initializeImageHandlers() {
  // Partner images
  document.querySelectorAll('img[alt*="partner" i], img[src*="partner"], .partner-logo img').forEach(img => {
    img.onerror = () => handleImageError(img, 'partner', img.alt || 'Partner');
  });
  
  // Service images  
  document.querySelectorAll('img[alt*="service" i], img[src*="service"], .service-icon img').forEach(img => {
    img.onerror = () => handleImageError(img, 'service', img.alt || 'Service');
  });
  
  // Promotion images
  document.querySelectorAll('img[alt*="promotion" i], img[src*="promotion"]').forEach(img => {
    img.onerror = () => handleImageError(img, 'promotion', img.alt || 'Promotion');
  });
  
  // Product images
  document.querySelectorAll('img[alt*="product" i], img[src*="product"]').forEach(img => {
    img.onerror = () => handleImageError(img, 'product', img.alt || 'Product');
  });
  
  // General images
  document.querySelectorAll('img:not([data-fallback-handled])').forEach(img => {
    img.setAttribute('data-fallback-handled', 'true');
    img.onerror = () => handleImageError(img, 'general', img.alt || 'Image');
  });
}

// Sample data for when API fails
const SAMPLE_PARTNERS = [
  {
    id: 1,
    name: 'AC Group Rwanda',
    description: 'Leading technology and business solutions provider in East Africa',
    logo_url: '/public/images/partners/ac-group-logo.svg',
    link: 'https://acgroup.rw'
  },
  {
    id: 2,
    name: 'Bank of Kigali',
    description: 'Premier financial services institution providing comprehensive banking solutions',
    logo_url: '/public/images/partners/bok-logo.svg',
    link: 'https://bok.rw'
  },
  {
    id: 3,
    name: 'MTN Rwanda',
    description: 'Leading telecommunications provider offering mobile and digital services',
    logo_url: '/public/images/partners/mtn-logo.svg',
    link: 'https://mtn.rw'
  }
];

const SAMPLE_SERVICES = [
  {
    id: 1,
    name: 'Business Consulting',
    description: 'Professional business advisory and strategic planning services',
    icon: '💼',
    image_url: null,
    link: '/services/consulting'
  },
  {
    id: 2,
    name: 'Digital Marketing',
    description: 'Comprehensive digital marketing and social media management',
    icon: '📱',
    image_url: null,
    link: '/services/marketing'
  },
  {
    id: 3,
    name: 'Web Development',
    description: 'Custom website and application development services',
    icon: '🌐',
    image_url: null,
    link: '/services/web-development'
  },
  {
    id: 4,
    name: 'Financial Services',
    description: 'Investment planning, loans, and financial advisory services',
    icon: '💰',
    image_url: null,
    link: '/services/financial'
  }
];

const SAMPLE_PROMOTIONS = [
  {
    id: 1,
    title: 'New Year Electronics Sale',
    description: 'Get amazing discounts on the latest electronics this New Year! Up to 50% off on smartphones, laptops, and home appliances.',
    image_url: '/public/images/promotions/new-year-electronics.svg',
    promotion_type: 'Sale',
    discount_percentage: 50,
    valid_until: '2024-02-15',
    link: '/promotions/new-year-electronics'
  },
  {
    id: 2,
    title: 'Free Delivery Campaign',
    description: 'Enjoy free delivery on all orders above $50. Fast, reliable, and secure delivery to your doorstep.',
    image_url: '/public/images/promotions/free-delivery.svg',
    promotion_type: 'Free Delivery',
    discount_percentage: null,
    valid_until: '2024-03-31',
    link: '/promotions/free-delivery'
  }
];

// Enhanced fetch with fallback data
async function fetchWithFallback(url, fallbackData) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data && data.success && data.partners && data.partners.length > 0) {
      return data.partners;
    } else if (data && data.success && data.services && data.services.length > 0) {
      return data.services;
    } else if (data && data.success && data.promotions && data.promotions.length > 0) {
      return data.promotions;
    } else {
      throw new Error('No data received');
    }
  } catch (error) {
    console.warn(`⚠️ Failed to fetch from ${url}, using fallback data:`, error.message);
    return fallbackData;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeImageHandlers);
} else {
  initializeImageHandlers();
}

// Expose functions globally
window.processImageUrl = processImageUrl;
window.handleImageError = handleImageError;
window.initializeImageHandlers = initializeImageHandlers;
window.createImageFallback = createImageFallback;
window.fetchWithFallback = fetchWithFallback;
window.SAMPLE_PARTNERS = SAMPLE_PARTNERS;
window.SAMPLE_SERVICES = SAMPLE_SERVICES;
window.SAMPLE_PROMOTIONS = SAMPLE_PROMOTIONS;