# Azure Deployment Guide for Rowbooster

This guide provides step-by-step instructions for deploying Rowbooster to Microsoft Azure using the VS Code Azure extension.

## ⚠️ Important Notice

**This is a FULL-STACK application** (React frontend + Express backend + PostgreSQL database), NOT a static web app. You need to deploy it to **Azure App Service** (Web App), not Azure Static Web Apps.

## Prerequisites

Before deploying, ensure you have:

1. ✅ **Azure Account** with an active subscription
2. ✅ **VS Code** installed with the **Azure App Service extension**
3. ✅ **Node.js 18+** installed locally
4. ✅ **PostgreSQL database** (Azure Database for PostgreSQL or external)
5. ✅ **API Keys** for OpenAI, ValueSerp, etc.

## Step 1: Install VS Code Azure Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for **"Azure App Service"**
4. Install the extension by Microsoft
5. Sign in to your Azure account when prompted

## Step 2: Prepare Your Database

### Option A: Azure Database for PostgreSQL (Recommended)

1. Go to [Azure Portal](https://portal.azure.com)
2. Create **Azure Database for PostgreSQL Flexible Server**
3. Configure:
   - Server name: `rowbooster-db`
   - Admin username: `postgres`
   - Admin password: (choose a secure password)
   - Compute + Storage: Basic tier is sufficient to start
   - **IMPORTANT**: Under "Networking", allow Azure services and your IP
4. After creation, note the connection string:
   ```
   postgresql://postgres:YOUR_PASSWORD@rowbooster-db.postgres.database.azure.com:5432/postgres?sslmode=require
   ```

### Option B: External PostgreSQL Database

Use your existing PostgreSQL connection string.

## Step 3: Build the Application Locally (Test)

Before deploying, test the build process locally:

```bash
npm install
npm run build
```

This should create a `dist` folder with:
- `dist/public/` - Frontend build
- `dist/index.js` - Backend bundle

## Step 4: Create Azure Web App

### Using VS Code:

1. Open your project in VS Code
2. Click on **Azure icon** in the Activity Bar (left sidebar)
3. Under **APP SERVICE**, click the **+** icon (Create New Web App)
4. Follow the prompts:
   - **Enter a unique name**: `rowbooster-app` (or your preferred name)
   - **Select a runtime stack**: Choose **Node 18 LTS** or **Node 20 LTS**
   - **Select a pricing tier**: Choose **Free (F1)** for testing, or **Basic (B1)** for production
5. Wait for the Web App to be created (this takes 1-2 minutes)

## Step 5: Configure Environment Variables in Azure

**CRITICAL STEP**: You must configure all environment variables BEFORE deployment.

### Using Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Web App (`rowbooster-app`)
3. In the left menu, go to **Configuration** → **Application settings**
4. Click **+ New application setting** for each variable:

```plaintext
DATABASE_URL = postgresql://postgres:PASSWORD@rowbooster-db.postgres.database.azure.com:5432/postgres?sslmode=require
OPENAI_API_KEY = your_openai_api_key_here
VALUESERP_API_KEY = your_valueserp_api_key_here
PERPLEXITY_API_KEY = your_perplexity_api_key_here (optional)
GOOGLE_API_KEY = your_google_api_key_here (optional)
GOOGLE_CX = your_google_cx_here (optional)
NODE_ENV = production
PORT = 8080
WEBSITE_NODE_DEFAULT_VERSION = 18-lts
SCM_DO_BUILD_DURING_DEPLOYMENT = true
```

5. Click **Save** at the top
6. Click **Continue** when prompted about restart

### Using VS Code (Alternative):

1. In VS Code, click the Azure icon
2. Right-click on your Web App → **Open in Portal**
3. Follow the steps above

## Step 6: Deploy Using VS Code

### Method 1: Direct Deploy (Recommended)

1. In VS Code, open your project folder
2. Click the **Azure icon** in the Activity Bar
3. Under **APP SERVICE**, find your Web App (`rowbooster-app`)
4. **Right-click** on your Web App
5. Select **Deploy to Web App...**
6. When prompted:
   - Confirm the folder to deploy (should be your project root)
   - Click **Deploy**
7. Wait for deployment to complete (3-5 minutes)
8. When prompted "Always deploy...", choose **Yes** for future deployments

### Method 2: Using Command Palette

1. Press **Ctrl+Shift+P** (or Cmd+Shift+P on Mac)
2. Type: **Azure App Service: Deploy to Web App**
3. Select your Web App from the list
4. Confirm deployment

## Step 7: Initialize Database Tables

After first deployment, you need to initialize the database:

1. In Azure Portal, go to your Web App
2. Go to **Console** (under Development Tools in left menu)
3. Run:
   ```bash
   node dist/index.js
   ```
   This will run the initialization scripts and create tables

Alternatively, connect to your Azure PostgreSQL database using a tool like pgAdmin and run the SQL scripts from the `scripts/` folder.

## Step 8: Verify Deployment

1. In VS Code Azure extension, right-click your Web App
2. Select **Browse Website**
3. Your application should open in the browser
4. Test the login and core features

**Your app URL will be**: `https://rowbooster-app.azurewebsites.net`

## Common Issues & Solutions

### Issue 1: "Application Error" or 500 Error

**Solution**:
- Check Application Logs in Azure Portal:
  - Go to **Monitoring** → **Log stream**
  - Look for errors related to missing environment variables or database connection
- Verify all environment variables are set correctly
- Check `DATABASE_URL` format includes `?sslmode=require` for Azure PostgreSQL

### Issue 2: Database Connection Failed

**Solution**:
- Verify PostgreSQL firewall rules allow Azure services
- Check connection string format
- Test connection using pgAdmin or another client

### Issue 3: Build Fails During Deployment

**Solution**:
- Ensure `package.json` has the correct `build:azure` script
- Check deployment logs in VS Code Output panel
- Try building locally first: `npm run build`

### Issue 4: Node Version Mismatch

**Solution**:
- Add to Application Settings: `WEBSITE_NODE_DEFAULT_VERSION = 18-lts`
- Restart the Web App

### Issue 5: "ENOENT" or File Not Found Errors

**Solution**:
- Ensure `web.config` and `.deployment` files are in project root
- Verify `dist` folder structure after build
- Check file paths are relative, not absolute

## Monitoring & Logs

### View Logs in VS Code:

1. Click Azure icon
2. Right-click your Web App
3. Select **Start Streaming Logs**

### View Logs in Azure Portal:

1. Go to your Web App
2. Navigate to **Monitoring** → **Log stream**
3. Or download logs: **Monitoring** → **Diagnose and solve problems**

## Updating Your Deployment

When you make changes to your code:

1. Test locally: `npm run build && npm run start`
2. Commit your changes to Git (optional but recommended)
3. In VS Code Azure extension:
   - Right-click your Web App
   - Select **Deploy to Web App...**
4. Deployment will automatically build and deploy

## Performance Optimization

After successful deployment:

1. **Scale Up**: In Azure Portal → **Scale up (App Service plan)** → Choose higher tier
2. **Enable Always On**: Configuration → General settings → Always On = On
3. **Add CDN**: For faster static file delivery
4. **Connection Pooling**: Already configured in your app

## Security Checklist

- ✅ All API keys stored in Application Settings (not in code)
- ✅ Database uses SSL connection (`sslmode=require`)
- ✅ HTTPS enabled by default on Azure
- ✅ Firewall rules configured for database
- ✅ Strong admin password for PostgreSQL

## Cost Estimation

- **Free Tier (F1)**: $0/month - Good for testing
- **Basic (B1)**: ~$13/month - Recommended for small production
- **Standard (S1)**: ~$70/month - Production with auto-scaling
- **Azure PostgreSQL**: ~$25-100/month depending on size

## Need Help?

If deployment fails, check:
1. VS Code Output panel (Azure App Service section)
2. Azure Portal → Your Web App → Log stream
3. Common issues section above

## Files Created for Azure Deployment

The following configuration files have been created:

- ✅ [`web.config`](web.config) - IIS configuration for Azure App Service
- ✅ [`.deployment`](.deployment) - Azure deployment configuration
- ✅ [`deploy.cmd`](deploy.cmd) - Custom deployment script
- ✅ [`package.json`](package.json) - Updated with `build:azure` script

These files ensure proper deployment and configuration on Azure.