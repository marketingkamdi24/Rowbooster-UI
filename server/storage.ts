import {
  users, User, InsertUser, UpdateUser, sessions, Session,
  propertyTables, PropertyTable, InsertPropertyTable,
  productProperties, ProductProperty, InsertProductProperty,
  searchResults, SearchResult, InsertSearchResult,
  appSettings, AppSettings, InsertAppSettings,
  tokenUsage, TokenUsage, InsertTokenUsage, TokenUsageStats,
  manufacturerDomains, ManufacturerDomain, InsertManufacturerDomain,
  excludedDomains, ExcludedDomain, InsertExcludedDomain
} from "@shared/schema";
import bcrypt from "bcryptjs";

// Interface for storage operations
export interface IStorage {
  // Enhanced User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  updateUserLoginAttempts(id: number, attempts: number, lockedUntil?: Date): Promise<void>;
  
  // Session operations
  createSession(userId: number, sessionId: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  deleteSession(sessionId: string): Promise<boolean>;
  deleteUserSessions(userId: number): Promise<void>;
  updateSessionActivity(sessionId: string): Promise<boolean>;
  cleanupExpiredSessions(): Promise<number>;
  
  // Property Table operations (Product Types) - Global (legacy)
  getPropertyTables(): Promise<PropertyTable[]>;
  getPropertyTable(id: number): Promise<PropertyTable | undefined>;
  getPropertyTableByName(name: string): Promise<PropertyTable | undefined>;
  getDefaultPropertyTable(): Promise<PropertyTable | undefined>;
  createPropertyTable(table: InsertPropertyTable): Promise<PropertyTable>;
  updatePropertyTable(id: number, updateData: Partial<InsertPropertyTable>): Promise<PropertyTable | undefined>;
  deletePropertyTable(id: number): Promise<boolean>;
  setDefaultPropertyTable(id: number): Promise<boolean>;

  // Property Table operations - Per-User (new modular architecture)
  getPropertyTablesByUserId(userId: number): Promise<PropertyTable[]>;
  countPropertyTablesByUserId(userId: number): Promise<number>;
  getPropertyTableByIdAndUser(id: number, userId: number): Promise<PropertyTable | undefined>;
  getPropertyTableByNameAndUser(name: string, userId: number): Promise<PropertyTable | undefined>;
  getDefaultPropertyTableByUserId(userId: number): Promise<PropertyTable | undefined>;
  createPropertyTableForUser(table: InsertPropertyTable, userId: number): Promise<PropertyTable>;
  updatePropertyTableForUser(id: number, userId: number, updateData: Partial<InsertPropertyTable>): Promise<PropertyTable | undefined>;
  deletePropertyTableForUser(id: number, userId: number): Promise<boolean>;
  setDefaultPropertyTableForUser(id: number, userId: number): Promise<boolean>;

  // Product Property operations
  getProperties(propertyTableId?: number): Promise<ProductProperty[]>;
  getPropertiesByUserId(userId: number, propertyTableId?: number): Promise<ProductProperty[]>;
  getProperty(id: number): Promise<ProductProperty | undefined>;
  createProperty(property: InsertProductProperty & { propertyTableId?: number }): Promise<ProductProperty>;
  updateProperty(id: number, property: Partial<InsertProductProperty>): Promise<ProductProperty | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  
  // Search Result operations
  getSearchResults(): Promise<SearchResult[]>;
  getSearchResult(id: number): Promise<SearchResult | undefined>;
  createSearchResult(result: InsertSearchResult): Promise<SearchResult>;
  deleteSearchResult(id: number): Promise<boolean>;
  
  // App Settings operations
  getAppSettings(): Promise<AppSettings | undefined>;
  saveAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings>;
  
  // Token Usage operations
  getTokenUsageStats(): Promise<TokenUsageStats>;
  getTokenUsageStatsByUser(userId: number): Promise<TokenUsageStats>;
  saveTokenUsage(usage: InsertTokenUsage): Promise<TokenUsage>;
  getRecentTokenUsage(limit?: number): Promise<TokenUsage[]>;
  getRecentTokenUsageByUser(userId: number, limit?: number): Promise<TokenUsage[]>;
  
  // Manufacturer Domain operations (prioritized domains)
  getManufacturerDomains(): Promise<ManufacturerDomain[]>;
  getManufacturerDomainsByUserId(userId: number): Promise<ManufacturerDomain[]>;
  getManufacturerDomain(id: number): Promise<ManufacturerDomain | undefined>;
  createManufacturerDomain(domain: InsertManufacturerDomain): Promise<ManufacturerDomain>;
  updateManufacturerDomain(id: number, userId: number, updates: Partial<InsertManufacturerDomain>): Promise<ManufacturerDomain | undefined>;
  deleteManufacturerDomain(id: number, userId: number): Promise<boolean>;
  
  // Excluded Domain operations (blocked domains)
  getExcludedDomains(): Promise<ExcludedDomain[]>;
  getExcludedDomainsByUserId(userId: number): Promise<ExcludedDomain[]>;
  getExcludedDomain(id: number): Promise<ExcludedDomain | undefined>;
  createExcludedDomain(domain: InsertExcludedDomain): Promise<ExcludedDomain>;
  updateExcludedDomain(id: number, userId: number, updates: Partial<InsertExcludedDomain>): Promise<ExcludedDomain | undefined>;
  deleteExcludedDomain(id: number, userId: number): Promise<boolean>;
  
  // Health Check operations
  healthCheck(): Promise<boolean>;
  getDatabaseStats(): Promise<{
    status: string;
    tables: { name: string; count: number }[];
    connectionPool?: any;
  }>;
}

// Import the DatabaseStorage implementation
import { DatabaseStorage } from './DatabaseStorage';

// MemStorage has been completely removed - the application ONLY uses PostgreSQL DatabaseStorage

// Export a single instance - ALWAYS use DatabaseStorage
import { db } from './db';

// Enforce database-only usage - NO FALLBACK to MemStorage
if (!db) {
  console.error('[FATAL ERROR] PostgreSQL database connection is not available!');
  console.error('[FATAL ERROR] Please check your DATABASE_URL in .env file');
  console.error('[FATAL ERROR] The application REQUIRES a database connection to function');
  throw new Error('Database connection required. Cannot start application without PostgreSQL.');
}

export const storage = new DatabaseStorage();
console.log('[INFO] Using PostgreSQL DatabaseStorage for persistent data');
console.log('[INFO] Database connection established successfully');
