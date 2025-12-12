import axios from "axios";
import * as cheerio from "cheerio";
import { parse } from "node-html-parser";
import { PropertyResult } from "@shared/schema";
import { browserScraper } from "./browserScraper";
import { fastScraper } from "./fastScraper";
import { jsContentExtractor } from "./jsContentExtractor";
import { valueSerpService } from "./valueSerpService";
import { MonitoringLogger } from "./monitoringLogger";

interface SearchProperty {
  id?: number;
  name: string;
  description?: string;
  expectedFormat?: string;
}

interface SearchResultProperties {
  [key: string]: PropertyResult;
}

interface SearchResult {
  articleNumber: string;
  productName: string;
  searchMethod: string;
  properties: SearchResultProperties;
}

// Get Google Search API Key and CX from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;

console.log(`Using Google API Key: ${GOOGLE_API_KEY ? "Configured" : "Not configured"}`);
console.log(`Using Google CX: ${GOOGLE_CX ? "Configured" : "Not configured"}`);

class SearchService {
  private lastSearchedUrl: string = ""; // Tracks the last direct URL search
  private manufacturerDomains: { name: string; websiteUrl: string; isActive: boolean }[] = [];
  private excludedDomains: { domain: string; reason: string; isActive: boolean }[] = [];
  
  // Helper method to create empty properties
  private createEmptyProperties(properties: SearchProperty[]): SearchResultProperties {
    const results: SearchResultProperties = {};
    for (const property of properties) {
      results[property.name] = {
        name: property.name,
        value: "Not found",
        sources: [],
        confidence: 0,
      };
    }
    return results;
  }
  
  // Process ValueSERP search results and format them for our application
  async processValueSerpResults(
    valueSerpResponse: any,
    articleNumber: string | undefined,
    productName: string,
    properties: SearchProperty[],
    maxResults: number = 10
  ) {
    console.log("Processing ValueSERP search results");
    
    try {
      // Extract organic search results
      const organicResults = valueSerpResponse.organic_results || [];
      console.log(`Found ${organicResults.length} organic results from ValueSERP`);
      
      if (organicResults.length === 0) {
        console.log("No organic results found in ValueSERP response");
        
        // Return empty results
        return {
          id: Date.now(), // Use timestamp as temporary ID
          searchMethod: "auto",
          searchStatus: "complete",
          products: [{
            id: articleNumber, // Use articleNumber as product ID
            articleNumber,
            productName,
            properties: this.createEmptyProperties(properties),
          }]
        };
      }
      
      // Convert ValueSERP results to our source format
      const sources = organicResults.map((result: any) => ({
        url: result.link,
        title: result.title || result.link,
      }));

      // Initialize properties with "Not found" values
      const searchResults: SearchResultProperties = {};
      
      // Initialize all properties with default "Not found" values
      for (const property of properties) {
        searchResults[property.name] = {
          name: property.name,
          value: "Not found",
          sources: [], // Will be updated after content extraction
          confidence: 0,
        };
      }
      
      // Fetch and process HTML content for the top sources
      const maxSourcesToProcess = maxResults;
      const sourcesToProcess = sources.slice(0, maxSourcesToProcess);
      
      console.log(`Found ${sourcesToProcess.length} search results for the product`);
      
      // Fetch raw HTML for each source
      const contentSources: string[] = [];
      for (const source of sourcesToProcess) {
        try {
          console.log(`Fetching raw HTML from: ${source.url}`);
          const response = await axios.get(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Cache-Control': 'max-age=0'
            },
            timeout: 15000,
            maxRedirects: 5
          });
          
          console.log(`Fetched ${source.url}, HTML size: ${response.data.length} bytes`);
          
          // Store the HTML content for processing
          contentSources.push(response.data);
        } catch (error) {
          console.error(`Error scraping ${source.url}:`, error);
        }
      }
      
      console.log(`Collected ${contentSources.length} HTML content sources for AI analysis`);
      
      // If we have content, prepare for AI extraction
      if (contentSources.length > 0) {
        // Will be updated with AI-extracted values in the /api/analyze-content endpoint
        console.log(`Content collected and ready for AI analysis`);
      }
      
      // Return formatted response with sources for further processing
      return {
        id: Date.now(), // Use timestamp as temporary ID
        searchMethod: "auto",
        searchStatus: "collecting",
        statusMessage: "Found web pages. Processing with AI...",
        products: [{
          id: articleNumber, // Use articleNumber as product ID
          articleNumber,
          productName,
          properties: searchResults,
          __sources: sources.slice(0, maxResults), // Store the top sources for later use
          __rawContent: contentSources // Store the raw HTML content for AI processing
        }]
      };
    } catch (error) {
      console.error("Error processing ValueSERP results:", error);
      throw new Error(`Failed to process ValueSERP results: ${(error as Error).message}`);
    }
  }
  
  
  // SIMPLIFIED: Less restrictive search query to find ALL relevant pages
  private buildPreciseSearchQuery(articleNumber: string, productName: string): string {
    // Build a simple, broad search query without restrictive exact matching
    let query = '';
    
    // Add article number if available (without quotes for broader matching)
    if (articleNumber && articleNumber.trim() !== '') {
      query = articleNumber;
    }
    
    // Add product name (without quotes to allow partial matches)
    if (query) {
      query += ` ${productName}`;
    } else {
      query = productName;
    }
    
    // Add helpful keywords to find technical pages
    query += ` specifications OR datenblatt OR technical OR eigenschaften`;
    
    console.log(`🔍 SIMPLIFIED SEARCH QUERY: "${query}"`);
    console.log(`  ℹ️ Using broad matching to find ALL relevant pages`);
    console.log(`  ℹ️ AI will determine relevance, not strict title matching`);
    
    return query;
  }

  // Method removed - no longer using exclusion terms for broader search results


  // Method to collect raw HTML content from search results
  /**
   * Extracts only the important product information HTML from a webpage
   * Removes scripts, styles, and other non-essential elements
   * @param html The raw HTML content
   * @param productName The product name to search for
   * @param articleNumber The article number to search for
   * @returns Cleaned HTML with only product-relevant information
   */
  /**
   * Process composite values like dimensions into individual components
   * For example, converts "160 cm H x 147 cm B x 77,5 cm T" into separate height, width, depth entries
   * @param content The content to process
   * @returns Processed content with expanded dimensional values
   */
  private processCompositeValues(content: string): string {
    if (!content) return content;

    let processedContent = content;
    
    // Array to collect additional properties we'll extract
    const additionalProperties: string[] = [];
    
    // Process dimensions - German format (H/B/T)
    const dimensionRegex1 = /(\d+(?:,\d+)?)\s*cm\s*H\s*x\s*(\d+(?:,\d+)?)\s*cm\s*B\s*x\s*(\d+(?:,\d+)?)\s*cm\s*T/gi;
    processedContent = processedContent.replace(dimensionRegex1, (match, height, width, depth) => {
      additionalProperties.push(`Höhe: ${height} cm`);
      additionalProperties.push(`Breite: ${width} cm`);
      additionalProperties.push(`Tiefe: ${depth} cm`);
      return match; // Keep the original text too
    });
    
    // Process dimensions - another format (HxBxT)
    const dimensionRegex2 = /(\d+(?:,\d+)?)\s*x\s*(\d+(?:,\d+)?)\s*x\s*(\d+(?:,\d+)?)\s*cm\s*\(H\s*x\s*B\s*x\s*T\)/gi;
    processedContent = processedContent.replace(dimensionRegex2, (match, height, width, depth) => {
      additionalProperties.push(`Höhe: ${height} cm`);
      additionalProperties.push(`Breite: ${width} cm`);
      additionalProperties.push(`Tiefe: ${depth} cm`);
      return match;
    });
    
    // Process dimensions - another format with text labels
    const dimensionRegex3 = /(\d+(?:,\d+)?)\s*cm\s*(?:Höhe|höhe|height)\s*x\s*(\d+(?:,\d+)?)\s*cm\s*(?:Breite|breite|width)\s*x\s*(\d+(?:,\d+)?)\s*cm\s*(?:Tiefe|tiefe|depth)/gi;
    processedContent = processedContent.replace(dimensionRegex3, (match, height, width, depth) => {
      additionalProperties.push(`Höhe: ${height} cm`);
      additionalProperties.push(`Breite: ${width} cm`);
      additionalProperties.push(`Tiefe: ${depth} cm`);
      return match;
    });
    
    // Process other composite sizes (like "Grillfläche: 68 x 48 cm")
    const grillSizeRegex = /Grillfläche:\s*(\d+(?:,\d+)?)\s*x\s*(\d+(?:,\d+)?)\s*cm/gi;
    processedContent = processedContent.replace(grillSizeRegex, (match, width, depth) => {
      additionalProperties.push(`Grillbreite: ${width} cm`);
      additionalProperties.push(`Grilltiefe: ${depth} cm`);
      additionalProperties.push(`Grillfläche in cm²: ${parseFloat(width.replace(',', '.')) * parseFloat(depth.replace(',', '.'))} cm²`);
      return match;
    });

    // Process warmhalterost size
    const warmhalterostRegex = /Warmhalterost:\s*(\d+(?:,\d+)?)\s*x\s*(\d+(?:,\d+)?)\s*cm/gi;
    processedContent = processedContent.replace(warmhalterostRegex, (match, width, depth) => {
      additionalProperties.push(`Warmhalterost Breite: ${width} cm`);
      additionalProperties.push(`Warmhalterost Tiefe: ${depth} cm`);
      additionalProperties.push(`Warmhalterost Fläche: ${parseFloat(width.replace(',', '.')) * parseFloat(depth.replace(',', '.'))} cm²`);
      return match;
    });
    
    // Process weight (if it appears as "71,00 kg" or similar)
    const weightRegex = /Gewicht.*?(\d+(?:,\d+)?)\s*kg/gi;
    processedContent = processedContent.replace(weightRegex, (match, weight) => {
      // Standardize to "Gewicht: X kg" format
      additionalProperties.push(`Gewicht: ${weight} kg`);
      return match;
    });
    
    // Power specifications 
    const powerRegex = /Leistung.*?(\d+(?:,\d+)?)\s*kW/gi;
    processedContent = processedContent.replace(powerRegex, (match, power) => {
      // Add power in kWh as well if not already present
      if (!match.includes('kWh')) {
        additionalProperties.push(`Leistung: ${power} kWh`);
      }
      return match;
    });
    
    // Add all the additional properties to the end of the content
    if (additionalProperties.length > 0) {
      processedContent += '\n\n--- Expanded Properties ---\n' + additionalProperties.join('\n');
    }
    
    return processedContent;
  }

  private extractCleanTextContent(html: string, productName: string, articleNumber: string): string {
    try {
      console.log(`Parsing HTML content for ${productName} (${articleNumber})`);
      
      // Parse HTML using node-html-parser
      const root = parse(html);
      
      // Remove script, style, and other non-content elements
      root.querySelectorAll('script, style, iframe, noscript, link, meta, svg, path, video, canvas, object, embed').forEach(el => el.remove());
      
      // Product-specific keywords to identify relevant content
      const productKeywords = [
        'technical', 'specification', 'spec', 'product', 'detail', 'feature', 
        'dimension', 'parameter', 'data', 'technical data', 'technical specifications',
        'technical details', 'tech specs', 'artikelnummer', 'article number',
        'product number', 'model number', 'höhe', 'breite', 'tiefe', 'gewicht',
        'material', 'farbe', 'leistung', 'stromverbrauch', 'nennwärmeleistung',
        'wirkungsgrad', 'energieeffizienz', 'brennstoff', 'abmessungen',
        articleNumber.toLowerCase(),
        ...productName.toLowerCase().split(' ').filter(word => word.length > 2)
      ];
      
      let extractedText = '';
      
      // Extract page title and meta description first
      const title = root.querySelector('title');
      if (title) {
        extractedText += `Page Title: ${title.innerText.trim()}\n\n`;
      }
      
      const metaDesc = root.querySelector('meta[name="description"]') || root.querySelector('meta[property="og:description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content');
        if (content) {
          extractedText += `Page Description: ${content.trim()}\n\n`;
        }
      }
      
      // Check if page contains article number
      const pageText = root.innerText.toLowerCase();
      const containsArticleNumber = pageText.includes(articleNumber.toLowerCase());
      if (containsArticleNumber) {
        console.log(`Found article number ${articleNumber} in the page content`);
      } else {
        console.log(`Article number ${articleNumber} not found in the page content, might not be the exact product`);
      }
      
      // Extract structured data (JSON-LD)
      const jsonLdScripts = root.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach(script => {
        try {
          const jsonText = script.innerHTML;
          const jsonData = JSON.parse(jsonText);
          
          if (jsonData['@type'] === 'Product' || 
              (jsonData['@graph'] && jsonData['@graph'].some((item: any) => item['@type'] === 'Product'))) {
            extractedText += `Structured Product Data:\n${JSON.stringify(jsonData, null, 2)}\n\n`;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
      
      // Extract tables (often contain specifications)
      const tables = root.querySelectorAll('table');
      tables.forEach(table => {
        const tableText = this.extractTableText(table);
        if (tableText && this.containsProductKeywords(tableText, productKeywords)) {
          extractedText += `Table Data:\n${tableText}\n\n`;
        }
      });
      
      // Extract definition lists (commonly used for specs)
      const dlElements = root.querySelectorAll('dl');
      dlElements.forEach(dl => {
        const dlText = this.extractDefinitionListText(dl);
        if (dlText && this.containsProductKeywords(dlText, productKeywords)) {
          extractedText += `Definition List:\n${dlText}\n\n`;
        }
      });
      
      // Extract content from elements likely to contain product specifications
      const specSelectors = [
        '.product-info', '.product-details', '.product-information', '.details',
        '.product-specs', '.specifications', '.technical-specs', '.specs',
        '#specifications', '#technical-data', '.technical-data', '#features',
        '.features', '.product-features', '#product-specs', '.tech-specs',
        '.product-specifications', '.technical-attributes', '.product-dimensions'
      ];
      
      specSelectors.forEach(selector => {
        const elements = root.querySelectorAll(selector);
        elements.forEach(element => {
          const text = this.extractElementText(element);
          if (text && this.containsProductKeywords(text, productKeywords)) {
            extractedText += `${selector} Content:\n${text}\n\n`;
          }
        });
      });
      
      // Extract text from elements containing the article number
      const elementsWithArticleNumber = root.querySelectorAll('*');
      elementsWithArticleNumber.forEach(element => {
        const text = element.innerText;
        if (text && text.toLowerCase().includes(articleNumber.toLowerCase())) {
          const cleanText = this.extractElementText(element);
          if (cleanText && cleanText.length < 1000) { // Avoid huge blocks
            extractedText += `Article Number Context:\n${cleanText}\n\n`;
          }
        }
      });
      
      // Extract relevant text from divs and other elements
      const allElements = root.querySelectorAll('div, section, article, p, li, span');
      allElements.forEach(element => {
        const text = element.innerText;
        if (text && text.trim().length > 20 && this.containsProductKeywords(text, productKeywords)) {
          // Avoid duplicates and very large blocks
          const cleanText = text.trim();
          if (cleanText.length < 500 && !extractedText.includes(cleanText.substring(0, 50))) {
            extractedText += `Content: ${cleanText}\n\n`;
          }
        }
      });
      
      console.log(`Extracted ${extractedText.length} characters of clean text content`);
      
      return extractedText || `No relevant content found for ${productName} (${articleNumber})`;
      
    } catch (error) {
      console.error('Error extracting text content:', error);
      return `Error extracting content: ${(error as Error).message}`;
    }
  }
  
  private extractTableText(table: any): string {
    let tableText = '';
    const rows = table.querySelectorAll('tr');
    
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td, th');
      const rowData: string[] = [];
      
      cells.forEach((cell: any) => {
        const cellText = cell.innerText.trim();
        if (cellText) {
          rowData.push(cellText);
        }
      });
      
      if (rowData.length > 0) {
        tableText += rowData.join(': ') + '\n';
      }
    });
    
    return tableText;
  }
  
  private extractDefinitionListText(dl: any): string {
    let dlText = '';
    const terms = dl.querySelectorAll('dt');
    const descriptions = dl.querySelectorAll('dd');
    
    for (let i = 0; i < Math.min(terms.length, descriptions.length); i++) {
      const term = terms[i]?.innerText?.trim();
      const desc = descriptions[i]?.innerText?.trim();
      
      if (term && desc) {
        dlText += `${term}: ${desc}\n`;
      }
    }
    
    return dlText;
  }
  
  private extractElementText(element: any): string {
    // Get clean text content, preserving structure for key-value pairs
    const text = element.innerText;
    if (!text) return '';
    
    // Clean up whitespace and normalize line breaks
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
  
  private containsProductKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  private async cleanHtmlForAI(html: string, productName: string, articleNumber: string, url?: string): Promise<string> {
    try {
      // First check if this is a JavaScript-heavy website and use enhanced extraction
      if (url) {
        const { jsContentExtractor } = await import('./jsContentExtractor');
        const jsResult = await jsContentExtractor.extractContent(url, articleNumber);
        
        if (jsResult.success && jsResult.hasJavaScriptFramework) {
          console.log(`Using enhanced JS extraction for ${productName}: ${jsResult.method}, ${jsResult.contentLength} characters`);
          return jsResult.content;
        }
      }
      
      const $ = cheerio.load(html);
      let pageTitle = '';
      let pageDescription = '';
      
      console.log(`Parsing HTML content for ${productName} (${articleNumber})`);
      
      // Extract useful meta tags (title and description)
      $('meta[property="og:title"]').each(function() {
        pageTitle = $(this).attr('content') || '';
      });
      
      $('meta[property="og:description"]').each(function() {
        pageDescription = $(this).attr('content') || '';
      });
      
      // If og:title not found, try regular title
      if (!pageTitle) {
        pageTitle = $('title').text() || '';
      }
      
      // If og:description not found, try meta description
      if (!pageDescription) {
        pageDescription = $('meta[name="description"]').attr('content') || '';
      }
      
      // Check if the page contains the article number to verify it's the right product
      const containsArticleNumber = html.toLowerCase().includes(articleNumber.toLowerCase());
      if (containsArticleNumber) {
        console.log(`Found article number ${articleNumber} in the HTML content, this is the correct product page`);
      } else {
        console.log(`Article number ${articleNumber} not found in the HTML content, might not be the exact product`);
      }
      
      // STEP 1: CLEAN THE HTML - Remove all non-visible elements completely
      // These elements don't contribute to visible content for the user
      $('script').remove();
      $('style').remove();
      $('iframe').remove();
      $('noscript').remove();
      $('link').remove();
      $('meta').remove();
      $('svg').remove();
      $('path').remove();
      $('head').remove();
      $('video').remove();
      $('canvas').remove();
      $('object').remove();
      $('embed').remove();
      $('form:not(:has(*:contains("product")))').remove(); // Remove forms unless they might have product info
      
      // Remove comments
      $('*').contents().each(function() {
        if (this.type === 'comment') {
          $(this).remove();
        }
      });
      
      // STEP 2: MARK IMPORTANT CONTENT FOR PRESERVATION
      // Product-specific keywords to search for
      const productKeywords = [
        'technical', 'specification', 'spec', 'product', 'detail', 'feature', 
        'dimension', 'parameter', 'data', 'technical data', 'technical specifications',
        'technical details', 'tech specs', 'artikelnummer', 'article number',
        'product number', 'model number', 'höhe', 'breite', 'tiefe', 'gewicht',
        'material', 'farbe', 'leistung', 'stromverbrauch',
        articleNumber,
        // Also include product name components
        ...productName.toLowerCase().split(' ').filter(word => word.length > 2)
      ];
      
      // Important content selectors that are likely to contain product information
      const productContentSelectors = [
        // Product specific content sections
        '.product-info', '.product-details', '.product-information', '.details',
        '.product-specs', '.specifications', '.technical-specs', '.specs',
        '#specifications', '#technical-data', '.technical-data', '#features',
        '.features', '.product-features', '#product-specs', '.tech-specs',
        '.artikelnummer', '.article-number', '.product-number', '.model-number',
        // Tables and structured content
        'table', 'dl', '.specifications-table', '.specs-table', '.tech-table',
        // Elements with certain IDs/classes that might contain specs
        '[class*="product"]', '[id*="product"]',
        '[class*="detail"]', '[id*="detail"]',
        '[class*="spec"]', '[id*="spec"]',
        '[class*="technical"]', '[id*="technical"]',
        '.product-features', '.product-attributes', '.product-specifications',
        '.technical-attributes', '.product-dimensions', '.product-description',
        '.attributes-list', '.attributes-table', '.details-table', '.product-tech-specs'
      ];
      
      // Mark important content sections with data-important attribute
      productContentSelectors.forEach(selector => {
        try {
          $(selector).each(function() {
            const content = $(this).html() || '';
            // Only mark as important if it has substantial content
            if (content.length > 10) { 
              $(this).attr('data-important', 'true');
            }
          });
        } catch (e) {
          // Some selectors might be invalid, ignore errors
        }
      });
      
      // Also mark elements containing the article number as important
      $(`*:contains("${articleNumber}")`).each(function() {
        $(this).attr('data-important', 'true');
        // Also mark parent containers to preserve context
        $(this).parents().slice(0, 3).attr('data-important', 'true');
      });
      
      // STEP 3: EXTRACT THE CONTENT IN STRUCTURED FORMAT
      let extractedContent: string[] = [];
      
      // Start with page title and description
      if (pageTitle) {
        extractedContent.push(`<h1>${pageTitle}</h1>`);
      }
      
      if (pageDescription) {
        extractedContent.push(`<p>${pageDescription}</p>`);
      }
      
      // Extract structured data if available (often contains rich product information)
      let structuredData = '';
      $('script[type="application/ld+json"]').each(function() {
        try {
          const jsonText = $(this).html() || '';
          const jsonData = JSON.parse(jsonText);
          
          // Check if it's product data
          if (jsonData['@type'] === 'Product' || 
              (jsonData['@graph'] && jsonData['@graph'].some((item: any) => item['@type'] === 'Product'))) {
            structuredData += JSON.stringify(jsonData, null, 2);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
      
      if (structuredData) {
        extractedContent.push(`<pre>${structuredData}</pre>`);
      }
      
      // Extract all tables - these often contain specifications
      $('table').each(function() {
        // For tables, preserve the full HTML structure as it contains important layout
        const outerHTML = $(this).prop('outerHTML');
        if (outerHTML) {
          extractedContent.push(outerHTML);
        }
      });
      
      // Extract all definition lists - commonly used for specs
      $('dl').each(function() {
        const outerHTML = $(this).prop('outerHTML');
        if (outerHTML) {
          extractedContent.push(outerHTML);
        }
      });
      
      // Extract all important marked elements
      $('[data-important="true"]').each(function() {
        // Get the element's HTML content
        const outerHTML = $(this).prop('outerHTML');
        
        // Only add if not already included and not too large
        if (outerHTML && !extractedContent.includes(outerHTML) && outerHTML.length < 5000) {
          extractedContent.push(outerHTML);
        }
      });
      
      // STEP 4: SMART CONTENT EXTRACTION FOR RELEVANT TEXT
      // Extract divs that might contain specs in a structured format
      $('div').each(function() {
        // Check if this div contains product-related text
        const text = $(this).text().toLowerCase();
        const containsKeyword = productKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        
        if (containsKeyword) {
          // Detect if this might be a spec container with label-value pairs
          // Common pattern: nested divs with label in one and value in another
          if ($(this).children('div').length > 1) {
            let specs = '';
            let hasLabelValuePair = false;
            
            // Check for label-value pattern in child divs
            $(this).children('div').each(function() {
              const label = $(this).text().trim();
              const next = $(this).next('div');
              
              if (next.length) {
                const value = next.text().trim();
                if (label && value && label !== value) {
                  specs += `<div><strong>${label}:</strong> ${value}</div>`;
                  hasLabelValuePair = true;
                }
              }
            });
            
            if (hasLabelValuePair) {
              extractedContent.push(`<div class="extracted-specs">${specs}</div>`);
            }
          } 
          // For smaller divs with relevant content, preserve the HTML structure
          else {
            const innerHtml = $(this).html();
            if (innerHtml && innerHtml.length < 2000) {
              const outerHtml = $(this).prop('outerHTML');
              if (outerHtml) {
                extractedContent.push(outerHtml);
              }
            }
          }
        }
      });
      
      // Extract sections that appear to be specification lists
      $('ul, ol').each(function() {
        const listText = $(this).text().toLowerCase();
        
        // Check if this list contains product-related keywords
        if (productKeywords.some(keyword => listText.includes(keyword.toLowerCase()))) {
          const outerHtml = $(this).prop('outerHTML');
          if (outerHtml) {
            extractedContent.push(outerHtml);
          }
        }
      });
      
      // STEP 5: COMBINE AND FORMAT THE EXTRACTED CONTENT
      let finalContent = '';
      
      // Join all extracted content with separators
      if (extractedContent.length > 0) {
        finalContent = extractedContent.join('\n\n');
      } else {
        console.log("No structured content found, extracting text content...");
        
        // If we couldn't extract structured content, extract all relevant text
        $('body').find('*').each(function() {
          const element = $(this);
          const text = element.text().trim();
          
          // Skip empty or very short text
          if (!text || text.length < 10) return;
          
          // Skip hidden elements
          const display = element.css('display');
          const visibility = element.css('visibility');
          if (display === 'none' || visibility === 'hidden') return;
          
          // Only include text that contains product keywords
          if (productKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
            // Add with simple formatting based on element type
            const tagName = element.prop('tagName')?.toLowerCase() || '';
            
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
              finalContent += `<${tagName}>${text}</${tagName}>\n`;
            } else if (tagName === 'p') {
              finalContent += `<p>${text}</p>\n`;
            } else {
              finalContent += `<div>${text}</div>\n`;
            }
          }
        });
      }
      
      // Process the content to extract dimensions and other composite values
      finalContent = this.processCompositeValues(finalContent);
      
      console.log(`Extracted ${finalContent.length} characters of cleaned HTML content`);
      
      // If we have no content after all processing, use original HTML as fallback (truncated)
      if (!finalContent || finalContent.trim().length < 100) {
        console.log("Content extraction yielded insufficient results, using fallback method");
        return this.fallbackContentExtraction($, articleNumber, productName);
      }
      
      return finalContent;
    } catch (error) {
      console.error('Error cleaning HTML:', error);
      // Return a shortened version of the original HTML if parsing fails
      return html.substring(0, 50000); // First 50K characters as fallback
    }
  }
  
  // Fallback method for content extraction when the main method fails
  private fallbackContentExtraction($: cheerio.CheerioAPI, articleNumber: string, productName: string): string {
    try {
      // Remove scripts, styles, and hidden elements
      $('script, style, [style*="display:none"], [style*="display: none"]').remove();
      
      // Extract title and main content
      const title = $('title').text() || '';
      let content = '';
      
      // Extract content from main product areas
      const productSelectors = [
        'main', '#main', '#content', '.content', 'article',
        '[class*="product"]', '[id*="product"]',
        '[class*="detail"]', '[id*="detail"]'
      ];
      
      // Try to find the main content area
      let mainContent = '';
      for (const selector of productSelectors) {
        try {
          const selectedContent = $(selector).html() || '';
          if (selectedContent.length > mainContent.length) {
            mainContent = selectedContent;
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      
      // If we found main content, use it
      if (mainContent) {
        content = mainContent;
      } else {
        // Otherwise extract the body content
        content = $('body').html() || '';
      }
      
      // Clean up the content
      // Remove all attributes except for essential ones
      $('*', content).each(function() {
        const attrs = $(this).attr();
        for (const attr in attrs) {
          if (!['id', 'class', 'href', 'src', 'alt'].includes(attr)) {
            $(this).removeAttr(attr);
          }
        }
      });
      
      // Return formatted content with title
      return `<h1>${title}</h1>\n\n${content}`;
    } catch (error) {
      console.error('Error in fallback content extraction:', error);
      return `<h1>${productName} (${articleNumber})</h1><div>Content extraction failed</div>`;
    }
  }
  
  async collectRawContentFromSearchResults(
    articleNumber: string | undefined,
    productName: string,
    searchEngine: string = 'google',
    contentArray: Array<{content: string, url: string, title: string}>,
    maxResults: number = 10,
    pdfScraperEnabled: boolean = false,
    userContext?: { userId: number; username: string }
  ): Promise<SearchResult> {
    console.log(`Collecting raw HTML content for ${articleNumber} - ${productName}`);
    
    try {
      // Build enhanced search query with exact product matching
      const enhancedSearchQuery = this.buildPreciseSearchQuery(articleNumber || "", productName);
      console.log("Enhanced search query:", enhancedSearchQuery);
      
      // Use Google search with enhanced query
      const searchResults = await this.searchWithGoogle(enhancedSearchQuery, articleNumber || "", undefined, maxResults * 2);
      
      const sources = searchResults.sources.slice(0, maxResults);
      
      console.log(`Processing top ${sources.length} prioritized search results for the product`);
      
      // Initialize basic properties
      const searchResultProperties: SearchResultProperties = {
        // Add metadata about sources
        __meta_sources: {
          name: "__meta_sources",
          value: "Source URLs",
          confidence: 100,
          sources: sources.map(source => ({
            url: source.url,
            title: source.title || `Result from ${searchEngine}`
          }))
        },
        // Include the Artikelnummer if provided
        ...(articleNumber && {
          Artikelnummer: {
            name: "Artikelnummer",
            value: articleNumber,
            confidence: 100,
            isConsistent: true,
            sources: []
          }
        })
      };
      
      // Collect raw content from each source using improved scraping
      console.log(`📊 Content Collection Summary:`);
      console.log(`  Total sources to process: ${sources.length}`);
      console.log(`  Max results limit: ${maxResults}`);
      console.log(`  Content array length before scraping: ${contentArray.length}`);
      
      let successCount = 0;
      let failureCount = 0;
      
      // OPTIMIZED: Process ALL sources in TRUE parallel (no batching delays)
      const sourcesToProcess = sources.slice(0, maxResults);
      const startTime = Date.now();
      
      console.log(`[PARALLEL-OPTIMIZED] Processing ALL ${sourcesToProcess.length} sources simultaneously...`);
      
      // Track failed URLs for batch summary
      const failedUrls: Array<{ url: string; errorType: string; errorMessage: string }> = [];
      
      // Function to process a single source
      const processSource = async (source: { url: string; title?: string }, index: number) => {
        const sourceStartTime = Date.now();
        try {
          console.log(`\n🔍 [${index + 1}/${maxResults}] Scraping content from: ${source.url}`);
          console.log(`  Source title: ${source.title || 'No title'}`);
          
          // CRITICAL: Check if URL is a PDF FIRST before any scraping attempts
          const isPdfUrl = source.url.toLowerCase().endsWith('.pdf') ||
                          source.url.toLowerCase().includes('.pdf?') ||
                          source.url.toLowerCase().includes('print_pdf') ||
                          source.url.toLowerCase().includes('pdf_datasheet') ||
                          source.url.toLowerCase().includes('/pdf/') ||
                          source.url.toLowerCase().includes('getpdf') ||
                          source.url.toLowerCase().includes('download_pdf');
          let isPdf = isPdfUrl;
          
          console.log(`  🔍 URL-based PDF detection: ${isPdf} (URL: ${source.url})`);
          
          // Always verify with HEAD request if PDF scraper is enabled OR if URL suggests PDF
          if (pdfScraperEnabled || isPdfUrl) {
            try {
              console.log(`  🔍 Performing HEAD request to verify Content-Type...`);
              const headResponse = await axios.head(source.url, {
                timeout: 8000,
                maxRedirects: 5,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/pdf,application/x-pdf,*/*'
                },
                validateStatus: (status) => status < 500 // Accept redirects
              });
              const contentType = headResponse.headers['content-type'] || '';
              const contentDisposition = headResponse.headers['content-disposition'] || '';
              
              // Check both Content-Type header and Content-Disposition for PDF indicators
              isPdf = contentType.toLowerCase().includes('application/pdf') ||
                      contentType.toLowerCase().includes('pdf') ||
                      contentDisposition.toLowerCase().includes('.pdf') ||
                      contentDisposition.toLowerCase().includes('filename') && contentDisposition.toLowerCase().includes('pdf');
              
              console.log(`  📋 Content-Type: ${contentType}`);
              console.log(`  📋 Content-Disposition: ${contentDisposition}`);
              console.log(`  📄 Final PDF determination: ${isPdf}`);
              
            } catch (headError) {
              console.log(`  ⚠️ HEAD request failed: ${(headError as Error).message}`);
              // If HEAD fails but URL strongly suggests PDF, try GET with small byte range
              if (isPdfUrl) {
                try {
                  console.log(`  🔍 HEAD failed but URL suggests PDF, trying partial GET...`);
                  const partialResponse = await axios.get(source.url, {
                    timeout: 5000,
                    maxRedirects: 5,
                    responseType: 'arraybuffer',
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Range': 'bytes=0-1024' // Get first 1KB to check PDF signature
                    },
                    validateStatus: (status) => status === 200 || status === 206 // Accept partial content
                  });
                  
                  const buffer = Buffer.from(partialResponse.data);
                  const header = buffer.toString('utf8', 0, 8);
                  isPdf = header.startsWith('%PDF-');
                  console.log(`  📄 Partial GET result - starts with PDF signature: ${isPdf} (header: ${header})`);
                } catch (partialError) {
                  console.log(`  ⚠️ Partial GET also failed, using URL-based detection: ${isPdf}`);
                }
              }
            }
          }
          
          // If it's a PDF and PDF scraper is enabled, extract PDF text
          if (isPdf && pdfScraperEnabled) {
            console.log(`  📄 Processing PDF with PDF scraper enabled`);
            try {
              const pdfText = await this.extractPdfText(source.url);
              if (pdfText && pdfText.length > 0) {
                console.log(`  ✅ Successfully extracted ${pdfText.length} chars from PDF: ${source.url}`);
                return {
                  content: pdfText,
                  url: source.url,
                  title: source.title || 'PDF Document'
                };
              } else {
                console.log(`  ❌ PDF extraction returned empty content, skipping`);
                return null;
              }
            } catch (pdfError) {
              console.error(`  ❌ PDF extraction failed for ${source.url}:`, pdfError);
              console.log(`  ⚠️ Skipping PDF due to extraction error`);
              
              // Log PDF extraction error to monitoring
              if (userContext) {
                failedUrls.push({
                  url: source.url,
                  errorType: 'pdf_extraction_failed',
                  errorMessage: (pdfError as Error).message
                });
                
                MonitoringLogger.logPdfExtractionError({
                  userId: userContext.userId,
                  username: userContext.username,
                  pdfUrl: source.url,
                  errorType: 'extraction_failed',
                  errorMessage: (pdfError as Error).message,
                  errorStack: (pdfError as Error).stack,
                  articleNumber: articleNumber,
                  productName: productName,
                }).catch(err => console.error('[MONITORING] Failed to log PDF error:', err));
              }
              
              return null; // Skip PDFs that fail extraction instead of falling back to web scraping
            }
          } else if (isPdf && !pdfScraperEnabled) {
            console.log(`  📄 PDF detected but PDF scraper is disabled, skipping`);
            
            // Add to failed URLs array for batch summary
            failedUrls.push({
              url: source.url,
              errorType: 'pdf_scraper_disabled',
              errorMessage: 'PDF scraper is disabled - enable PDF extraction in settings to process this file'
            });
            
            // Log skipped content to monitoring (as warning)
            if (userContext) {
              MonitoringLogger.logContentSkipped(
                userContext.userId,
                userContext.username,
                source.url,
                'PDF scraper is disabled',
                { articleNumber, productName, contentType: 'application/pdf' }
              ).catch(err => console.error('[MONITORING] Failed to log skipped content:', err));
            }
            
            return null;
          }
          
          // Use jsContentExtractor for web pages
          const extractResult = await jsContentExtractor.extractContent(
            source.url,
            articleNumber || ""
          );
          
          console.log(`  Extraction result: success=${extractResult.success}, method=${extractResult.method}, contentLength=${extractResult.contentLength}`);
          
          // CRITICAL SAFETY CHECK: Detect if jsContentExtractor accidentally returned PDF binary data
          if (extractResult.content && (
              extractResult.content.startsWith('%PDF-') ||
              extractResult.content.includes('%PDF-') ||
              extractResult.content.includes('endobj') && extractResult.content.includes('stream')
          )) {
            console.log(`  ⚠️ DETECTED PDF BINARY DATA in web scraping result!`);
            
            if (pdfScraperEnabled) {
              console.log(`  📄 PDF scraper is enabled, extracting PDF text properly...`);
              try {
                const pdfText = await this.extractPdfText(source.url);
                if (pdfText && pdfText.length > 0) {
                  console.log(`  ✅ Successfully extracted ${pdfText.length} chars from PDF (safety check recovery)`);
                  return {
                    content: pdfText,
                    url: source.url,
                    title: source.title || 'PDF Document'
                  };
                }
              } catch (pdfError) {
                console.error(`  ❌ PDF extraction failed:`, pdfError);
              }
            }
            
            console.log(`  ⚠️ Skipping PDF binary data (scraper ${pdfScraperEnabled ? 'failed' : 'disabled'})`);
            return null;
          }
          
          // Log specific details about content filtering
          if (!extractResult.success) {
            console.log(`  ❌ Extraction failed: Unknown error`);
          } else if (!extractResult.content) {
            console.log(`  ❌ No content extracted`);
          } else if (extractResult.content.length <= 100) {
            console.log(`  ❌ Content too short (${extractResult.content.length} chars) - SKIPPING`);
            console.log(`  First 100 chars of skipped content: "${extractResult.content.substring(0, 100)}"`);
          }
          
          // REMOVED ALL CONTENT LENGTH REQUIREMENTS - accept any content that was extracted
          if (extractResult.success && extractResult.content) {
            // Add ALL extracted content regardless of length
            console.log(`  ✅ Successfully scraped ${extractResult.contentLength} chars from ${source.url} using ${extractResult.method}`);
            return {
              content: extractResult.content,
              url: source.url,
              title: source.title || new URL(source.url).hostname
            };
          } else {
            console.error(`  ❌ Failed to scrape ${source.url}: Extraction failed`);
            
            // Log scraping failure to monitoring
            if (userContext) {
              const responseTime = Date.now() - sourceStartTime;
              failedUrls.push({
                url: source.url,
                errorType: 'invalid_content',
                errorMessage: 'Extraction returned no content or extraction failed'
              });
              
              MonitoringLogger.logScrapingError({
                userId: userContext.userId,
                username: userContext.username,
                url: source.url,
                errorType: 'invalid_content',
                errorMessage: 'Extraction returned no content or extraction failed',
                scrapingMethod: extractResult.method,
                articleNumber: articleNumber,
                productName: productName,
                contentLength: extractResult.contentLength,
                responseTime: responseTime,
              }).catch(err => console.error('[MONITORING] Failed to log scraping error:', err));
            }
            
            return null;
          }
        } catch (error) {
          console.error(`  ❌ Error scraping ${source.url}:`, error);
          console.log(`  Skipping ${source.url} due to scraping error`);
          
          // Log scraping error to monitoring
          if (userContext) {
            const responseTime = Date.now() - sourceStartTime;
            const errorMessage = (error as Error).message;
            
            // Determine error type based on the error message
            let errorType: 'scraping_failed' | 'browser_error' | 'timeout' | 'blocked' | 'network_error' = 'scraping_failed';
            if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
              errorType = 'timeout';
            } else if (errorMessage.includes('Browser') || errorMessage.includes('puppeteer') || errorMessage.includes('chromium')) {
              errorType = 'browser_error';
            } else if (errorMessage.includes('blocked') || errorMessage.includes('403') || errorMessage.includes('captcha')) {
              errorType = 'blocked';
            } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
              errorType = 'network_error';
            }
            
            failedUrls.push({
              url: source.url,
              errorType: errorType,
              errorMessage: errorMessage
            });
            
            MonitoringLogger.logScrapingError({
              userId: userContext.userId,
              username: userContext.username,
              url: source.url,
              errorType: errorType,
              errorMessage: errorMessage,
              errorStack: (error as Error).stack,
              articleNumber: articleNumber,
              productName: productName,
              responseTime: responseTime,
            }).catch(err => console.error('[MONITORING] Failed to log scraping error:', err));
          }
          
          return null;
        }
      };
      
      // OPTIMIZED: Process ALL sources at once (no sequential batching)
      console.log(`[PARALLEL-OPTIMIZED] Launching ${sourcesToProcess.length} concurrent requests...`);
      const allPromises = sourcesToProcess.map((source, index) => processSource(source, index));
      
      const allResults = await Promise.allSettled(allPromises);
      
      allResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value !== null) {
          contentArray.push(result.value);
          successCount++;
        } else {
          failureCount++;
        }
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`[PARALLEL-OPTIMIZED] ✓ Completed in ${totalTime}ms - All ${sourcesToProcess.length} sources processed simultaneously`);
      console.log(`[PARALLEL-OPTIMIZED] Success: ${successCount}/${sourcesToProcess.length}, Failed: ${failureCount}/${sourcesToProcess.length}`);
      
      // Log batch scraping summary to monitoring if there were failures
      if (userContext && failedUrls.length > 0) {
        MonitoringLogger.logBatchScrapingSummary({
          userId: userContext.userId,
          username: userContext.username,
          totalUrls: sourcesToProcess.length,
          successfulUrls: successCount,
          failedUrls: failedUrls,
          articleNumber: articleNumber,
          productName: productName,
          totalDuration: totalTime,
        }).catch(err => console.error('[MONITORING] Failed to log batch summary:', err));
        
        // Log individual failed URLs for easy visibility
        console.log(`\n❌ [MONITORING] Failed URLs logged for user ${userContext.username}:`);
        failedUrls.forEach((failed, index) => {
          console.log(`  ${index + 1}. ${failed.url}`);
          console.log(`     Error Type: ${failed.errorType}`);
          console.log(`     Message: ${failed.errorMessage.substring(0, 100)}${failed.errorMessage.length > 100 ? '...' : ''}`);
        });
      }
      
      console.log(`\n📊 Final Content Collection Results:`);
      console.log(`  ✅ Successfully scraped: ${successCount} pages`);
      console.log(`  ❌ Failed to scrape: ${failureCount} pages`);
      console.log(`  📝 Total content array size: ${contentArray.length} items`);
      console.log(`  📄 Content sizes:`, contentArray.map(c => ({ url: c.url, size: c.content.length })));
      
      // CRITICAL: Log what we're returning to ensure contentArray is populated
      console.log(`\n⚠️ CRITICAL CHECK: contentArray passed by reference has ${contentArray.length} items`);
      if (contentArray.length > 0) {
        console.log(`  First item URL: ${contentArray[0].url}`);
        console.log(`  Last item URL: ${contentArray[contentArray.length - 1].url}`);
      } else {
        console.log(`\n❗❗❗ WARNING: NO CONTENT WAS SCRAPED FOR "${productName}" (${articleNumber})!`);
        console.log(`  This product will have EMPTY results in the table.`);
        console.log(`  Possible reasons:`);
        console.log(`  - All scraped pages had content shorter than 50 characters`);
        console.log(`  - JavaScript-heavy pages that couldn't be rendered properly`);
        console.log(`  - Anti-scraping measures blocking content extraction`);
        console.log(`  Please check the extraction logs above for specific failures.`);
      }
      
      // Return basic search result
      return {
        articleNumber: articleNumber || "",
        productName,
        searchMethod: "auto",
        properties: searchResultProperties
      };
    } catch (error) {
      console.error("Error collecting raw HTML content:", error);
      return {
        articleNumber: articleNumber || "",
        productName,
        searchMethod: "auto",
        properties: {
          ...(articleNumber && {
            Artikelnummer: {
              name: "Artikelnummer",
              value: articleNumber,
              confidence: 100,
              isConsistent: true,
              sources: []
            }
          }),
          Error: {
            name: "Error",
            value: `Search failed: ${(error as Error).message}`,
            confidence: 100,
            sources: []
          }
        }
      };
    }
  }
  
  // Get initial search results for immediate display (Google-like)
  async getInitialSearchResults(
    articleNumber: string | undefined,
    productName: string,
    searchEngine: "google",
    maxResults?: number
  ): Promise<{ url: string; title?: string }[]> {
    console.log(`Getting initial search results for ${articleNumber} - ${productName} using ${searchEngine}`);
    
    try {
      // Construct search query - handle optional articleNumber
      const generalSearchQuery = articleNumber 
        ? `${articleNumber} ${productName} specifications technical data`
        : `${productName} specifications technical data`;
      console.log(`Performing general search for: ${generalSearchQuery}`);
      
      let initialSources: { url: string; title?: string }[] = [];
      
      // Use Google search
      const googleResults = await this.searchWithGoogle(generalSearchQuery, articleNumber || "", undefined, maxResults);
      
      initialSources = googleResults.sources;
      if (maxResults && maxResults > 0) {
        console.log(`Limiting initial sources to top ${maxResults} results`);
        initialSources = initialSources.slice(0, maxResults);
      }
      
      console.log(`Found ${initialSources.length} initial sources for the product after filtering and prioritization`);
      return initialSources;
      
    } catch (error) {
      console.error("Error getting initial search results:", error);
      return [];
    }
  }
  
  // Perform a fully automated search using multiple search engines
  async performAutomatedSearch(
    articleNumber: string,
    productName: string,
    properties: SearchProperty[],
    searchEngine: "google",
    scrapedContentArray?: string[],
    maxResults?: number
  ): Promise<SearchResult> {
    console.log(`Performing automated search for ${articleNumber} - ${productName} using ${searchEngine}`);
    
    try {
      const searchResults: SearchResultProperties = {};
      
      // Initialize all properties with "Not found" values
      for (const property of properties) {
        searchResults[property.name] = {
          name: property.name,
          value: "Not found",
          sources: [],
          confidence: 0,
        };
      }
      
      // First, try a general search for the product to get potential sources
      const generalSearchQuery = `${articleNumber} ${productName} specifications technical data`;
      console.log(`Performing general search for: ${generalSearchQuery}`);
      
      let generalSources: { url: string; title?: string }[] = [];
      
      // Use ValueSERP for all automated searches with German settings
      const searchLimit = maxResults ? maxResults * 2 : 20;
      
      console.log("Getting immediate web search results...");
      console.log(`Getting initial search results for ${articleNumber} - ${productName} using ValueSERP`);
      
      // Use ValueSERP with German settings
      try {
        const generalValueSerpResult = await this.performValueSerpSearch(generalSearchQuery, searchLimit);
        generalSources = generalValueSerpResult.sources;
        console.log(`ValueSERP returned ${generalSources.length} results for general search`);
      } catch (error) {
        console.error("ValueSERP search failed:", error);
        // Return empty results if ValueSERP fails
        generalSources = [];
      }
      
      // Filter out excluded domains if any active exclusions exist
      if (maxResults && maxResults > 0) {
        console.log(`Limiting to top ${maxResults} sources`);
        generalSources = generalSources.slice(0, maxResults);
      }
      
      // Create a special meta property to store all sources directly
      const allFoundSources: { url: string; title?: string }[] = [...generalSources];
      
      console.log(`Found ${generalSources.length} general sources for the product`);
      
      // For each property, first try the general sources we found
      for (const property of properties) {
        console.log(`Searching for property: ${property.name}`);
        
        let bestValue = "";
        let bestConfidence = 0;
        let bestSources: { url: string; title?: string }[] = [];
        
        // First check the general sources we already found
        if (generalSources.length > 0) {
          console.log(`Checking ${generalSources.length} general sources for ${property.name}`);
          
          for (const source of generalSources) {
            try {
              const { extractedValue, confidence } = await this.scrapeWebpage(
                source.url,
                property.name,
                property.description || "",
                articleNumber
              );
              
              if (extractedValue && confidence > bestConfidence) {
                console.log(`Found better value for ${property.name} in general source: "${extractedValue}" with confidence ${confidence}%`);
                bestValue = extractedValue;
                bestConfidence = confidence;
                bestSources = [source];
              }
            } catch (error) {
              console.error(`Error scraping general source ${source.url} for ${property.name}:`, error);
            }
          }
        }
        
        // If we couldn't find a good match in general sources, try a property-specific search
        if (bestConfidence < 50) {
          console.log(`No good match found in general sources for ${property.name}, trying property-specific search`);
          
          const propertySearchQuery = `${articleNumber} ${productName} ${property.name} ${property.description || ""} ${property.expectedFormat || ""}`;
          
          let sources: { url: string; title?: string }[] = [];
          let propertyValue = "";
          let confidenceScore = 0;
          
          try {
            ({ sources, propertyValue, confidenceScore } = await this.searchWithValueSerp(propertySearchQuery, articleNumber, property, maxResults));
          } catch (error) {
            console.error("ValueSERP property search failed:", error);
            sources = [];
            propertyValue = "";
            confidenceScore = 0;
          }
          
          if (propertyValue && confidenceScore > bestConfidence) {
            console.log(`Found better value from property-specific search: "${propertyValue}" with confidence ${confidenceScore}%`);
            bestValue = propertyValue;
            bestConfidence = confidenceScore;
            bestSources = sources;
            
            // Add these sources to the overall sources collection for display
            sources.forEach(source => {
              if (!allFoundSources.some(s => s.url === source.url)) {
                allFoundSources.push(source);
              }
            });
          }
        }
        
        // If we found something good, add it to the results
        if (bestValue && bestConfidence > 0) {
          console.log(`Adding result for ${property.name}: "${bestValue}" with confidence ${bestConfidence}%`);
          searchResults[property.name] = {
            name: property.name,
            value: bestValue,
            sources: bestSources,
            confidence: bestConfidence,
          };
        } else {
          console.log(`No good match found for ${property.name}`);
        }
      }
      
      // Add a special meta property that contains all found sources
      searchResults["__meta_sources"] = {
        name: "__meta_sources",
        value: "All Found Sources",
        sources: allFoundSources,
        confidence: 100,
        isConsistent: true,
      };
      
      return {
        articleNumber,
        productName,
        searchMethod: "auto",
        properties: searchResults,
      };
    } catch (error) {
      console.error("Error in automated search:", error);
      throw new Error(`Failed to perform automated search: ${(error as Error).message}`);
    }
  }
  
  
  // Perform a URL-based search
  async performUrlSearch(
    articleNumber: string,
    productName: string,
    properties: SearchProperty[],
    productUrl: string,
    scrapedContentArray?: string[]
  ): Promise<SearchResult> {
    console.log(`Performing URL search for ${articleNumber} - ${productName} on ${productUrl}`);
    
    // Track this URL as the last searched URL to identify URL-based searches in scrapeWebpage
    this.lastSearchedUrl = productUrl;
    
    try {
      // Make sure the URL is valid
      new URL(productUrl);
      
      // Extract domain for the source
      const domain = new URL(productUrl).hostname;
      console.log(`Domain extracted: ${domain}`);
      
      // For each property, try to extract it from the page
      const searchResults: SearchResultProperties = {};
      
      // Initialize all properties with default "Not found" values
      for (const property of properties) {
        searchResults[property.name] = {
          name: property.name,
          value: "Not found",
          sources: [],
          confidence: 0,
        };
      }
      
      // First try the direct URL
      let validUrl: string = productUrl;
      
      // If the URL doesn't work, try to fix common issues
      try {
        console.log(`Checking if URL ${validUrl} is accessible`);
        await axios.get(validUrl, { timeout: 5000 });
        console.log(`URL ${validUrl} is accessible`);
      } catch (urlError) {
        console.log(`URL ${validUrl} is not accessible, trying alternatives`);
        
        // Try with https instead of http or vice versa
        if (validUrl.startsWith('http:')) {
          validUrl = validUrl.replace('http:', 'https:');
        } else if (validUrl.startsWith('https:')) {
          validUrl = validUrl.replace('https:', 'http:');
        }
        
        try {
          console.log(`Trying alternative URL: ${validUrl}`);
          await axios.get(validUrl, { timeout: 5000 });
          console.log(`Alternative URL ${validUrl} is accessible`);
        } catch (altUrlError) {
          // If that still doesn't work, try the domain root
          validUrl = `https://${domain}`;
          console.log(`Trying domain root: ${validUrl}`);
          
          // We'll continue even if this fails, as the scrapeWebpage function 
          // will handle connection errors
        }
      }
      
      for (const property of properties) {
        console.log(`Searching for property: ${property.name}`);
        try {
          // Scrape the page for the property
          const { extractedValue, confidence } = await this.scrapeWebpage(
            validUrl,
            property.name,
            property.description || "",
            articleNumber,
            scrapedContentArray
          );
          
          if (extractedValue && confidence > 0) {
            console.log(`Found value for ${property.name}: "${extractedValue}" with confidence ${confidence}%`);
            searchResults[property.name] = {
              name: property.name,
              value: extractedValue,
              sources: [{ url: validUrl, title: `${domain} - ${productName}` }],
              confidence,
            };
          } else {
            console.log(`No value found for ${property.name}`);
          }
        } catch (scrapeError) {
          console.error(`Error scraping ${validUrl} for ${property.name}:`, scrapeError);
          // Continue to next property
        }
      }
      
      // If we found no properties and the URL isn't the domain root, 
      // try searching the domain root as a fallback
      if (Object.keys(searchResults).length === 0 && validUrl !== `https://${domain}`) {
        console.log(`No properties found, trying domain root as fallback`);
        const domainRootUrl = `https://${domain}`;
        
        for (const property of properties) {
          try {
            const { extractedValue, confidence } = await this.scrapeWebpage(
              domainRootUrl,
              property.name,
              property.description || "",
              articleNumber,
              scrapedContentArray
            );
            
            if (extractedValue && confidence > 0) {
              console.log(`Found value at domain root for ${property.name}: "${extractedValue}" with confidence ${confidence}%`);
              searchResults[property.name] = {
                name: property.name,
                value: extractedValue,
                sources: [{ url: domainRootUrl, title: `${domain} - Homepage` }],
                confidence,
              };
            }
          } catch (rootScrapeError) {
            console.error(`Error scraping domain root for ${property.name}:`, rootScrapeError);
          }
        }
      }
      
      return {
        articleNumber,
        productName,
        searchMethod: "url",
        properties: searchResults,
      };
    } catch (error) {
      console.error("Error in URL search:", error);
      throw new Error(`Failed to perform URL search: ${(error as Error).message}`);
    }
  }
  
  // Search using ValueSERP API with German settings (replaces Google search)
  private async searchWithGoogle(
    query: string,
    articleNumber: string,
    property?: SearchProperty,
    maxResults?: number
  ): Promise<{
    sources: { url: string; title?: string }[];
    propertyValue: string;
    confidenceScore: number;
  }> {
    // Redirect all searches to ValueSERP with German settings
    return this.searchWithValueSerp(query, articleNumber, property, maxResults);
  }
  

  // Primary ValueSERP search method with German settings
  private async performValueSerpSearch(
    query: string,
    maxResults?: number
  ): Promise<{
    sources: { url: string; title?: string }[];
  }> {
    try {
      const valueSerpApiKey = process.env.VALUESERP_API_KEY;
      if (!valueSerpApiKey) {
        throw new Error("ValueSERP API key not configured");
      }

      const requestedResults = maxResults || 10;
      const valueSerpParams = new URLSearchParams({
        api_key: valueSerpApiKey,
        q: query,
        engine: "google",
        location: "Germany",
        gl: "de", // Germany
        hl: "de", // German language
        num: requestedResults.toString(),
        safe: "off",
        device: "desktop",
        google_domain: "google.de",
        include_ai_overview: "true"
      });

      console.log(`Searching for: ${query}`);
      console.log(`Requested maxResults: ${requestedResults}`);
      console.log(`ValueSERP API URL: https://api.valueserp.com/search?${valueSerpParams.toString().replace(valueSerpApiKey, "[API_KEY_HIDDEN]")}`);

      const response = await fetch(`https://api.valueserp.com/search?${valueSerpParams}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`ValueSERP API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "ValueSERP search failed");
      }

      const organicResults = data.organic_results || [];
      console.log(`ValueSERP search results: ${organicResults.length} items found (requested: ${requestedResults})`);

      if (organicResults.length === 0) {
        console.log('No organic results found');
        return { sources: [] };
      }

      // Convert to our source format - take ALL results, not limited
      let sources = organicResults.map((result: any) => ({
        url: result.link,
        title: result.title || result.link
      }));

      // Apply domain filtering BEFORE returning results
      const originalCount = sources.length;
      
      // Filter out excluded domains first
      if (this.excludedDomains.some(d => d.isActive)) {
        console.log(`[DOMAIN-FILTER] Filtering out excluded domains from ${sources.length} search results`);
        sources = sources.filter((source: { url: string; title?: string }) => {
          const shouldExclude = this.isDomainExcluded(source.url);
          if (shouldExclude) {
            console.log(`[DOMAIN-FILTER] ❌ Excluding result: ${source.url}`);
          }
          return !shouldExclude;
        });
        console.log(`[DOMAIN-FILTER] Removed ${originalCount - sources.length} excluded domain(s) from search results`);
      }

      // Prioritize manufacturer domains
      if (this.manufacturerDomains.some(d => d.isActive)) {
        sources = this.prioritizeManufacturerDomains(sources);
      }

      console.log(`Returning ${sources.length} search results to caller (after domain filtering)`);
      return { sources };

    } catch (error) {
      console.error("Error with ValueSERP search:", error);
      throw new Error(`ValueSERP search failed: ${(error as Error).message}`);
    }
  }

  // Legacy method for compatibility - redirects to ValueSERP
  private async searchWithValueSerp(
    query: string,
    articleNumber: string,
    property?: SearchProperty,
    maxResults?: number
  ): Promise<{
    sources: { url: string; title?: string }[];
    propertyValue: string;
    confidenceScore: number;
  }> {
    const searchResult = await this.performValueSerpSearch(query, maxResults);
    
    // If searching for a specific property, try to extract it from the first few results
    let propertyValue = "";
    let confidenceScore = 0;

    if (property && searchResult.sources.length > 0) {
      // Try to extract the property value from the first few sources
      for (const source of searchResult.sources) {
        try {
          const { extractedValue, confidence } = await this.scrapeWebpage(
            source.url,
            property.name,
            property.description || "",
            articleNumber
          );
          
          if (extractedValue && confidence > confidenceScore) {
            propertyValue = extractedValue;
            confidenceScore = confidence;
          }
        } catch (error) {
          console.error(`Error scraping ${source.url} for ${property.name}:`, error);
        }
      }
    }

    return { 
      sources: searchResult.sources, 
      propertyValue, 
      confidenceScore 
    };
  }
  
  // Scrape a webpage and collect content for AI processing
  private async scrapeWebpage(
    url: string,
    propertyName: string,
    propertyDescription: string,
    articleNumber: string,
    scrapedContentArray?: string[]
  ): Promise<{ extractedValue: string; confidence: number }> {
    try {
      console.log(`Scraping webpage: ${url} for property: ${propertyName}`);
      
      // First, try traditional HTTP scraping
      let response: any;
      let usedBrowserScraping = false;
      
      try {
        response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
          timeout: 10000, // 10 second timeout
        });
        
        console.log(`Fetched ${url}, page size: ${response.data.length} bytes`);
        
        // Check if page is heavily JavaScript-dependent
        const html = response.data;
        const hasReactApp = html.includes('data-reactroot') || html.includes('__REACT_DEVTOOLS') || html.includes('React');
        const hasVueApp = html.includes('data-v-') || html.includes('__vue__') || html.includes('Vue');
        const hasAngularApp = html.includes('ng-app') || html.includes('angular') || html.includes('Angular');
        const hasEmptyBody = html.includes('<body>') && html.indexOf('</body>') - html.indexOf('<body>') < 200;
        const hasMinimalContent = (html.match(/<p|<div|<span/g) || []).length < 5;
        const hasLotsOfScripts = (html.match(/<script/g) || []).length > 10;
        
        const isJavaScriptHeavy = hasReactApp || hasVueApp || hasAngularApp || hasEmptyBody || (hasMinimalContent && hasLotsOfScripts);
        
        if (isJavaScriptHeavy) {
          console.log(`Detected JavaScript-heavy content on ${url}. Switching to browser rendering...`);
          throw new Error('JavaScript-heavy content detected, using browser rendering');
        }
        
      } catch (httpError) {
        console.log(`Traditional HTTP scraping failed for ${url}. Attempting hybrid scraping...`);
        
        try {
          // Use fast scraper first for better performance
          const fastResult = await fastScraper.scrapeUrl(url, articleNumber);
          if (fastResult.success && fastResult.contentLength > 1000) {
            response = { data: fastResult.content };
            usedBrowserScraping = false;
            console.log(`Fast scraping successful for ${url}, content length: ${fastResult.contentLength} characters`);
          } else {
            // Fall back to browser scraping for complex dynamic content
            const browserResult = await browserScraper.scrapeUrl(url, articleNumber);
            response = { data: browserResult.content };
            usedBrowserScraping = true;
            console.log(`Browser scraping successful for ${url}, method: ${browserResult.method}, content length: ${browserResult.contentLength} characters`);
          }
          
        } catch (dynamicError) {
          console.error(`Both HTTP and dynamic scraping failed for ${url}:`, dynamicError);
          throw httpError; // Fall back to original error
        }
      }
      
      // We won't strictly require the article number to be on the page,
      // but we'll give a higher confidence if it is
      const containsArticleNumber = response.data.includes(articleNumber);
      let baseConfidence = containsArticleNumber ? 40 : 20;
      
      // Increase confidence for browser-scraped content as it's more accurate
      if (usedBrowserScraping) {
        baseConfidence += 20;
        console.log(`Browser scraping used, increasing base confidence to ${baseConfidence}%`);
      }
      
      // Load the HTML into cheerio for parsing
      const $ = cheerio.load(response.data);
      
      // Extract a clean title from the page for better source identification
      let pageTitle = "Unknown";
      try {
        pageTitle = $('title').text().trim();
        // Remove any JavaScript code or undefined values from title
        pageTitle = pageTitle.replace(/undefined/g, '')
                             .replace(/var\s+.*?=.*;?/g, '')
                             .replace(/if\s*\(.*?\)\s*\{.*?\}/g, '')
                             .trim();
        if (!pageTitle || pageTitle.length < 2) {
          pageTitle = new URL(url).hostname;
        }
      } catch (e) {
        pageTitle = new URL(url).hostname;
      }
      
      // If scrapedContentArray is provided, add this page content for AI processing
      if (scrapedContentArray) {
        // Extract as much useful content as possible including specifications tables, product details, etc.
        let pageText = "";
        
        // First try to find product specification tables and structured data
        const specSelectors = "table, .specs, .specifications, .product-specs, .technical-details, " + 
                              ".product-information, .tech-specs, .product-data, .features, " + 
                              "[class*='spec'], [id*='spec'], [class*='product-detail'], [id*='product-detail']";
        
        // Start with structured content since it's most valuable
        $(specSelectors).each((_, element) => {
          const text = $(element).text().trim().replace(/\s+/g, " ");
          if (text && text.length > 20) { // Only meaningful content
            pageText += `[STRUCTURED DATA] ${text}\n\n`;
          }
        });
        
        // Then get general content from common content elements
        $("body").find("p, h1, h2, h3, h4, h5, h6, li, td, th, dt, dd, div").each((_, element) => {
          const text = $(element).text().trim();
          // Don't add text that's clearly a menu, navigation, footer, etc.
          const parentClasses = $(element).parent().attr('class') || '';
          const elementClasses = $(element).attr('class') || '';
          const isLayoutElement = /menu|nav|footer|header|sidebar|copyright/i.test(parentClasses + elementClasses);
          
          if (text && !isLayoutElement && text.length > 10) {
            pageText += text + "\n";
          }
        });
        
        // Extract any metadata or structured product data
        const productMetadata: string[] = [];
        $('meta[property^="product:"], meta[property^="og:"], meta[name^="product:"], script[type="application/ld+json"]').each((_, element) => {
          if (element.tagName === 'META') {
            const property = $(element).attr('property') || $(element).attr('name');
            const content = $(element).attr('content');
            if (property && content) {
              productMetadata.push(`${property}: ${content}`);
            }
          } else if (element.tagName === 'SCRIPT') {
            try {
              const jsonContent = $(element).html();
              if (jsonContent) {
                const parsed = JSON.parse(jsonContent);
                if (parsed['@type'] === 'Product' || parsed.type === 'Product') {
                  productMetadata.push(`JSON-LD Product Data: ${jsonContent.substring(0, 500)}...`);
                }
              }
            } catch (e) {
              // Ignore JSON parsing errors
            }
          }
        });
        
        if (productMetadata.length > 0) {
          pageText += "\n[METADATA]\n" + productMetadata.join("\n") + "\n\n";
        }
        
        // Process the text to clean up whitespace while preserving line breaks for readability
        const processedText = pageText
          .replace(/\s+/g, " ")
          .replace(/\n+/g, "\n")
          .trim();
        
        // Add a header with the clean URL and title to the content
        const contentWithUrl = `Content from: ${url}\nTitle: ${pageTitle}\n--------------------------\n${processedText}\n--------------------------\n`;
        
        // Always add content for URL-based searches, otherwise only add if meaningful
        const isUrlSearch = url === this.lastSearchedUrl;
        if (isUrlSearch || processedText.length > 100) {
          scrapedContentArray.push(contentWithUrl);
          console.log(`Added ${processedText.length} chars of content from ${url} (${pageTitle}) to scraped content array`);
          
          // For very short processed text, log the raw HTML for debugging
          if (processedText.length < 500) {
            console.log("Warning: Extracted text is short, may need to improve content extraction");
            // Don't add raw HTML - it contains JavaScript and other junk that confuses the AI
          }
        }
      }
      
      // We're not using regex pattern matching anymore - relying solely on AI for extraction
      
      // Special cases for direct property extraction without using AI
      const isUrlSearch = url === this.lastSearchedUrl;
      
      // Case 1: For Product URL Based method, if the property is URL, use the exact URL
      if (isUrlSearch && propertyName.toLowerCase() === "url") {
        console.log(`Using exact provided URL for property ${propertyName}: ${url}`);
        return { extractedValue: url, confidence: 100 };
      }
      
      // Case 2: If this is the article number and we found it on the page, we can return it directly
      if (propertyName.toLowerCase() === "artikelnummer" && containsArticleNumber) {
        console.log(`Found article number ${articleNumber} on page, using it directly`);
        return { extractedValue: articleNumber, confidence: 95 };
      }
      
      // For all other properties, we'll let the AI model handle the extraction
      // Determine confidence based on search method and article number presence
      const confidence = isUrlSearch ? 
        (containsArticleNumber ? 75 : 60) : // Direct URL search with/without article number
        (containsArticleNumber ? 60 : 40);  // Search engine result with/without article number
      
      console.log(`Content collected for ${propertyName}. Will use AI for extraction instead of regex patterns.`);
      console.log(`Base confidence for this source: ${confidence}%`);
      
      // Return empty value - the actual extraction will be done by the AI model
      return { extractedValue: "", confidence: confidence };
    } catch (error) {
      console.error(`Error scraping ${url} for ${propertyName}:`, error);
      return { extractedValue: "", confidence: 0 };
    }

  }

  // Update manufacturer domains from storage and pass to valueSerpService
  async updateManufacturerDomains(storage: any): Promise<void> {
    try {
      console.log('[SEARCH-SERVICE] Loading manufacturer domains from storage...');
      
      // Get all manufacturer domains from storage
      const domains = await storage.getManufacturerDomains();
      
      if (!domains || domains.length === 0) {
        console.log('[SEARCH-SERVICE] No manufacturer domains found in storage');
        this.manufacturerDomains = [];
        valueSerpService.setManufacturerDomains([]);
        return;
      }
      
      // Convert to the format expected by valueSerpService
      const formattedDomains = domains.map((domain: any) => ({
        name: domain.name,
        websiteUrl: domain.websiteUrl,
        isActive: domain.isActive !== false // Default to true if not specified
      }));
      
      // Store in class property for local filtering
      this.manufacturerDomains = formattedDomains;
      
      // Pass the formatted domains to valueSerpService
      valueSerpService.setManufacturerDomains(formattedDomains);
      
      console.log(`[SEARCH-SERVICE] Loaded ${formattedDomains.length} manufacturer domains (${formattedDomains.filter((d: any) => d.isActive).length} active)`);
      
    } catch (error) {
      console.error('[SEARCH-SERVICE] Error updating manufacturer domains:', error);
      // Set empty array on error to prevent issues
      this.manufacturerDomains = [];
      valueSerpService.setManufacturerDomains([]);
    }
  }

  // Update excluded domains from storage and pass to valueSerpService
  async updateExcludedDomains(storage: any): Promise<void> {
    try {
      console.log('[SEARCH-SERVICE] Loading excluded domains from storage...');
      
      // Get all excluded domains from storage
      const domains = await storage.getExcludedDomains();
      
      if (!domains || domains.length === 0) {
        console.log('[SEARCH-SERVICE] No excluded domains found in storage');
        this.excludedDomains = [];
        valueSerpService.setExcludedDomains([]);
        return;
      }
      
      // Convert to the format expected by valueSerpService
      const formattedDomains = domains.map((domain: any) => ({
        domain: domain.domain,
        reason: domain.reason || '',
        isActive: domain.isActive !== false // Default to true if not specified
      }));
      
      // Store in class property for local filtering
      this.excludedDomains = formattedDomains;
      
      // Pass the formatted domains to valueSerpService
      valueSerpService.setExcludedDomains(formattedDomains);
      
      console.log(`[SEARCH-SERVICE] Loaded ${formattedDomains.length} excluded domains (${formattedDomains.filter((d: any) => d.isActive).length} active)`);
      
    } catch (error) {
      console.error('[SEARCH-SERVICE] Error updating excluded domains:', error);
      // Set empty array on error to prevent issues
      this.excludedDomains = [];
      valueSerpService.setExcludedDomains([]);
    }
  }

  // Check if a URL's domain should be excluded
  private isDomainExcluded(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      const isExcluded = this.excludedDomains.some(ed => {
        if (!ed.isActive) return false;
        
        // Normalize the excluded domain - remove protocol and trailing slashes
        const excludedDomain = ed.domain.toLowerCase()
          .replace(/^https?:\/\/(www\.)?/, '')
          .replace(/\/.*$/, '')
          .replace(/^www\./, '');
        
        // Normalize the URL domain
        const normalizedDomain = domain.replace(/^www\./, '');
        
        // Check for exact match, subdomain match, or contains match
        const isExactMatch = normalizedDomain === excludedDomain;
        const isSubdomain = normalizedDomain.endsWith(`.${excludedDomain}`);
        const containsMatch = normalizedDomain.includes(excludedDomain) ||
                             excludedDomain.includes(normalizedDomain);
        
        const isDomainMatch = isExactMatch || isSubdomain || containsMatch;
        
        if (isDomainMatch) {
          console.log(`[DOMAIN-FILTER] Excluded domain match: ${domain} matches excluded domain ${excludedDomain} (exact: ${isExactMatch}, subdomain: ${isSubdomain}, contains: ${containsMatch})`);
        }
        
        return isDomainMatch;
      });
      
      return isExcluded;
    } catch (e) {
      // Fallback for invalid URLs
      const lowercaseUrl = url.toLowerCase();
      
      return this.excludedDomains.some(ed => {
        if (!ed.isActive) return false;
        const excludedDomain = ed.domain.toLowerCase()
          .replace(/^https?:\/\/(www\.)?/, '')
          .replace(/\/.*$/, '');
        return lowercaseUrl.includes(excludedDomain);
      });
    }
  }

  // Check if a URL's domain is a prioritized manufacturer domain
  private isDomainPrioritized(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      return this.manufacturerDomains.some(md => {
        if (!md.isActive) return false;
        
        try {
          let mdDomain = '';
          if (md.websiteUrl.startsWith('http://') || md.websiteUrl.startsWith('https://')) {
            const mdUrlObj = new URL(md.websiteUrl);
            mdDomain = mdUrlObj.hostname.toLowerCase();
          } else {
            mdDomain = md.websiteUrl.toLowerCase().replace(/^www\./, '');
          }
          
          const normalizedDomain = domain.replace(/^www\./, '');
          const normalizedMdDomain = mdDomain.replace(/^www\./, '');
          
          const isExactMatch = normalizedDomain === normalizedMdDomain;
          const isSubdomain = normalizedDomain.endsWith(`.${normalizedMdDomain}`) ||
                             normalizedMdDomain.endsWith(`.${normalizedDomain}`);
          const containsMatch = normalizedDomain.includes(normalizedMdDomain) ||
                               normalizedMdDomain.includes(normalizedDomain);
          
          if (isExactMatch || isSubdomain || containsMatch) {
            console.log(`[DOMAIN-FILTER] 🎯 Manufacturer domain match: ${url} matches ${md.websiteUrl} (${md.name})`);
            return true;
          }
          
          return false;
        } catch (e) {
          const normalizedUrl = url.toLowerCase();
          const normalizedManufacturerUrl = md.websiteUrl.toLowerCase();
          
          return normalizedUrl.includes(normalizedManufacturerUrl) ||
                 normalizedManufacturerUrl.includes(normalizedUrl) ||
                 normalizedUrl.includes(md.name.toLowerCase());
        }
      });
    } catch (e) {
      console.log(`[DOMAIN-FILTER] Error checking prioritized domain for ${url}:`, e);
      return false;
    }
  }

  // Prioritize manufacturer domains in search results
  private prioritizeManufacturerDomains(sources: { url: string; title?: string }[]): { url: string; title?: string }[] {
    if (!this.manufacturerDomains.some(d => d.isActive)) {
      console.log("[DOMAIN-FILTER] No active manufacturer domains configured, skipping prioritization");
      return sources;
    }
    
    const activeDomains = this.manufacturerDomains.filter(d => d.isActive);
    console.log(`[DOMAIN-FILTER] 🔄 Prioritizing search results based on ${activeDomains.length} active manufacturer domains:`);
    activeDomains.forEach(domain => {
      console.log(`[DOMAIN-FILTER]   📍 ${domain.name}: ${domain.websiteUrl}`);
    });
    
    const manufacturerSources: { url: string; title?: string }[] = [];
    const otherSources: { url: string; title?: string }[] = [];
    
    sources.forEach(source => {
      if (this.isDomainPrioritized(source.url)) {
        console.log(`[DOMAIN-FILTER] 🎯 PRIORITIZED - Manufacturer domain found: ${source.url}`);
        manufacturerSources.push(source);
      } else {
        otherSources.push(source);
      }
    });
    
    const prioritizedSources = [...manufacturerSources, ...otherSources];
    
    console.log(`[DOMAIN-FILTER] 📊 Prioritization Summary: ${manufacturerSources.length} manufacturer domain results prioritized out of ${sources.length} total results`);
    if (manufacturerSources.length > 0) {
      console.log("[DOMAIN-FILTER] 🔝 TOP PRIORITIZED RESULTS (Manufacturer Domains):");
      manufacturerSources.forEach((source, index) => {
        console.log(`[DOMAIN-FILTER]   ${index + 1}. 🏆 ${source.url} ${source.title ? `(${source.title})` : ''}`);
      });
      console.log(`[DOMAIN-FILTER] 📋 Remaining ${otherSources.length} non-manufacturer results will follow...`);
    } else {
      console.log("[DOMAIN-FILTER] ⚠️ No manufacturer domain matches found in search results");
    }
    
    return prioritizedSources;
  }

  /**
   * Extract text content from a PDF file using pdf-parse utility
   * @param url - URL or path to the PDF file
   * @returns Extracted text content as plain text
   */
  private async extractPdfText(url: string): Promise<string> {
    const { extractPdfText } = await import('../utils/pdfExtractor');
    return extractPdfText(url);
  }
}

export const searchService = new SearchService();
