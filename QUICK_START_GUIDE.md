# Rowbooster - Quick Start Guide

## 🚀 One-Command Setup

### Windows
```bash
setup.bat
```

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
```

That's it! The script will:
1. ✅ Create `.env` file from template
2. ✅ Install all dependencies
3. ✅ Set up the database
4. ✅ Run migrations
5. ✅ Start the application

---

## 📋 Prerequisites

Before running the setup script, ensure you have:

1. **Node.js 18+** installed
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **PostgreSQL** installed and running
   ```bash
   # Windows (via pgAdmin or services)
   # Linux/Mac
   sudo systemctl status postgresql
   ```

3. **Gmail App Password** for rowbooster.app@gmail.com (optional but recommended)
   - See `EMAIL_SETUP_QUICK_REFERENCE.md` for instructions

---

## ⚙️ Configuration (Before Running Setup)

### Step 1: Get Your Database URL

**Option A: Local PostgreSQL**
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/rowbooster
```

**Option B: Cloud Database (Render, Supabase, etc.)**
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### Step 2: Get Gmail App Password (Optional)

1. Go to Google Account for rowbooster.app@gmail.com
2. Security → 2-Step Verification → App passwords
3. Create new app password named "rowbooster"
4. Copy the 16-character password

### Step 3: Update .env File

The setup script will create `.env` from `.env.example`. Update these values:

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster

# Email (Recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rowbooster.app@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # Your Gmail app password
SMTP_FROM=rowbooster.app@gmail.com

# Application
APP_URL=http://localhost:5000
NODE_ENV=development

# Optional (can be configured in UI)
OPENAI_API_KEY=your-key-here
VALUESERP_API_KEY=your-key-here
```

---

## 🎯 Complete Setup Process

### Method 1: Automated Setup (Recommended)

**Windows:**
```bash
# 1. Clone/download the project
cd rowbooster-nov-20

# 2. Run setup script
setup.bat

# 3. Access the app
# Open browser: http://localhost:5000
```

**Linux/Mac:**
```bash
# 1. Clone/download the project
cd rowbooster-nov-20

# 2. Make script executable and run
chmod +x setup.sh
./setup.sh

# 3. Access the app
# Open browser: http://localhost:5000
```

### Method 2: Manual Setup

If you prefer manual control:

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env with your configuration

# 3. Setup database
npm run db:push

# 4. Start the application
npm run dev
```

---

## 🌐 Access the Application

After successful setup:

1. **Landing Page:** http://localhost:5000
2. **Login:** http://localhost:5000/login
3. **Register:** http://localhost:5000/register

### Default Admin Account

Create the first admin user:

**Option 1: Via Registration**
- Register through UI
- Manually update database to set role='admin'

**Option 2: Via Database Script**
```bash
npm run db:seed-admin
```

---

## 📧 Email Setup (Post-Installation)

If you skipped email configuration during setup:

1. Get Gmail app password (see `EMAIL_SETUP_QUICK_REFERENCE.md`)
2. Update `.env` file with SMTP credentials
3. Restart the application
4. Test email: `GET /api/auth/test-email` (as admin)

---

## ✅ Verification Checklist

After running the setup script:

- [ ] Application starts without errors
- [ ] Database connection successful
- [ ] Landing page loads at http://localhost:5000
- [ ] Registration page works
- [ ] Login page works
- [ ] Email service configured (check logs)

---

## 🐛 Troubleshooting

### "Cannot connect to database"
**Solution:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Test connection: `psql $DATABASE_URL`

### "npm install fails"
**Solution:**
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Check Node.js version (needs 18+)

### "Email not working"
**Solution:**
1. Check SMTP credentials in `.env`
2. Verify Gmail app password is correct
3. Check server logs for email errors
4. See `EMAIL_SETUP_QUICK_REFERENCE.md`

### "Port 5000 already in use"
**Solution:**
1. Change port in `.env`: `PORT=3000`
2. Or stop other service using port 5000

### "Database migration fails"
**Solution:**
1. Ensure database exists: `CREATE DATABASE rowbooster;`
2. Check user permissions
3. Run manually: `npm run db:push`

---

## 📁 Project Structure

```
rowbooster-nov-20/
├── client/               # Frontend React application
│   └── src/
│       ├── pages/       # Landing, Login, Register pages
│       └── components/  # UI components
├── server/              # Backend Express application
│   ├── services/        # Email, OpenAI services
│   ├── authRoutes.ts   # Authentication endpoints
│   └── routes.ts       # API routes
├── shared/              # Shared types and schemas
├── setup.sh            # One-command setup (Linux/Mac)
├── setup.bat           # One-command setup (Windows)
├── .env.example        # Environment template
└── package.json        # Dependencies
```

---

## 📚 Additional Documentation

- **Email Configuration:** `EMAIL_SETUP_QUICK_REFERENCE.md`
- **RBAC & Permissions:** `EMAIL_AND_RBAC_SETUP.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Development Guide:** `DEVELOPMENT_GUIDE.md`

---

## 🔄 Development Workflow

### Starting Development
```bash
npm run dev
# App runs on http://localhost:5000
```

### Running in Production
```bash
npm run build
npm start
```

### Database Operations
```bash
# Push schema changes
npm run db:push

# Seed admin user
npm run db:seed-admin

# Check database
npm run check-database (if available)
```

---

## 🎉 Next Steps

After successful setup:

1. ✅ Access landing page
2. ✅ Register a new account
3. ✅ Check email for verification link
4. ✅ Verify email and login
5. ✅ Explore features
6. ✅ Configure API keys in Settings (optional)

---

## 💡 Tips

- **Email is optional:** App works without email, but verification emails won't be sent
- **API keys are optional:** Can be configured per-user in the UI
- **Guest mode available:** Try demo without registration
- **Admin panel:** Accessible only to admin users after login

---

## 🆘 Need Help?

1. Check troubleshooting section above
2. Review detailed documentation files
3. Check server logs for error messages
4. Verify all environment variables are set correctly

---

**Last Updated:** 2025-11-20
**Version:** 1.0.0