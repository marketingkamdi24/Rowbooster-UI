import { spawn } from 'child_process';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface AdvancedScrapedContent {
  url: string;
  title: string;
  content: string;
  method: 'http' | 'chromium' | 'enhanced';
  success: boolean;
  containsArticleNumber?: boolean;
  contentLength: number;
  debugInfo?: any;
}

export class AdvancedScraper {
  
  async scrapeUrl(url: string, articleNumber?: string, timeout = 30000): Promise<AdvancedScrapedContent> {
    console.log(`Advanced scraping: ${url}`);
    
    try {
      // First attempt: Traditional HTTP scraping
      const httpResult = await this.tryHttpScraping(url, articleNumber);
      
      // Check if HTTP scraping was successful and has meaningful content
      if (httpResult.success && httpResult.contentLength > 300) {
        console.log(`HTTP scraping successful with ${httpResult.contentLength} characters`);
        return httpResult;
      }
      
      // If HTTP failed or has minimal content, try Chromium-based scraping
      console.log(`HTTP scraping insufficient (${httpResult.contentLength} chars), trying Chromium...`);
      const chromiumResult = await this.tryChromiumScraping(url, timeout, articleNumber);
      
      if (chromiumResult.success) {
        return chromiumResult;
      }
      
      // Fall back to enhanced HTTP processing if Chromium fails
      console.log(`Chromium scraping failed, using enhanced HTTP processing...`);
      return await this.enhancedHttpProcessing(url, articleNumber);
      
    } catch (error) {
      console.error(`Advanced scraping failed for ${url}:`, error);
      return {
        url,
        title: 'Scraping Failed',
        content: `Failed to extract content: ${(error as Error).message}`,
        method: 'http',
        success: false,
        contentLength: 0
      };
    }
  }

  private async tryHttpScraping(url: string, articleNumber?: string): Promise<AdvancedScrapedContent> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
        maxRedirects: 5
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      const title = $('title').text().trim() || 'No Title';
      
      // Extract comprehensive content
      let content = this.extractComprehensiveContent($, html);
      
      const containsArticleNumber = articleNumber ? content.toLowerCase().includes(articleNumber.toLowerCase()) : undefined;
      
      return {
        url,
        title,
        content,
        method: 'http',
        success: content.length > 200,
        containsArticleNumber,
        contentLength: content.length
      };
      
    } catch (error) {
      return {
        url,
        title: 'HTTP Failed',
        content: `HTTP scraping failed: ${(error as Error).message}`,
        method: 'http',
        success: false,
        contentLength: 0
      };
    }
  }

  private async tryChromiumScraping(url: string, timeout: number, articleNumber?: string): Promise<AdvancedScrapedContent> {
    return new Promise((resolve) => {
      const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      
      const args = [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--virtual-time-budget=10000',
        '--run-all-compositor-stages-before-draw',
        '--dump-dom',
        url
      ];

      console.log(`Launching Chromium for ${url}...`);
      const chromium = spawn(chromiumPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeout
      });

      let output = '';
      let errorOutput = '';

      chromium.stdout?.on('data', (data) => {
        output += data.toString();
      });

      chromium.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      chromium.on('close', (code) => {
        if (code === 0 && output.length > 1000) {
          // Parse the dumped DOM
          const $ = cheerio.load(output);
          const title = $('title').text().trim() || 'Chromium Extracted';
          
          // Extract content from the rendered DOM
          let content = this.extractRenderedContent($, output);
          
          const containsArticleNumber = articleNumber ? content.toLowerCase().includes(articleNumber.toLowerCase()) : undefined;
          
          console.log(`Chromium scraping successful: ${content.length} characters`);
          resolve({
            url,
            title,
            content,
            method: 'chromium',
            success: content.length > 200,
            containsArticleNumber,
            contentLength: content.length,
            debugInfo: { code, errorOutput: errorOutput.substring(0, 500) }
          });
        } else {
          console.log(`Chromium failed with code ${code}, output length: ${output.length}`);
          resolve({
            url,
            title: 'Chromium Failed',
            content: `Chromium scraping failed: code ${code}, error: ${errorOutput.substring(0, 200)}`,
            method: 'chromium',
            success: false,
            contentLength: 0,
            debugInfo: { code, errorOutput, outputLength: output.length }
          });
        }
      });

      chromium.on('error', (error) => {
        console.error(`Chromium spawn error:`, error);
        resolve({
          url,
          title: 'Chromium Error',
          content: `Chromium spawn error: ${error.message}`,
          method: 'chromium',
          success: false,
          contentLength: 0,
          debugInfo: { spawnError: error.message }
        });
      });
    });
  }

  private async enhancedHttpProcessing(url: string, articleNumber?: string): Promise<AdvancedScrapedContent> {
    try {
      // Try multiple HTTP requests with different strategies
      const strategies = [
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
          }
        },
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'de,en;q=0.9',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      ];

      for (const strategy of strategies) {
        try {
          const response = await axios.get(url, {
            headers: strategy.headers,
            timeout: 20000,
            maxRedirects: 3
          });

          const $ = cheerio.load(response.data);
          const title = $('title').text().trim() || 'Enhanced Extraction';
          
          // Use enhanced content extraction
          let content = this.extractComprehensiveContent($, response.data);
          
          if (content.length > 1000) {
            const containsArticleNumber = articleNumber ? content.toLowerCase().includes(articleNumber.toLowerCase()) : undefined;
            
            return {
              url,
              title,
              content,
              method: 'enhanced',
              success: true,
              containsArticleNumber,
              contentLength: content.length
            };
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Strategy failed: ${message}`);
          continue;
        }
      }
      
      throw new Error('All enhanced HTTP strategies failed');
      
    } catch (error) {
      return {
        url,
        title: 'Enhanced Failed',
        content: `Enhanced HTTP processing failed: ${(error as Error).message}`,
        method: 'enhanced',
        success: false,
        contentLength: 0
      };
    }
  }

  private extractComprehensiveContent($: cheerio.CheerioAPI, html: string): string {
    let content = '';
    
    // Extract meta information
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      content += `Description: ${metaDesc}\n\n`;
    }
    
    // Extract JSON-LD structured data (but only Product type)
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonContent = $(script).html();
        if (jsonContent) {
          const parsed = JSON.parse(jsonContent);
          // Only include product-related structured data
          if (parsed['@type'] === 'Product' || parsed.type === 'Product' ||
              (Array.isArray(parsed) && parsed.some(item => item['@type'] === 'Product'))) {
            content += `[STRUCTURED DATA] ${JSON.stringify(parsed, null, 2)}\n\n`;
          }
        }
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    });
    
    // Remove ALL script tags and other non-content elements more aggressively
    $('script, style, noscript, link[rel="stylesheet"], meta, iframe').remove();
    
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
      $(selector).remove();
    });
    
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
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((i, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 100) {
            mainContent += text + '\n\n';
          }
        });
        if (mainContent.length > 500) break; // Found good content
      }
    }
    
    // If no main content found, get body text but filter it
    if (mainContent.length < 500) {
      mainContent = $('body').text().trim() || '';
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
            line.includes('})') || line.includes('({') ||
            line.includes('new ') || line.includes('return ') ||
            line.includes('function ') || line.includes('.prototype') ||
            line.includes('this.') || line.includes('typeof ') ||
            line.includes('instanceof ') || line.includes('null') && line.includes('undefined')) {
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
    
    // Add the cleaned content to our result
    if (cleanedLines.length > 0) {
      content += `[MAIN CONTENT]\n${cleanedLines}\n`;
    }
    
    return content.trim();
  }

  private extractRenderedContent($: cheerio.CheerioAPI, html: string): string {
    // This processes content that was rendered by Chromium
    let content = '';
    
    // Remove scripts and styles from the rendered content
    $('script, style, noscript').remove();
    
    const title = $('title').text().trim();
    if (title) {
      content += `Page Title: ${title}\n\n`;
    }
    
    // Extract visible text content
    const bodyText = $('body').text().trim();
    if (bodyText.length > 100) {
      content += `Rendered Content:\n${bodyText}\n\n`;
    }
    
    // Extract any data attributes that might contain product info
    $('[data-*]').each((i, elem) => {
      const attrs = elem.attribs;
      for (const attr in attrs) {
        if (attr.startsWith('data-') && attrs[attr].length > 10 && attrs[attr].length < 500) {
          content += `[DATA ATTR] ${attr}: ${attrs[attr]}\n`;
        }
      }
    });
    
    return content.trim();
  }
}

export const advancedScraper = new AdvancedScraper();