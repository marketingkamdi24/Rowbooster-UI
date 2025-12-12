import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export async function initializeAdminUser() {
  try {
    console.log('[INIT] Checking for admin users...');
    
    // Check if any admin user exists
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    
    if (existingAdmin.length === 0) {
      console.log('[INIT] ℹ️  No admin user found.');
      console.log('[INIT] ℹ️  Admin users can register through the normal registration process.');
      console.log('[INIT] ℹ️  All new registered users will have admin role by default.');
    } else {
      console.log('[INIT] ✅ Admin user(s) exist in the system');
    }
  } catch (error) {
    console.error('[INIT] Error checking admin users:', error);
    // Don't throw - let the app continue
  }
}