/**
 * Backup Scheduler Service
 * 
 * Automatically schedules and manages database backups.
 * Runs daily backups at a configurable time and maintains retention policy.
 */

import { config } from 'dotenv';
config();

// Backup configuration
export const BACKUP_SCHEDULE_CONFIG = {
  // Enable/disable automatic backups
  enabled: process.env.BACKUP_ENABLED !== 'false',
  
  // Hour of day to run backup (0-23, UTC)
  backupHour: parseInt(process.env.BACKUP_HOUR || '3', 10),
  
  // Retention policy
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  
  // Maximum number of backups to keep
  maxBackups: parseInt(process.env.MAX_BACKUPS || '30', 10),
};

let backupTimer: NodeJS.Timeout | null = null;

/**
 * Schedule the next backup run
 */
export function scheduleNextBackup(): void {
  if (!BACKUP_SCHEDULE_CONFIG.enabled) {
    console.log('[BACKUP-SCHEDULER] Automatic backups are disabled');
    return;
  }

  // Calculate time until next backup
  const now = new Date();
  const nextBackup = new Date(now);
  nextBackup.setUTCHours(BACKUP_SCHEDULE_CONFIG.backupHour, 0, 0, 0);
  
  // If the scheduled time has passed today, schedule for tomorrow
  if (nextBackup <= now) {
    nextBackup.setDate(nextBackup.getDate() + 1);
  }
  
  const msUntilBackup = nextBackup.getTime() - now.getTime();
  const hoursUntilBackup = Math.round(msUntilBackup / (1000 * 60 * 60) * 10) / 10;
  
  console.log(`[BACKUP-SCHEDULER] Next backup scheduled for ${nextBackup.toISOString()} (in ${hoursUntilBackup} hours)`);
  
  // Clear any existing timer
  if (backupTimer) {
    clearTimeout(backupTimer);
  }
  
  // Schedule the backup
  backupTimer = setTimeout(async () => {
    await runScheduledBackup();
    // Schedule the next one
    scheduleNextBackup();
  }, msUntilBackup);
}

/**
 * Run a scheduled backup
 */
async function runScheduledBackup(): Promise<void> {
  console.log('[BACKUP-SCHEDULER] Starting scheduled backup...');
  
  try {
    // Dynamic import to avoid circular dependencies
    const { createBackup, cleanupBackups } = await import('../../scripts/database-backup');
    
    // Create the backup
    const backupInfo = await createBackup();
    console.log(`[BACKUP-SCHEDULER] Backup completed: ${backupInfo.filename}`);
    
    // Run cleanup of old backups
    cleanupBackups();
    
    // Log success to monitoring
    try {
      const { MonitoringLogger } = await import('./monitoringLogger');
      await MonitoringLogger.info(
        `Scheduled backup completed: ${backupInfo.filename}`,
        'system',
        {
          metadata: {
            filename: backupInfo.filename,
            size: backupInfo.size,
            compressed: backupInfo.compressed,
          }
        }
      );
    } catch (logError) {
      console.error('[BACKUP-SCHEDULER] Failed to log to monitoring:', logError);
    }
    
  } catch (error: any) {
    console.error('[BACKUP-SCHEDULER] Backup failed:', error.message);
    
    // Log failure to monitoring
    try {
      const { MonitoringLogger } = await import('./monitoringLogger');
      await MonitoringLogger.error(
        `Scheduled backup failed: ${error.message}`,
        error,
        'system',
        { metadata: { errorType: error.name, operation: 'scheduled_backup' } }
      );
    } catch (logError) {
      console.error('[BACKUP-SCHEDULER] Failed to log error to monitoring:', logError);
    }
  }
}

/**
 * Initialize the backup scheduler
 */
export function initBackupScheduler(): void {
  console.log('[BACKUP-SCHEDULER] Initializing backup scheduler...');
  console.log(`[BACKUP-SCHEDULER] Config: enabled=${BACKUP_SCHEDULE_CONFIG.enabled}, hour=${BACKUP_SCHEDULE_CONFIG.backupHour}:00 UTC`);
  console.log(`[BACKUP-SCHEDULER] Retention: ${BACKUP_SCHEDULE_CONFIG.retentionDays} days, max ${BACKUP_SCHEDULE_CONFIG.maxBackups} backups`);
  
  if (BACKUP_SCHEDULE_CONFIG.enabled) {
    scheduleNextBackup();
  }
}

/**
 * Stop the backup scheduler
 */
export function stopBackupScheduler(): void {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
    console.log('[BACKUP-SCHEDULER] Backup scheduler stopped');
  }
}

/**
 * Manually trigger a backup (can be called from admin API)
 */
export async function triggerManualBackup(): Promise<{ success: boolean; message: string; filename?: string }> {
  console.log('[BACKUP-SCHEDULER] Manual backup triggered');
  
  try {
    const { createBackup } = await import('../../scripts/database-backup');
    const backupInfo = await createBackup();
    
    return {
      success: true,
      message: `Backup created successfully: ${backupInfo.filename}`,
      filename: backupInfo.filename,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Backup failed: ${error.message}`,
    };
  }
}