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
import { db } from "./db";
import { eq, desc, and, isNull, lt, sql } from "drizzle-orm";
import { IStorage } from "./storage";
import bcrypt from "bcryptjs";

// Implementation of IStorage with database operations
export class DatabaseStorage implements IStorage {
  // Enhanced User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log('[DB] Querying database for username:', username);
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log('[DB] Query result:', user ? 'User found' : 'No user found');
      if (user) {
        console.log('[DB] User data retrieved:', {
          id: user.id,
          username: user.username,
          email: user.email,
          hasPassword: !!user.password,
          passwordPrefix: user.password?.substring(0, 7)
        });
      }
      return user || undefined;
    } catch (error) {
      console.error('[DB] Error querying user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 12);
    const userData = {
      ...insertUser,
      password: hashedPassword,
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserLoginAttempts(id: number, attempts: number, lockedUntil?: Date): Promise<void> {
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lastFailedLogin: attempts > 0 ? new Date() : null,
        lockedUntil: lockedUntil || null,
      })
      .where(eq(users.id, id));
  }

  // Session operations
  async createSession(userId: number, sessionId: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<Session> {
    const [session] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        userId,
        expiresAt,
        lastActivity: new Date(),
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      })
      .returning();
    console.log(`[SESSION] Created session for user ${userId}, expires at ${expiresAt.toISOString()}`);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    return session || undefined;
  }

  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const result = await db
      .update(sessions)
      .set({ lastActivity: new Date() })
      .where(eq(sessions.id, sessionId));
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const result = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, now));
      
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`[SESSION] Cleaned up ${deletedCount} expired sessions`);
      }
      return deletedCount;
    } catch (error) {
      console.error("[SESSION] Error cleaning up expired sessions:", error);
      return 0;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, sessionId));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteUserSessions(userId: number): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
  
  // Property Table Operations (Product Types) - Now per-user
  
  // MAXIMUM TABLES PER USER
  static readonly MAX_TABLES_PER_USER = 25;
  
  // Get all property tables (admin only - for backward compatibility)
  async getPropertyTables(): Promise<PropertyTable[]> {
    return await db.select().from(propertyTables).orderBy(desc(propertyTables.createdAt));
  }
  
  // Get property tables for a specific user
  async getPropertyTablesByUserId(userId: number): Promise<PropertyTable[]> {
    console.log(`[DB] Fetching property tables for user ID: ${userId}`);
    const tables = await db.select()
      .from(propertyTables)
      .where(eq(propertyTables.userId, userId))
      .orderBy(desc(propertyTables.createdAt));
    console.log(`[DB] Found ${tables.length} property tables for user ${userId}`);
    return tables;
  }
  
  // Count property tables for a user (for limit validation)
  async countPropertyTablesByUserId(userId: number): Promise<number> {
    const tables = await db.select()
      .from(propertyTables)
      .where(eq(propertyTables.userId, userId));
    return tables.length;
  }

  async getPropertyTable(id: number): Promise<PropertyTable | undefined> {
    const [table] = await db.select().from(propertyTables).where(eq(propertyTables.id, id));
    return table || undefined;
  }
  
  // Get property table by ID with user ownership check
  async getPropertyTableByIdAndUser(id: number, userId: number): Promise<PropertyTable | undefined> {
    const [table] = await db.select()
      .from(propertyTables)
      .where(and(eq(propertyTables.id, id), eq(propertyTables.userId, userId)));
    return table || undefined;
  }

  async getPropertyTableByName(name: string): Promise<PropertyTable | undefined> {
    const [table] = await db.select().from(propertyTables).where(eq(propertyTables.name, name));
    return table || undefined;
  }
  
  // Get property table by name for a specific user
  async getPropertyTableByNameAndUser(name: string, userId: number): Promise<PropertyTable | undefined> {
    const [table] = await db.select()
      .from(propertyTables)
      .where(and(eq(propertyTables.name, name), eq(propertyTables.userId, userId)));
    return table || undefined;
  }

  async getDefaultPropertyTable(): Promise<PropertyTable | undefined> {
    console.log('[DB] Querying for default property table (global)...');
    const [table] = await db.select().from(propertyTables).where(eq(propertyTables.isDefault, true));
    if (table) {
      console.log(`[DB] Default table found: "${table.name}" (ID: ${table.id}, isDefault: ${table.isDefault})`);
    } else {
      console.log('[DB] No default table found in database!');
    }
    return table || undefined;
  }
  
  // Get default property table for a specific user
  async getDefaultPropertyTableByUserId(userId: number): Promise<PropertyTable | undefined> {
    console.log(`[DB] Querying for default property table for user ${userId}...`);
    const [table] = await db.select()
      .from(propertyTables)
      .where(and(eq(propertyTables.isDefault, true), eq(propertyTables.userId, userId)));
    if (table) {
      console.log(`[DB] Default table found: "${table.name}" (ID: ${table.id}) for user ${userId}`);
    } else {
      console.log(`[DB] No default table found for user ${userId}`);
    }
    return table || undefined;
  }

  async createPropertyTable(insertTable: InsertPropertyTable): Promise<PropertyTable> {
    // If this table is being set as default and has a userId, unset defaults only for that user
    if (insertTable.isDefault && insertTable.userId) {
      await db.update(propertyTables)
        .set({ isDefault: false })
        .where(eq(propertyTables.userId, insertTable.userId));
    } else if (insertTable.isDefault) {
      // Legacy: unset all defaults if no userId
      await db.update(propertyTables).set({ isDefault: false });
    }
    
    const [table] = await db.insert(propertyTables).values(insertTable).returning();
    return table;
  }
  
  // Create property table for a specific user with limit check
  async createPropertyTableForUser(insertTable: InsertPropertyTable, userId: number): Promise<PropertyTable> {
    // Check table limit for user
    const currentCount = await this.countPropertyTablesByUserId(userId);
    if (currentCount >= DatabaseStorage.MAX_TABLES_PER_USER) {
      throw new Error(`Maximum ${DatabaseStorage.MAX_TABLES_PER_USER} property tables per user exceeded`);
    }
    
    // Check if table name already exists for this user
    const existing = await this.getPropertyTableByNameAndUser(insertTable.name, userId);
    if (existing) {
      throw new Error(`Property table "${insertTable.name}" already exists for this user`);
    }
    
    // If this table is being set as default, unset defaults only for this user
    if (insertTable.isDefault) {
      await db.update(propertyTables)
        .set({ isDefault: false })
        .where(eq(propertyTables.userId, userId));
    }
    
    const [table] = await db.insert(propertyTables).values({
      ...insertTable,
      userId
    }).returning();
    
    console.log(`[DB] Created property table "${table.name}" (ID: ${table.id}) for user ${userId}`);
    return table;
  }

  async updatePropertyTable(id: number, updateData: Partial<InsertPropertyTable>): Promise<PropertyTable | undefined> {
    // If setting as default, unset all other defaults first
    if (updateData.isDefault) {
      await db.update(propertyTables).set({ isDefault: false });
    }
    
    const [updated] = await db
      .update(propertyTables)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(propertyTables.id, id))
      .returning();
    
    return updated || undefined;
  }
  
  // Update property table for a specific user
  async updatePropertyTableForUser(id: number, userId: number, updateData: Partial<InsertPropertyTable>): Promise<PropertyTable | undefined> {
    // Verify ownership
    const existing = await this.getPropertyTableByIdAndUser(id, userId);
    if (!existing) {
      throw new Error('Property table not found or access denied');
    }
    
    // If setting as default, unset defaults only for this user
    if (updateData.isDefault) {
      await db.update(propertyTables)
        .set({ isDefault: false })
        .where(eq(propertyTables.userId, userId));
    }
    
    // If renaming, check for duplicates
    if (updateData.name && updateData.name !== existing.name) {
      const duplicate = await this.getPropertyTableByNameAndUser(updateData.name, userId);
      if (duplicate) {
        throw new Error(`Property table "${updateData.name}" already exists for this user`);
      }
    }
    
    const [updated] = await db
      .update(propertyTables)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(propertyTables.id, id), eq(propertyTables.userId, userId)))
      .returning();
    
    return updated || undefined;
  }

  async deletePropertyTable(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(propertyTables)
      .where(eq(propertyTables.id, id))
      .returning();
    
    return !!deleted;
  }
  
  // Delete property table for a specific user
  async deletePropertyTableForUser(id: number, userId: number): Promise<boolean> {
    // Verify ownership
    const existing = await this.getPropertyTableByIdAndUser(id, userId);
    if (!existing) {
      throw new Error('Property table not found or access denied');
    }
    
    const [deleted] = await db
      .delete(propertyTables)
      .where(and(eq(propertyTables.id, id), eq(propertyTables.userId, userId)))
      .returning();
    
    if (deleted) {
      console.log(`[DB] Deleted property table "${deleted.name}" (ID: ${id}) for user ${userId}`);
    }
    
    return !!deleted;
  }

  async setDefaultPropertyTable(id: number): Promise<boolean> {
    console.log(`[DB] Setting table ID ${id} as default (global)...`);
    
    // Unset all defaults first
    console.log('[DB] Unsetting all previous defaults...');
    await db.update(propertyTables).set({ isDefault: false, updatedAt: new Date() });
    
    // Set the new default
    console.log(`[DB] Setting table ID ${id} as new default...`);
    const [updated] = await db
      .update(propertyTables)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(propertyTables.id, id))
      .returning();
    
    if (updated) {
      console.log(`[DB] ✓ Successfully set "${updated.name}" (ID: ${updated.id}) as default table`);
      
      // Verify it was set correctly
      const verify = await db.select().from(propertyTables).where(eq(propertyTables.isDefault, true));
      console.log(`[DB] Verification: ${verify.length} table(s) currently marked as default`);
      verify.forEach(t => console.log(`[DB]   - "${t.name}" (ID: ${t.id})`));
    } else {
      console.log(`[DB] ✗ Failed to set table ID ${id} as default - table not found`);
    }
    
    return !!updated;
  }
  
  // Set default property table for a specific user
  async setDefaultPropertyTableForUser(id: number, userId: number): Promise<boolean> {
    console.log(`[DB] Setting table ID ${id} as default for user ${userId}...`);
    
    // Verify ownership
    const existing = await this.getPropertyTableByIdAndUser(id, userId);
    if (!existing) {
      throw new Error('Property table not found or access denied');
    }
    
    // Unset defaults only for this user
    await db.update(propertyTables)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(propertyTables.userId, userId));
    
    // Set the new default
    const [updated] = await db
      .update(propertyTables)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(propertyTables.id, id), eq(propertyTables.userId, userId)))
      .returning();
    
    if (updated) {
      console.log(`[DB] ✓ Successfully set "${updated.name}" (ID: ${updated.id}) as default for user ${userId}`);
    }
    
    return !!updated;
  }
  
  // Produkt-Eigenschaften-Operationen
  async getProperties(propertyTableId?: number): Promise<ProductProperty[]> {
    if (propertyTableId !== undefined) {
      console.log(`[DB] Fetching properties for table ID: ${propertyTableId}`);
      return await db.select().from(productProperties).where(eq(productProperties.propertyTableId, propertyTableId));
    }
    
    // If no table specified, get properties from default table or all properties without a table (legacy)
    console.log('[DB] No table ID specified, fetching default table...');
    const defaultTable = await this.getDefaultPropertyTable();
    
    if (defaultTable) {
      console.log(`[DB] Using DEFAULT table: "${defaultTable.name}" (ID: ${defaultTable.id})`);
      const properties = await db.select().from(productProperties).where(eq(productProperties.propertyTableId, defaultTable.id));
      console.log(`[DB] Found ${properties.length} properties in default table "${defaultTable.name}"`);
      if (properties.length > 0) {
        console.log(`[DB] Property names: ${properties.map(p => p.name).join(', ')}`);
      }
      return properties;
    }
    
    // Fallback to properties without a table (for backward compatibility)
    console.log('[DB] No default table found, falling back to legacy properties (no table ID)');
    const legacyProps = await db.select().from(productProperties).where(isNull(productProperties.propertyTableId));
    console.log(`[DB] Found ${legacyProps.length} legacy properties`);
    return legacyProps;
  }
  
  // Get properties for a user's default table
  async getPropertiesByUserId(userId: number, propertyTableId?: number): Promise<ProductProperty[]> {
    if (propertyTableId !== undefined) {
      // Verify the table belongs to this user
      const table = await this.getPropertyTableByIdAndUser(propertyTableId, userId);
      if (!table) {
        console.log(`[DB] Table ID ${propertyTableId} not found for user ${userId}`);
        return [];
      }
      console.log(`[DB] Fetching properties for user ${userId}'s table ID: ${propertyTableId}`);
      return await db.select().from(productProperties).where(eq(productProperties.propertyTableId, propertyTableId));
    }
    
    // Get properties from user's default table
    console.log(`[DB] No table ID specified, fetching default table for user ${userId}...`);
    const defaultTable = await this.getDefaultPropertyTableByUserId(userId);
    
    if (defaultTable) {
      console.log(`[DB] Using user ${userId}'s default table: "${defaultTable.name}" (ID: ${defaultTable.id})`);
      const properties = await db.select().from(productProperties).where(eq(productProperties.propertyTableId, defaultTable.id));
      console.log(`[DB] Found ${properties.length} properties`);
      return properties;
    }
    
    // No default table for user - return empty
    console.log(`[DB] No default table found for user ${userId}`);
    return [];
  }
  
  async getProperty(id: number): Promise<ProductProperty | undefined> {
    const [property] = await db.select().from(productProperties).where(eq(productProperties.id, id));
    return property || undefined;
  }
  
  async createProperty(insertProperty: InsertProductProperty & { propertyTableId?: number }): Promise<ProductProperty> {
    // If no table specified, use the default table
    let tableId = insertProperty.propertyTableId;
    if (tableId === undefined) {
      const defaultTable = await this.getDefaultPropertyTable();
      if (defaultTable) {
        tableId = defaultTable.id;
      }
    }
    
    const [property] = await db.insert(productProperties).values({
      ...insertProperty,
      propertyTableId: tableId
    }).returning();
    return property;
  }
  
  async updateProperty(id: number, updateData: Partial<InsertProductProperty>): Promise<ProductProperty | undefined> {
    const [updated] = await db
      .update(productProperties)
      .set(updateData)
      .where(eq(productProperties.id, id))
      .returning();
    
    return updated || undefined;
  }
  
  async deleteProperty(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(productProperties)
      .where(eq(productProperties.id, id))
      .returning();
    
    return !!deleted;
  }
  
  // Such-Ergebnis-Operationen
  async getSearchResults(): Promise<SearchResult[]> {
    return await db.select().from(searchResults);
  }
  
  async getSearchResult(id: number): Promise<SearchResult | undefined> {
    const [result] = await db.select().from(searchResults).where(eq(searchResults.id, id));
    return result || undefined;
  }
  
  async createSearchResult(insertResult: InsertSearchResult): Promise<SearchResult> {
    try {
      const [result] = await db.insert(searchResults).values(insertResult).returning();
      return result;
    } catch (error: any) {
      // Handle duplicate key violation - sequence might be out of sync
      if (error.code === '23505' && error.constraint === 'search_results_pkey') {
        console.log('[DB] Detected sequence out of sync for search_results, attempting to fix...');
        
        try {
          // Reset the sequence to the max current ID + 1
          await db.execute(sql`
            SELECT setval(
              pg_get_serial_sequence('search_results', 'id'),
              COALESCE((SELECT MAX(id) FROM search_results), 0) + 1,
              false
            )
          `);
          console.log('[DB] Sequence reset successful, retrying insert...');
          
          // Retry the insert after fixing the sequence
          const [result] = await db.insert(searchResults).values(insertResult).returning();
          console.log('[DB] Insert succeeded after sequence fix');
          return result;
        } catch (retryError) {
          console.error('[DB] Failed to fix sequence or retry insert:', retryError);
          throw retryError;
        }
      }
      // Re-throw other errors
      throw error;
    }
  }
  
  async deleteSearchResult(id: number): Promise<boolean> {
    const [deleted] = await db
      .delete(searchResults)
      .where(eq(searchResults.id, id))
      .returning();
    
    return !!deleted;
  }
  
  // App Settings operations
  async getAppSettings(): Promise<AppSettings | undefined> {
    // We'll always use ID 1 for the app settings since there's only one global configuration
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
    return settings || undefined;
  }
  
  async saveAppSettings(settings: Partial<InsertAppSettings>): Promise<AppSettings> {
    // Check if settings already exist
    const existing = await this.getAppSettings();
    
    if (existing) {
      // Update existing settings
      const [updated] = await db.update(appSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(appSettings.id, 1))
        .returning();
      return updated;
    } else {
      // Create new settings with ID 1
      const [created] = await db.insert(appSettings)
        .values({
          ...settings
        })
        .returning();
      return created;
    }
  }

  // Token Usage operations
  async getTokenUsageStats(): Promise<TokenUsageStats> {
    const entries = await db.select().from(tokenUsage).orderBy(desc(tokenUsage.createdAt));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate totals
    const totalInputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0);
    const totalOutputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0);
    const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
    const totalCalls = entries.length;

    // Calculate accurate cost from stored cost fields
    const costEstimate = entries.reduce((sum, entry) => {
      const cost = parseFloat(entry.totalCost || "0");
      return sum + cost;
    }, 0);

    // Filter entries by time periods
    const todayEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= today);
    const weeklyEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= weekAgo);
    const monthlyEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= monthAgo);

    const calculatePeriodStats = (periodEntries: TokenUsage[]) => ({
      inputTokens: periodEntries.reduce((sum, entry) => sum + entry.inputTokens, 0),
      outputTokens: periodEntries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalTokens: periodEntries.reduce((sum, entry) => sum + entry.totalTokens, 0),
      calls: periodEntries.length,
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCalls,
      costEstimate,
      todayUsage: calculatePeriodStats(todayEntries),
      weeklyUsage: calculatePeriodStats(weeklyEntries),
      monthlyUsage: calculatePeriodStats(monthlyEntries),
      recentCalls: entries
        .slice(0, 10)
        .map(entry => ({
          id: entry.id,
          apiCallId: (entry as any).apiCallId || undefined,  // Include apiCallId if available
          modelName: entry.modelName,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          totalTokens: entry.totalTokens,
          inputCost: entry.inputCost || undefined,
          outputCost: entry.outputCost || undefined,
          totalCost: entry.totalCost || undefined,
          apiCallType: entry.apiCallType,
          createdAt: entry.createdAt?.toISOString() || new Date().toISOString(),
        }))
    };
  }

  async saveTokenUsage(usage: InsertTokenUsage): Promise<TokenUsage> {
    const [newTokenUsage] = await db
      .insert(tokenUsage)
      .values({
        ...usage,
        createdAt: new Date()
      })
      .returning();

    return newTokenUsage;
  }

  async getRecentTokenUsage(limit: number = 50): Promise<TokenUsage[]> {
    const entries = await db
      .select()
      .from(tokenUsage)
      .orderBy(desc(tokenUsage.createdAt))
      .limit(limit);

    return entries;
  }

  async getTokenUsageStatsByUser(userId: number): Promise<TokenUsageStats> {
    const entries = await db
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .orderBy(desc(tokenUsage.createdAt));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate totals for this user
    const totalInputTokens = entries.reduce((sum, entry) => sum + entry.inputTokens, 0);
    const totalOutputTokens = entries.reduce((sum, entry) => sum + entry.outputTokens, 0);
    const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
    const totalCalls = entries.length;

    // Calculate accurate cost from stored cost fields
    const costEstimate = entries.reduce((sum, entry) => {
      const cost = parseFloat(entry.totalCost || "0");
      return sum + cost;
    }, 0);

    // Filter entries by time periods
    const todayEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= today);
    const weeklyEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= weekAgo);
    const monthlyEntries = entries.filter(entry => entry.createdAt && entry.createdAt >= monthAgo);

    const calculatePeriodStats = (periodEntries: TokenUsage[]) => ({
      inputTokens: periodEntries.reduce((sum, entry) => sum + entry.inputTokens, 0),
      outputTokens: periodEntries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      totalTokens: periodEntries.reduce((sum, entry) => sum + entry.totalTokens, 0),
      calls: periodEntries.length,
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCalls,
      costEstimate,
      todayUsage: calculatePeriodStats(todayEntries),
      weeklyUsage: calculatePeriodStats(weeklyEntries),
      monthlyUsage: calculatePeriodStats(monthlyEntries),
      recentCalls: entries
        .slice(0, 10)
        .map(entry => ({
          id: entry.id,
          apiCallId: (entry as any).apiCallId || undefined,  // Include apiCallId if available
          modelName: entry.modelName,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          totalTokens: entry.totalTokens,
          inputCost: entry.inputCost || undefined,
          outputCost: entry.outputCost || undefined,
          totalCost: entry.totalCost || undefined,
          apiCallType: entry.apiCallType,
          createdAt: entry.createdAt?.toISOString() || new Date().toISOString(),
        }))
    };
  }

  async getRecentTokenUsageByUser(userId: number, limit: number = 50): Promise<TokenUsage[]> {
    const entries = await db
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .orderBy(desc(tokenUsage.createdAt))
      .limit(limit);

    return entries;
  }

  // Health check - verify database connection
  async healthCheck(): Promise<boolean> {
    try {
      // Simple query to verify connection - use a table we know exists
      await db.select().from(users).limit(1);
      return true;
    } catch (error) {
      console.error('[DB] Health check failed:', error);
      throw error;
    }
  }

  // Get database statistics for detailed health check
  async getDatabaseStats(): Promise<{
    status: string;
    tables: { name: string; count: number }[];
    connectionPool?: any;
  }> {
    try {
      const stats: { name: string; count: number }[] = [];
      
      // Count records in each main table
      const userCount = await db.select().from(users).then(r => r.length);
      stats.push({ name: 'users', count: userCount });
      
      const sessionCount = await db.select().from(sessions).then(r => r.length);
      stats.push({ name: 'sessions', count: sessionCount });
      
      const propertyTableCount = await db.select().from(propertyTables).then(r => r.length);
      stats.push({ name: 'property_tables', count: propertyTableCount });
      
      const propertyCount = await db.select().from(productProperties).then(r => r.length);
      stats.push({ name: 'product_properties', count: propertyCount });
      
      const tokenUsageCount = await db.select().from(tokenUsage).then(r => r.length);
      stats.push({ name: 'token_usage', count: tokenUsageCount });

      return {
        status: 'connected',
        tables: stats,
      };
    } catch (error) {
      console.error('[DB] Failed to get database stats:', error);
      throw error;
    }
  }

  // Manufacturer Domain operations (prioritized domains)
  async getManufacturerDomains(): Promise<ManufacturerDomain[]> {
    try {
      const domains = await db.select().from(manufacturerDomains).orderBy(desc(manufacturerDomains.createdAt));
      console.log(`[DB] Retrieved ${domains.length} manufacturer domains`);
      return domains;
    } catch (error) {
      console.error('[DB] Error fetching manufacturer domains:', error);
      return [];
    }
  }

  async getManufacturerDomainsByUserId(userId: number): Promise<ManufacturerDomain[]> {
    try {
      const domains = await db.select()
        .from(manufacturerDomains)
        .where(eq(manufacturerDomains.userId, userId))
        .orderBy(desc(manufacturerDomains.createdAt));
      console.log(`[DB] Retrieved ${domains.length} manufacturer domains for user ${userId}`);
      return domains;
    } catch (error) {
      console.error(`[DB] Error fetching manufacturer domains for user ${userId}:`, error);
      return [];
    }
  }

  async getManufacturerDomain(id: number): Promise<ManufacturerDomain | undefined> {
    try {
      const [domain] = await db.select().from(manufacturerDomains).where(eq(manufacturerDomains.id, id));
      return domain || undefined;
    } catch (error) {
      console.error(`[DB] Error fetching manufacturer domain ${id}:`, error);
      return undefined;
    }
  }

  async createManufacturerDomain(insertDomain: InsertManufacturerDomain): Promise<ManufacturerDomain> {
    const [domain] = await db.insert(manufacturerDomains).values({
      ...insertDomain,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    console.log(`[DB] Created manufacturer domain: ${domain.name} (${domain.websiteUrl})`);
    return domain;
  }

  async updateManufacturerDomain(id: number, userId: number, updates: Partial<InsertManufacturerDomain>): Promise<ManufacturerDomain | undefined> {
    try {
      // Only update if the domain belongs to this user
      const [updated] = await db
        .update(manufacturerDomains)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(manufacturerDomains.id, id), eq(manufacturerDomains.userId, userId)))
        .returning();
      if (updated) {
        console.log(`[DB] Updated manufacturer domain ${id} for user ${userId}: ${updated.name}`);
      }
      return updated || undefined;
    } catch (error) {
      console.error(`[DB] Error updating manufacturer domain ${id}:`, error);
      return undefined;
    }
  }

  async deleteManufacturerDomain(id: number, userId: number): Promise<boolean> {
    try {
      // Only delete if the domain belongs to this user
      const [deleted] = await db
        .delete(manufacturerDomains)
        .where(and(eq(manufacturerDomains.id, id), eq(manufacturerDomains.userId, userId)))
        .returning();
      if (deleted) {
        console.log(`[DB] Deleted manufacturer domain for user ${userId}: ${deleted.name}`);
      }
      return !!deleted;
    } catch (error) {
      console.error(`[DB] Error deleting manufacturer domain ${id}:`, error);
      return false;
    }
  }

  // Excluded Domain operations (blocked domains)
  async getExcludedDomains(): Promise<ExcludedDomain[]> {
    try {
      const domains = await db.select().from(excludedDomains).orderBy(desc(excludedDomains.createdAt));
      console.log(`[DB] Retrieved ${domains.length} excluded domains`);
      return domains;
    } catch (error) {
      console.error('[DB] Error fetching excluded domains:', error);
      return [];
    }
  }

  async getExcludedDomainsByUserId(userId: number): Promise<ExcludedDomain[]> {
    try {
      const domains = await db.select()
        .from(excludedDomains)
        .where(eq(excludedDomains.userId, userId))
        .orderBy(desc(excludedDomains.createdAt));
      console.log(`[DB] Retrieved ${domains.length} excluded domains for user ${userId}`);
      return domains;
    } catch (error) {
      console.error(`[DB] Error fetching excluded domains for user ${userId}:`, error);
      return [];
    }
  }

  async getExcludedDomain(id: number): Promise<ExcludedDomain | undefined> {
    try {
      const [domain] = await db.select().from(excludedDomains).where(eq(excludedDomains.id, id));
      return domain || undefined;
    } catch (error) {
      console.error(`[DB] Error fetching excluded domain ${id}:`, error);
      return undefined;
    }
  }

  async createExcludedDomain(insertDomain: InsertExcludedDomain): Promise<ExcludedDomain> {
    const [domain] = await db.insert(excludedDomains).values({
      ...insertDomain,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    console.log(`[DB] Created excluded domain: ${domain.domain}`);
    return domain;
  }

  async updateExcludedDomain(id: number, userId: number, updates: Partial<InsertExcludedDomain>): Promise<ExcludedDomain | undefined> {
    try {
      // Only update if the domain belongs to this user
      const [updated] = await db
        .update(excludedDomains)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(excludedDomains.id, id), eq(excludedDomains.userId, userId)))
        .returning();
      if (updated) {
        console.log(`[DB] Updated excluded domain ${id} for user ${userId}: ${updated.domain}`);
      }
      return updated || undefined;
    } catch (error) {
      console.error(`[DB] Error updating excluded domain ${id}:`, error);
      return undefined;
    }
  }

  async deleteExcludedDomain(id: number, userId: number): Promise<boolean> {
    try {
      // Only delete if the domain belongs to this user
      const [deleted] = await db
        .delete(excludedDomains)
        .where(and(eq(excludedDomains.id, id), eq(excludedDomains.userId, userId)))
        .returning();
      if (deleted) {
        console.log(`[DB] Deleted excluded domain for user ${userId}: ${deleted.domain}`);
      }
      return !!deleted;
    } catch (error) {
      console.error(`[DB] Error deleting excluded domain ${id}:`, error);
      return false;
    }
  }
}