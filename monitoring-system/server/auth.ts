import { db, pool } from './db';
import bcrypt from 'bcryptjs';

export interface MonitoringUser {
  id: number;
  username: string;
}

export async function authenticateRBManager(
  username: string,
  password: string
): Promise<MonitoringUser | null> {
  try {
    const result = await pool.query(
      'SELECT * FROM rb_manager WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await pool.query(
      'UPDATE rb_manager SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      username: user.username,
    };
  } catch (error) {
    console.error('[MONITORING-AUTH] Authentication error:', error);
    return null;
  }
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Unauthorized - Please log in' });
  }
  next();
}