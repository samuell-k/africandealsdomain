/**
 * Chart Manager Utility
 * Prevents infinite chart growth and browser crashes
 * Provides centralized chart management across all pages
 */

class ChartManager {
    constructor() {
        this.charts = new Map();
        this.isInitialized = false;
        this.init();
    }

    init() {
        // Add cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanupAll());
        
        // Add cleanup on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAllAnimations();
            } else {
                this.resumeAllAnimations();
            }
        });

        // Add cleanup on page hide (for mobile browsers)
        window.addEventListener('pagehide', () => this.cleanupAll());
        
        this.isInitialized = true;
        console.log('ChartManager initialized');
    }

    /**
     * Create a new chart with proper cleanup
     * @param {string} canvasId - The canvas element ID
     * @param {Object} config - Chart.js configuration
     * @param {string} chartName - Unique name for the chart
     * @returns {Chart|null} - Chart instance or null if failed
     */
    createChart(canvasId, config, chartName = null) {
        try {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.warn(`Canvas element with ID '${canvasId}' not found`);
                return null;
            }

            // Cleanup existing chart if it exists
            this.destroyChart(chartName || canvasId);

            // Create new chart
            const chart = new Chart(canvas.getContext('2d'), {
                ...config,
                options: {
                    ...config.options,
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart',
                        ...config.options?.animation
                    },
                    plugins: {
                        ...config.options?.plugins,
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            ...config.options?.plugins?.tooltip
                        }
                    }
                }
            });

            // Store chart reference
            this.charts.set(chartName || canvasId, chart);
            
            console.log(`Chart '${chartName || canvasId}' created successfully`);
            return chart;

        } catch (error) {
            console.error(`Error creating chart '${chartName || canvasId}':`, error);
            return null;
        }
    }

    /**
     * Destroy a specific chart
     * @param {string} chartName - Chart name or canvas ID
     */
    destroyChart(chartName) {
        const chart = this.charts.get(chartName);
        if (chart) {
            try {
                chart.destroy();
                this.charts.delete(chartName);
                console.log(`Chart '${chartName}' destroyed successfully`);
            } catch (error) {
                console.error(`Error destroying chart '${chartName}':`, error);
            }
        }
    }

    /**
     * Cleanup all charts
     */
    cleanupAll() {
        console.log(`Cleaning up ${this.charts.size} charts...`);
        this.charts.forEach((chart, name) => {
            try {
                chart.destroy();
                console.log(`Chart '${name}' cleaned up`);
            } catch (error) {
                console.error(`Error cleaning up chart '${name}':`, error);
            }
        });
        this.charts.clear();
    }

    /**
     * Pause all chart animations
     */
    pauseAllAnimations() {
        this.charts.forEach((chart, name) => {
            try {
    chart.stop();
            
} catch (error) {
    console.error('Operation failed:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Operation failed:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Operation failed:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    showNotification('An error occurred. Please try again.', 'error');
    
    // Log error details for debugging
    if (error.response) {
        console.error('Response status:', error.response.status);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response status:',
                    error: error.response.status,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response status:', 'error');

// Enhanced error logging
if (error.response.status && error.response.status.message) {
    console.error('Error details:', error.response.status.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.status.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        console.error('Response data:', error.response.data);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response data:',
                    error: error.response.data,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response data:', 'error');

// Enhanced error logging
if (error.response.data && error.response.data.message) {
    console.error('Error details:', error.response.data.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.data.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
    
    throw error; // Re-throw to allow upstream handling
}
        });
    }

    /**
     * Resume all chart animations
     */
    resumeAllAnimations() {
        this.charts.forEach((chart, name) => {
            try {
    chart.start();
            
} catch (error) {
    console.error('Operation failed:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Operation failed:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Operation failed:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    showNotification('An error occurred. Please try again.', 'error');
    
    // Log error details for debugging
    if (error.response) {
        console.error('Response status:', error.response.status);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response status:',
                    error: error.response.status,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response status:', 'error');

// Enhanced error logging
if (error.response.status && error.response.status.message) {
    console.error('Error details:', error.response.status.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.status.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        console.error('Response data:', error.response.data);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response data:',
                    error: error.response.data,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response data:', 'error');

// Enhanced error logging
if (error.response.data && error.response.data.message) {
    console.error('Error details:', error.response.data.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.data.message,
                    timestamp: new Date().toISOString(),
                    file: 'chart-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
    
    throw error; // Re-throw to allow upstream handling
}
        });
    }

    /**
     * Update chart data
     * @param {string} chartName - Chart name
     * @param {Object} newData - New chart data
     */
    updateChartData(chartName, newData) {
        const chart = this.charts.get(chartName);
        if (chart) {
            try {
                chart.data = newData;
                chart.update('none'); // Update without animation for better performance
                console.log(`Chart '${chartName}' data updated`);
            } catch (error) {
                console.error(`Error updating chart '${chartName}':`, error);
            }
        } else {
            console.warn(`Chart '${chartName}' not found for update`);
        }
    }

    /**
     * Get chart instance
     * @param {string} chartName - Chart name
     * @returns {Chart|null} - Chart instance or null
     */
    getChart(chartName) {
        return this.charts.get(chartName) || null;
    }

    /**
     * Get all chart names
     * @returns {Array} - Array of chart names
     */
    getChartNames() {
        return Array.from(this.charts.keys());
    }

    /**
     * Get chart count
     * @returns {number} - Number of active charts
     */
    getChartCount() {
        return this.charts.size;
    }

    /**
     * Check if chart exists
     * @param {string} chartName - Chart name
     * @returns {boolean} - True if chart exists
     */
    hasChart(chartName) {
        return this.charts.has(chartName);
    }
}

// Create global chart manager instance
window.chartManager = new ChartManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
} 