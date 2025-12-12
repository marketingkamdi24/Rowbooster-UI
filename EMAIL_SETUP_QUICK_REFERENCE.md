# Email Setup Quick Reference

## Gmail Account Details
- **Email Address:** `rowbooster.app@gmail.com`
- **App Password Name:** `rowbooster`

## Setup Instructions

### Step 1: Enable 2-Factor Authentication
1. Log into `rowbooster.app@gmail.com`
2. Go to Google Account → Security
3. Enable 2-Step Verification if not already enabled

### Step 2: Generate App Password
1. In Google Account → Security
2. Under "2-Step Verification", click "App passwords"
3. Select app: **Mail**
4. Select device: **Other (Custom name)**
5. Enter name: **rowbooster**
6. Click "Generate"
7. Copy the 16-character password (format: xxxx-xxxx-xxxx-xxxx)

### Step 3: Configure Environment Variables
Create/update `.env` file with:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rowbooster.app@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # Paste the 16-char app password here
SMTP_FROM=rowbooster.app@gmail.com

# Application URL
APP_URL=http://localhost:5000
```

### Step 4: Test Email Service
Start the application:
```bash
npm run dev
```

Test email configuration (as admin user):
```bash
curl -X GET http://localhost:5000/api/auth/test-email \
  -H "Cookie: sessionId=your-session-id"
```

Expected response:
```json
{
  "message": "Email service is configured and working",
  "configured": true
}
```

## Troubleshooting

### Problem: "Authentication failed"
- Verify you're using the app password, not your Gmail account password
- Check 2FA is enabled on the Gmail account
- Ensure app password name is exactly "rowbooster"
- Re-generate app password if needed

### Problem: "Connection timeout"
- Verify SMTP_HOST is `smtp.gmail.com`
- Verify SMTP_PORT is `587`
- Check firewall allows outbound connections on port 587

### Problem: "Emails not being sent"
- Check server logs for detailed error messages
- Verify the Gmail account is not locked or suspended
- Check Gmail's "Sent" folder to confirm emails were sent
- Check recipient's spam folder

## Email Templates Available

1. **Welcome Email** - Sent after successful registration
2. **Email Verification** - Contains verification link (24h expiry)
3. **Password Reset** - Contains reset link (1h expiry)
4. **Password Changed** - Confirmation after password update

## Security Notes

- ✅ Never commit `.env` file to version control
- ✅ App password is safer than account password
- ✅ Each app password is isolated and can be revoked independently
- ✅ Monitor "Recent security activity" in Google Account regularly
- ✅ Rotate app passwords quarterly

## Production Configuration

For production deployment:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rowbooster.app@gmail.com
SMTP_PASS=your-production-app-password
SMTP_FROM=rowbooster.app@gmail.com
APP_URL=https://your-production-domain.com
NODE_ENV=production
```

## Rate Limits

Gmail sending limits:
- **Per day:** 500 emails
- **Per message:** 500 recipients
- **Rate:** Avoid sending too many emails in quick succession

For higher volume, consider:
- Google Workspace (higher limits)
- SendGrid, Mailgun, or AWS SES for transactional emails

---

**Last Updated:** 2025-11-20
**Maintained by:** Rowbooster Team