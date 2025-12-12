import axios from 'axios';
import * as cheerio from 'cheerio';

export interface FastScrapedContent {
  url: string;
  title: string;
  content: string;
  method: 'fast-http';
  success: boolean;
  contentLength: number;
  hasStructuredData?: boolean;
  loadTime?: number;
  contentSample?: string;
  structuredContentSample?: string;
  debugInfo?: any;
}

export class FastScraper {
  private async enhancedHttpRequest(url: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
          'DNT': '1'
        },
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept all status codes below 500
      });

      const loadTime = Date.now() - startTime;
      return Object.assign(response, { loadTime });
    } catch (error) {
      const loadTime = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw Object.assign(errorObj, { loadTime });
    }
  }

  async scrapeUrl(url: string, articleNumber?: string): Promise<FastScrapedContent> {
    const startTime = Date.now();

    try {
      const response = await this.enhancedHttpRequest(url);
      const $ = cheerio.load(response.data);
      
      // Remove non-content elements that can interfere with extraction
      $('script, style, noscript, iframe, nav, header, footer, .cookie, .popup, .modal, .advertisement, .ad, .banner').remove();
      
      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim() || url;
      
      let content = '';
      
      // Priority 1: Extract structured data from JSON-LD
      let hasStructuredData = false;
      $('script[type="application/ld+json"]').each((i, script) => {
        try {
          const jsonContent = $(script).html();
          if (jsonContent) {
            const parsed = JSON.parse(jsonContent);
            content += `[STRUCTURED DATA]\n${JSON.stringify(parsed, null, 2)}\n\n`;
            hasStructuredData = true;
          }
        } catch (jsonError) {
          // Ignore malformed JSON-LD
        }
      });
      
      // Priority 2: Extract microdata
      $('[itemscope]').each((i, element) => {
        const $el = $(element);
        const itemType = $el.attr('itemtype') || '';
        if (itemType.includes('Product') || itemType.includes('Offer')) {
          content += `[MICRODATA - ${itemType}]\n`;
          $el.find('[itemprop]').each((j, prop) => {
            const $prop = $(prop);
            const propName = $prop.attr('itemprop');
            const propValue = $prop.attr('content') || $prop.text().trim();
            if (propName && propValue) {
              content += `${propName}: ${propValue}\n`;
            }
          });
          content += '\n';
        }
      });
      
      // Priority 3: Extract product specification tables and lists
      const productSelectors = [
        'table',
        'dl',
        'ul.specifications, ul.specs, ul.details',
        'ol.specifications, ol.specs, ol.details',
        '[class*="spec"]',
        '[id*="spec"]',
        '[class*="technical"]',
        '[id*="technical"]',
        '[class*="detail"]',
        '[id*="detail"]',
        '[class*="product"]',
        '[id*="product"]',
        '.specifications',
        '.specs',
        '.details',
        '.tech-specs',
        '.product-details'
      ];
      
      productSelectors.forEach(selector => {
        $(selector).each((i, element) => {
          const $el = $(element);
          const text = $el.text().trim();
          if (text.length > 50 && text.length < 5000) { // Reasonable content length
            content += `[${selector.toUpperCase()}]\n${text}\n\n`;
          }
        });
      });
      
      // Priority 4: Extract general content with focus on product information
      const contentSelectors = [
        'main',
        '.main-content',
        '.content',
        '.product-info',
        '.product-description',
        'article',
        '.article'
      ];
      
      contentSelectors.forEach(selector => {
        $(selector).each((i, element) => {
          const $el = $(element);
          const text = $el.text().trim();
          if (text.length > 100) {
            content += `[${selector.toUpperCase()}]\n${text.substring(0, 2000)}\n\n`;
          }
        });
      });
      
      // Fallback: Get body text if no specific content found
      if (content.length < 500) {
        const bodyText = $('body').text().trim();
        if (bodyText.length > 100) {
          content += `[BODY CONTENT]\n${bodyText.substring(0, 3000)}\n\n`;
        }
      }
      
      const loadTime = Date.now() - startTime;
      const contentLength = content.length;
      const success = contentLength > 200;
      
      return {
        url,
        title,
        content,
        method: 'fast-http',
        success,
        contentLength,
        hasStructuredData,
        loadTime,
        contentSample: content.substring(0, 500),
        structuredContentSample: hasStructuredData ? content.substring(0, 1000) : undefined,
        debugInfo: {
          originalHtmlLength: response.data.length,
          httpStatus: response.status,
          hasStructuredData,
          loadTime
        }
      };
      
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      return {
        url,
        title: url,
        content: '',
        method: 'fast-http',
        success: false,
        contentLength: 0,
        loadTime,
        debugInfo: {
          error: error instanceof Error ? error.message : String(error),
          loadTime
        }
      };
    }
  }
}

export const fastScraper = new FastScraper();