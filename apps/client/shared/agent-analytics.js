/**
 * Agent Performance Analytics System
 * Comprehensive analytics and performance tracking for agents
 */

class AgentAnalytics {
    constructor() {
        this.charts = {};
        this.performanceData = {};
        this.init();
    }

    init() {
        console.log('[AGENT-ANALYTICS] Initializing analytics system...');
        this.loadPerformanceData();
    }

    async loadPerformanceData() {
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (!token) return;

            // Load earnings data
            const earningsResponse = await fetch('/api/agents/earnings?period=month', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (earningsResponse.ok) {
                this.performanceData.earnings = await earningsResponse.json();
            }

            // Load order statistics
            const ordersResponse = await fetch('/api/agents/orders?limit=100', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (ordersResponse.ok) {
                const ordersData = await ordersResponse.json();
                this.performanceData.orders = ordersData.orders || [];
                this.calculatePerformanceMetrics();
            }

        } catch (error) {
            console.error('[AGENT-ANALYTICS] Error loading performance data:', error);
        }
    }

    calculatePerformanceMetrics() {
        const orders = this.performanceData.orders || [];
        
        // Calculate completion rate
        const completedOrders = orders.filter(order => order.status === 'delivered').length;
        const completionRate = orders.length > 0 ? (completedOrders / orders.length) * 100 : 0;

        // Calculate average delivery time
        const deliveredOrders = orders.filter(order => 
            order.status === 'delivered' && order.created_at && order.delivered_at
        );
        
        let avgDeliveryTime = 0;
        if (deliveredOrders.length > 0) {
            const totalTime = deliveredOrders.reduce((sum, order) => {
                const created = new Date(order.created_at);
                const delivered = new Date(order.delivered_at);
                return sum + (delivered - created);
            }, 0);
            avgDeliveryTime = totalTime / deliveredOrders.length / (1000 * 60 * 60); // Convert to hours
        }

        // Calculate ratings
        const ratedOrders = orders.filter(order => order.rating && order.rating > 0);
        const avgRating = ratedOrders.length > 0 
            ? ratedOrders.reduce((sum, order) => sum + order.rating, 0) / ratedOrders.length 
            : 0;

        this.performanceData.metrics = {
            completionRate: Math.round(completionRate * 100) / 100,
            avgDeliveryTime: Math.round(avgDeliveryTime * 100) / 100,
            avgRating: Math.round(avgRating * 100) / 100,
            totalOrders: orders.length,
            completedOrders: completedOrders,
            ratedOrders: ratedOrders.length
        };
    }

    renderPerformanceCard(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.performanceData.metrics) return;

        const metrics = this.performanceData.metrics;
        const earnings = this.performanceData.earnings?.summary || {};

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-chart-line mr-2 text-blue-600"></i>
                    Performance Overview
                </h3>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <!-- Completion Rate -->
                    <div class="text-center">
                        <div class="relative w-16 h-16 mx-auto mb-2">
                            <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                                <path class="text-gray-300" stroke="currentColor" stroke-width="3" fill="none"
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                <path class="text-green-600" stroke="currentColor" stroke-width="3" fill="none"
                                      stroke-dasharray="${metrics.completionRate}, 100"
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            </svg>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-sm font-semibold text-gray-900">${metrics.completionRate}%</span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600">Completion Rate</p>
                    </div>

                    <!-- Average Rating -->
                    <div class="text-center">
                        <div class="text-2xl font-bold text-yellow-600 mb-1">
                            ${metrics.avgRating.toFixed(1)}
                        </div>
                        <div class="flex justify-center mb-1">
                            ${this.renderStars(metrics.avgRating)}
                        </div>
                        <p class="text-xs text-gray-600">Avg Rating</p>
                    </div>

                    <!-- Total Earnings -->
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600 mb-1">
                            $${(earnings.total_earnings || 0).toFixed(2)}
                        </div>
                        <p class="text-xs text-gray-600">This Month</p>
                    </div>

                    <!-- Delivery Time -->
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600 mb-1">
                            ${metrics.avgDeliveryTime.toFixed(1)}h
                        </div>
                        <p class="text-xs text-gray-600">Avg Delivery</p>
                    </div>
                </div>

                <!-- Additional Stats -->
                <div class="mt-6 pt-4 border-t border-gray-200">
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-lg font-semibold text-gray-900">${metrics.totalOrders}</div>
                            <p class="text-xs text-gray-600">Total Orders</p>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">${metrics.completedOrders}</div>
                            <p class="text-xs text-gray-600">Completed</p>
                        </div>
                        <div>
                            <div class="text-lg font-semibold text-gray-900">${earnings.total_orders || 0}</div>
                            <p class="text-xs text-gray-600">This Month</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderEarningsChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.performanceData.earnings) return;

        const dailyData = this.performanceData.earnings.daily_breakdown || [];
        
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-dollar-sign mr-2 text-green-600"></i>
                    Daily Earnings
                </h3>
                <div class="h-64" id="earnings-chart-canvas"></div>
            </div>
        `;

        // Simple bar chart implementation
        this.renderSimpleBarChart('earnings-chart-canvas', dailyData);
    }

    renderSimpleBarChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !data.length) {
            canvas.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No data available</div>';
            return;
        }

        const maxEarnings = Math.max(...data.map(d => d.daily_earnings || 0));
        const chartHeight = 200;

        let chartHTML = '<div class="flex items-end justify-between h-full space-x-1">';
        
        data.slice(-7).forEach((day, index) => {
            const height = maxEarnings > 0 ? (day.daily_earnings / maxEarnings) * chartHeight : 0;
            const date = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            chartHTML += `
                <div class="flex flex-col items-center flex-1">
                    <div class="bg-blue-500 rounded-t w-full transition-all duration-300 hover:bg-blue-600" 
                         style="height: ${height}px; min-height: 2px;"
                         title="$${day.daily_earnings.toFixed(2)} on ${date}">
                    </div>
                    <div class="text-xs text-gray-600 mt-2 transform rotate-45 origin-left">${date}</div>
                </div>
            `;
        });
        
        chartHTML += '</div>';
        canvas.innerHTML = chartHTML;
    }

    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let starsHTML = '';

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHTML += '<i class="fas fa-star text-yellow-400 text-xs"></i>';
            } else if (i === fullStars && hasHalfStar) {
                starsHTML += '<i class="fas fa-star-half-alt text-yellow-400 text-xs"></i>';
            } else {
                starsHTML += '<i class="far fa-star text-gray-300 text-xs"></i>';
            }
        }

        return starsHTML;
    }

    renderOrderStatusChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.performanceData.orders) return;

        const orders = this.performanceData.orders;
        const statusCounts = {};
        
        orders.forEach(order => {
            const status = order.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const statusColors = {
            'delivered': 'bg-green-500',
            'shipped': 'bg-blue-500',
            'processing': 'bg-yellow-500',
            'pending': 'bg-gray-500',
            'cancelled': 'bg-red-500'
        };

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-chart-pie mr-2 text-purple-600"></i>
                    Order Status Distribution
                </h3>
                <div class="space-y-3">
                    ${Object.entries(statusCounts).map(([status, count]) => {
                        const percentage = orders.length > 0 ? (count / orders.length) * 100 : 0;
                        return `
                            <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                    <div class="w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-400'} mr-2"></div>
                                    <span class="text-sm text-gray-700 capitalize">${status}</span>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-20 bg-gray-200 rounded-full h-2 mr-2">
                                        <div class="${statusColors[status] || 'bg-gray-400'} h-2 rounded-full" 
                                             style="width: ${percentage}%"></div>
                                    </div>
                                    <span class="text-sm font-semibold text-gray-900">${count}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    async refreshData() {
        await this.loadPerformanceData();
        // Re-render all components
        this.renderPerformanceCard('performance-overview');
        this.renderEarningsChart('earnings-chart');
        this.renderOrderStatusChart('order-status-chart');
    }

    exportPerformanceReport() {
        const report = {
            generated_at: new Date().toISOString(),
            agent_id: this.getUserData()?.id,
            metrics: this.performanceData.metrics,
            earnings: this.performanceData.earnings,
            orders_summary: {
                total: this.performanceData.orders?.length || 0,
                by_status: this.getOrdersByStatus()
            }
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-performance-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getOrdersByStatus() {
        const orders = this.performanceData.orders || [];
        const statusCounts = {};
        
        orders.forEach(order => {
            const status = order.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return statusCounts;
    }

    getUserData() {
        try {
            const userData = localStorage.getItem('userData') || localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('[AGENT-ANALYTICS] Error getting user data:', error);
            return null;
        }
    }
}

// Initialize global analytics system
window.agentAnalytics = new AgentAnalytics();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentAnalytics;
}