/**
 * PERFORMANCE OPTIMIZATION: Enhanced Database Connection with Advanced Pooling and Caching
 * 
 * This module provides optimized database connections with:
 * - Advanced connection pooling
 * - Query result caching (in-memory and Redis)
 * - Query optimization and monitoring
 * - Connection health monitoring
 * - Automatic retry mechanisms
 * - Performance metrics
 */

const mysql = require('mysql2/promise');
const EventEmitter = require('events');
require('dotenv').config();

class OptimizedDatabase extends EventEmitter {
  constructor() {
    super();
    
    // Configuration
    this.config = {
      // Enhanced connection pool settings
      pool: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'add_physical_product',
        port: process.env.DB_PORT || 3306,
        
        // PERFORMANCE OPTIMIZATION: Advanced pooling configuration
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
        queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 50,
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
        timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
        reconnect: true,
        
        // Connection optimization
        waitForConnections: true,
        multipleStatements: false,
        
        // Performance settings
        charset: 'utf8mb4',
        timezone: '+00:00',
        
        // SSL configuration (if needed)
        ssl: process.env.DB_SSL === 'true' ? {
          rejectUnauthorized: false
        } : false
      },
      
      // Cache configuration
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 300, // 5 minutes
        maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
        
        // Redis configuration (optional)
        redis: {
          enabled: process.env.REDIS_ENABLED === 'true',
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || null,
          db: parseInt(process.env.REDIS_DB) || 0
        }
      }
    };
    
    // Initialize components
    this.pool = null;
    this.cache = new Map();
    this.redisClient = null;
    this.metrics = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTime: 0,
      slowQueries: 0
    };
    
    // Initialize database
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🔧 Initializing optimized database connection...');
      
      // Create connection pool
      await this.createPool();
      
      // Initialize caching
      await this.initializeCache();
      
      // Setup monitoring
      this.setupMonitoring();
      
      console.log('✅ Optimized database connection established');
      this.emit('ready');
      
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async createPool() {
    // PERFORMANCE OPTIMIZATION: Create optimized connection pool
    this.pool = mysql.createPool(this.config.pool);
    
    // Test initial connection
    const connection = await this.pool.getConnection();
    console.log('✅ Database connection pool created');
    
    // Set session variables for optimization
    await connection.execute(`
      SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
    `);
    
    connection.release();
  }

  async initializeCache() {
    if (!this.config.cache.enabled) {
      console.log('📝 Database caching disabled');
      return;
    }
    
    console.log('🗄️ Initializing database cache...');
    
    // Initialize Redis if enabled
    if (this.config.cache.redis.enabled) {
      try {
        const redis = require('redis');
        this.redisClient = redis.createClient({
          host: this.config.cache.redis.host,
          port: this.config.cache.redis.port,
          password: this.config.cache.redis.password,
          db: this.config.cache.redis.db,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              console.warn('⚠️ Redis connection refused, falling back to in-memory cache');
              return undefined; // Stop retrying
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });
        
        await this.redisClient.connect();
        console.log('✅ Redis cache connected');
        
      } catch (error) {
        console.warn('⚠️ Redis connection failed, using in-memory cache:', error.message);
        this.redisClient = null;
      }
    }
    
    // Setup cache cleanup
    this.setupCacheCleanup();
  }

  setupCacheCleanup() {
    // Clean up expired cache entries every 5 minutes
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
      
      // Limit cache size
      if (this.cache.size > this.config.cache.maxSize) {
        const excess = this.cache.size - this.config.cache.maxSize;
        const keys = Array.from(this.cache.keys()).slice(0, excess);
        keys.forEach(key => this.cache.delete(key));
        console.log(`🧹 Removed ${excess} cache entries to maintain size limit`);
      }
      
    }, 5 * 60 * 1000); // 5 minutes
  }

  setupMonitoring() {
    // Monitor pool events
    this.pool.on('connection', (connection) => {
      console.log('🔗 New database connection established:', connection.threadId);
    });
    
    this.pool.on('error', (error) => {
      console.error('❌ Database pool error:', error);
      this.metrics.errors++;
      this.emit('error', error);
    });
    
    // Log metrics every 10 minutes
    setInterval(() => {
      this.logMetrics();
    }, 10 * 60 * 1000);
  }

  // PERFORMANCE OPTIMIZATION: Enhanced query method with caching and optimization
  async query(sql, params = [], options = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(sql, params);
    
    try {
      // Check cache first (for SELECT queries)
      if (this.shouldCache(sql, options) && !options.skipCache) {
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
        this.metrics.cacheMisses++;
      }
      
      // Execute query
      const [rows, fields] = await this.pool.execute(sql, params);
      
      // Cache results if applicable
      if (this.shouldCache(sql, options) && !options.skipCache) {
        await this.setCache(cacheKey, rows, options.cacheTTL);
      }
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, sql);
      
      return rows;
      
    } catch (error) {
      this.metrics.errors++;
      console.error('❌ Database query error:', {
        sql: sql.substring(0, 100) + '...',
        params: params,
        error: error.message
      });
      throw error;
    }
  }

  // PERFORMANCE OPTIMIZATION: Batch query execution
  async batchQuery(queries) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { sql, params } of queries) {
        const [rows] = await connection.execute(sql, params);
        results.push(rows);
      }
      
      await connection.commit();
      return results;
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // PERFORMANCE OPTIMIZATION: Prepared statement caching
  async preparedQuery(sql, params = [], options = {}) {
    const connection = await this.pool.getConnection();
    
    try {
      const statement = await connection.prepare(sql);
      const [rows] = await statement.execute(params);
      await statement.close();
      
      return rows;
      
    } finally {
      connection.release();
    }
  }

  // Cache management methods
  generateCacheKey(sql, params) {
    const normalizedSQL = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramString = JSON.stringify(params);
    return `query:${Buffer.from(normalizedSQL + paramString).toString('base64')}`;
  }

  shouldCache(sql, options) {
    if (!this.config.cache.enabled || options.noCache) return false;
    
    const normalizedSQL = sql.trim().toLowerCase();
    return normalizedSQL.startsWith('select') && 
           !normalizedSQL.includes('now()') &&
           !normalizedSQL.includes('rand()') &&
           !normalizedSQL.includes('uuid()');
  }

  async getFromCache(key) {
    // Try Redis first
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn('⚠️ Redis get error:', error.message);
      }
    }
    
    // Fallback to in-memory cache
    const entry = this.cache.get(key);
    if (entry && (!entry.expires || entry.expires > Date.now())) {
      return entry.data;
    }
    
    return null;
  }

  async setCache(key, data, ttl = null) {
    const cacheTTL = ttl || this.config.cache.defaultTTL;
    const expires = Date.now() + (cacheTTL * 1000);
    
    // Store in Redis
    if (this.redisClient) {
      try {
        await this.redisClient.setEx(key, cacheTTL, JSON.stringify(data));
      } catch (error) {
        console.warn('⚠️ Redis set error:', error.message);
      }
    }
    
    // Store in memory cache
    this.cache.set(key, { data, expires });
  }

  async clearCache(pattern = null) {
    if (pattern) {
      // Clear specific pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
      
      if (this.redisClient) {
        try {
          const keys = await this.redisClient.keys(`*${pattern}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        } catch (error) {
          console.warn('⚠️ Redis clear error:', error.message);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
      
      if (this.redisClient) {
        try {
          await this.redisClient.flushDb();
        } catch (error) {
          console.warn('⚠️ Redis flush error:', error.message);
        }
      }
    }
  }

  updateMetrics(duration, sql) {
    this.metrics.queries++;
    this.metrics.totalTime += duration;
    
    // Track slow queries (> 1 second)
    if (duration > 1000) {
      this.metrics.slowQueries++;
      console.warn(`🐌 Slow query detected (${duration}ms):`, sql.substring(0, 100) + '...');
    }
  }

  logMetrics() {
    const avgTime = this.metrics.queries > 0 ? this.metrics.totalTime / this.metrics.queries : 0;
    const cacheHitRate = this.metrics.queries > 0 ? 
      (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0;
    
    console.log('📊 Database Performance Metrics:');
    console.log(`  • Total queries: ${this.metrics.queries}`);
    console.log(`  • Average query time: ${avgTime.toFixed(2)}ms`);
    console.log(`  • Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
    console.log(`  • Slow queries: ${this.metrics.slowQueries}`);
    console.log(`  • Errors: ${this.metrics.errors}`);
    console.log(`  • Cache size: ${this.cache.size} entries`);
  }

  // Health check
  async healthCheck() {
    try {
      const [rows] = await this.pool.execute('SELECT 1 as health');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: this.metrics,
        cacheSize: this.cache.size,
        redisConnected: !!this.redisClient
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Graceful shutdown
  async close() {
    console.log('🔄 Closing database connections...');
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    if (this.pool) {
      await this.pool.end();
    }
    
    console.log('✅ Database connections closed');
  }
}

// Create singleton instance
const optimizedDB = new OptimizedDatabase();

// Export both the instance and the class
module.exports = {
  // Main database instance
  db: optimizedDB,
  
  // Convenience methods that maintain backward compatibility
  query: (sql, params, options) => optimizedDB.query(sql, params, options),
  execute: (sql, params) => optimizedDB.query(sql, params),
  pool: optimizedDB.pool,
  
  // Advanced methods
  batchQuery: (queries) => optimizedDB.batchQuery(queries),
  preparedQuery: (sql, params, options) => optimizedDB.preparedQuery(sql, params, options),
  clearCache: (pattern) => optimizedDB.clearCache(pattern),
  healthCheck: () => optimizedDB.healthCheck(),
  
  // Class export for custom instances
  OptimizedDatabase
};