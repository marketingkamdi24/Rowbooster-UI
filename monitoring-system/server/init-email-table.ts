import { pool } from './db';

/**
 * Initialize the monitoring_emails table for email management
 */
export async function initializeEmailTable(): Promise<void> {
  console.log('[MONITORING-EMAIL] Initializing email table...');

  try {
    // Create monitoring_emails table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monitoring_emails (
        id SERIAL PRIMARY KEY,
        message_id TEXT UNIQUE,
        "from" TEXT NOT NULL,
        "to" JSONB DEFAULT '[]',
        cc JSONB DEFAULT '[]',
        bcc JSONB DEFAULT '[]',
        subject TEXT NOT NULL DEFAULT '(No Subject)',
        body TEXT,
        body_html TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        is_starred BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        folder VARCHAR(50) DEFAULT 'inbox',
        labels JSONB DEFAULT '[]',
        attachments JSONB DEFAULT '[]',
        sent_at TIMESTAMP WITH TIME ZONE,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_emails_folder 
      ON monitoring_emails(folder)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_emails_is_read 
      ON monitoring_emails(is_read)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_emails_sent_at 
      ON monitoring_emails(sent_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_monitoring_emails_from 
      ON monitoring_emails("from")
    `);

    // Create email drafts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monitoring_email_drafts (
        id SERIAL PRIMARY KEY,
        "to" JSONB DEFAULT '[]',
        cc JSONB DEFAULT '[]',
        bcc JSONB DEFAULT '[]',
        subject TEXT DEFAULT '',
        body TEXT DEFAULT '',
        body_html TEXT,
        is_bulk BOOLEAN DEFAULT FALSE,
        bulk_recipients JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create email templates table for bulk sending
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monitoring_email_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        body_html TEXT,
        html TEXT,
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Add is_active column if it doesn't exist (for existing installations)
    await pool.query(`
      ALTER TABLE monitoring_email_templates
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `).catch(() => {});

    // Add html column if it doesn't exist
    await pool.query(`
      ALTER TABLE monitoring_email_templates
      ADD COLUMN IF NOT EXISTS html TEXT
    `).catch(() => {});

    // Insert default welcome email template
    const templateExists = await pool.query(
      "SELECT id FROM monitoring_email_templates WHERE name = 'welcome'"
    );

    if (templateExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO monitoring_email_templates (name, subject, body, body_html, variables)
        VALUES (
          'welcome',
          'Willkommen bei Rowbooster!',
          'Hallo {name},\n\nWillkommen bei Rowbooster! Wir freuen uns, Sie als neuen Benutzer begrüßen zu dürfen.\n\nMit freundlichen Grüßen,\nDas Rowbooster Team',
          '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Willkommen bei Rowbooster!</h2>
            <p>Hallo <strong>{name}</strong>,</p>
            <p>Willkommen bei Rowbooster! Wir freuen uns, Sie als neuen Benutzer begrüßen zu dürfen.</p>
            <p>Mit freundlichen Grüßen,<br>Das Rowbooster Team</p>
          </div>',
          '["name"]'::jsonb
        )
      `);
    }

    // Insert announcement template
    const announcementExists = await pool.query(
      "SELECT id FROM monitoring_email_templates WHERE name = 'announcement'"
    );

    if (announcementExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO monitoring_email_templates (name, subject, body, body_html, variables)
        VALUES (
          'announcement',
          '{subject}',
          'Hallo {name},\n\n{message}\n\nMit freundlichen Grüßen,\nDas Rowbooster Team',
          '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">{subject}</h2>
            <p>Hallo <strong>{name}</strong>,</p>
            <div style="margin: 20px 0;">{message}</div>
            <p>Mit freundlichen Grüßen,<br>Das Rowbooster Team</p>
          </div>',
          '["name", "subject", "message"]'::jsonb
        )
      `);
    }

    console.log('[MONITORING-EMAIL] ✅ Email tables initialized successfully');
  } catch (error) {
    console.error('[MONITORING-EMAIL] ❌ Failed to initialize email tables:', error);
    throw error;
  }
}

// Alias for backward compatibility
export const initializeEmailTables = initializeEmailTable;