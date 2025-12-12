# Rowbooster

AI-powered product data extraction platform with advanced web scraping and PDF analysis.

---

## 🚀 Quick Start (One Command!)

### Windows
```bash
setup.bat
```

### Linux/Mac
```bash
chmod +x setup.sh && ./setup.sh
```

**That's it!** The script will:
- ✅ Install dependencies
- ✅ Set up database
- ✅ Configure environment
- ✅ Start the application

🌐 **Access:** http://localhost:5000

---

## 📋 Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL ([Download](https://www.postgresql.org/download/))
- Gmail app password for `rowbooster.app@gmail.com` (optional)

---

## ⚙️ Quick Configuration

Before running the setup, create `.env` from `.env.example` and configure:

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/rowbooster

# Email (Optional but recommended)
SMTP_USER=rowbooster.app@gmail.com
SMTP_PASS=your-16-char-app-password
```

💡 **Email Setup:** See [`EMAIL_SETUP_QUICK_REFERENCE.md`](EMAIL_SETUP_QUICK_REFERENCE.md)

---

## ✨ Features

### 🎯 Core Features
- **AI-Powered Data Extraction** - GPT-4 based intelligent property extraction
- **Multi-Source Web Scraping** - Automated search and data collection
- **PDF Intelligence** - Extract data from technical documents
- **Batch Processing** - Process multiple products simultaneously

### 🔐 Authentication & Security
- **Email Verification** - Secure account verification
- **Password Reset** - Forgot password functionality
- **Role-Based Access Control** - Admin, User, Guest roles
- **Guest/Demo Mode** - Try without registration
- **Session Management** - Secure 24-hour sessions
- **Account Lockout** - Protection against brute force

### 🎨 UI/UX
- **Professional Landing Page** - Modern, responsive design
- **User Registration** - Easy signup with email verification
- **Dashboard** - Intuitive property management
- **Responsive Design** - Works on all devices

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`QUICK_START_GUIDE.md`](QUICK_START_GUIDE.md) | **START HERE** - Complete setup guide |
| [`EMAIL_SETUP_QUICK_REFERENCE.md`](EMAIL_SETUP_QUICK_REFERENCE.md) | Gmail configuration for rowbooster.app@gmail.com |
| [`EMAIL_AND_RBAC_SETUP.md`](EMAIL_AND_RBAC_SETUP.md) | Detailed email & RBAC configuration |
| [`IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md) | Complete feature list & status |
| [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md) | Development workflow |

---

## 🏗️ Manual Setup (Alternative)

If you prefer manual control:

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Setup database
npm run db:push

# 4. Start application
npm run dev
```

---

## 📧 Email Configuration

**Project Email:** `rowbooster.app@gmail.com`
**App Password Name:** `rowbooster`

### Quick Setup:
1. Go to Google Account → Security → 2-Step Verification → App passwords
2. Create app password named "rowbooster"
3. Add to `.env`:
   ```env
   SMTP_USER=rowbooster.app@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx
   ```

See [`EMAIL_SETUP_QUICK_REFERENCE.md`](EMAIL_SETUP_QUICK_REFERENCE.md) for detailed instructions.

---

## 🎭 User Roles

### Admin
- Full system access
- User management
- All features + settings

### User
- Standard access
- All extraction features
- Profile management

### Guest
- Demo/read-only mode
- Limited searches
- No data persistence

---

## 🚢 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=your-production-db-url
APP_URL=https://your-domain.com
SMTP_USER=rowbooster.app@gmail.com
SMTP_PASS=your-app-password
```

---

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run db:push` | Push database schema |
| `npm run check` | Type check |

---

## 📁 Project Structure

```
rowbooster-nov-20/
├── client/                 # React frontend
│   └── src/
│       ├── pages/         # Landing, Login, Register
│       └── components/    # UI components
├── server/                # Express backend
│   ├── services/         # Email, AI services
│   ├── authRoutes.ts    # Authentication API
│   └── routes.ts        # Main API
├── shared/               # Shared types
├── setup.sh             # Setup script (Unix)
├── setup.bat            # Setup script (Windows)
└── .env.example         # Environment template
```

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change port in .env
PORT=3000
```

**Database connection fails:**
```bash
# Verify PostgreSQL is running
# Check DATABASE_URL in .env
```

**Email not working:**
```bash
# Verify SMTP credentials
# See EMAIL_SETUP_QUICK_REFERENCE.md
```

**See [`QUICK_START_GUIDE.md`](QUICK_START_GUIDE.md) for complete troubleshooting.**

---

## 🔄 Development Workflow

1. Make changes to code
2. App auto-reloads (development mode)
3. Test changes
4. Commit to version control

### Database Changes
```bash
# After modifying schema in shared/schema.ts
npm run db:push
```

---

## 🎯 First Steps After Setup

1. ✅ Access http://localhost:5000
2. ✅ Register new account
3. ✅ Check email for verification
4. ✅ Login and explore features
5. ✅ Configure API keys (optional)

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development guidelines.

---

## 📄 License

See [`LICENSE`](LICENSE) file for details.

---

## 🆘 Support

- **Documentation:** Check docs listed above
- **Issues:** Review troubleshooting sections
- **Email Setup:** See EMAIL_SETUP_QUICK_REFERENCE.md

---

## ✨ What's New

### Latest Features (v1.0.0)
- ✅ Professional landing page
- ✅ Email verification system
- ✅ Password reset functionality
- ✅ Guest/demo mode
- ✅ Role-based access control (RBAC)
- ✅ One-command setup scripts
- ✅ Comprehensive documentation

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-20  
**Email:** rowbooster.app@gmail.com
