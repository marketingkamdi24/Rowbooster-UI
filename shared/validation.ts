/**
 * Comprehensive Data Validation Schemas
 * 
 * This file contains all Zod validation schemas for input validation
 * on both client and server side.
 */

import { z } from "zod";

// ===========================================
// COMMON VALIDATION PATTERNS
// ===========================================

/**
 * Email validation with proper format checking
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .max(255, "Email must be less than 255 characters")
  .trim()
  .toLowerCase();

/**
 * Password validation with strength requirements
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be less than 128 characters");

/**
 * Strong password validation for registration
 */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Username validation
 */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be less than 50 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
  .trim();

/**
 * Safe string input (prevents XSS)
 */
export const safeStringSchema = z
  .string()
  .max(10000, "Input too long")
  .transform(val => val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''))
  .transform(val => val.replace(/javascript:/gi, ''));

/**
 * URL validation
 */
export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .max(2048, "URL must be less than 2048 characters");

/**
 * Optional URL validation
 */
export const optionalUrlSchema = z
  .string()
  .url("Invalid URL format")
  .max(2048, "URL must be less than 2048 characters")
  .optional()
  .or(z.literal(''));

/**
 * ID parameter validation
 */
export const idParamSchema = z.coerce
  .number()
  .int("ID must be an integer")
  .positive("ID must be positive");

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ===========================================
// USER VALIDATION SCHEMAS
// ===========================================

/**
 * Login credentials validation
 */
export const loginCredentialsSchema = z.object({
  username: z.string().min(1, "Bitte Benutzername oder E-Mail eingeben.").max(255),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

/**
 * User registration validation
 */
export const userRegistrationSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * User update validation (admin)
 */
export const userUpdateSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

/**
 * Change password validation
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

/**
 * Password reset request validation
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset confirmation validation
 */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// ===========================================
// PROPERTY TABLE VALIDATION SCHEMAS
// ===========================================

/**
 * Property table name validation
 */
export const propertyTableNameSchema = z
  .string()
  .min(1, "Property table name is required")
  .max(100, "Property table name must be less than 100 characters")
  .trim();

/**
 * Property table creation validation
 */
export const createPropertyTableSchema = z.object({
  name: propertyTableNameSchema,
  description: z.string().max(500, "Description must be less than 500 characters").optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Property table update validation
 */
export const updatePropertyTableSchema = z.object({
  name: propertyTableNameSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
});

// ===========================================
// PRODUCT PROPERTY VALIDATION SCHEMAS
// ===========================================

/**
 * Product property name validation
 */
export const propertyNameSchema = z
  .string()
  .min(1, "Property name is required")
  .max(100, "Property name must be less than 100 characters")
  .trim();

/**
 * Product property creation validation
 */
export const createProductPropertySchema = z.object({
  name: propertyNameSchema,
  description: z.string().max(500).optional().nullable(),
  expectedFormat: z.string().max(200).optional().nullable(),
  orderIndex: z.number().int().min(0).max(1000).optional().default(0),
  isRequired: z.boolean().optional().default(false),
  propertyTableId: z.number().int().positive().optional(),
});

/**
 * Product property update validation
 */
export const updateProductPropertySchema = createProductPropertySchema.partial();

/**
 * Bulk property import validation
 */
export const bulkPropertyImportSchema = z.object({
  properties: z.array(z.object({
    name: propertyNameSchema,
    description: z.string().max(500).optional().nullable(),
    expectedFormat: z.string().max(200).optional().nullable(),
    order: z.number().int().min(0).max(1000).optional(),
  })).min(1, "At least one property is required").max(100, "Maximum 100 properties per import"),
  propertyTableId: z.number().int().positive().optional(),
});

// ===========================================
// SEARCH VALIDATION SCHEMAS
// ===========================================

/**
 * Search method validation
 */
export const searchMethodSchema = z.enum(['auto', 'url', 'pdf'], {
  errorMap: () => ({ message: "Invalid search method" }),
});

/**
 * Search engine validation
 */
export const searchEngineSchema = z.enum(['google'], {
  errorMap: () => ({ message: "Invalid search engine" }),
});

/**
 * AI model provider validation
 */
export const aiModelProviderSchema = z.enum(['openai'], {
  errorMap: () => ({ message: "Invalid AI model provider" }),
});

/**
 * ValueSERP location validation
 */
export const valueSerpLocationSchema = z.enum(['us', 'de', 'eu', 'all', 'multi'], {
  errorMap: () => ({ message: "Invalid ValueSERP location" }),
});

/**
 * Search request validation
 */
export const searchRequestSchema = z.object({
  articleNumber: z.union([z.string(), z.number()])
    .transform(val => String(val))
    .optional(),
  productName: z.string().min(1, "Product name is required").max(500, "Product name too long"),
  searchMethod: searchMethodSchema,
  searchEngine: searchEngineSchema.optional(),
  productUrl: urlSchema.optional(),
  pdfText: z.string().max(5000000).optional(), // 5MB max for PDF text
  sources: z.array(z.object({
    url: z.string(),
    title: z.string().optional(),
    sourceLabel: z.string().optional(),
  })).optional(),
  useAI: z.boolean().optional(),
  aiModelProvider: aiModelProviderSchema.optional(),
  modelProvider: aiModelProviderSchema.optional(),
  openaiApiKey: z.string().optional(),
  useValueSerp: z.boolean().optional(),
  valueSerpApiKey: z.string().optional(),
  valueSerpLocation: valueSerpLocationSchema.optional(),
  minConsistentSources: z.number().int().min(1).max(5).optional(),
  maxResults: z.number().int().min(1).max(12).optional(),
  pdfScraperEnabled: z.boolean().optional(),
  domainPrioritizationEnabled: z.boolean().optional(),
  properties: z.array(z.object({
    id: z.number().optional(),
    name: z.string().min(1, "Property name is required"),
    description: z.string().optional(),
    expectedFormat: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
});

/**
 * Batch search request validation
 */
export const batchSearchRequestSchema = z.object({
  products: z.array(z.object({
    articleNumber: z.string().optional(),
    productName: z.string().min(1),
    searchMethod: searchMethodSchema,
    productUrl: urlSchema.optional(),
  })).min(1, "At least one product required").max(50, "Maximum 50 products per batch"),
  searchEngine: searchEngineSchema.optional(),
  useAI: z.boolean().optional(),
  aiModelProvider: aiModelProviderSchema.optional(),
  openaiApiKey: z.string().optional(),
  useValueSerp: z.boolean().optional(),
  valueSerpApiKey: z.string().optional(),
  maxResults: z.number().int().min(1).max(12).optional(),
  pdfScraperEnabled: z.boolean().optional(),
  tableId: z.number().int().positive().optional(),
});

// ===========================================
// DOMAIN VALIDATION SCHEMAS
// ===========================================

/**
 * Domain name validation
 */
export const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .max(255, "Domain must be less than 255 characters")
  .transform(val => val.toLowerCase().replace(/^www\./, '').trim());

/**
 * Manufacturer domain creation validation
 */
export const createManufacturerDomainSchema = z.object({
  name: z.string().min(1, "Manufacturer name is required").max(100),
  websiteUrl: urlSchema,
  isActive: z.boolean().optional().default(true),
});

/**
 * Manufacturer domain update validation
 */
export const updateManufacturerDomainSchema = createManufacturerDomainSchema.partial();

/**
 * Excluded domain creation validation
 */
export const createExcludedDomainSchema = z.object({
  domain: domainSchema,
  reason: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Excluded domain update validation
 */
export const updateExcludedDomainSchema = createExcludedDomainSchema.partial();

// ===========================================
// EXPORT OPTIONS VALIDATION
// ===========================================

/**
 * Export format validation
 */
export const exportFormatSchema = z.enum(['xlsx', 'csv'], {
  errorMap: () => ({ message: "Invalid export format" }),
});

/**
 * Export options validation
 */
export const exportOptionsSchema = z.object({
  format: exportFormatSchema,
  includeProductData: z.boolean().optional().default(true),
  includeSourceUrls: z.boolean().optional().default(true),
  includeConfidenceScores: z.boolean().optional().default(true),
  filename: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, "Filename can only contain letters, numbers, underscores, and hyphens"),
});

// ===========================================
// APP SETTINGS VALIDATION
// ===========================================

/**
 * App settings validation
 */
export const appSettingsSchema = z.object({
  openaiApiKey: z.string().max(200).optional().nullable(),
  valueSerpApiKey: z.string().max(200).optional().nullable(),
  valueSerpLocation: valueSerpLocationSchema.optional(),
  defaultAiModel: z.string().max(50).optional(),
  defaultSearchMethod: z.string().max(50).optional(),
  useValueSerp: z.boolean().optional(),
  useAi: z.boolean().optional(),
});

// ===========================================
// VALIDATION HELPER FUNCTIONS
// ===========================================

/**
 * Validate data against a schema, returning formatted errors
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
  
  return { success: false, errors };
}

/**
 * Create a validation middleware for Express routes
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: any, res: any, next: any) => {
    const dataToValidate = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = validateData(schema, dataToValidate);
    
    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.errors,
      });
    }
    
    // Replace with validated and transformed data
    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'query') {
      req.query = result.data;
    } else {
      req.params = result.data;
    }
    
    next();
  };
}

/**
 * Sanitize HTML input to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return sanitizeHtml(input.trim().substring(0, maxLength));
}

// ===========================================
// TYPE EXPORTS
// ===========================================

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
export type CreatePropertyTable = z.infer<typeof createPropertyTableSchema>;
export type UpdatePropertyTable = z.infer<typeof updatePropertyTableSchema>;
export type CreateProductProperty = z.infer<typeof createProductPropertySchema>;
export type UpdateProductProperty = z.infer<typeof updateProductPropertySchema>;
export type BulkPropertyImport = z.infer<typeof bulkPropertyImportSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type BatchSearchRequest = z.infer<typeof batchSearchRequestSchema>;
export type CreateManufacturerDomain = z.infer<typeof createManufacturerDomainSchema>;
export type UpdateManufacturerDomain = z.infer<typeof updateManufacturerDomainSchema>;
export type CreateExcludedDomain = z.infer<typeof createExcludedDomainSchema>;
export type UpdateExcludedDomain = z.infer<typeof updateExcludedDomainSchema>;
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type Pagination = z.infer<typeof paginationSchema>;