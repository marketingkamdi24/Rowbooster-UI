import * as puppeteer from 'puppeteer';
import { browserPool } from './browserPool';

export interface BrowserScrapedContent {
  url: string;
  title: string;
  content: string;
  method: 'browser-rendered';
  success: boolean;
  contentLength: number;
  renderedHtmlLength?: number;
  hasJavaScript?: boolean;
  loadTime?: number;
  contentSample?: string;
  structuredContentSample?: string;
  debugInfo?: any;
}

export class BrowserScraper {
  // Use browser pool instead of creating new instances each time

  async scrapeUrl(url: string, articleNumber?: string): Promise<BrowserScrapedContent> {
    console.log(`[BROWSER] Scraping: ${url}`);
    
    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;
    const startTime = Date.now();
    
    try {
      // Get browser from pool
      const poolStatus = browserPool.getPoolStatus();
      console.log(`[BROWSER] Pool status: ${poolStatus.available}/${poolStatus.total} available`);
      
      browser = await browserPool.getBrowser();
      page = await browser.newPage();
      
      // Enable console logging from the page
      page.on('console', msg => console.log(`[BROWSER-CONSOLE] ${msg.text()}`));
      page.on('pageerror', error => console.log(`[BROWSER-ERROR] ${error.message}`));
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set a shorter timeout for faster response
      console.log(`[BROWSER] Navigating to ${url}...`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      console.log(`[BROWSER] Page loaded after ${Date.now() - startTime}ms`);
      
      // Wait for dynamic content and React/JS apps to load
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Try to wait for common product data elements to appear
      try {
        await page.waitForSelector('table, [class*="spec"], [class*="technical"], [class*="product"], [class*="detail"], [class*="nexus"], [class*="lotus"], .wt-product-card, .product-info, .product-data, .sv-text-portlet, .sv-portlet, [data-sv-field]', {
          timeout: 5000
        });
      } catch (e) {
        // Continue if specific selectors aren't found
        console.log('No specific product elements found, proceeding with general scraping');
      }
      
      // Additional wait for dynamic content to fully render
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });
      
      const result = await page.evaluate(() => {
        try {
          // First, remove ALL script-related content more aggressively
          const scriptsAndStyles = document.querySelectorAll(
            'script, style, noscript, link[rel="stylesheet"], meta'
          );
          scriptsAndStyles.forEach(el => el.remove());
          
          // Remove common non-content elements
          const nonContentSelectors = [
            'nav', 'header', 'footer', '.cookie', '.popup', '.modal',
            '.breadcrumb', '.navigation', '.menu', '.sidebar',
            '.advertisement', '.ad', '.banner', '.social-media',
            '#cookie-banner', '#privacy-banner', '.chat-widget',
            '.feedback-widget', '[class*="cookie"]', '[id*="cookie"]',
            '.privacy', '.gdpr', '.newsletter', '.subscribe',
            '[class*="popup"]', '[class*="modal"]', '[class*="overlay"]',
            '.cart', '.basket', '.wishlist', '.account', '.login',
            '.search-box', '.search-form', '[role="navigation"]',
            '[role="banner"]', '[role="contentinfo"]', '.mega-menu',
            '.dropdown-menu', '.submenu', '.social-links', '.share-buttons'
          ];
          
          nonContentSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.remove());
          });
          
          // Remove any remaining elements that might contain JavaScript
          document.querySelectorAll('*').forEach(el => {
            // Remove onclick handlers and other event attributes
            Array.from(el.attributes).forEach(attr => {
              if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
              }
            });
            
            // Remove elements with inline scripts in text content
            if (el.textContent && el.textContent.includes('function(') || 
                el.textContent && el.textContent.includes('document.') ||
                el.textContent && el.textContent.includes('window.')) {
              if (el.tagName !== 'BODY' && el.tagName !== 'HTML' && el.tagName !== 'MAIN' && el.tagName !== 'ARTICLE') {
                el.remove();
              }
            }
          });
          
          const title = document.title || 'No Title';
          
          // Focus on main content areas
          const contentSelectors = [
            'main', 'article', '[role="main"]', '#main', '#content',
            '.content', '.product-details', '.product-info',
            '.product-description', '.specifications', '.tech-specs',
            '.product-data', '.product-content', '[class*="product-detail"]',
            '[class*="specification"]', '[class*="technical"]'
          ];
          
          let mainContent = '';
          
          // Try to find main content area
          for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              elements.forEach(el => {
                const text = (el as HTMLElement).innerText;
                if (text && text.length > 100) {
                  mainContent += text + '\n\n';
                }
              });
              if (mainContent.length > 500) break; // Found good content
            }
          }
          
          // If no main content found, get body text but filter it
          if (mainContent.length < 500) {
            mainContent = document.body.innerText || '';
          }
          
          // Clean and filter the content
          const cleanedLines = mainContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
              // Remove empty lines
              if (line.length === 0) return false;
              
              // Remove lines that look like JavaScript
              if (line.includes('function(') || line.includes('document.') || 
                  line.includes('window.') || line.includes('var ') ||
                  line.includes('const ') || line.includes('let ') ||
                  line.includes('=>') || line.includes('async ') ||
                  line.includes('await ') || line.includes('if (') ||
                  line.includes('else {') || line.includes('});') ||
                  line.includes('})') || line.includes('({')) {
                return false;
              }
              
              // Remove lines that are too short (likely menu items)
              if (line.length < 3) return false;
              
              // Remove lines that are all uppercase (likely headers/menu)
              if (line === line.toUpperCase() && line.length < 30) return false;
              
              // Remove common UI elements
              const lowerLine = line.toLowerCase();
              const skipPatterns = [
                'cookie', 'privacy', 'accept', 'decline', 'close',
                'menu', 'search', 'cart', 'login', 'register',
                'subscribe', 'newsletter', 'share', 'follow us',
                'copyright', '©', 'all rights reserved', 'terms',
                'conditions', 'shipping', 'returns', 'contact us',
                'customer service', 'help', 'faq', 'my account'
              ];
              
              if (skipPatterns.some(pattern => lowerLine.includes(pattern))) {
                return false;
              }
              
              return true;
            })
            .join('\n');
          
          // Build structured content
          let structuredContent = `[PAGE TITLE]\n${title}\n\n`;
          structuredContent += `[PAGE URL]\n${window.location.href}\n\n`;
          structuredContent += `[MAIN CONTENT]\n${cleanedLines}\n`;
          
          // Extract clean structured data if available
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          const structuredData: any[] = [];
          
          jsonLdScripts.forEach(script => {
            try {
              const jsonData = JSON.parse(script.textContent || '{}');
              // Only include product-related structured data
              if (jsonData['@type'] === 'Product' || 
                  jsonData.type === 'Product' ||
                  (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Product'))) {
                structuredData.push(jsonData);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          });
          
          if (structuredData.length > 0) {
            structuredContent += '\n[STRUCTURED DATA]\n';
            structuredContent += JSON.stringify(structuredData, null, 2) + '\n';
          }
          
          return {
            title,
            content: structuredContent,
            contentLength: structuredContent.length,
            hasJavaScript: document.querySelectorAll('script').length > 0,
            renderedHtmlLength: document.documentElement.outerHTML.length
          };
        } catch (error) {
          return {
            title: 'Error',
            content: 'Error in page evaluation: ' + (error as any).message,
            contentLength: 0,
            hasJavaScript: false,
            renderedHtmlLength: 0
          };
        }
      });
      
      console.log(`[BROWSER] Scraping successful: ${result.contentLength} characters, JS detected: ${result.hasJavaScript}, HTML size: ${result.renderedHtmlLength}`);
      
      return {
        url,
        title: result.title,
        content: result.content,
        method: 'browser-rendered',
        success: result.contentLength > 500,
        contentLength: result.contentLength,
        renderedHtmlLength: result.renderedHtmlLength,
        hasJavaScript: result.hasJavaScript,
        contentSample: result.content.substring(0, 200),
        structuredContentSample: result.content.substring(0, 500),
        loadTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`[BROWSER] Scraping failed: ${(error as Error).message}`);
      console.error(`[BROWSER] Failed after ${Date.now() - startTime}ms`);
      console.error(`[BROWSER] Error details:`, {
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 5).join('\n')
      });
      
      return {
        url,
        title: 'Browser Scraping Failed',
        content: `Browser scraping failed: ${(error as Error).message}`,
        method: 'browser-rendered',
        success: false,
        contentLength: 0,
        debugInfo: { 
          error: (error as Error).message,
          timeElapsed: Date.now() - startTime
        }
      };
    } finally {
      // Always clean up page
      if (page) {
        await page.close().catch(() => {});
      }
      // Release browser back to pool instead of closing
      if (browser) {
        await browserPool.releaseBrowser(browser);
        console.log(`[BROWSER] Browser released back to pool for ${url}`);
      }
    }
  }
}

export const browserScraper = new BrowserScraper();