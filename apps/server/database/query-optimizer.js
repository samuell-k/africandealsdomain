/**
 * PERFORMANCE OPTIMIZATION: Database Query Optimizer
 * 
 * This module provides query optimization utilities:
 * - Query analysis and optimization suggestions
 * - Index recommendations
 * - Query rewriting for better performance
 * - Batch operations
 * - Pagination optimization
 * - Query monitoring and profiling
 */

const { db } = require('./optimized-database');

class QueryOptimizer {
  constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.indexRecommendations = new Set();
  }

  /**
   * PERFORMANCE OPTIMIZATION: Optimized pagination
   * Uses cursor-based pagination for better performance on large datasets
   */
  async paginateQuery(baseQuery, params = [], options = {}) {
    const {
      page = 1,
      limit = 20,
      orderBy = 'id',
      orderDirection = 'DESC',
      cursor = null,
      useCursor = false
    } = options;
    
    try {
      if (useCursor && cursor) {
        // Cursor-based pagination (more efficient for large datasets)
        const operator = orderDirection === 'DESC' ? '<' : '>';
        const cursorCondition = `AND ${orderBy} ${operator} ?`;
        
        const paginatedQuery = `
          ${baseQuery} 
          ${cursorCondition}
          ORDER BY ${orderBy} ${orderDirection} 
          LIMIT ?
        `;
        
        const results = await db.query(paginatedQuery, [...params, cursor, limit]);
        
        return {
          data: results,
          hasMore: results.length === limit,
          nextCursor: results.length > 0 ? results[results.length - 1][orderBy] : null,
          pagination: {
            type: 'cursor',
            limit,
            hasMore: results.length === limit
          }
        };
        
      } else {
        // Offset-based pagination (traditional)
        const offset = (page - 1) * limit;
        
        // Get total count (cached for performance)
        const countQuery = baseQuery.replace(/SELECT.*?FROM/i, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params, { cacheTTL: 300 });
        const total = countResult.total;
        
        // Get paginated results
        const paginatedQuery = `
          ${baseQuery} 
          ORDER BY ${orderBy} ${orderDirection} 
          LIMIT ? OFFSET ?
        `;
        
        const results = await db.query(paginatedQuery, [...params, limit, offset]);
        
        return {
          data: results,
          pagination: {
            type: 'offset',
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + limit < total,
            hasPrevious: page > 1
          }
        };
      }
      
    } catch (error) {
      console.error('❌ Pagination error:', error);
      throw error;
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Batch insert with conflict resolution
   */
  async batchInsert(table, records, options = {}) {
    if (!records || records.length === 0) {
      return { insertedCount: 0, errors: [] };
    }
    
    const {
      batchSize = 100,
      onConflict = 'IGNORE', // 'IGNORE', 'UPDATE', 'REPLACE'
      updateColumns = []
    } = options;
    
    const results = {
      insertedCount: 0,
      updatedCount: 0,
      errors: []
    };
    
    try {
      // Process in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        if (batch.length === 0) continue;
        
        // Get column names from first record
        const columns = Object.keys(batch[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const valuesPlaceholder = `(${placeholders})`;
        const allValuesPlaceholder = batch.map(() => valuesPlaceholder).join(', ');
        
        // Flatten values
        const values = batch.flatMap(record => columns.map(col => record[col]));
        
        // Build query based on conflict resolution
        let query;
        switch (onConflict) {
          case 'UPDATE':
            const updateClause = updateColumns.length > 0 
              ? updateColumns.map(col => `${col} = VALUES(${col})`).join(', ')
              : columns.filter(col => col !== 'id').map(col => `${col} = VALUES(${col})`).join(', ');
            
            query = `
              INSERT INTO ${table} (${columns.join(', ')}) 
              VALUES ${allValuesPlaceholder}
              ON DUPLICATE KEY UPDATE ${updateClause}
            `;
            break;
            
          case 'REPLACE':
            query = `
              REPLACE INTO ${table} (${columns.join(', ')}) 
              VALUES ${allValuesPlaceholder}
            `;
            break;
            
          default: // IGNORE
            query = `
              INSERT IGNORE INTO ${table} (${columns.join(', ')}) 
              VALUES ${allValuesPlaceholder}
            `;
        }
        
        const result = await db.query(query, values);
        results.insertedCount += result.affectedRows;
        
        if (onConflict === 'UPDATE') {
          results.updatedCount += result.changedRows || 0;
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Batch insert error:', error);
      results.errors.push(error.message);
      throw error;
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Optimized search with full-text indexing
   */
  async searchQuery(table, searchTerm, searchColumns, options = {}) {
    const {
      limit = 20,
      offset = 0,
      additionalWhere = '',
      additionalParams = [],
      orderBy = 'relevance DESC',
      useFullText = true
    } = options;
    
    try {
      let query;
      let params;
      
      if (useFullText && searchColumns.length > 0) {
        // Use full-text search if available
        const fullTextColumns = searchColumns.join(', ');
        query = `
          SELECT *, 
                 MATCH(${fullTextColumns}) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
          FROM ${table}
          WHERE MATCH(${fullTextColumns}) AGAINST(? IN NATURAL LANGUAGE MODE)
          ${additionalWhere ? `AND ${additionalWhere}` : ''}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `;
        params = [searchTerm, searchTerm, ...additionalParams, limit, offset];
        
      } else {
        // Fallback to LIKE search
        const likeConditions = searchColumns.map(col => `${col} LIKE ?`).join(' OR ');
        const likeParams = searchColumns.map(() => `%${searchTerm}%`);
        
        query = `
          SELECT *
          FROM ${table}
          WHERE (${likeConditions})
          ${additionalWhere ? `AND ${additionalWhere}` : ''}
          ORDER BY ${orderBy.replace('relevance DESC', 'id DESC')}
          LIMIT ? OFFSET ?
        `;
        params = [...likeParams, ...additionalParams, limit, offset];
      }
      
      const results = await db.query(query, params);
      return results;
      
    } catch (error) {
      console.error('❌ Search query error:', error);
      throw error;
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION: Query analysis and optimization
   */
  async analyzeQuery(sql, params = []) {
    try {
      const startTime = Date.now();
      
      // Execute EXPLAIN to analyze query performance
      const explainQuery = `EXPLAIN FORMAT=JSON ${sql}`;
      const [explainResult] = await db.query(explainQuery, params);
      const queryPlan = JSON.parse(explainResult['EXPLAIN']);
      
      const duration = Date.now() - startTime;
      
      // Analyze the query plan
      const analysis = this.analyzeQueryPlan(queryPlan, sql);
      
      // Store query statistics
      const queryHash = this.hashQuery(sql);
      const stats = this.queryStats.get(queryHash) || {
        sql: sql.substring(0, 100) + '...',
        executions: 0,
        totalTime: 0,
        avgTime: 0,
        slowExecutions: 0
      };
      
      stats.executions++;
      stats.totalTime += duration;
      stats.avgTime = stats.totalTime / stats.executions;
      
      if (duration > this.slowQueryThreshold) {
        stats.slowExecutions++;
      }
      
      this.queryStats.set(queryHash, stats);
      
      return {
        duration,
        queryPlan,
        analysis,
        recommendations: analysis.recommendations
      };
      
    } catch (error) {
      console.error('❌ Query analysis error:', error);
      return {
        error: error.message,
        recommendations: ['Unable to analyze query due to error']
      };
    }
  }

  /**
   * Analyze query execution plan
   */
  analyzeQueryPlan(queryPlan, sql) {
    const analysis = {
      cost: 0,
      rowsExamined: 0,
      tablesUsed: [],
      indexesUsed: [],
      recommendations: [],
      warnings: []
    };
    
    try {
      const query = queryPlan.query_block;
      
      // Analyze table access
      if (query.table) {
        this.analyzeTableAccess(query.table, analysis);
      }
      
      // Analyze nested loops
      if (query.nested_loop) {
        query.nested_loop.forEach(loop => {
          if (loop.table) {
            this.analyzeTableAccess(loop.table, analysis);
          }
        });
      }
      
      // Generate recommendations
      this.generateRecommendations(analysis, sql);
      
    } catch (error) {
      console.error('❌ Query plan analysis error:', error);
      analysis.warnings.push('Failed to fully analyze query plan');
    }
    
    return analysis;
  }

  /**
   * Analyze table access in query plan
   */
  analyzeTableAccess(table, analysis) {
    analysis.tablesUsed.push(table.table_name);
    
    if (table.rows_examined_per_scan) {
      analysis.rowsExamined += table.rows_examined_per_scan;
    }
    
    if (table.key) {
      analysis.indexesUsed.push({
        table: table.table_name,
        index: table.key,
        keyLength: table.key_length
      });
    } else {
      analysis.warnings.push(`Table scan detected on ${table.table_name}`);
    }
    
    if (table.access_type === 'ALL') {
      analysis.warnings.push(`Full table scan on ${table.table_name}`);
    }
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(analysis, sql) {
    // Recommend indexes for table scans
    analysis.warnings.forEach(warning => {
      if (warning.includes('Table scan') || warning.includes('Full table scan')) {
        const tableName = warning.match(/on (\w+)/)?.[1];
        if (tableName) {
          // Analyze WHERE clause to suggest indexes
          const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/i);
          if (whereMatch) {
            const whereClause = whereMatch[1];
            const columns = this.extractColumnsFromWhere(whereClause);
            
            columns.forEach(column => {
              const recommendation = `Consider adding index on ${tableName}.${column}`;
              if (!analysis.recommendations.includes(recommendation)) {
                analysis.recommendations.push(recommendation);
                this.indexRecommendations.add(`${tableName}.${column}`);
              }
            });
          }
        }
      }
    });
    
    // Recommend query rewriting for large row examinations
    if (analysis.rowsExamined > 10000) {
      analysis.recommendations.push('Consider adding LIMIT clause or more selective WHERE conditions');
    }
    
    // Recommend covering indexes
    if (analysis.indexesUsed.length > 0) {
      analysis.recommendations.push('Consider creating covering indexes to avoid key lookups');
    }
  }

  /**
   * Extract column names from WHERE clause
   */
  extractColumnsFromWhere(whereClause) {
    const columns = [];
    
    // Simple regex to extract column names (this could be more sophisticated)
    const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
    
    if (columnMatches) {
      columnMatches.forEach(match => {
        const column = match.replace(/\s*[=<>!].*/, '');
        if (column && !['AND', 'OR', 'NOT'].includes(column.toUpperCase())) {
          columns.push(column);
        }
      });
    }
    
    return [...new Set(columns)]; // Remove duplicates
  }

  /**
   * Generate hash for query identification
   */
  hashQuery(sql) {
    const crypto = require('crypto');
    const normalizedSQL = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    return crypto.createHash('md5').update(normalizedSQL).digest('hex');
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const stats = Array.from(this.queryStats.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10); // Top 10 slowest queries
    
    return {
      totalQueries: this.queryStats.size,
      slowQueries: stats.filter(s => s.avgTime > this.slowQueryThreshold).length,
      topSlowQueries: stats,
      indexRecommendations: Array.from(this.indexRecommendations)
    };
  }

  /**
   * PERFORMANCE OPTIMIZATION: Create recommended indexes
   */
  async createRecommendedIndexes(dryRun = true) {
    const recommendations = Array.from(this.indexRecommendations);
    const results = [];
    
    for (const recommendation of recommendations) {
      const [table, column] = recommendation.split('.');
      const indexName = `idx_${table}_${column}`;
      
      try {
        // Check if index already exists
        const existingIndexes = await db.query(`
          SHOW INDEX FROM ${table} WHERE Column_name = ?
        `, [column]);
        
        if (existingIndexes.length > 0) {
          results.push({
            table,
            column,
            status: 'exists',
            message: `Index already exists on ${table}.${column}`
          });
          continue;
        }
        
        const createIndexSQL = `CREATE INDEX ${indexName} ON ${table} (${column})`;
        
        if (dryRun) {
          results.push({
            table,
            column,
            status: 'recommended',
            sql: createIndexSQL,
            message: `Would create index: ${indexName}`
          });
        } else {
          await db.query(createIndexSQL);
          results.push({
            table,
            column,
            status: 'created',
            sql: createIndexSQL,
            message: `Created index: ${indexName}`
          });
        }
        
      } catch (error) {
        results.push({
          table,
          column,
          status: 'error',
          message: `Failed to create index: ${error.message}`
        });
      }
    }
    
    return results;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.queryStats.clear();
    this.indexRecommendations.clear();
  }
}

// Export singleton instance
const queryOptimizer = new QueryOptimizer();

module.exports = {
  queryOptimizer,
  QueryOptimizer,
  
  // Convenience methods
  paginate: (baseQuery, params, options) => queryOptimizer.paginateQuery(baseQuery, params, options),
  batchInsert: (table, records, options) => queryOptimizer.batchInsert(table, records, options),
  search: (table, searchTerm, searchColumns, options) => queryOptimizer.searchQuery(table, searchTerm, searchColumns, options),
  analyze: (sql, params) => queryOptimizer.analyzeQuery(sql, params),
  getStats: () => queryOptimizer.getQueryStats(),
  createIndexes: (dryRun) => queryOptimizer.createRecommendedIndexes(dryRun)
};