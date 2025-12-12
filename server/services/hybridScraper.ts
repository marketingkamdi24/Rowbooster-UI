import axios from 'axios';
import * as cheerio from 'cheerio';

export interface HybridScrapedContent {
  url: string;
  title: string;
  content: string;
  method: 'http' | 'enhanced';
  success: boolean;
  containsArticleNumber?: boolean;
  contentLength: number;
}

export class HybridScraper {
  
  async scrapeUrl(url: string, articleNumber?: string): Promise<HybridScrapedContent> {
    console.log(`Hybrid scraping: ${url}`);
    
    try {
      // First attempt: Traditional HTTP scraping
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
        maxRedirects: 5
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      // Check for JavaScript framework indicators
      const hasReactApp = html.includes('data-reactroot') || html.includes('React') || html.includes('__REACT_DEVTOOLS');
      const hasVueApp = html.includes('data-v-') || html.includes('Vue') || html.includes('__vue__');
      const hasAngularApp = html.includes('ng-app') || html.includes('angular') || html.includes('Angular');
      const hasComponentFramework = html.includes('data-cid') || html.includes('AppRegistry') || html.includes('svid');
      const hasMinimalContent = (html.match(/<p|<div|<span/g) || []).length < 10;
      const hasLotsOfScripts = (html.match(/<script/g) || []).length > 15;
      
      const isJavaScriptHeavy = hasReactApp || hasVueApp || hasAngularApp || hasComponentFramework || (hasMinimalContent && hasLotsOfScripts);
      
      console.log(`JavaScript framework detection:`, {
        react: hasReactApp,
        vue: hasVueApp,
        angular: hasAngularApp,
        componentFramework: hasComponentFramework,
        minimalContent: hasMinimalContent,
        manyScripts: hasLotsOfScripts,
        isJavaScriptHeavy
      });

      if (isJavaScriptHeavy) {
        console.log(`Detected JavaScript-heavy content, using enhanced extraction`);
        return await this.enhancedExtraction(url, html, articleNumber);
      } else {
        console.log(`Using standard HTML extraction`);
        return await this.standardExtraction(url, html, articleNumber);
      }
      
    } catch (error) {
      console.error(`Hybrid scraping failed for ${url}:`, error);
      return {
        url,
        title: 'Extraction Failed',
        content: `Failed to extract content: ${(error as Error).message}`,
        method: 'http',
        success: false,
        contentLength: 0
      };
    }
  }

  private async standardExtraction(url: string, html: string, articleNumber?: string): Promise<HybridScrapedContent> {
    const $ = cheerio.load(html);
    
    // Remove non-content elements
    $('script, style, noscript, iframe, nav, header, footer, .navigation, .menu, .nav').remove();
    
    const title = $('title').text().trim() || 'No Title';
    
    let content = '';
    
    // Extract meta information
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      content += `Description: ${metaDesc}\n\n`;
    }
    
    // Extract main content areas
    const mainSelectors = [
      'main', '#main', '#content', '.content', 'article',
      '[class*="product"]', '[id*="product"]',
      '[class*="detail"]', '[id*="detail"]',
      '[class*="spec"]', '[id*="spec"]'
    ];
    
    for (const selector of mainSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        if (text.length > 50) {
          content += `[${selector.toUpperCase()}] ${text}\n\n`;
        }
      }
    }
    
    // Extract tables (often contain specifications)
    $('table').each((i, table) => {
      const tableText = $(table).text().trim();
      if (tableText.length > 20) {
        content += `[TABLE ${i + 1}] ${tableText}\n\n`;
      }
    });
    
    // Extract lists that might contain specifications
    $('ul, ol, dl').each((i, list) => {
      const listText = $(list).text().trim();
      if (listText.length > 50 && listText.includes(':')) {
        content += `[LIST ${i + 1}] ${listText}\n\n`;
      }
    });
    
    // If still no meaningful content, extract paragraphs and headings
    if (content.length < 200) {
      $('h1, h2, h3, h4, h5, h6, p').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 10) {
          content += `${text}\n`;
        }
      });
    }
    
    const containsArticleNumber = articleNumber ? content.toLowerCase().includes(articleNumber.toLowerCase()) : undefined;
    
    return {
      url,
      title,
      content: content.trim(),
      method: 'http',
      success: content.length > 100,
      containsArticleNumber,
      contentLength: content.length
    };
  }

  private async enhancedExtraction(url: string, html: string, articleNumber?: string): Promise<HybridScrapedContent> {
    console.log(`Performing enhanced extraction for JavaScript-heavy page`);
    
    const $ = cheerio.load(html);
    const title = $('title').text().trim() || 'No Title';
    
    let content = '';
    
    // Extract any pre-rendered content from the initial HTML
    content += this.extractVisibleText($);
    
    // Try to extract from script tags that might contain data
    $('script:not([src])').each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent) {
        // Look for JSON data structures
        const jsonMatches = scriptContent.match(/\{[^{}]*"[^"]*"[^{}]*\}/g);
        if (jsonMatches) {
          jsonMatches.forEach(match => {
            try {
              const parsed = JSON.parse(match);
              if (parsed && typeof parsed === 'object') {
                const jsonText = JSON.stringify(parsed, null, 2);
                if (jsonText.length > 50) {
                  content += `[SCRIPT DATA] ${jsonText}\n\n`;
                }
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          });
        }
        
        // Look for product-related variable assignments
        const varMatches = scriptContent.match(/\w+\s*[:=]\s*["'][^"']*["']/g);
        if (varMatches) {
          varMatches.forEach(match => {
            if (match.toLowerCase().includes('product') || 
                match.toLowerCase().includes('spec') || 
                match.toLowerCase().includes('price') ||
                (articleNumber && match.toLowerCase().includes(articleNumber.toLowerCase()))) {
              content += `[SCRIPT VAR] ${match}\n`;
            }
          });
        }
      }
    });
    
    // Extract any structured data
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonContent = $(script).html();
        if (jsonContent) {
          const parsed = JSON.parse(jsonContent);
          content += `[STRUCTURED DATA] ${JSON.stringify(parsed, null, 2)}\n\n`;
        }
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    });
    
    // Extract meta properties
    $('meta[property], meta[name]').each((i, meta) => {
      const property = $(meta).attr('property') || $(meta).attr('name');
      const content_attr = $(meta).attr('content');
      if (property && content_attr && property.includes('product')) {
        content += `[META] ${property}: ${content_attr}\n`;
      }
    });
    
    const containsArticleNumber = articleNumber ? content.toLowerCase().includes(articleNumber.toLowerCase()) : undefined;
    
    return {
      url,
      title,
      content: content.trim(),
      method: 'enhanced',
      success: content.length > 50,
      containsArticleNumber,
      contentLength: content.length
    };
  }

  private extractVisibleText($: cheerio.CheerioAPI): string {
    // Only remove scripts and styles - preserve as much content as possible
    $('script[src], style, noscript').remove();
    
    let text = '';
    
    // Extract from ALL possible content containers - be comprehensive
    const contentSelectors = [
      // High priority product content
      '[class*="product"]', '[id*="product"]',
      '[class*="detail"]', '[id*="detail"]',
      '[class*="spec"]', '[id*="spec"]',
      '[class*="tech"]', '[id*="tech"]',
      '[class*="info"]', '[id*="info"]',
      
      // Lotus/Nexus specific
      '.lotus-product', '.sv-nexus-prod-micro',
      '[class*="lotus"]', '[class*="nexus"]',
      
      // Standard content areas
      'main', '#main', '#content', '.content', 'article', '.main-content',
      'section', 'div', 'aside',
      
      // Tables and lists (often contain specifications)
      'table', 'tbody', 'tr', 'td', 'th',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      
      // Text elements
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span',
      'label', 'strong', 'em', 'b', 'i'
    ];
    
    for (const selector of contentSelectors) {
      $(selector).each((i, element) => {
        const elementText = $(element).text().trim();
        
        // Much more lenient content filtering - preserve almost everything
        if (elementText && elementText.length > 1) {
          // Only exclude very obvious navigation items
          if (elementText.length < 15) {
            const isNavigation = /^(menu|nav|home|about|contact|login|register|search|back|next|prev|skip|close)$/i.test(elementText);
            if (isNavigation) {
              return;
            }
          }
          
          // Mark important content types for AI processing
          const className = $(element).attr('class') || '';
          const id = $(element).attr('id') || '';
          
          if (className.includes('product') || className.includes('spec') || 
              className.includes('lotus') || className.includes('nexus') ||
              id.includes('product') || id.includes('spec')) {
            text += `[PRIORITY-CONTENT] ${elementText}\n`;
          } else if (elementText.includes('mm') || elementText.includes('kg') || 
                     elementText.includes('kW') || elementText.includes('°C') || 
                     elementText.includes('%') || elementText.match(/[A-G]\+*/) ||
                     elementText.includes('Energieeffizienz') || 
                     elementText.includes('Breite') || elementText.includes('Höhe') || 
                     elementText.includes('Tiefe') || elementText.includes('Gewicht')) {
            text += `[TECHNICAL-VALUE] ${elementText}\n`;
          } else {
            text += `${elementText}\n`;
          }
        }
      });
    }
    
    return text;
  }

  private isNavigationContent(text: string): boolean {
    const navPatterns = [
      /^(menu|navigation|nav|footer|header|sidebar)$/i,
      /^(home|about|contact|privacy|terms|cookies?)$/i,
      /^(login|register|sign in|sign up)$/i,
      /^(search|filter|sort|back|next|previous)$/i,
      /^\s*[|•·\-_=]+\s*$/
    ];
    
    return navPatterns.some(pattern => pattern.test(text.trim()));
  }
}

export const hybridScraper = new HybridScraper();