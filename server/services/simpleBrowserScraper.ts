import puppeteer from 'puppeteer';

export interface SimpleBrowserResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

export class SimpleBrowserScraper {
  async scrapeUrl(url: string): Promise<SimpleBrowserResult> {
    const startTime = Date.now();
    let browser;
    let page;
    
    try {
      console.log(`[SIMPLE-BROWSER] Starting scrape for: ${url}`);
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ],
        timeout: 20000
      });
      
      page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simple evaluation - just get text content
      const result = await page.evaluate(() => {
        // Get title
        const title = document.title || 'No title';
        
        // Get all text content
        const bodyText = document.body.innerText || document.body.textContent || '';
        
        return {
          title: title,
          content: bodyText
        };
      });
      
      console.log(`[SIMPLE-BROWSER] Scraped ${result.content.length} characters in ${Date.now() - startTime}ms`);
      
      return {
        url,
        title: result.title,
        content: result.content,
        success: true
      };
      
    } catch (error) {
      console.error(`[SIMPLE-BROWSER] Error: ${(error as Error).message}`);
      return {
        url,
        title: 'Error',
        content: '',
        success: false,
        error: (error as Error).message
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
}

export const simpleBrowserScraper = new SimpleBrowserScraper();