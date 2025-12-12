import { storage } from "../storage";

class AccountCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 10 * 60 * 1000; // Check every 10 minutes

  /**
   * Start the automatic cleanup service
   */
  start(): void {
    if (this.intervalId) {
      console.log("[CLEANUP] Account cleanup service is already running");
      return;
    }

    console.log("[CLEANUP] Starting automatic account cleanup service");
    
    // Run immediately on start
    this.cleanupExpiredAccounts();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.cleanupExpiredAccounts();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[CLEANUP] Account cleanup service stopped");
    }
  }

  /**
   * Clean up accounts that haven't been verified within the expiry period
   */
  async cleanupExpiredAccounts(): Promise<void> {
    try {
      const users = await storage.getAllUsers();
      const now = new Date();
      let deletedCount = 0;

      for (const user of users) {
        // Check if user is inactive (not verified) and has an expired verification token
        if (
          !user.isActive &&
          !user.emailVerified &&
          user.verificationTokenExpiry &&
          user.verificationTokenExpiry < now
        ) {
          console.log(`[CLEANUP] Deleting unverified user: ${user.username} (${user.email}) - expired at ${user.verificationTokenExpiry}`);
          
          // Delete user and all associated data
          await storage.deleteUser(user.id);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[CLEANUP] Cleaned up ${deletedCount} unverified expired account(s)`);
      } else {
        console.log("[CLEANUP] No expired unverified accounts to clean up");
      }
    } catch (error) {
      console.error("[CLEANUP] Error during account cleanup:", error);
    }
  }
}

// Export singleton instance
export const accountCleanupService = new AccountCleanupService();