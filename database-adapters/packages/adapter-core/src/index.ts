/**
 * Core Database Adapter Layer for Eghact Framework
 * Provides a unified API for different database systems
 */

// Core Types
export interface DatabaseConfig {
  type: 'postgresql' | 'mongodb' | 'redis' | 'neo4j';
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  options?: Record<string, any>;
}

export interface QueryOptions {
  select?: string[];
  where?: WhereClause;
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  include?: string[];
  transaction?: ITransaction;
}

export interface WhereClause {
  [field: string]: any | {
    $eq?: any;
    $ne?: any;
    $gt?: any;
    $gte?: any;
    $lt?: any;
    $lte?: any;
    $in?: any[];
    $nin?: any[];
    $like?: string;
    $regex?: string;
    $exists?: boolean;
    $and?: WhereClause[];
    $or?: WhereClause[];
  };
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ITransaction {
  id: string;
  isActive: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface QueryResult<T = any> {
  data: T[];
  count: number;
  hasMore?: boolean;
  cursor?: string;
}

export interface ConnectionPool {
  acquire(): Promise<any>;
  release(connection: any): void;
  drain(): Promise<void>;
}

// Main Database Adapter Interface
export interface IDatabaseAdapter {
  // Connection Management
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionPool(): ConnectionPool | null;
  
  // CRUD Operations
  create<T = any>(collection: string, data: Partial<T>, options?: QueryOptions): Promise<T>;
  createMany<T = any>(collection: string, data: Partial<T>[], options?: QueryOptions): Promise<T[]>;
  
  read<T = any>(collection: string, id: string | number, options?: QueryOptions): Promise<T | null>;
  readMany<T = any>(collection: string, options?: QueryOptions): Promise<QueryResult<T>>;
  
  update<T = any>(collection: string, id: string | number, data: Partial<T>, options?: QueryOptions): Promise<T>;
  updateMany<T = any>(collection: string, where: WhereClause, data: Partial<T>, options?: QueryOptions): Promise<number>;
  
  delete(collection: string, id: string | number, options?: QueryOptions): Promise<boolean>;
  deleteMany(collection: string, where: WhereClause, options?: QueryOptions): Promise<number>;
  
  // Advanced Queries
  executeRaw<T = any>(query: string, params?: any[]): Promise<T>;
  aggregate<T = any>(collection: string, pipeline: any[]): Promise<T[]>;
  
  // Transaction Management
  beginTransaction(): Promise<ITransaction>;
  
  // Schema Operations
  createCollection(name: string, schema?: any): Promise<void>;
  dropCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  
  // Index Management
  createIndex(collection: string, fields: string[], options?: { unique?: boolean; sparse?: boolean }): Promise<void>;
  dropIndex(collection: string, indexName: string): Promise<void>;
  
  // Migration Support
  getMigrationTable(): string;
  ensureMigrationTable(): Promise<void>;
}

// Base Adapter Implementation
export abstract class BaseAdapter implements IDatabaseAdapter {
  protected config: DatabaseConfig | null = null;
  protected connected: boolean = false;
  protected connectionPool: ConnectionPool | null = null;
  
  abstract connect(config: DatabaseConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  
  isConnected(): boolean {
    return this.connected;
  }
  
  getConnectionPool(): ConnectionPool | null {
    return this.connectionPool;
  }
  
  abstract create<T = any>(collection: string, data: Partial<T>, options?: QueryOptions): Promise<T>;
  abstract createMany<T = any>(collection: string, data: Partial<T>[], options?: QueryOptions): Promise<T[]>;
  
  abstract read<T = any>(collection: string, id: string | number, options?: QueryOptions): Promise<T | null>;
  abstract readMany<T = any>(collection: string, options?: QueryOptions): Promise<QueryResult<T>>;
  
  abstract update<T = any>(collection: string, id: string | number, data: Partial<T>, options?: QueryOptions): Promise<T>;
  abstract updateMany<T = any>(collection: string, where: WhereClause, data: Partial<T>, options?: QueryOptions): Promise<number>;
  
  abstract delete(collection: string, id: string | number, options?: QueryOptions): Promise<boolean>;
  abstract deleteMany(collection: string, where: WhereClause, options?: QueryOptions): Promise<number>;
  
  abstract executeRaw<T = any>(query: string, params?: any[]): Promise<T>;
  abstract aggregate<T = any>(collection: string, pipeline: any[]): Promise<T[]>;
  
  abstract beginTransaction(): Promise<ITransaction>;
  
  abstract createCollection(name: string, schema?: any): Promise<void>;
  abstract dropCollection(name: string): Promise<void>;
  abstract collectionExists(name: string): Promise<boolean>;
  
  abstract createIndex(collection: string, fields: string[], options?: { unique?: boolean; sparse?: boolean }): Promise<void>;
  abstract dropIndex(collection: string, indexName: string): Promise<void>;
  
  getMigrationTable(): string {
    return '_eghact_migrations';
  }
  
  abstract ensureMigrationTable(): Promise<void>;
}

// Model Base Class
export abstract class Model {
  static adapter: IDatabaseAdapter;
  static collection: string;
  
  id?: string | number;
  createdAt?: Date;
  updatedAt?: Date;
  
  static async find<T extends Model>(this: new () => T, id: string | number): Promise<T | null> {
    const data = await this.adapter.read(this.collection, id);
    if (!data) return null;
    
    const instance = new this();
    Object.assign(instance, data);
    return instance;
  }
  
  static async findMany<T extends Model>(this: new () => T, options?: QueryOptions): Promise<T[]> {
    const result = await this.adapter.readMany(this.collection, options);
    return result.data.map(data => {
      const instance = new this();
      Object.assign(instance, data);
      return instance;
    });
  }
  
  static async create<T extends Model>(this: new () => T, data: Partial<T>): Promise<T> {
    const created = await this.adapter.create(this.collection, data);
    const instance = new this();
    Object.assign(instance, created);
    return instance;
  }
  
  async save(): Promise<void> {
    const adapter = (this.constructor as typeof Model).adapter;
    const collection = (this.constructor as typeof Model).collection;
    
    if (this.id) {
      const updated = await adapter.update(collection, this.id, this);
      Object.assign(this, updated);
    } else {
      const created = await adapter.create(collection, this);
      Object.assign(this, created);
    }
  }
  
  async delete(): Promise<boolean> {
    if (!this.id) return false;
    
    const adapter = (this.constructor as typeof Model).adapter;
    const collection = (this.constructor as typeof Model).collection;
    
    return adapter.delete(collection, this.id);
  }
}

// Schema Definition Types
export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'reference';
  required?: boolean;
  unique?: boolean;
  default?: any;
  index?: boolean;
  reference?: string;
  enum?: any[];
  validate?: (value: any) => boolean | string;
}

export interface Schema {
  fields: Record<string, SchemaField>;
  indexes?: Array<{
    fields: string[];
    unique?: boolean;
    sparse?: boolean;
  }>;
  timestamps?: boolean;
}

// Configuration Loader
export class DatabaseConfigLoader {
  static load(path: string): DatabaseConfig {
    // In production, this would read from a file
    // For now, returning a mock config
    return {
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'eghact',
      username: 'postgres',
      password: 'password'
    };
  }
  
  static validate(config: DatabaseConfig): boolean {
    if (!config.type || !config.host || !config.port) {
      throw new Error('Invalid database configuration');
    }
    return true;
  }
}

// Adapter Factory
export class AdapterFactory {
  private static adapters = new Map<string, new () => IDatabaseAdapter>();
  
  static register(type: string, adapter: new () => IDatabaseAdapter): void {
    this.adapters.set(type, adapter);
  }
  
  static create(config: DatabaseConfig): IDatabaseAdapter {
    const AdapterClass = this.adapters.get(config.type);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for type: ${config.type}`);
    }
    return new AdapterClass();
  }
}

// Query Builder (Fluent API)
export class QueryBuilder<T = any> {
  private adapter: IDatabaseAdapter;
  private collection: string;
  private options: QueryOptions = {};
  
  constructor(adapter: IDatabaseAdapter, collection: string) {
    this.adapter = adapter;
    this.collection = collection;
  }
  
  select(...fields: string[]): this {
    this.options.select = fields;
    return this;
  }
  
  where(clause: WhereClause): this {
    this.options.where = clause;
    return this;
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    if (!this.options.orderBy) this.options.orderBy = [];
    this.options.orderBy.push({ field, direction });
    return this;
  }
  
  limit(count: number): this {
    this.options.limit = count;
    return this;
  }
  
  offset(count: number): this {
    this.options.offset = count;
    return this;
  }
  
  include(...relations: string[]): this {
    this.options.include = relations;
    return this;
  }
  
  async execute(): Promise<QueryResult<T>> {
    return this.adapter.readMany(this.collection, this.options);
  }
  
  async first(): Promise<T | null> {
    this.options.limit = 1;
    const result = await this.execute();
    return result.data[0] || null;
  }
  
  async count(): Promise<number> {
    const result = await this.execute();
    return result.count;
  }
}

// Export utility functions
export function createQueryBuilder<T = any>(adapter: IDatabaseAdapter, collection: string): QueryBuilder<T> {
  return new QueryBuilder<T>(adapter, collection);
}