import puppeteer from 'puppeteer';
import { browserPool } from './browserPool';

export interface WorkingBrowserResult {
  url: string;
  title: string;
  content: string;
  method: 'browser-rendered';
  success: boolean;
  contentLength: number;
  hasJavaScript?: boolean;
  error?: string;
}

export class WorkingBrowserScraper {
  async scrapeUrl(url: string, articleNumber?: string): Promise<WorkingBrowserResult> {
    const startTime = Date.now();
    let browser;
    let page;
    
    try {
      console.log(`[WORKING-BROWSER] Starting scrape for: ${url}`);
      
      // Get browser from pool instead of creating new one
      const browserStartTime = Date.now();
      browser = await browserPool.getBrowser();
      console.log(`[TIMING] Got browser from pool in ${Date.now() - browserStartTime}ms`);
      
      page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`[WORKING-BROWSER] Page loaded after ${Date.now() - startTime}ms`);
      
      // Wait for dynamic content (reduced from 4s to 1s)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Wait for common product elements
      try {
        await page.waitForSelector('table, [class*="spec"], [class*="technical"], [class*="product"], .sv-portlet, .sv-text-portlet', {
          timeout: 5000
        });
      } catch (e) {
        console.log('[WORKING-BROWSER] No specific product elements found, continuing...');
      }
      
      // Extract content using a simple approach
      const extractedData = await page.evaluate(() => {
        // Get page title
        const pageTitle = document.title || 'No title';
        
        // Remove non-content elements
        const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, nav, header, footer');
        elementsToRemove.forEach(el => el.remove());
        
        // Extract text content
        const bodyElement = document.body;
        const textContent = bodyElement ? (bodyElement.innerText || bodyElement.textContent || '') : '';
        
        // Extract tables separately for better formatting
        const tables = document.querySelectorAll('table');
        let tableContent = '';
        tables.forEach((table, index) => {
          tableContent += `\n[TABLE ${index + 1}]\n`;
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowText = cells.map(cell => (cell.textContent || '').trim()).join(' | ');
            if (rowText) {
              tableContent += rowText + '\n';
            }
          });
        });
        
        // Combine content
        const fullContent = textContent + '\n' + tableContent;
        
        return {
          title: pageTitle,
          content: fullContent,
          hasJavaScript: true
        };
      });
      
      console.log(`[WORKING-BROWSER] Extracted ${extractedData.content.length} characters`);
      
      // Format content for AI processing
      let formattedContent = `[WEB CONTENT - ${url}]\n`;
      if (articleNumber) {
        formattedContent += `[ARTICLE NUMBER: ${articleNumber}]\n`;
      }
      formattedContent += `[TITLE: ${extractedData.title}]\n\n`;
      formattedContent += extractedData.content;
      
      return {
        url,
        title: extractedData.title,
        content: formattedContent,
        method: 'browser-rendered',
        success: extractedData.content.length > 500,
        contentLength: extractedData.content.length,
        hasJavaScript: extractedData.hasJavaScript
      };
      
    } catch (error) {
      console.error(`[WORKING-BROWSER] Error: ${(error as Error).message}`);
      return {
        url,
        title: 'Error',
        content: '',
        method: 'browser-rendered',
        success: false,
        contentLength: 0,
        error: (error as Error).message
      };
    } finally {
      // Clean up page but release browser back to pool
      if (page) await page.close().catch(() => {});
      if (browser) await browserPool.releaseBrowser(browser).catch(() => {});
      const totalTime = Date.now() - startTime;
      console.log(`[WORKING-BROWSER] Released browser back to pool for ${url} - Total time: ${totalTime}ms`);
    }
  }
}

export const workingBrowserScraper = new WorkingBrowserScraper();