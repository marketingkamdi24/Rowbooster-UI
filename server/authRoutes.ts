import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";
import { emailService } from "./services/emailService";
import { initializeDefaultKaminProperties } from "./init-default-properties";
import {
  authenticateUser,
  generateSessionId,
  requireAuth,
  AuthenticatedRequest
} from "./auth";
import { z } from "zod";
import { secureLog } from "./utils/secureLogger";
import { getClientIp } from "./middleware/security";

const router = Router();

// Rate limiting for password reset requests (prevent enumeration attacks)
const resetRequestLimits = new Map<string, { count: number; lastRequest: number }>();
const RESET_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_REQUESTS = 3;

function checkResetRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = resetRequestLimits.get(ip);
  
  if (!entry || now - entry.lastRequest > RESET_LIMIT_WINDOW) {
    resetRequestLimits.set(ip, { count: 1, lastRequest: now });
    return true;
  }
  
  if (entry.count >= MAX_RESET_REQUESTS) {
    return false;
  }
  
  entry.count++;
  entry.lastRequest = now;
  return true;
}

// Timing-safe token comparison to prevent timing attacks
function timingSafeTokenCompare(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(b.padEnd(32, '0')), Buffer.from(b.padEnd(32, '1')));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Registration schema with enhanced validation
const registerSchema = z.object({
  username: z.string()
    .min(3, "Benutzername muss mindestens 3 Zeichen lang sein")
    .max(30, "Benutzername darf maximal 30 Zeichen lang sein")
    .regex(/^[a-zA-Z0-9_-]+$/, "Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten"),
  email: z.string()
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse ist zu lang")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Ungültiges E-Mail-Format"),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128, "Passwort ist zu lang")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten")
    .regex(/[^A-Za-z0-9]/, "Passwort muss mindestens ein Sonderzeichen enthalten"),
});

// Password reset request schema
const resetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Password reset schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * POST /api/auth/register
 * Register a new user with email verification
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    // Check if username already exists
    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ message: "Dieser Benutzername ist bereits vergeben." });
    }

    // Check if email already exists
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: "Diese E-Mail-Adresse ist bereits registriert." });
    }

    // Create user first (inactive until email verified)
    // Important: Set default AI model to gpt-4.1-mini for cost efficiency
    const newUser = await storage.createUser({
      username,
      email,
      password, // Will be hashed in createUser
      role: "admin", // All new users are admins
      isActive: false, // Inactive until email verified
    } as any);
    
    // Explicitly set the default AI model for new users
    await storage.updateUser(newUser.id, {
      selectedAiModel: "gpt-4.1-mini", // Default model for all new users
    } as any);

    // Generate verification token with actual user ID (after user creation)
    const verificationToken = emailService.generateVerificationToken(newUser.id);
    const verificationExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with verification token
    await storage.updateUser(newUser.id, {
      verificationToken,
      verificationTokenExpiry: verificationExpiry,
    } as any);

    // Create default Kamin property table for the new user
    try {
      secureLog.auth('Creating default property table for new user', { userId: newUser.id });
      
      const kaminTable = await storage.createPropertyTableForUser({
        name: "Kamin",
        description: "Default property table for Kamin (fireplace) products",
        isDefault: true,
      }, newUser.id);
      
      secureLog.auth('Created Kamin table', { userId: newUser.id, tableId: kaminTable.id });
      
      // Initialize the default Kamin properties in the table
      await initializeDefaultKaminProperties(kaminTable.id);
      secureLog.auth('Initialized default Kamin properties', { userId: newUser.id });
    } catch (propError) {
      secureLog.error('Failed to create default property table for user', propError);
      // Continue anyway - user can create tables manually
    }

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, username, verificationToken);
      secureLog.auth('Verification email sent', { userId: newUser.id });
    } catch (emailError) {
      secureLog.error('Failed to send verification email', emailError);
      // Continue anyway - admin can manually verify
    }

    res.status(201).json({
      message: "Registrierung erfolgreich. Bitte prüfen Sie Ihre E-Mail, um Ihr Konto zu verifizieren.",
      userId: newUser.id,
      email: newUser.email,
    });
  } catch (error: any) {
    secureLog.error('Registration error', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Ungültige Eingaben",
        errors: error.errors
      });
    }
    // Don't expose internal error details to client
    res.status(500).json({
      message: "Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut."
    });
  }
});

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify user email address
 */
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    // Find user with this token using timing-safe comparison
    const users = await storage.getAllUsers();
    const user = users.find(u => timingSafeTokenCompare(u.verificationToken, token));

    if (!user) {
      secureLog.security('Invalid verification token attempt', {});
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    // Check if token is expired
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({ message: "Verification token has expired" });
    }

    // Activate user and clear token
    await storage.updateUser(user.id, {
      isActive: true,
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    } as any);

    res.json({
      message: "Email verified successfully! You can now log in.",
      success: true
    });
  } catch (error) {
    secureLog.error('Email verification error', error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

/**
 * POST /api/auth/verify-email-code
 * Verify user email using verification code
 */
router.post("/verify-email-code", async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Verification code is required" });
    }

    // Verify code with email service
    const userId = emailService.verifyEmailCode(code);

    if (!userId) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    // Get user and activate
    const users = await storage.getAllUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Activate user and clear token
    await storage.updateUser(user.id, {
      isActive: true,
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    } as any);

    res.json({
      message: "Email verified successfully! You can now log in.",
      success: true
    });
  } catch (error) {
    secureLog.error('Email verification error (code)', error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: "If the email is registered, a verification link has been sent." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate new token
    const verificationToken = emailService.generateVerificationToken(user.id);
    const verificationExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await storage.updateUser(user.id, {
      verificationToken,
      verificationTokenExpiry: verificationExpiry,
    } as any);

    // Send email
    try {
      await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
      secureLog.auth('Resent verification email', { userId: user.id });
    } catch (emailError) {
      secureLog.error('Failed to resend verification email', emailError);
    }

    res.json({ message: "Verification email sent" });
  } catch (error) {
    secureLog.error('Resend verification error', error);
    res.status(500).json({ message: "Failed to resend verification email" });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    // Rate limit password reset requests to prevent enumeration
    const clientIp = getClientIp(req);
    if (!checkResetRateLimit(clientIp)) {
      secureLog.security('Password reset rate limited', { ip: clientIp.substring(0, 10) });
      // Don't reveal rate limiting - use same success message
      return res.json({
        message: "If the email is registered, a password reset link has been sent."
      });
    }
    
    const { email } = resetRequestSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);

    // Don't reveal if email exists for security
    if (!user) {
      secureLog.security('Password reset for non-existent email', {});
      // Use same response to prevent email enumeration
      return res.json({
        message: "If the email is registered, a password reset link has been sent."
      });
    }

    // Generate reset token
    const resetToken = emailService.generatePasswordResetToken(user.id);
    const resetExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry: resetExpiry,
    } as any);

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
      secureLog.auth('Password reset email sent', { userId: user.id });
    } catch (emailError) {
      secureLog.error('Failed to send reset email', emailError);
    }

    res.json({
      message: "If the email is registered, a password reset link has been sent."
    });
  } catch (error: any) {
    secureLog.error('Forgot password error', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid email address"
      });
    }
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Find user with this token using timing-safe comparison
    const users = await storage.getAllUsers();
    const user = users.find(u => timingSafeTokenCompare(u.resetToken, token));

    if (!user) {
      secureLog.security('Invalid reset token attempt', {});
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Check if token is expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      secureLog.security('Expired reset token used', { userId: user.id });
      return res.status(400).json({ message: "Reset token has expired" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear token
    await storage.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    } as any);

    // Invalidate the token in email service
    emailService.invalidateResetToken(token);

    // Delete all user sessions for security
    await storage.deleteUserSessions(user.id);
    secureLog.auth('Password reset completed, all sessions invalidated', { userId: user.id });

    // Send confirmation email
    try {
      await emailService.sendPasswordChangedEmail(user.email, user.username);
    } catch (emailError) {
      secureLog.error('Failed to send password changed email', emailError);
    }

    res.json({
      message: "Password reset successfully. You can now log in with your new password.",
      success: true
    });
  } catch (error: any) {
    secureLog.error('Reset password error', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid input",
        errors: error.errors
      });
    }
    res.status(500).json({ message: "Failed to reset password" });
  }
});

/**
 * POST /api/auth/demo-login
 * Create temporary guest session for demo mode
 */
router.post("/demo-login", async (req: Request, res: Response) => {
  try {
    // Check if guest demo user exists, create if not
    let guestUser = await storage.getUserByUsername("guest_demo");
    
    if (!guestUser) {
      // Create guest demo user
      guestUser = await storage.createUser({
        username: "guest_demo",
        email: "demo@rowbooster.local",
        password: "demo_password_" + Math.random(), // Random password (won't be used)
        role: "guest",
        isActive: true,
        emailVerified: true,
      });
    }

    // Create session
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for demo
    
    await storage.createSession(guestUser.id, sessionId, expiresAt);

    // Set cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    const { password, ...userWithoutPassword } = guestUser;
    res.json({ 
      user: userWithoutPassword, 
      message: "Demo session started. Limited features available.",
      isDemo: true
    });
  } catch (error) {
    secureLog.error('Demo login error', error);
    res.status(500).json({ message: "Failed to start demo session" });
  }
});

/**
 * GET /api/auth/test-email
 * Test email configuration (admin only)
 */
router.get("/test-email", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    const isConfigured = await emailService.verifyConnection();
    
    if (!isConfigured) {
      return res.status(500).json({ 
        message: "Email service not configured",
        configured: false 
      });
    }

    res.json({ 
      message: "Email service is configured and working",
      configured: true 
    });
  } catch (error) {
    secureLog.error('Email test error', error);
    res.status(500).json({
      message: "Email test failed",
      configured: false
    });
  }
});

/**
 * POST /api/auth/check-availability
 * Check if username or email is available
 */
router.post("/check-availability", async (req: Request, res: Response) => {
  try {
    const { username, email } = req.body;

    const response: { usernameAvailable?: boolean; emailAvailable?: boolean } = {};

    if (username) {
      const existingUsername = await storage.getUserByUsername(username);
      response.usernameAvailable = !existingUsername;
    }

    if (email) {
      const existingEmail = await storage.getUserByEmail(email);
      response.emailAvailable = !existingEmail;
    }

    res.json(response);
  } catch (error) {
    secureLog.error('Check availability error', error);
    res.status(500).json({ message: "Verfügbarkeit konnte nicht geprüft werden." });
  }
});

export default router;