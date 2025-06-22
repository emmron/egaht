/**
 * PostgreSQL Adapter for Eghact Database Layer
 */

import { Pool, PoolClient, QueryResult as PgQueryResult } from 'pg';
import {
  BaseAdapter,
  DatabaseConfig,
  QueryOptions,
  WhereClause,
  ITransaction,
  QueryResult,
  ConnectionPool,
  AdapterFactory
} from '@eghact/db-adapter-core';

class PostgreSQLConnectionPool implements ConnectionPool {
  constructor(private pool: Pool) {}
  
  async acquire(): Promise<PoolClient> {
    return this.pool.connect();
  }
  
  release(connection: PoolClient): void {
    connection.release();
  }
  
  async drain(): Promise<void> {
    await this.pool.end();
  }
}

class PostgreSQLTransaction implements ITransaction {
  id: string;
  isActive: boolean = true;
  
  constructor(private client: PoolClient) {
    this.id = `pg_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async commit(): Promise<void> {
    if (!this.isActive) throw new Error('Transaction already completed');
    await this.client.query('COMMIT');
    this.isActive = false;
    this.client.release();
  }
  
  async rollback(): Promise<void> {
    if (!this.isActive) throw new Error('Transaction already completed');
    await this.client.query('ROLLBACK');
    this.isActive = false;
    this.client.release();
  }
}

export class PostgreSQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;
  
  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;
    
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.options?.maxConnections || 10,
      idleTimeoutMillis: config.options?.idleTimeout || 30000,
      connectionTimeoutMillis: config.options?.connectionTimeout || 2000,
    });
    
    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    this.connected = true;
    this.connectionPool = new PostgreSQLConnectionPool(this.pool);
  }
  
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      this.connectionPool = null;
    }
  }
  
  async create<T = any>(collection: string, data: Partial<T>, options?: QueryOptions): Promise<T> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${this.sanitizeIdentifier(collection)} (${fields.map(f => this.sanitizeIdentifier(f)).join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async createMany<T = any>(collection: string, data: Partial<T>[], options?: QueryOptions): Promise<T[]> {
    if (data.length === 0) return [];
    
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const fields = Object.keys(data[0]);
      const valueStrings: string[] = [];
      const allValues: any[] = [];
      
      data.forEach((item, index) => {
        const values = fields.map(field => (item as any)[field]);
        const placeholders = values.map((_, i) => `$${index * fields.length + i + 1}`);
        valueStrings.push(`(${placeholders.join(', ')})`);
        allValues.push(...values);
      });
      
      const query = `
        INSERT INTO ${this.sanitizeIdentifier(collection)} (${fields.map(f => this.sanitizeIdentifier(f)).join(', ')})
        VALUES ${valueStrings.join(', ')}
        RETURNING *
      `;
      
      const result = await client.query(query, allValues);
      return result.rows;
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async read<T = any>(collection: string, id: string | number, options?: QueryOptions): Promise<T | null> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const selectClause = options?.select ? 
        options.select.map(f => this.sanitizeIdentifier(f)).join(', ') : 
        '*';
      
      const query = `
        SELECT ${selectClause}
        FROM ${this.sanitizeIdentifier(collection)}
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async readMany<T = any>(collection: string, options?: QueryOptions): Promise<QueryResult<T>> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const selectClause = options?.select ? 
        options.select.map(f => this.sanitizeIdentifier(f)).join(', ') : 
        '*';
      
      let query = `SELECT ${selectClause} FROM ${this.sanitizeIdentifier(collection)}`;
      const values: any[] = [];
      let paramIndex = 1;
      
      // Add WHERE clause
      if (options?.where) {
        const whereClause = this.buildWhereClause(options.where, values, paramIndex);
        if (whereClause.sql) {
          query += ` WHERE ${whereClause.sql}`;
          paramIndex = whereClause.nextIndex;
        }
      }
      
      // Add ORDER BY
      if (options?.orderBy && options.orderBy.length > 0) {
        const orderClauses = options.orderBy.map(
          o => `${this.sanitizeIdentifier(o.field)} ${o.direction.toUpperCase()}`
        );
        query += ` ORDER BY ${orderClauses.join(', ')}`;
      }
      
      // Add LIMIT and OFFSET
      if (options?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        values.push(options.limit);
      }
      
      if (options?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        values.push(options.offset);
      }
      
      const result = await client.query(query, values);
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.sanitizeIdentifier(collection)}`;
      const countResult = await client.query(countQuery);
      const count = parseInt(countResult.rows[0].count);
      
      return {
        data: result.rows,
        count,
        hasMore: options?.limit ? count > (options.offset || 0) + options.limit : false
      };
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async update<T = any>(collection: string, id: string | number, data: Partial<T>, options?: QueryOptions): Promise<T> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((f, i) => `${this.sanitizeIdentifier(f)} = $${i + 2}`).join(', ');
      
      const query = `
        UPDATE ${this.sanitizeIdentifier(collection)}
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(query, [id, ...values]);
      
      if (result.rows.length === 0) {
        throw new Error(`Record with id ${id} not found`);
      }
      
      return result.rows[0];
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async updateMany<T = any>(collection: string, where: WhereClause, data: Partial<T>, options?: QueryOptions): Promise<number> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const fields = Object.keys(data);
      const updateValues = Object.values(data);
      const values: any[] = [...updateValues];
      let paramIndex = fields.length + 1;
      
      const setClause = fields.map((f, i) => `${this.sanitizeIdentifier(f)} = $${i + 1}`).join(', ');
      
      let query = `UPDATE ${this.sanitizeIdentifier(collection)} SET ${setClause}, updated_at = CURRENT_TIMESTAMP`;
      
      const whereClauseResult = this.buildWhereClause(where, values, paramIndex);
      if (whereClauseResult.sql) {
        query += ` WHERE ${whereClauseResult.sql}`;
      }
      
      const result = await client.query(query, values);
      return result.rowCount || 0;
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async delete(collection: string, id: string | number, options?: QueryOptions): Promise<boolean> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const query = `DELETE FROM ${this.sanitizeIdentifier(collection)} WHERE id = $1`;
      const result = await client.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async deleteMany(collection: string, where: WhereClause, options?: QueryOptions): Promise<number> {
    const client = options?.transaction ? 
      (options.transaction as any).client : 
      await this.pool!.connect();
    
    try {
      const values: any[] = [];
      let paramIndex = 1;
      
      let query = `DELETE FROM ${this.sanitizeIdentifier(collection)}`;
      
      const whereClauseResult = this.buildWhereClause(where, values, paramIndex);
      if (whereClauseResult.sql) {
        query += ` WHERE ${whereClauseResult.sql}`;
      }
      
      const result = await client.query(query, values);
      return result.rowCount || 0;
    } finally {
      if (!options?.transaction) {
        client.release();
      }
    }
  }
  
  async executeRaw<T = any>(query: string, params?: any[]): Promise<T> {
    const client = await this.pool!.connect();
    
    try {
      const result = await client.query(query, params);
      return result.rows as T;
    } finally {
      client.release();
    }
  }
  
  async aggregate<T = any>(collection: string, pipeline: any[]): Promise<T[]> {
    // PostgreSQL doesn't have a direct aggregate pipeline like MongoDB
    // This would need to be translated to SQL with CTEs and window functions
    throw new Error('Aggregate pipeline not yet implemented for PostgreSQL');
  }
  
  async beginTransaction(): Promise<ITransaction> {
    const client = await this.pool!.connect();
    await client.query('BEGIN');
    return new PostgreSQLTransaction(client);
  }
  
  async createCollection(name: string, schema?: any): Promise<void> {
    const client = await this.pool!.connect();
    
    try {
      let query = `CREATE TABLE IF NOT EXISTS ${this.sanitizeIdentifier(name)} (`;
      const columns: string[] = ['id SERIAL PRIMARY KEY'];
      
      if (schema?.fields) {
        for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
          const columnDef = this.fieldToColumnDefinition(fieldName, fieldDef as any);
          columns.push(columnDef);
        }
      }
      
      if (schema?.timestamps) {
        columns.push('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        columns.push('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      }
      
      query += columns.join(', ') + ')';
      
      await client.query(query);
      
      // Create indexes
      if (schema?.indexes) {
        for (const index of schema.indexes) {
          await this.createIndex(name, index.fields, {
            unique: index.unique,
            sparse: index.sparse
          });
        }
      }
    } finally {
      client.release();
    }
  }
  
  async dropCollection(name: string): Promise<void> {
    const client = await this.pool!.connect();
    
    try {
      await client.query(`DROP TABLE IF EXISTS ${this.sanitizeIdentifier(name)} CASCADE`);
    } finally {
      client.release();
    }
  }
  
  async collectionExists(name: string): Promise<boolean> {
    const client = await this.pool!.connect();
    
    try {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [name]
      );
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }
  
  async createIndex(collection: string, fields: string[], options?: { unique?: boolean; sparse?: boolean }): Promise<void> {
    const client = await this.pool!.connect();
    
    try {
      const indexName = `idx_${collection}_${fields.join('_')}`;
      const unique = options?.unique ? 'UNIQUE' : '';
      const fieldList = fields.map(f => this.sanitizeIdentifier(f)).join(', ');
      
      let query = `CREATE ${unique} INDEX IF NOT EXISTS ${this.sanitizeIdentifier(indexName)} 
                   ON ${this.sanitizeIdentifier(collection)} (${fieldList})`;
      
      if (options?.sparse) {
        // PostgreSQL uses partial indexes for sparse behavior
        query += ` WHERE ${fields.map(f => `${this.sanitizeIdentifier(f)} IS NOT NULL`).join(' AND ')}`;
      }
      
      await client.query(query);
    } finally {
      client.release();
    }
  }
  
  async dropIndex(collection: string, indexName: string): Promise<void> {
    const client = await this.pool!.connect();
    
    try {
      await client.query(`DROP INDEX IF EXISTS ${this.sanitizeIdentifier(indexName)}`);
    } finally {
      client.release();
    }
  }
  
  async ensureMigrationTable(): Promise<void> {
    const client = await this.pool!.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.getMigrationTable()} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } finally {
      client.release();
    }
  }
  
  // Helper methods
  private sanitizeIdentifier(identifier: string): string {
    // Basic SQL injection prevention for identifiers
    return `"${identifier.replace(/"/g, '""')}"`;
  }
  
  private buildWhereClause(where: WhereClause, values: any[], startIndex: number): { sql: string; nextIndex: number } {
    const conditions: string[] = [];
    let paramIndex = startIndex;
    
    for (const [field, condition] of Object.entries(where)) {
      if (field === '$and') {
        const andConditions = (condition as WhereClause[]).map(subWhere => {
          const result = this.buildWhereClause(subWhere, values, paramIndex);
          paramIndex = result.nextIndex;
          return `(${result.sql})`;
        });
        conditions.push(`(${andConditions.join(' AND ')})`);
      } else if (field === '$or') {
        const orConditions = (condition as WhereClause[]).map(subWhere => {
          const result = this.buildWhereClause(subWhere, values, paramIndex);
          paramIndex = result.nextIndex;
          return `(${result.sql})`;
        });
        conditions.push(`(${orConditions.join(' OR ')})`);
      } else if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
        const fieldConditions: string[] = [];
        
        for (const [op, value] of Object.entries(condition)) {
          switch (op) {
            case '$eq':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} = $${paramIndex++}`);
              values.push(value);
              break;
            case '$ne':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} != $${paramIndex++}`);
              values.push(value);
              break;
            case '$gt':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} > $${paramIndex++}`);
              values.push(value);
              break;
            case '$gte':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} >= $${paramIndex++}`);
              values.push(value);
              break;
            case '$lt':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} < $${paramIndex++}`);
              values.push(value);
              break;
            case '$lte':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} <= $${paramIndex++}`);
              values.push(value);
              break;
            case '$in':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} = ANY($${paramIndex++})`);
              values.push(value);
              break;
            case '$nin':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} != ALL($${paramIndex++})`);
              values.push(value);
              break;
            case '$like':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} LIKE $${paramIndex++}`);
              values.push(value);
              break;
            case '$regex':
              fieldConditions.push(`${this.sanitizeIdentifier(field)} ~ $${paramIndex++}`);
              values.push(value);
              break;
            case '$exists':
              if (value) {
                fieldConditions.push(`${this.sanitizeIdentifier(field)} IS NOT NULL`);
              } else {
                fieldConditions.push(`${this.sanitizeIdentifier(field)} IS NULL`);
              }
              break;
          }
        }
        
        if (fieldConditions.length > 0) {
          conditions.push(`(${fieldConditions.join(' AND ')})`);
        }
      } else {
        // Simple equality
        conditions.push(`${this.sanitizeIdentifier(field)} = $${paramIndex++}`);
        values.push(condition);
      }
    }
    
    return {
      sql: conditions.join(' AND '),
      nextIndex: paramIndex
    };
  }
  
  private fieldToColumnDefinition(fieldName: string, fieldDef: any): string {
    let columnDef = this.sanitizeIdentifier(fieldName);
    
    switch (fieldDef.type) {
      case 'string':
        columnDef += ' VARCHAR(255)';
        break;
      case 'number':
        columnDef += ' NUMERIC';
        break;
      case 'boolean':
        columnDef += ' BOOLEAN';
        break;
      case 'date':
        columnDef += ' TIMESTAMP';
        break;
      case 'object':
        columnDef += ' JSONB';
        break;
      case 'array':
        columnDef += ' JSONB';
        break;
      case 'reference':
        columnDef += ' INTEGER';
        if (fieldDef.reference) {
          columnDef += ` REFERENCES ${this.sanitizeIdentifier(fieldDef.reference)}(id)`;
        }
        break;
    }
    
    if (fieldDef.required) {
      columnDef += ' NOT NULL';
    }
    
    if (fieldDef.unique) {
      columnDef += ' UNIQUE';
    }
    
    if (fieldDef.default !== undefined) {
      columnDef += ` DEFAULT ${this.formatDefaultValue(fieldDef.default)}`;
    }
    
    return columnDef;
  }
  
  private formatDefaultValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (value === null) {
      return 'NULL';
    }
    return value.toString();
  }
}

// Register the adapter
AdapterFactory.register('postgresql', PostgreSQLAdapter);

export { AdapterFactory } from '@eghact/db-adapter-core';