# Quick Start Guide

## 🚀 Setup in 2 Steps

### Windows
```cmd
setup.bat
run.bat
```

### Linux/macOS
```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

### Any Platform (Node.js)
```bash
node setup
node run
```

---

## ✅ Prerequisites Checklist

Before running setup, ensure you have:

- [ ] Node.js 20.16.11+ installed
- [ ] PostgreSQL database (or Neon account)
- [ ] `.env` file created with:
  - `DATABASE_URL`
  - `OPENAI_API_KEY`

---

## 📝 Minimal .env Template

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
OPENAI_API_KEY="sk-your-key-here"
```

---

## 🎯 Default Access

Once running, open:
```
http://localhost:5000
```

**Login:**
- Username: `admin`
- Password: `admin123`

⚠️ **Change password immediately after first login!**

---

## 🔧 Troubleshooting

### Port Already in Use?
✅ **Automatic handling** - Scripts will try ports 5001-5100

### Database Error?
```bash
# Check your DATABASE_URL in .env
npm run db:push
```

### Build Failed?
```bash
npm install
npm run build
```

### Linux: Chromium Missing?
```bash
sudo apt-get install chromium-browser fonts-liberation
```

---

## 📚 Full Documentation

See [`SETUP_INSTRUCTIONS.md`](./SETUP_INSTRUCTIONS.md) for comprehensive guide.

---

## 🆘 Common Commands

```bash
# Development mode (with hot reload)
npm run dev

# Check TypeScript
npm run check

# Database migration
npm run db:push

# Production build
npm run build

# Start production server
npm start
```

---

## 🎛️ Environment Variables (Full List)

```env
# Required
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."

# Optional but recommended
VALUESERP_API_KEY="..."
PERPLEXITY_API_KEY="..."

# Optional configuration
NODE_ENV="production"
PORT=5000
PUPPETEER_EXECUTABLE_PATH="..."
```

---

## 📦 What Gets Installed?

### Node.js Dependencies (automatic)
- Express server
- React + Vite frontend
- PostgreSQL client
- OpenAI SDK
- Puppeteer for web scraping
- And ~100 more packages

### System Dependencies (Linux only, semi-automatic)
- Chromium browser
- Font libraries
- Graphics libraries

---

## ⚡ Performance Tips

### For Large Operations
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Custom Port
```env
# In .env file
PORT=8080
```

---

## 🔒 Security Notes

1. ✅ `.env` is in `.gitignore` - Never commit it!
2. ✅ Change default admin password
3. ✅ Use SSL for database connections
4. ✅ Rotate API keys regularly

---

## 🎉 Success Indicators

After setup completes, you should see:

```
[SUCCESS] Dependencies installed successfully
[SUCCESS] Database setup completed
[SUCCESS] Project built successfully
```

After running, you should see:

```
[INFO] Using port: 5000
[INFO] Starting server...
[INFO] Server will be available at: http://localhost:5000
```

---

## 📞 Need Help?

1. Check error messages in console
2. Verify `.env` file exists and is correct
3. Review [`SETUP_INSTRUCTIONS.md`](./SETUP_INSTRUCTIONS.md)
4. Check [`DOCUMENTATION.md`](./DOCUMENTATION.md)

---

## 🎨 Next Steps

After logging in:

1. Change admin password
2. Configure company settings
3. Add manufacturer preferences  
4. Import property definitions
5. Start extracting product data!

---

## 🏗️ Project Structure

```
project/
├── setup.bat / setup.sh / setup  # Setup scripts
├── run.bat / run.sh / run        # Run scripts
├── .env                          # Your configuration (create this!)
├── package.json                  # Dependencies
├── server/                       # Backend API
├── client/                       # Frontend React
└── dist/                         # Built app (after setup)
```

---

**Ready to start? Run the setup script for your platform! 🚀**