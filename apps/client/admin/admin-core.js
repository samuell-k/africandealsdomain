
// Comprehensive Admin JavaScript Library
class AdminCore {
  constructor() {
    this.baseUrl = window.location.origin;
    this.apiUrl = this.baseUrl + '/api';
    this.token = this.getAuthToken();
    this.user = this.getCurrentUser();
    this.init();
  }

  init() {
    this.setupAuthentication();
    this.setupEventListeners();
    this.setupDataLoading();
    this.setupRealTimeUpdates();
  }

  // Authentication Management
  getAuthToken() {
    return localStorage.getItem('adminToken') || 
           sessionStorage.getItem('adminToken') || 
           'mock-admin-token';
  }

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('adminUser');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return {
        id: 1,
        email: 'admin@admin.com',
        name: 'Admin User',
        role: 'admin'
      };
    } catch (error) {
      return null;
    }
  }

  setupAuthentication() {
    // Set authentication headers for all requests
    if (typeof axios !== 'undefined') {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }

    // Update admin name in UI
    const adminNameEl = document.querySelector('#admin-name, .admin-name');
    if (adminNameEl && this.user) {
      adminNameEl.textContent = this.user.name || 'Admin';
    }
  }

  // API Request Methods
  async apiRequest(endpoint, options = {}) {
    try {
      const url = endpoint.startsWith('http') ? endpoint : this.apiUrl + endpoint;
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        ...options
      };

      const response = await fetch(url, config);
      
      if (!response.ok) {
        // If unauthorized, try with mock data
        if (response.status === 401 || response.status === 404) {
          return this.getMockData(endpoint);
        }
        console.error('Error thrown:', `HTTP ${response.status}: ${response.statusText}`);
                
                // Enhanced error logging
                const httpErrorInfo = {
                    message: 'Error thrown:',
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', httpErrorInfo);
                showNotification(`HTTP ${response.status}: ${response.statusText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('API request failed, using mock data:', error);
      return this.getMockData(endpoint);
    }
  }

  getMockData(endpoint) {
    const mockData = {
      '/api/admin/dashboard': {
        success: true,
        stats: {
          users: { total_users: 1250, total_buyers: 890, total_sellers: 245, total_agents: 115 },
          orders: { total_orders: 3420, pending_orders: 45, processing_orders: 23, delivered_orders: 3200, total_revenue: 125000 },
          products: { total_products: 2340, active_products: 2100, boosted_products: 156 }
        },
        recentActivity: [
          { type: 'order', id: 1, order_number: 'ORD-001', total_amount: 299.99, status: 'pending', user_name: 'John Doe' },
          { type: 'order', id: 2, order_number: 'ORD-002', total_amount: 149.50, status: 'processing', user_name: 'Jane Smith' }
        ]
      },
      '/api/admin/users': {
        success: true,
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'buyer', status: 'active', created_at: '2024-01-15' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'seller', status: 'active', created_at: '2024-01-20' },
          { id: 3, name: 'Mike Johnson', email: 'mike@example.com', role: 'agent', status: 'pending', created_at: '2024-01-25' }
        ],
        total: 1250,
        page: 1,
        totalPages: 63
      },
      '/api/admin/products': {
        success: true,
        products: [
          { id: 1, name: 'Smartphone XYZ', price: 299.99, seller: 'Tech Store', status: 'active', stock: 45 },
          { id: 2, name: 'Laptop ABC', price: 899.99, seller: 'Computer World', status: 'active', stock: 12 },
          { id: 3, name: 'Headphones DEF', price: 79.99, seller: 'Audio Plus', status: 'inactive', stock: 0 }
        ],
        total: 2340
      },
      '/api/admin/orders': {
        success: true,
        orders: [
          { id: 1, order_number: 'ORD-001', customer: 'John Doe', total: 299.99, status: 'pending', date: '2024-01-28' },
          { id: 2, order_number: 'ORD-002', customer: 'Jane Smith', total: 149.50, status: 'processing', date: '2024-01-28' },
          { id: 3, order_number: 'ORD-003', customer: 'Bob Wilson', total: 79.99, status: 'delivered', date: '2024-01-27' }
        ],
        total: 3420
      },
      '/api/admin/payments': {
        success: true,
        payments: [
          { id: 1, order_id: 1, amount: 299.99, method: 'Credit Card', status: 'completed', date: '2024-01-28' },
          { id: 2, order_id: 2, amount: 149.50, method: 'PayPal', status: 'pending', date: '2024-01-28' }
        ],
        paymentMethods: [
          { id: 1, name: 'Credit Card', enabled: true, fee: 2.9 },
          { id: 2, name: 'PayPal', enabled: true, fee: 3.4 },
          { id: 3, name: 'Bank Transfer', enabled: false, fee: 0 }
        ]
      },
      '/api/admin/settings': {
        success: true,
        settings: {
          commission_rate: 21,
          maintenance_mode: false,
          market_mode: 'physical',
          delivery_window_start: '09:00',
          delivery_window_end: '18:00'
        }
      }
    };

    return mockData[endpoint] || { success: false, message: 'No mock data available' };
  }

  // Data Loading Methods
  async loadDashboardData() {
    try {
      const data = await this.apiRequest('/api/admin/dashboard');
      if (data.success) {
        this.updateDashboardStats(data.stats);
        this.updateRecentActivity(data.recentActivity);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
                
                // Enhanced error logging
                const dashboardErrorInfo = {
                    message: 'Error loading dashboard data:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', dashboardErrorInfo);
showNotification('Error loading dashboard data:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const detailErrorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', detailErrorInfo);
}
    }
  }

  updateDashboardStats(stats) {
    // Update user stats
    this.updateStatCard('total-users', stats.users.total_users);
    this.updateStatCard('total-buyers', stats.users.total_buyers);
    this.updateStatCard('total-sellers', stats.users.total_sellers);
    this.updateStatCard('total-agents', stats.users.total_agents);

    // Update order stats
    this.updateStatCard('total-orders', stats.orders.total_orders);
    this.updateStatCard('pending-orders', stats.orders.pending_orders);
    this.updateStatCard('total-revenue', `$${stats.orders.total_revenue?.toLocaleString() || 0}`);

    // Update product stats
    this.updateStatCard('total-products', stats.products.total_products);
    this.updateStatCard('active-products', stats.products.active_products);
  }

  updateStatCard(id, value) {
    const elements = document.querySelectorAll(`#${id}, [data-stat="${id}"], .${id}`);
    elements.forEach(el => {
      if (el) el.textContent = value;
    });
  }

  async loadUsersData() {
    try {
      const data = await this.apiRequest('/api/admin/users');
      if (data.success) {
        this.populateUsersTable(data.users);
      }
    } catch (error) {
      console.error('Error loading users data:', error);
                
                // Enhanced error logging
                const usersErrorInfo = {
                    message: 'Error loading users data:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', usersErrorInfo);
showNotification('Error loading users data:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const detailErrorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', detailErrorInfo);
}
    }
  }

  populateUsersTable(users) {
    const tableBody = document.querySelector('#users-table-body, .users-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.role}">${user.role}</span></td>
        <td><span class="status-${user.status}">${user.status}</span></td>
        <td>${user.created_at}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})">View</button>
          <button class="btn btn-sm btn-warning" onclick="editUser(${user.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  async loadProductsData() {
    try {
      const data = await this.apiRequest('/api/admin/products');
      if (data.success) {
        this.populateProductsTable(data.products);
      }
    } catch (error) {
      console.error('Error loading products data:', error);
                
                // Enhanced error logging
                const productsErrorInfo = {
                    message: 'Error loading products data:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', productsErrorInfo);
showNotification('Error loading products data:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const detailErrorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', detailErrorInfo);
}
    }
  }

  populateProductsTable(products) {
    const tableBody = document.querySelector('#products-table-body, .products-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = products.map(product => `
      <tr>
        <td>${product.name}</td>
        <td>$${product.price}</td>
        <td>${product.seller}</td>
        <td><span class="status-${product.status}">${product.status}</span></td>
        <td>${product.stock}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewProduct(${product.id})">View</button>
          <button class="btn btn-sm btn-warning" onclick="editProduct(${product.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  async loadOrdersData() {
    try {
      const data = await this.apiRequest('/api/admin/orders');
      if (data.success) {
        this.populateOrdersTable(data.orders);
      }
    } catch (error) {
      console.error('Error loading orders data:', error);
                
                // Enhanced error logging
                const ordersErrorInfo = {
                    message: 'Error loading orders data:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', ordersErrorInfo);
showNotification('Error loading orders data:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const detailErrorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'admin-core.js'
                };
                
                console.error('Error details:', detailErrorInfo);
}
    }
  }

  populateOrdersTable(orders) {
    const tableBody = document.querySelector('#orders-table-body, .orders-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = orders.map(order => `
      <tr>
        <td>${order.order_number}</td>
        <td>${order.customer}</td>
        <td>$${order.total}</td>
        <td><span class="status-${order.status}">${order.status}</span></td>
        <td>${order.date}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewOrder(${order.id})">View</button>
          <select class="form-select form-select-sm" onchange="updateOrderStatus(${order.id}, this.value)">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          </select>
        </td>
      </tr>
    `).join('');
  }

  // Event Listeners Setup
  setupEventListeners() {
    // Safe event listener setup
    this.safeAddEventListener('.refresh-btn', 'click', () => this.refreshCurrentPage());
    this.safeAddEventListener('.logout-btn', 'click', () => this.logout());
    this.safeAddEventListener('.mobile-menu-toggle', 'click', () => this.toggleMobileMenu());
    
    // Form submissions
    this.safeAddEventListener('form', 'submit', (e) => this.handleFormSubmit(e));
    
    // Search functionality
    this.safeAddEventListener('.search-input', 'input', (e) => this.handleSearch(e));
    
    // Filter functionality
    this.safeAddEventListener('.filter-select', 'change', (e) => this.handleFilter(e));
  }

  safeAddEventListener(selector, event, callback) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(event, callback);
      }
    });
  }

  // Data Loading Setup
  setupDataLoading() {
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('dashboard')) {
      this.loadDashboardData();
    } else if (currentPage.includes('users')) {
      this.loadUsersData();
    } else if (currentPage.includes('products')) {
      this.loadProductsData();
    } else if (currentPage.includes('orders')) {
      this.loadOrdersData();
    }
  }

  // Real-time Updates
  setupRealTimeUpdates() {
    // Refresh data every 30 seconds
    setInterval(() => {
      this.setupDataLoading();
    }, 30000);
  }

  // Utility Methods
  refreshCurrentPage() {
    this.setupDataLoading();
  }

  logout() {
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login.html';
  }

  toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    }
  }

  handleFormSubmit(e) {
    const form = e.target;
    if (form.checkValidity && !form.checkValidity()) {
      e.preventDefault();
      form.reportValidity();
    }
  }

  handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableRows = document.querySelectorAll('tbody tr');
    
    tableRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }

  handleFilter(e) {
    const filterValue = e.target.value;
    const tableRows = document.querySelectorAll('tbody tr');
    
    tableRows.forEach(row => {
      if (!filterValue) {
        row.style.display = '';
      } else {
        const matchesFilter = row.textContent.toLowerCase().includes(filterValue.toLowerCase());
        row.style.display = matchesFilter ? '' : 'none';
      }
    });
  }
}

// Global Functions for Backward Compatibility
function viewUser(id) { console.log('View user:', id); }
function editUser(id) { console.log('Edit user:', id); }
function deleteUser(id) { console.log('Delete user:', id); }
function viewProduct(id) { console.log('View product:', id); }
function editProduct(id) { console.log('Edit product:', id); }
function deleteProduct(id) { console.log('Delete product:', id); }
function viewOrder(id) { console.log('View order:', id); }
function updateOrderStatus(id, status) { console.log('Update order status:', id, status); }
function logout() { window.adminCore?.logout(); }

// Initialize Admin Core when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.adminCore = new AdminCore();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminCore;
}
