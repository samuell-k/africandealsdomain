/**
 * PERFORMANCE OPTIMIZATION: Performance Monitoring Middleware
 * 
 * This middleware provides comprehensive performance monitoring:
 * - Request/response time tracking
 * - Memory usage monitoring
 * - Database query performance
 * - API endpoint analytics
 * - Real-time performance alerts
 * - Performance reporting
 */

const os = require('os');
const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor(options = {}) {
    this.config = {
      // Monitoring settings
      enabled: options.enabled !== false,
      slowRequestThreshold: options.slowRequestThreshold || 1000, // 1 second
      memoryThreshold: options.memoryThreshold || 0.8, // 80% of available memory
      
      // Sampling settings
      sampleRate: options.sampleRate || 1.0, // Sample 100% of requests
      
      // Storage settings
      maxMetrics: options.maxMetrics || 10000,
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      
      // Alert settings
      alertCallback: options.alertCallback || null,
      alertThresholds: {
        responseTime: options.alertThresholds?.responseTime || 5000, // 5 seconds
        errorRate: options.alertThresholds?.errorRate || 0.05, // 5%
        memoryUsage: options.alertThresholds?.memoryUsage || 0.9 // 90%
      }
    };
    
    // Metrics storage
    this.metrics = {
      requests: [],
      endpoints: new Map(),
      errors: [],
      system: {
        memory: [],
        cpu: []
      }
    };
    
    // Performance counters
    this.counters = {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0,
      slowRequests: 0
    };
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Setup cleanup
    this.setupCleanup();
  }

  // Main middleware function
  middleware() {
    return (req, res, next) => {
      if (!this.config.enabled || Math.random() > this.config.sampleRate) {
        return next();
      }
      
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      const requestId = this.generateRequestId();
      
      // Add request ID to request object
      req.performanceId = requestId;
      
      // Track request start
      const requestMetric = {
        id: requestId,
        method: req.method,
        path: req.path,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: Date.now(),
        startTime,
        startMemory
      };
      
      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        
        // Complete request metric
        requestMetric.endTime = endTime;
        requestMetric.duration = duration;
        requestMetric.statusCode = res.statusCode;
        requestMetric.contentLength = res.get('Content-Length') || 0;
        requestMetric.memoryDelta = {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal
        };
        
        // Store metrics
        this.recordRequest(requestMetric);
        
        // Check for alerts
        this.checkAlerts(requestMetric);
        
        // Call original end method
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  // Record request metrics
  recordRequest(metric) {
    // Update counters
    this.counters.totalRequests++;
    this.counters.totalResponseTime += metric.duration;
    
    if (metric.statusCode >= 400) {
      this.counters.totalErrors++;
      this.recordError(metric);
    }
    
    if (metric.duration > this.config.slowRequestThreshold) {
      this.counters.slowRequests++;
    }
    
    // Store request metric
    this.metrics.requests.push(metric);
    
    // Update endpoint metrics
    this.updateEndpointMetrics(metric);
    
    // Maintain storage limits
    this.maintainStorageLimits();
  }

  // Record error metrics
  recordError(metric) {
    const errorMetric = {
      id: metric.id,
      timestamp: metric.timestamp,
      method: metric.method,
      path: metric.path,
      statusCode: metric.statusCode,
      duration: metric.duration,
      ip: metric.ip,
      userAgent: metric.userAgent
    };
    
    this.metrics.errors.push(errorMetric);
  }

  // Update endpoint-specific metrics
  updateEndpointMetrics(metric) {
    const endpointKey = `${metric.method} ${metric.path}`;
    
    if (!this.metrics.endpoints.has(endpointKey)) {
      this.metrics.endpoints.set(endpointKey, {
        method: metric.method,
        path: metric.path,
        requests: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        statusCodes: new Map()
      });
    }
    
    const endpoint = this.metrics.endpoints.get(endpointKey);
    endpoint.requests++;
    endpoint.totalTime += metric.duration;
    endpoint.avgTime = endpoint.totalTime / endpoint.requests;
    endpoint.minTime = Math.min(endpoint.minTime, metric.duration);
    endpoint.maxTime = Math.max(endpoint.maxTime, metric.duration);
    
    if (metric.statusCode >= 400) {
      endpoint.errors++;
    }
    
    // Track status code distribution
    const statusCount = endpoint.statusCodes.get(metric.statusCode) || 0;
    endpoint.statusCodes.set(metric.statusCode, statusCount + 1);
  }

  // Start system monitoring
  startSystemMonitoring() {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const systemMemory = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      };
      
      const systemMetric = {
        timestamp: Date.now(),
        memory: {
          process: memoryUsage,
          system: systemMemory,
          usage: (systemMemory.used / systemMemory.total)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          loadAverage: os.loadavg()
        }
      };
      
      this.metrics.system.memory.push(systemMetric);
      
      // Check system alerts
      this.checkSystemAlerts(systemMetric);
      
    }, 30000); // 30 seconds
  }

  // Check for performance alerts
  checkAlerts(metric) {
    const alerts = [];
    
    // Response time alert
    if (metric.duration > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'slow_response',
        severity: 'warning',
        message: `Slow response detected: ${metric.duration.toFixed(2)}ms for ${metric.method} ${metric.path}`,
        metric
      });
    }
    
    // Error rate alert
    const recentRequests = this.getRecentRequests(5 * 60 * 1000); // Last 5 minutes
    if (recentRequests.length > 10) {
      const errorRate = recentRequests.filter(r => r.statusCode >= 400).length / recentRequests.length;
      if (errorRate > this.config.alertThresholds.errorRate) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'critical',
          message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
          errorRate
        });
      }
    }
    
    // Send alerts
    alerts.forEach(alert => {
      this.sendAlert(alert);
    });
  }

  // Check system alerts
  checkSystemAlerts(systemMetric) {
    const alerts = [];
    
    // Memory usage alert
    if (systemMetric.memory.usage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'critical',
        message: `High memory usage: ${(systemMetric.memory.usage * 100).toFixed(1)}%`,
        usage: systemMetric.memory.usage
      });
    }
    
    // Send alerts
    alerts.forEach(alert => {
      this.sendAlert(alert);
    });
  }

  // Send alert
  sendAlert(alert) {
    console.warn(`🚨 PERFORMANCE ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    if (this.config.alertCallback) {
      try {
        this.config.alertCallback(alert);
      } catch (error) {
        console.error('❌ Alert callback error:', error);
      }
    }
  }

  // Get recent requests
  getRecentRequests(timeWindow = 60000) { // Default 1 minute
    const cutoff = Date.now() - timeWindow;
    return this.metrics.requests.filter(r => r.timestamp > cutoff);
  }

  // Generate request ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Maintain storage limits
  maintainStorageLimits() {
    const now = Date.now();
    const cutoff = now - this.config.retentionPeriod;
    
    // Clean old requests
    this.metrics.requests = this.metrics.requests
      .filter(r => r.timestamp > cutoff)
      .slice(-this.config.maxMetrics);
    
    // Clean old errors
    this.metrics.errors = this.metrics.errors
      .filter(e => e.timestamp > cutoff)
      .slice(-this.config.maxMetrics);
    
    // Clean old system metrics
    this.metrics.system.memory = this.metrics.system.memory
      .filter(m => m.timestamp > cutoff)
      .slice(-this.config.maxMetrics);
  }

  // Setup cleanup
  setupCleanup() {
    // Clean up old metrics every hour
    setInterval(() => {
      this.maintainStorageLimits();
      console.log('🧹 Performance metrics cleaned up');
    }, 60 * 60 * 1000); // 1 hour
  }

  // Get performance statistics
  getStats() {
    const recentRequests = this.getRecentRequests(60 * 60 * 1000); // Last hour
    const avgResponseTime = this.counters.totalRequests > 0 ? 
      this.counters.totalResponseTime / this.counters.totalRequests : 0;
    
    const errorRate = this.counters.totalRequests > 0 ? 
      this.counters.totalErrors / this.counters.totalRequests : 0;
    
    // Top endpoints by request count
    const topEndpoints = Array.from(this.metrics.endpoints.entries())
      .map(([key, stats]) => ({ endpoint: key, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
    
    // Slowest endpoints
    const slowestEndpoints = Array.from(this.metrics.endpoints.entries())
      .map(([key, stats]) => ({ endpoint: key, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);
    
    return {
      overview: {
        totalRequests: this.counters.totalRequests,
        totalErrors: this.counters.totalErrors,
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
        errorRate: (errorRate * 100).toFixed(2) + '%',
        slowRequests: this.counters.slowRequests,
        recentRequests: recentRequests.length
      },
      endpoints: {
        total: this.metrics.endpoints.size,
        topByRequests: topEndpoints,
        slowest: slowestEndpoints
      },
      system: {
        memory: this.getLatestSystemMetric()?.memory,
        uptime: process.uptime()
      },
      storage: {
        requestMetrics: this.metrics.requests.length,
        errorMetrics: this.metrics.errors.length,
        systemMetrics: this.metrics.system.memory.length
      }
    };
  }

  // Get latest system metric
  getLatestSystemMetric() {
    return this.metrics.system.memory[this.metrics.system.memory.length - 1];
  }

  // Get detailed endpoint stats
  getEndpointStats(endpoint = null) {
    if (endpoint) {
      return this.metrics.endpoints.get(endpoint);
    }
    
    return Array.from(this.metrics.endpoints.entries())
      .map(([key, stats]) => ({ endpoint: key, ...stats }));
  }

  // Get error analysis
  getErrorAnalysis() {
    const recentErrors = this.metrics.errors.filter(e => 
      e.timestamp > Date.now() - (60 * 60 * 1000) // Last hour
    );
    
    // Group by status code
    const byStatusCode = recentErrors.reduce((acc, error) => {
      acc[error.statusCode] = (acc[error.statusCode] || 0) + 1;
      return acc;
    }, {});
    
    // Group by endpoint
    const byEndpoint = recentErrors.reduce((acc, error) => {
      const key = `${error.method} ${error.path}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total: recentErrors.length,
      byStatusCode,
      byEndpoint,
      recent: recentErrors.slice(-10) // Last 10 errors
    };
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      timestamp: Date.now(),
      counters: this.counters,
      stats: this.getStats(),
      endpoints: this.getEndpointStats(),
      errors: this.getErrorAnalysis()
    };
  }

  // Reset all metrics
  reset() {
    this.metrics = {
      requests: [],
      endpoints: new Map(),
      errors: [],
      system: {
        memory: [],
        cpu: []
      }
    };
    
    this.counters = {
      totalRequests: 0,
      totalErrors: 0,
      totalResponseTime: 0,
      slowRequests: 0
    };
  }
}

// Export factory function and class
module.exports = {
  PerformanceMonitor,
  
  // Factory function for easy setup
  createPerformanceMonitor: (options = {}) => {
    const monitor = new PerformanceMonitor(options);
    return {
      middleware: monitor.middleware(),
      monitor: monitor
    };
  }
};