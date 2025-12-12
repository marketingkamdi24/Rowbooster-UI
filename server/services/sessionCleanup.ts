/**
 * Session Cleanup Service
 * Provides automatic cleanup of expired sessions and idle session timeout
 */

import { db } from "../db";
import { sessions } from "@shared/schema";
import { lt, and, lte } from "drizzle-orm";

// Session configuration
export const SESSION_CONFIG = {
  // Absolute session expiry (max session lifetime)
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  
  // Idle timeout (session expires after no activity)
  IDLE_TIMEOUT: 1 * 60 * 60 * 1000, // 1 hour of inactivity
  
  // Cleanup interval (how often to run cleanup)
  CLEANUP_INTERVAL: 15 * 60 * 1000, // Every 15 minutes
};

/**
 * Clean up all expired sessions from the database
 * This removes sessions that have passed their expiresAt time
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();
    console.log(`[SESSION-CLEANUP] Starting cleanup at ${now.toISOString()}`);
    
    // Delete sessions that have expired
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now));
    
    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`[SESSION-CLEANUP] Removed ${deletedCount} expired sessions`);
    } else {
      console.log(`[SESSION-CLEANUP] No expired sessions to clean up`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error("[SESSION-CLEANUP] Error cleaning up sessions:", error);
    return 0;
  }
}

/**
 * Clean up idle sessions (sessions with no recent activity)
 */
export async function cleanupIdleSessions(): Promise<number> {
  try {
    const now = new Date();
    const idleThreshold = new Date(now.getTime() - SESSION_CONFIG.IDLE_TIMEOUT);
    
    console.log(`[SESSION-CLEANUP] Checking for idle sessions (last activity before ${idleThreshold.toISOString()})`);
    
    // Delete sessions that have been idle too long
    // Check if lastActivity exists and is older than the threshold
    const result = await db
      .delete(sessions)
      .where(
        and(
          lte(sessions.lastActivity, idleThreshold),
          lt(sessions.expiresAt, new Date(now.getTime() + SESSION_CONFIG.SESSION_DURATION)) // Still valid but idle
        )
      );
    
    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`[SESSION-CLEANUP] Removed ${deletedCount} idle sessions`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error("[SESSION-CLEANUP] Error cleaning up idle sessions:", error);
    return 0;
  }
}

/**
 * Run all cleanup tasks
 */
export async function runSessionCleanup(): Promise<void> {
  console.log(`\n[SESSION-CLEANUP] ========== Session Cleanup Started ==========`);
  
  const expiredCount = await cleanupExpiredSessions();
  const idleCount = await cleanupIdleSessions();
  
  console.log(`[SESSION-CLEANUP] Summary: Expired=${expiredCount}, Idle=${idleCount}`);
  console.log(`[SESSION-CLEANUP] ========== Session Cleanup Complete ==========\n`);
}

// Cleanup interval reference
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start automatic session cleanup
 */
export function startSessionCleanup(): void {
  if (cleanupInterval) {
    console.log("[SESSION-CLEANUP] Cleanup already running");
    return;
  }
  
  console.log(`[SESSION-CLEANUP] Starting automatic cleanup (every ${SESSION_CONFIG.CLEANUP_INTERVAL / 60000} minutes)`);
  
  // Run initial cleanup
  runSessionCleanup().catch(console.error);
  
  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    runSessionCleanup().catch(console.error);
  }, SESSION_CONFIG.CLEANUP_INTERVAL);
}

/**
 * Stop automatic session cleanup
 */
export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[SESSION-CLEANUP] Automatic cleanup stopped");
  }
}

/**
 * Check if a session should be considered idle
 */
export function isSessionIdle(lastActivity: Date | null): boolean {
  if (!lastActivity) return false;
  
  const now = new Date();
  const idleTime = now.getTime() - lastActivity.getTime();
  
  return idleTime > SESSION_CONFIG.IDLE_TIMEOUT;
}

/**
 * Get session expiry time for a new session
 */
export function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_CONFIG.SESSION_DURATION);
}

/**
 * Calculate remaining session time
 */
export function getRemainingSessionTime(expiresAt: Date): number {
  return Math.max(0, expiresAt.getTime() - Date.now());
}