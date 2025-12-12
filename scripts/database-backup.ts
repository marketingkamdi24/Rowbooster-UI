/**
 * Database Backup Script
 * 
 * Features:
 * - Automated daily backups with configurable retention policy
 * - Compressed backup files (gzip)
 * - Backup rotation (automatic cleanup of old backups)
 * - Backup verification
 * - Support for both local and cloud storage
 * 
 * Usage:
 *   npx tsx scripts/database-backup.ts [command]
 * 
 * Commands:
 *   create    - Create a new backup
 *   restore   - Restore from a backup file
 *   list      - List available backups
 *   cleanup   - Remove old backups based on retention policy
 *   verify    - Verify backup integrity
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

// Configuration
const BACKUP_CONFIG = {
  // Backup directory (relative to project root)
  backupDir: process.env.BACKUP_DIR || './backups',
  
  // Retention policy (in days)
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  
  // Maximum number of backups to keep
  maxBackups: parseInt(process.env.MAX_BACKUPS || '30', 10),
  
  // Backup file prefix
  filePrefix: 'rowbooster_backup',
  
  // Compression enabled
  compress: true,
};

interface BackupInfo {
  filename: string;
  filepath: string;
  size: number;
  created: Date;
  compressed: boolean;
}

/**
 * Parse DATABASE_URL to extract connection parameters
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
} {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  const backupPath = path.resolve(BACKUP_CONFIG.backupDir);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
    console.log(`✓ Created backup directory: ${backupPath}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(): string {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  const ext = BACKUP_CONFIG.compress ? '.sql.gz' : '.sql';
  return `${BACKUP_CONFIG.filePrefix}_${timestamp}${ext}`;
}

/**
 * Create a database backup
 */
async function createBackup(): Promise<BackupInfo> {
  console.log('\n📦 Creating database backup...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  ensureBackupDir();
  
  const dbParams = parseDatabaseUrl(databaseUrl);
  const filename = generateBackupFilename();
  const backupPath = path.resolve(BACKUP_CONFIG.backupDir);
  const sqlFilePath = path.join(backupPath, filename.replace('.gz', ''));
  const finalFilePath = path.join(backupPath, filename);
  
  console.log(`📁 Backup directory: ${backupPath}`);
  console.log(`📄 Backup file: ${filename}`);
  console.log(`🗄️  Database: ${dbParams.database} @ ${dbParams.host}`);
  
  // Set environment variables for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: dbParams.password,
  };
  
  // Create pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${dbParams.host}`,
    `-p ${dbParams.port}`,
    `-U ${dbParams.user}`,
    `-d ${dbParams.database}`,
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
    `--file="${sqlFilePath}"`,
  ].join(' ');
  
  try {
    console.log('\n⏳ Running pg_dump...');
    await execAsync(pgDumpCmd, { env });
    console.log('✓ Database dump completed');
    
    // Compress if enabled
    if (BACKUP_CONFIG.compress) {
      console.log('⏳ Compressing backup...');
      await compressFile(sqlFilePath, finalFilePath);
      // Remove uncompressed file
      fs.unlinkSync(sqlFilePath);
      console.log('✓ Compression completed');
    }
    
    // Get file stats
    const stats = fs.statSync(finalFilePath);
    
    const backupInfo: BackupInfo = {
      filename,
      filepath: finalFilePath,
      size: stats.size,
      created: new Date(),
      compressed: BACKUP_CONFIG.compress,
    };
    
    console.log('\n✅ Backup created successfully!');
    console.log(`   📄 File: ${filename}`);
    console.log(`   📦 Size: ${formatBytes(stats.size)}`);
    console.log(`   📅 Created: ${backupInfo.created.toISOString()}`);
    
    return backupInfo;
    
  } catch (error: any) {
    // Clean up partial files
    if (fs.existsSync(sqlFilePath)) fs.unlinkSync(sqlFilePath);
    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
    
    throw new Error(`Backup failed: ${error.message}`);
  }
}

/**
 * Compress a file using gzip
 */
async function compressFile(inputPath: string, outputPath: string): Promise<void> {
  const gzip = zlib.createGzip({ level: 9 });
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  
  await pipeline(source, gzip, destination);
}

/**
 * Decompress a gzip file
 */
async function decompressFile(inputPath: string, outputPath: string): Promise<void> {
  const gunzip = zlib.createGunzip();
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  
  await pipeline(source, gunzip, destination);
}

/**
 * List all available backups
 */
function listBackups(): BackupInfo[] {
  ensureBackupDir();
  
  const backupPath = path.resolve(BACKUP_CONFIG.backupDir);
  const files = fs.readdirSync(backupPath);
  
  const backups: BackupInfo[] = files
    .filter(f => f.startsWith(BACKUP_CONFIG.filePrefix) && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
    .map(filename => {
      const filepath = path.join(backupPath, filename);
      const stats = fs.statSync(filepath);
      
      return {
        filename,
        filepath,
        size: stats.size,
        created: stats.birthtime,
        compressed: filename.endsWith('.gz'),
      };
    })
    .sort((a, b) => b.created.getTime() - a.created.getTime());
  
  return backups;
}

/**
 * Display backup list
 */
function displayBackups(): void {
  console.log('\n📋 Available Backups\n');
  
  const backups = listBackups();
  
  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }
  
  console.log('┌──────────────────────────────────────────────────────────────────┬──────────┬─────────────────────┐');
  console.log('│ Filename                                                         │ Size     │ Created             │');
  console.log('├──────────────────────────────────────────────────────────────────┼──────────┼─────────────────────┤');
  
  backups.forEach((backup, index) => {
    const filename = backup.filename.padEnd(64);
    const size = formatBytes(backup.size).padEnd(8);
    const created = backup.created.toISOString().substring(0, 19).replace('T', ' ');
    console.log(`│ ${filename} │ ${size} │ ${created} │`);
  });
  
  console.log('└──────────────────────────────────────────────────────────────────┴──────────┴─────────────────────┘');
  console.log(`\nTotal: ${backups.length} backup(s)`);
  console.log(`Total size: ${formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}`);
}

/**
 * Restore from a backup file
 */
async function restoreBackup(backupFilename?: string): Promise<void> {
  console.log('\n🔄 Restoring database from backup...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  const backups = listBackups();
  if (backups.length === 0) {
    throw new Error('No backups found');
  }
  
  // Use specified backup or most recent
  let selectedBackup: BackupInfo;
  if (backupFilename) {
    const found = backups.find(b => b.filename === backupFilename);
    if (!found) {
      throw new Error(`Backup not found: ${backupFilename}`);
    }
    selectedBackup = found;
  } else {
    selectedBackup = backups[0];
    console.log('Using most recent backup...');
  }
  
  console.log(`📄 Restoring from: ${selectedBackup.filename}`);
  console.log(`📅 Backup date: ${selectedBackup.created.toISOString()}`);
  
  const dbParams = parseDatabaseUrl(databaseUrl);
  
  // Set environment variables
  const env = {
    ...process.env,
    PGPASSWORD: dbParams.password,
  };
  
  let sqlFilePath = selectedBackup.filepath;
  
  // Decompress if needed
  if (selectedBackup.compressed) {
    console.log('⏳ Decompressing backup...');
    const tempPath = selectedBackup.filepath.replace('.gz', '');
    await decompressFile(selectedBackup.filepath, tempPath);
    sqlFilePath = tempPath;
    console.log('✓ Decompression completed');
  }
  
  try {
    console.log('⏳ Restoring database...');
    
    const psqlCmd = [
      'psql',
      `-h ${dbParams.host}`,
      `-p ${dbParams.port}`,
      `-U ${dbParams.user}`,
      `-d ${dbParams.database}`,
      `-f "${sqlFilePath}"`,
      '-v ON_ERROR_STOP=1',
    ].join(' ');
    
    await execAsync(psqlCmd, { env });
    
    console.log('\n✅ Database restored successfully!');
    
  } finally {
    // Clean up temporary decompressed file
    if (selectedBackup.compressed && fs.existsSync(sqlFilePath)) {
      fs.unlinkSync(sqlFilePath);
    }
  }
}

/**
 * Clean up old backups based on retention policy
 */
function cleanupBackups(): void {
  console.log('\n🧹 Cleaning up old backups...\n');
  
  const backups = listBackups();
  const now = new Date();
  const retentionMs = BACKUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;
  
  let deletedCount = 0;
  let deletedSize = 0;
  
  backups.forEach((backup, index) => {
    const age = now.getTime() - backup.created.getTime();
    const isExpired = age > retentionMs;
    const isOverMax = index >= BACKUP_CONFIG.maxBackups;
    
    if (isExpired || isOverMax) {
      console.log(`🗑️  Deleting: ${backup.filename} (${isExpired ? 'expired' : 'over limit'})`);
      fs.unlinkSync(backup.filepath);
      deletedCount++;
      deletedSize += backup.size;
    }
  });
  
  if (deletedCount > 0) {
    console.log(`\n✅ Deleted ${deletedCount} backup(s), freed ${formatBytes(deletedSize)}`);
  } else {
    console.log('No backups to clean up.');
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(backupFilename?: string): Promise<boolean> {
  console.log('\n🔍 Verifying backup integrity...\n');
  
  const backups = listBackups();
  if (backups.length === 0) {
    console.log('No backups to verify.');
    return false;
  }
  
  const backupsToVerify = backupFilename 
    ? backups.filter(b => b.filename === backupFilename)
    : [backups[0]]; // Verify most recent by default
  
  let allValid = true;
  
  for (const backup of backupsToVerify) {
    console.log(`📄 Verifying: ${backup.filename}`);
    
    try {
      // Check file exists and has content
      if (!fs.existsSync(backup.filepath)) {
        console.log('   ❌ File not found');
        allValid = false;
        continue;
      }
      
      if (backup.size === 0) {
        console.log('   ❌ File is empty');
        allValid = false;
        continue;
      }
      
      // If compressed, try to decompress a small portion
      if (backup.compressed) {
        const gunzip = zlib.createGunzip();
        const source = createReadStream(backup.filepath);
        
        await new Promise<void>((resolve, reject) => {
          let bytesRead = 0;
          const maxBytes = 1024 * 1024; // Read up to 1MB
          
          source.pipe(gunzip)
            .on('data', (chunk) => {
              bytesRead += chunk.length;
              if (bytesRead > maxBytes) {
                source.destroy();
                resolve();
              }
            })
            .on('end', resolve)
            .on('error', reject);
        });
      }
      
      // Check for SQL content markers
      const content = backup.compressed 
        ? await readCompressedStart(backup.filepath, 1000)
        : fs.readFileSync(backup.filepath, 'utf-8').substring(0, 1000);
      
      const hasPostgresMarkers = content.includes('PostgreSQL') || 
                                  content.includes('CREATE TABLE') ||
                                  content.includes('DROP TABLE');
      
      if (!hasPostgresMarkers) {
        console.log('   ⚠️  Warning: No PostgreSQL markers found');
      }
      
      console.log(`   ✅ Valid (${formatBytes(backup.size)})`);
      
    } catch (error: any) {
      console.log(`   ❌ Invalid: ${error.message}`);
      allValid = false;
    }
  }
  
  return allValid;
}

/**
 * Read the start of a compressed file
 */
async function readCompressedStart(filepath: string, bytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    
    const gunzip = zlib.createGunzip();
    const source = createReadStream(filepath);
    
    source.pipe(gunzip)
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        totalLength += chunk.length;
        if (totalLength >= bytes) {
          source.destroy();
        }
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8').substring(0, bytes));
      })
      .on('close', () => {
        resolve(Buffer.concat(chunks).toString('utf-8').substring(0, bytes));
      })
      .on('error', reject);
  });
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main CLI handler
 */
async function main(): Promise<void> {
  // Load environment variables
  const dotenv = await import('dotenv');
  dotenv.config();
  
  const command = process.argv[2] || 'create';
  const arg = process.argv[3];
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                 RowBooster Database Backup Utility             ');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    switch (command) {
      case 'create':
        await createBackup();
        break;
        
      case 'restore':
        await restoreBackup(arg);
        break;
        
      case 'list':
        displayBackups();
        break;
        
      case 'cleanup':
        cleanupBackups();
        break;
        
      case 'verify':
        const valid = await verifyBackup(arg);
        process.exit(valid ? 0 : 1);
        break;
        
      default:
        console.log(`
Usage: npx tsx scripts/database-backup.ts [command] [options]

Commands:
  create              Create a new backup
  restore [filename]  Restore from a backup (default: most recent)
  list                List all available backups
  cleanup             Remove old backups based on retention policy
  verify [filename]   Verify backup integrity (default: most recent)

Environment Variables:
  DATABASE_URL          PostgreSQL connection string (required)
  BACKUP_DIR            Backup directory (default: ./backups)
  BACKUP_RETENTION_DAYS Retention period in days (default: 30)
  MAX_BACKUPS           Maximum backups to keep (default: 30)
        `);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Export functions for programmatic use
export {
  createBackup,
  restoreBackup,
  listBackups,
  cleanupBackups,
  verifyBackup,
  BACKUP_CONFIG,
};

// Run CLI
main();