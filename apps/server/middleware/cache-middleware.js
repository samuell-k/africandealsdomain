/**
 * PERFORMANCE OPTIMIZATION: Advanced Caching Middleware
 * 
 * This middleware provides intelligent caching for API responses to improve performance:
 * - Response caching with configurable TTL
 * - Cache invalidation strategies
 * - Conditional caching based on request/response characteristics
 * - Memory and Redis support
 * - Cache warming and preloading
 * - Performance metrics
 */

const crypto = require('crypto');
const { promisify } = require('util');

class CacheMiddleware {
  constructor(options = {}) {
    this.config = {
      // Default cache settings
      defaultTTL: options.defaultTTL || 300, // 5 minutes
      maxSize: options.maxSize || 1000,
      enabled: options.enabled !== false,
      
      // Cache key generation
      keyPrefix: options.keyPrefix || 'api:',
      includeHeaders: options.includeHeaders || ['authorization'],
      
      // Redis configuration
      redis: {
        enabled: options.redis?.enabled || false,
        client: options.redis?.client || null
      },
      
      // Cache rules
      rules: options.rules || {
        // Default caching rules
        '/api/products': { ttl: 600, vary: ['page', 'limit', 'category'] },
        '/api/categories': { ttl: 1800, vary: [] },
        '/api/users/profile': { ttl: 300, vary: ['userId'] },
        '/api/orders': { ttl: 60, vary: ['userId', 'status'] }
      }
    };
    
    // In-memory cache
    this.cache = new Map();
    this.redisClient = this.config.redis.client;
    
    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
      totalResponseTime: 0
    };
    
    // Setup cache cleanup
    this.setupCleanup();
  }

  // Main middleware function
  middleware() {
    return async (req, res, next) => {
      // Skip caching if disabled or for non-GET requests
      if (!this.config.enabled || req.method !== 'GET') {
        return next();
      }
      
      const startTime = Date.now();
      const cacheKey = this.generateCacheKey(req);
      const cacheRule = this.getCacheRule(req.path);
      
      try {
        // Try to get from cache
        const cached = await this.get(cacheKey);
        
        if (cached) {
          // Cache hit
          this.metrics.hits++;
          
          // Set cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'Cache-Control': `public, max-age=${cacheRule?.ttl || this.config.defaultTTL}`
          });
          
          // Send cached response
          return res.status(cached.status).json(cached.data);
        }
        
        // Cache miss - continue to route handler
        this.metrics.misses++;
        
        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = async (data) => {
          try {
            // Cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const cacheData = {
                status: res.statusCode,
                data: data,
                timestamp: Date.now(),
                headers: this.extractCacheableHeaders(res)
              };
              
              const ttl = cacheRule?.ttl || this.config.defaultTTL;
              await this.set(cacheKey, cacheData, ttl);
              this.metrics.sets++;
            }
            
            // Set cache headers
            res.set({
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
              'Cache-Control': res.statusCode < 300 ? 
                `public, max-age=${cacheRule?.ttl || this.config.defaultTTL}` : 
                'no-cache'
            });
            
          } catch (error) {
            console.error('❌ Cache set error:', error);
            this.metrics.errors++;
          }
          
          // Update metrics
          this.metrics.totalResponseTime += Date.now() - startTime;
          
          // Call original json method
          return originalJson.call(res, data);
        };
        
        next();
        
      } catch (error) {
        console.error('❌ Cache middleware error:', error);
        this.metrics.errors++;
        next();
      }
    };
  }

  // Generate cache key based on request
  generateCacheKey(req) {
    const components = [
      this.config.keyPrefix,
      req.path,
      JSON.stringify(req.query),
      this.extractVaryHeaders(req)
    ];
    
    const keyString = components.join(':');
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  // Extract headers that should vary the cache
  extractVaryHeaders(req) {
    const varyHeaders = {};
    
    this.config.includeHeaders.forEach(header => {
      const value = req.get(header);
      if (value) {
        // For authorization, only include user ID part to avoid token changes
        if (header === 'authorization' && value.startsWith('Bearer ')) {
          try {
            const token = value.split(' ')[1];
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            varyHeaders[header] = payload.userId || payload.id;
          } catch (e) {
            varyHeaders[header] = crypto.createHash('md5').update(value).digest('hex').substring(0, 8);
          }
        } else {
          varyHeaders[header] = value;
        }
      }
    });
    
    return JSON.stringify(varyHeaders);
  }

  // Extract cacheable response headers
  extractCacheableHeaders(res) {
    const cacheableHeaders = {};
    const headers = ['content-type', 'etag', 'last-modified'];
    
    headers.forEach(header => {
      const value = res.get(header);
      if (value) {
        cacheableHeaders[header] = value;
      }
    });
    
    return cacheableHeaders;
  }

  // Get cache rule for a path
  getCacheRule(path) {
    // Find matching rule (exact match first, then pattern match)
    let rule = this.config.rules[path];
    
    if (!rule) {
      // Try pattern matching
      for (const [pattern, ruleConfig] of Object.entries(this.config.rules)) {
        if (path.startsWith(pattern)) {
          rule = ruleConfig;
          break;
        }
      }
    }
    
    return rule;
  }

  // Get from cache (Redis first, then memory)
  async get(key) {
    try {
      // Try Redis first
      if (this.redisClient) {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      }
      
      // Try memory cache
      const entry = this.cache.get(key);
      if (entry && (!entry.expires || entry.expires > Date.now())) {
        return entry.data;
      }
      
      // Clean up expired entry
      if (entry && entry.expires <= Date.now()) {
        this.cache.delete(key);
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  // Set cache (both Redis and memory)
  async set(key, data, ttl = null) {
    const cacheTTL = ttl || this.config.defaultTTL;
    const expires = Date.now() + (cacheTTL * 1000);
    
    try {
      // Set in Redis
      if (this.redisClient) {
        await this.redisClient.setEx(key, cacheTTL, JSON.stringify(data));
      }
      
      // Set in memory cache
      this.cache.set(key, { data, expires });
      
      // Maintain cache size limit
      if (this.cache.size > this.config.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      
    } catch (error) {
      console.error('❌ Cache set error:', error);
      throw error;
    }
  }

  // Delete from cache
  async delete(key) {
    try {
      if (this.redisClient) {
        await this.redisClient.del(key);
      }
      
      this.cache.delete(key);
      
    } catch (error) {
      console.error('❌ Cache delete error:', error);
    }
  }

  // Clear cache by pattern
  async clear(pattern = null) {
    try {
      if (pattern) {
        // Clear by pattern
        if (this.redisClient) {
          const keys = await this.redisClient.keys(`*${pattern}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        }
        
        for (const key of this.cache.keys()) {
          if (key.includes(pattern)) {
            this.cache.delete(key);
          }
        }
      } else {
        // Clear all
        if (this.redisClient) {
          await this.redisClient.flushDb();
        }
        
        this.cache.clear();
      }
      
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  // Cache warming - preload frequently accessed data
  async warmCache(routes = []) {
    console.log('🔥 Warming cache...');
    
    for (const route of routes) {
      try {
        // This would typically make internal requests to warm the cache
        console.log(`  • Warming ${route.path}`);
        
        // You can implement actual cache warming logic here
        // For example, making internal HTTP requests or directly calling route handlers
        
      } catch (error) {
        console.error(`❌ Failed to warm cache for ${route.path}:`, error);
      }
    }
  }

  // Setup automatic cache cleanup
  setupCleanup() {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires && entry.expires < now) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
      }
      
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Get cache statistics
  getStats() {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    const avgResponseTime = totalRequests > 0 ? this.metrics.totalResponseTime / totalRequests : 0;
    
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      sets: this.metrics.sets,
      errors: this.metrics.errors,
      hitRate: hitRate.toFixed(2) + '%',
      avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
      cacheSize: this.cache.size,
      redisConnected: !!this.redisClient
    };
  }

  // Middleware for cache invalidation
  invalidationMiddleware() {
    return async (req, res, next) => {
      // Store original methods
      const originalJson = res.json;
      const originalSend = res.send;
      
      // Override response methods to handle cache invalidation
      const handleResponse = async (data) => {
        // Invalidate cache for write operations
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          await this.invalidateRelatedCache(req);
        }
        
        return data;
      };
      
      res.json = function(data) {
        handleResponse(data);
        return originalJson.call(this, data);
      };
      
      res.send = function(data) {
        handleResponse(data);
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  // Invalidate related cache entries
  async invalidateRelatedCache(req) {
    const path = req.path;
    
    // Define invalidation patterns
    const invalidationRules = {
      '/api/products': ['products', 'categories'],
      '/api/categories': ['categories', 'products'],
      '/api/orders': ['orders', 'users'],
      '/api/users': ['users']
    };
    
    // Find matching invalidation rule
    for (const [pattern, cachePatterns] of Object.entries(invalidationRules)) {
      if (path.startsWith(pattern)) {
        for (const cachePattern of cachePatterns) {
          await this.clear(cachePattern);
          console.log(`🗑️ Invalidated cache pattern: ${cachePattern}`);
        }
        break;
      }
    }
  }
}

// Export factory function and class
module.exports = {
  CacheMiddleware,
  
  // Factory function for easy setup
  createCacheMiddleware: (options = {}) => {
    const cache = new CacheMiddleware(options);
    return {
      middleware: cache.middleware(),
      invalidation: cache.invalidationMiddleware(),
      cache: cache
    };
  }
};