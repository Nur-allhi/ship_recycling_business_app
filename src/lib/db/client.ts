import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database(process.env.DATABASE_URL || 'local.sqlite');
export const db = drizzle(sqlite, { schema });

// In the future, we can add logic here to switch to Postgres based on DB_TYPE
// import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// if (process.env.DB_TYPE === 'postgres') { ... }
