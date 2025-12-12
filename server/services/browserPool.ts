import * as puppeteer from 'puppeteer';

interface BrowserInstance {
  browser: puppeteer.Browser;
  inUse: boolean;
  lastUsed: number;
}

/**
 * Get the Chromium executable path based on the environment
 * - If PUPPETEER_EXECUTABLE_PATH env var is set, use it
 * - If running on Replit/Nix, use the Nix store path
 * - Otherwise, let Puppeteer use its bundled Chromium
 */
function getChromiumPath(): string | undefined {
  // Allow override via environment variable (most flexible)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('[BROWSER-POOL] Using PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Check if running on Replit (Nix environment)
  const nixChromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    const fs = require('fs');
    if (fs.existsSync(nixChromiumPath)) {
      console.log('[BROWSER-POOL] Detected Replit/Nix environment, using Nix Chromium');
      return nixChromiumPath;
    }
  } catch (e) {
    // fs.existsSync failed, proceed to default
  }
  
  // Check for common Chromium/Chrome paths on Linux servers (Render, etc.)
  const commonPaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  
  try {
    const fs = require('fs');
    for (const chromePath of commonPaths) {
      if (fs.existsSync(chromePath)) {
        console.log('[BROWSER-POOL] Found Chromium at:', chromePath);
        return chromePath;
      }
    }
  } catch (e) {
    // fs.existsSync failed, proceed to default
  }
  
  // Let Puppeteer use its bundled Chromium (works on most platforms)
  console.log('[BROWSER-POOL] Using Puppeteer bundled Chromium');
  return undefined;
}

export class BrowserPool {
  private pool: BrowserInstance[] = [];
  private maxBrowsers: number = 3; // Limit concurrent browsers
  private maxIdleTime: number = 30000; // 30 seconds idle before closing
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, 10000); // Check every 10 seconds
  }

  async getBrowser(): Promise<puppeteer.Browser> {
    // Try to find an available browser in the pool
    const availableBrowser = this.pool.find(instance => !instance.inUse);
    
    if (availableBrowser) {
      availableBrowser.inUse = true;
      availableBrowser.lastUsed = Date.now();
      console.log('[BROWSER-POOL] Reusing existing browser instance');
      return availableBrowser.browser;
    }

    // If pool is not full, create a new browser
    if (this.pool.length < this.maxBrowsers) {
      const browser = await this.createBrowser();
      const instance: BrowserInstance = {
        browser,
        inUse: true,
        lastUsed: Date.now()
      };
      this.pool.push(instance);
      console.log(`[BROWSER-POOL] Created new browser (pool size: ${this.pool.length}/${this.maxBrowsers})`);
      return browser;
    }

    // Wait for a browser to become available
    console.log('[BROWSER-POOL] All browsers in use, waiting...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.pool.find(instance => !instance.inUse);
        if (available) {
          clearInterval(checkInterval);
          available.inUse = true;
          available.lastUsed = Date.now();
          console.log('[BROWSER-POOL] Browser became available');
          resolve(available.browser);
        }
      }, 100);
    });
  }

  async releaseBrowser(browser: puppeteer.Browser): Promise<void> {
    const instance = this.pool.find(inst => inst.browser === browser);
    if (instance) {
      instance.inUse = false;
      instance.lastUsed = Date.now();
      
      // Close all pages except about:blank to free memory
      const pages = await browser.pages();
      for (const page of pages) {
        if (page.url() !== 'about:blank') {
          await page.close().catch(() => {});
        }
      }
      
      console.log('[BROWSER-POOL] Browser released back to pool');
    }
  }

  private async createBrowser(): Promise<puppeteer.Browser> {
    console.log('[BROWSER-POOL] Creating new browser instance...');
    
    const executablePath = getChromiumPath();
    
    // Build launch options
    const launchOptions: puppeteer.LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process', // Helps with memory on constrained environments
        '--memory-pressure-off',
      ],
      timeout: 30000
    };
    
    // Only set executablePath if we found one
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    
    try {
      const browser = await puppeteer.launch(launchOptions);
      console.log('[BROWSER-POOL] Browser instance created successfully');
      return browser;
    } catch (error) {
      console.error('[BROWSER-POOL] Failed to create browser instance:', error);
      throw error;
    }
  }

  private async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const instance = this.pool[i];
      
      if (!instance.inUse && (now - instance.lastUsed) > this.maxIdleTime) {
        try {
          await instance.browser.close();
          this.pool.splice(i, 1);
          console.log(`[BROWSER-POOL] Closed idle browser (pool size: ${this.pool.length}/${this.maxBrowsers})`);
        } catch (error) {
          console.error('[BROWSER-POOL] Error closing idle browser:', error);
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('[BROWSER-POOL] Closing all browsers...');
    for (const instance of this.pool) {
      try {
        await instance.browser.close();
      } catch (error) {
        console.error('[BROWSER-POOL] Error closing browser:', error);
      }
    }
    this.pool = [];
    console.log('[BROWSER-POOL] All browsers closed');
  }

  getPoolStatus(): { total: number; inUse: number; available: number } {
    const inUse = this.pool.filter(inst => inst.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse
    };
  }
}

// Create a singleton instance
export const browserPool = new BrowserPool();

// Cleanup on process exit
process.on('exit', () => {
  browserPool.closeAll();
});

process.on('SIGINT', () => {
  browserPool.closeAll().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  browserPool.closeAll().then(() => process.exit(0));
});