import { Pool, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

// Database connection pool for PostgreSQL + pgvector
// WHY: A connection pool reuses database connections efficiently rather than opening a new TCP connection per request.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Helper for executing parameterized SQL queries
// WHY: Centralizes query execution, enforces parameterization, and logs errors cleanly.
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development') {
      // console.log('executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}

// Function to initialize tables and pgvector extension from SQL migration
export async function initDb(): Promise<void> {
  const migrationPath = path.join(__dirname, '../../sql/001_init.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await query(sql);
    console.log('✅ Database schema and pgvector extension verified.');
  }
}

// Graceful shutdown helper
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('PostgreSQL connection pool closed.');
}
