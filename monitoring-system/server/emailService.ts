import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { pool } from './db';

interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  imap: {
    host: string;
    port: number;
    tls: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
}

interface StoredEmail {
  id: number;
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  isRead: boolean;
  isStarred: boolean;
  folder: string;
  sentAt: Date;
  receivedAt: Date;
  attachments: any[];
}

interface SendEmailOptions {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

class MonitoringEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private imapClient: Imap | null = null;
  private config: EmailConfig | null = null;
  private isImapConnected = false;

  /**
   * Initialize email service with IONOS configuration
   */
  async initializeSMTP(): Promise<boolean> {
    this.configure();
    return await this.verifySMTP();
  }

  /**
   * Configure email service with IONOS configuration
   */
  configure() {
    const smtpUser = process.env.SMTP_USER || 'kontakt@rowbooster.com';
    const smtpPass = process.env.SMTP_PASS || '';
    
    this.config = {
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.ionos.de',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: parseInt(process.env.SMTP_PORT || '465') === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
      imap: {
        host: process.env.IMAP_HOST || 'imap.ionos.de',
        port: parseInt(process.env.IMAP_PORT || '993'),
        tls: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
      from: process.env.SMTP_FROM || 'kontakt@rowbooster.com',
    };

    // Configure SMTP transporter
    const transportOptions: any = {
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };

    if (this.config.smtp.port === 587) {
      transportOptions.secure = false;
      transportOptions.requireTLS = true;
    }

    this.transporter = nodemailer.createTransport(transportOptions);

    console.log('[MONITORING-EMAIL] Email service configured with:', {
      smtpHost: this.config.smtp.host,
      smtpPort: this.config.smtp.port,
      imapHost: this.config.imap.host,
      imapPort: this.config.imap.port,
      user: this.config.smtp.auth.user,
    });
  }

  /**
   * Verify SMTP connection
   */
  async verifySMTP(): Promise<boolean> {
    if (!this.transporter) {
      console.error('[MONITORING-EMAIL] SMTP not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[MONITORING-EMAIL] SMTP connection verified');
      return true;
    } catch (error) {
      console.error('[MONITORING-EMAIL] SMTP verification failed:', error);
      return false;
    }
  }

  /**
   * Connect to IMAP server
   */
  async connectIMAP(): Promise<boolean> {
    if (!this.config) {
      console.error('[MONITORING-EMAIL] Email service not configured');
      return false;
    }

    return new Promise((resolve) => {
      this.imapClient = new Imap({
        user: this.config!.imap.auth.user,
        password: this.config!.imap.auth.pass,
        host: this.config!.imap.host,
        port: this.config!.imap.port,
        tls: this.config!.imap.tls,
        tlsOptions: { rejectUnauthorized: false },
      });

      this.imapClient.once('ready', () => {
        console.log('[MONITORING-EMAIL] IMAP connected');
        this.isImapConnected = true;
        resolve(true);
      });

      this.imapClient.once('error', (err: Error) => {
        console.error('[MONITORING-EMAIL] IMAP error:', err.message);
        this.isImapConnected = false;
        resolve(false);
      });

      this.imapClient.once('end', () => {
        console.log('[MONITORING-EMAIL] IMAP connection ended');
        this.isImapConnected = false;
      });

      this.imapClient.connect();
    });
  }

  /**
   * Disconnect IMAP client
   */
  disconnectIMAP() {
    if (this.imapClient && this.isImapConnected) {
      this.imapClient.end();
      this.imapClient = null;
      this.isImapConnected = false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter || !this.config) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
      
      const mailOptions = {
        from: this.config.from,
        to: toAddresses.join(', '),
        cc: options.cc?.join(', '),
        bcc: options.bcc?.join(', '),
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[MONITORING-EMAIL] Email sent:', info.messageId);

      // Store sent email in database
      await this.storeEmail({
        messageId: info.messageId,
        from: this.config.from,
        to: toAddresses,
        cc: options.cc || [],
        subject: options.subject,
        body: options.text || '',
        bodyHtml: options.html || null,
        folder: 'sent',
        sentAt: new Date(),
      });

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[MONITORING-EMAIL] Send email error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk email to multiple recipients
   */
  async sendBulkEmail(options: {
    recipients: { email: string; name?: string }[];
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{
    totalRecipients: number;
    successCount: number;
    failedCount: number;
    results: { email: string; success: boolean; error?: string }[]
  }> {
    const { recipients, subject, text, html } = options;
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      // Replace placeholders in templates
      const personalizedText = text?.replace(/\{name\}/g, recipient.name || 'User');
      const personalizedHtml = html?.replace(/\{name\}/g, recipient.name || 'User');

      const result = await this.sendEmail({
        to: recipient.email,
        subject,
        text: personalizedText,
        html: personalizedHtml,
      });

      results.push({
        email: recipient.email,
        success: result.success,
        error: result.error,
      });

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      totalRecipients: recipients.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Fetch emails from IMAP inbox
   */
  async fetchEmails(folder: string = 'INBOX', limit: number = 50): Promise<ParsedMail[]> {
    if (!this.imapClient || !this.isImapConnected) {
      const connected = await this.connectIMAP();
      if (!connected) {
        throw new Error('Failed to connect to IMAP server');
      }
    }

    return new Promise((resolve, reject) => {
      this.imapClient!.openBox(folder, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        const totalMessages = box.messages.total;
        if (totalMessages === 0) {
          resolve([]);
          return;
        }

        // Fetch last N messages
        const startSeq = Math.max(1, totalMessages - limit + 1);
        const fetch = this.imapClient!.seq.fetch(`${startSeq}:*`, {
          bodies: '',
          struct: true,
        });

        const emails: ParsedMail[] = [];

        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream: any) => {
            simpleParser(stream, async (parseErr, parsed) => {
              if (parseErr) {
                console.error('[MONITORING-EMAIL] Parse error:', parseErr);
                return;
              }
              emails.push(parsed);
            });
          });
        });

        fetch.once('error', (fetchErr) => {
          reject(fetchErr);
        });

        fetch.once('end', () => {
          // Sort by date descending
          emails.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
          });
          resolve(emails);
        });
      });
    });
  }

  /**
   * Sync emails from IMAP to database
   */
  async syncInbox(): Promise<{ newEmails: number; totalEmails: number; errors?: number }> {
    let newEmails = 0;
    let errors = 0;

    try {
      const emails = await this.fetchEmails('INBOX', 100);

      for (const email of emails) {
        try {
          // Check if email already exists
          const existing = await pool.query(
            'SELECT id FROM monitoring_emails WHERE message_id = $1',
            [email.messageId || `${email.date}-${email.from?.text}`]
          );

          if (existing.rows.length === 0) {
            await this.storeEmail({
              messageId: email.messageId || `${email.date}-${email.from?.text}`,
              from: email.from?.text || 'Unknown',
              to: email.to ? (Array.isArray(email.to) ? email.to.map(t => t.text || '') : [email.to.text || '']) : [],
              cc: email.cc ? (Array.isArray(email.cc) ? email.cc.map(c => c.text || '') : [email.cc.text || '']) : [],
              subject: email.subject || '(No Subject)',
              body: email.text || '',
              bodyHtml: email.html || null,
              folder: 'inbox',
              sentAt: email.date || new Date(),
              receivedAt: new Date(),
            });
            newEmails++;
          }
        } catch (error) {
          console.error('[MONITORING-EMAIL] Sync email error:', error);
          errors++;
        }
      }

      // Get total count
      const totalResult = await pool.query(
        "SELECT COUNT(*) FROM monitoring_emails WHERE folder = 'inbox'"
      );
      const totalEmails = parseInt(totalResult.rows[0].count);

      return { newEmails, totalEmails, errors: errors > 0 ? errors : undefined };
    } catch (error) {
      console.error('[MONITORING-EMAIL] Sync inbox error:', error);
      return { newEmails: 0, totalEmails: 0, errors: 1 };
    }
  }

  /**
   * Store email in database
   */
  async storeEmail(email: {
    messageId: string;
    from: string;
    to: string[];
    cc: string[];
    subject: string;
    body: string;
    bodyHtml: string | null;
    folder: string;
    sentAt: Date;
    receivedAt?: Date;
    attachments?: any[];
  }): Promise<number> {
    const result = await pool.query(
      `INSERT INTO monitoring_emails 
       (message_id, "from", "to", cc, subject, body, body_html, folder, sent_at, received_at, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        email.messageId,
        email.from,
        JSON.stringify(email.to),
        JSON.stringify(email.cc),
        email.subject,
        email.body,
        email.bodyHtml,
        email.folder,
        email.sentAt,
        email.receivedAt || new Date(),
        JSON.stringify(email.attachments || []),
      ]
    );
    return result.rows[0].id;
  }

  /**
   * Get emails from database with pagination
   */
  async getEmails(options: {
    folder?: string;
    limit?: number;
    offset?: number;
    search?: string;
    isRead?: boolean;
    isStarred?: boolean;
  }): Promise<{ emails: any[]; total: number }> {
    const { folder, limit = 50, offset = 0, search, isRead, isStarred } = options;

    let query = 'SELECT * FROM monitoring_emails WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (folder) {
      params.push(folder);
      query += ` AND folder = $${paramCount++}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (subject ILIKE $${paramCount} OR body ILIKE $${paramCount} OR "from" ILIKE $${paramCount})`;
      paramCount++;
    }

    if (isRead !== undefined) {
      params.push(isRead);
      query += ` AND is_read = $${paramCount++}`;
    }

    if (isStarred !== undefined) {
      params.push(isStarred);
      query += ` AND is_starred = $${paramCount++}`;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY sent_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      emails: result.rows.map(row => ({
        ...row,
        to: typeof row.to === 'string' ? JSON.parse(row.to) : row.to,
        cc: typeof row.cc === 'string' ? JSON.parse(row.cc) : row.cc,
        attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments,
        sent_at: row.sent_at?.toISOString(),
        received_at: row.received_at?.toISOString(),
      })),
      total,
    };
  }

  /**
   * Get single email by ID
   */
  async getEmailById(id: number): Promise<any | null> {
    const result = await pool.query('SELECT * FROM monitoring_emails WHERE id = $1', [id]);
    
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      to: typeof row.to === 'string' ? JSON.parse(row.to) : row.to,
      cc: typeof row.cc === 'string' ? JSON.parse(row.cc) : row.cc,
      attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments,
      sent_at: row.sent_at?.toISOString(),
      received_at: row.received_at?.toISOString(),
    };
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(id: number, isRead: boolean): Promise<void> {
    await pool.query('UPDATE monitoring_emails SET is_read = $1 WHERE id = $2', [isRead, id]);
  }

  /**
   * Mark email as starred/unstarred
   */
  async markAsStarred(id: number, isStarred: boolean): Promise<void> {
    await pool.query('UPDATE monitoring_emails SET is_starred = $1 WHERE id = $2', [isStarred, id]);
  }

  /**
   * Delete email
   */
  async deleteEmail(id: number): Promise<void> {
    await pool.query('DELETE FROM monitoring_emails WHERE id = $1', [id]);
  }

  /**
   * Move email to folder
   */
  async moveToFolder(id: number, folder: string): Promise<void> {
    await pool.query('UPDATE monitoring_emails SET folder = $1 WHERE id = $2', [folder, id]);
  }

  /**
   * Get email statistics
   */
  async getStatistics(): Promise<{
    total: number;
    unread: number;
    inbox: number;
    sent: number;
    starred: number;
  }> {
    const totalResult = await pool.query('SELECT COUNT(*) FROM monitoring_emails');
    const unreadResult = await pool.query('SELECT COUNT(*) FROM monitoring_emails WHERE is_read = false');
    const inboxResult = await pool.query("SELECT COUNT(*) FROM monitoring_emails WHERE folder = 'inbox'");
    const sentResult = await pool.query("SELECT COUNT(*) FROM monitoring_emails WHERE folder = 'sent'");
    const starredResult = await pool.query('SELECT COUNT(*) FROM monitoring_emails WHERE is_starred = true');

    return {
      total: parseInt(totalResult.rows[0].count),
      unread: parseInt(unreadResult.rows[0].count),
      inbox: parseInt(inboxResult.rows[0].count),
      sent: parseInt(sentResult.rows[0].count),
      starred: parseInt(starredResult.rows[0].count),
    };
  }
}

// Export the class and singleton instance
export { MonitoringEmailService };
export const monitoringEmailService = new MonitoringEmailService();