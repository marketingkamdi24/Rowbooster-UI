# Product Information Retrieval Platform - Setup Guide

## Quick Start

This project can be set up and run with a single command on both Windows and Linux systems.

### Windows

```cmd
setup.bat
run.bat
```

### Linux/Unix/macOS

```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

### Cross-Platform (Node.js based)

```bash
node setup
node run
```

---

## System Requirements

### Required Software

- **Node.js**: Version 20.16.11 or higher ([Download](https://nodejs.org/))
- **PostgreSQL**: Version 12+ (or use [Neon](https://neon.tech) serverless PostgreSQL)
- **RAM**: Minimum 2GB (4GB+ recommended for AI operations)
- **Storage**: At least 2GB free space

### Operating Systems

- ✅ Windows 10/11
- ✅ Linux (Ubuntu, Debian, CentOS, Fedora)
- ✅ macOS
- ✅ WSL (Windows Subsystem for Linux)

---

## Configuration

### 1. Environment Variables (.env file)

The `.env` file **MUST** exist in the project root directory before running setup. It should contain:

```env
# Database Configuration (REQUIRED)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# AI Service API Keys (At least one required)
OPENAI_API_KEY="your_openai_api_key_here"

# Search APIs (Optional but recommended)
VALUESERP_API_KEY="your_valueserp_api_key_here"
PERPLEXITY_API_KEY="your_perplexity_api_key_here"

# Application Environment
NODE_ENV="development"

# Server Port (optional - will auto-detect if not specified)
# PORT=5000

# Optional: Browser Configuration for Puppeteer
# PUPPETEER_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

### 2. Required API Keys

| Service | Purpose | Get API Key |
|---------|---------|-------------|
| **PostgreSQL Database** | Data storage | [Neon.tech](https://neon.tech) (free) or self-hosted |
| **OpenAI** | Primary AI service | [platform.openai.com](https://platform.openai.com/) |
| **ValueSERP** | Enhanced search | [valueserp.com](https://valueserp.com/) |
| **Perplexity** | Additional AI | [perplexity.ai](https://perplexity.ai/) |

---

## Installation

### Method 1: Platform-Specific Scripts (Recommended)

#### Windows

1. Ensure `.env` file exists with proper configuration
2. Run setup:
   ```cmd
   setup.bat
   ```
3. Wait for completion (this may take several minutes)
4. Run the application:
   ```cmd
   run.bat
   ```

#### Linux/Unix/macOS

1. Ensure `.env` file exists with proper configuration
2. Make scripts executable:
   ```bash
   chmod +x setup.sh run.sh
   ```
3. Run setup:
   ```bash
   ./setup.sh
   ```
4. Run the application:
   ```bash
   ./run.sh
   ```

### Method 2: Cross-Platform Node.js Scripts

Works on any platform with Node.js:

```bash
# Setup
node setup

# Run
node run
```

### Method 3: Manual Setup

If you prefer manual control:

```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Build project
npm run build

# Start production server
npm start
```

---

## Setup Process

The setup script performs the following steps:

1. ✅ **Verify Node.js Installation**: Checks if Node.js is installed and version
2. ✅ **Check .env File**: Ensures environment variables are configured
3. ✅ **Install Dependencies**: Runs `npm install` (may take 5-10 minutes)
4. ✅ **Install System Dependencies**: On Linux, installs Chromium for web scraping
5. ✅ **Setup Database**: Creates database schema using Drizzle ORM
6. ✅ **Build Project**: Compiles TypeScript and bundles frontend

---

## Running the Application

### Automatic Port Management

The run scripts automatically detect if the default port (5000) is in use and will try ports 5001-5100 until finding an available one.

**Example output:**
```
[WARNING] Port 5000 is already in use
[INFO] Using port: 5001
[INFO] Starting server...
[INFO] Server will be available at: http://localhost:5001
```

### Access the Application

Once started, open your browser and navigate to:
```
http://localhost:5000
```
(or the port shown in the startup message)

### Default Credentials

```
Username: admin
Password: admin123
```

**⚠️ IMPORTANT**: Change the admin password immediately after first login!

---

## Troubleshooting

### Node.js Not Found

**Windows:**
```cmd
# Download and install from nodejs.org
# Then restart your terminal
```

**Linux:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/Fedora
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### Database Connection Failed

1. Verify `DATABASE_URL` in `.env` file
2. Check database server is running
3. Ensure SSL mode is correct (`?sslmode=require` for Neon)
4. Test connection manually:
   ```bash
   npm run db:push
   ```

### Puppeteer/Chromium Issues

**Linux:**
```bash
# Install missing dependencies
sudo apt-get update
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libxss1 \
  libasound2
```

**Windows:**
Set `PUPPETEER_EXECUTABLE_PATH` in `.env`:
```env
PUPPETEER_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

### Build Fails

```bash
# Clear cache and rebuild
rm -rf dist/ node_modules/.vite/
npm install
npm run build
```

### Port Already in Use

The run scripts handle this automatically, but if needed manually:

**Windows:**
```cmd
# Find process using port
netstat -ano | findstr :5000
# Kill process by PID
taskkill /PID <PID> /F
```

**Linux:**
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9
```

---

## Advanced Configuration

### Custom Port

Set in `.env`:
```env
PORT=8080
```

### Memory Limits

For large operations:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Development Mode

```bash
npm run dev
```
This enables:
- Hot module reloading
- Detailed error messages
- Development logging

---

## Project Structure

```
.
├── setup.bat           # Windows setup script
├── run.bat            # Windows run script
├── setup.sh           # Linux setup script
├── run.sh             # Linux run script
├── setup              # Cross-platform setup (Node.js)
├── run                # Cross-platform run (Node.js)
├── .env               # Environment configuration (YOU MUST CREATE THIS)
├── package.json       # Dependencies and scripts
├── server/            # Backend API
├── client/            # Frontend React app
├── shared/            # Shared TypeScript definitions
└── dist/              # Built application (created by setup)
```

---

## Platform-Specific Notes

### Windows

- Scripts use `.bat` extension
- Paths use backslashes (`\`)
- Chromium installed via Puppeteer
- No special permissions needed

### Linux

- Scripts use `.sh` extension and need execute permission
- Paths use forward slashes (`/`)
- System dependencies installed via apt/yum/dnf
- May need `sudo` for system packages

### macOS

- Similar to Linux but uses Homebrew for packages
- May need Xcode Command Line Tools

### WSL (Windows Subsystem for Linux)

- Use Linux scripts (`.sh`)
- Full Linux compatibility
- Can access Windows filesystem

---

## Security Considerations

1. **Never commit `.env` file** - Contains sensitive API keys
2. **Change default admin password** - After first login
3. **Use SSL for database** - `sslmode=require` in connection string
4. **Rotate API keys regularly** - Especially in production
5. **Respect web scraping ethics** - Honor robots.txt and rate limits

---

## Performance Optimization

### Concurrency Settings

Adjust in `server/services/browserPool.ts`:
- Browser pool: Max 3 concurrent instances
- URL processing: Max 5 concurrent requests

### Memory Management

Monitor usage and adjust Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=8192" npm start
```

---

## Getting Help

If you encounter issues:

1. Check this documentation
2. Review error messages carefully
3. Verify all environment variables are set
4. Check system requirements are met
5. Try manual setup steps
6. Review logs in the console output

---

## Next Steps After Setup

1. ✅ Login with default credentials
2. ✅ Change admin password
3. ✅ Configure company settings
4. ✅ Add manufacturer preferences
5. ✅ Import property definitions (if needed)
6. ✅ Start extracting product data!

---

## License

MIT License - See LICENSE file for details