import { pgTable, text, serial, integer, timestamp, jsonb, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// RBManager User Schema - Single superuser for monitoring
export const rbManager = pgTable("rb_manager", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // "RBManager"
  password: text("password").notNull(), // Hashed "SysObserve@24"
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RBManager = typeof rbManager.$inferSelect;

// User Activity Logs - Comprehensive tracking of all user actions
export const userActivityLogs = pgTable("user_activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Reference to main app user
  username: text("username").notNull(),
  activityType: text("activity_type").notNull(), // login, logout, search, api_call, error, etc.
  action: text("action").notNull(), // Detailed action description
  endpoint: text("endpoint"), // API endpoint if applicable
  method: text("method"), // HTTP method
  requestData: jsonb("request_data"), // Request parameters
  responseData: jsonb("response_data"), // Response data (sanitized)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  duration: integer("duration"), // Request duration in ms
  statusCode: integer("status_code"), // HTTP status code
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs);
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;

// Token Usage Logs - Per-user token tracking
export const tokenUsageLogs = pgTable("token_usage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  modelProvider: text("model_provider").notNull(), // openai
  modelName: text("model_name").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  inputCost: text("input_cost").notNull().default("0"),
  outputCost: text("output_cost").notNull().default("0"),
  totalCost: text("total_cost").notNull().default("0"),
  apiCallType: text("api_call_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertTokenUsageLogSchema = createInsertSchema(tokenUsageLogs);
export type InsertTokenUsageLog = z.infer<typeof insertTokenUsageLogSchema>;
export type TokenUsageLog = typeof tokenUsageLogs.$inferSelect;

// API Call Logs - Detailed API usage tracking
export const apiCallLogs = pgTable("api_call_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  headers: jsonb("headers"),
  queryParams: jsonb("query_params"),
  statusCode: integer("status_code").notNull(),
  duration: integer("duration").notNull(), // ms
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertApiCallLogSchema = createInsertSchema(apiCallLogs);
export type InsertApiCallLog = z.infer<typeof insertApiCallLogSchema>;
export type ApiCallLog = typeof apiCallLogs.$inferSelect;

// Error Logs - System and user errors
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // Nullable for system errors
  username: text("username"),
  errorType: text("error_type").notNull(), // validation, runtime, database, network, etc.
  errorMessage: text("error_message").notNull(),
  errorStack: text("error_stack"),
  endpoint: text("endpoint"),
  method: text("method"),
  requestData: jsonb("request_data"),
  severity: text("severity").notNull().default("error"), // info, warning, error, critical
  resolved: boolean("resolved").default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs);
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;

// User Sessions - Track active and historical sessions
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  sessionId: text("session_id").notNull(),
  loginTime: timestamp("login_time").notNull(),
  logoutTime: timestamp("logout_time"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  duration: integer("duration"), // Session duration in seconds
});

export const insertUserSessionSchema = createInsertSchema(userSessions);
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// User Statistics - Aggregated stats per user
export const userStatistics = pgTable("user_statistics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  username: text("username").notNull(),
  totalApiCalls: integer("total_api_calls").default(0),
  totalTokensUsed: bigint("total_tokens_used", { mode: "number" }).default(0),
  totalCost: text("total_cost").default("0"),
  totalErrors: integer("total_errors").default(0),
  totalSessions: integer("total_sessions").default(0),
  lastActivity: timestamp("last_activity"),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertUserStatisticsSchema = createInsertSchema(userStatistics);
export type InsertUserStatistics = z.infer<typeof insertUserStatisticsSchema>;
export type UserStatistics = typeof userStatistics.$inferSelect;

// System Metrics - Overall system health and performance
export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey(),
  metricType: text("metric_type").notNull(), // cpu, memory, api_response_time, etc.
  metricValue: text("metric_value").notNull(),
  unit: text("unit"), // percent, mb, ms, etc.
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertSystemMetricSchema = createInsertSchema(systemMetrics);
export type InsertSystemMetric = z.infer<typeof insertSystemMetricSchema>;
export type SystemMetric = typeof systemMetrics.$inferSelect;

// Console/Terminal Output Logs - Per-user terminal output tracking
export const consoleLogs = pgTable("console_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // Nullable for system-level logs
  username: text("username"),
  logLevel: text("log_level").notNull().default("info"), // debug, info, warn, error, fatal
  category: text("category").notNull().default("general"), // general, api, database, auth, search, scraping, ai, pdf, etc.
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional context data (JSON)
  stackTrace: text("stack_trace"), // For errors
  source: text("source"), // File/function where log originated
  requestId: text("request_id"), // For correlating logs with specific requests
  sessionId: text("session_id"), // Session identifier
  duration: integer("duration"), // For tracking operation durations (ms)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertConsoleLogSchema = createInsertSchema(consoleLogs);
export type InsertConsoleLog = z.infer<typeof insertConsoleLogSchema>;
export type ConsoleLog = typeof consoleLogs.$inferSelect;

// System Health Status - For health check tracking
export const systemHealth = pgTable("system_health", {
  id: serial("id").primaryKey(),
  component: text("component").notNull(), // api, database, monitoring, scraper, ai, etc.
  status: text("status").notNull(), // healthy, degraded, unhealthy, unknown
  message: text("message"),
  responseTime: integer("response_time"), // ms
  details: jsonb("details"), // Additional health details
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const insertSystemHealthSchema = createInsertSchema(systemHealth);
export type InsertSystemHealth = z.infer<typeof insertSystemHealthSchema>;
export type SystemHealth = typeof systemHealth.$inferSelect;

// Login schema for RBManager
export const loginSchema = z.object({
  username: z.string().min(1, "Bitte Benutzername eingeben."),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Dashboard stats schema
export const dashboardStatsSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  totalApiCalls: z.number(),
  totalTokens: z.number(),
  totalCost: z.string(),
  totalErrors: z.number(),
  todayStats: z.object({
    apiCalls: z.number(),
    tokens: z.number(),
    cost: z.string(),
    errors: z.number(),
  }),
  recentActivity: z.array(z.object({
    id: z.number(),
    username: z.string(),
    activityType: z.string(),
    action: z.string(),
    timestamp: z.string(),
  })),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// User Management schemas for RBManager

// Helper function to transform empty strings to undefined (for z.preprocess)
const emptyStringToUndefined = (val: unknown): string | undefined => {
  if (val === undefined || val === null) {
    return undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return undefined;
};

export const createUserSchema = z.object({
  username: z.string()
    .min(1, "Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, dots, and hyphens"),
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email address format")
    .max(255, "Email must be at most 255 characters"),
  password: z.string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be at most 128 characters"),
  role: z.enum(["admin", "user", "guest"], {
    errorMap: () => ({ message: "Role must be one of: admin, user, guest" })
  }).default("user"),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  username: z.preprocess(
    emptyStringToUndefined,
    z.string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters")
      .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, dots, and hyphens")
      .optional()
  ),
  email: z.preprocess(
    emptyStringToUndefined,
    z.string()
      .email("Invalid email address format")
      .max(255, "Email must be at most 255 characters")
      .optional()
  ),
  password: z.preprocess(
    emptyStringToUndefined,
    z.string()
      .min(6, "Password must be at least 6 characters")
      .max(128, "Password must be at most 128 characters")
      .optional()
  ),
  role: z.enum(["admin", "user", "guest"], {
    errorMap: () => ({ message: "Role must be one of: admin, user, guest" })
  }).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    // At least one field must be provided for update
    return data.username !== undefined ||
           data.email !== undefined ||
           data.password !== undefined ||
           data.role !== undefined ||
           data.isActive !== undefined;
  },
  {
    message: "At least one field must be provided for update",
    path: ["_form"]
  }
);

export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;

// Helper function to format Zod errors into user-friendly messages
export function formatZodErrors(errors: z.ZodError): { field: string; message: string }[] {
  return errors.errors.map((err) => ({
    field: err.path.join('.') || '_form',
    message: err.message,
  }));
}

// Generate a single error message from Zod errors
export function formatZodErrorMessage(errors: z.ZodError): string {
  return errors.errors.map((err) => {
    const field = err.path.join('.') || 'Form';
    return `${field}: ${err.message}`;
  }).join('; ');
}