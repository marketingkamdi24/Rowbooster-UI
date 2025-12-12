import axios from 'axios';
import * as cheerio from 'cheerio';
import { workingBrowserScraper } from './workingBrowserScraper';

export interface JSContentResult {
  success: boolean;
  content: string;
  method: 'html' | 'browser';
  contentLength: number;
  hasJavaScriptFramework: boolean;
  extractedData?: any;
  error?: string;
}

export class JSContentExtractor {
  
  async extractContent(url: string, articleNumber?: string): Promise<JSContentResult> {
    const extractStartTime = Date.now();
    console.log(`[JS-EXTRACTOR] Processing ${url}`);
    
    try {
      // First get the HTML to detect framework
      const httpStartTime = Date.now();
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
        timeout: 15000
      });
      const httpEndTime = Date.now();
      console.log(`[TIMING] HTTP request completed in ${httpEndTime - httpStartTime}ms`);

      const $ = cheerio.load(response.data);
      const hasFramework = this.detectJavaScriptFramework(response.data);
      
      console.log(`[JS-EXTRACTOR] Framework detection for ${url}: ${hasFramework ? 'JavaScript framework detected' : 'Static content'}`);
      
      // Log detected patterns for debugging
      if (hasFramework) {
        const detectedPatterns = this.getDetectedPatterns(response.data);
        console.log(`[JS-EXTRACTOR] Detected patterns: ${detectedPatterns.join(', ')}`);
      }

      // Always try browser scraping for better results (following URL mode architecture)
      if (hasFramework || response.data.length < 10000) {
        // Use browser scraping for JavaScript-heavy content or small HTML pages
        console.log('[JS-EXTRACTOR] Using browser scraping for dynamic content extraction');
        
        try {
          const browserStartTime = Date.now();
          const browserResult = await workingBrowserScraper.scrapeUrl(url, articleNumber);
          const browserEndTime = Date.now();
          console.log(`[TIMING] Browser scraping completed in ${browserEndTime - browserStartTime}ms`);
          
          console.log(`[JS-EXTRACTOR] Browser result: success=${browserResult.success}, contentLength=${browserResult.contentLength}`);
          if (browserResult.error) {
            console.log(`[JS-EXTRACTOR] Browser error:`, browserResult.error);
          }
          
          // REMOVED ALL CONTENT LENGTH REQUIREMENTS - accept any browser-scraped content
          if (browserResult.success && browserResult.content) {
            console.log(`[JS-EXTRACTOR] Browser scraping successful (${browserResult.contentLength} chars), returning browser content`);
            return {
              success: true,
              content: this.enhanceContentForAI(browserResult.content, url, articleNumber),
              method: 'browser',
              contentLength: browserResult.contentLength,
              hasJavaScriptFramework: true
            };
          } else {
            console.log(`[JS-EXTRACTOR] Browser scraping failed or returned no content`);
            if (!browserResult.success && browserResult.error) {
              console.log(`[JS-EXTRACTOR] Browser error: ${browserResult.error}`);
            }
          }
        } catch (browserError) {
          console.error(`[JS-EXTRACTOR] Browser scraping exception:`, browserError);
        }
      }

      // Fallback to enhanced HTML parsing
      console.log('[JS-EXTRACTOR] Falling back to enhanced HTML parsing');
      const staticContent = this.extractStaticContent($, response.data, url, articleNumber);
      
      console.log(`[JS-EXTRACTOR] Static content extracted: ${staticContent.length} characters`);
      
      // REMOVED ALL CONTENT LENGTH REQUIREMENTS - return any extracted content
      if (!staticContent || staticContent.length === 0) {
        console.log('[JS-EXTRACTOR] No static content extracted');
        return {
          success: false,
          content: '',
          method: 'html',
          contentLength: 0,
          hasJavaScriptFramework: hasFramework,
          error: `No content could be extracted from the page.`
        };
      }
      
      return {
        success: true,
        content: this.enhanceContentForAI(staticContent, url, articleNumber),
        method: 'html',
        contentLength: staticContent.length,
        hasJavaScriptFramework: hasFramework
      };

    } catch (error) {
      console.error(`JS Content Extractor failed: ${(error as Error).message}`);
      return {
        success: false,
        content: `Content extraction failed: ${(error as Error).message}`,
        method: 'html',
        contentLength: 0,
        hasJavaScriptFramework: false
      };
    }
  }

  private detectJavaScriptFramework(html: string): boolean {
    const frameworks = [
      'react', 'vue', 'angular', 'AppRegistry.registerInitialState',
      'window.React', 'window.Vue', 'ng-app', '__NUXT__',
      'data-reactroot', 'data-server-rendered', 'v-cloak',
      'nexus-product', 'lotus-product', 'dynamic-content',
      // Add more patterns for JavaScript frameworks and dynamic sites
      'sv-template', 'sv-js', 'AppRegistry.registerApp', 
      'AppRegistry.registerBootstrapData', 'sv-layout',
      'sv-custom-module', 'nexus-prod-micro', 'wt-', 
      'data-cid=', 'data-reactroot', 'webAppId',
      '__NEXT_DATA__', '_app.js', '_buildManifest.js',
      'hydrate', 'render(', 'createRoot('
    ];

    const lowerHtml = html.toLowerCase();
    return frameworks.some(framework => lowerHtml.includes(framework.toLowerCase()));
  }
  
  private getDetectedPatterns(html: string): string[] {
    const frameworks = [
      'react', 'vue', 'angular', 'AppRegistry.registerInitialState',
      'window.React', 'window.Vue', 'ng-app', '__NUXT__',
      'data-reactroot', 'data-server-rendered', 'v-cloak',
      'nexus-product', 'lotus-product', 'dynamic-content',
      'sv-template', 'sv-js', 'AppRegistry.registerApp', 
      'AppRegistry.registerBootstrapData', 'sv-layout',
      'sv-custom-module', 'nexus-prod-micro', 'wt-', 
      'data-cid=', 'data-reactroot', 'webAppId',
      '__NEXT_DATA__', '_app.js', '_buildManifest.js',
      'hydrate', 'render(', 'createRoot('
    ];

    const lowerHtml = html.toLowerCase();
    return frameworks.filter(framework => lowerHtml.includes(framework.toLowerCase()));
  }

  private extractStaticContent($: cheerio.CheerioAPI, html: string, url: string, articleNumber?: string): string {
    // Remove non-content elements
    $('script, style, noscript, iframe, nav, header, footer, .cookie, .popup, .modal').remove();

    let content = '';

    // Extract structured data first
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonContent = $(script).html();
        if (jsonContent) {
          const parsed = JSON.parse(jsonContent);
          if (parsed && typeof parsed === 'object') {
            content += `[STRUCTURED DATA]\n${JSON.stringify(parsed, null, 2)}\n\n`;
          }
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    });

    // Extract meta information
    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content');
    
    if (title) content += `Product: ${title}\n`;
    if (metaDesc) content += `Description: ${metaDesc}\n\n`;

    // Product-specific content extraction
    const productSelectors = [
      'table', 'dl', 'ul', 'ol',
      '[class*="spec"]', '[id*="spec"]',
      '[class*="technical"]', '[id*="technical"]',
      '[class*="detail"]', '[id*="detail"]',
      '[class*="product"]', '[id*="product"]',
      '[class*="info"]', '[id*="info"]',
      '.specifications', '.specs', '.details', '.features',
      'main', '#main', '#content', '.content'
    ];

    productSelectors.forEach(selector => {
      $(selector).each((i, element) => {
        let extractedText = '';
        
        // Special handling for tables to preserve cell boundaries
        if (selector === 'table' || $(element).is('table')) {
          $(element).find('tr').each((rowIndex, row) => {
            const cells: string[] = [];
            $(row).find('td, th').each((cellIndex, cell) => {
              const cellText = $(cell).text().trim();
              if (cellText) cells.push(cellText);
            });
            if (cells.length > 0) {
              extractedText += cells.join(' | ') + '\n';
            }
          });
        } 
        // Special handling for definition lists
        else if (selector === 'dl' || $(element).is('dl')) {
          $(element).find('dt').each((dtIndex, dt) => {
            const term = $(dt).text().trim();
            const definition = $(dt).next('dd').text().trim();
            if (term) {
              extractedText += term + (definition ? ': ' + definition : '') + '\n';
            }
          });
        }
        // For other elements, ensure space preservation between child elements
        else {
          // Clone element to avoid modifying original
          const clone = $(element).clone();
          
          // Add spaces between inline elements
          clone.find('*').each((idx, el) => {
            const $el = $(el);
            const display = $el.css('display') || 'inline';
            
            // Add space after block-level elements and certain inline elements
            if (display === 'block' || display === 'list-item' || 
                $el.is('br, p, div, li, h1, h2, h3, h4, h5, h6')) {
              $el.after('\n');
            } else if (display === 'inline' || display === 'inline-block') {
              // Add space after inline elements to prevent concatenation
              $el.after(' ');
            }
          });
          
          extractedText = clone.text()
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')
            .replace(/\s+/g, ' '); // Normalize spaces but preserve structure
        }
        
        if (extractedText && extractedText.length > 30 && extractedText.length < 8000) {
          content += `[${selector}]\n${extractedText}\n\n`;
        }
      });
    });

    // If minimal content, get body text with proper spacing
    if (content.length < 2000) {
      const $body = $('body').clone();
      
      // Add spaces between elements
      $body.find('*').each((idx, el) => {
        const $el = $(el);
        const display = $el.css('display') || 'inline';
        
        if (display === 'block' || $el.is('br, p, div, li, h1, h2, h3, h4, h5, h6')) {
          $el.after('\n');
        } else {
          $el.after(' ');
        }
      });
      
      const bodyText = $body.text()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .replace(/\s+/g, ' ');
      
      if (bodyText.length > 500) {
        content += `[BODY CONTENT]\n${bodyText}\n\n`;
      }
    }

    return content;
  }

  private enhanceContentForAI(content: string, url: string, articleNumber?: string): string {
    let enhancedContent = `URL: ${url}\n`;
    
    if (articleNumber) {
      enhancedContent += `Article Number: ${articleNumber}\n`;
    }

    enhancedContent += `\n[PRODUCT INFORMATION]\n`;
    enhancedContent += `The following content was extracted from a product webpage. `;
    enhancedContent += `Please extract technical specifications, measurements, and product details:\n\n`;
    enhancedContent += content;

    return enhancedContent;
  }
}

export const jsContentExtractor = new JSContentExtractor();