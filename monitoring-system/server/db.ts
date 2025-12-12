import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (main app directory)
config({ path: path.join(__dirname, '../../.env') });

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

// Use the same DATABASE_URL as the main application
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
    "Please set it in your .env file. " +
    "Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster"
  );
}

const connectionString = process.env.DATABASE_URL;

let poolConfig: any = {
  connectionString: connectionString,
  max: 10, // Smaller pool for monitoring system
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Add SSL configuration for production/cloud databases
const isLocalhost = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');
const isCloudDatabase = connectionString?.includes('render.com') || connectionString?.includes('amazonaws.com') || connectionString?.includes('supabase.com');

if (!isLocalhost && (process.env.NODE_ENV === 'production' || isCloudDatabase)) {
  console.log('[MONITORING-DB] Configuring SSL for cloud database connection');
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
} else {
  console.log('[MONITORING-DB] Using local database configuration (no SSL)');
}

// Log connection attempt (without exposing password)
if (connectionString) {
  const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log('[MONITORING-DB] Connecting to:', maskedUrl);
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[MONITORING-DB] Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('[MONITORING-DB] New client connected to database');
});

export const db = drizzle(pool, { schema });