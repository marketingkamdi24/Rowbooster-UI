import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import multer from "multer";
import crypto from "crypto";
import { storage } from "./storage";
import { secureLog } from "./utils/secureLogger";
import { getClientIp, createSessionBinding } from "./middleware/security";
import { apiKeyManager } from "./services/apiKeyManager";
import { emailService } from "./services/emailService";
import authRoutes from "./authRoutes";
import { searchService } from "./services/searchService";
import { openaiService } from "./services/openaiService";
import { htmlParserService } from "./services/htmlParserService";
import { MonitoringLogger } from "./services/monitoringLogger";
import {
  insertProductPropertySchema,
  searchRequestSchema,
  exportOptionsSchema,
  searchResults,
  SearchResponse,
  SearchRequest,
  RawContentEntry,
  insertUserSchema,
  updateUserSchema,
  loginSchema,
  changePasswordSchema
} from "@shared/schema";
import {
  requireAuth,
  requireAdmin,
  requireOwnershipOrAdmin,
  authenticateUser,
  logoutUser,
  createDefaultAdminIfNeeded,
  AuthenticatedRequest
} from "./auth";
import { parseHtmlToCleanText } from "./utils/htmlParser";
import { resetLoginAttempts } from "./middleware/security";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import bcrypt from "bcryptjs";
// PDF parsing will be imported dynamically to avoid initialization issues

// Helper function to get ValueSERP location parameters
function getValueSerpLocationParams(location: string) {
  const locationMap = {
    'all': { gl: '', hl: 'en' },  // No specific geolocation for global search
    'multi': { gl: '', hl: 'en' }, // Multi-region search (Germany, Europe, USA)
    'us': { gl: 'us', hl: 'en' },
    'de': { gl: 'de', hl: 'de' }, 
    'eu': { gl: 'de', hl: 'en' }  // Use Germany as base for Europe with English
  };
  
  return locationMap[location as keyof typeof locationMap] || { gl: '', hl: 'en' };
}

// Helper function to build search queries properly handling optional articleNumber
function buildSearchQuery(articleNumber: string | undefined, productName: string, additionalTerms: string = ''): string {
  const queryParts = [];
  
  if (articleNumber && articleNumber.trim()) {
    queryParts.push(articleNumber.trim());
  }
  
  if (productName && productName.trim()) {
    queryParts.push(productName.trim());
  }
  
  if (additionalTerms && additionalTerms.trim()) {
    queryParts.push(additionalTerms.trim());
  }
  
  return queryParts.join(' ');
}

// Helper function to build quoted search queries for more precise matching
function buildQuotedSearchQuery(articleNumber: string | undefined, productName: string, additionalTerms: string = ''): string {
  const queryParts = [];
  
  if (articleNumber && articleNumber.trim()) {
    queryParts.push(`"${articleNumber.trim()}"`);
  }
  
  if (productName && productName.trim()) {
    queryParts.push(`"${productName.trim()}"`);
  }
  
  if (additionalTerms && additionalTerms.trim()) {
    queryParts.push(additionalTerms.trim());
  }
  
  return queryParts.join(' ');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser middleware
  app.use(cookieParser());
  
  // Initialize email service if configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailService.configure({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      from: process.env.SMTP_FROM,
    });
    
    // Verify email connection (non-blocking)
    emailService.verifyConnection().catch(err => {
      console.warn('[EMAIL] Email service not configured or unavailable:', err.message);
    });
  } else {
    console.warn('[EMAIL] Email service not configured - SMTP credentials missing');
  }

  // Initialize default admin user
  await createDefaultAdminIfNeeded();

  // Register authentication routes
  app.use("/api/auth", authRoutes);

  // Authentication routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const clientIp = getClientIp(req);
      const userAgent = req.get('user-agent');
      
      const result = await authenticateUser(credentials, { ip: clientIp, userAgent });
      
      if (!result) {
        // Security: Use generic message to prevent user enumeration
        return res.status(401).json({
          success: false,
          message: "Nutzername oder Passwort stimmt nicht."
        });
      }

      // Reset rate limit counter on successful login
      resetLoginAttempts(clientIp);
      
      // Create session binding for security
      createSessionBinding(result.sessionId, clientIp, userAgent);

      // Set secure cookie with session ID
      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/', // Explicit path
      });

      // Return user data without password
      const { password, ...userWithoutPassword } = result.user;
      
      secureLog.auth('Login successful', {
        userId: result.user.id,
        username: result.user.username,
      });
      
      res.json({
        success: true,
        user: userWithoutPassword,
        message: "Login successful"
      });
    } catch (error: any) {
      secureLog.error('Login error', error);
      const rawMessage = typeof error?.message === 'string' ? error.message : '';

      if (
        rawMessage.includes('Account is temporarily locked') ||
        rawMessage.includes('Too many failed login attempts')
      ) {
        return res.status(429).json({
          success: false,
          message: 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.'
        });
      }

      if (rawMessage.includes('Account is deactivated')) {
        return res.status(403).json({
          success: false,
          message: 'Dieses Konto ist deaktiviert. Bitte kontaktieren Sie den Support.'
        });
      }

      // Security: Use generic message
      return res.status(400).json({
        success: false,
        message: "Anmeldung fehlgeschlagen. Bitte Eingaben prüfen und erneut versuchen."
      });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.sessionId) {
        await logoutUser(req.sessionId, req.user);
      }
      res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      res.json({ success: true, message: "Logout successful" });
    } catch (error) {
      secureLog.error('Logout error', error);
      res.status(500).json({ success: false, message: "Logout failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { password, ...userWithoutPassword } = req.user!;
    res.json({ user: userWithoutPassword });
  });

  // User management routes - REMOVED
  // User CRUD operations are only available in the monitoring-system application
  // These endpoints have been disabled for security purposes
  
  app.get("/api/users", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system for user CRUD operations"
    });
  });

  app.post("/api/users", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system to create users"
    });
  });

  app.get("/api/users/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system for user details"
    });
  });

  app.put("/api/users/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system to update users"
    });
  });

  app.delete("/api/users/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system to delete users"
    });
  });

  app.post("/api/users/:id/change-password", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({
      message: "User management is disabled in the main application",
      info: "Please use the monitoring-system to change passwords"
    });
  });

  // API routes for property tables (product types) - Per-User
  // Maximum property tables per user
  const MAX_TABLES_PER_USER = 25;
  
  // Debug endpoint to verify per-user table isolation
  app.get("/api/debug/user-tables", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const username = req.user!.username;
      const userTables = await storage.getPropertyTablesByUserId(userId);
      const allTables = await storage.getPropertyTables();
      
      console.log(`\n========== DEBUG: USER TABLES ==========`);
      console.log(`Current user: ${username} (ID: ${userId})`);
      console.log(`Tables for this user: ${userTables.length}`);
      userTables.forEach(t => console.log(`  - ${t.name} (ID: ${t.id}, userId: ${t.userId})`));
      console.log(`Total tables in database: ${allTables.length}`);
      allTables.forEach(t => console.log(`  - ${t.name} (ID: ${t.id}, userId: ${t.userId})`));
      console.log(`==========================================\n`);
      
      res.json({
        currentUser: { id: userId, username },
        userTables: userTables.map(t => ({ id: t.id, name: t.name, userId: t.userId })),
        allTables: allTables.map(t => ({ id: t.id, name: t.name, userId: t.userId }))
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  // Get property tables for the authenticated user
  app.get("/api/property-tables", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const username = req.user!.username;
      console.log(`\n[PROPERTY-TABLES] ===================================`);
      console.log(`[PROPERTY-TABLES] Request from user: ${username} (ID: ${userId})`);
      
      let tables = await storage.getPropertyTablesByUserId(userId);
      console.log(`[PROPERTY-TABLES] Found ${tables.length} tables for user ${userId}`);
      if (tables.length > 0) {
        tables.forEach(t => console.log(`[PROPERTY-TABLES]   - "${t.name}" (ID: ${t.id}, userId: ${t.userId})`));
      }
      
      // Auto-initialize: If no tables exist for this user, create default "Kamin" table
      if (tables.length === 0) {
        console.log(`[AUTO-INIT] No property tables found for user ${userId}, creating default 'Kamin' table...`);
        
        // Check if a "Kamin" table already exists for this user (race condition prevention)
        const existingKaminTable = await storage.getPropertyTableByNameAndUser("Kamin", userId);
        
        if (existingKaminTable) {
          console.log("[AUTO-INIT] 'Kamin' table already exists for this user, using existing table");
          tables = [existingKaminTable];
        } else {
          // Create default "Kamin" table for this user
          try {
            console.log(`[AUTO-INIT] Creating default 'Kamin' table for user ${userId}...`);
            const defaultTable = await storage.createPropertyTableForUser({
              name: "Kamin",
              description: "Default property table for Kaminofen products",
              isDefault: true
            }, userId);
            
            console.log("[AUTO-INIT] Created default table:", defaultTable);
            
            // Initialize default Kamin properties
            try {
              const { initializeDefaultKaminProperties } = await import('./init-default-properties');
              await initializeDefaultKaminProperties(defaultTable.id);
              console.log("[AUTO-INIT] ✅ Default Kamin properties initialized successfully");
            } catch (propError) {
              console.error("[AUTO-INIT] ❌ Failed to initialize default properties:", propError);
              // Continue anyway - the table is created, properties can be added manually
            }
            
            // Return the newly created table
            tables = [defaultTable];
          } catch (createError: any) {
            // Handle race condition or other errors
            if (createError.message?.includes('unique') || createError.code === '23505') {
              console.log("[AUTO-INIT] Race condition detected - table was created by another request");
              const raceTable = await storage.getPropertyTableByNameAndUser("Kamin", userId);
              if (raceTable) {
                tables = [raceTable];
              }
            } else if (createError.message?.includes('Maximum')) {
              // User has hit the 25-table limit (shouldn't happen on first table)
              console.error("[AUTO-INIT] Maximum table limit error:", createError.message);
              return res.status(400).json({ message: createError.message });
            } else {
              throw createError;
            }
          }
        }
      }
      
      console.log(`[PROPERTY-TABLES] Returning ${tables.length} tables for user ${userId}`);
      res.json(tables);
    } catch (error) {
      console.error("Error fetching property tables:", error);
      res.status(500).json({ message: "Failed to fetch property tables" });
    }
  });

  // Get default property table for the authenticated user
  app.get("/api/property-tables/default", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const defaultTable = await storage.getDefaultPropertyTableByUserId(userId);
      res.json(defaultTable || null);
    } catch (error) {
      console.error("Error fetching default property table:", error);
      res.status(500).json({ message: "Failed to fetch default property table" });
    }
  });
  
  // Get table count for the authenticated user (for UI to show limit status)
  app.get("/api/property-tables/count", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const count = await storage.countPropertyTablesByUserId(userId);
      res.json({
        count,
        maxTables: MAX_TABLES_PER_USER,
        remaining: MAX_TABLES_PER_USER - count
      });
    } catch (error) {
      console.error("Error fetching property table count:", error);
      res.status(500).json({ message: "Failed to fetch property table count" });
    }
  });

  // Create property table for the authenticated user (with 25-table limit)
  app.post("/api/property-tables", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { name, description, isDefault } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Property table name is required" });
      }

      // Validate table limit
      const currentCount = await storage.countPropertyTablesByUserId(userId);
      if (currentCount >= MAX_TABLES_PER_USER) {
        return res.status(400).json({
          message: `Maximum ${MAX_TABLES_PER_USER} property tables per user exceeded`,
          currentCount,
          maxTables: MAX_TABLES_PER_USER
        });
      }

      // Check if table with this name already exists for this user
      const existing = await storage.getPropertyTableByNameAndUser(name.trim(), userId);
      if (existing) {
        return res.status(400).json({ message: "A property table with this name already exists" });
      }

      const newTable = await storage.createPropertyTableForUser({
        name: name.trim(),
        description: description?.trim() || null,
        isDefault: isDefault || false
      }, userId);
      
      console.log(`[PROPERTY-TABLES] Created table "${name}" for user ${userId}`);
      res.status(201).json(newTable);
    } catch (error: any) {
      console.error("Error creating property table:", error);
      if (error.message?.includes('Maximum')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('already exists')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create property table" });
    }
  });

  // Update property table for the authenticated user
  app.put("/api/property-tables/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const { name, description, isDefault } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      const updated = await storage.updatePropertyTableForUser(id, userId, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Property table not found or access denied" });
      }

      console.log(`[PROPERTY-TABLES] Updated table ${id} for user ${userId}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating property table:", error);
      if (error.message?.includes('not found') || error.message?.includes('denied')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message?.includes('already exists')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update property table" });
    }
  });

  // Set default property table for the authenticated user
  app.post("/api/property-tables/:id/set-default", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const success = await storage.setDefaultPropertyTableForUser(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Property table not found or access denied" });
      }

      console.log(`[PROPERTY-TABLES] Set table ${id} as default for user ${userId}`);
      res.json({ message: "Default property table updated successfully" });
    } catch (error: any) {
      console.error("Error setting default property table:", error);
      if (error.message?.includes('not found') || error.message?.includes('denied')) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to set default property table" });
    }
  });

  // Delete property table for the authenticated user
  app.delete("/api/property-tables/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      
      // Check if this is the default table for this user
      const table = await storage.getPropertyTableByIdAndUser(id, userId);
      if (!table) {
        return res.status(404).json({ message: "Property table not found or access denied" });
      }
      if (table.isDefault) {
        return res.status(400).json({ message: "Cannot delete the default property table. Please set another table as default first." });
      }

      const success = await storage.deletePropertyTableForUser(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Property table not found or access denied" });
      }

      console.log(`[PROPERTY-TABLES] Deleted table ${id} for user ${userId}`);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting property table:", error);
      if (error.message?.includes('not found') || error.message?.includes('denied')) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete property table" });
    }
  });

  // API routes for product properties - Per-User
  app.get("/api/properties", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const tableId = req.query.tableId ? parseInt(req.query.tableId as string) : undefined;
      
      console.log(`[PROPERTIES] User ${userId} requesting properties${tableId ? ` for table ${tableId}` : ' (default table)'}`);
      
      // Use per-user property fetching
      const properties = await storage.getPropertiesByUserId(userId, tableId);
      
      // Sort by orderIndex to maintain the exact order from Excel import
      const sortedProperties = properties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      console.log(`[PROPERTIES] Returning ${sortedProperties.length} properties for user ${userId}`);
      res.json(sortedProperties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.post("/api/properties", async (req: Request, res: Response) => {
    try {
      const validatedData = insertProductPropertySchema.parse(req.body);
      // Extract propertyTableId if provided (not in the schema but accepted by createProperty)
      const propertyTableId = req.body.propertyTableId ? parseInt(req.body.propertyTableId) : undefined;
      const newProperty = await storage.createProperty({
        ...validatedData,
        propertyTableId
      });
      res.status(201).json(newProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid property data", errors: error.errors });
      } else {
        console.error("Error creating property:", error);
        res.status(500).json({ message: "Failed to create property" });
      }
    }
  });

  app.put("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertProductPropertySchema.partial().parse(req.body);
      const updatedProperty = await storage.updateProperty(id, validatedData);

      if (!updatedProperty) {
        return res.status(404).json({ message: `Property with ID ${id} not found` });
      }

      res.json(updatedProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid property data", errors: error.errors });
      } else {
        console.error("Error updating property:", error);
        res.status(500).json({ message: "Failed to update property" });
      }
    }
  });

  app.delete("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProperty(id);

      if (!success) {
        return res.status(404).json({ message: `Property with ID ${id} not found` });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // DEBUG endpoint to verify default table
  app.get("/api/debug/default-table-info", async (req: Request, res: Response) => {
    try {
      console.log('\n=== DEBUG: Default Table Info ===');
      
      // Get all tables
      const allTables = await storage.getPropertyTables();
      console.log(`Total tables: ${allTables.length}`);
      allTables.forEach(t => console.log(`  - "${t.name}" (ID: ${t.id}, isDefault: ${t.isDefault})`));
      
      // Get default table
      const defaultTable = await storage.getDefaultPropertyTable();
      console.log(`\nDefault table: ${defaultTable ? `"${defaultTable.name}" (ID: ${defaultTable.id})` : 'NONE'}`);
      
      // Get properties from default table
      const properties = await storage.getProperties();
      console.log(`\nProperties from default table: ${properties.length}`);
      properties.forEach(p => console.log(`  - ${p.name} (tableId: ${p.propertyTableId})`));
      
      console.log('=== END DEBUG ===\n');
      
      res.json({
        allTables,
        defaultTable,
        propertiesFromDefault: properties,
        propertyCount: properties.length
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Import properties from Excel file (per-user)
  app.post("/api/import-properties", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      console.log(`[IMPORT-PROPERTIES] Import request from user ${userId} (${req.user!.username})`);
      console.log("[IMPORT-PROPERTIES] Request body:", req.body);
      
      const propertiesData = req.body.properties;
      const targetTableId = req.body.propertyTableId; // Allow specifying which table to import to
      
      if (!Array.isArray(propertiesData) || propertiesData.length === 0) {
        console.log("[IMPORT-PROPERTIES] No properties provided in request");
        return res.status(400).json({ message: "No properties provided" });
      }

      console.log(`[IMPORT-PROPERTIES] Importing ${propertiesData.length} properties`);
      
      // Determine target table - must verify ownership
      let tableId = targetTableId;
      if (!tableId) {
        // Use user's default table if no specific table specified
        const defaultTable = await storage.getDefaultPropertyTableByUserId(userId);
        if (defaultTable) {
          tableId = defaultTable.id;
          console.log(`[IMPORT-PROPERTIES] Using user's default table "${defaultTable.name}" (ID: ${tableId})`);
        } else {
          // No default table exists - create one for the user
          console.log("[IMPORT-PROPERTIES] No default table found - creating default 'Imported Properties' table");
          const newTable = await storage.createPropertyTableForUser({
            name: "Imported Properties",
            description: "Auto-created table for imported properties",
            isDefault: true
          }, userId);
          tableId = newTable.id;
          console.log(`[IMPORT-PROPERTIES] Created new table "${newTable.name}" (ID: ${tableId})`);
        }
      } else {
        // Verify user owns the target table
        const table = await storage.getPropertyTableByIdAndUser(tableId, userId);
        if (!table) {
          console.log(`[IMPORT-PROPERTIES] Table ${tableId} not found or access denied for user ${userId}`);
          return res.status(404).json({ message: "Property table not found or access denied" });
        }
        console.log(`[IMPORT-PROPERTIES] Using specified table "${table.name}" (ID: ${tableId})`);
      }

      // Clear existing properties in the target table to maintain order
      const existingProperties = await storage.getPropertiesByUserId(userId, tableId);
      console.log(`[IMPORT-PROPERTIES] Clearing ${existingProperties.length} existing properties from table ID ${tableId}`);
      for (const prop of existingProperties) {
        await storage.deleteProperty(prop.id);
      }

      // Import new properties in the correct order
      const importedProperties = [];
      for (const propData of propertiesData) {
        console.log("[IMPORT-PROPERTIES] Creating property:", propData);
        try {
          const property = await storage.createProperty({
            name: propData.name,
            description: propData.description || null,
            expectedFormat: propData.expectedFormat || null,
            orderIndex: propData.order || 0,
            propertyTableId: tableId
          });
          importedProperties.push(property);
          console.log("[IMPORT-PROPERTIES] Created property:", property);
        } catch (createError) {
          console.error("[IMPORT-PROPERTIES] Error creating individual property:", createError, "Data:", propData);
          throw createError;
        }
      }

      console.log(`[IMPORT-PROPERTIES] Successfully imported ${importedProperties.length} properties to table ID ${tableId}`);
      res.json({
        message: `Successfully imported ${importedProperties.length} properties`,
        properties: importedProperties,
        tableId: tableId
      });
    } catch (error) {
      console.error("[IMPORT-PROPERTIES] Error importing properties:", error);
      res.status(500).json({
        message: "Failed to import properties",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API routes for search results
  app.get("/api/search-results", async (req: Request, res: Response) => {
    try {
      const dbResults = await storage.getSearchResults();

      // Convert database results to frontend format with products array
      const frontendResults = dbResults.map(result => ({
        id: result.id,
        searchMethod: result.searchMethod,
        searchStatus: "complete", // Set all saved results to complete status
        createdAt: result.createdAt,
        products: [{
          id: uuidv4(),
          articleNumber: result.articleNumber,
          productName: result.productName,
          properties: result.properties 
        }]
      }));

      res.json(frontendResults);
    } catch (error) {
      console.error("Error fetching search results:", error);
      res.status(500).json({ message: "Failed to fetch search results" });
    }
  });

  app.get("/api/search-results/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const dbResult = await storage.getSearchResult(id);

      if (!dbResult) {
        return res.status(404).json({ message: `Search result with ID ${id} not found` });
      }

      // Convert database result to frontend format with products array
      const frontendResult = {
        id: dbResult.id,
        searchMethod: dbResult.searchMethod,
        searchStatus: "complete", // Mark as complete since it's from the database
        createdAt: dbResult.createdAt,
        products: [{
          id: uuidv4(),
          articleNumber: dbResult.articleNumber,
          productName: dbResult.productName,
          properties: dbResult.properties
        }]
      };

      res.json(frontendResult);
    } catch (error) {
      console.error("Error fetching search result:", error);
      res.status(500).json({ message: "Failed to fetch search result" });
    }
  });

  app.delete("/api/search-results/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSearchResult(id);

      if (!success) {
        return res.status(404).json({ message: `Search result with ID ${id} not found` });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting search result:", error);
      res.status(500).json({ message: "Failed to delete search result" });
    }
  });

  // API route for quick search (immediate results, like Google)
  app.post("/api/quick-search", async (req: Request, res: Response) => {
    try {
      const searchData = searchRequestSchema.parse(req.body);

      // Check if ValueSERP should be used
      if (searchData.useValueSerp) {
        console.log("Using ValueSERP for quick search");

        // Get API key from environment variables or user-provided key
        const serverApiKey = searchData.valueSerpApiKey || process.env.VALUESERP_API_KEY;

        if (!serverApiKey) {
          return res.status(400).json({
            message: "ValueSERP API key is required",
            details: "Please provide a ValueSERP API key or disable ValueSERP search"
          });
        }

        // Construct the search query
        const query = buildSearchQuery(searchData.articleNumber, searchData.productName);
        const page = 1; // Default to first page

        try {
          // Build the ValueSERP API URL
          const searchUrl = new URL('https://api.valueserp.com/search');

          // Add required parameters
          searchUrl.searchParams.append('api_key', serverApiKey);
          searchUrl.searchParams.append('q', query);
          searchUrl.searchParams.append('page', page.toString());
          searchUrl.searchParams.append('num', (searchData.maxResults || 10).toString());
          searchUrl.searchParams.append('output', 'json');
          searchUrl.searchParams.append('device', 'desktop');
          // Get location setting - default to German
          const appSettings = await storage.getAppSettings();
          const location = searchData.valueSerpLocation || appSettings?.valueSerpLocation || 'de';
          const locationParams = getValueSerpLocationParams(location);
          searchUrl.searchParams.append('gl', locationParams.gl || 'de'); // Geolocation - default to Germany
          searchUrl.searchParams.append('hl', locationParams.hl || 'de'); // Language - default to German
          searchUrl.searchParams.append('google_domain', 'google.de'); // Use German Google domain

          console.log(`Fetching ValueSERP search results for: "${query}"`);

          const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          // Check response status
          console.log(`ValueSERP API response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`ValueSERP API error: ${response.status} ${response.statusText}`, errorText);
            return res.status(response.status).json({
              message: `ValueSERP API error: ${response.status} ${response.statusText}`,
              details: errorText
            });
          }

          // Parse JSON response
          const responseData = await response.json();

          // Check if response has expected structure
          if (!responseData.organic_results) {
            console.log('Response structure:', JSON.stringify(responseData).substring(0, 200) + '...');
            return res.status(500).json({
              message: 'Invalid response structure from ValueSERP API',
              details: 'The response does not contain expected search results data'
            });
          }

          // Format the search results for our application
          const formattedResponse = searchService.processValueSerpResults(
            responseData,
            searchData.articleNumber,
            searchData.productName,
            searchData.properties,
            searchData.maxResults || 10
          );

          res.json(formattedResponse);
          return;
        } catch (error) {
          console.error('Error using ValueSERP API:', error);
          return res.status(500).json({
            message: 'Error using ValueSERP API',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }


      if (!searchData.searchEngine) {
        return res.status(400).json({ message: "Search engine is required for search" });
      }

      // Get initial search results immediately (like Google)
      console.log("Getting immediate web search results...");
      const initialSources = await searchService.getInitialSearchResults(
        searchData.articleNumber || "",
        searchData.productName,
        searchData.searchEngine,
        searchData.maxResults
      );

      // Create product with just the URLs found
      const product = {
        id: uuidv4(),
        articleNumber: searchData.articleNumber,
        productName: searchData.productName,
        properties: {
          "__meta_sources": {
            name: "__meta_sources",
            value: "Found Web Pages",
            sources: initialSources,
            confidence: 100,
            isConsistent: true
          }
        }
      };

      // Return immediate search response
      const searchResponse: SearchResponse = {
        searchMethod: "auto",
        products: [product],
        searchStatus: "searching",
        statusMessage: "Step 1/2: Found web pages. Click 'Analyze Content' to process with AI."
      };

      // Store the search query for later analysis
      await storage.createSearchResult({
        articleNumber: searchData.articleNumber || "",
        productName: searchData.productName,
        searchMethod: searchData.searchMethod,
        properties: JSON.stringify(searchResponse)
      });

      res.json(searchResponse);
    } catch (error) {
      console.error("Error in quick search:", error);
      res.status(500).json({ 
        message: "Quick search failed", 
        error: (error as Error).message 
      });
    }
  });

  // API route for batch file processing with consistency marking
  app.post("/api/batch-analyze-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Extract userId from authenticated request
      const userId = req.user!.id;
      console.log(`[BATCH-ANALYZE] Processing batch for user ${userId} (username: ${req.user!.username})`);
      
      const batchData = z.object({
        products: z.array(z.object({
          articleNumber: z.string().optional(), // Make articleNumber optional for file uploads
          productName: z.string(),
          searchMethod: z.enum(["auto", "url"]),
          productUrl: z.string().optional(),
        })),
        searchEngine: z.enum(["google"]).optional(),
        useAI: z.boolean().optional(),
        aiModelProvider: z.enum(["openai"]).optional(),
        openaiApiKey: z.string().optional(),
        useValueSerp: z.boolean().optional(),
        valueSerpApiKey: z.string().optional(),
        maxResults: z.number().optional(),
        pdfScraperEnabled: z.boolean().optional(), // Add PDF scraper support for datei mode
        tableId: z.number().optional() // Support per-user table selection
      }).parse(req.body);

      const batchProcessStartTime = Date.now();
      console.log(`\n[BATCH-TIMING] Starting batch processing for ${batchData.products.length} products at ${new Date().toISOString()}`);
      
      // Track timing for entire batch process
      const batchTimingLog = {
        start: batchProcessStartTime,
        setupTime: 0,
        processingTime: 0,
        totalTime: 0,
        productTimes: [] as { product: string, time: number }[]
      };

      // Setup AI integration
      if (batchData.useAI) {
        if (batchData.openaiApiKey) {
          openaiService.setApiKey(batchData.openaiApiKey);
          openaiService.setModelProvider('openai');
        }
      }

      // Get required properties for extraction - PER-USER based on authenticated user
      // Use the tableId from request body if provided, otherwise use user's default table
      let tableIdForProperties = batchData.tableId;
      if (!tableIdForProperties) {
        // Get user's default table
        const defaultTable = await storage.getDefaultPropertyTableByUserId(userId);
        tableIdForProperties = defaultTable?.id;
        console.log(`[BATCH-ANALYZE] Using user's default table: ${defaultTable?.name || 'none'} (ID: ${tableIdForProperties || 'N/A'})`);
      } else {
        console.log(`[BATCH-ANALYZE] Using requested tableId: ${tableIdForProperties}`);
      }
      
      // Fetch properties for this user's table
      const requiredProperties = await storage.getPropertiesByUserId(userId, tableIdForProperties);
      console.log(`[BATCH-ANALYZE] Found ${requiredProperties.length} properties for user ${userId}, table ${tableIdForProperties || 'default'}`);
      
      const aiProperties = requiredProperties.map(prop => ({
        name: prop.name,
        description: prop.description || undefined,
        expectedFormat: prop.expectedFormat || undefined,
        orderIndex: prop.orderIndex || undefined
      }));

      const batchResults: any[] = [];

      // Process products in parallel with higher concurrency limit for better performance
      const concurrencyLimit = 5; // Process max 5 products simultaneously (increased from 3)
      console.log(`[BATCH-TIMING] Processing ${batchData.products.length} products with concurrency limit of ${concurrencyLimit}`);

      for (let i = 0; i < batchData.products.length; i += concurrencyLimit) {
        const batch = batchData.products.slice(i, i + concurrencyLimit);
        console.log(`Processing batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(batchData.products.length / concurrencyLimit)} with ${batch.length} products`);

        const batchPromises = batch.map(async (product) => {
          const productStartTime = Date.now();
          try {
            console.log(`[BATCH-TIMING] Processing product: ${product.articleNumber || 'no article number'} - ${product.productName}`);

            let scrapedContentArray: string[] = [];

            if (product.searchMethod === "auto") {
              // Enhanced search with multi-layer browser fallback for dynamic content
              try {
                console.log(`Starting enhanced search for ${product.articleNumber || 'unnamed'} - ${product.productName}`);
                
                // Get search results first
                const initialSources = await searchService.getInitialSearchResults(
                  product.articleNumber || "",
                  product.productName,
                  batchData.searchEngine || 'google',
                  batchData.maxResults || 10
                );
                
                console.log(`Found ${initialSources.length} search results for ${product.productName}`);
                
                // Process each source with multi-layer scraping approach
                const maxSourcesToProcess = Math.min(initialSources.length, batchData.maxResults || 10);
                const sourcesToProcess = initialSources.slice(0, maxSourcesToProcess);
                
                console.log(`[PARALLEL] Processing ${sourcesToProcess.length} sources in parallel...`);
                const parallelStartTime = Date.now();
                
                // Process all sources in parallel instead of sequentially
                const sourceResults = await Promise.allSettled(
                  sourcesToProcess.map(async (source) => {
                    try {
                      console.log(`[PARALLEL] Starting processing for: ${source.url}`);
                      
                      let htmlContent = '';
                      let usedBrowserScraping = false;
                    
                    try {
                      // Layer 1: Try fast HTTP scraping first
                      const { fastScraper } = await import('./services/fastScraper');
                      const fastResult = await fastScraper.scrapeUrl(source.url, product.articleNumber);
                      
                      if (fastResult.success && fastResult.contentLength > 1000) {
                        htmlContent = fastResult.content;
                        console.log(`Fast scraping successful for ${source.url}, content length: ${fastResult.contentLength} characters`);
                        
                        // Log scraped data to monitoring system
                        try {
                          await MonitoringLogger.logScrapedData({
                            userId: req.user!.id,
                            username: req.user!.username,
                            articleNumber: product.articleNumber,
                            productName: product.productName,
                            url: source.url,
                            scrapingMethod: 'fast-http',
                            rawContent: fastResult.content,
                            contentLength: fastResult.contentLength,
                            contentType: 'html',
                            title: fastResult.title || source.url,
                            statusCode: 200,
                            responseTime: fastResult.loadTime || 0,
                            success: true
                          });
                        } catch (logError) {
                          console.error('[MONITORING] Failed to log scraped data:', logError);
                        }
                      } else {
                        throw new Error('Fast scraping returned minimal content');
                      }
                      
                    } catch (fastError) {
                      console.log(`Fast scraping failed for ${source.url}, trying enhanced HTTP...`);
                      
                      try {
                        // Layer 2: Enhanced HTTP with dynamic content detection
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        
                        const response = await fetch(source.url, {
                          headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Sec-Fetch-Dest': 'document',
                            'Sec-Fetch-Mode': 'navigate',
                            'Sec-Fetch-Site': 'none',
                            'Cache-Control': 'max-age=0'
                          },
                          signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (response.ok) {
                          const html = await response.text();
                          
                          // Advanced dynamic content detection
                          const hasReactApp = html.includes('data-reactroot') || html.includes('__REACT_DEVTOOLS') || html.includes('React');
                          const hasVueApp = html.includes('data-v-') || html.includes('__vue__') || html.includes('Vue');
                          const hasAngularApp = html.includes('ng-app') || html.includes('angular') || html.includes('Angular');
                          const hasComponentFramework = html.includes('data-cid') || html.includes('AppRegistry');
                          const hasMinimalContent = (html.match(/<p|<div|<span/g) || []).length < 10;
                          const hasLotsOfScripts = (html.match(/<script/g) || []).length > 15;
                          const hasEmptyBody = html.includes('<body>') && html.indexOf('</body>') - html.indexOf('<body>') < 200;
                          
                          const isJavaScriptHeavy = hasReactApp || hasVueApp || hasAngularApp || hasComponentFramework || 
                                                   (hasMinimalContent && hasLotsOfScripts) || hasEmptyBody;
                          
                          if (isJavaScriptHeavy) {
                            console.log(`Dynamic content detected for ${source.url}, switching to browser rendering`);
                            throw new Error('Content needs browser rendering');
                          }
                          
                          htmlContent = html;
                          console.log(`Enhanced HTTP successful for ${source.url} (${html.length} chars)`);
                          
                          // Log scraped data to monitoring system
                          try {
                            await MonitoringLogger.logScrapedData({
                              userId: req.user!.id,
                              username: req.user!.username,
                              articleNumber: product.articleNumber,
                              productName: product.productName,
                              url: source.url,
                              scrapingMethod: 'enhanced-http',
                              rawContent: html,
                              contentLength: html.length,
                              contentType: 'html',
                              title: source.url,
                              statusCode: response.status,
                              responseTime: 0,
                              success: true
                            });
                          } catch (logError) {
                            console.error('[MONITORING] Failed to log scraped data:', logError);
                          }
                        } else {
                          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                      } catch (httpError) {
                        console.log(`HTTP fetch failed for ${source.url}, attempting browser rendering...`);
                        
                        try {
                          // Layer 3: Browser-based dynamic rendering
                          const { browserScraper } = await import('./services/browserScraper');
                          const browserResult = await browserScraper.scrapeUrl(source.url, product.articleNumber);
                          htmlContent = browserResult.content;
                          usedBrowserScraping = true;
                          
                          console.log(`Browser scraping successful for ${source.url}, method: ${browserResult.method}, content length: ${browserResult.contentLength}`);
                          
                          // Log scraped data to monitoring system
                          try {
                            await MonitoringLogger.logScrapedData({
                              userId: req.user!.id,
                              username: req.user!.username,
                              articleNumber: product.articleNumber,
                              productName: product.productName,
                              url: source.url,
                              scrapingMethod: 'browser-rendered',
                              rawContent: browserResult.content,
                              contentLength: browserResult.contentLength,
                              contentType: 'html',
                              title: browserResult.title || source.url,
                              statusCode: 200,
                              responseTime: browserResult.loadTime || 0,
                              success: browserResult.success
                            });
                          } catch (logError) {
                            console.error('[MONITORING] Failed to log scraped data:', logError);
                          }
                          
                        } catch (browserError) {
                          console.log(`Browser scraping failed for ${source.url}, trying direct JS execution...`);
                          
                          try {
                            // Layer 4: Direct JavaScript execution as final fallback
                            const { directScraper } = await import('./services/directScraper');
                            const directResult = await directScraper.scrapeUrl(source.url, product.articleNumber);
                            
                            if (directResult.success && directResult.contentLength > 500) {
                              htmlContent = directResult.content;
                              usedBrowserScraping = true;
                              console.log(`Direct JS scraping successful for ${source.url}, content length: ${directResult.contentLength}`);
                              
                              // Log scraped data to monitoring system
                              try {
                                await MonitoringLogger.logScrapedData({
                                  userId: req.user!.id,
                                  username: req.user!.username,
                                  articleNumber: product.articleNumber,
                                  productName: product.productName,
                                  url: source.url,
                                  scrapingMethod: 'direct-js',
                                  rawContent: directResult.content,
                                  contentLength: directResult.contentLength,
                                  contentType: 'html',
                                  title: directResult.title || source.url,
                                  statusCode: 200,
                                  responseTime: directResult.loadTime || 0,
                                  success: true
                                });
                              } catch (logError) {
                                console.error('[MONITORING] Failed to log scraped data:', logError);
                              }
                            } else {
                              throw new Error('Direct scraping returned minimal content');
                            }
                            
                          } catch (directError) {
                            console.error(`All scraping methods failed for ${source.url}:`, directError);
                            return null; // Return null for failed sources
                          }
                        }
                      }
                    }
                    
                    if (htmlContent && htmlContent.length > 100) {
                      console.log(`[PARALLEL] Successfully scraped ${source.url}: ${usedBrowserScraping ? 'browser-rendered' : 'HTTP'} (${htmlContent.length} chars)`);
                      return htmlContent; // Return the content
                    }
                    
                    return null; // Return null if no valid content
                    
                  } catch (sourceError) {
                    console.error(`[PARALLEL] Error processing source ${source.url}:`, sourceError);
                    return null; // Return null for errors
                  }
                })
              );
              
              // Process results and add to scrapedContentArray
              let successCount = 0;
              let failureCount = 0;
              
              sourceResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value !== null) {
                  scrapedContentArray.push(result.value);
                  successCount++;
                } else {
                  failureCount++;
                }
              });
              
              const parallelTime = Date.now() - parallelStartTime;
              console.log(`[PARALLEL] Completed in ${parallelTime}ms - Success: ${successCount}, Failed: ${failureCount}`);
              console.log(`[PARALLEL] Enhanced multi-layer search completed: ${scrapedContentArray.length} sources collected for ${product.productName}`);
                
              } catch (searchError) {
                console.error(`Enhanced search failed for ${product.productName}:`, searchError);
                // Fall back to original method
                try {
                  // Create user context for error logging
                  const userContext = { userId: req.user!.id, username: req.user!.username };
                  
                  const searchPromise = searchService.collectRawContentFromSearchResults(
                    product.articleNumber || "",
                    product.productName,
                    batchData.searchEngine || 'google',
                    scrapedContentArray as unknown as Array<{ content: string; url: string; title: string }>,
                    batchData.maxResults || 10,
                    batchData.pdfScraperEnabled || false,
                    userContext
                  );
                  
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), 20000)
                  );
                  
                  await Promise.race([searchPromise, timeoutPromise]);
                  console.log(`Fallback search collected ${scrapedContentArray.length} sources for ${product.articleNumber}`);
                } catch (fallbackError) {
                  console.error(`Both enhanced and fallback search failed for ${product.productName}:`, fallbackError);
                }
              }

            } else if (product.searchMethod === "url" && product.productUrl) {
              // For URL File Upload mode, use dedicated gpt-4.1 extraction
              console.log(`[URL-FILE-UPLOAD-BATCH] Processing ${product.productName} from ${product.productUrl}`);
              
              try {
                // Enhanced content scraping with dynamic rendering support
                const { jsContentExtractor } = await import('./services/jsContentExtractor');
                const jsResult = await jsContentExtractor.extractContent(product.productUrl, product.articleNumber);
                
                let scrapedContent = '';
                if (jsResult.success && jsResult.hasJavaScriptFramework) {
                  console.log(`[URL-FILE-UPLOAD-BATCH] Using enhanced JS extraction: ${jsResult.method}, ${jsResult.contentLength} characters`);
                  scrapedContent = jsResult.content;
                } else {
                  console.log(`[URL-FILE-UPLOAD-BATCH] Using fallback HTTP scraping`);
                  
                  // Fallback to regular HTTP fetch
                  try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000);
                    
                    const response = await fetch(product.productUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                      },
                      signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                      scrapedContent = await response.text();
                      console.log(`[URL-FILE-UPLOAD-BATCH] HTTP fetch successful: ${scrapedContent.length} characters`);
                    } else {
                      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                  } catch (httpError) {
                    console.error(`[URL-FILE-UPLOAD-BATCH] HTTP fetch failed for ${product.productUrl}:`, httpError);
                    scrapedContent = `Error fetching content: ${(httpError as Error).message}`;
                  }
                }
                
                // Set up OpenAI API key if provided
                if (batchData.openaiApiKey) {
                  console.log(`[URL-FILE-UPLOAD-BATCH] Using provided OpenAI API key`);
                  openaiService.setApiKey(batchData.openaiApiKey);
                } else if (process.env.OPENAI_API_KEY) {
                  console.log(`[URL-FILE-UPLOAD-BATCH] Using environment OpenAI API key`);
                  openaiService.setModelProvider('openai');
                }
                
                // Convert properties to the format expected by the dedicated method
                const propertiesForExtraction = aiProperties.map(prop => ({
                  name: prop.name,
                  description: prop.description || undefined,
                  expectedFormat: prop.expectedFormat || undefined,
                  orderIndex: prop.orderIndex || 0
                }));
                
                console.log(`[URL-FILE-UPLOAD-BATCH] Using dedicated URL File Upload extraction method`);
                
                // Get user's selected AI model for extraction
                const userForModel = await storage.getUser(userId);
                const userSelectedModel = userForModel?.selectedAiModel || "gpt-4.1-mini";
                console.log(`[URL-FILE-UPLOAD-BATCH] Using AI model: ${userSelectedModel}`);
                
                // Use the dedicated URL File Upload extraction method with actual source URL
                const extractedProperties = await openaiService.extractFromUrlFileUpload(
                  scrapedContent,
                  product.articleNumber || '',
                  product.productName,
                  propertiesForExtraction,
                  userId,
                  product.productUrl, // Pass actual URL from Excel file for source tracking
                  userSelectedModel // Pass user's selected model
                );
                
                console.log(`[URL-FILE-UPLOAD-BATCH] Extraction completed for ${product.productName}`);
                
                // Create response for this product - handle optional articleNumber
                const productId = product.articleNumber || `url-file-upload-${Date.now()}`;
                const productResult = {
                  id: Date.now() + Math.random(),
                  searchMethod: product.searchMethod,
                  products: [{
                    id: productId,
                    articleNumber: product.articleNumber || "",
                    productName: product.productName,
                    properties: extractedProperties
                  }],
                  searchStatus: "complete" as const,
                  statusMessage: "URL File Upload extraction completed with gpt-4.1."
                };

                console.log(`[URL-FILE-UPLOAD-BATCH] Completed processing for ${product.articleNumber || 'unnamed product'}`);
                return productResult;
                
              } catch (error) {
                console.error(`[URL-FILE-UPLOAD-BATCH] URL processing failed for ${product.articleNumber}:`, error);
                
                // Create error response for this product
                const errorProductId = product.articleNumber || `error_url_product_${Date.now()}`;
                return {
                  id: Date.now() + Math.random(),
                  searchMethod: product.searchMethod,
                  products: [{
                    id: errorProductId,
                    articleNumber: product.articleNumber || "",
                    productName: product.productName,
                    properties: {
                      "Artikelnummer": {
                        name: "Artikelnummer",
                        value: product.articleNumber || "",
                        confidence: 100,
                        isConsistent: true
                      }
                    }
                  }],
                  searchStatus: "complete" as const,
                  statusMessage: "URL File Upload processing failed for this product."
                };
              }
            }

            // Apply consistency marking with performance optimizations for Automated mode only
            if (product.searchMethod === "auto") {
              // Get user's selected AI model for Automated mode extraction
              const autoUserForModel = await storage.getUser(userId);
              const autoUserSelectedModel = autoUserForModel?.selectedAiModel || "gpt-4.1-mini";
              console.log(`[BATCH-ANALYZE-AUTO] Using AI model: ${autoUserSelectedModel}`);
              
              const extractedProperties = await openaiService.extractTechnicalSpecificationsWithConsistency(
                scrapedContentArray,
                product.articleNumber || "",
                product.productName,
                aiProperties,
                userId,
                autoUserSelectedModel // Pass user's selected model
              );

              // Create response for this product - handle optional articleNumber
              const productId = product.articleNumber || `product_${Date.now()}`;
              const productResult = {
                id: Date.now() + Math.random(),
                searchMethod: product.searchMethod,
                products: [{
                  id: productId,
                  articleNumber: product.articleNumber || "",
                  productName: product.productName,
                  properties: extractedProperties
                }],
                searchStatus: "complete" as const,
                statusMessage: "Automated analysis complete with consistency marking."
              };

              const productTime = Date.now() - productStartTime;
              console.log(`[BATCH-TIMING] Completed automated processing for ${product.articleNumber || 'unnamed product'} in ${productTime}ms`);
              batchTimingLog.productTimes.push({ 
                product: `${product.articleNumber || 'N/A'} - ${product.productName}`, 
                time: productTime 
              });
              return productResult;
            }
            
            // URL mode was already handled above with early return
            console.error(`Unexpected execution path for ${product.searchMethod} mode`);
            return null;

          } catch (error) {
            console.error(`Error processing product ${product.articleNumber || 'unnamed product'}:`, error);
            
            // Create error response for this product - handle optional articleNumber
            const errorProductId = product.articleNumber || `error_product_${Date.now()}`;
            return {
              id: Date.now() + Math.random(),
              searchMethod: product.searchMethod,
              products: [{
                id: errorProductId,
                articleNumber: product.articleNumber || "",
                productName: product.productName,
                properties: {
                  "Artikelnummer": {
                    name: "Artikelnummer",
                    value: product.articleNumber || "",
                    confidence: 100,
                    isConsistent: true
                  }
                }
              }],
              searchStatus: "complete" as const,
              statusMessage: "Processing failed for this product."
            };
          }
        });

        // Wait for current batch to complete
        const currentBatchResults = await Promise.all(batchPromises);
        
        // Add all results from this batch
        currentBatchResults.forEach(result => {
          if (result) {
            batchResults.push(result);
          }
        });
      }

      // Calculate and log batch timing summary
      batchTimingLog.totalTime = Date.now() - batchProcessStartTime;
      console.log(`\n[BATCH-TIMING SUMMARY] Complete File Upload Batch Processing:`);
      console.log(`  ├─ Total Products: ${batchData.products.length}`);
      console.log(`  ├─ Total Time: ${batchTimingLog.totalTime}ms (${(batchTimingLog.totalTime / 1000).toFixed(1)}s)`);
      console.log(`  ├─ Average Time per Product: ${Math.round(batchTimingLog.totalTime / batchData.products.length)}ms`);
      console.log(`  └─ Processing completed at ${new Date().toISOString()}`);
      
      if (batchTimingLog.productTimes.length > 0) {
        console.log(`\n[BATCH-TIMING] Individual Product Times:`);
        batchTimingLog.productTimes.forEach((pt, index) => {
          console.log(`  ${index + 1}. ${pt.product}: ${pt.time}ms`);
        });
      }

      // Log batch search activity to monitoring system
      try {
        const successCount = batchResults.filter(r => r?.searchStatus === 'complete').length;
        const failedCount = batchResults.length - successCount;
        
        // Build products array matching BatchSearchActivityData interface
        const productsForLogging = batchData.products.map((product, index) => {
          const result = batchResults[index];
          const extractedProps = result?.products?.[0]?.properties || {};
          const timingEntry = batchTimingLog.productTimes.find(pt =>
            pt.product.includes(product.productName) || pt.product.includes(product.articleNumber || '')
          );
          
          return {
            articleNumber: product.articleNumber,
            productName: product.productName,
            status: (result?.searchStatus === 'complete' ? 'completed' : 'failed') as 'pending' | 'processing' | 'completed' | 'failed',
            sourceUrls: undefined, // Not tracked at this level
            extractedPropertiesCount: Object.keys(extractedProps).filter(k => !k.startsWith('__meta')).length,
            processingTime: timingEntry?.time,
            errorMessage: result?.searchStatus !== 'complete' ? result?.statusMessage : undefined,
          };
        });
        
        // Log batch summary
        await MonitoringLogger.logBatchSearchActivity({
          userId: req.user!.id,
          username: req.user!.username,
          searchTab: 'automatisch',
          searchMode: 'datei',
          totalProducts: batchData.products.length,
          products: productsForLogging,
          startTime: batchProcessStartTime,
          endTime: Date.now(),
          successCount,
          failedCount,
          tableId: tableIdForProperties,
          tableName: undefined // Could be fetched if needed
        });

        // Log individual product results for detailed tracking
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const product = batchData.products[i];
          if (result?.products?.[0]) {
            const extractedProps = result.products[0].properties || {};
            const extractedPropertyDetails = Object.entries(extractedProps)
              .filter(([key]) => !key.startsWith('__meta'))
              .map(([name, prop]: [string, any]) => ({
                name: name,
                value: String(prop.value || '').substring(0, 200),
                confidence: prop.confidence || 0,
                isConsistent: prop.isConsistent,
                sources: prop.sources?.slice(0, 3)?.map((s: any) => ({ url: s.url || '', title: s.title || '' })),
              }));

            const timingEntry = batchTimingLog.productTimes.find(pt =>
              pt.product.includes(product.productName) || pt.product.includes(product.articleNumber || '')
            );

            await MonitoringLogger.logProductExtractionResult({
              userId: req.user!.id,
              username: req.user!.username,
              articleNumber: product.articleNumber,
              productName: product.productName,
              searchTab: 'automatisch',
              searchMode: 'datei',
              sourceUrl: product.productUrl,
              extractedProperties: extractedPropertyDetails,
              rawContentPreview: undefined, // Could add if needed
              processingTimeMs: timingEntry?.time || 0,
              success: result.searchStatus === 'complete',
              errorMessage: result.searchStatus !== 'complete' ? result.statusMessage : undefined,
            });
          }
        }
        
        console.log(`[MONITORING] Logged batch search activity for user ${req.user!.id}`);
      } catch (logError) {
        console.error('[MONITORING] Failed to log batch search activity:', logError);
        // Don't fail the request if logging fails
      }

      res.json({
        success: true,
        results: batchResults,
        totalProcessed: batchData.products.length
      });

    } catch (error) {
      console.error("Batch processing error:", error);
      res.status(500).json({
        success: false,
        message: "Batch processing failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API route for full content analysis (AI processing)
  app.post("/api/analyze-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchData = searchRequestSchema.parse(req.body);
      
      // Extract userId from authenticated request (if available)
      const userId = req.user?.id || null;
      console.log(`[ANALYZE-CONTENT] Processing request for user ${userId || 'anonymous'} (username: ${req.user?.username || 'N/A'})`);
      if (!userId) {
        console.warn('[ANALYZE-CONTENT] WARNING: No authenticated user found - token usage will be tracked as anonymous');
      }

      // Configure for step 2 - AI processing
      const totalProcessStartTime = Date.now();
      console.log("Step 2/2: Starting AI content analysis...");
      console.log(`[TIMING] Process started at ${new Date().toISOString()}`);
      
      // Track timing for each phase
      const timingLog = {
        start: totalProcessStartTime,
        setupTime: 0,
        contentCollectionTime: 0,
        aiProcessingTime: 0,
        totalTime: 0
      };
      
      // Import optimized service for faster processing
      const { optimizedOpenaiService } = await import('./services/optimizedOpenaiService');

      // Check if ValueSERP should be used
      if (searchData.useValueSerp) {
        console.log("Using ValueSERP for search in content analysis");

        // Get API key from environment variables or user-provided key
        const serverApiKey = searchData.valueSerpApiKey || process.env.VALUESERP_API_KEY;

        if (!serverApiKey) {
          return res.status(400).json({
            message: "ValueSERP API key is required",
            details: "Please provide a ValueSERP API key or disable ValueSERP search"
          });
        }

        // Construct a more precise search query with exact matching - handle cases where articleNumber might be empty
        const query = buildQuotedSearchQuery(searchData.articleNumber, searchData.productName, "specifications technical data");

        try {
          console.log(`[PERFORMANCE] Using ValueSERP API for: "${query}"`);
          const valueSerpStartTime = Date.now();

          // Step 1: Fetch search results from ValueSERP
          const searchUrl = new URL('https://api.valueserp.com/search');
          searchUrl.searchParams.append('api_key', serverApiKey);
          searchUrl.searchParams.append('q', query);
          searchUrl.searchParams.append('page', '1');
          searchUrl.searchParams.append('num', (searchData.maxResults || 10).toString());
          searchUrl.searchParams.append('output', 'json');
          searchUrl.searchParams.append('device', 'desktop');
          // Get location setting - default to German
          const appSettings = await storage.getAppSettings();
          const location = searchData.valueSerpLocation || appSettings?.valueSerpLocation || 'de';
          const locationParams = getValueSerpLocationParams(location);
          searchUrl.searchParams.append('gl', locationParams.gl || 'de');
          searchUrl.searchParams.append('hl', locationParams.hl || 'de');
          searchUrl.searchParams.append('google_domain', 'google.de');

          const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`ValueSERP API error: ${response.status} ${response.statusText}`, errorText);

            // IMPORTANT: Do not forward upstream 401/403 as our own 401/403.
            // Our endpoints are protected by requireAuth; returning 401 here is misleading
            // and gets interpreted as "session expired" in the UI.
            if (response.status === 401 || response.status === 403) {
              return res.status(400).json({
                message: "Invalid ValueSERP API key",
                details: errorText
              });
            }

            // For other upstream failures, treat as a bad gateway.
            return res.status(502).json({
              message: `ValueSERP API error: ${response.status} ${response.statusText}`,
              details: errorText
            });
          }

          const responseData = await response.json();

          if (!responseData.organic_results) {
            console.log('Invalid response structure from ValueSERP');
            return res.status(500).json({
              message: 'Invalid response structure from ValueSERP API',
              details: 'The response does not contain expected search results data'
            });
          }

          const valueSerpTime = Date.now() - valueSerpStartTime;
          console.log(`[PERFORMANCE] ValueSERP search completed in ${valueSerpTime}ms - Found ${responseData.organic_results.length} results`);

          // Step 2: Extract the URLs from the results for content processing
          const organicResults = responseData.organic_results || [];
          const maxSourcesToProcess = searchData.maxResults || 10;

          // Convert to source format with cleaned titles
          const sources = organicResults.slice(0, maxSourcesToProcess).map((result: any) => ({
            url: result.link,
            title: result.title || result.link,
          }));

          // Step 3: Fetch HTML content from ALL URLs in TRUE parallel (no batching)
          console.log(`[PERFORMANCE] Fetching content from ${sources.length} URLs in FULLY PARALLEL mode`);
          const contentFetchStartTime = Date.now();

          // Reusable content fetcher function
          const fetchSourceContent = async (source: { url: string; title: string }, index: number) => {
            try {
              console.log(`[PARALLEL-${index + 1}] Starting fetch for: ${source.url}`);
              let htmlContent = '';
              let scrapingMethod = 'unknown';
              
              try {
                // Layer 1: Fast scraper
                const { fastScraper } = await import('./services/fastScraper');
                const fastResult = await fastScraper.scrapeUrl(source.url, searchData.articleNumber);
                
                if (fastResult.success && fastResult.contentLength > 1000) {
                  htmlContent = fastResult.content;
                  scrapingMethod = 'fast-http';
                  console.log(`[PARALLEL-${index + 1}] ✓ Fast scraping: ${fastResult.contentLength} chars`);
                  
                  // Log scraped data to monitoring system
                  if (userId) {
                    try {
                      await MonitoringLogger.logScrapedData({
                        userId: userId,
                        username: req.user?.username || 'unknown',
                        articleNumber: searchData.articleNumber,
                        productName: searchData.productName,
                        url: source.url,
                        scrapingMethod: 'fast-http',
                        rawContent: fastResult.content,
                        contentLength: fastResult.contentLength,
                        contentType: 'html',
                        title: fastResult.title || source.title,
                        statusCode: 200,
                        responseTime: fastResult.loadTime || 0,
                        success: true
                      });
                    } catch (logError) {
                      console.error('[MONITORING] Failed to log scraped data:', logError);
                    }
                  }
                  
                  return { content: htmlContent, url: source.url, title: source.title };
                }
                throw new Error('Minimal content');
              } catch (fastError) {
                try {
                  // Layer 2: Enhanced HTTP
                  const htmlResponse = await axios.get(source.url, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                    timeout: 7000,
                    maxRedirects: 5
                  });

                  const html = htmlResponse.data;
                  
                  // Quick JS detection
                  const isJsHeavy = html.includes('data-reactroot') || html.includes('React') ||
                                   html.includes('Vue') || html.includes('Angular') ||
                                   (html.indexOf('</body>') - html.indexOf('<body>') < 200);
                  
                  if (isJsHeavy) throw new Error('JS-heavy content');
                  
                  htmlContent = html;
                  scrapingMethod = 'enhanced-http';
                  console.log(`[PARALLEL-${index + 1}] ✓ HTTP: ${html.length} chars`);
                  
                  // Log scraped data to monitoring system
                  if (userId) {
                    try {
                      await MonitoringLogger.logScrapedData({
                        userId: userId,
                        username: req.user?.username || 'unknown',
                        articleNumber: searchData.articleNumber,
                        productName: searchData.productName,
                        url: source.url,
                        scrapingMethod: 'enhanced-http',
                        rawContent: html,
                        contentLength: html.length,
                        contentType: 'html',
                        title: source.title,
                        statusCode: htmlResponse.status,
                        responseTime: 0,
                        success: true
                      });
                    } catch (logError) {
                      console.error('[MONITORING] Failed to log scraped data:', logError);
                    }
                  }
                  
                  return { content: htmlContent, url: source.url, title: source.title };
                  
                } catch (httpError) {
                  try {
                    // Layer 3: Browser scraping
                    const { browserScraper } = await import('./services/browserScraper');
                    const browserResult = await browserScraper.scrapeUrl(source.url);
                    console.log(`[PARALLEL-${index + 1}] ✓ Browser: ${browserResult.contentLength} chars`);
                    
                    // Log scraped data to monitoring system
                    if (userId) {
                      try {
                        await MonitoringLogger.logScrapedData({
                          userId: userId,
                          username: req.user?.username || 'unknown',
                          articleNumber: searchData.articleNumber,
                          productName: searchData.productName,
                          url: source.url,
                          scrapingMethod: 'browser-rendered',
                          rawContent: browserResult.content,
                          contentLength: browserResult.contentLength,
                          contentType: 'html',
                          title: browserResult.title || source.title,
                          statusCode: 200,
                          responseTime: browserResult.loadTime || 0,
                          success: browserResult.success
                        });
                      } catch (logError) {
                        console.error('[MONITORING] Failed to log scraped data:', logError);
                      }
                    }
                    
                    return { content: browserResult.content, url: source.url, title: source.title };
                  } catch (browserError) {
                    console.error(`[PARALLEL-${index + 1}] ✗ All methods failed`);
                    return null;
                  }
                }
              }
            } catch (error) {
              console.error(`[PARALLEL-${index + 1}] Error: ${error}`);
              return null;
            }
          };
          
          // CRITICAL: Process ALL sources in TRUE parallel (no batching, no delays)
          const allResults = await Promise.allSettled(
            sources.map((source: any, index: number) => fetchSourceContent(source, index))
          );
          
          // Collect successful results
          const rawContentSources: Array<{content: string, url: string, title: string}> = [];
          let successCount = 0;
          let failureCount = 0;
          
          allResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value !== null) {
              rawContentSources.push(result.value);
              successCount++;
            } else {
              failureCount++;
            }
          });
          
          const contentFetchTime = Date.now() - contentFetchStartTime;
          console.log(`[PERFORMANCE] Content fetching in ${contentFetchTime}ms - Success: ${successCount}/${sources.length}`);
          timingLog.contentCollectionTime = contentFetchTime;

          // Step 4: Process with OPTIMIZED AI if we have content
          if (rawContentSources.length === 0) {
            console.log("No content could be fetched from search results");
            return res.status(500).json({
              message: "No content found for analysis",
              details: "Could not fetch content from any of the search results"
            });
          }

          // Setup OPTIMIZED AI configuration
          if (searchData.openaiApiKey) {
            console.log("[PERFORMANCE] Using OpenAI with provided API key");
            optimizedOpenaiService.setApiKey(searchData.openaiApiKey);
          } else if (process.env.OPENAI_API_KEY) {
            console.log("[PERFORMANCE] Using OpenAI with environment API key");
            optimizedOpenaiService.setApiKey(process.env.OPENAI_API_KEY);
          }

          // Generate a unique ID for the product when articleNumber is not provided
          const productId = searchData.articleNumber || `product_${Date.now()}`;

          // CRITICAL OPTIMIZATION: Use optimized AI service with single batched call
          console.log(`[PERFORMANCE] Starting OPTIMIZED AI extraction for ${searchData.articleNumber || 'unnamed product'}`);
          console.log(`[PERFORMANCE] Processing ${rawContentSources.length} sources in SINGLE batched API call`);
          
          const aiStartTime = Date.now();
          
          // Quick validation first (no AI needed, pattern-based)
          const validatedSources = optimizedOpenaiService.validateSourcesQuick(
            rawContentSources,
            searchData.articleNumber || "",
            searchData.productName
          );
          
          console.log(`[PERFORMANCE] Quick validation: ${validatedSources.length} sources validated (no AI cost)`);
          
          // Get user's selected AI model for ValueSERP extraction
          const valueSerpUserForModel = userId ? await storage.getUser(userId) : null;
          const valueSerpUserSelectedModel = valueSerpUserForModel?.selectedAiModel || "gpt-4.1-mini";
          console.log(`[VALUESERP-ANALYZE] Using AI model: ${valueSerpUserSelectedModel}`);
          
          // Process all sources in ONE optimized AI call (major performance improvement)
          const extractedProperties = await optimizedOpenaiService.extractFromBatchedSources(
            validatedSources,
            searchData.articleNumber || "",
            searchData.productName,
            searchData.properties,
            userId,
            valueSerpUserSelectedModel
          );
          
          timingLog.aiProcessingTime = Date.now() - aiStartTime;
          console.log(`[PERFORMANCE] ✓ OPTIMIZED AI extraction completed in ${timingLog.aiProcessingTime}ms`);
          console.log(`[PERFORMANCE] Reduced from ~98s to ${(timingLog.aiProcessingTime / 1000).toFixed(1)}s (${Math.round(98000 / timingLog.aiProcessingTime)}x faster)`);

          // Preserve original ValueSERP sources in the extracted properties
          const propertiesWithSources = {
            ...extractedProperties,
            "__meta_sources": {
              name: "__meta_sources",
              value: "Found Web Pages",
              sources: sources.map((s: any) => ({
                url: s.url,
                title: s.title,
                sourceLabel: "valueserp"
              })),
              confidence: 100,
              isConsistent: true
            }
          };

          // Prepare rawContent for UI display
          const rawContentForDisplay: RawContentEntry[] = rawContentSources.map((source, index) => ({
            sourceLabel: `Source ${index + 1}`,
            title: source.title || sources[index]?.title || `Web Source ${index + 1}`,
            url: source.url || sources[index]?.url || '',
            content: source.content,
            contentLength: source.content.length
          }));

          // Calculate total time and log performance summary
          timingLog.totalTime = Date.now() - totalProcessStartTime;
          console.log(`\n[PERFORMANCE SUMMARY] Complete ValueSERP + AI Pipeline:`);
          console.log(`  ├─ ValueSERP Search: ${valueSerpTime}ms`);
          console.log(`  ├─ Content Fetching (parallel): ${contentFetchTime}ms`);
          console.log(`  ├─ AI Processing (optimized): ${timingLog.aiProcessingTime}ms`);
          console.log(`  └─ Total Time: ${timingLog.totalTime}ms (${(timingLog.totalTime / 1000).toFixed(1)}s)`);
          console.log(`[PERFORMANCE] Overall speedup: Previous ~120s → Now ${(timingLog.totalTime / 1000).toFixed(1)}s`);

          // Return the result with extracted specifications
          const finalResponse = {
            id: Date.now(),
            searchMethod: searchData.searchMethod,
            searchStatus: "complete" as "complete",
            statusMessage: `Analysis complete in ${(timingLog.totalTime / 1000).toFixed(1)}s. Found technical specifications.`,
            rawContent: rawContentForDisplay,
            products: [{
              id: productId,
              articleNumber: searchData.articleNumber || "",
              productName: searchData.productName,
              properties: propertiesWithSources,
              rawContent: rawContentForDisplay
            }]
          };

          res.json(finalResponse);
          return;
        } catch (error) {
          console.error('Error processing with ValueSERP:', error);
          return res.status(500).json({
            message: 'Error processing with ValueSERP',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Setup AI integration
      if (searchData.useAI) {
        if (searchData.openaiApiKey) {
          console.log("Using OpenAI for AI-enhanced extraction with provided API key");
          openaiService.setApiKey(searchData.openaiApiKey);
        } else {
          console.log("Using OpenAI with environment API key");
          openaiService.setModelProvider('openai');
        }
      }

      // Array to collect the HTML content with source information from search results
      const scrapedContentArray: Array<{content: string, url: string, title: string}> = [];

      console.log(`Analyzing content for article ${searchData.articleNumber}`);

      // Check if we have existing sources from the initial search
      if (searchData.sources && searchData.sources.length > 0) {
        console.log(`Using ${searchData.sources.length} existing search results for content analysis`);
        
        // Fetch HTML content from the existing search results in parallel
        const maxSourcesToProcess = Math.min(searchData.sources.length, searchData.maxResults || 10);
        const sourcesToProcess = searchData.sources.slice(0, maxSourcesToProcess);
        
        // Process existing sources in parallel
        const CONCURRENT_REQUESTS = 5;
        const startTime = Date.now();
        
        const fetchExistingSource = async (source: any) => {
          try {
            console.log(`Fetching content from existing source: ${source.url}`);
            
            const response = await fetch(source.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              }
            });
            
            if (response.ok) {
              const htmlContent = await response.text();
              console.log(`Successfully fetched content from ${source.url}, size: ${htmlContent.length} characters`);
              return {
                content: htmlContent,
                url: source.url,
                title: source.title || source.url
              };
            } else {
              console.log(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
              return null;
            }
          } catch (error) {
            console.error(`Error fetching content from ${source.url}:`, error);
            return null;
          }
        };
        
        // Process in batches
        for (let i = 0; i < sourcesToProcess.length; i += CONCURRENT_REQUESTS) {
          const batch = sourcesToProcess.slice(i, i + CONCURRENT_REQUESTS);
          const batchPromises = batch.map(source => fetchExistingSource(source));
          const batchResults = await Promise.allSettled(batchPromises);
          
          const validResults = batchResults
            .filter((result): result is PromiseFulfilledResult<any> => 
              result.status === 'fulfilled' && result.value !== null
            )
            .map(result => result.value);
          
          scrapedContentArray.push(...validResults);
          console.log(`Processed batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}/${Math.ceil(sourcesToProcess.length / CONCURRENT_REQUESTS)}, collected ${validResults.length} sources`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`Parallel fetching of existing sources completed in ${totalTime}ms`);
      } else {
        console.log("No existing sources provided, performing new search");
        
        // First, collect all the raw HTML content from the search results without any preprocessing
        const contentCollectionStartTime = Date.now();
        console.log(`[TIMING] Starting content collection at ${new Date().toISOString()}`);
        
        // Create user context for error logging
        const userContext = userId ? { userId, username: req.user?.username || 'unknown' } : undefined;
        
        const searchResult = await searchService.collectRawContentFromSearchResults(
          searchData.articleNumber,
          searchData.productName,
          searchData.searchEngine || 'google',
          scrapedContentArray,
          searchData.maxResults || 10,
          searchData.pdfScraperEnabled || false,
          userContext
        );
        
        timingLog.contentCollectionTime = Date.now() - contentCollectionStartTime;
        console.log(`[TIMING] Content collection completed in ${timingLog.contentCollectionTime}ms`);
      }

      console.log(`\n🔍 CONTENT COLLECTION COMPLETE:`);
      console.log(`  Total sources collected: ${scrapedContentArray.length}`);
      if (scrapedContentArray.length > 0) {
        console.log(`  Sources collected from:`);
        scrapedContentArray.forEach((source, index) => {
          console.log(`    ${index + 1}. ${source.url} (${source.content.length} chars)`);
          console.log(`       Title: ${source.title}`);
        });
      } else {
        console.log(`  ⚠️ NO CONTENT COLLECTED - AI will have no data to analyze!`);
      }

      // Fetch the imported properties to use as must-have requirements for Product URL mode
      // PER-USER: Use the user's default table or specified tableId
      let tableIdForAnalysis = req.body.tableId ? parseInt(req.body.tableId) : undefined;
      if (!tableIdForAnalysis && userId) {
        const defaultTable = await storage.getDefaultPropertyTableByUserId(userId);
        tableIdForAnalysis = defaultTable?.id;
        console.log(`[ANALYZE-CONTENT] Using user's default table: ${defaultTable?.name || 'none'} (ID: ${tableIdForAnalysis || 'N/A'})`);
      }
      
      // Fetch properties for this user's table
      const requiredProperties = userId
        ? await storage.getPropertiesByUserId(userId, tableIdForAnalysis)
        : await storage.getProperties();
      console.log(`[ANALYZE-CONTENT] Using ${requiredProperties.length} properties for user ${userId || 'anonymous'}, table ${tableIdForAnalysis || 'default'}`);

      // Convert properties to the expected format for AI service
      const aiProperties = requiredProperties.map(prop => ({
        name: prop.name,
        description: prop.description || undefined,
        expectedFormat: prop.expectedFormat || undefined,
        orderIndex: prop.orderIndex || undefined
      }));

      // OPTIMIZED: Use original service with TRUE PARALLELIZATION (all sources at once)
      const aiProcessingStartTime = Date.now();
      console.log(`[PERFORMANCE] Starting PARALLEL AI processing`);
      console.log(`[PERFORMANCE] Processing ALL ${scrapedContentArray.length} sources in parallel (concurrency: 10)...`);
      
      // Get user's selected AI model for analyze-content endpoint
      const analyzeUserForModel = userId ? await storage.getUser(userId) : null;
      const analyzeUserSelectedModel = analyzeUserForModel?.selectedAiModel || "gpt-4.1-mini";
      console.log(`[ANALYZE-CONTENT] Using AI model: ${analyzeUserSelectedModel}`);
      
      const extractedProperties = await openaiService.extractTechnicalSpecificationsWithConsistency(
        scrapedContentArray,
        searchData.articleNumber || "",
        searchData.productName,
        aiProperties,
        userId,
        analyzeUserSelectedModel // Pass user's selected model
      );
      
      timingLog.aiProcessingTime = Date.now() - aiProcessingStartTime;
      console.log(`[PERFORMANCE] ✓ PARALLEL AI completed in ${timingLog.aiProcessingTime}ms`);
      console.log(`[PERFORMANCE] Speedup: Was ~40s with 3 concurrent, now with 10 concurrent`);

      console.log(`AI extracted ${Object.keys(extractedProperties).length} technical properties`);
      
      // DEBUG: Log sample of extracted properties
      console.log(`\n🔍 DEBUG: Sample of extracted properties:`);
      const sampleProps = Object.entries(extractedProperties).slice(0, 5);
      sampleProps.forEach(([key, prop]) => {
        console.log(`  ${key}: "${prop.value}" (${prop.sources?.length || 0} sources, ${prop.confidence}% confidence)`);
      });
      
      // Check for empty values
      const emptyProps = Object.entries(extractedProperties).filter(([_, prop]) => !prop.value || prop.value === "");
      console.log(`\n⚠️ Properties with empty values: ${emptyProps.length} out of ${Object.keys(extractedProperties).length}`);
      
      // Create properties object with Artikelnummer and __meta_sources
      const propertiesWithSources = {
        // Always include Artikelnummer as a property if it exists
        ...(searchData.articleNumber ? {
          "Artikelnummer": {
            name: "Artikelnummer",
            value: searchData.articleNumber,
            confidence: 100,
            isConsistent: true,
            sources: []
          }
        } : {}),
        // Add all extracted properties
        ...extractedProperties,
        // Include meta sources from content collection
        ...(scrapedContentArray.length > 0 && scrapedContentArray[0].url ? {
          "__meta_sources": {
            name: "__meta_sources",
            value: "Found Web Pages",
            sources: scrapedContentArray.map(item => ({
              url: item.url,
              title: item.title,
              sourceLabel: "web"
            })),
            confidence: 100,
            isConsistent: true
          }
        } : {})
      };
      
      // DEBUG: Log final properties count
      console.log(`\n📊 Final properties object has ${Object.keys(propertiesWithSources).length} properties`);

      // Prepare rawContent for UI display from scrapedContentArray
      const rawContentForDisplay: RawContentEntry[] = scrapedContentArray.map((item, index) => ({
        sourceLabel: `Source ${index + 1}`,
        title: item.title || `Web Source ${index + 1}`,
        url: item.url || '',
        content: item.content,
        contentLength: item.content.length
      }));

      // Create the response object with original Artikelnummer and Produktname
      const searchResponse: SearchResponse = {
        searchMethod: searchData.searchMethod,
        rawContent: rawContentForDisplay,
        products: [{
          id: uuidv4(),
          // Always preserve the exact original values
          articleNumber: searchData.articleNumber,
          productName: searchData.productName,
          properties: propertiesWithSources,
          rawContent: rawContentForDisplay
        }],
        searchStatus: "complete",
        statusMessage: "Analysis complete. Technical data extracted from all web sources."
      };

      // Store the result in the database with full properties data and status
      const savedResult = await storage.createSearchResult({
        articleNumber: searchData.articleNumber || "",
        productName: searchData.productName,
        searchMethod: searchData.searchMethod,
        properties: searchResponse.products[0].properties
      });

      // Add the database ID to the response so we can reference it later
      searchResponse.id = savedResult.id;

      // Calculate total time and log timing summary
      timingLog.totalTime = Date.now() - totalProcessStartTime;
      console.log(`\n[TIMING SUMMARY] Complete Process Breakdown:`);
      console.log(`  ├─ Content Collection: ${timingLog.contentCollectionTime}ms (${Math.round(timingLog.contentCollectionTime / timingLog.totalTime * 100)}%)`);
      console.log(`  ├─ AI Processing: ${timingLog.aiProcessingTime}ms (${Math.round(timingLog.aiProcessingTime / timingLog.totalTime * 100)}%)`);
      console.log(`  └─ Total Time: ${timingLog.totalTime}ms`);
      console.log(`[TIMING] Process completed at ${new Date().toISOString()}`);

      // Log search activity to monitoring system
      try {
        // Extract property details for logging (include all properties for monitoring)
        const extractedProps = propertiesWithSources || {};
        const extractedPropertyDetails = Object.entries(extractedProps)
          .filter(([key]) => !key.startsWith('__meta'))
          .map(([name, prop]: [string, any]) => ({
            propertyName: name,
            value: String(prop.value || '').substring(0, 200),
            confidence: prop.confidence || 0,
            source: prop.sources?.[0]?.url || 'web-extraction'
          }));

        // Collect source URLs for logging
        const sourceUrls = scrapedContentArray.map(item => item.url).filter(Boolean);

        await MonitoringLogger.logSearchActivity({
          userId: userId!,
          username: req.user!.username,
          searchTab: 'automatisch',
          searchMode: 'manual',
          articleNumber: searchData.articleNumber,
          productName: searchData.productName,
          sourceUrls: sourceUrls.slice(0, 20), // Limit URLs
          scrapedDataSummary: {
            totalSources: scrapedContentArray.length,
            successfulSources: scrapedContentArray.filter(s => s.content && s.content.length > 100).length,
            failedSources: scrapedContentArray.filter(s => !s.content || s.content.length <= 100).length,
            totalContentLength: scrapedContentArray.reduce((sum, s) => sum + (s.content?.length || 0), 0)
          },
          extractedProperties: extractedPropertyDetails,
          processingTime: timingLog.totalTime,
          success: true,
          tableId: tableIdForAnalysis,
          tableName: undefined // Could be fetched if needed
        });
        
        console.log(`[MONITORING] Logged search activity for user ${userId}`);
      } catch (logError) {
        console.error('[MONITORING] Failed to log search activity:', logError);
        // Don't fail the request if logging fails
      }

      res.json(searchResponse);
    } catch (error) {
      console.error("Error in content analysis:", error);
      res.status(500).json({
        message: "Content analysis failed",
        error: (error as Error).message
      });
    }
  });

  // Legacy API route for performing searches (for backward compatibility)
  app.post("/api/search", async (req: Request, res: Response) => {
    try {
      const searchData = searchRequestSchema.parse(req.body);

      // Check if ValueSERP should be used
      if (searchData.useValueSerp) {
        console.log("Using ValueSERP for search");

        // Get API key from environment variables or user-provided key
        const serverApiKey = searchData.valueSerpApiKey || process.env.VALUESERP_API_KEY;

        if (!serverApiKey) {
          return res.status(400).json({
            message: "ValueSERP API key is required",
            details: "Please provide a ValueSERP API key or disable ValueSERP search"
          });
        }

        // Construct the search query
        const query = buildSearchQuery(searchData.articleNumber, searchData.productName);
        const page = 1; // Default to first page

        try {
          // Build the ValueSERP API URL
          const searchUrl = new URL('https://api.valueserp.com/search');

          // Add required parameters
          searchUrl.searchParams.append('api_key', serverApiKey);
          searchUrl.searchParams.append('q', query);
          searchUrl.searchParams.append('page', page.toString());
          searchUrl.searchParams.append('num', (searchData.maxResults || 10).toString());
          searchUrl.searchParams.append('output', 'json');
          searchUrl.searchParams.append('device', 'desktop');
          searchUrl.searchParams.append('gl', 'de'); // Geolocation - Germany
          searchUrl.searchParams.append('hl', 'de'); // Language - German
          searchUrl.searchParams.append('google_domain', 'google.de'); // Use German Google domain

          console.log(`Fetching ValueSERP search results for: "${query}"`);

          const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          // Check response status
          console.log(`ValueSERP API response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`ValueSERP API error: ${response.status} ${response.statusText}`, errorText);
            return res.status(response.status).json({
              message: `ValueSERP API error: ${response.status} ${response.statusText}`,
              details: errorText
            });
          }

          // Parse JSON response
          const responseData = await response.json();

          // Check if response has expected structure
          if (!responseData.organic_results) {
            console.log('Response structure:', JSON.stringify(responseData).substring(0, 200) + '...');
            return res.status(500).json({
              message: 'Invalid response structure from ValueSERP API',
              details: 'The response does not contain expected search results data'
            });
          }

          // Format the search results for our application
          const formattedResponse = searchService.processValueSerpResults(
            responseData,
            searchData.articleNumber,
            searchData.productName,
            searchData.properties,
            searchData.maxResults || 10
          );

          res.json(formattedResponse);
          return;
        } catch (error) {
          console.error('Error using ValueSERP API:', error);
          return res.status(500).json({
            message: 'Error using ValueSERP API',
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Setup AI integration if requested
      if (searchData.useAI) {
        if (searchData.openaiApiKey) {
          console.log("Using OpenAI for AI-enhanced extraction with provided API key");
          openaiService.setApiKey(searchData.openaiApiKey);
        } else {
          console.log("Using OpenAI with environment API key");
          openaiService.setModelProvider('openai');
        }
      }

      // Extract raw scraped content for AI processing (if needed)
      const scrapedContentArray: string[] = [];

      // Set up axios with proper headers for better web scraping
      const axiosInstance = axios.create({
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000, // 15 second timeout
      });

      let searchResult;

      switch (searchData.searchMethod) {
        case "auto":
          if (!searchData.searchEngine) {
            return res.status(400).json({ message: "Search engine is required for automated search" });
          }

          searchResult = await searchService.performAutomatedSearch(
            searchData.articleNumber || "",
            searchData.productName,
            searchData.properties,
            searchData.searchEngine,
            scrapedContentArray,
            searchData.maxResults || 10
          );
          break;

        case "url":
          if (!searchData.productUrl) {
            return res.status(400).json({ message: "Product URL is required for URL-based search" });
          }
          searchResult = await searchService.performUrlSearch(
            searchData.articleNumber || "",
            searchData.productName,
            searchData.properties,
            searchData.productUrl,
            scrapedContentArray
          );
          break;

        default:
          return res.status(400).json({ message: "Invalid search method" });
      }

      // Convert database schema to frontend schema with products array
      // For auto search, include the sources (URLs) used for the search
      // First collect all unique source URLs from properties
      const allSources = new Set<string>();
      Object.values(searchResult.properties).forEach(prop => {
        if (prop.sources && prop.sources.length > 0) {
          prop.sources.forEach((source: any) => {
            if (source.url) {
              allSources.add(source.url);
            }
          });
        }
      });

      // Add a meta property with all source URLs if this is an automated search
      if (searchData.searchMethod === "auto" && allSources.size > 0) {
        // Create a list of source objects with URLs
        const sourcesList = Array.from(allSources).map(url => ({
          url,
          title: new URL(url).hostname || "Source"
        }));

        // Add a meta property with all sources
        searchResult.properties["__meta_sources"] = {
          name: "__meta_sources",
          value: "Search Sources",
          confidence: 100,
          sources: sourcesList,
          isConsistent: true
        };
      }

      const frontendSearchResult: SearchResponse = {
        searchMethod: searchResult.searchMethod,
        products: [{
          id: uuidv4(), // Generate a unique ID for the product
          articleNumber: searchResult.articleNumber,
          productName: searchResult.productName,
          properties: searchResult.properties
        }]
      };

      // Füge minConsistentSources nur hinzu, wenn tatsächlich ein Wert vorhanden ist
      if (searchData.minConsistentSources !== undefined) {
        (frontendSearchResult as any).minConsistentSources = searchData.minConsistentSources;
      }

      // Process with AI if requested and we have scraped content
      let finalResult = frontendSearchResult;

      console.log(`Scraped content array has ${scrapedContentArray.length} items`);

      // Holen Sie die aktuellen Eigenschaften aus der Datenbank
      const dbProperties = await storage.getProperties();
      const propertyNames = dbProperties.map(prop => prop.name);

      console.log(`Using ${propertyNames.length} properties from database`);

      // Ensure all properties from the database are present in the product properties
      propertyNames.forEach(propName => {
        if (!finalResult.products[0].properties[propName]) {
          // Add empty properties for any missing properties
          finalResult.products[0].properties[propName] = {
            name: propName,
            value: "",
            confidence: 0,  // Diese werden in der UI nicht mehr angezeigt
            sources: []     // Diese werden in der UI nicht mehr angezeigt
          };
        }
      });

      // For URL-based searches, ensure we have content to process even if scrapedContentArray is empty
      if (searchData.useAI && openaiService.hasOpenAiKey()) {
        const provider = searchData.aiModelProvider || 'openai';

        // For automated search, add more sources if needed to reach user's desired count
        const targetSources = searchData.maxResults || 10;
        if (searchData.searchMethod === 'auto' && scrapedContentArray.length < targetSources) {
          console.log(`Enhancing auto search with additional sources. Current sources: ${scrapedContentArray.length}, target: ${targetSources}`);

          try {
            // Try multiple search queries to get diverse results
            const searchTerms = [
              buildSearchQuery(searchData.articleNumber, searchData.productName, "specifications"),
              buildSearchQuery(searchData.articleNumber, "", "technical data sheet"),
              `${searchData.productName} dimensions weight measurements`
            ];

            const apiKey = process.env.GOOGLE_API_KEY;
            const cx = process.env.GOOGLE_CX;

            if (apiKey && cx) {
              for (const searchTerm of searchTerms) {
                try {
                  console.log(`Searching with query: ${searchTerm}`);
                  const encodedQuery = encodeURIComponent(searchTerm);
                  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodedQuery}&num=${Math.min(targetSources, 10)}`;

                  const searchResponse = await axiosInstance.get(searchUrl);

                  if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                    console.log(`Found ${searchResponse.data.items.length} results for query: ${searchTerm}`);

                    // Try each result one by one
                    for (const item of searchResponse.data.items) {
                      try {
                        console.log(`Fetching content from: ${item.link}`);
                        const response = await axiosInstance.get(item.link);

                        const cheerio = require('cheerio');
                        const $ = cheerio.load(response.data);

                        // Extract critical product data
                        let pageContent = "";

                        // Look for specifications tables
                        const tables = $('table');
                        tables.each((i: number, table: any) => {
                          const tableText = $(table).text().trim();
                          if (tableText.length > 100) {
                            pageContent += `[TABLE ${i+1}] ${tableText}\n\n`;
                          }
                        });

                        // Extract technical specifications
                        const techSpecs = $(
                          '[id*="spec"], [class*="spec"], ' +
                          '[id*="technical"], [class*="technical"], ' +
                          '[id*="detail"], [class*="detail"], ' +
                          '[id*="product-info"], [class*="product-info"]'
                        ).text().trim();

                        if (techSpecs.length > 100) {
                          pageContent += `[TECHNICAL SPECS] ${techSpecs}\n\n`;
                        }

                        // Extract structured data if available
                        const structuredData = $('script[type="application/ld+json"]');
                        structuredData.each((i: number, script: any) => {
                          try {
                            const jsonData = JSON.parse($(script).html() || "{}");
                            pageContent += `[STRUCTURED DATA] ${JSON.stringify(jsonData, null, 2)}\n\n`;
                          } catch (e) {
                            // Ignore invalid JSON
                          }
                        });

                        if (pageContent.length > 0) {
                          scrapedContentArray.push(`Content from: ${item.link}\n--------------------------\n${pageContent}\n--------------------------\n`);
                          console.log(`Added ${pageContent.length} chars of content from ${item.link}`);
                        } else {
                          // If no structured content, include some of the page text
                          let mainText = "";
                          $('body').find('p, h1, h2, h3, li').each((i: number, elem: any) => {
                            const text = $(elem).text().trim();
                            if (text.length > 10) {
                              mainText += text + "\n";
                            }
                          });

                          if (mainText.length > 0) {
                            scrapedContentArray.push(`Text from: ${item.link}\n--------------------------\n${mainText.substring(0, 3000)}\n--------------------------\n`);
                            console.log(`Added ${Math.min(mainText.length, 3000)} chars of text from ${item.link}`);
                          }
                        }
                      } catch (err) {
                        console.error(`Error fetching or processing ${item.link}:`, err);
                      }
                    }
                  }
                } catch (err) {
                  console.error(`Error with search for "${searchTerm}":`, err);
                }
              }
            } else {
              console.error("Google API key or CX not configured for additional source search");
            }
          } catch (error) {
            console.error("Error enhancing auto search with additional sources:", error);
          }

          console.log(`After enhancement, scrapedContentArray has ${scrapedContentArray.length} items`);
        }

        if (scrapedContentArray.length === 0 && searchData.searchMethod === 'url' && searchData.productUrl) {
          // If no content was scraped but we have a URL, try to fetch the content directly
          console.log(`No scraped content available. Attempting to fetch content directly from ${searchData.productUrl}`);
          try {
            const axios = require('axios');
            const cheerio = require('cheerio');

            let response: any;
            let usedBrowserScraping = false;

            try {
              // First try traditional HTTP scraping
              response = await axios.get(searchData.productUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
                timeout: 10000,
              });

              // Check if page is heavily JavaScript-dependent
              const html = response.data;
              const hasReactApp = html.includes('data-reactroot') || html.includes('__REACT_DEVTOOLS') || html.includes('React');
              const hasVueApp = html.includes('data-v-') || html.includes('__vue__') || html.includes('Vue');
              const hasAngularApp = html.includes('ng-app') || html.includes('angular') || html.includes('Angular');
              const hasEmptyBody = html.includes('<body>') && html.indexOf('</body>') - html.indexOf('<body>') < 200;
              const hasMinimalContent = (html.match(/<p|<div|<span/g) || []).length < 5;
              const hasLotsOfScripts = (html.match(/<script/g) || []).length > 10;
              const hasComponentFramework = html.includes('data-cid') || html.includes('AppRegistry');
              
              const isJavaScriptHeavy = hasReactApp || hasVueApp || hasAngularApp || hasEmptyBody || (hasMinimalContent && hasLotsOfScripts) || hasComponentFramework;
              
              if (isJavaScriptHeavy) {
                console.log(`Detected JavaScript-heavy content on ${searchData.productUrl}. Switching to browser rendering...`);
                throw new Error('JavaScript-heavy content detected, using browser rendering');
              }

            } catch (httpError) {
              console.log(`Traditional HTTP scraping failed for ${searchData.productUrl}. Attempting browser rendering...`);
              
              try {
                // Use hybrid scraping for dynamic content
                const { hybridScraper } = await import('./services/hybridScraper');
                const hybridResult = await hybridScraper.scrapeUrl(searchData.productUrl, searchData.articleNumber);
                response = { data: hybridResult.content };
                usedBrowserScraping = true;
                
                console.log(`Hybrid scraping successful for ${searchData.productUrl}, method: ${hybridResult.method}, content length: ${hybridResult.contentLength} characters`);
                
              } catch (hybridError) {
                console.error(`Both HTTP and hybrid scraping failed for ${searchData.productUrl}:`, hybridError);
                throw httpError; // Fall back to original error
              }
            }

            // Load the HTML content
            const $ = cheerio.load(response.data);

            // Extract readable content
            // Enhanced extraction inspired by the provided code sample
            let pageContent = "";

            // 1. Extract critical sections like in the provided code sample
            const criticalSections = [];

            // 1a. Product info main
            const productInfoMain = $('div.product-info-main, div.product-main, div.product-details, div.main-product-info');
            if (productInfoMain.length > 0) {
              criticalSections.push(`[PRODUCT INFO] ${productInfoMain.text().trim()}`);
              console.log("Found product info main section");
            }

            // 1b. Product description sections
            const descriptionDivs = $('div.description, div.product-description, section.description, [class*="description"], [id*="description"]');
            if (descriptionDivs.length > 0) {
              criticalSections.push(`[DESCRIPTION] ${descriptionDivs.text().trim()}`);
              console.log("Found product description section");
            }

            // 1c. Technical specifications sections
            const techDivs = $('div.tech, div.specifications, div.specs, div.technical-data, [class*="spec"], [class*="technical"], [id*="spec"], [id*="technical"]');
            if (techDivs.length > 0) {
              criticalSections.push(`[TECHNICAL SPECS] ${techDivs.text().trim()}`);
              console.log("Found technical specifications section");
            }

            // 1d. Product attributes/details
            const attrDivs = $('div.attributes, div.details, div.product-attributes, div.additional, [class*="attribute"], [class*="detail"]');
            if (attrDivs.length > 0) {
              criticalSections.push(`[PRODUCT ATTRIBUTES] ${attrDivs.text().trim()}`);
              console.log("Found product attributes section");
            }

            // 1e. Tables that often contain specifications
            const tables = $('table');
            tables.each((i: number, table: any) => {
              criticalSections.push(`[TABLE ${i+1}] ${$(table).text().trim()}`);
            });
            if (tables.length > 0) {
              console.log(`Found ${tables.length} tables that might contain specifications`);
            }

            // 1f. Lists that often contain features or specifications
            const lists = $('ul, ol');
            lists.each((i: number, list: any) => {
              const listText = $(list).text().trim();
              // Only add lists with meaningful content
              if (listText.length > 50) {
                criticalSections.push(`[LIST ${i+1}] ${listText}`);
              }
            });
            if (lists.length > 0) {
              console.log(`Found ${lists.length} lists that might contain features`);
            }

            // 1g. Extract JSON-LD data that might contain structured product info
            const jsonLdScripts = $('script[type="application/ld+json"]');
            jsonLdScripts.each((i: number, script: any) => {
              try {
                const jsonData = JSON.parse($(script).html() || "{}");
                criticalSections.push(`[JSON-LD ${i+1}] ${JSON.stringify(jsonData, null, 2)}`);
              } catch (e) {
                // Ignore invalid JSON
              }
            });
            if (jsonLdScripts.length > 0) {
              console.log(`Found ${jsonLdScripts.length} JSON-LD scripts with product data`);
            }

            // 1h. Meta tags with product info
            const metaTags = $('meta[property^="product:"], meta[property^="og:"], meta[name^="product:"]');
            if (metaTags.length > 0) {
              const metaTagsInfo: string[] = [];
              metaTags.each((i: number, meta: any) => {
                const property = $(meta).attr('property') || $(meta).attr('name');
                const content = $(meta).attr('content');
                if (property && content) {
                  metaTagsInfo.push(`${property}: ${content}`);
                }
              });
              criticalSections.push(`[META TAGS]\n${metaTagsInfo.join('\n')}`);
              console.log(`Found ${metaTags.length} meta tags with product info`);
            }

            // Combine all critical sections
            pageContent = criticalSections.join('\n\n');

            // If we didn't find much in the critical sections, fall back to more general content
            if (pageContent.length < 1000) {
              console.log("Critical sections yielded little content, adding more general content");

              // 2. Look for specific property-related elements with common patterns
              const propertyPatterns = [
                "Höhe", "Breite", "Tiefe", "Gewicht", "Maße", "Dimensions", 
                "Weight", "Height", "Width", "Depth", "Material", "Leistung", 
                "Power", "Wattage", "Capacity", "Kapazität", "Volumen"
              ];

              // Regex patterns to find properties in text
              const propertyRegexes = [
                /(\w+):\s*([^,;.]+)/g,                  // Property: Value
                /(\w+)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)/g,  // Property 12.5 kg
                /(\w+)(?:\s+is|\s+are|\s+=)\s+([^,;.]+)/g    // Property is Value
              ];

              // Look for elements that might contain property values
              $('body').find('p, div, span, td, th, li').each((i: number, elem: any) => {
                const text = $(elem).text().trim();

                // Check if this element mentions any of our target properties
                const hasMeaningfulContent = propertyPatterns.some(pattern => 
                  text.toLowerCase().includes(pattern.toLowerCase()));

                // or matches property-value patterns
                const hasPropertyPattern = propertyRegexes.some(regex => regex.test(text));

                if ((hasMeaningfulContent || hasPropertyPattern) && text.length > 10) {
                  pageContent += `\n[POTENTIAL PROPERTY DATA] ${text}`;
                }
              });
            }

            // Add structured content to array
            if (pageContent.length > 0) {
              scrapedContentArray.push(`Content from: ${searchData.productUrl}\n--------------------------\n${pageContent}\n--------------------------\n`);
              console.log(`Added ${pageContent.length} chars of structured content from URL`);
            }

            // Use enhanced HTML parser for better content extraction in automated search
            try {
              const { htmlParserService } = await import('./services/htmlParserService');
              const parsedContent = htmlParserService.parseHtmlContent(response.data, searchData.productUrl);
              
              // Create comprehensive content for AI processing
              const comprehensiveContent = [
                `Content from: ${searchData.productUrl}`,
                `Title: ${parsedContent.title}`,
                `Description: ${parsedContent.description}`,
                `--------------------------`,
                `[PRODUCT-SPECS] ${parsedContent.extractedSections.productSpecs}`,
                `[TECHNICAL-DATA] ${parsedContent.extractedSections.technicalData}`,
                `[FEATURES] ${parsedContent.extractedSections.features}`,
                `[DIMENSIONS] ${parsedContent.extractedSections.dimensions}`,
                `[STRUCTURED-DATA] ${JSON.stringify(parsedContent.structuredData)}`,
                `[FULL-TEXT-CONTENT] ${parsedContent.textContent}`,
                `--------------------------`
              ].filter(Boolean).join('\n');
              
              scrapedContentArray.push(comprehensiveContent);
              console.log(`Enhanced HTML parsing successful for ${searchData.productUrl}, processed content length: ${comprehensiveContent.length} characters`);
            } catch (parseError) {
              console.log(`HTML parsing failed for ${searchData.productUrl}, using raw HTML`);
              // Fallback to raw HTML with maximum size limit for comprehensive analysis
              scrapedContentArray.push(`Raw HTML from: ${searchData.productUrl}\n--------------------------\n${response.data.substring(0, 2000000)}\n--------------------------\n`);
              console.log("Added raw HTML content for AI analysis (2MB limit)");
            }

            console.log(`Successfully fetched and added content from ${searchData.productUrl}`);
          } catch (error) {
            console.error(`Failed to fetch content from URL directly:`, error);
          }
        }

        if (scrapedContentArray.length > 0) {
          console.log(`Processing search results with OpenAI (${scrapedContentArray.length} content items)`);

          // Log a sample of the content being sent to the AI
          if (scrapedContentArray.length > 0) {
            const sampleContent = scrapedContentArray[0].substring(0, 500) + "...";
            console.log(`Sample content being sent to AI: ${sampleContent}`);
          }

          // Add URL property to product if it exists but isn't set
          if (searchData.productUrl && 
              (!frontendSearchResult.products[0].properties["URL"] || 
               frontendSearchResult.products[0].properties["URL"].value === "" ||
               frontendSearchResult.products[0].properties["URL"].value === "Not found")) {

            frontendSearchResult.products[0].properties["URL"] = {
              name: "URL",
              value: searchData.productUrl,
              confidence: 100,
              sources: [{ url: searchData.productUrl, title: "Direct URL" }]
            };
          }

          // Process content with AI using optimized extraction
          try {
            // Legacy search endpoint - no user context, use default model
            console.log(`[LEGACY-SEARCH] Using default AI model: gpt-4.1`);
            
            const aiExtractedProps = await openaiService.extractTechnicalSpecificationsWithConsistency(
              scrapedContentArray,
              searchData.articleNumber || "",
              searchData.productName,
              dbProperties.map(p => ({
                name: p.name,
                description: p.description || undefined,
                expectedFormat: p.expectedFormat || undefined,
                orderIndex: p.orderIndex || undefined
              })),
              undefined, // No userId for legacy endpoint
              "gpt-4.1" // Use default model for legacy endpoint
            );
            
            // Merge AI results into final result
            finalResult.products[0].properties = {
              ...finalResult.products[0].properties,
              ...aiExtractedProps
            };
          } catch (error) {
            console.error("Error processing with AI:", error);
          }
        } else {
          console.log(`No content to process with AI. Skipping AI enhancement.`);
        }
      }

      // Save search result to storage
      const savedResult = await storage.createSearchResult({
        articleNumber: searchData.articleNumber || "",
        productName: searchData.productName,
        searchMethod: searchData.searchMethod,
        properties: finalResult.products[0].properties
      });

      // Add database ID to response
      finalResult.id = savedResult.id;

      // Return the frontend-formatted result
      res.json(finalResult);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid search data", errors: error.errors });
      } else {
        console.error("Error performing search:", error);
        res.status(500).json({ message: "Failed to perform search", error: (error as Error).message });
      }
    }
  });

  // API route for file upload processing
  app.post("/api/process-file", async (req: Request, res: Response) => {
    try {
      // Process the uploaded file data
      const { data, minConsistentSources = 2, maxResults = 10 } = req.body;

      console.log(`File processing with configuration: minConsistentSources=${minConsistentSources}, maxResults=${maxResults}`);

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Ungültiges Datenformat. Array mit Produktdaten erwartet." });
      }

      // Count how many properties we've added
      let importedCount = 0;

      // Process each row to extract property definitions
      for (const item of data) {
        // Skip if missing required fields
        if (!item.ArticleNumber && !item.Artikelnummer) {
          continue;
        }

        // Extract all keys that could be properties
        const keys = Object.keys(item).filter(key => 
          key !== 'ArticleNumber' && 
          key !== 'Artikelnummer' && 
          key !== 'ProductName' && 
          key !== 'Produktname'
        );

        // Add each property if it doesn't exist yet
        for (const key of keys) {
          // Skip empty properties
          if (!item[key]) continue;

          // Check if this property already exists
          const existingProps = await storage.getProperties();
          const exists = existingProps.some(p => 
            p.name.toLowerCase() === key.toLowerCase()
          );

          // If it doesn't exist, add it
          if (!exists) {
            await storage.createProperty({
              name: key,
              description: `Automatisch importiert aus Excel/CSV`,
              expectedFormat: ""
            });

            importedCount++;
          }
        }
      }

      return res.json({ 
        success: true,
        count: data.length,
        imported: importedCount,
        message: `${importedCount} neue Eigenschaften wurden importiert.`
      });
    } catch (error) {
      console.error("Error processing file:", error);
      return res.status(500).json({ error: "Fehler beim Verarbeiten der Datei" });
    }
  });

  // API route for exporting data
  app.post("/api/export", async (req: Request, res: Response) => {
    try {
      const exportOptions = exportOptionsSchema.parse(req.body);

      // This endpoint would normally generate the file for download
      // For this implementation, we'll return a signal that the frontend can use
      // to trigger the client-side file generation

      res.json({ 
        message: "Export configuration valid",
        ready: true,
        options: exportOptions
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid export options", errors: error.errors });
      } else {
        console.error("Error preparing export:", error);
        res.status(500).json({ message: "Failed to prepare export" });
      }
    }
  });

  // Endpoint to get the clean content that would be sent to the AI model
  app.post("/api/get-ai-content", async (req: Request, res: Response) => {
    try {
      const { articleNumber, productName } = req.body;

      // At least product name is required for search
      if (!productName || (typeof productName === 'string' && productName.trim() === '')) {
        return res.status(400).json({ error: "Product name is required" });
      }

      // Article number is optional, but if provided should not be empty
      const validArticleNumber = articleNumber && typeof articleNumber === 'string' && articleNumber.trim() !== '' 
        ? articleNumber.trim() 
        : "";
      
      const validProductName = productName.trim();

      console.log(`Fetching clean AI content for ${validArticleNumber || 'no article number'} - ${validProductName}`);

      // Array to collect the raw HTML content from search results with metadata
      const scrapedContentArray: Array<{ content: string; url: string; title: string }> = [];

      // Collect raw HTML content from search results - use a reasonable default but allow more sources
      // Note: This endpoint doesn't require auth, so no user context available
      await searchService.collectRawContentFromSearchResults(
        validArticleNumber,
        validProductName,
        'google',
        scrapedContentArray,
        10, // Allow up to 10 results for comprehensive content extraction
        false, // PDF scraper not used in this endpoint
        undefined // No user context for this unauthenticated endpoint
      );

      console.log(`Collected ${scrapedContentArray.length} HTML content sources for parsing`);
      console.log(`Sources collected:`, scrapedContentArray.map(s => ({ url: s.url, title: s.title, contentLength: s.content.length })));

      // The scrapedContentArray contains structured data with content, url, and title
      // Format it nicely for download
      const cleanedContent = scrapedContentArray.map((item, index) => {
        if (!item || !item.content || item.content.length < 200) return '';
        
        // Format with source metadata
        return `
=========================================================================================
WEBSITE SOURCE ${index + 1}
URL: ${item.url}
Title: ${item.title}
=========================================================================================

${item.content}

`;
      }).filter(source => source.length > 200).join('\n\n');

      console.log(`Converted HTML to ${cleanedContent.length} characters of clean text for download`);

      // Set the content type as plain text for download
      res.setHeader('Content-Type', 'text/plain');
      const filename = validArticleNumber 
        ? `ai-content-clean-${validArticleNumber}.txt`
        : `ai-content-clean-${validProductName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send the cleaned content as the response (same as what AI receives)
      res.send(cleanedContent);
    } catch (error) {
      console.error("Error generating AI content for download:", error);
      res.status(500).json({ error: "Failed to generate AI content for download" });
    }
  });

  // Endpoint to check if API keys are set in environment variables
  app.get("/api/check-openai-key", (req: Request, res: Response) => {
    const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
    const hasValueSerpApiKey = !!process.env.VALUESERP_API_KEY;

    res.json({
      hasKey: hasOpenAiKey, // keep for backward compatibility
      hasOpenAiKey,
      hasValueSerpApiKey,
      message: hasOpenAiKey
        ? "OpenAI API key is configured in environment variables"
        : "No OpenAI API key found in environment variables"
    });
  });

  // AI Model Selection Endpoints
  // Get current user's selected AI model
  app.get("/api/user/ai-model", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Default to gpt-4.1-mini if no model is selected
      const selectedModel = user.selectedAiModel || "gpt-4.1-mini";
      
      res.json({
        selectedAiModel: selectedModel,
        availableModels: [
          { id: "gpt-4.1", name: "GPT-4.1", description: "Standard model - Higher quality, higher cost" },
          { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Cost-effective model - Lower cost, still powerful" }
        ]
      });
    } catch (error) {
      console.error("Error fetching user AI model:", error);
      res.status(500).json({ message: "Failed to fetch AI model preference" });
    }
  });

  // Update current user's selected AI model
  app.put("/api/user/ai-model", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { selectedAiModel } = req.body;
      
      // Validate the model selection - only allow these two models
      const allowedModels = ["gpt-4.1", "gpt-4.1-mini"];
      if (!selectedAiModel || !allowedModels.includes(selectedAiModel)) {
        return res.status(400).json({
          message: "Invalid model selection. Please choose either 'gpt-4.1' or 'gpt-4.1-mini'",
          allowedModels
        });
      }
      
      // Update the user's selected model
      const updatedUser = await storage.updateUser(userId, { selectedAiModel });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`[AI-MODEL] User ${userId} updated AI model to: ${selectedAiModel}`);
      
      res.json({
        message: "AI model preference updated successfully",
        selectedAiModel: updatedUser.selectedAiModel
      });
    } catch (error) {
      console.error("Error updating user AI model:", error);
      res.status(500).json({ message: "Failed to update AI model preference" });
    }
  });

  // ============================================
  // SECURE API KEY MANAGEMENT ENDPOINTS
  // These endpoints allow users to securely store and manage their API keys
  // Keys are encrypted at rest using AES-256-GCM
  // ============================================

  // Get user's API key status (shows if keys are configured, but not the actual keys)
  app.get("/api/user/api-keys", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      const [openAiStatus, valueSerpStatus] = await Promise.all([
        apiKeyManager.getKeyStatus(userId, 'openai'),
        apiKeyManager.getKeyStatus(userId, 'valueserp')
      ]);

      const hasOpenAiKey = openAiStatus.hasKey;
      const hasValueSerpKey = valueSerpStatus.hasKey;

      res.json({
        userId,
        keys: {
          openai: {
            configured: hasOpenAiKey,
            source: hasOpenAiKey ? 'user' : (process.env.OPENAI_API_KEY ? 'environment' : 'none')
          },
          valueserp: {
            configured: hasValueSerpKey,
            source: hasValueSerpKey ? 'user' : (process.env.VALUESERP_API_KEY ? 'environment' : 'none')
          }
        },
        message: "API key status retrieved successfully"
      });
    } catch (error) {
      secureLog.error('Failed to get API key status', error);
      res.status(500).json({ message: "Failed to retrieve API key status" });
    }
  });

  // Store a user's API key (encrypted)
  app.post("/api/user/api-keys/:keyType", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const keyType = req.params.keyType as 'openai' | 'valueserp';
      const { apiKey } = req.body;

      // Validate key type
      if (!['openai', 'valueserp'].includes(keyType)) {
        return res.status(400).json({ message: "Invalid key type. Must be 'openai' or 'valueserp'" });
      }

      // Validate API key format
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
        return res.status(400).json({ message: "Invalid API key format" });
      }

      // Additional format validation
      if (keyType === 'openai' && !apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: "Invalid OpenAI API key format. Key should start with 'sk-'" });
      }

      // Store the encrypted key
      await apiKeyManager.storeKey(userId, keyType, apiKey.trim());

      secureLog.auth('API key stored', { userId, keyType });
      
      res.json({
        success: true,
        message: `${keyType === 'openai' ? 'OpenAI' : 'ValueSERP'} API key stored securely`,
        keyType
      });
    } catch (error) {
      secureLog.error('Failed to store API key', error);
      res.status(500).json({ message: "Failed to store API key" });
    }
  });

  // Delete a user's API key
  app.delete("/api/user/api-keys/:keyType", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const keyType = req.params.keyType as 'openai' | 'valueserp';

      // Validate key type
      if (!['openai', 'valueserp'].includes(keyType)) {
        return res.status(400).json({ message: "Invalid key type. Must be 'openai' or 'valueserp'" });
      }

      await apiKeyManager.deleteKey(userId, keyType);

      secureLog.auth('API key deleted', { userId, keyType });
      
      res.json({
        success: true,
        message: `${keyType === 'openai' ? 'OpenAI' : 'ValueSERP'} API key removed`,
        keyType
      });
    } catch (error) {
      secureLog.error('Failed to delete API key', error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Rotate a user's API key with a new one
  app.put("/api/user/api-keys/:keyType", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const keyType = req.params.keyType as 'openai' | 'valueserp';
      const { apiKey } = req.body;

      // Validate key type
      if (!['openai', 'valueserp'].includes(keyType)) {
        return res.status(400).json({ message: "Invalid key type. Must be 'openai' or 'valueserp'" });
      }

      // Validate API key format
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
        return res.status(400).json({ message: "Invalid API key format" });
      }

      // Additional format validation for OpenAI
      if (keyType === 'openai' && !apiKey.startsWith('sk-')) {
        return res.status(400).json({ message: "Invalid OpenAI API key format. Key should start with 'sk-'" });
      }

      // Rotate the key (delete old, store new)
      await apiKeyManager.deleteKey(userId, keyType);
      await apiKeyManager.storeKey(userId, keyType, apiKey.trim());

      secureLog.auth('API key rotated', { userId, keyType });
      
      res.json({
        success: true,
        message: `${keyType === 'openai' ? 'OpenAI' : 'ValueSERP'} API key updated successfully`,
        keyType
      });
    } catch (error) {
      secureLog.error('Failed to rotate API key', error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  // Test an API key (validates it works without storing)
  app.post("/api/user/api-keys/:keyType/test", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const keyType = req.params.keyType as 'openai' | 'valueserp';
      const { apiKey } = req.body;

      // Validate key type
      if (!['openai', 'valueserp'].includes(keyType)) {
        return res.status(400).json({ message: "Invalid key type" });
      }

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ message: "API key is required" });
      }

      let isValid = false;
      let message = '';

      if (keyType === 'openai') {
        // Test OpenAI key by making a simple API call
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            }
          });
          isValid = response.ok;
          message = isValid ? 'OpenAI API key is valid' : 'OpenAI API key is invalid or expired';
        } catch {
          message = 'Failed to validate OpenAI API key';
        }
      } else if (keyType === 'valueserp') {
        // Test ValueSERP key by making a simple API call
        try {
          const testUrl = new URL('https://api.valueserp.com/search');
          testUrl.searchParams.append('api_key', apiKey);
          testUrl.searchParams.append('q', 'test');
          testUrl.searchParams.append('num', '1');
          
          const response = await fetch(testUrl.toString());
          const data = await response.json();
          isValid = response.ok && !data.error;
          message = isValid ? 'ValueSERP API key is valid' : (data.error || 'ValueSERP API key is invalid');
        } catch {
          message = 'Failed to validate ValueSERP API key';
        }
      }

      res.json({
        valid: isValid,
        message,
        keyType
      });
    } catch (error) {
      secureLog.error('Failed to test API key', error);
      res.status(500).json({ message: "Failed to test API key" });
    }
  });

  // Get effective API key for a service (uses user's key or falls back to environment)
  // This is an internal helper - the actual key is never returned to the client
  // Instead, use this in backend services
  app.get("/api/user/api-keys/:keyType/effective", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const keyType = req.params.keyType as 'openai' | 'valueserp';

      // Validate key type
      if (!['openai', 'valueserp'].includes(keyType)) {
        return res.status(400).json({ message: "Invalid key type" });
      }

      const effectiveKey = await apiKeyManager.getEffectiveKey(userId, keyType);
      
      // Never return the actual key - just indicate if one is available
      const status = await apiKeyManager.getKeyStatus(userId, keyType);

      res.json({
        available: !!effectiveKey,
        source: effectiveKey ? (status.hasKey ? 'user' : 'environment') : 'none',
        keyType
      });
    } catch (error) {
      secureLog.error('Failed to check effective API key', error);
      res.status(500).json({ message: "Failed to check API key availability" });
    }
  });

  // Settings API endpoints
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAppSettings();

      // If no settings exist yet, return default values
      if (!settings) {
        return res.json({
          id: 1,
          // Don't return API keys directly for security
          hasOpenAiKey: !!process.env.OPENAI_API_KEY,
          hasValueSerpApiKey: !!process.env.VALUESERP_API_KEY,
        });
      }

      // Return settings but mask API keys for security
      res.json({
        id: settings.id,
        updatedAt: settings.updatedAt,
        // Show if keys are set but not the actual keys
        hasOpenAiKey: !!settings.openaiApiKey || !!process.env.OPENAI_API_KEY,
        hasValueSerpApiKey: !!settings.valueSerpApiKey || !!process.env.VALUESERP_API_KEY,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const settingsData = req.body;

      // Save settings to database
      const savedSettings = await storage.saveAppSettings(settingsData);

      // Return settings but mask API keys for security
      res.json({
        id: savedSettings.id,
        updatedAt: savedSettings.updatedAt,
        // Show if keys are set but not the actual keys
        hasOpenAiKey: !!savedSettings.openaiApiKey,
        hasValueSerpApiKey: !!savedSettings.valueSerpApiKey,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // Manufacturer Domains API endpoints
  app.get("/api/manufacturer-domains", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      console.log(`[MANUFACTURER-DOMAINS] Fetching domains for user ${userId}`);
      
      const domains = await storage.getManufacturerDomainsByUserId(userId);
      console.log(`[MANUFACTURER-DOMAINS] Found ${domains.length} domains`);
      res.json(domains);
    } catch (error) {
      console.error("Error fetching manufacturer domains:", error);
      res.status(500).json({ message: "Failed to fetch manufacturer domains" });
    }
  });

  app.post("/api/manufacturer-domains", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { name, websiteUrl, isActive = true } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Manufacturer name is required" });
      }
      
      if (!websiteUrl || !websiteUrl.trim()) {
        return res.status(400).json({ message: "Website URL is required" });
      }
      
      // Validate URL format and extract hostname
      let cleanDomain: string;
      try {
        const url = new URL(websiteUrl.trim());
        cleanDomain = url.hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }
      
      // Check for duplicate in manufacturer domains
      const existingManufacturerDomains = await storage.getManufacturerDomainsByUserId(userId);
      const duplicateManufacturer = existingManufacturerDomains.find(d => {
        try {
          const existingUrl = new URL(d.websiteUrl);
          const existingHostname = existingUrl.hostname.toLowerCase().replace(/^www\./, '');
          return existingHostname === cleanDomain;
        } catch {
          return false;
        }
      });
      
      if (duplicateManufacturer) {
        return res.status(400).json({
          message: `Diese Domain ist bereits in der Prioritätsliste vorhanden: ${duplicateManufacturer.name}`
        });
      }
      
      // Check for conflict with excluded domains
      const excludedDomains = await storage.getExcludedDomainsByUserId(userId);
      const conflictExcluded = excludedDomains.find(d => {
        const excludedHostname = d.domain.toLowerCase().replace(/^www\./, '');
        return excludedHostname === cleanDomain ||
               cleanDomain.endsWith('.' + excludedHostname) ||
               excludedHostname.endsWith('.' + cleanDomain);
      });
      
      if (conflictExcluded) {
        return res.status(400).json({
          message: `Diese Domain befindet sich bereits in der Sperrliste. Bitte entfernen Sie sie zuerst aus der Sperrliste, bevor Sie sie zur Prioritätsliste hinzufügen.`
        });
      }
      
      console.log(`[MANUFACTURER-DOMAINS] Creating domain for user ${userId}: ${name} - ${websiteUrl}`);
      
      const newDomain = await storage.createManufacturerDomain({
        userId,
        name: name.trim(),
        websiteUrl: websiteUrl.trim(),
        isActive
      });
      
      // Update searchService with new domains
      await searchService.updateManufacturerDomains(storage);
      
      console.log(`[MANUFACTURER-DOMAINS] Created domain ID ${newDomain.id}`);
      res.status(201).json(newDomain);
    } catch (error) {
      console.error("Error creating manufacturer domain:", error);
      res.status(500).json({ message: "Failed to create manufacturer domain" });
    }
  });

  app.put("/api/manufacturer-domains/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const { name, websiteUrl, isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid domain ID" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (websiteUrl !== undefined) {
        // Validate URL format
        try {
          new URL(websiteUrl.trim());
          updateData.websiteUrl = websiteUrl.trim();
        } catch {
          return res.status(400).json({ message: "Invalid URL format" });
        }
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      
      console.log(`[MANUFACTURER-DOMAINS] Updating domain ${id} for user ${userId}`);
      
      const updated = await storage.updateManufacturerDomain(id, userId, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Manufacturer domain not found or access denied" });
      }
      
      // Update searchService with new domains
      await searchService.updateManufacturerDomains(storage);
      
      console.log(`[MANUFACTURER-DOMAINS] Updated domain ${id}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating manufacturer domain:", error);
      res.status(500).json({ message: "Failed to update manufacturer domain" });
    }
  });

  app.delete("/api/manufacturer-domains/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid domain ID" });
      }
      
      console.log(`[MANUFACTURER-DOMAINS] Deleting domain ${id} for user ${userId}`);
      
      const success = await storage.deleteManufacturerDomain(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Manufacturer domain not found or access denied" });
      }
      
      // Update searchService with new domains
      await searchService.updateManufacturerDomains(storage);
      
      console.log(`[MANUFACTURER-DOMAINS] Deleted domain ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting manufacturer domain:", error);
      res.status(500).json({ message: "Failed to delete manufacturer domain" });
    }
  });

  // Excluded Domains API endpoints
  app.get("/api/excluded-domains", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      console.log(`[EXCLUDED-DOMAINS] Fetching domains for user ${userId}`);
      
      const domains = await storage.getExcludedDomainsByUserId(userId);
      console.log(`[EXCLUDED-DOMAINS] Found ${domains.length} domains`);
      res.json(domains);
    } catch (error) {
      console.error("Error fetching excluded domains:", error);
      res.status(500).json({ message: "Failed to fetch excluded domains" });
    }
  });

  app.post("/api/excluded-domains", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { domain, reason, isActive = true } = req.body;
      
      if (!domain || !domain.trim()) {
        return res.status(400).json({ message: "Domain is required" });
      }
      
      // Extract domain from full URL if provided
      let cleanDomain = domain.trim();
      try {
        const url = new URL(cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`);
        cleanDomain = url.hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        // If URL parsing fails, use the original input as-is
        cleanDomain = domain.trim().toLowerCase().replace(/^www\./, '');
      }
      
      // Check for duplicate in excluded domains
      const existingExcludedDomains = await storage.getExcludedDomainsByUserId(userId);
      const duplicateExcluded = existingExcludedDomains.find(d => {
        const existingHostname = d.domain.toLowerCase().replace(/^www\./, '');
        return existingHostname === cleanDomain;
      });
      
      if (duplicateExcluded) {
        return res.status(400).json({
          message: `Diese Domain ist bereits in der Sperrliste vorhanden.`
        });
      }
      
      // Check for conflict with manufacturer domains
      const manufacturerDomains = await storage.getManufacturerDomainsByUserId(userId);
      const conflictManufacturer = manufacturerDomains.find(d => {
        try {
          const manufacturerUrl = new URL(d.websiteUrl);
          const manufacturerHostname = manufacturerUrl.hostname.toLowerCase().replace(/^www\./, '');
          return manufacturerHostname === cleanDomain ||
                 cleanDomain.endsWith('.' + manufacturerHostname) ||
                 manufacturerHostname.endsWith('.' + cleanDomain);
        } catch {
          return false;
        }
      });
      
      if (conflictManufacturer) {
        return res.status(400).json({
          message: `Diese Domain befindet sich bereits in der Prioritätsliste (${conflictManufacturer.name}). Bitte entfernen Sie sie zuerst aus der Prioritätsliste, bevor Sie sie zur Sperrliste hinzufügen.`
        });
      }
      
      console.log(`[EXCLUDED-DOMAINS] Creating excluded domain for user ${userId}: ${cleanDomain}`);
      
      const newDomain = await storage.createExcludedDomain({
        userId,
        domain: cleanDomain,
        reason: reason?.trim() || null,
        isActive
      });
      
      // Update searchService with new domains
      await searchService.updateExcludedDomains(storage);
      
      console.log(`[EXCLUDED-DOMAINS] Created domain ID ${newDomain.id}`);
      res.status(201).json(newDomain);
    } catch (error) {
      console.error("Error creating excluded domain:", error);
      res.status(500).json({ message: "Failed to create excluded domain" });
    }
  });

  app.put("/api/excluded-domains/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      const { domain, reason, isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid domain ID" });
      }
      
      const updateData: any = {};
      if (domain !== undefined) {
        // Extract domain from full URL if provided
        let cleanDomain = domain.trim();
        try {
          const url = new URL(cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`);
          cleanDomain = url.hostname;
        } catch {
          cleanDomain = domain.trim().toLowerCase();
        }
        updateData.domain = cleanDomain;
      }
      if (reason !== undefined) updateData.reason = reason?.trim() || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      console.log(`[EXCLUDED-DOMAINS] Updating domain ${id} for user ${userId}`);
      
      const updated = await storage.updateExcludedDomain(id, userId, updateData);
      
      if (!updated) {
        return res.status(404).json({ message: "Excluded domain not found or access denied" });
      }
      
      // Update searchService with new domains
      await searchService.updateExcludedDomains(storage);
      
      console.log(`[EXCLUDED-DOMAINS] Updated domain ${id}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating excluded domain:", error);
      res.status(500).json({ message: "Failed to update excluded domain" });
    }
  });

  app.delete("/api/excluded-domains/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid domain ID" });
      }
      
      console.log(`[EXCLUDED-DOMAINS] Deleting domain ${id} for user ${userId}`);
      
      const success = await storage.deleteExcludedDomain(id, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Excluded domain not found or access denied" });
      }
      
      // Update searchService with new domains
      await searchService.updateExcludedDomains(storage);
      
      console.log(`[EXCLUDED-DOMAINS] Deleted domain ${id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting excluded domain:", error);
      res.status(500).json({ message: "Failed to delete excluded domain" });
    }
  });

  // Token Usage Monitoring API Routes
  app.get("/api/token-usage/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await storage.getTokenUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching token usage stats:", error);
      res.status(500).json({ error: "Failed to fetch token usage statistics" });
    }
  });

  app.get("/api/token-usage/recent", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const recentUsage = await storage.getRecentTokenUsage(limit);
      res.json(recentUsage);
    } catch (error) {
      console.error("Error fetching recent token usage:", error);
      res.status(500).json({ error: "Failed to fetch recent token usage" });
    }
  });

  // Per-user token usage endpoints
  app.get("/api/token-usage/stats/user/:userId", requireAuth, requireOwnershipOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const stats = await storage.getTokenUsageStatsByUser(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user token usage stats:", error);
      res.status(500).json({ error: "Failed to fetch user token usage statistics" });
    }
  });

  app.get("/api/token-usage/recent/user/:userId", requireAuth, requireOwnershipOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const recentUsage = await storage.getRecentTokenUsageByUser(userId, limit);
      res.json(recentUsage);
    } catch (error) {
      console.error("Error fetching user recent token usage:", error);
      res.status(500).json({ error: "Failed to fetch user recent token usage" });
    }
  });

  app.post("/api/token-usage", async (req: Request, res: Response) => {
    try {
      const tokenUsage = await storage.saveTokenUsage(req.body);
      res.json(tokenUsage);
    } catch (error) {
      console.error("Error saving token usage:", error);
      res.status(500).json({ error: "Failed to save token usage" });
    }
  });

  // Contact Form API endpoint - Public (no auth required)
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const { name, email, subject, message } = req.body;
      
      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }
      if (!subject || !subject.trim()) {
        return res.status(400).json({ message: "Subject is required" });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Sanitize inputs
      const sanitizedName = name.trim().substring(0, 100);
      const sanitizedEmail = email.trim().substring(0, 100);
      const sanitizedSubject = subject.trim().substring(0, 200);
      const sanitizedMessage = message.trim().substring(0, 5000);

      console.log(`[CONTACT] Received contact form submission from ${sanitizedEmail}`);

      // Send the contact message to kontakt@rowbooster.com
      await emailService.sendContactMessage(
        sanitizedName,
        sanitizedEmail,
        sanitizedSubject,
        sanitizedMessage
      );

      // Send auto-reply to the sender
      try {
        await emailService.sendContactAutoReply(
          sanitizedEmail,
          sanitizedName,
          sanitizedSubject
        );
      } catch (autoReplyError) {
        // Log but don't fail the request if auto-reply fails
        console.warn('[CONTACT] Auto-reply failed:', autoReplyError);
      }

      console.log(`[CONTACT] Contact message processed successfully for ${sanitizedEmail}`);
      
      res.json({
        success: true,
        message: "Message sent successfully. Thank you for contacting us!"
      });
    } catch (error: any) {
      console.error("[CONTACT] Error processing contact form:", error);
      res.status(500).json({
        message: "Failed to send message. Please try again later.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Health Check Endpoint - Public (no auth required)
  app.get("/api/health", async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Check database connection
      let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
      let dbResponseTime = 0;
      let dbError: string | null = null;
      
      try {
        const dbStart = Date.now();
        await storage.healthCheck();
        dbResponseTime = Date.now() - dbStart;
        dbStatus = dbResponseTime < 1000 ? 'healthy' : dbResponseTime < 3000 ? 'degraded' : 'unhealthy';
      } catch (error) {
        dbError = (error as Error).message;
        console.error('[HEALTH] Database check failed:', error);
      }

      // Get uptime
      const uptime = process.uptime();

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      // Format uptime
      const formatUptime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        return parts.join(' ');
      };

      const overallStatus = dbStatus === 'healthy' ? 'healthy' : dbStatus;

      const healthData = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components: {
          database: {
            status: dbStatus,
            responseTime: dbResponseTime,
            error: dbError,
          },
          api: {
            status: 'healthy',
            responseTime: Date.now() - startTime,
          },
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          units: 'MB',
        },
      };

      // Log health check to monitoring (async, non-blocking)
      const { MonitoringLogger } = await import('./services/monitoringLogger');
      MonitoringLogger.recordHealthCheck({
        component: 'main-app',
        status: overallStatus,
        message: `Health check completed (DB: ${dbStatus})`,
        responseTime: Date.now() - startTime,
        details: healthData,
      }).catch(err => console.error('[HEALTH] Failed to log health check:', err));

      const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
      res.status(statusCode).json(healthData);
    } catch (error: any) {
      console.error('[HEALTH] Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Detailed Health Check (requires auth)
  app.get("/api/health/detailed", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const startTime = Date.now();
      
      // Get database stats
      const dbStats = await storage.getDatabaseStats();
      
      // Get user count
      const userCount = await storage.getAllUsers().then(users => users.length).catch(() => 0);
      
      // Get recent errors count
      let recentErrors = 0;
      try {
        const { MonitoringLogger } = await import('./services/monitoringLogger');
        const health = await MonitoringLogger.getSystemHealth();
        recentErrors = health.length;
      } catch (e) {
        // Ignore error
      }

      const memoryUsage = process.memoryUsage();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        server: {
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
          units: 'MB',
        },
        database: dbStats,
        application: {
          totalUsers: userCount,
          recentErrors: recentErrors,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          databaseConfigured: !!process.env.DATABASE_URL,
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          valueSerpConfigured: !!process.env.VALUESERP_API_KEY,
          smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
        },
      });
    } catch (error: any) {
      console.error('[HEALTH] Detailed health check error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  });

  // Independent URL Content Parsing API Routes
  app.post("/api/parse-url", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Parsing content from URL: ${url}`);
      const parsedContent = await htmlParserService.parseUrl(url);
      
      res.json({
        success: true,
        data: parsedContent
      });
    } catch (error) {
      console.error("Error parsing URL:", error);
      res.status(500).json({ 
        error: "Failed to parse URL content",
        message: (error as Error).message 
      });
    }
  });

  app.post("/api/parse-html", async (req: Request, res: Response) => {
    try {
      const { htmlContent, url } = req.body;
      
      if (!htmlContent) {
        return res.status(400).json({ error: "HTML content is required" });
      }

      console.log(`Parsing HTML content for URL: ${url || 'unknown'}`);
      const parsedContent = htmlParserService.parseHtmlContent(htmlContent, url || 'unknown');
      
      res.json({
        success: true,
        data: parsedContent
      });
    } catch (error) {
      console.error("Error parsing HTML content:", error);
      res.status(500).json({ 
        error: "Failed to parse HTML content",
        message: (error as Error).message 
      });
    }
  });

  app.post("/api/download-parsed-content", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Downloading parsed content from URL: ${url}`);
      const parsedContent = await htmlParserService.parseUrl(url);
      const downloadableContent = htmlParserService.generateDownloadableContent(parsedContent);
      
      res.json({
        success: true,
        content: downloadableContent,
        filename: `parsed_content_${new Date().toISOString().split('T')[0]}.txt`
      });
    } catch (error) {
      console.error("Error downloading parsed content:", error);
      res.status(500).json({ 
        error: "Failed to download parsed content",
        message: (error as Error).message 
      });
    }
  });

  app.post("/api/extract-url-product-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Extract userId from authenticated request
      const userId = req.user?.id || null;
      console.log(`[URL-MANUAL-ENDPOINT] Processing request for user ${userId || 'anonymous'}`);
      
      const { url, productName, articleNumber, properties, useAI, aiModelProvider, openaiApiKey, pdfText, pdfFilesInfo, includePdfContent } = req.body;
      
      console.log(`[URL-MANUAL-ENDPOINT] Starting URL extraction`);
      console.log(`[URL-MANUAL-ENDPOINT] URL: ${url}`);
      console.log(`[URL-MANUAL-ENDPOINT] Product: ${productName}`);
      console.log(`[URL-MANUAL-ENDPOINT] Article Number: ${articleNumber}`);
      console.log(`[URL-MANUAL-ENDPOINT] Properties count: ${properties?.length || 0}`);
      console.log(`[URL-MANUAL-ENDPOINT] PDF content included: ${includePdfContent ? 'Yes' : 'No'}`);
      console.log(`[URL-MANUAL-ENDPOINT] PDF files info: ${pdfFilesInfo || 'None'}`);
      
      if (!url || !productName) {
        console.error("[URL-MANUAL-ENDPOINT] Missing required fields");
        return res.status(400).json({ error: "URL and product name are required" });
      }

      // Get all stored properties from database to ensure complete output
      const storedProperties = await storage.getProperties();
      console.log(`[URL-MANUAL-ENDPOINT] Retrieved ${storedProperties.length} stored properties from database`);
      
      // Log property names and order for debugging
      const sortedProperties = storedProperties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      console.log(`[URL-MANUAL-ENDPOINT] Property order: ${sortedProperties.map(p => p.name).join(', ')}`);
      
      // Enhanced content scraping with dynamic rendering support
      console.log(`[URL-MANUAL-ENDPOINT] Starting content scraping from ${url}`);
      const { jsContentExtractor } = await import('./services/jsContentExtractor');
      const jsResult = await jsContentExtractor.extractContent(url, articleNumber);
      
      let scrapedContent = '';
      if (jsResult.success && jsResult.hasJavaScriptFramework) {
        console.log(`[URL-MANUAL-ENDPOINT] Using enhanced JS extraction: ${jsResult.method}, ${jsResult.contentLength} characters`);
        scrapedContent = jsResult.content;
      } else {
        console.log(`[URL-MANUAL-ENDPOINT] Using fallback HTML parser`);
        const parsedContent = await htmlParserService.parseUrl(url);
        scrapedContent = parsedContent.textContent || '';
      }
      
      console.log(`[URL-MANUAL-ENDPOINT] Final scraped content length: ${scrapedContent.length} characters`);
      
      if (!scrapedContent || scrapedContent.length < 100) {
        console.warn("[URL-MANUAL-ENDPOINT] Warning: Very little content scraped - possible scraping issue");
      }
      
      let extractedProperties: any = {};
      
      // Initialize all stored properties with empty values to ensure they appear in output
      console.log(`[URL-MANUAL-ENDPOINT] Initializing ${storedProperties.length} properties with empty values`);
      for (const prop of storedProperties) {
        extractedProperties[prop.name] = {
          name: prop.name,
          value: "",
          confidence: 0,
          isConsistent: false,
          sources: []
        };
      }
      
      // Set up OpenAI API key if provided
      if (openaiApiKey) {
        console.log(`[URL-MANUAL-ENDPOINT] Using provided OpenAI API key`);
        openaiService.setApiKey(openaiApiKey);
      } else if (process.env.OPENAI_API_KEY) {
        console.log(`[URL-MANUAL-ENDPOINT] Using environment OpenAI API key`);
        openaiService.setModelProvider('openai');
      } else {
        console.error(`[URL-MANUAL-ENDPOINT] No OpenAI API key available`);
        return res.status(400).json({
          error: "OpenAI API key required",
          message: "Please provide an OpenAI API key or configure environment variable"
        });
      }
      
      // Convert stored properties to the format expected by the extraction method
      const propertiesForExtraction = sortedProperties.map(prop => ({
        name: prop.name,
        description: prop.description || undefined,
        expectedFormat: prop.expectedFormat || undefined,
        orderIndex: prop.orderIndex || 0
      }));
      
      // If PDF content is included, use combined extraction with source tracking
      if (includePdfContent && pdfText && pdfText.trim()) {
        console.log(`\n[URL-MANUAL-ENDPOINT] ===== PDF + URL EXTRACTION MODE =====`);
        console.log(`[URL-MANUAL-ENDPOINT] PDF content length: ${pdfText.length} characters`);
        console.log(`[URL-MANUAL-ENDPOINT] Web content length: ${scrapedContent.length} characters`);
        console.log(`[URL-MANUAL-ENDPOINT] PDF files info: ${pdfFilesInfo || 'Not specified'}`);
        
        // Validate that we have both PDF and URL content
        if (!pdfText || pdfText.trim().length < 50) {
          console.error(`[URL-MANUAL-ENDPOINT] ERROR: PDF content is too short or empty!`);
          console.error(`[URL-MANUAL-ENDPOINT] PDF text preview: ${pdfText.substring(0, 200)}`);
        }
        
        if (!scrapedContent || scrapedContent.trim().length < 50) {
          console.error(`[URL-MANUAL-ENDPOINT] ERROR: URL content is too short or empty!`);
          console.error(`[URL-MANUAL-ENDPOINT] URL text preview: ${scrapedContent.substring(0, 200)}`);
        }
        
        // Parse PDF files info
        let parsedPdfFilesInfo: Array<{name: string, url: string}> = [];
        try {
          if (pdfFilesInfo) {
            parsedPdfFilesInfo = JSON.parse(pdfFilesInfo);
            console.log(`[URL-MANUAL-ENDPOINT] Parsed ${parsedPdfFilesInfo.length} PDF file info entries`);
            parsedPdfFilesInfo.forEach((info, idx) => {
              console.log(`[URL-MANUAL-ENDPOINT]   PDF ${idx + 1}: ${info.name} -> ${info.url.substring(0, 50)}...`);
            });
          }
        } catch (parseError) {
          console.warn(`[URL-MANUAL-ENDPOINT] Failed to parse PDF files info:`, parseError);
        }
        
        // Prepare sources array with both PDF and URL content
        // Use actual PDF file info with blob URLs for proper citation
        const pdfFilesList = parsedPdfFilesInfo.map(info => info.name).join(', ');
        const pdfBlobUrls = parsedPdfFilesInfo.map(info => ({ name: info.name, url: info.url }));
        
        const sources = [
          { content: pdfText, url: 'PDF_SOURCE', title: pdfFilesList || 'PDF Document', pdfFiles: pdfBlobUrls },
          { content: scrapedContent, url: url, title: url }
        ];
        
        console.log(`\n[URL-MANUAL-ENDPOINT] ===== SENDING TO AI MODEL =====`);
        console.log(`[URL-MANUAL-ENDPOINT] Total sources being sent: ${sources.length}`);
        console.log(`[URL-MANUAL-ENDPOINT] Source 1 (PDF):`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Content length: ${sources[0].content.length} characters`);
        console.log(`[URL-MANUAL-ENDPOINT]   - URL label: ${sources[0].url}`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Title: ${sources[0].title}`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Content preview: ${sources[0].content.substring(0, 200)}...`);
        console.log(`[URL-MANUAL-ENDPOINT] Source 2 (URL):`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Content length: ${sources[1].content.length} characters`);
        console.log(`[URL-MANUAL-ENDPOINT]   - URL: ${sources[1].url}`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Title: ${sources[1].title}`);
        console.log(`[URL-MANUAL-ENDPOINT]   - Content preview: ${sources[1].content.substring(0, 200)}...`);
        console.log(`[URL-MANUAL-ENDPOINT] =======================================\n`);
        
        // Import optimized service for batched extraction with source tracking
        const { optimizedOpenaiService } = await import('./services/optimizedOpenaiService');
        if (openaiApiKey) {
          optimizedOpenaiService.setApiKey(openaiApiKey);
        } else if (process.env.OPENAI_API_KEY) {
          optimizedOpenaiService.setApiKey(process.env.OPENAI_API_KEY);
        }
        
        // Get user's selected AI model for PDF+URL combined extraction
        const pdfUrlUserForModel = userId ? await storage.getUser(userId) : null;
        const pdfUrlUserSelectedModel = pdfUrlUserForModel?.selectedAiModel || "gpt-4.1-mini";
        console.log(`[URL-MANUAL-ENDPOINT] PDF+URL combined extraction using AI model: ${pdfUrlUserSelectedModel}`);
        
        // Use batched extraction which preserves source information and combines both sources
        const aiExtractedPropertiesCombined = await optimizedOpenaiService.extractFromBatchedSources(
          sources,
          articleNumber || '',
          productName,
          propertiesForExtraction,
          userId,
          pdfUrlUserSelectedModel
        );
        
        // Post-process the extracted properties to replace PDF_SOURCE with actual blob URLs
        const processedProperties: Record<string, any> = {};
        for (const [propName, propData] of Object.entries(aiExtractedPropertiesCombined)) {
          const processedProp = { ...propData };
          if (processedProp.sources && Array.isArray(processedProp.sources)) {
            processedProp.sources = processedProp.sources.map((source: any) => {
              if (source.url === 'PDF_SOURCE' && pdfBlobUrls.length > 0) {
                // If single PDF, use its blob URL; if multiple, use the first one
                return {
                  ...source,
                  url: pdfBlobUrls[0].url,
                  title: pdfBlobUrls.map(p => p.name).join(', '),
                  isPdf: true,
                  pdfFiles: pdfBlobUrls
                };
              }
              return source;
            });
          }
          processedProperties[propName] = processedProp;
        }
        
        extractedProperties = processedProperties;
        
        console.log(`\n[URL-MANUAL-ENDPOINT] ===== EXTRACTION RESULTS =====`);
        console.log(`[URL-MANUAL-ENDPOINT] Total properties extracted: ${Object.keys(extractedProperties).length}`);
        
        // Log detailed source tracking for verification
        const sampleProps = Object.entries(extractedProperties).slice(0, 5);
        console.log(`[URL-MANUAL-ENDPOINT] Sample properties with source tracking:`);
        sampleProps.forEach(([key, prop]: [string, any]) => {
          const sourcesInfo = prop.sources?.map((s: any) => {
            if (s.isPdf) {
              return `PDF (${s.title})`;
            }
            return `URL (${s.url})`;
          }).join(' + ') || 'No sources';
          console.log(`  - ${key}: "${prop.value}"`);
          console.log(`    Sources (${prop.sources?.length || 0}): ${sourcesInfo}`);
          console.log(`    Consistency: ${prop.isConsistent ? 'YES' : 'NO'} (count: ${prop.consistencyCount || 0})`);
        });
        console.log(`[URL-MANUAL-ENDPOINT] ===================================\n`);
      } else {
        // Standard URL-only extraction
        console.log(`[URL-MANUAL-ENDPOINT] Using dedicated URL extraction method`);
        
        // Get user's selected AI model for URL manual input
        const urlManualUserForModel = userId ? await storage.getUser(userId) : null;
        const urlManualUserSelectedModel = urlManualUserForModel?.selectedAiModel || "gpt-4.1-mini";
        console.log(`[URL-MANUAL-ENDPOINT] Using AI model: ${urlManualUserSelectedModel}`);
        
        const aiExtractedPropertiesUrl = await openaiService.extractFromUrlManualInput(
          scrapedContent,
          articleNumber || '',
          productName,
          propertiesForExtraction,
          userId,
          url, // Pass actual URL for source tracking
          urlManualUserSelectedModel // Pass user's selected model
        );
        
        extractedProperties = aiExtractedPropertiesUrl;
      }
      
      console.log(`[URL-MANUAL-ENDPOINT] Extraction completed, processing results`);
      console.log(`[URL-MANUAL-ENDPOINT] AI returned ${Object.keys(extractedProperties).length} properties`);
      
      // Verify data is present and log findings
      let propertiesWithData = 0;
      let emptyProperties = 0;
      for (const [propName, propData] of Object.entries(extractedProperties)) {
        const value = (propData as any).value;
        if (value && value.trim() !== "") {
          propertiesWithData++;
          console.log(`[URL-MANUAL-ENDPOINT] Found data for ${propName}: ${value}`);
        } else {
          emptyProperties++;
        }
      }
      
      console.log(`[URL-MANUAL-ENDPOINT] Data extraction summary: ${propertiesWithData} properties with data, ${emptyProperties} empty`);
      
      if (propertiesWithData === 0) {
        console.warn(`[URL-MANUAL-ENDPOINT] WARNING: No property values found - possible extraction issue`);
        console.warn(`[URL-MANUAL-ENDPOINT] Scraped content preview: ${scrapedContent.substring(0, 500)}...`);
      }

      // Create search response format
      const searchResponse: SearchResponse = {
        id: Date.now(),
        searchMethod: "url",
        searchStatus: "complete",
        statusMessage: `Successfully extracted product data from URL - ${propertiesWithData} properties found`,
        products: [{
          id: `url-manual-${Date.now()}`,
          articleNumber: articleNumber || '',
          productName: productName,
          properties: extractedProperties
        }]
      };

      console.log(`[URL-MANUAL-ENDPOINT] Sending response with ${Object.keys(extractedProperties).length} properties`);
      console.log(`[URL-MANUAL-ENDPOINT] Response product data:`, JSON.stringify(searchResponse.products[0], null, 2));
      
      // Log to monitoring system for Manuelle Quellen tab
      try {
        // Determine the search mode based on whether PDF content was included
        const searchMode: 'url_only' | 'url_pdf' = (includePdfContent && pdfText && pdfText.trim()) ? 'url_pdf' : 'url_only';
        
        // Extract property details for logging
        const extractedPropertyDetails = Object.entries(extractedProperties)
          .filter(([key]) => !key.startsWith('__meta'))
          .map(([name, prop]: [string, any]) => ({
            name: name,
            value: String(prop.value || '').substring(0, 200),
            confidence: prop.confidence || 0,
            isConsistent: prop.isConsistent,
            sources: prop.sources?.slice(0, 3)?.map((s: any) => ({ url: s.url || '', title: s.title || '' })),
          }));

        // Collect source URLs
        const sourceUrls = [url];
        if (pdfFilesInfo) {
          try {
            const parsedPdfInfo = JSON.parse(pdfFilesInfo);
            sourceUrls.push(...parsedPdfInfo.map((info: any) => `PDF: ${info.name}`));
          } catch (e) {
            // Ignore parse error
          }
        }

        await MonitoringLogger.logCustomSearchActivity({
          userId: userId!,
          username: req.user!.username,
          searchTab: 'manuelle_quellen',
          searchMode: searchMode,
          articleNumber: articleNumber,
          productName: productName,
          webUrl: url,
          pdfFilesCount: pdfFilesInfo ? JSON.parse(pdfFilesInfo).length : 0,
          pdfFilesInfo: pdfFilesInfo ? JSON.parse(pdfFilesInfo).map((info: any) => info.name) : undefined,
          extractedProperties: extractedPropertyDetails,
          scrapedDataSummary: {
            webContentLength: scrapedContent?.length || 0,
            pdfContentLength: pdfText?.length || 0,
            totalContentLength: (scrapedContent?.length || 0) + (pdfText?.length || 0),
          },
          processingTime: Date.now() - (searchResponse.id || Date.now()),
          success: true,
        });

        console.log(`[MONITORING] Logged custom search activity for user ${userId}`);
      } catch (logError) {
        console.error('[MONITORING] Failed to log custom search activity:', logError);
        // Don't fail the request if logging fails
      }

      res.json(searchResponse);
    } catch (error) {
      console.error("[URL-MANUAL-ENDPOINT] Error extracting product data from URL:", error);
      console.error("[URL-MANUAL-ENDPOINT] Error stack:", (error as Error).stack);
      res.status(500).json({ 
        error: "Failed to extract product data from URL",
        message: (error as Error).message 
      });
    }
  });

  // Configure multer for PDF file uploads with enhanced security
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit (reduced for security)
      files: 5, // Maximum 5 files per request
    },
    fileFilter: (req, file, cb) => {
      // Validate both mimetype and file extension for security
      const allowedMimeTypes = ['application/pdf'];
      const allowedExtensions = ['.pdf'];
      const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      
      if (!allowedMimeTypes.includes(file.mimetype)) {
        secureLog.security('Rejected file upload: invalid mimetype', {
          mimetype: file.mimetype,
          filename: file.originalname,
        });
        cb(new Error('Invalid file type. Only PDF files are allowed.'));
        return;
      }
      
      if (!allowedExtensions.includes(fileExtension)) {
        secureLog.security('Rejected file upload: invalid extension', {
          extension: fileExtension,
          filename: file.originalname,
        });
        cb(new Error('Invalid file extension. Only .pdf files are allowed.'));
        return;
      }
      
      // Sanitize filename to prevent path traversal
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      file.originalname = sanitizedName;
      
      cb(null, true);
    }
  });

  // Test endpoint for browser scraping with JavaScript-heavy content
  app.post("/api/test-browser-scraping", async (req: Request, res: Response) => {
    try {
      const { url, articleNumber, productName } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log(`Testing browser scraping for: ${url}`);
      
      // Import browser scraper
      const { browserScraper } = await import('./services/browserScraper');
      
      // Test both traditional and browser scraping
      let traditionalResult = null;
      let browserResult = null;
      
      // Traditional HTTP scraping
      try {
        console.log('Testing traditional HTTP scraping...');
        const axios = require('axios');
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
          timeout: 10000,
        });
        
        traditionalResult = {
          success: true,
          contentLength: response.data.length,
          hasJavaScriptFrameworks: {
            react: response.data.includes('data-reactroot') || response.data.includes('React'),
            vue: response.data.includes('data-v-') || response.data.includes('Vue'),
            angular: response.data.includes('ng-app') || response.data.includes('Angular'),
            componentFramework: response.data.includes('data-cid') || response.data.includes('AppRegistry')
          },
          contentSample: response.data.substring(0, 1000)
        };
      } catch (error) {
        traditionalResult = {
          success: false,
          error: (error as Error).message
        };
      }
      
      // Browser scraping
      try {
        console.log('Testing browser scraping...');
        const scrapedData = await browserScraper.scrapeUrl(url);
        
        browserResult = {
          success: true,
          title: scrapedData.title,
          contentLength: scrapedData.contentLength,
          renderedHtmlLength: scrapedData.contentLength,
          hasJavaScript: true,
          loadTime: 0,
          contentSample: scrapedData.content.substring(0, 1000),
          structuredContentSample: scrapedData.content.substring(0, 1000)
        };
        
        // If article number is provided, check if it's found
        if (articleNumber) {
          (browserResult as any).containsArticleNumber = scrapedData.content.toLowerCase().includes(articleNumber.toLowerCase());
        }
        
      } catch (error) {
        browserResult = {
          success: false,
          error: (error as Error).message
        };
      }
      
      res.json({
        url,
        articleNumber: articleNumber || 'Not provided',
        productName: productName || 'Not provided',
        traditionalScraping: traditionalResult,
        browserScraping: browserResult,
        recommendation: browserResult?.success ? 
          (traditionalResult?.hasJavaScriptFrameworks?.componentFramework ? 
            'Browser scraping recommended due to JavaScript framework detection' : 
            'Both methods work, but browser scraping provides more complete content') :
          'Traditional scraping only'
      });
      
    } catch (error) {
      console.error("Error in browser scraping test:", error);
      res.status(500).json({ 
        error: "Failed to test browser scraping",
        message: (error as Error).message 
      });
    }
  });

  // PDF text extraction route with enhanced table and structured data extraction
  app.post("/api/pdf/extract-text", upload.single('pdf'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      // Extract text from PDF using pdfExtractor utility
      const { extractPdfTextFromBuffer } = await import('./utils/pdfExtractor');
      const pdfData = await extractPdfTextFromBuffer(req.file.buffer);
      
      res.json({
        text: pdfData.text,
        pages: pdfData.numpages,
        info: pdfData.info
      });
    } catch (error) {
      console.error("PDF text extraction error:", error);
      res.status(500).json({
        error: "Failed to extract text from PDF",
        message: (error as Error).message
      });
    }
  });
      

  // Web content scraping route for PDF batch processing
  app.post("/api/search/web-content", async (req: Request, res: Response) => {
    try {
      const { url, articleNumber } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      console.log(`[WEB-CONTENT] Scraping web content from: ${url}`);
      
      try {
        // Use the same successful extraction method as URL tab
        const { jsContentExtractor } = await import('./services/jsContentExtractor');
        const jsResult = await jsContentExtractor.extractContent(url, articleNumber);
        
        if (jsResult.success && jsResult.content) {
          console.log(`[WEB-CONTENT] Successfully scraped ${jsResult.contentLength} characters from ${url} using method: ${jsResult.method}`);
          console.log(`[WEB-CONTENT] JavaScript framework detected: ${jsResult.hasJavaScriptFramework ? 'Yes' : 'No'}`);
          
          // Log a sample of the content for debugging
          const contentSample = jsResult.content.substring(0, 500).replace(/\s+/g, ' ');
          console.log(`[WEB-CONTENT] Content sample: ${contentSample}...`);
          
          return res.json({
            success: true,
            content: jsResult.content,
            method: jsResult.method,
            contentLength: jsResult.contentLength,
            hasJavaScriptFramework: jsResult.hasJavaScriptFramework
          });
        } else {
          const errorMessage = (jsResult as any).error || jsResult.content || 'Failed to scrape content - site may require special handling';
          console.warn(`[WEB-CONTENT] Web scraping failed for ${url}: ${errorMessage}`);
          console.warn(`[WEB-CONTENT] Framework detected: ${jsResult.hasJavaScriptFramework}, Method: ${jsResult.method}`);
          
          return res.json({
            success: false,
            content: '',
            error: errorMessage,
            method: jsResult.method,
            hasJavaScriptFramework: jsResult.hasJavaScriptFramework
          });
        }
      } catch (scrapeError) {
        console.error(`[WEB-CONTENT] Web scraping error for ${url}:`, scrapeError);
        return res.json({
          success: false,
          content: '',
          error: (scrapeError as Error).message
        });
      }
    } catch (error) {
      console.error('[WEB-CONTENT] Web content scraping error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during web scraping'
      });
    }
  });

  // Test browser scraping endpoint
  app.get("/api/test-browser-scraping", async (req: Request, res: Response) => {
    const testUrl = 'https://www.lotusstoves.com/de/produkte/alle-kaminofen/orbis/orbis-1-';
    
    console.log(`[TEST] Testing browser scraping for: ${testUrl}`);
    
    try {
      // First test with simple browser scraper
      const { simpleBrowserScraper } = await import('./services/simpleBrowserScraper');
      const simpleResult = await simpleBrowserScraper.scrapeUrl(testUrl);
      
      console.log(`[TEST] Simple browser result:`, {
        success: simpleResult.success,
        contentLength: simpleResult.content.length,
        error: simpleResult.error
      });
      
      if (simpleResult.success && simpleResult.content.length > 1000) {
        // If simple scraping works, the issue is in complex evaluation
        res.json({
          success: true,
          method: 'simple-browser',
          contentLength: simpleResult.content.length,
          contentPreview: simpleResult.content.substring(0, 500),
          message: 'Simple browser scraping works! Issue is in complex evaluation.'
        });
      } else {
        // Try the original jsContentExtractor
        const { jsContentExtractor } = await import('./services/jsContentExtractor');
        const result = await jsContentExtractor.extractContent(testUrl, 'TEST-123');
        
        res.json({
          success: result.success,
          method: result.method,
          contentLength: result.contentLength,
          hasJavaScriptFramework: result.hasJavaScriptFramework,
          contentPreview: result.content.substring(0, 500),
          error: (result as any).error,
          simpleScraperResult: {
            success: simpleResult.success,
            contentLength: simpleResult.content.length,
            error: simpleResult.error
          }
        });
      }
    } catch (error) {
      console.error('[TEST] Test failed:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // DEBUG endpoint to test multi-source extraction
  app.get("/api/test-multi-source", async (req: Request, res: Response) => {
    console.log("\n🔍 DEBUG TEST: Testing multi-source extraction pipeline");
    
    try {
      // Use a real product that should return results
      const testSearchData = {
        articleNumber: "Extraflame Souvenir Lux",
        productName: "Extraflame Souvenir Lux pelletofen",
        searchEngine: "google",
        maxResults: 5,
        useValueSerp: true,
        valueSerpApiKey: process.env.VALUESERP_API_KEY,
        useAI: true,
        aiModelProvider: "openai"
      };
      
      console.log("📊 Test search parameters:", testSearchData);
      
      // Array to collect the HTML content
      const scrapedContentArray: Array<{content: string, url: string, title: string}> = [];
      
      // Simulate the search and scraping process
      console.log("Starting search with collectRawContentFromSearchResults...");
      
      const searchResult = await searchService.collectRawContentFromSearchResults(
        testSearchData.articleNumber,
        testSearchData.productName,
        testSearchData.searchEngine as any,
        scrapedContentArray,
        testSearchData.maxResults,
        false // PDF scraper not used in test endpoint
      );
      
      console.log(`\n📊 TEST RESULTS:`);
      console.log(`  Search completed: ${searchResult ? 'YES' : 'NO'}`);
      console.log(`  Content array size: ${scrapedContentArray.length}`);
      console.log(`  Sources collected:`, scrapedContentArray.map(item => ({
        url: item.url,
        contentLength: item.content.length
      })));
      
      // Test AI processing if we have content
      let aiResult = null;
      if (scrapedContentArray.length > 0 && testSearchData.useAI) {
        console.log(`\n🤖 Testing AI processing with ${scrapedContentArray.length} sources...`);
        
        try {
          // Get properties for AI
          const properties = await storage.getProperties();
          const aiProperties = properties.map(prop => ({
            name: prop.name,
            description: prop.description || undefined,
            expectedFormat: prop.expectedFormat || undefined
          }));
          
          // Test AI extraction - test endpoint uses default model
          const extractedProperties = await openaiService.extractTechnicalSpecificationsWithConsistency(
            scrapedContentArray,
            testSearchData.articleNumber,
            testSearchData.productName,
            aiProperties,
            undefined, // No userId for test endpoint
            "gpt-4.1" // Use default model for test endpoint
          );
          
          console.log(`\n✅ AI Processing Complete:`);
          console.log(`  Properties extracted: ${Object.keys(extractedProperties).length}`);
          console.log(`  Sample properties:`, Object.entries(extractedProperties).slice(0, 3).map(([key, prop]) => ({
            name: key,
            value: prop.value?.substring(0, 50) + (prop.value?.length > 50 ? '...' : ''),
            confidence: prop.confidence,
            sources: prop.sources?.length || 0
          })));
          
          aiResult = {
            propertiesExtracted: Object.keys(extractedProperties).length,
            sampleProperties: Object.entries(extractedProperties).slice(0, 5)
          };
        } catch (aiError) {
          console.error('AI processing failed:', aiError);
          aiResult = { error: (aiError as Error).message };
        }
      }
      
      res.json({
        success: true,
        test: "multi-source extraction",
        resultsCollected: scrapedContentArray.length,
        sources: scrapedContentArray.map(item => ({
          url: item.url,
          title: item.title,
          contentLength: item.content.length
        })),
        aiProcessing: aiResult
      });
      
    } catch (error) {
      console.error("Test failed:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // PDF AI data extraction route
  app.post("/api/search/pdf-extract", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Extract userId from authenticated request
      const userId = req.user?.id || null;
      console.log(`[PDF-EXTRACT] Processing request for user ${userId || 'anonymous'}`);
      
      const requestData = searchRequestSchema.parse(req.body);
      const { 
        articleNumber, 
        productName, 
        pdfText, 
        properties = [], 
        useAI = false,
        modelProvider = 'openai'
      } = requestData;

      if (!pdfText) {
        return res.status(400).json({ error: 'PDF text is required' });
      }

      // Debug: Log PDF text content to see what's being extracted
      console.log("=== PDF TEXT CONTENT ANALYSIS ===");
      console.log(`PDF text length: ${pdfText.length} characters`);
      console.log("PDF text preview (first 1000 chars):");
      console.log(pdfText.substring(0, 1000));
      console.log("PDF text preview (last 1000 chars):");
      console.log(pdfText.substring(Math.max(0, pdfText.length - 1000)));
      
      // Look for technical specifications sections
      const techSpecPatterns = [
        /technisch[e]?\s*daten/gi,
        /specification[s]?/gi,
        /eigenschaften/gi,
        /abmessungen/gi,
        /dimensions/gi,
        /gewicht/gi,
        /weight/gi,
        /masse/gi,
        /peso/gi
      ];
      
      techSpecPatterns.forEach(pattern => {
        const matches = pdfText.match(pattern);
        if (matches) {
          console.log(`Found ${pattern.source} matches:`, matches);
          // Find surrounding context
          const index = pdfText.search(pattern);
          if (index >= 0) {
            const context = pdfText.substring(Math.max(0, index - 200), Math.min(pdfText.length, index + 800));
            console.log(`Context around ${pattern.source}:`, context);
          }
        }
      });
      
      // Look for numerical patterns that might be specifications
      const numberPatterns = pdfText.match(/\d+\s*(?:mm|kg|kw|%|°c|cm|pa|mg\/m³)/gi);
      if (numberPatterns && numberPatterns.length > 0) {
        console.log("Found numerical specifications:", numberPatterns.slice(0, 10)); // Show first 10
      }
      
      // Look for enhanced structure markers from improved PDF parser
      const structuredDataSections = pdfText.split('[STRUCTURED_DATA_START]');
      if (structuredDataSections.length > 1) {
        console.log(`Found ${structuredDataSections.length - 1} structured data sections`);
        structuredDataSections.slice(1, 3).forEach((section, i) => {
          const endIndex = section.indexOf('[STRUCTURED_DATA_END]');
          const sectionContent = endIndex > 0 ? section.substring(0, endIndex) : section.substring(0, 500);
          console.log(`Structured section ${i+1}:`, sectionContent);
        });
      }
      
      // Look for table structures more broadly
      const tableLines = pdfText.split('\n').filter(line => 
        line.includes('|') || line.includes('\t') || line.match(/\s{3,}/) // Multiple spaces indicating columns
      );
      if (tableLines.length > 0) {
        console.log("Found potential table lines (first 10):");
        tableLines.slice(0, 10).forEach((line, i) => console.log(`${i+1}: ${line.trim()}`));
      }
      
      console.log("=== END PDF TEXT ANALYSIS ===");

      let extractedProperties: Record<string, any> = {};

      if (useAI) {
        // Configure AI service based on model provider
        const openaiApiKey = req.body.openaiApiKey || process.env.OPENAI_API_KEY;
        if (openaiApiKey) {
          openaiService.setApiKey(openaiApiKey);
          openaiService.setModelProvider('openai');
        } else {
          return res.status(400).json({ error: 'OpenAI API key is required' });
        }
        
        // Extract properties using AI from PDF text (enhanced for PDF structure)
        // Convert properties to the format expected by extractTechnicalSpecifications
        const aiProperties = properties.map(prop => ({
          name: prop.name,
          description: prop.description || undefined,
          expectedFormat: prop.expectedFormat || undefined
        }));
        
        // Get user's selected AI model for PDF extraction
        const pdfUserForModel = userId ? await storage.getUser(userId) : null;
        const pdfUserSelectedModel = pdfUserForModel?.selectedAiModel || "gpt-4.1-mini";
        console.log(`[PDF-EXTRACT] Using AI model: ${pdfUserSelectedModel}`);
        
        extractedProperties = await openaiService.extractTechnicalSpecifications(
          [pdfText], // Wrap PDF text in array as expected by the method
          articleNumber || '',
          productName,
          aiProperties,
          userId,
          pdfUserSelectedModel // Pass user's selected model
        );
      } else {
        // Basic extraction without AI
        extractedProperties = {
          Artikelnummer: {
            name: "Artikelnummer",
            value: articleNumber || "Not provided",
            confidence: 100,
            isConsistent: true,
            sources: [{ url: "PDF Document", title: "Uploaded PDF" }]
          },
          Produktname: {
            name: "Produktname", 
            value: productName,
            confidence: 100,
            isConsistent: true,
            sources: [{ url: "PDF Document", title: "Uploaded PDF" }]
          }
        };
      }

      // Count extracted properties for status message
      const extractedCount = Object.values(extractedProperties).filter(prop => 
        prop && typeof prop === 'object' && prop.value && prop.value.trim() !== ''
      ).length;
      
      // Create search response format
      const searchResponse: SearchResponse = {
        searchMethod: "pdf",
        searchStatus: "complete",
        statusMessage: `Successfully extracted product data from PDF - ${extractedCount} properties found`,
        products: [{
          id: `pdf-${Date.now()}`,
          articleNumber: articleNumber || '',
          productName: productName,
          properties: extractedProperties
        }]
      };

      res.json(searchResponse);
    } catch (error) {
      console.error("Error processing PDF data extraction:", error);
      res.status(500).json({ 
        error: "Failed to extract data from PDF",
        message: (error as Error).message 
      });
    }
  });

  // Initialize search service with manufacturer domains and excluded domains
  await searchService.updateManufacturerDomains(storage);
  await searchService.updateExcludedDomains(storage);

  console.log("Search service initialized with manufacturer domains and excluded domains");

  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}