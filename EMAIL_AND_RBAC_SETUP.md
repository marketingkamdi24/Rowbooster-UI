# Email Service & RBAC Configuration Guide

## Overview
This guide explains how to configure the email service for user management features and the Role-Based Access Control (RBAC) system for Rowbooster.

---

## Email Service Setup

### Project Email Address
**Email:** `rowbooster.app@gmail.com`

This email will be used for:
- Sending user registration confirmations
- Email verification links
- Password reset requests
- System notifications

### Required Email Configuration

To enable email functionality, you need to configure SMTP settings for the project email address.

#### Option 1: Using Gmail/Google Workspace (Recommended)

For the project email `rowbooster.app@gmail.com`:

1. **Enable 2-Factor Authentication** on the Google account
2. **Generate an App Password**:
   - Go to Google Account Settings → Security
   - Under "2-Step Verification", select "App passwords"
   - Generate a new app password for "Mail"
   - Name it "rowbooster" for easy identification
   - Copy the 16-character password

3. **Configure Environment Variables** in `.env`:
   ```env
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=rowbooster.app@gmail.com
   SMTP_PASS=your-app-password-here
   SMTP_FROM=rowbooster.app@gmail.com
   
   # App URL (for email links)
   APP_URL=http://localhost:5000
   # For production: APP_URL=https://your-domain.com
   ```

#### Option 2: Using Microsoft Exchange/Office 365

If the email uses Microsoft Exchange:

1. **Get SMTP Settings** from IT administrator:
   - SMTP Server: Usually `smtp.office365.com`
   - Port: `587` (TLS) or `465` (SSL)
   - Authentication: Required

2. **Configure Environment Variables**:
   ```env
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_USER=your-email@domain.com
   SMTP_PASS=your-email-password-here
   SMTP_FROM=your-email@domain.com
   APP_URL=http://localhost:5000
   ```

#### Option 3: Using Custom SMTP Server

For company-specific SMTP servers:

1. **Contact IT Department** for:
   - SMTP server address
   - Port number
   - Authentication credentials
   - SSL/TLS requirements

2. **Configure accordingly**:
   ```env
   SMTP_HOST=smtp.your-company.com  # Example
   SMTP_PORT=587
   SMTP_USER=your-email@domain.com
   SMTP_PASS=your-password-here
   SMTP_FROM=your-email@domain.com
   APP_URL=http://localhost:5000
   ```

### Testing Email Configuration

After configuration, test the email service:

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Test endpoint** (via Postman or curl):
   ```bash
   POST http://localhost:5000/api/auth/test-email
   ```

3. **Check server logs** for connection status:
   - ✓ Success: `[EMAIL] SMTP connection verified successfully`
   - ✗ Failure: `[EMAIL] SMTP connection verification failed`

### Common Email Issues & Solutions

#### Issue: "Authentication failed"
**Solution:**
- Verify SMTP credentials are correct
- Check if 2FA is enabled (requires app password for Gmail)
- Ensure email account is not locked

#### Issue: "Connection timeout"
**Solution:**
- Verify SMTP host and port are correct
- Check firewall settings allow SMTP connections
- Try port 465 (SSL) if 587 (TLS) fails

#### Issue: "Self-signed certificate"
**Solution:**
- For development, set `NODE_TLS_REJECT_UNAUTHORIZED=0` in `.env` (NOT for production)
- For production, get proper SSL certificate from IT

---

## Role-Based Access Control (RBAC)

### User Roles

The system supports three role levels:

#### 1. **Admin** (`admin`)
**Full system access with all permissions:**
- ✓ Manage all users (create, edit, delete)
- ✓ Access all features and settings
- ✓ View all data and analytics
- ✓ Configure system settings
- ✓ Manage properties and property tables
- ✓ Access user management panel
- ✓ View audit logs (future feature)

#### 2. **User** (`user`)
**Standard user with limited permissions:**
- ✓ Use all search and extraction features
- ✓ Manage own profile
- ✓ Change own password
- ✓ View own search history
- ✗ Cannot access user management
- ✗ Cannot modify system settings
- ✗ Cannot access other users' data

#### 3. **Guest** (`guest`)
**Demo/trial mode with restricted access:**
- ✓ Read-only access to features
- ✓ View demo data
- ✓ Limited searches (e.g., 5 per day)
- ✗ Cannot save search results
- ✗ Cannot export data
- ✗ Cannot modify any settings
- ✗ No email verification required

### Permission Matrix

| Feature | Admin | User | Guest |
|---------|-------|------|-------|
| **Authentication** |
| Login | ✓ | ✓ | ✓ |
| Register | ✓ | ✓ | ✓ |
| Email Verification | Required | Required | Not Required |
| Password Reset | ✓ | ✓ | ✗ |
| **User Management** |
| View All Users | ✓ | ✗ | ✗ |
| Create Users | ✓ | ✗ | ✗ |
| Edit Users | ✓ | Own Profile | ✗ |
| Delete Users | ✓ | ✗ | ✗ |
| Change Role | ✓ | ✗ | ✗ |
| **Search & Extraction** |
| Automated Search | ✓ | ✓ | ✓ (Limited) |
| URL Search | ✓ | ✓ | ✓ (Limited) |
| PDF Upload | ✓ | ✓ | ✗ |
| Batch Processing | ✓ | ✓ | ✗ |
| Save Results | ✓ | ✓ | ✗ |
| Export Data | ✓ | ✓ | ✗ |
| **Configuration** |
| Property Management | ✓ | ✗ | ✗ |
| API Settings | ✓ | Own Keys | ✗ |
| System Settings | ✓ | ✗ | ✗ |

### Role Assignment

#### For Admin Users:
1. **First Admin** created via script:
   ```bash
   npm run db:seed-admin
   ```

2. **Additional Admins** via User Management panel:
   - Login as existing admin
   - Go to User Management
   - Edit user → Change role to "admin"

#### For Regular Users:
- Users register via registration page
- Default role: `user`
- Requires email verification
- Can be upgraded to admin by existing admin

#### For Guest Users:
- Special demo accounts
- No registration required
- Access via "Try Demo" link on landing page
- Limited to read-only features

### Implementing Custom Permissions

To add granular permissions beyond roles:

1. **Define permission types** in `shared/schema.ts`:
   ```typescript
   export const permissions = pgTable("permissions", {
     id: serial("id").primaryKey(),
     name: text("name").notNull().unique(),
     description: text("description"),
   });
   
   export const rolePermissions = pgTable("role_permissions", {
     id: serial("id").primaryKey(),
     role: text("role").notNull(),
     permissionId: integer("permission_id").references(() => permissions.id),
   });
   ```

2. **Create permission middleware**:
   ```typescript
   export function requirePermission(permission: string) {
     return async (req, res, next) => {
       // Check if user has permission
       const hasPermission = await checkUserPermission(req.user, permission);
       if (!hasPermission) {
         return res.status(403).json({ message: "Permission denied" });
       }
       next();
     };
   }
   ```

---

## Security Best Practices

### Email Security
1. **Never commit** SMTP credentials to version control
2. **Use environment variables** for all sensitive data
3. **Enable 2FA** on email account when possible
4. **Use app passwords** instead of account password
5. **Monitor email logs** for suspicious activity

### Password Security
1. **Minimum length**: 8 characters
2. **Complexity**: Mix of letters, numbers, symbols
3. **Hashing**: bcrypt with 12 salt rounds
4. **Reset tokens**: 1-hour expiry
5. **Account lockout**: 5 failed attempts = 15-minute lock

### Session Security
1. **Duration**: 24 hours
2. **httpOnly cookies**: Prevent XSS attacks
3. **Secure flag**: HTTPS only in production
4. **SameSite**: Strict mode
5. **Regular cleanup**: Remove expired sessions

### RBAC Security
1. **Principle of least privilege**: Users get minimum required access
2. **Regular audits**: Review user roles quarterly
3. **Session invalidation**: On role change, invalidate all sessions
4. **Admin actions logging**: Track all administrative changes
5. **Guest sandboxing**: Isolate guest access completely

---

## Environment Variables Reference

Complete `.env` configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rowbooster

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rahmatullah.musawi@schindler-hofmann.de
SMTP_PASS=your-app-password-here
SMTP_FROM=rahmatullah.musawi@schindler-hofmann.de

# Application
APP_URL=http://localhost:5000
NODE_ENV=development

# API Keys (Optional)
OPENAI_API_KEY=your-openai-key
VALUESERP_API_KEY=your-valueserp-key
PERPLEXITY_API_KEY=your-perplexity-key

# Feature Flags
ENABLE_GUEST_MODE=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_REGISTRATION=true
```

---

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials are correct
2. Verify network allows outbound SMTP connections
3. Check email inbox (and spam folder) for test emails
4. Review server logs for detailed error messages

### Users Cannot Login
1. Verify email is verified (if enabled)
2. Check account is not locked
3. Ensure account is active
4. Verify password is correct

### Permission Denied Errors
1. Check user role is correct
2. Verify session is valid
3. Ensure middleware is applied to route
4. Review permission matrix above

---

## Next Steps

1. ✅ Configure email service with SMTP credentials
2. ✅ Test email sending with test endpoint
3. ✅ Create first admin user
4. ✅ Test registration flow
5. ✅ Test email verification
6. ✅ Test password reset
7. ✅ Configure guest demo mode
8. ✅ Review and customize permissions
9. ✅ Deploy to production
10. ✅ Monitor email delivery logs

---

## Support

For issues or questions:
- Check server logs: `tail -f logs/app.log`
- Review this documentation
- Contact IT support for email-specific issues
- Submit bug reports to development team

**Last Updated:** 2025-11-20