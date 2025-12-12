import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface EmailVerificationToken {
  token: string;
  code: string;
  userId: number;
  expiresAt: Date;
}

interface PasswordResetToken {
  token: string;
  userId: number;
  expiresAt: Date;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private verificationTokens: Map<string, EmailVerificationToken> = new Map();
  private resetTokens: Map<string, PasswordResetToken> = new Map();

  /**
   * Initialize email service with configuration
   * For the project email: kontakt@rowbooster.com (IONOS)
   */
  configure(config: Partial<EmailConfig>) {
    this.config = {
      host: config.host || process.env.SMTP_HOST || 'smtp.ionos.de',
      port: config.port || parseInt(process.env.SMTP_PORT || '465'),
      secure: config.secure !== undefined ? config.secure : (parseInt(process.env.SMTP_PORT || '465') === 465),
      auth: {
        user: config.auth?.user || process.env.SMTP_USER || 'kontakt@rowbooster.com',
        pass: config.auth?.pass || process.env.SMTP_PASS || '',
      },
      from: config.from || process.env.SMTP_FROM || 'kontakt@rowbooster.com',
    };

    // Configure transporter with enhanced TLS options for better compatibility
    // Port 465 uses implicit SSL/TLS, port 587 uses STARTTLS
    const transportOptions: any = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure, // true for 465, false for 587
      auth: this.config.auth,
      // Improved TLS configuration for broader email delivery
      tls: {
        // Do not fail on invalid certificates (useful for some mail servers)
        rejectUnauthorized: false,
        // Minimum TLS version
        minVersion: 'TLSv1.2',
        // Required for some SMTP servers
        ciphers: 'SSLv3',
      },
      // Connection timeout settings
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 60000, // 60 seconds for slow connections
      // Enable debug output when in development
      debug: process.env.NODE_ENV !== 'production',
      logger: process.env.NODE_ENV !== 'production',
    };

    // For port 587 with STARTTLS, we need secure: false and let nodemailer upgrade
    if (this.config.port === 587) {
      transportOptions.secure = false;
      transportOptions.requireTLS = true; // Force STARTTLS upgrade
    }

    this.transporter = nodemailer.createTransport(transportOptions);

    console.log('[EMAIL] Email service configured with:', {
      host: this.config.host,
      port: this.config.port,
      user: this.config.auth.user,
      from: this.config.from,
    });
  }

  /**
   * Verify email configuration works
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      console.error('[EMAIL] Email service not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[EMAIL] SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('[EMAIL] SMTP connection verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a verification token and code for email verification
   */
  generateVerificationToken(userId: number): string {
    const token = crypto.randomBytes(32).toString('hex');
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    this.verificationTokens.set(token, { token, code, userId, expiresAt });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get verification code for a token
   */
  getVerificationCode(token: string): string | null {
    const tokenData = this.verificationTokens.get(token);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      return null;
    }
    return tokenData.code;
  }

  /**
   * Verify an email verification code
   */
  verifyEmailCode(code: string): number | null {
    // Find token by code
    const entries = Array.from(this.verificationTokens.entries());
    for (const [token, tokenData] of entries) {
      if (tokenData.code === code) {
        if (tokenData.expiresAt < new Date()) {
          this.verificationTokens.delete(token);
          return null;
        }
        this.verificationTokens.delete(token); // Single use
        return tokenData.userId;
      }
    }
    return null;
  }

  /**
   * Generate a password reset token
   */
  generatePasswordResetToken(userId: number): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    this.resetTokens.set(token, { token, userId, expiresAt });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return token;
  }

  /**
   * Verify an email verification token
   */
  verifyEmailToken(token: string): number | null {
    const tokenData = this.verificationTokens.get(token);
    
    if (!tokenData) {
      return null;
    }

    if (tokenData.expiresAt < new Date()) {
      this.verificationTokens.delete(token);
      return null;
    }

    this.verificationTokens.delete(token); // Single use token
    return tokenData.userId;
  }

  /**
   * Verify a password reset token
   */
  verifyResetToken(token: string): number | null {
    const tokenData = this.resetTokens.get(token);
    
    if (!tokenData) {
      return null;
    }

    if (tokenData.expiresAt < new Date()) {
      this.resetTokens.delete(token);
      return null;
    }

    return tokenData.userId;
  }

  /**
   * Invalidate a password reset token after use
   */
  invalidateResetToken(token: string): void {
    this.resetTokens.delete(token);
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();

    // Clean verification tokens
    this.verificationTokens.forEach((data, token) => {
      if (data.expiresAt < now) {
        this.verificationTokens.delete(token);
      }
    });

    // Clean reset tokens
    this.resetTokens.forEach((data, token) => {
      if (data.expiresAt < now) {
        this.resetTokens.delete(token);
      }
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: this.config.from,
      to,
      subject: 'Rowbooster-Welcome',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Rowbooster!</h2>
          <p>Hi <strong>${username}</strong>,</p>
          <p>Thank you for joining Rowbooster - your AI-powered data extraction platform.</p>
          <p>You can now log in and start using all our features:</p>
          <ul>
            <li>AI-powered product data extraction</li>
            <li>Multi-source web scraping</li>
            <li>PDF content analysis</li>
            <li>Automated property management</li>
          </ul>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Best regards,<br>The Rowbooster Team</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Welcome email sent to ${to}`);
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(to: string, username: string, verificationToken: string): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    console.log('[EMAIL] APP_URL from environment:', process.env.APP_URL);
    console.log('[EMAIL] Using APP_URL:', appUrl);
    console.log('[EMAIL] NODE_ENV:', process.env.NODE_ENV);
    
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
    const verificationCode = this.getVerificationCode(verificationToken);
    console.log('[EMAIL] Generated verification URL:', verificationUrl);
    console.log('[EMAIL] Generated verification code:', verificationCode);

    const mailOptions = {
      from: this.config.from,
      to,
      subject: 'Rowbooster-Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Verify Your Email Address</h2>
          <p>Hi <strong>${username}</strong>,</p>
          <p>Thank you for registering with Rowbooster. Please verify your email address using one of the following methods:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Option 1: Verification Code</h3>
            <p>Enter this code on the verification page:</p>
            <div style="text-align: center; margin: 15px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; font-family: 'Courier New', monospace;">${verificationCode}</span>
            </div>
            <p style="font-size: 12px; color: #6b7280;">This code will expire in 1 hour.</p>
          </div>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Option 2: Verification Link</h3>
            <p>Click the button below to verify automatically:</p>
            <div style="text-align: center; margin: 15px 0;">
              <a href="${verificationUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email
              </a>
            </div>
            <p style="font-size: 12px; color: #6b7280;">Or copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 11px; word-break: break-all;">${verificationUrl}</p>
          </div>

          <p style="color: #ef4444; font-weight: bold;">⚠️ Important: This verification will expire in 1 hour.</p>
          <p style="font-size: 12px; color: #6b7280;">If your account is not verified within 1 hour, it will be automatically removed and you'll need to register again.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <p>Best regards,<br>The Rowbooster Team</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Verification email sent to ${to}`);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, username: string, resetToken: string): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: this.config.from,
      to,
      subject: 'Rowbooster-PasswordReset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hi <strong>${username}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <p>Best regards,<br>The Rowbooster Team</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Password reset email sent to ${to}`);
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(to: string, username: string): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: this.config.from,
      to,
      subject: 'Rowbooster-PasswordChanged',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Changed Successfully</h2>
          <p>Hi <strong>${username}</strong>,</p>
          <p>This email confirms that your password has been changed successfully.</p>
          <p>If you didn't make this change, please contact our support team immediately.</p>
          <p>Best regards,<br>The Rowbooster Team</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Password changed confirmation sent to ${to}`);
  }

  /**
   * Send contact form message to kontakt@rowbooster.com
   */
  async sendContactMessage(
    senderName: string,
    senderEmail: string,
    subject: string,
    message: string
  ): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: this.config.from,
      to: 'kontakt@rowbooster.com',
      replyTo: senderEmail,
      subject: `Rowbooster-Contact: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Neue Kontaktanfrage</h2>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Von:</strong> ${senderName}</p>
            <p><strong>E-Mail:</strong> ${senderEmail}</p>
            <p><strong>Betreff:</strong> ${subject}</p>
          </div>
          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h3 style="color: #1f2937; margin-top: 0;">Nachricht:</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Diese Nachricht wurde über das Kontaktformular auf rowbooster.com gesendet.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Contact message sent from ${senderEmail}`);
  }

  /**
   * Send auto-reply to contact form sender
   */
  async sendContactAutoReply(
    recipientEmail: string,
    recipientName: string,
    originalSubject: string
  ): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: this.config.from,
      to: recipientEmail,
      subject: 'Rowbooster-ContactConfirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Vielen Dank für Ihre Nachricht!</h2>
          <p>Sehr geehrte(r) <strong>${recipientName}</strong>,</p>
          <p>wir haben Ihre Nachricht zum Thema "<em>${originalSubject}</em>" erhalten.</p>
          <p>Unser Team wird sich so schnell wie möglich bei Ihnen melden.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #6b7280;">
              <strong>Hinweis:</strong> Dies ist eine automatische Bestätigung. Bitte antworten Sie nicht auf diese E-Mail.
            </p>
          </div>
          <p>Mit freundlichen Grüßen,<br>Das Rowbooster Team</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Rowbooster - AI-Powered Product Data Extraction
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Contact auto-reply sent to ${recipientEmail}`);
  }
}

// Export singleton instance
export const emailService = new EmailService();