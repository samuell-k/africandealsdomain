// Mock database for local market development
const fs = require('fs');
const path = require('path');

// Simple file-based storage for development
const dataDir = path.join(__dirname, 'mock-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Mock products data
const mockProducts = [
  {
    id: 1,
    product_name: 'Fresh Tomatoes',
    description: 'Locally grown fresh tomatoes',
    price_per_unit: 500,
    unit_type: 'kg',
    stock_quantity: 50,
    category: 'Vegetables',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 1,
    seller_name: 'Green Farm Market',
    distance: 0.5,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    product_name: 'Organic Bananas',
    description: 'Sweet organic bananas',
    price_per_unit: 800,
    unit_type: 'kg',
    stock_quantity: 30,
    category: 'Fruits',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 2,
    seller_name: 'Tropical Fruits Co',
    distance: 1.2,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    product_name: 'Fresh Milk',
    description: 'Farm fresh milk',
    price_per_unit: 1200,
    unit_type: 'liter',
    stock_quantity: 20,
    category: 'Dairy',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 3,
    seller_name: 'Dairy Fresh Ltd',
    distance: 0.8,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    product_name: 'White Rice',
    description: 'Premium white rice',
    price_per_unit: 1500,
    unit_type: 'kg',
    stock_quantity: 100,
    category: 'Grains',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 4,
    seller_name: 'Grain Masters',
    distance: 2.1,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    product_name: 'Fresh Bread',
    description: 'Daily baked fresh bread',
    price_per_unit: 300,
    unit_type: 'loaf',
    stock_quantity: 25,
    category: 'Bakery',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 5,
    seller_name: 'City Bakery',
    distance: 0.3,
    created_at: new Date().toISOString()
  },
  {
    id: 6,
    product_name: 'Chicken Eggs',
    description: 'Farm fresh chicken eggs',
    price_per_unit: 200,
    unit_type: 'piece',
    stock_quantity: 60,
    category: 'Dairy',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 6,
    seller_name: 'Poultry Farm Direct',
    distance: 1.5,
    created_at: new Date().toISOString()
  },
  {
    id: 7,
    product_name: 'Sweet Potatoes',
    description: 'Organic sweet potatoes',
    price_per_unit: 400,
    unit_type: 'kg',
    stock_quantity: 40,
    category: 'Vegetables',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 1,
    seller_name: 'Green Farm Market',
    distance: 0.5,
    created_at: new Date().toISOString()
  },
  {
    id: 8,
    product_name: 'Fresh Fish',
    description: 'Daily catch fresh fish',
    price_per_unit: 2500,
    unit_type: 'kg',
    stock_quantity: 15,
    category: 'Seafood',
    main_image: '/public/images/placeholder-product.jpg',
    seller_id: 7,
    seller_name: 'Lake Fish Market',
    distance: 3.2,
    created_at: new Date().toISOString()
  }
];

// Mock database functions
class MockLocalMarketDB {
  constructor() {
    this.products = mockProducts;
    this.orders = [];
    this.users = [];
  }

  // Get products with optional filters
  async getProducts(options = {}) {
    const { limit = 12, offset = 0, lat, lng, category } = options;
    
    let filteredProducts = [...this.products];
    
    // Filter by category if provided
    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Sort by distance if location provided
    if (lat && lng) {
      filteredProducts = filteredProducts.sort((a, b) => a.distance - b.distance);
    }
    
    // Apply pagination
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);
    
    return {
      success: true,
      products: paginatedProducts,
      total: filteredProducts.length,
      hasMore: offset + limit < filteredProducts.length
    };
  }

  // Get nearby products
  async getNearbyProducts(lat, lng, options = {}) {
    const { limit = 12, offset = 0 } = options;
    
    // Sort by distance and return
    const sortedProducts = [...this.products].sort((a, b) => a.distance - b.distance);
    const paginatedProducts = sortedProducts.slice(offset, offset + limit);
    
    return {
      success: true,
      products: paginatedProducts,
      total: sortedProducts.length,
      hasMore: offset + limit < sortedProducts.length
    };
  }

  // Get product by ID
  async getProductById(id) {
    const product = this.products.find(p => p.id == id);
    return product ? { success: true, product } : { success: false, error: 'Product not found' };
  }

  // Create order
  async createOrder(orderData) {
    const order = {
      id: Date.now(),
      ...orderData,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    this.orders.push(order);
    return { success: true, order };
  }

  // Get user orders
  async getUserOrders(userId) {
    const userOrders = this.orders.filter(o => o.user_id == userId);
    return { success: true, orders: userOrders };
  }
}

// Export singleton instance
module.exports = new MockLocalMarketDB();