import axios from "axios";
import { PropertyResult } from "@shared/schema";

interface SearchProperty {
  name: string;
  description?: string;
  expectedFormat?: string;
  orderIndex?: number;
  isRequired?: boolean;
}
import { openaiService } from "./openaiService";

// Interface for search result properties
interface SearchResultProperties {
  [key: string]: PropertyResult;
}

/**
 * ValueSERP Service - Handles ValueSERP integration and result processing
 */
export class ValueSerpService {
  private manufacturerDomains: { name: string; websiteUrl: string; isActive: boolean }[] = [];
  private excludedDomains: { domain: string; reason: string; isActive: boolean }[] = [];
  
  // Set manufacturer domains for prioritization
  setManufacturerDomains(domains: { name: string; websiteUrl: string; isActive: boolean }[]) {
    this.manufacturerDomains = domains;
    console.log(`ValueSERP: Loaded ${domains.filter(d => d.isActive).length} active manufacturer domains for prioritization`);
  }
  
  // Set excluded domains
  setExcludedDomains(domains: { domain: string; reason: string; isActive: boolean }[]) {
    this.excludedDomains = domains;
    console.log(`ValueSERP: Loaded ${domains.filter(d => d.isActive).length} active excluded domains for filtering`);
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
            console.log(`ValueSERP: Domain match found: ${url} matches manufacturer domain ${md.websiteUrl} (${md.name})`);
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
      console.log(`ValueSERP: Error checking prioritized domain for ${url}:`, e);
      return false;
    }
  }
  
  // Check if a URL's domain should be excluded
  private isDomainExcluded(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      const isExcluded = this.excludedDomains.some(ed => {
        if (!ed.isActive) return false;
        
        const excludedDomain = ed.domain.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
        
        const isDomainMatch = domain === excludedDomain || 
                             domain.endsWith(`.${excludedDomain}`) || 
                             domain.includes(excludedDomain) ||
                             excludedDomain.includes(domain);
        
        if (isDomainMatch) {
          console.log(`ValueSERP: Excluded domain match: ${domain} matches excluded domain ${excludedDomain}`);
        }
        
        return isDomainMatch;
      });
      
      if (isExcluded) {
        console.log(`ValueSERP: Excluding URL: ${url}`);
      }
      
      return isExcluded;
    } catch (e) {
      const lowercaseUrl = url.toLowerCase();
      
      return this.excludedDomains.some(ed => {
        if (!ed.isActive) return false;
        const excludedDomain = ed.domain.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
        return lowercaseUrl.includes(excludedDomain);
      });
    }
  }
  
  // Prioritize manufacturer domains in search results
  private prioritizeManufacturerDomains(sources: { url: string; title?: string }[]): { url: string; title?: string }[] {
    if (!this.manufacturerDomains.some(d => d.isActive)) {
      console.log("ValueSERP: No active manufacturer domains configured, skipping prioritization");
      return sources;
    }
    
    const activeDomains = this.manufacturerDomains.filter(d => d.isActive);
    console.log(`ValueSERP: 🔄 Prioritizing search results based on ${activeDomains.length} active manufacturer domains:`);
    activeDomains.forEach(domain => {
      console.log(`ValueSERP:   📍 ${domain.name}: ${domain.websiteUrl}`);
    });
    
    const manufacturerSources: { url: string; title?: string }[] = [];
    const otherSources: { url: string; title?: string }[] = [];
    
    sources.forEach(source => {
      if (this.isDomainPrioritized(source.url)) {
        console.log(`ValueSERP: 🎯 PRIORITIZED - Manufacturer domain found: ${source.url}`);
        manufacturerSources.push(source);
      } else {
        otherSources.push(source);
      }
    });
    
    const prioritizedSources = [...manufacturerSources, ...otherSources];
    
    console.log(`ValueSERP: 📊 Prioritization Summary: ${manufacturerSources.length} manufacturer domain results prioritized out of ${sources.length} total results`);
    if (manufacturerSources.length > 0) {
      console.log("ValueSERP: 🔝 TOP PRIORITIZED RESULTS (Manufacturer Domains):");
      manufacturerSources.forEach((source, index) => {
        console.log(`ValueSERP:   ${index + 1}. 🏆 ${source.url} ${source.title ? `(${source.title})` : ''}`);
      });
      console.log(`ValueSERP: 📋 Remaining ${otherSources.length} non-manufacturer results will follow...`);
    } else {
      console.log("ValueSERP: ⚠️ No manufacturer domain matches found in search results");
    }
    
    return prioritizedSources;
  }
  
  /**
   * Process search with ValueSERP and extract product specifications
   */
  async searchAndProcessContent(
    query: string,
    articleNumber: string,
    productName: string,
    properties: SearchProperty[],
    valueSerpApiKey: string,
    useAI: boolean = true,
    aiModelProvider: 'openai' = 'openai',
    openaiApiKey?: string,
    maxResults: number = 10
  ) {
    console.log(`Processing ValueSERP search and content extraction for: ${query}`);
    
    try {
      // Step 1: Construct optimized search query for better accuracy
      // Use more precise search operators for exact matching
      const preciseQuery = `"${articleNumber}" "${productName}" -"similar products"`;
      const technicalQuery = `"${articleNumber}" AND "${productName}" specifications OR datasheet OR "technical data"`;
      const exactProductQuery = `intitle:"${productName}" "${articleNumber}"`;
      
      console.log(`ValueSERP: Using multiple precise queries for better accuracy`);
      
      // Build a set of progressively more specific queries
      const searchQueries: string[] = [];
      
      // First priority: Exact match queries
      searchQueries.push(preciseQuery);
      searchQueries.push(exactProductQuery);
      
      // Check manufacturer domains for site-specific searches
      if (this.manufacturerDomains.some(d => d.isActive)) {
        const activeDomains = this.manufacturerDomains.filter(d => d.isActive);
        
        // Add site-specific searches for manufacturer domains with exact product
        activeDomains.slice(0, 2).forEach(domain => {
          try {
            let siteSearch = '';
            if (domain.websiteUrl.startsWith('http://') || domain.websiteUrl.startsWith('https://')) {
              const urlObj = new URL(domain.websiteUrl);
              siteSearch = urlObj.hostname.replace(/^www\./, '');
            } else {
              siteSearch = domain.websiteUrl.replace(/^www\./, '');
            }
            
            // Use more specific site search with exact phrases
            const siteSpecificQuery = `site:${siteSearch} "${articleNumber}" AND "${productName}"`;
            searchQueries.push(siteSpecificQuery);
            console.log(`ValueSERP: Added manufacturer-specific query: "${siteSpecificQuery}"`);
          } catch (e) {
            console.log(`ValueSERP: Failed to create site search for ${domain.websiteUrl}`);
          }
        });
      }
      
      // Last resort: Technical specifications query
      searchQueries.push(technicalQuery);
      
      // Try the manufacturer-specific queries first, then fall back to general query
      let bestResults: any = null;
      let bestResultsCount = 0;
      
      for (const searchQuery of searchQueries) {
        console.log(`ValueSERP: Trying search query: "${searchQuery}"`);
        
        const searchUrl = new URL('https://api.valueserp.com/search');
        
        // Add required parameters
        searchUrl.searchParams.append('api_key', valueSerpApiKey);
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('page', '1');
        searchUrl.searchParams.append('output', 'json');
        searchUrl.searchParams.append('device', 'desktop');
        searchUrl.searchParams.append('gl', 'us');
        searchUrl.searchParams.append('hl', 'en');
        
        console.log(`ValueSERP: Fetching search results for: "${searchQuery}"`);
      
      try {
          const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Check response status
          console.log(`ValueSERP API response status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            console.log(`ValueSERP API error for query "${searchQuery}": ${response.status} ${response.statusText}`);
            continue; // Try next query
          }
          
          // Parse JSON response
          const responseData = await response.json();
          
          // Check if response has expected structure
          if (!responseData.organic_results) {
            console.log(`ValueSERP: Invalid response structure for query "${searchQuery}"`);
            continue; // Try next query
          }
          
          const organicResults = responseData.organic_results || [];
          console.log(`ValueSERP: Found ${organicResults.length} results for query "${searchQuery}"`);
          
          // Check if this result set is better (more results or contains manufacturer domains)
          let manufacturerMatches = 0;
          if (this.manufacturerDomains.some(d => d.isActive)) {
            manufacturerMatches = organicResults.filter((result: any) => 
              this.isDomainPrioritized(result.link)
            ).length;
          }
          
          const resultScore = organicResults.length + (manufacturerMatches * 10); // Weight manufacturer matches heavily
          
          if (resultScore > bestResultsCount) {
            bestResults = responseData;
            bestResultsCount = resultScore;
            console.log(`ValueSERP: New best result set with score ${resultScore} (${organicResults.length} results, ${manufacturerMatches} manufacturer matches)`);
            
            // If we found manufacturer domain matches, use this result immediately
            if (manufacturerMatches > 0) {
              console.log(`ValueSERP: Found manufacturer domain matches, using this result set`);
              break;
            }
          }
        } catch (searchError) {
          console.error(`ValueSERP: Error with search query "${searchQuery}":`, searchError);
          continue; // Try next query
        }
      }
      
      // Use the best results we found
      if (!bestResults) {
        console.log("ValueSERP: No successful search results from any query");
        throw new Error('All ValueSERP search queries failed');
      }
      
      // Step 2: Extract organic search results from best result set
      const organicResults = bestResults.organic_results || [];
      console.log(`Found ${organicResults.length} organic results from ValueSERP`);
      
      if (organicResults.length === 0) {
        console.log("No organic results found in ValueSERP response");
        
        // Return empty results
        return {
          id: Date.now(),
          searchMethod: "auto",
          searchStatus: "complete",
          products: [{
            id: articleNumber,
            articleNumber,
            productName,
            properties: this.createEmptyProperties(properties),
          }]
        };
      }
      
      // Convert ValueSERP results to source format with cleaned titles
      let sources = organicResults.map((result: any) => ({
        url: result.link,
        title: this.cleanPageTitle(result.title || result.link),
        originalTitle: result.title || result.link, // Keep original for reference
      }));
      
      // Filter out excluded domains
      if (this.excludedDomains.some(d => d.isActive)) {
        console.log(`ValueSERP: Filtering out excluded domains from ${sources.length} search results`);
        const originalCount = sources.length;
        sources = sources.filter((source: { url: string, title: string }) => {
          const shouldKeep = !this.isDomainExcluded(source.url);
          if (!shouldKeep) {
            console.log(`ValueSERP: Excluding result: ${source.url}`);
          }
          return shouldKeep;
        });
        console.log(`ValueSERP: Removed ${originalCount - sources.length} excluded domain(s) from search results`);
      }
      
      // Prioritize manufacturer domains BEFORE limiting sources
      sources = this.prioritizeManufacturerDomains(sources);
      
      // Step 3: Fetch HTML content from source URLs
      console.log(`ValueSERP: Found ${sources.length} prioritized search results for the product`);
      
      const maxSourcesToProcess = maxResults || 10; // Use user's desired source count
      const sourcesToProcess = sources.slice(0, maxSourcesToProcess);
      
      // Fetch and process HTML content from each source using enhanced extraction
      const contentSources: string[] = [];
      for (const source of sourcesToProcess) {
        try {
          console.log(`Fetching content from: ${source.url}`);
          
          let response: any;
          let usedEnhancedScraping = false;
          
          try {
            // First try traditional HTTP scraping
            response = await axios.get(source.url, {
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
            
            console.log(`Fetched ${source.url}, HTML size: ${response.data.length} bytes`);
          } catch (httpError) {
            console.log(`Traditional HTTP scraping failed for ${source.url}. Attempting enhanced scraping...`);
            
            try {
              // Use enhanced scraping for dynamic content
              const { hybridScraper } = await import('./hybridScraper');
              const hybridResult = await hybridScraper.scrapeUrl(source.url, articleNumber);
              
              if (hybridResult.success && hybridResult.content.length > 100) {
                // Convert hybrid scraper result to format expected by AI service
                const enhancedContent = `Content from: ${source.url}\nTitle: ${hybridResult.title}\n--------------------------\n${hybridResult.content}\n--------------------------\n`;
                contentSources.push(enhancedContent);
                usedEnhancedScraping = true;
                
                console.log(`Enhanced scraping successful for ${source.url}, method: ${hybridResult.method}, content length: ${hybridResult.contentLength} characters`);
                continue;
              } else {
                console.log(`Enhanced scraping failed for ${source.url}`);
                continue;
              }
            } catch (hybridError) {
              console.error(`Both HTTP and enhanced scraping failed for ${source.url}:`, hybridError);
              continue;
            }
          }
          
          if (!usedEnhancedScraping && response && response.data) {
            // Use enhanced HTML parser for better content extraction
            const { htmlParserService } = await import('./htmlParserService');
            try {
              const parsedContent = htmlParserService.parseHtmlContent(response.data, source.url);
              
              // Create comprehensive content for AI processing
              const comprehensiveContent = [
                `Content from: ${source.url}`,
                `Title: ${parsedContent.title}`,
                `Description: ${parsedContent.description}`,
                `--------------------------`,
                `[PRODUCT-SPECS] ${parsedContent.extractedSections.productSpecs}`,
                `[TECHNICAL-DATA] ${parsedContent.extractedSections.technicalData}`,
                `[FEATURES] ${parsedContent.extractedSections.features}`,
                `[DIMENSIONS] ${parsedContent.extractedSections.dimensions}`,
                `[STRUCTURED-DATA] ${JSON.stringify(parsedContent.structuredData)}`,
                `[FULL-TEXT-CONTENT] ${parsedContent.textContent}`,
                `--------------------------`
              ].filter(Boolean).join('\n');
              
              contentSources.push(comprehensiveContent);
              console.log(`Enhanced HTML parsing successful for ${source.url}, processed content length: ${comprehensiveContent.length} characters`);
            } catch (parseError) {
              console.log(`HTML parsing failed for ${source.url}, using raw HTML`);
              // Fallback to raw HTML with maximum size limit for comprehensive AI processing
              const rawContent = `Content from: ${source.url}\n--------------------------\n${response.data.substring(0, 2000000)}\n--------------------------\n`;
              contentSources.push(rawContent);
            }
          }
        } catch (error) {
          console.error(`Error processing ${source.url}:`, error);
        }
      }
      
      console.log(`Collected ${contentSources.length} HTML content sources for AI analysis`);
      
      // Step 4: Process with AI if content was found and AI is enabled
      let searchResults: SearchResultProperties = this.createEmptyProperties(properties);
      
      if (contentSources.length > 0 && useAI) {
        console.log("Processing content with AI for specification extraction");
        
        // Configure OpenAI service
        if (openaiApiKey) {
          console.log("Using OpenAI for ValueSERP content extraction");
          openaiService.setApiKey(openaiApiKey);
        } else {
          console.log("Using OpenAI with environment API key");
        }
        
        try {
          // Create a temporary response object for the AI service
          const tempResponse = {
            id: Date.now(),
            searchMethod: "auto",
            searchStatus: "processing" as "analyzing",
            products: [{
              id: articleNumber,
              articleNumber,
              productName,
              properties: searchResults,
              __rawContent: contentSources
            }]
          };
          
          // Get imported properties to use as must-have requirements
          const { storage } = await import('../storage');
          const requiredProperties = await storage.getProperties();
          console.log(`Using ${requiredProperties.length} imported properties as must-have requirements for ValueSERP`);

          // Convert properties to the expected format for AI service
          const aiProperties = requiredProperties.map(prop => ({
            name: prop.name,
            description: prop.description || undefined,
            expectedFormat: prop.expectedFormat || undefined,
            orderIndex: prop.orderIndex || undefined
          }));

          // Process the content with AI
          console.log(`Extracting technical specifications for ${articleNumber} - ${productName} from ${contentSources.length} HTML sources`);
          const extractedProperties = await openaiService.extractTechnicalSpecifications(
            contentSources,
            articleNumber,
            productName,
            aiProperties
          );
          
          // Convert to the expected format
          searchResults = {};
          for (const [propName, propResult] of Object.entries(extractedProperties)) {
            searchResults[propName] = propResult;
          }
          
          console.log("AI extraction completed successfully");
        } catch (aiError) {
          console.error("Error extracting specifications with AI:", aiError);
        }
      }
      
      // Return the final response with extracted properties
      return {
        id: Date.now(),
        searchMethod: "auto",
        searchStatus: "complete",
        products: [{
          id: articleNumber,
          articleNumber,
          productName,
          properties: searchResults,
          __sources: sources.slice(0, 10), // Store the top 10 sources for reference
        }]
      };
    } catch (error) {
      console.error("Error processing ValueSERP search:", error);
      throw new Error(`ValueSERP processing failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Clean advertisement text from page titles
   */
  private cleanPageTitle(title: string): string {
    // Common advertisement patterns to remove from titles
    const adPatterns = [
      // German patterns
      /\s*[-|–—]\s*[Jj]etzt\s+(kaufen|bestellen|sparen|heizen|shoppen|anschauen|sichern|entdecken|informieren)/gi,
      /\s*[-|–—]\s*[Bb]ei\s+.+\s+(kaufen|bestellen|sparen)/gi,
      /\s*[-|–—]\s*[Mm]it\s+.+\s+(sparen|bestellen)/gi,
      /\s*[-|–—]\s*[Gg]ünstig(er|ste)?\s+(kaufen|bestellen)/gi,
      /\s*[-|–—]\s*[Bb]is\s+zu\s+\d+%\s+(sparen|reduziert)/gi,
      /\s*[-|–—]\s*[Vv]ersandkostenfrei/gi,
      /\s*[-|–—]\s*[Kk]ostenlos(er)?\s+[Vv]ersand/gi,
      /\s*[-|–—]\s*[Aa]b\s+\d+[,.]?\d*\s*(€|EUR|Euro)/gi,
      /\s*[-|–—]\s*[Pp]reis(e)?\s+vergleichen/gi,
      /\s*[-|–—]\s*[Ii]m\s+[Aa]ngebot/gi,
      /\s*[-|–—]\s*[Ss]ale/gi,
      /\s*[-|–—]\s*[Rr]abatt/gi,
      /\s*[-|–—]\s*[Oo]nline\s+[Ss]hop/gi,
      
      // Common shop suffixes
      /\s*[-|–—]\s*[Ss]hop\.?\w*/gi,
      /\s*[-|–—]\s*.+\s*[Oo]nline\s*[Ss]hop/gi,
      /\s*[-|–—]\s*.+\s*[Oo]nline/gi,
      
      // English patterns (some German sites use English)
      /\s*[-|–—]\s*[Bb]uy\s+(now|online|today)/gi,
      /\s*[-|–—]\s*[Ss]hop\s+(now|online|today)/gi,
      /\s*[-|–—]\s*[Ff]ree\s+(shipping|delivery)/gi,
      /\s*[-|–—]\s*[Oo]n\s+[Ss]ale/gi,
      
      // Generic call-to-action patterns
      /\s*[|]\s*[^|]+$/,  // Remove everything after last pipe
      /\s*[-–—]\s*[^-–—]+$/,  // Remove everything after last dash
    ];
    
    let cleanTitle = title;
    
    // Apply each pattern to clean the title
    for (const pattern of adPatterns) {
      cleanTitle = cleanTitle.replace(pattern, '');
    }
    
    // Also remove trailing punctuation and whitespace
    cleanTitle = cleanTitle.trim().replace(/[.,!?]+$/, '').trim();
    
    return cleanTitle;
  }

  /**
   * Create empty properties with "Not found" values
   */
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
}

export const valueSerpService = new ValueSerpService();