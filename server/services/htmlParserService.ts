import axios from 'axios';
import * as cheerio from 'cheerio';
import { parse } from 'node-html-parser';

export interface ParsedContent {
  url: string;
  title: string;
  description: string;
  textContent: string;
  structuredData: any[];
  metaData: {
    keywords: string;
    author: string;
    language: string;
  };
  extractedSections: {
    productSpecs: string;
    technicalData: string;
    features: string;
    dimensions: string;
  };
}

export class HtmlParserService {
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private readonly REQUEST_TIMEOUT = 15000;

  /**
   * Parse HTML content from a given URL
   */
  async parseUrl(url: string): Promise<ParsedContent> {
    try {
      console.log(`Fetching content from URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: this.REQUEST_TIMEOUT,
        maxRedirects: 5
      });

      console.log(`Successfully fetched HTML content. Size: ${response.data.length} bytes`);
      
      return this.parseHtmlContent(response.data, url);
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
      throw new Error(`Failed to fetch content from URL: ${(error as Error).message}`);
    }
  }

  /**
   * Parse HTML content string
   */
  parseHtmlContent(htmlContent: string, url: string): ParsedContent {
    try {
      console.log(`Parsing HTML content for URL: ${url}`);
      
      const $ = cheerio.load(htmlContent);
      const root = parse(htmlContent);

      // Extract basic meta information
      const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const author = $('meta[name="author"]').attr('content') || '';
      const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '';

      // Extract structured data (JSON-LD)
      const structuredData: any[] = [];
      $('script[type="application/ld+json"]').each((i, script) => {
        try {
          const jsonData = JSON.parse($(script).html() || '{}');
          structuredData.push(jsonData);
        } catch (e) {
          console.log(`Skipping invalid JSON-LD at index ${i}`);
        }
      });

      // This will be handled later in the process

      // Only remove truly non-content elements - preserve everything else for comprehensive analysis
      root.querySelectorAll('script[src], style, noscript, link, meta').forEach(el => el.remove());
      
      // Better handling of React-based content - preserve more content for AI processing
      $('script:not([src])').each((i, script) => {
        const scriptContent = $(script).html() || '';
        
        // Extract React app data that contains API endpoints and product IDs
        if (scriptContent.includes('AppRegistry.registerInitialState') && scriptContent.includes('productId')) {
          try {
            const productIdMatch = scriptContent.match(/"productId":(\d+)/);
            const apiMatch = scriptContent.match(/"API":"([^"]+)"/);
            const localeMatch = scriptContent.match(/"locale":"([^"]+)"/);
            
            if (productIdMatch && apiMatch) {
              const reactData = {
                '@type': 'ReactAppData',
                apiEndpoint: apiMatch[1],
                productId: parseInt(productIdMatch[1]),
                locale: localeMatch ? localeMatch[1] : 'de',
                source: 'Nexus Product System'
              };
              structuredData.push(reactData);
              console.log(`Found React app data - API: ${apiMatch[1]}, Product ID: ${productIdMatch[1]}`);
              
              // Store API info for later processing
              (reactData as any).fetchApiData = true;
            }
          } catch (e) {
            // Continue processing
          }
        }
        
        // Preserve React script content that might contain product information
        if (scriptContent.includes('lotus-product') || scriptContent.includes('technical') || scriptContent.includes('specification')) {
          structuredData.push({
            '@type': 'ReactScriptContent',
            content: scriptContent.substring(0, 2000),
            source: 'React Component Script'
          });
        }
      });
      
      // Remove scripts but preserve their product-related content in text extraction
      root.querySelectorAll('script:not([src])').forEach(el => {
        const scriptContent = el.innerHTML;
        if (scriptContent && (scriptContent.includes('AppRegistry') || scriptContent.includes('nexus-prod') || scriptContent.includes('productId') || scriptContent.includes('lotus-product'))) {
          // Convert to text content that AI can process
          el.innerHTML = `REACT_DATA: ${scriptContent.replace(/[<>{}]/g, ' ').substring(0, 1000)}`;
        } else {
          el.remove();
        }
      });

      // Extract clean text content
      const textContent = this.extractCleanText(root);

      // Extract specific product-related sections
      const extractedSections = this.extractProductSections($, htmlContent);

      const parsedContent: ParsedContent = {
        url,
        title,
        description,
        textContent,
        structuredData,
        metaData: {
          keywords,
          author,
          language
        },
        extractedSections
      };

      console.log(`Successfully parsed content. Text length: ${textContent.length} characters`);
      return parsedContent;
    } catch (error) {
      console.error(`Failed to parse HTML content:`, error);
      throw new Error(`Failed to parse HTML content: ${(error as Error).message}`);
    }
  }

  /**
   * Extract clean text content from HTML - PRESERVE ALL CONTENT for AI processing
   */
  private extractCleanText(root: any): string {
    let cleanText = '';

    // Extract text from ALL elements - include everything for comprehensive analysis
    const allElements = root.querySelectorAll('*');
    
    allElements.forEach((element: any) => {
      const text = element.text?.trim();
      const classList = element.getAttribute('class') || '';
      const id = element.getAttribute('id') || '';
      const tagName = element.tagName?.toLowerCase() || '';
      
      // Include ALL text content - no filtering except completely empty text
      if (text && text.length > 0) {
        // Mark different content types for AI processing priority
        const isProductContent = this.isProductRelatedContent(text, classList, id);
        
        if (isProductContent || classList.includes('product') || classList.includes('spec') || 
            classList.includes('technical') || classList.includes('detail') || 
            id.includes('product') || id.includes('spec') || id.includes('technical')) {
          cleanText += `[PRIORITY-PRODUCT] ${text}\n`;
        } else if (tagName === 'table' || tagName === 'tr' || tagName === 'td' || tagName === 'th') {
          cleanText += `[TABLE-DATA] ${text}\n`;
        } else if (tagName === 'ul' || tagName === 'ol' || tagName === 'li' || tagName === 'dl' || tagName === 'dt' || tagName === 'dd') {
          cleanText += `[LIST-DATA] ${text}\n`;
        } else if (text.includes('mm') || text.includes('kg') || text.includes('kW') || 
                   text.includes('°C') || text.includes('%') || text.match(/[A-G]\+*/) ||
                   text.includes('Energieeffizienz') || text.includes('Effizienz') ||
                   text.includes('Breite') || text.includes('Höhe') || text.includes('Tiefe') || 
                   text.includes('Gewicht') || text.includes('Leistung') || text.includes('Wirkungsgrad')) {
          cleanText += `[TECHNICAL-VALUE] ${text}\n`;
        } else {
          // Include ALL other text content
          cleanText += `${text}\n`;
        }
      }
    });

    // Extract ALL table content - tables often contain specifications
    const tables = root.querySelectorAll('table');
    tables.forEach((table: any) => {
      const tableText = table.text?.trim();
      if (tableText && tableText.length > 10) {
        cleanText += `[TABLE-DATA] ${tableText}\n`;
      }
    });

    // Extract ALL list content - specifications are often in lists
    const lists = root.querySelectorAll('ul, ol, dl');
    lists.forEach((list: any) => {
      const listText = list.text?.trim();
      if (listText && listText.length > 10) {
        cleanText += `[LIST-DATA] ${listText}\n`;
      }
    });

    // Also extract any remaining structured content that might be hidden in React components
    const structuredElements = root.querySelectorAll('[class*="lotus-product"], [class*="nexus-prod"], [class*="specification"], [class*="technical"], [data-cid], [class*="product"], [class*="spec"], [class*="detail"]');
    structuredElements.forEach((element: any) => {
      const text = element.text?.trim();
      if (text && text.length > 5) {
        cleanText += `[STRUCTURED-DATA] ${text}\n`;
      }
    });

    return cleanText.trim();
  }

  /**
   * Check if text content is meaningful (not just navigation, footer, etc.)
   */
  private isMeaningfulText(text: string): boolean {
    const meaninglessPatterns = [
      /^(menu|navigation|nav|footer|header|sidebar)$/i,
      /^(home|about|contact|privacy|terms|cookies?)$/i,
      /^(login|register|sign in|sign up)$/i,
      /^(search|filter|sort)$/i,
      /^\s*[|•·\-_=]+\s*$/,
      /^(skip to|back to|go to).*$/i,
      /^(copyright|©|\(c\)).*$/i
    ];

    // Check if text matches any meaningless pattern
    if (meaninglessPatterns.some(pattern => pattern.test(text))) {
      return false;
    }

    // Text should be longer than just a few characters for navigation
    if (text.length < 10 && !/\d/.test(text)) {
      return false;
    }

    return true;
  }

  /**
   * Check if content is product-related based on text, class names, and IDs
   */
  private isProductRelatedContent(text: string, classList: string, id: string): boolean {
    // Check class names and IDs for product-related indicators
    const productIndicators = [
      'lotus-product', 'nexus-prod', 'product', 'specification', 'technical', 
      'accordion', 'details', 'data', 'feature', 'dimension', 'spec', 'tech',
      'eigenschaften', 'daten', 'info', 'information', 'detail', 'attribute',
      'parameter', 'value', 'wert', 'measure', 'unit', 'einheit'
    ];
    
    const hasProductClass = productIndicators.some(indicator => 
      classList.toLowerCase().includes(indicator) || id.toLowerCase().includes(indicator)
    );
    
    if (hasProductClass) {
      return true;
    }

    // Check text content for product-related keywords - much more comprehensive
    const lowerText = text.toLowerCase();
    const productKeywords = [
      // Technical specifications
      'technische daten', 'technical data', 'specifications', 'spezifikationen',
      'details zum produkt', 'product details', 'produktdetails',
      'eigenschaften', 'features', 'parameter', 'attribute',
      
      // Dimensions and measurements
      'abmessungen', 'dimensions', 'maße', 'größe', 'gewicht', 'weight',
      'breite', 'width', 'höhe', 'height', 'tiefe', 'depth', 'länge', 'length',
      'durchmesser', 'diameter', 'radius', 'volumen', 'volume',
      
      // Technical properties
      'leistung', 'power', 'energie', 'energy', 'material', 'farbe', 'color',
      'wirkungsgrad', 'efficiency', 'brennstoff', 'fuel', 'heizleistung',
      'schornsteinzug', 'rauchrohranschluss', 'zertifikat', 'certificate',
      'energieeffizienzklasse', 'energy efficiency class',
      
      // Identifiers
      'artikelnummer', 'article number', 'modell', 'model', 'typ', 'type',
      'serie', 'series', 'version', 'ean', 'gtin', 'mpn', 'sku',
      
      // Units and measurements
      'mm', 'cm', 'm', 'kg', 'g', 'kw', 'w', 'v', 'a', 'hz', '°c',
      'liter', 'bar', 'pa', 'db', 'nm', 'rpm', 'min', 'max',
      
      // Common German product terms
      'nennleistung', 'nennwärmeleistung', 'raumheizvermögen',
      'wasserseitiger wirkungsgrad', 'feuerungsautomatik',
      'brennstoffart', 'mindestwärmeleistung', 'maximalwärmeleistung',
      'temperaturbereich', 'betriebsdruck', 'anschlussdruck',
      'elektrische leistung', 'elektrischer anschluss',
      
      // English equivalents
      'nominal power', 'heating power', 'efficiency rating',
      'fuel type', 'operating temperature', 'operating pressure',
      'electrical connection', 'power consumption'
    ];

    return productKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Extract product-specific sections from HTML
   */
  private extractProductSections($: cheerio.CheerioAPI, htmlContent: string): ParsedContent['extractedSections'] {
    const sections = {
      productSpecs: '',
      technicalData: '',
      features: '',
      dimensions: ''
    };

    // Enhanced selectors for product specifications including React-based accordions
    const specSelectors = [
      '.product-specs', '.product-specifications', '.specifications', '.spec-table',
      '.tech-specs', '.technical-specifications', '.product-details-specs',
      '.lotus-product__accordion', '.lotus-product-accordion', '.lotus-product-accordion-content',
      '.sv-nexus-prod-micro-details', '.sv-nexus-prod-micro-technical-data',
      '.nexus-product-details', '.product__accordion', '.product-accordion',
      '[class*="spec"]', '[class*="technical"]', '[class*="accordion"]',
      '[id*="spec"]', '[id*="technical"]', '[id*="accordion"]',
      'details[class*="product"]', 'details[class*="accordion"]'
    ];

    // Enhanced selectors for technical data including React components
    const techDataSelectors = [
      '.technical-data', '.tech-data', '.product-data', '.technical-details',
      '.data-sheet', '.datasheet', '.lotus-product-technical-specification-item',
      '.sv-nexus-prod-micro-technical-data', '.nexus-product-technical-data',
      '.technical-specification-item', '.specification-item',
      '[class*="data"]', '[class*="tech"]', '[class*="specification"]'
    ];

    // Enhanced selectors for features including React components
    const featureSelectors = [
      '.features', '.product-features', '.key-features', '.highlights',
      '.benefits', '.sv-nexus-prod-micro-details', '.product-detail-items',
      '[class*="feature"]', '[class*="benefit"]', '[class*="detail"]'
    ];

    // Enhanced selectors for dimensions including React components
    const dimensionSelectors = [
      '.dimensions', '.measurements', '.size', '.product-dimensions',
      '.abmessungen', '.technical-specification-item',
      '[class*="dimension"]', '[class*="size"]', '[class*="measurement"]',
      '[class*="abmessungen"]'
    ];

    // Extract content for each section
    sections.productSpecs = this.extractSectionContent($, specSelectors);
    sections.technicalData = this.extractSectionContent($, techDataSelectors);
    sections.features = this.extractSectionContent($, featureSelectors);
    sections.dimensions = this.extractSectionContent($, dimensionSelectors);

    // Special handling for React-based accordion structures
    this.extractReactAccordionContent($, sections);

    // Also look for table content that might contain specifications
    const tables = $('table');
    tables.each((i, table) => {
      const tableText = $(table).text();
      if (this.containsProductData(tableText)) {
        if (!sections.productSpecs) {
          sections.productSpecs = tableText;
        } else {
          sections.productSpecs += '\n\n' + tableText;
        }
      }
    });

    return sections;
  }

  /**
   * Extract content from elements matching given selectors
   */
  private extractSectionContent($: cheerio.CheerioAPI, selectors: string[]): string {
    let content = '';
    
    selectors.forEach(selector => {
      $(selector).each((i, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 10) {
          content += text + '\n\n';
        }
      });
    });

    return content.trim();
  }

  /**
   * Special method to extract content from React-based accordion structures
   */
  private extractReactAccordionContent($: cheerio.CheerioAPI, sections: ParsedContent['extractedSections']): void {
    // Look for React accordion titles and content
    $('.lotus-product-accordion-title, .lotus-product__accordion summary').each((i, titleElement) => {
      const title = $(titleElement).text().trim().toLowerCase();
      
      // Find the corresponding content element
      let contentElement = $(titleElement).siblings('.lotus-product-accordion-content');
      if (contentElement.length === 0) {
        // Try looking for content in the parent details element
        contentElement = $(titleElement).parent().find('.lotus-product-accordion-content');
      }
      
      if (contentElement.length > 0) {
        const content = contentElement.text().trim();
        
        if (content && content.length > 10) {
          // Categorize content based on accordion title
          if (title.includes('technische daten') || title.includes('technical data') || title.includes('specifications')) {
            sections.technicalData += content + '\n\n';
          } else if (title.includes('details zum produkt') || title.includes('product details') || title.includes('features')) {
            sections.features += content + '\n\n';
          } else if (title.includes('abmessungen') || title.includes('dimensions') || title.includes('maße')) {
            sections.dimensions += content + '\n\n';
          } else {
            // Default to product specs for any other accordion content
            sections.productSpecs += `${title.toUpperCase()}:\n${content}\n\n`;
          }
        }
      }
    });

    // Also look for React component data attributes and structured content
    $('[data-cid*="technical"], [data-cid*="details"], [data-cid*="spec"]').each((i, element) => {
      const content = $(element).text().trim();
      if (content && content.length > 20) {
        sections.technicalData += content + '\n\n';
      }
    });

    // Extract content from elements with "specification-item" class structure
    $('.lotus-product-technical-specification-item, .technical-specification-item').each((i, element) => {
      const nameElement = $(element).find('.name, .spec-name');
      const specElement = $(element).find('.spec, .spec-value');
      
      if (nameElement.length > 0 && specElement.length > 0) {
        const name = nameElement.text().trim();
        const spec = specElement.text().trim();
        if (name && spec) {
          sections.technicalData += `${name}: ${spec}\n`;
        }
      }
    });

    // Look for any div elements that contain structured product data
    $('div[class*="product"], div[class*="specification"], div[class*="technical"]').each((i, element) => {
      const text = $(element).text().trim();
      if (this.containsProductData(text) && text.length > 30) {
        sections.productSpecs += text + '\n\n';
      }
    });
  }

  /**
   * Check if text contains product-related data
   */
  private containsProductData(text: string): boolean {
    const productKeywords = [
      // English keywords
      'specification', 'technical', 'dimension', 'weight', 'size', 'material',
      'power', 'voltage', 'current', 'capacity', 'performance', 'efficiency',
      'temperature', 'pressure', 'flow', 'speed', 'frequency', 'model',
      'part number', 'article number', 'sku', 'brand', 'manufacturer',
      
      // German keywords (from your webpage example)
      'technische daten', 'schornsteinzug', 'rauchrohranschluss', 'nennwärmeleistung',
      'wirkungsgrad', 'brennstoff', 'abmessungen', 'gewicht', 'höhe', 'breite', 'tiefe',
      'farbe', 'material', 'leistung', 'energie', 'heizleistung', 'durchmesser',
      'anschluss', 'zertifikat', 'norm', 'klasse', 'typ', 'modell', 'artikelnummer',
      'produktname', 'hersteller', 'marke', 'serie', 'verfügbar', 'erhältlich',
      'details zum produkt', 'produktdetails', 'spezifikationen', 'datenblatt',
      'technische spezifikationen', 'produktdaten', 'eigenschaften', 'merkmale',
      
      // Common measurement units and technical terms
      'mm', 'cm', 'kg', 'kw', 'pa', '°c', 'prozent', '%', 'durchmesser', 'ø'
    ];

    const lowerText = text.toLowerCase();
    return productKeywords.some(keyword => lowerText.includes(keyword));
  }



  /**
   * Generate a downloadable text content from parsed data
   */
  generateDownloadableContent(parsedContent: ParsedContent): string {
    let content = '';
    
    content += `URL: ${parsedContent.url}\n`;
    content += `Title: ${parsedContent.title}\n`;
    content += `Description: ${parsedContent.description}\n\n`;
    
    if (parsedContent.metaData.keywords) {
      content += `Keywords: ${parsedContent.metaData.keywords}\n`;
    }
    
    if (parsedContent.metaData.language) {
      content += `Language: ${parsedContent.metaData.language}\n`;
    }
    
    content += '\n' + '='.repeat(80) + '\n';
    content += 'EXTRACTED CONTENT\n';
    content += '='.repeat(80) + '\n\n';

    if (parsedContent.extractedSections.productSpecs) {
      content += 'PRODUCT SPECIFICATIONS:\n';
      content += '-'.repeat(40) + '\n';
      content += parsedContent.extractedSections.productSpecs + '\n\n';
    }

    if (parsedContent.extractedSections.technicalData) {
      content += 'TECHNICAL DATA:\n';
      content += '-'.repeat(40) + '\n';
      content += parsedContent.extractedSections.technicalData + '\n\n';
    }

    if (parsedContent.extractedSections.features) {
      content += 'FEATURES:\n';
      content += '-'.repeat(40) + '\n';
      content += parsedContent.extractedSections.features + '\n\n';
    }

    if (parsedContent.extractedSections.dimensions) {
      content += 'DIMENSIONS:\n';
      content += '-'.repeat(40) + '\n';
      content += parsedContent.extractedSections.dimensions + '\n\n';
    }

    if (parsedContent.structuredData.length > 0) {
      content += 'STRUCTURED DATA (JSON-LD):\n';
      content += '-'.repeat(40) + '\n';
      content += JSON.stringify(parsedContent.structuredData, null, 2) + '\n\n';
    }

    content += 'FULL TEXT CONTENT:\n';
    content += '-'.repeat(40) + '\n';
    content += parsedContent.textContent;

    return content;
  }

  /**
   * Format API data into readable text for AI processing
   */
  private formatApiDataForAI(apiData: any): string {
    if (!apiData || typeof apiData !== 'object') {
      return '';
    }

    let formattedContent = '[PRODUCT API DATA]\n\n';

    // Handle different API response structures
    if (apiData.product) {
      formattedContent += this.formatProductObject(apiData.product);
    } else if (apiData.data) {
      formattedContent += this.formatProductObject(apiData.data);
    } else {
      formattedContent += this.formatProductObject(apiData);
    }

    return formattedContent;
  }

  private formatProductObject(product: any): string {
    let content = '';

    // Basic product information
    if (product.name) content += `Product Name: ${product.name}\n`;
    if (product.title) content += `Title: ${product.title}\n`;
    if (product.sku || product.articleNumber) content += `Article Number: ${product.sku || product.articleNumber}\n`;
    if (product.model) content += `Model: ${product.model}\n`;
    if (product.brand) content += `Brand: ${product.brand}\n`;
    if (product.manufacturer) content += `Manufacturer: ${product.manufacturer}\n`;

    // Technical specifications
    if (product.specifications) {
      content += '\nTechnical Specifications:\n';
      content += this.formatSpecifications(product.specifications);
    }

    if (product.technicalData) {
      content += '\nTechnical Data:\n';
      content += this.formatSpecifications(product.technicalData);
    }

    if (product.attributes) {
      content += '\nAttributes:\n';
      content += this.formatSpecifications(product.attributes);
    }

    if (product.properties) {
      content += '\nProperties:\n';
      content += this.formatSpecifications(product.properties);
    }

    // Dimensions and measurements
    if (product.dimensions) {
      content += '\nDimensions:\n';
      content += this.formatDimensions(product.dimensions);
    }

    if (product.weight) content += `Weight: ${product.weight}\n`;
    if (product.height) content += `Height: ${product.height}\n`;
    if (product.width) content += `Width: ${product.width}\n`;
    if (product.depth) content += `Depth: ${product.depth}\n`;

    // Performance data
    if (product.performance) {
      content += '\nPerformance:\n';
      content += this.formatSpecifications(product.performance);
    }

    if (product.efficiency) content += `Efficiency: ${product.efficiency}\n`;
    if (product.power) content += `Power: ${product.power}\n`;
    if (product.heatingCapacity) content += `Heating Capacity: ${product.heatingCapacity}\n`;

    // Additional data
    if (product.features && Array.isArray(product.features)) {
      content += `\nFeatures: ${product.features.join(', ')}\n`;
    }

    if (product.description) content += `\nDescription: ${product.description}\n`;

    // Handle nested objects recursively
    Object.keys(product).forEach(key => {
      if (typeof product[key] === 'object' && 
          product[key] !== null && 
          !Array.isArray(product[key]) &&
          !['specifications', 'technicalData', 'attributes', 'properties', 'dimensions', 'performance'].includes(key)) {
        
        const nestedContent = this.formatProductObject(product[key]);
        if (nestedContent.trim()) {
          content += `\n${key.toUpperCase()}:\n${nestedContent}`;
        }
      }
    });

    return content;
  }

  private formatSpecifications(specs: any): string {
    if (!specs || typeof specs !== 'object') {
      return '';
    }

    let content = '';
    Object.entries(specs).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object') {
          content += `${key}: ${JSON.stringify(value)}\n`;
        } else {
          content += `${key}: ${value}\n`;
        }
      }
    });

    return content;
  }

  private formatDimensions(dimensions: any): string {
    if (!dimensions || typeof dimensions !== 'object') {
      return '';
    }

    let content = '';
    if (dimensions.height) content += `Height: ${dimensions.height}\n`;
    if (dimensions.width) content += `Width: ${dimensions.width}\n`;
    if (dimensions.depth) content += `Depth: ${dimensions.depth}\n`;
    if (dimensions.weight) content += `Weight: ${dimensions.weight}\n`;

    // Handle other dimension properties
    Object.entries(dimensions).forEach(([key, value]) => {
      if (!['height', 'width', 'depth', 'weight'].includes(key) && value) {
        content += `${key}: ${value}\n`;
      }
    });

    return content;
  }
}

export const htmlParserService = new HtmlParserService();