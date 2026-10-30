import { Pool, PoolConfig } from 'pg';
import { newDb } from 'pg-mem';
import { v4 as uuidv4 } from 'uuid';
import { env } from './env';

export interface IDatabase {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  end?: () => Promise<void>;
  isMemory: boolean;
}

let dbInstance: IDatabase;

export function initializeDatabase(): IDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  if (env.NODE_ENV === 'test') {
    // In-memory PostgreSQL instance using pg-mem ONLY when NODE_ENV=test (Requirement 2)
    const mem = newDb();

    // Register gen_random_uuid in pg-mem
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: (mem.public.getType as any)('uuid'),
      implementation: () => uuidv4(),
    });

    const pgAdapter = mem.adapters.createPg();
    const memPool = new pgAdapter.Pool();

    dbInstance = {
      query: (text: string, params?: any[]) => memPool.query(text, params),
      end: () => memPool.end(),
      isMemory: true,
    };

    console.log('[Database] NODE_ENV=test: Initialized in-memory pg-mem database engine.');
    return dbInstance;
  }

  // In development and production, live DATABASE_URL is required
  if (!env.DATABASE_URL || env.DATABASE_URL === 'memory') {
    console.error('[Database Fatal] DATABASE_URL is strictly required in development and production modes.');
    process.exit(1);
  }

  const poolConfig: PoolConfig = {
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  };

  const pool = new Pool(poolConfig);

  dbInstance = {
    query: (text: string, params?: any[]) => pool.query(text, params),
    end: () => pool.end(),
    isMemory: false,
  };

  console.log('[Database] Configured PostgreSQL connection pool for Supabase / PostgreSQL database.');
  return dbInstance;
}

export const db: IDatabase = {
  query: (text: string, params?: any[]) => {
    if (!dbInstance) {
      initializeDatabase();
    }
    return dbInstance.query(text, params);
  },
  end: () => {
    if (dbInstance && dbInstance.end) {
      return dbInstance.end();
    }
    return Promise.resolve();
  },
  get isMemory() {
    if (!dbInstance) {
      initializeDatabase();
    }
    return dbInstance.isMemory;
  },
};

export const pool = db;
