// Load environment variables FIRST before anything else
import { config } from 'dotenv';
config();

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// DATABASE_URL is REQUIRED - no fallback to in-memory storage
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
    "Please set it in your .env file. " +
    "Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster"
  );
}

// Create PostgreSQL connection pool with SSL support for production
const connectionString = process.env.DATABASE_URL;

// Parse the connection string to add SSL if needed
let poolConfig: any = {
  connectionString: connectionString,
  // Connection pool configuration
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // Increased timeout for cloud databases
};

// Add SSL configuration for production/cloud databases (but NOT for localhost)
const isLocalhost = connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');
const isCloudDatabase = connectionString?.includes('render.com') || connectionString?.includes('amazonaws.com') || connectionString?.includes('supabase.com');

if (!isLocalhost && (process.env.NODE_ENV === 'production' || isCloudDatabase)) {
  console.log('[DB] Configuring SSL for cloud database connection');
  poolConfig.ssl = {
    rejectUnauthorized: false // Required for cloud databases (Render, AWS, etc.)
  };
} else {
  console.log('[DB] Using local database configuration (no SSL)');
}

// Log connection attempt (without exposing password)
if (connectionString) {
  const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log('[DB] Connecting to:', maskedUrl);
}

export const pool = new Pool(poolConfig);

// Test the connection on startup
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('[DB] New client connected to database');
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });