import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced User schema with role-based access control
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Will store hashed passwords
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"), // "admin", "user", or "guest"
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  lockedUntil: timestamp("locked_until"),
  lastLogin: timestamp("last_login"),
  selectedAiModel: text("selected_ai_model").default("gpt-4.1-mini"), // User's preferred AI model: "gpt-4.1" or "gpt-4.1-mini" (default: gpt-4.1-mini for cost efficiency)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  verificationToken: true,
  verificationTokenExpiry: true,
  resetToken: true,
  resetTokenExpiry: true,
});

export const updateUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  verificationToken: true,
  verificationTokenExpiry: true,
  resetToken: true,
  resetTokenExpiry: true,
  selectedAiModel: true,
}).partial();

export const loginSchema = z.object({
  username: z.string().min(1, "Bitte Benutzername oder E-Mail eingeben."),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;

// Session schema for secure session management
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivity: timestamp("last_activity").defaultNow(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Session = typeof sessions.$inferSelect;

// Property Table schema - different product types like "Kamin", "Gril", etc.
// Each user can have up to 25 property tables
export const propertyTables = pgTable("property_tables", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPropertyTableSchema = createInsertSchema(propertyTables).pick({
  userId: true,
  name: true,
  description: true,
  isDefault: true,
});

export type InsertPropertyTable = z.infer<typeof insertPropertyTableSchema>;
export type PropertyTable = typeof propertyTables.$inferSelect;

// Product Property schema - now linked to a property table
export const productProperties = pgTable("product_properties", {
  id: serial("id").primaryKey(),
  propertyTableId: integer("property_table_id").references(() => propertyTables.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  expectedFormat: text("expected_format"),
  orderIndex: integer("order_index").default(0),
  isRequired: boolean("is_required").default(false),
});

export const insertProductPropertySchema = createInsertSchema(productProperties).pick({
  name: true,
  description: true,
  expectedFormat: true,
  orderIndex: true,
  isRequired: true,
});

export type InsertProductProperty = z.infer<typeof insertProductPropertySchema>;
export type ProductProperty = typeof productProperties.$inferSelect;

// Search Result schema
export const searchResults = pgTable("search_results", {
  id: serial("id").primaryKey(),
  articleNumber: text("article_number").notNull(),
  productName: text("product_name").notNull(),
  searchMethod: text("search_method").notNull(),
  properties: jsonb("properties").notNull(), // { propertyName: { value, sources, confidence } }
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSearchResultSchema = createInsertSchema(searchResults).pick({
  articleNumber: true,
  productName: true,
  searchMethod: true,
  properties: true,
});

export type InsertSearchResult = z.infer<typeof insertSearchResultSchema>;
export type SearchResult = typeof searchResults.$inferSelect;

// Search Request schema for API
export const searchRequestSchema = z.object({
  articleNumber: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  productName: z.string().min(1, "Product name is required"),
  searchMethod: z.enum(["auto", "url", "pdf"]),
  searchEngine: z.enum(["google"]).optional(),
  productUrl: z.string().url().optional(),
  pdfText: z.string().optional(), // For PDF processing
  sources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
    sourceLabel: z.string().optional(),
  })).optional(), // Original search sources to use instead of performing new search
  useAI: z.boolean().optional(),
  aiModelProvider: z.enum(["openai"]).optional(),
  modelProvider: z.enum(["openai"]).optional(), // Alternative field name
  openaiApiKey: z.string().optional(),
  useValueSerp: z.boolean().optional(), // Whether to use ValueSERP API
  valueSerpApiKey: z.string().optional(), // ValueSERP API key
  valueSerpLocation: z.enum(["us", "de", "eu"]).optional(), // ValueSERP search location (US, Germany, Europe)
  minConsistentSources: z.number().min(1).max(5).optional(), // Minimum Anzahl der konsistenten Quellen
  maxResults: z.number().min(1).max(12).optional(), // Maximum number of search results to display
  pdfScraperEnabled: z.boolean().optional(), // Enable PDF scraping for URLs that point to PDFs
  domainPrioritizationEnabled: z.boolean().optional(), // Enable domain prioritization
  properties: z.array(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1, "Property name is required"),
      description: z.string().optional(),
      expectedFormat: z.string().optional(),
      type: z.string().optional(), // Add type field for compatibility
    })
  )
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const rawContentSchema = z.object({
  sourceLabel: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string(),
  contentLength: z.number().optional(),
});

export type RawContentEntry = z.infer<typeof rawContentSchema>;

// Property Result type for frontend
export const propertyResultSchema = z.object({
  name: z.string(),
  value: z.string(),
  sources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
    sourceLabel: z.string().optional(), // E.g., "Source 1", "Source 2"
  })),
  confidence: z.number().min(0).max(100),
  isConsistent: z.boolean().optional(),
  consistencyCount: z.number().optional(), // Number of sources that contain this value
  sourceCount: z.number().optional(), // Total number of sources analyzed
});

export type PropertyResult = z.infer<typeof propertyResultSchema>;

// Product Result type for frontend
export const productResultSchema = z.object({
  id: z.string(), // Unique ID for each product result
  articleNumber: z.string().optional(), // Make articleNumber optional to match SearchRequest
  productName: z.string(),
  properties: z.record(z.string(), propertyResultSchema),
  rawContent: z.array(rawContentSchema).optional(),
});

export type ProductResult = z.infer<typeof productResultSchema>;

// Search Response type for frontend
export const searchResponseSchema = z.object({
  id: z.number().optional(), // Add database ID for reference
  searchMethod: z.union([z.enum(["auto", "url"]), z.string()]),
  products: z.array(productResultSchema),
  minConsistentSources: z.number().min(1).max(5).optional(),
  searchStatus: z.enum(['initializing', 'searching', 'analyzing', 'complete']).optional(),
  statusMessage: z.string().optional(),
  createdAt: z.string().or(z.date()).optional(), // Add timestamp for sorting
  rawContent: z.array(rawContentSchema).optional(),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Export Options schema
export const exportOptionsSchema = z.object({
  format: z.enum(["xlsx", "csv"]),
  includeProductData: z.boolean(),
  includeSourceUrls: z.boolean(),
  includeConfidenceScores: z.boolean(),
  filename: z.string(),
});

export type ExportOptions = z.infer<typeof exportOptionsSchema>;

// Manufacturer Domains schema
// App Settings schema
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  openaiApiKey: text("openai_api_key"),
  valueSerpApiKey: text("valueserp_api_key"),
  valueSerpLocation: text("valueserp_location").default("us"),
  defaultAiModel: text("default_ai_model").default("openai"),
  defaultSearchMethod: text("default_search_method").default("google"),
  useValueSerp: boolean("use_valueserp").default(true),
  useAi: boolean("use_ai").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).pick({
  openaiApiKey: true,
  valueSerpApiKey: true,
  valueSerpLocation: true,
  defaultAiModel: true,
  defaultSearchMethod: true,
  useValueSerp: true,
  useAi: true,
});

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

// Token Usage Tracking schema
export const tokenUsage = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  apiCallId: text("api_call_id"), // Unique identifier for each API call (e.g., "api_1733234567890_a1b2c3d4")
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // User who made the API call
  modelProvider: text("model_provider").notNull(), // "openai"
  modelName: text("model_name").notNull(), // "gpt-4.1", "gpt-4.1-mini"
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  inputCost: text("input_cost").notNull().default("0"), // Cost in USD for input tokens (stored as text for precision)
  outputCost: text("output_cost").notNull().default("0"), // Cost in USD for output tokens (stored as text for precision)
  totalCost: text("total_cost").notNull().default("0"), // Total cost in USD (stored as text for precision)
  apiCallType: text("api_call_type").notNull(), // "search", "analyze", "extract", "url-manual", etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTokenUsageSchema = createInsertSchema(tokenUsage).pick({
  apiCallId: true,
  userId: true,
  modelProvider: true,
  modelName: true,
  inputTokens: true,
  outputTokens: true,
  totalTokens: true,
  inputCost: true,
  outputCost: true,
  totalCost: true,
  apiCallType: true,
});

export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsage = typeof tokenUsage.$inferSelect;

// Token Usage Stats type for dashboard
export const tokenUsageStatsSchema = z.object({
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  totalCalls: z.number(),
  costEstimate: z.number(),
  todayUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    calls: z.number(),
  }),
  weeklyUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    calls: z.number(),
  }),
  monthlyUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    calls: z.number(),
  }),
  recentCalls: z.array(z.object({
    id: z.number(),
    apiCallId: z.string().optional(),
    modelName: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    inputCost: z.string().optional(),
    outputCost: z.string().optional(),
    totalCost: z.string().optional(),
    apiCallType: z.string(),
    createdAt: z.string(),
  })),
});

export type TokenUsageStats = z.infer<typeof tokenUsageStatsSchema>;

// Manufacturer Domains schema - for prioritizing specific domains in search results
export const manufacturerDomains = pgTable("manufacturer_domains", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Manufacturer name (e.g., "Aduro Fire")
  websiteUrl: text("website_url").notNull(), // Full URL (e.g., "https://www.adurofire.de")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertManufacturerDomainSchema = createInsertSchema(manufacturerDomains).pick({
  userId: true,
  name: true,
  websiteUrl: true,
  isActive: true,
});

export type InsertManufacturerDomain = z.infer<typeof insertManufacturerDomainSchema>;
export type ManufacturerDomain = typeof manufacturerDomains.$inferSelect;

// Excluded Domains schema - for blocking specific domains from search results
export const excludedDomains = pgTable("excluded_domains", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(), // Domain to exclude (e.g., "youtube.com")
  reason: text("reason"), // Optional reason for exclusion
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExcludedDomainSchema = createInsertSchema(excludedDomains).pick({
  userId: true,
  domain: true,
  reason: true,
  isActive: true,
});

export type InsertExcludedDomain = z.infer<typeof insertExcludedDomainSchema>;
export type ExcludedDomain = typeof excludedDomains.$inferSelect;
