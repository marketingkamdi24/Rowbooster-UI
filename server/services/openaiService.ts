import OpenAI from "openai";
import { SearchResponse, PropertyResult, ProductResult } from "@shared/schema";
import { v4 as uuidv4 } from 'uuid';
import { parseHtmlToCleanText, processMultipleHtmlSources } from "../utils/htmlParser";
import { TokenTracker } from "./tokenTracker";
import { MonitoringLogger } from "./monitoringLogger";

// Comprehensive synonym mapping for property names
const PROPERTY_SYNONYMS: Record<string, string[]> = {
  'Breite': ['Width', 'B', 'Abmessung Breite', 'Breit', 'Breite (mm)', 'Breite (cm)', 'width', 'W'],
  'Höhe': ['Height', 'H', 'Abmessung Höhe', 'Hoch', 'Höhe (mm)', 'Höhe (cm)', 'height'],
  'Tiefe': ['Depth', 'Length', 'L', 'T', 'Abmessung Tiefe', 'Tief', 'Tiefe (mm)', 'Tiefe (cm)', 'depth', 'length', 'Länge'],
  'Gewicht': ['Weight', 'Masse', 'kg', 'Kilogramm', 'Gewicht (kg)', 'weight', 'mass', 'Netto-Gewicht', 'Nettogewicht'],
  'Leistung': ['Power', 'Watt', 'W', 'Leistung (W)', 'power', 'watt', 'Nennleistung'],
  'Temperatur': ['Temperature', '°C', 'Grad', 'Celsius', 'Temperatur (°C)', 'temperature', 'Temp'],
  'Spannung': ['Voltage', 'V', 'Volt', 'Spannung (V)', 'voltage', 'Nennspannung'],
  'Strom': ['Current', 'A', 'Ampere', 'Strom (A)', 'current', 'Stromaufnahme'],
  'Frequenz': ['Frequency', 'Hz', 'Hertz', 'Frequenz (Hz)', 'frequency'],
  'Volumen': ['Volume', 'Liter', 'L', 'Volumen (L)', 'volume', 'Fassungsvermögen'],
  'Kapazität': ['Capacity', 'Fassungsvermögen', 'capacity', 'Inhalt'],
  'Material': ['Material', 'Werkstoff', 'material', 'Materials'],
  'Farbe': ['Color', 'Colour', 'color', 'colour', 'Farbausführung'],
  'Durchmesser': ['Diameter', 'Ø', 'diameter', 'Durchm.', 'D'],
  'Abmessungen': ['Dimensions', 'Maße', 'dimensions', 'Abmessung', 'Außenmaße'],
  'Betriebsspannung': ['Operating Voltage', 'Versorgungsspannung', 'Supply Voltage'],
  'Wirkungsgrad': ['Efficiency', 'Effizienz', 'efficiency', 'η'],
  'Schutzart': ['Protection Class', 'IP Rating', 'IP-Schutzart', 'IP'],
  'Schutzklasse': ['Protection Class', 'Isolation Class', 'Sicherheitsklasse'],
  'Energieeffizienzklasse': ['Energy Efficiency Class', 'Effizienzklasse', 'Energy Class']
};

// Function to normalize property names using synonyms and target properties
function normalizePropertyName(inputName: string, targetProperties: any[]): string {
  const cleanInput = inputName.trim();
  
  // First, check exact match with target properties
  for (const targetProp of targetProperties) {
    if (targetProp.name.toLowerCase() === cleanInput.toLowerCase()) {
      return targetProp.name;
    }
  }
  
  // Check synonyms and map to target properties
  for (const [canonical, synonyms] of Object.entries(PROPERTY_SYNONYMS)) {
    const allVariants = [canonical, ...synonyms];
    
    if (allVariants.some(variant => variant.toLowerCase() === cleanInput.toLowerCase())) {
      // Find matching target property
      const matchingTarget = targetProperties.find(p => 
        allVariants.some(variant => variant.toLowerCase() === p.name.toLowerCase())
      );
      return matchingTarget ? matchingTarget.name : canonical;
    }
  }
  
  return cleanInput;
}

// Valid AI model options - only these two models are allowed
export type AIModelId = "gpt-4.1" | "gpt-4.1-mini";

// Default model if none specified
export const DEFAULT_AI_MODEL: AIModelId = "gpt-4.1-mini";

// Create an AI service for analyzing product properties (OpenAI only)
export class OpenAIService {
  private openai: OpenAI | null = null;
  private openaiApiKey: string | null = null;

  // Validate and return a safe model name
  private validateModel(model?: string): AIModelId {
    if (model === "gpt-4.1" || model === "gpt-4.1-mini") {
      return model;
    }
    console.log(`[OpenAI] Invalid or missing model "${model}", using default: ${DEFAULT_AI_MODEL}`);
    return DEFAULT_AI_MODEL;
  }
  
  // New method for automated mode with consistency marking across multiple sources
  async extractTechnicalSpecificationsWithConsistency(
    htmlContents: Array<string | {content: string, url: string, title: string}>,
    articleNumber: string,
    productName: string,
    requiredProperties?: { name: string; description?: string; expectedFormat?: string; orderIndex?: number; isRequired?: boolean }[],
    userId?: number | null,
    modelId?: string
  ): Promise<Record<string, PropertyResult>> {
    const model = this.validateModel(modelId);
    console.log(`[OpenAI] Using model: ${model} for consistency extraction`);
    console.log(`Extracting technical specifications with consistency analysis for ${articleNumber} - ${productName} from ${htmlContents.length} HTML sources`);
    
    // Log required properties if provided
    if (requiredProperties && requiredProperties.length > 0) {
      console.log(`Must-have properties (${requiredProperties.length}):`, requiredProperties.map(p => p.name).join(', '));
    }
    
    const extractedProperties: Record<string, PropertyResult> = {
      // Always include the Artikelnummer property
      "Artikelnummer": {
        name: "Artikelnummer",
        value: articleNumber,
        confidence: 100,
        isConsistent: true,
        consistencyCount: htmlContents.length,
        sourceCount: htmlContents.length,
        sources: []
      }
    };
    
    // Initialize required properties with "Not found" values to ensure they appear in output
    if (requiredProperties) {
      requiredProperties.forEach(prop => {
        if (prop.name !== "Artikelnummer") { // Don't override Artikelnummer
          extractedProperties[prop.name] = {
            name: prop.name,
            value: "",
            confidence: 0,
            isConsistent: false,
            consistencyCount: 0,
            sourceCount: htmlContents.length,
            sources: []
          };
        }
      });
    }
    
    try {
      // Check if we have valid HTML content and API configuration
      if (htmlContents.length === 0 || !this.hasOpenAiKey()) {
        console.log("No content to process or no valid AI service available");
        return extractedProperties;
      }
      
      // First, validate web pages to ensure they're relevant to the product
      console.log("Filtering web pages for product relevance...");
      const validatedSources = await this.validateWebPageRelevance(htmlContents, articleNumber, productName);
      
      if (validatedSources.length === 0) {
        console.log("No relevant web pages found after validation");
        return extractedProperties;
      }
      
      console.log(`${validatedSources.length} out of ${htmlContents.length} web pages are relevant for product analysis`);
      
      // Extract data from validated sources in parallel for faster processing
      const sourceExtractions: Array<{sourceIndex: number, properties: Record<string, string>}> = [];
      
      console.log(`Starting parallel AI extraction for ${validatedSources.length} sources...`);
      const extractionStartTime = Date.now();
      
      // OPTIMIZED: Process sources in TRUE parallel with higher concurrency
      const CONCURRENT_AI_REQUESTS = 10; // Process all sources at once for speed
      
      for (let i = 0; i < validatedSources.length; i += CONCURRENT_AI_REQUESTS) {
        const batch = validatedSources.slice(i, i + CONCURRENT_AI_REQUESTS);
        const batchPromises = batch.map((source, batchIndex) => {
          const sourceIndex = i + batchIndex;
          return this.extractFromSingleSource(
            source.content,
            sourceIndex + 1,
            articleNumber,
            productName,
            requiredProperties,
            userId,
            model
          ).then(sourceData => ({
            sourceIndex,
            properties: sourceData
          }));
        });
        
        const batchResults = await Promise.all(batchPromises);
        sourceExtractions.push(...batchResults);
        
        console.log(`Processed AI batch ${Math.floor(i / CONCURRENT_AI_REQUESTS) + 1}/${Math.ceil(validatedSources.length / CONCURRENT_AI_REQUESTS)}`);
      }
      
      const extractionTime = Date.now() - extractionStartTime;
      console.log(`Parallel AI extraction completed in ${extractionTime}ms (${Math.round(extractionTime / validatedSources.length)}ms per source average)`);
      
      // Analyze consistency across all sources
      const consistencyAnalysis = this.analyzeValueConsistency(sourceExtractions, requiredProperties || []);
      
      // Build final result with consistency marking
      if (requiredProperties && requiredProperties.length > 0) {
        const sortedProperties = requiredProperties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        
        for (const prop of sortedProperties) {
          const analysis = consistencyAnalysis[prop.name];
          if (analysis) {
            extractedProperties[prop.name] = {
              name: prop.name,
              value: analysis.mostConsistentValue,
              confidence: analysis.confidence,
              isConsistent: analysis.consistencyCount >= 2,
              consistencyCount: analysis.consistencyCount,
              sourceCount: validatedSources.length,
              sources: validatedSources
                .filter((_, idx) => analysis.sourceIndices.includes(idx))
                .map(source => ({ url: source.url, title: source.title }))
            };
          }
        }
        
        console.log(`Final consistency analysis completed for ${Object.keys(extractedProperties).length} properties`);
      }
    } catch (error) {
      console.error("Technical specification extraction with consistency error:", error);
    }
    
    return extractedProperties;
  }

  // Original method for backward compatibility
  async extractTechnicalSpecifications(
    htmlContents: Array<string | {content: string, url: string, title: string}>,
    articleNumber: string,
    productName: string,
    requiredProperties?: { name: string; description?: string; expectedFormat?: string; orderIndex?: number; isRequired?: boolean }[],
    userId?: number | null,
    modelId?: string
  ): Promise<Record<string, PropertyResult>> {
    const model = this.validateModel(modelId);
    console.log(`Extracting technical specifications for ${articleNumber} - ${productName} from ${htmlContents.length} HTML sources using model: ${model}`);
    
    // Log required properties if provided
    if (requiredProperties && requiredProperties.length > 0) {
      console.log(`Must-have properties (${requiredProperties.length}):`, requiredProperties.map(p => p.name).join(', '));
    }
    
    const extractedProperties: Record<string, PropertyResult> = {
      // Always include the Artikelnummer property
      "Artikelnummer": {
        name: "Artikelnummer",
        value: articleNumber,
        confidence: 100,
        isConsistent: true,
        sources: []
      }
    };
    
    // Initialize required properties with "Not found" values to ensure they appear in output
    if (requiredProperties) {
      requiredProperties.forEach(prop => {
        if (prop.name !== "Artikelnummer") { // Don't override Artikelnummer
          extractedProperties[prop.name] = {
            name: prop.name,
            value: "",
            confidence: 0,
            isConsistent: false,
            sources: []
          };
        }
      });
    }
    
    try {
      // Check if we have valid HTML content and API configuration
      if (htmlContents.length === 0 || !this.hasOpenAiKey()) {
        console.log("No content to process or no valid AI service available");
        return extractedProperties;
      }
      
      // Prepare HTML content for AI processing with smart truncation to avoid token limits
      let MAX_ESTIMATED_TOKENS = 0;
      const CHARS_PER_TOKEN = 4;
      
      // Set token limits based on content type
      const firstContentItem = typeof htmlContents[0] === 'string' ? htmlContents[0] : htmlContents[0]?.content || '';
      const isPdfProcessing = htmlContents.length === 1 &&
                             firstContentItem.includes('=== DOCUMENT ') &&
                             firstContentItem.includes('.pdf');
      
      // For OpenAI models including GPT-4.1 with 1M input tokens
      if (isPdfProcessing) {
        MAX_ESTIMATED_TOKENS = 1000000; // Use full 1M tokens for PDFs with GPT-4.1
      } else {
        MAX_ESTIMATED_TOKENS = 125000; // Standard limit for HTML processing
      }
      
      const MAX_CHARS = MAX_ESTIMATED_TOKENS * CHARS_PER_TOKEN;
      
      // Parse HTML content to clean text for better AI processing
      console.log(`\n🔄 Processing ${htmlContents.length} sources for AI analysis...`);
      console.log(`Sources received:`, htmlContents.map((item, idx) => ({
        index: idx,
        type: typeof item,
        hasContent: !!(item && (typeof item === 'string' || (item as any).content)),
        url: typeof item === 'object' ? (item as any).url : 'N/A',
        contentLength: typeof item === 'string' ? item.length : ((item as any).content?.length || 0)
      })));
      
      // Convert raw HTML to clean text for each source with performance optimization
      const cleanedSources = htmlContents.map((item, index) => {
        // Handle both string and object formats
        const html = typeof item === 'string' ? item : (item as any).content;
        const url = typeof item === 'string' ? 'Unknown URL' : (item as any).url;
        const title = typeof item === 'string' ? 'Unknown Title' : (item as any).title;
        
        console.log(`\n  Processing source ${index + 1}: URL=${url}, Title=${title}, HTML length=${html ? html.length : 0}`);
        
        if (!html || typeof html !== 'string') {
          console.log(`  ⚠️ Skipping source ${index + 1}: No valid HTML content`);
          return null;
        }
        try {
          // Check if this is PDF content (contains PDF document separators)
          const isPdfContent = html.includes('=== DOCUMENT ') && html.includes('.pdf') || 
                              html.includes('[TABLE/STRUCTURED DATA DETECTED]') ||
                              html.includes('[END TABLE/STRUCTURED DATA]');
          
          let cleanText = html;
          
          if (isPdfContent) {
            // For PDF content, preserve structure and don't apply HTML cleaning
            console.log(`Source ${index + 1}: Detected PDF content, preserving structure`);
            // Only clean up excessive whitespace but preserve document separators and structure
            cleanText = cleanText.replace(/[ \t]+/g, ' ').trim();
            // Don't remove the document separators or structural markers
          } else {
            // Fast HTML to text conversion for actual HTML sources
            // Remove script and style content
            cleanText = cleanText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
            // Remove HTML tags but keep the text content
            cleanText = cleanText.replace(/<[^>]*>/g, ' ');
            // Clean up whitespace more efficiently
            cleanText = cleanText.replace(/\s+/g, ' ').trim();
          }
          
          // Handle truncation differently for PDF vs HTML content
          if (isPdfContent) {
            // For PDF content with GPT-4.1-nano (1M tokens), allow very large sizes
            if (cleanText.length > 4000000) { // ~4MB limit for PDFs (conservative estimate for 1M tokens)
              cleanText = cleanText.substring(0, 4000000) + '\n[CONTENT TRUNCATED - PDF EXCEEDS TOKEN LIMIT]';
            }
          } else {
            // For HTML content, keep the smaller limit for performance
            if (cleanText.length > 100000) {
              cleanText = cleanText.substring(0, 100000) + '\n[CONTENT TRUNCATED FOR PERFORMANCE]';
            }
          }
          
          console.log(`Source ${index + 1}: Converted ${html.length} chars to ${cleanText.length} chars (PDF: ${isPdfContent})`);
          return { content: cleanText, url, title };
        } catch (error) {
          console.error(`Error parsing HTML source ${index + 1}:`, error);
          const fallbackContent = typeof html === 'string' ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
          return fallbackContent ? { content: fallbackContent, url, title } : null;
        }
      });
      
      // Filter out empty or too short content
      const validSources = cleanedSources.filter(item => 
        item && item.content && item.content.length > 100
      );
      
      console.log(`\n📊 Cleaned sources summary:`);
      console.log(`  Total sources: ${cleanedSources.length}`);
      console.log(`  Valid sources (>100 chars): ${validSources.length}`);
      console.log(`  Filtered out: ${cleanedSources.length - validSources.length} sources`);
      
      // Performance optimization: Extract only relevant sections from each source
      let processedContents = [];
      let totalChars = 0;
      
      // Check if we're dealing with PDF content that contains multiple documents
      const firstValidSource = validSources[0];
      const isMultiPdfContent =
        validSources.length === 1 &&
        !!firstValidSource &&
        firstValidSource.content.includes('=== DOCUMENT ') &&
        firstValidSource.content.includes('.pdf');
      
      if (isMultiPdfContent) {
        // For combined PDF content, preserve the entire structure to maintain all document information
        console.log("Processing combined PDF content - preserving full structure for AI analysis");
        const source = firstValidSource!.content;
        
        // Count and log document separators for debugging
        const documentMatches = source.match(/=== DOCUMENT \d+: [^=]+ ===/g) || [];
        console.log(`Multi-PDF Analysis: Found ${documentMatches.length} document separators`);
        documentMatches.forEach((match, index) => {
          console.log(`  Document ${index + 1}: ${match}`);
        });
        
        // For PDF content with GPT-4.1-nano, use the full available token space
        const maxPdfChars = MAX_CHARS * 0.95; // Use 95% of available token space for PDFs
        let pdfContent = source;
        
        console.log(`PDF Processing: Content length ${pdfContent.length} chars, Max allowed: ${maxPdfChars} chars`);
        
        if (pdfContent.length > maxPdfChars) {
          console.log("PDF content exceeds token limit, applying intelligent truncation...");
          
          // If content is too large, try to preserve document separators while truncating
          const separatorPattern = /=== DOCUMENT \d+: [^=]+ ===/g;
          const separatorMatches: { index: number; match: string }[] = [];
          let match;
          
          while ((match = separatorPattern.exec(pdfContent)) !== null) {
            separatorMatches.push({ index: match.index, match: match[0] });
          }
          
          console.log(`Found ${separatorMatches.length} document separators in combined PDF`);
          
          if (separatorMatches.length > 1) {
            // Try to include as many complete documents as possible
            let truncatedContent = '';
            let charCount = 0;
            
            for (let i = 0; i < separatorMatches.length; i++) {
              const startIndex = separatorMatches[i].index;
              const nextIndex = i + 1 < separatorMatches.length ? separatorMatches[i + 1].index : pdfContent.length;
              const documentSection = pdfContent.substring(startIndex, nextIndex);
              
              if (charCount + documentSection.length <= maxPdfChars) {
                truncatedContent += documentSection;
                charCount += documentSection.length;
                console.log(`Included document ${i + 1}, total chars: ${charCount}`);
              } else {
                console.log(`Document ${i + 1} would exceed limit, stopping inclusion`);
                truncatedContent += '\n\n[ADDITIONAL DOCUMENTS TRUNCATED - EXCEEDED TOKEN LIMIT]';
                break;
              }
            }
            pdfContent = truncatedContent;
          } else {
            console.log("Single document too large, truncating to fit token limit");
            pdfContent = pdfContent.substring(0, maxPdfChars) + '\n[CONTENT TRUNCATED - EXCEEDED TOKEN LIMIT]';
          }
        } else {
          console.log("PDF content fits within token limits, preserving full content");
        }
        
        processedContents.push(pdfContent);
        totalChars = pdfContent.length;
        console.log(`Final PDF content for AI processing: ${totalChars} characters`);
      } else {
        // For HTML sources, use all available sources for comprehensive analysis
        const maxSources = validSources.length;
        
        for (let i = 0; i < maxSources; i++) {
          const source = validSources[i];
          if (!source) continue;
          
          // Use full content from each source without aggressive filtering
          const contentStr = source.content;
          const sourceUrl = source.url;
          const sourceTitle = source.title;
          
          // Skip empty or very short content
          if (!contentStr || contentStr.length < 100) continue;
          
          // Use larger content chunks to capture all data from each source
          const maxSourceChars = 150000; // Capture full page content
          
          // Format content with clear source separator
          const sourceContent = `
=============================================================
SOURCE ${i + 1}:
Title: ${sourceTitle}
URL: ${sourceUrl}
=============================================================

${contentStr.substring(0, maxSourceChars)}

============= END OF SOURCE ${i + 1} =============
`;
          
          processedContents.push(sourceContent);
          totalChars += sourceContent.length;
          console.log(`Added SOURCE ${i + 1}: ${sourceContent.length} characters from ${sourceUrl}`);
          
          // Break only if we exceed the model's token limit (1M tokens ≈ 4M chars)
          if (totalChars > 3500000) break; // Use most of GPT-4.1's 1M token capacity
        }
      }
      
      // Join the sources with clear separators
      const consolidatedContent = processedContents.join("\n\n");
      
      console.log(`\n🤖 AI Content Summary:`);
      console.log(`  Total consolidated content: ${consolidatedContent.length} characters`);
      console.log(`  Number of sources: ${processedContents.length}`);
      if (!isMultiPdfContent) {
        // For HTML sources, log URL details
        console.log(
          `  Sources included:`,
          validSources
            .slice(0, processedContents.length)
            .filter((item) => !!item)
            .map((item, idx) => ({
              source: idx + 1,
              url: item!.url,
              contentLength: item!.content.length,
            }))
        );
      }
      console.log(`  Using GPT-4.1 with ${MAX_ESTIMATED_TOKENS} token limit`);
      console.log(`  Estimated tokens: ${Math.floor(consolidatedContent.length / CHARS_PER_TOKEN)}`);
      
      // Detect if this is PDF content (improved detection for combined PDFs)
      const firstContentForPdf = typeof htmlContents[0] === 'string' ? htmlContents[0] : htmlContents[0]?.content || '';
      const isPdfContent = htmlContents.length === 1 && 
                               firstContentForPdf.length > 1000 && 
                               (firstContentForPdf.includes('=== DOCUMENT ') && firstContentForPdf.includes('.pdf') ||
                                firstContentForPdf.includes('[TABLE/STRUCTURED DATA DETECTED]') ||
                                firstContentForPdf.includes('[END TABLE/STRUCTURED DATA]') ||
                                (!firstContentForPdf.includes('<html') && 
                                 !firstContentForPdf.includes('<body') &&
                                 !firstContentForPdf.includes('<div')));

      // Process with OpenAI
      if (this.openai) {
        console.log(`Processing with OpenAI GPT-4.1... (${isPdfContent ? 'PDF' : 'HTML'} content detected)`);
        console.log(`Token capacity: 1M input tokens, Content length: ${consolidatedContent.length} chars`);
        
        // Build detailed property descriptions for better AI understanding
        const propertyDescriptionsText = requiredProperties && requiredProperties.length > 0 ? 
          requiredProperties.map(prop => {
            let desc = `   - "${prop.name}"`;
            if (prop.description) {
              desc += `: ${prop.description}`;
            }
            if (prop.expectedFormat) {
              desc += ` (Expected format: ${prop.expectedFormat})`;
            }
            
            // Special handling for Bauart synonym mapping
            if (prop.name.includes('Bauart') || prop.name.includes('Mehrfachbelegung') || prop.name.includes('Selbstschließende')) {
              desc += `\n     CRITICAL SYNONYM MAPPING: 
     - If you find "Mehrfachbelegung: ja" → extract "1"
     - If you find "Selbstschließende Tür: ja" → extract "1"  
     - If you find "Bauart: 1" → extract "1"
     - If you find "Mehrfachbelegung: nein" → extract "2"
     - If you find "Selbstschließende Tür: nein" → extract "2"
     - If you find "Bauart: 2" → extract "2"`;
            }
            
            return desc;
          }).join('\n') : '   - No specific properties defined';
        
        const systemPrompt = isPdfContent ? 
          `You are an expert PDF data extraction specialist with advanced capabilities in parsing structured documents, tables, and technical specifications. Your primary mission is to extract ALL available technical properties from PDF documents with perfect accuracy.

EXTRACTION TARGET PROPERTIES (${requiredProperties?.length || 0} TOTAL):
${propertyDescriptionsText}

CRITICAL MANDATE: You MUST attempt to extract ALL ${requiredProperties?.length || 0} properties listed above. Process each property systematically and exhaustively.

ADVANCED PDF PARSING PROTOCOL:

1. STRUCTURAL DOCUMENT ANALYSIS:
   - Scan for document markers: [ENHANCED_PDF_PROCESSING], [STRUCTURED_DATA_START], [STRUCTURED_DATA_END]
   - Identify sections marked with [SECTION: title] for organized content areas
   - Process both structured table data AND contextual text comprehensively
   - Parse table formats: pipe-separated (|), colon-separated (:), tab-separated, multi-column alignment
   - Look for: "Property | Value | Unit" OR "Property: Value Unit" OR "Property Value Unit"

2. ENHANCED TABLE INTELLIGENCE:
   - [STRUCTURED_DATA_START] to [STRUCTURED_DATA_END] contains carefully preserved table structures
   - Multi-column tables with proper alignment and spacing preserved
   - Property-value pairs with intelligent column detection
   - Header recognition for technical specifications sections
   - Cross-reference tabular data with surrounding context

3. COMPREHENSIVE PROPERTY EXTRACTION STRATEGY:
   For EACH of the ${requiredProperties?.length || 0} properties, perform this systematic search:
   
   Step A: TABLE SCANNING
   - Search within [STRUCTURED_DATA_START] sections for exact matches
   - Check pipe-separated table rows for property names and values
   - Look for aligned column structures with measurements
   
   Step B: CONTEXTUAL SEARCHING
   - Search entire document for property names in multiple languages
   - Check bullet points, specification lists, and technical data sections
   - Look for inline mentions within product descriptions
   
   Step C: PATTERN MATCHING
   - Use property descriptions to understand exactly what to look for
   - Match units and formats specified in expectedFormat
   - Apply multilingual synonyms based on property context
   
   Step D: VALIDATION
   - Verify extracted values against property descriptions
   - Check units match expected formats
   - Validate ranges for technical plausibility

4. COMPREHENSIVE MULTILINGUAL TECHNICAL SPECIFICATION PROCESSING:
   - The document may contain content in ANY language (German, English, Italian, French, Spanish, Dutch, etc.)
   - Extract values from ALL available languages - never skip content because it's in a different language
   - Use ALL available contextual information to understand technical specifications
   - Language-specific technical terms to search for:
     * German: Gewicht, Breite, Höhe, Tiefe, Leistung, Wirkungsgrad, Bauart, Brennstoff, Verbrauch
     * English: Weight, Width, Height, Depth, Power, Efficiency, Construction, Fuel, Consumption
     * Italian: Peso, Larghezza, Altezza, Profondità, Potenza, Efficienza, Tipo, Combustibile, Consumo
     * French: Poids, Largeur, Hauteur, Profondeur, Puissance, Efficacité, Type, Combustible, Consommation
     * Spanish: Peso, Ancho, Altura, Profundidad, Potencia, Eficiencia, Tipo, Combustible, Consumo
     * Dutch: Gewicht, Breedte, Hoogte, Diepte, Vermogen, Efficiëntie, Type, Brandstof, Verbruik
   - Check ALL language variants for each property systematically
   - Use multilingual context clues to understand technical specifications
   - Cross-reference values found in different languages for validation

5. ADVANCED MULTILINGUAL SYNONYM MAPPING AND CONTEXT UNDERSTANDING:
   - Use property descriptions to understand exact meaning and context across all languages
   - For Bauart/Construction Type: CRITICAL MULTILINGUAL MAPPING:
     * German: "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
     * German: "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
     * Any language: "Bauart: 1" / "Type: 1" / "Tipo: 1" → extract "1"
     * Any language: "Bauart: 2" / "Type: 2" / "Tipo: 2" → extract "2"
   - For measurements: Parse dimensions from multilingual formats:
     * German: "580 x 520 x 1050 mm" / "Maße: 580x520x1050"
     * English: "Dimensions: 580 x 520 x 1050 mm" / "Size: 580×520×1050"
     * Italian: "Dimensioni: 580 x 520 x 1050 mm" / "Misure: 580×520×1050"
     * French: "Dimensions: 580 x 520 x 1050 mm" / "Taille: 580×520×1050"
   - For ranges: Extract appropriate value from multilingual ranges:
     * German: "2,5 - 7,0 kW" / "Leistung: 2,5-7,0 kW"
     * English: "2.5 - 7.0 kW" / "Power: 2.5-7.0 kW"
     * Italian: "2,5 - 7,0 kW" / "Potenza: 2,5-7,0 kW"
   - Process ALL numerical values regardless of decimal separator (. or ,)
   - Extract technical specifications from any language context

6. EXHAUSTIVE MULTILINGUAL SEARCH METHODOLOGY:
   - NEVER skip a property - attempt extraction for every single one in ALL languages
   - Search document from top to bottom for each property individually using ALL language variants
   - Check alternative spellings, abbreviations, and technical notations in multiple languages
   - Look for properties mentioned in headers, footers, margins, and technical datasheets
   - Parse multi-page documents comprehensively regardless of language mix
   - Use contextual clues from surrounding text to understand technical specifications
   - Cross-reference values found in different languages for consistency
   - Process manufacturer specifications, product datasheets, and technical documentation in any language
   - Extract values from tables, lists, specifications, and descriptive text equally

7. QUALITY ASSURANCE AND GERMAN OUTPUT TRANSLATION:
   - Extract only authentic values found in the document
   - Cross-reference extracted values with property descriptions
   - Validate units and formats against expectedFormat specifications
   - Ensure extracted values fall within realistic ranges for technical products
   - CRITICAL TRANSLATION REQUIREMENT: ALL OUTPUT MUST BE IN GERMAN
     * Extract values from content in ANY language (English, Italian, French, Spanish, Dutch, etc.)
     * Translate extracted values to German when appropriate
     * Technical terms should be in German: "Pellet" not "Pellets", "Schwarz" not "Black", "Automatisch" not "Automatic"
     * Keep numerical values and units as-is: "3-9 kW", "550 mm", "94.3%"
     * Material names: "Stahl" not "Steel", "Gusseisen" not "Cast Iron", "Keramik" not "Ceramic"
     * Color names: "Schwarz" not "Black", "Weiß" not "White", "Rot" not "Red"
   - CRITICAL: If a value is not found after exhaustive search, use EXACTLY "" (empty string)
   - NEVER return explanatory text like "Nicht explizit angegeben", "Not specified", "No value found" etc.
   - ONLY return the actual value (in German) or empty string "" - nothing else

MULTILINGUAL PROCESSING WORKFLOW:
1. Parse document structure and identify all data sections regardless of language
2. For each of the ${requiredProperties?.length || 0} properties:
   a. Search structured data sections first in ALL languages
   b. Search contextual text thoroughly using multilingual synonyms
   c. Apply comprehensive multilingual pattern matching
   d. Use ALL available contextual data to understand technical specifications
   e. Cross-reference values found in different languages
   f. Validate against property description and expected format
   g. Extract the most accurate value found from any language source
3. Ensure ALL properties are processed using comprehensive language coverage
4. Use ALL available data - never ignore content because it's in a different language

CRITICAL SUCCESS CRITERIA FOR MULTILINGUAL EXTRACTION WITH GERMAN OUTPUT:
- Extract maximum number of properties possible from ALL available content regardless of language
- Use property descriptions to understand exact requirements across language barriers
- Apply exhaustive multilingual search methodology to find ALL available data
- Process content in German, English, Italian, French, Spanish, Dutch, and any other languages present
- Use ALL contextual information and cross-language validation
- Provide authentic values only - never fabricate or estimate
- Process the complete document systematically using comprehensive language coverage
- Never skip content or values because they are in a different language
- CRITICAL: ALL OUTPUT VALUES MUST BE IN GERMAN
  * Extract from any language but translate technical terms to German
  * "Black" → "Schwarz", "Steel" → "Stahl", "Automatic" → "Automatisch"
  * Keep numerical values and units: "3-9 kW", "550 mm", "94.3%"
  * Ensure consistent German terminology in all extracted values

Your goal is to extract as many of the ${requiredProperties?.length || 0} properties as possible with perfect accuracy!`
          : 
          `You are a precise web data extraction expert analyzing MULTIPLE WEB PAGES. You extract ONLY technical values that actually exist in the provided content from ALL sources. You NEVER fabricate data.

IMPORTANT: You are receiving content from MULTIPLE web pages (marked as SOURCE 1, SOURCE 2, etc.). You MUST:
- Search through ALL provided sources comprehensively
- Cross-reference information between different sources
- Use data from ANY source that contains the needed property
- Combine information from multiple sources when appropriate
- Prioritize manufacturer websites and official product pages

PROPERTIES TO EXTRACT (with detailed descriptions):
${propertyDescriptionsText}

CORE RULES FOR AUTHENTIC EXTRACTION FROM MULTIPLE SOURCES:

1. STRICT DATA VALIDATION:
   - Extract ONLY values explicitly found in the provided content
   - If a value doesn't exist, respond with empty string ""
   - NEVER invent data or use estimates
   - All values must originate directly from the provided content
   - Use the property descriptions above to understand what each property means

2. ENHANCED SEARCH STRATEGY WITH PROPERTY CONTEXT:
   - Search systematically in product specifications
   - Check tables, lists and technical data sections
   - Use synonyms and variations for better coverage
   - Prioritize structured data over descriptive text
   - Use property descriptions to understand the exact meaning of each property
   - For ambiguous cases, prefer the interpretation that matches the property description

3. INTELLIGENT PROPERTY MATCHING:
   - Use property descriptions to disambiguate between similar values
   - For Bauart: CRITICAL SYNONYM MAPPING:
     * "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
     * "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
     * "Bauart: 1" → extract "1"
     * "Bauart: 2" → extract "2"
   - For measurements: Ensure correct unit interpretation based on expected format
   - If multiple values could match a property, choose the one that best fits the description
   - Consider the expected format when validating extracted values

4. COMPREHENSIVE MULTILINGUAL PROPERTY RECOGNITION WITH GERMAN OUTPUT:
   - Extract values from ALL available languages - never skip content because it's in a different language
   - Use ALL available contextual information regardless of language
   - Process content in German, English, Italian, French, Spanish, Dutch, and any other languages present
   - Language-specific technical terms to search for:
     * German: Gewicht, Breite, Höhe, Tiefe, Leistung, Wirkungsgrad, Bauart, Brennstoff, Verbrauch, Spannung, Temperatur
     * English: Weight, Width, Height, Depth, Power, Efficiency, Construction, Fuel, Consumption, Voltage, Temperature
     * Italian: Peso, Larghezza, Altezza, Profondità, Potenza, Efficienza, Tipo, Combustibile, Consumo, Tensione, Temperatura
     * French: Poids, Largeur, Hauteur, Profondeur, Puissance, Efficacité, Type, Combustible, Consommation, Tension, Température
     * Spanish: Peso, Ancho, Altura, Profundidad, Potencia, Eficiencia, Tipo, Combustible, Consumo, Tensión, Temperatura
     * Dutch: Gewicht, Breedte, Hoogte, Diepte, Vermogen, Efficiëntie, Type, Brandstof, Verbruik, Spanning, Temperatuur
   - Cross-reference values found in different languages for validation
   - Process ALL numerical values regardless of decimal separator (. or ,)
   - Use multilingual context clues to understand technical specifications
   - Apply comprehensive search across all language sections of the content
   - CRITICAL TRANSLATION REQUIREMENT: ALL OUTPUT MUST BE IN GERMAN
     * Extract from any language but output in German
     * "Black/Nero/Noir" → "Schwarz", "Steel/Acciaio/Acier" → "Stahl"
     * "Automatic/Automatico/Automatique" → "Automatisch"
     * "Pellets/Granulés" → "Pellet"
     * Maintain numerical values and units: "3-9 kW", "550 mm", "94.3%"

CRITICAL: Use property descriptions to understand what you're looking for. Only extract authentic data - leave empty if uncertain!

MANDATORY GERMAN OUTPUT REQUIREMENT:
- Extract values from content in ANY language (English, Italian, French, Spanish, Dutch, etc.)
- ALL extracted values must be OUTPUT IN GERMAN
- Translate technical terms: "Black" → "Schwarz", "Steel" → "Stahl", "Automatic" → "Automatisch"
- Keep numerical values and units as-is: "3-9 kW", "550 mm", "94.3%"
- Ensure consistent German terminology in all output values`;
        
        const response = await this.openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user", 
              content: (isPdfContent ? 
                `MISSION: Extract ALL possible technical specifications for "${productName}" (Article: ${articleNumber}) from the provided PDF document.

TARGET PROPERTIES (${requiredProperties?.length || 0} TOTAL - EXTRACT ALL POSSIBLE):
${requiredProperties?.map((p, index) => {
  let line = `${index + 1}. "${p.name}"`;
  if (p.description) line += ` - ${p.description}`;
  if (p.expectedFormat) line += ` [Expected: ${p.expectedFormat}]`;
  return line;
}).join('\n') || 'Standard properties'}

CRITICAL EXTRACTION PROTOCOL - AGGRESSIVE DATA MINING:
1. EXHAUSTIVE SEARCH: Process EVERY property with EXTREME thoroughness - leave NO data unextracted
2. MULTI-PASS SCANNING: Make at least 5 passes through the ENTIRE document for each property
3. PATTERN VARIATIONS: Search for properties in ALL possible forms:
   - Direct mentions: "Breite: 465 mm", "Width: 465 mm", "B: 465"
   - Contextual mentions: "mit einer Breite von 465 mm", "465 mm breit", "465mm wide"
   - Table cells: Look in EVERY table cell, even if headers don't match exactly
   - Descriptions: "kompaktes Design mit 46,5cm Durchmesser" → Breite: 465
   - Specifications lists: Even partial matches count
   - Technical drawings mentions: "siehe Zeichnung: 465x1090x465"
   - Footnotes and side notes: Check ALL supplementary text
4. AGGRESSIVE SYNONYM EXPANSION: Use ALL possible synonyms and variations
5. INFER FROM CONTEXT: If exact value not found, intelligently infer from related data
6. CROSS-REFERENCE: Check multiple sections - values may appear anywhere in document

FORBIDDEN PHRASES - NEVER USE THESE:
- "nicht explizit angegeben"
- "nicht angegeben"
- "not specified"
- "nicht verfügbar"
- "keine Angabe"
- "n/a"
- "nicht vorhanden"
- "nicht erwähnt"
- "nicht gefunden"
- ANY explanatory text for missing values

ONLY TWO OUTCOMES ALLOWED:
- Found value: Extract the actual value from content
- Not found: Return EXACTLY "" (empty string)

ENHANCED SEARCH PATTERNS WITH CONTEXTUAL SYNONYMS:
- Tables: "Property | Value | Unit" OR "Property: Value Unit" OR "Property Value Unit" 
- Lists: "• Property: Value" OR "- Property Value" OR "Property ..... Value"
- Inline: "The property is value" OR "Property = value" OR "Property (value)"
- Ranges: "Property: min - max unit" → extract full range or appropriate value
- Dimensions: "Length x Width x Height" → extract individual measurements
- For "Abmessungen (BxHxT)", split values: "550x1200x573 mm" → Breite: 550, Höhe: 1200, Tiefe: 573
- For combined entries like "Stündlicher Verbrauch 0.7 - 2 kg/h" → extract "0.7 - 2" for Brennstoffverbrauch
- CRITICAL: Check BOTH PDF content AND [WEB CONTENT FROM ...] sections for comprehensive data

CONTEXTUAL PROPERTY MATCHING WITH EXTENDED SYNONYMS:
- Breite: Width, Larghezza, Largeur, Ancho, Breedte, B (in BxHxT), erste Dimension, Durchmesser (for round items), Diameter
- Höhe: Height, Altezza, Hauteur, Alto, Hoogte, H (in BxHxT), zweite Dimension, Korpushöhe, Gesamthöhe
- Tiefe: Depth, Profondità, Profondeur, Fondo, Diepte, T/D (in BxHxT), dritte Dimension, Einbautiefe
- Gewicht: Weight, Peso, Poids, Massa, Nettogewicht, Gesamtgewicht, Mass, Total weight, Net weight
- Nennwärmeleistung: Nominal heat output, Power, Potenza, Puissance, Potencia, Vermogen, Leistung, Heizleistung, kW, Heat output, Thermal power
- Wirkungsgrad: Efficiency, Rendimento, Rendement, Eficiencia, Rendement, Ertrag, Performance, Efficienza, %
- Volumen Pelletbehälter: Tank capacity, Capacità serbatoio, Capacité réservoir, Fassungsvermögen, Gesamttankinhalt, Pellet tank, Bunkerinhalt
- Brennstoffverbrauch: Fuel consumption, Consumo, Consommation, Verbruik, Stündlicher Verbrauch, Hourly consumption, kg/h, Verbrauch pro Stunde
- Aschekasten: Ash drawer, Cassetto cenere, Cendrier, Cenicero, Aslade, Aschensammelfach, Aschenschublade, Ash pan
- Material Korpus: Body material, Materiale corpo, Matériau corps, Gehäusematerial, Housing material, Casing material
- Rauchrohranschluss: Flue pipe connection, Raccordo canna fumaria, Raccord fumée, Smoke outlet, Flue diameter, Abgasrohr
- Energieeffizienzklasse: Energy efficiency class, Classe efficienza, Classe énergétique, Energy rating, EEI
- Heizfläche: Heating area, Superficie riscaldabile, Surface chauffée, Heating surface, m², Raumgröße

INTELLIGENT UNIT CONVERSION RULES:
- Length conversions:
  * cm → mm: multiply by 10 (e.g., "55 cm" → "550 mm")
  * m → mm: multiply by 1000 (e.g., "1.2 m" → "1200 mm")
  * inches → mm: multiply by 25.4 (e.g., "20 inches" → "508 mm")
  * feet → mm: multiply by 304.8
- Weight conversions:
  * pounds/lbs → kg: divide by 2.205 (e.g., "100 lbs" → "45.4 kg")
  * tons → kg: multiply by 1000
- Power conversions:
  * BTU/h → kW: multiply by 0.000293071
  * kcal/h → kW: multiply by 0.001163
  * HP → kW: multiply by 0.7457
- Volume conversions:
  * liters → kg (for pellets): approximately 1:0.65 ratio
  * m³/h → l/s: divide by 3.6
- Temperature: Keep as found but note context

CONTEXTUAL EXTRACTION FROM SENTENCES - EXTREME PATTERN MATCHING:
- "Der Ofen hat eine Breite von 55cm" → Breite: "550" (converted to mm)
- "suitable for rooms up to 120m²" → Max. Raumheizvermögen: "120"
- "kompaktes Design mit nur 46,5cm Durchmesser" → Breite: "465" (round items)
- "Leistungsbereich zwischen 3 und 9 kW" → Nennwärmeleistung: "3-9"
- "consumes 0.7 to 2 kg per hour" → Brennstoffverbrauch: "0.7-2"
- "Abmessungen (BxHxT): 465 x 1090 x 465" → Extract ALL three dimensions
- "Rauchrohranschluss Ø 150" → Ø Rauchrohranschluss: "150"
- "empfohlen für Räume 30-120m²" → Heizfläche: "30-120"
- "Gewicht: ca. 142 kg" → Gewicht: "142"
- "efficiency up to 81%" → Wirkungsgrad: "81"
- Any measurement with "ca.", "etwa", "ungefähr", "approx" → Extract the number
- "Norm: EN 13240:2001/A2:2004" → Normen: "EN 13240"
- Look for values in parentheses, brackets, after colons, equals signs
- Extract from image captions, footnotes, headers, side margins

CRITICAL BAUART MAPPING:
- "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
- "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
- "Bauart: 1" → extract "1", "Bauart: 2" → extract "2"

MANDATORY JSON OUTPUT RULES:
- Include ALL ${requiredProperties?.length || 0} properties
- For each property: Use actual extracted value OR "" (empty string)
- FORBIDDEN: Any explanatory text for missing values
- REQUIRED: Empty values must be EXACTLY "" (empty string)
- VIOLATION EXAMPLES TO AVOID:
  * "nicht explizit angegeben" → Use "" instead
  * "nicht angegeben" → Use "" instead
  * "not specified" → Use "" instead
  * "n/a" → Use "" instead
  * "keine Angabe" → Use "" instead
  * "nicht vorhanden" → Use "" instead
- ONLY valid outputs per property: actual value or ""

JSON OUTPUT FORMAT:
{${requiredProperties?.map(p => `"${p.name}": "value_or_empty_string"`).join(',\n  ') || ''}}

HYPER-AGGRESSIVE CONTEXTUAL EXTRACTION METHODOLOGY - LEAVE NO DATA BEHIND:

1. EXTREME MULTI-SOURCE PROCESSING:
   - Scan EVERY single line in BOTH PDF content AND [WEB CONTENT FROM ...] sections
   - Check [PDF 1], [PDF 2], [PDF CONTENT SEPARATOR] sections individually
   - Extract from document headers, footers, page numbers, margins
   - Parse ALL metadata, comments, annotations if present
   - Web content often has values PDF misses - CHECK EVERYTHING

2. ULTRA-DEEP PATTERN RECOGNITION:
   - NUMBERS NEAR KEYWORDS: If you see "Breite" anywhere, grab ANY number within 50 words
   - DIMENSION PATTERNS: "465x1090x465", "465 x 1090 x 465", "465/1090/465" → Parse ALL
   - RANGE PATTERNS: "3-9", "3 bis 9", "von 3 bis 9", "3...9", "3~9" → Extract ranges
   - APPROXIMATIONS: "ca.", "etwa", "ungefähr", "~", "≈", "approx." → Extract the value
   - UNITS ANYWHERE: "465 (mm)", "465mm", "46,5cm", "0.465m" → Convert ALL to required unit
   - CERTIFICATION CODES: "EN 13240:2001/A2:2004/AC:2007" → Extract base "EN 13240"
   - MARKETING SPEAK: "für kleine Räume" → might indicate compact dimensions

3. AGGRESSIVE INFERENCE ENGINE:
   - NO EMPTY FIELDS: If direct value not found, use intelligent inference:
     * "Pelletofen" in name → Brennstoff: "Pellet"
     * "Stahl" in product name → Material Korpus likely "Stahl"
     * Round shape mentioned → Form: "Rund"
     * Efficiency class A+ → might indicate 90%+ efficiency
   - CROSS-PROPERTY INFERENCE: Use found values to infer missing ones
   - STANDARD ASSUMPTIONS: Industry standards can fill gaps

4. EXHAUSTIVE 10-PASS SEARCH STRATEGY:
   Pass 1: Extract from ALL tables, regardless of headers
   Pass 2: Extract from ALL lists and bullet points
   Pass 3: Extract from ALL sentences containing numbers
   Pass 4: Extract from ALL product descriptions and marketing text
   Pass 5: Check ALL footnotes, side notes, image captions
   Pass 6: Parse ALL technical drawings references
   Pass 7: Extract from certification and norm references
   Pass 8: Apply ALL unit conversions aggressively
   Pass 9: Cross-reference between ALL PDF and web sections
   Pass 10: Final inference pass - fill remaining gaps intelligently

5. EXTREME VALUE EXTRACTION RULES:
   - See "Ø150" ANYWHERE? → Multiple properties might use this
   - See "465 mm" ANYWHERE? → Could be Breite OR Tiefe for square items
   - See "EN 13240" ANYWHERE? → That's your Normen value
   - See ANY efficiency percentage? → That's Wirkungsgrad
   - See ANY weight mention? → Extract it for Gewicht
   - See ANY power/kW mention? → Check if it fits Nennwärmeleistung

REMEMBER: The GPT-4.1 model has 1 MILLION token capacity - USE IT ALL!
Scan the ENTIRE document multiple times. Extract EVERYTHING possible.
Your mission: ZERO empty fields in the output!

COMBINED DOCUMENT CONTENT (PDF + WEB):
${consolidatedContent}

FINAL EXTREME EXTRACTION INSTRUCTIONS:
- This is GPT-4.1 with 1 MILLION token capacity - analyze EVERY character
- Make 10+ passes through the ENTIRE document for EACH property
- Empty values are FAILURES - use inference if needed
- Check these sections specifically:
  * [PDF 1: ...] - First PDF often has basic specs
  * [PDF 2: ...] - Second PDF often has detailed technical data
  * [WEB CONTENT FROM ...] - Web often has missing specifications
  * Between [PDF CONTENT SEPARATOR] markers
- Common data locations you MUST check:
  * Technical specification tables (even poorly formatted ones)
  * Product description paragraphs
  * Certification sections
  * Installation instructions (often contain dimensions)
  * Safety distance requirements
  * Performance data sections
  * Marketing descriptions
  * Image captions and footnotes

EXECUTE HYPER-AGGRESSIVE EXTRACTION NOW!
GOAL: MAXIMUM DATA EXTRACTION - ZERO EMPTY FIELDS!` :
                `Extract specs for ${productName} (${articleNumber}) from ALL ${validSources.length} web sources provided:

CRITICAL MULTI-SOURCE PROCESSING INSTRUCTIONS:
You are receiving content from ${validSources.length} DIFFERENT WEB PAGES, clearly marked as:
- SOURCE 1: [URL and content]
- SOURCE 2: [URL and content]
- SOURCE 3: [URL and content]
- etc.

MANDATORY REQUIREMENTS:
1. For EACH property, search through ALL ${validSources.length} sources
2. DO NOT stop at the first source - properties may ONLY appear in SOURCE 3, 4, or 5
3. A property is valid if found in ANY source - it doesn't need to be in all sources
4. Track WHICH sources contain each value for consistency reporting
5. If the same value appears in multiple sources, mark it as consistent
6. Some sources may have properties that others don't - this is normal
7. Cross-reference between sources to ensure accuracy

PROPERTIES TO EXTRACT WITH DESCRIPTIONS:
${requiredProperties?.map(p => {
  let line = `"${p.name}"`;
  if (p.description) line += `: ${p.description}`;
  if (p.expectedFormat) line += ` (Format: ${p.expectedFormat})`;
  return line;
}).join('\n') || 'Standard properties'}

MULTI-SOURCE EXTRACTION RULES:
- Use property descriptions to understand what each property means
- For ambiguous cases, prefer values that match the property description
- Use expected format information when validating extracted values
- CRITICAL BAUART SYNONYM MAPPING:
  * "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
  * "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
  * "Bauart: 1" → extract "1"
  * "Bauart: 2" → extract "2"

ENHANCED CONTEXTUAL EXTRACTION:
- Apply comprehensive synonym matching across all languages
- Convert units automatically:
  * cm → mm (multiply by 10)
  * inches → mm (multiply by 25.4)
  * lbs → kg (divide by 2.205)
  * BTU/h → kW (multiply by 0.000293071)
- Extract from contextual sentences:
  * "suitable for rooms up to 120m²" → Max. Raumheizvermögen: "120"
  * "compact design with 46.5cm diameter" → Breite: "465"
- Use extended synonyms for each property (see system prompt)

EXAMPLE OF THE MULTI-SOURCE CONTENT FORMAT YOU WILL RECEIVE:
=============================================================
SOURCE 1:
Title: Product Page - Justus Usedom 5
URL: https://example.com/justus-usedom-5
=============================================================
[Web page content here...]
============= END OF SOURCE 1 =============

=============================================================
SOURCE 2:
Title: Technical Specifications
URL: https://manufacturer.com/specs
=============================================================
[Different web page content here...]
============= END OF SOURCE 2 =============

SOURCE ATTRIBUTION AND CONSISTENCY REQUIREMENTS:
- For EACH property, search ALL ${validSources.length} sources
- Track which source(s) contain each value
- Report source labels as "Source 1", "Source 2", etc.
- Include the actual URLs from each source
- CONSISTENCY TRACKING (CRITICAL):
  * "isConsistent": Set to true ONLY if the EXACT SAME value appears in 2 or more sources
  * "consistencyCount": Count how many sources contain this EXACT value (not similar, but identical)
  * Example 1: If "5 kW" appears in Source 1, 2, and 4, then isConsistent=true, consistencyCount=3
  * Example 2: If "170 kg" appears only in Source 3, then isConsistent=false, consistencyCount=1
  * Example 3: If "30 cm" appears in Source 1 and Source 2, then isConsistent=true, consistencyCount=2
- "sourceCount": always ${validSources.length} (total sources available)
- IMPORTANT: Even if a value is found in only 1 source, still extract it but mark isConsistent=false

JSON OUTPUT FORMAT:
{
  "${requiredProperties?.[0]?.name || 'Property1'}": {
    "value": "extracted_value_or_empty",
    "confidence": 85,
    "isConsistent": true_if_appears_in_2_or_more_sources,
    "consistencyCount": count_sources_with_this_exact_value,
    "sourceCount": ${validSources.length},
    "sources": [
      {"url": "actual_url_1", "title": "Source 1", "sourceLabel": "Source 1"},
      {"url": "actual_url_2", "title": "Source 2", "sourceLabel": "Source 2"}
    ]
  }${requiredProperties && requiredProperties.length > 1 ? ',' : ''}
  ${requiredProperties?.slice(1).map(p => `"${p.name}": {...}`).join(',\n  ') || ''}
}

EXAMPLE OUTPUT (showing proper consistency tracking):
{
  "Breite (in mm)": {
    "value": "578",
    "confidence": 95,
    "isConsistent": true,  // Found in Sources 1, 2, and 4
    "consistencyCount": 3,  // Appears in 3 sources
    "sourceCount": ${validSources.length},
    "sources": [
      {"url": "https://ofen.de/...", "title": "Product Page", "sourceLabel": "Source 1"},
      {"url": "https://kamdi24.de/...", "title": "Shop Page", "sourceLabel": "Source 2"},
      {"url": "https://manufacturer.com/...", "title": "Specs", "sourceLabel": "Source 4"}
    ]
  },
  "Gewicht (in kg)": {
    "value": "170",
    "confidence": 30,
    "isConsistent": false,  // Found in only 1 source
    "consistencyCount": 1,   // Appears in 1 source only
    "sourceCount": ${validSources.length},
    "sources": [
      {"url": "https://shop.nl/...", "title": "Dutch Shop", "sourceLabel": "Source 3"}
    ]
  }
}

IMPORTANT: For each extracted value, specify which source(s) it came from by including the corresponding source objects in the "sources" array.

WEB CONTENT (each source is clearly labeled):
${consolidatedContent}`)
            }
          ],
          temperature: 0.1, // Low temperature for more deterministic results
          response_format: { type: "json_object" }
        });
        
        // Track token usage for OpenAI API call with per-user tracking
        const responseContent = response.choices?.[0]?.message?.content || "{}";
        const startTime = Date.now();
        
        try {
          if (response.usage) {
            const inputTokens = response.usage.prompt_tokens || 0;
            const outputTokens = response.usage.completion_tokens || 0;
            console.log(`Tracking OpenAI usage: ${inputTokens} input + ${outputTokens} output tokens for user ${userId || 'system'}`);
            
            await TokenTracker.trackOpenAIUsage(
              userId || null,
              model,
              inputTokens,
              outputTokens,
              "extract"
            );
            
            // Log AI API call to monitoring system if user is authenticated
            if (userId) {
              try {
                // Get username for logging
                const userPromptContent = isPdfContent
                  ? `Extract from PDF for ${productName} (${articleNumber})`
                  : `Extract specs for ${productName} (${articleNumber}) from ${validSources.length} sources`;
                
                // Use TokenTracker's correct pricing calculation
                const costs = TokenTracker.calculateCost(model, inputTokens, outputTokens);
                
                await MonitoringLogger.logAiApiCall({
                  userId,
                  username: `user_${userId}`, // Will be resolved by monitoring system
                  articleNumber,
                  productName,
                  provider: 'openai',
                  modelName: model,
                  apiCallType: 'extraction',
                  systemPrompt: systemPrompt.substring(0, 3000), // Truncate for storage
                  userPrompt: userPromptContent,
                  rawResponse: responseContent.substring(0, 10000), // Truncate for storage
                  inputTokens,
                  outputTokens,
                  totalTokens: inputTokens + outputTokens,
                  cost: costs.totalCost,
                  inputCost: costs.inputCost,  // Correctly calculated input cost
                  outputCost: costs.outputCost,  // Correctly calculated output cost
                  apiCallId: `extract_${articleNumber}_${Date.now()}`,  // Unique call ID
                  responseTime: Date.now() - startTime,
                  success: true,
                });
                console.log(`[MONITORING] Logged AI API call for extraction: ${productName}`);
              } catch (monitoringError) {
                console.error('[MONITORING] Failed to log AI API call:', monitoringError);
              }
            }
          }
        } catch (tokenError) {
          console.error("Error tracking OpenAI token usage:", tokenError);
        }
        
        // Parse the response
        if (response.choices && response.choices.length > 0) {
          const content = response.choices[0].message.content || "{}";
          console.log("AI extraction result:", content);
          
          try {
            console.log(`\n🔍 DEBUG: Raw AI response content (first 500 chars):`, content.substring(0, 500));
            const extractedSpecs = JSON.parse(content);
            console.log(`✅ Parsed JSON successfully. Extracted ${Object.keys(extractedSpecs).length} technical specifications`);
            console.log(`🔍 Sample of extracted specs:`, Object.entries(extractedSpecs).slice(0, 3));
            
            // Process each required property
            if (requiredProperties && requiredProperties.length > 0) {
              const sortedProperties = requiredProperties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
              
              for (const prop of sortedProperties) {
                const exactPropertyName = prop.name;
                let propertyData = null;
                
                // Look for the exact property name first
                if (extractedSpecs.hasOwnProperty(exactPropertyName)) {
                  propertyData = extractedSpecs[exactPropertyName];
                } else {
                  // Try case-insensitive match
                  const foundKey = Object.keys(extractedSpecs).find(key => 
                    key.toLowerCase().trim() === exactPropertyName.toLowerCase().trim()
                  );
                  if (foundKey) {
                    propertyData = extractedSpecs[foundKey];
                  }
                }
                
                // Handle both old string format and new object format
                if (typeof propertyData === 'string') {
                  // Legacy format - just a string value
                  const cleanedValue = this.cleanupValue(propertyData.trim());
                  extractedProperties[exactPropertyName] = {
                    name: exactPropertyName,
                    value: cleanedValue,
                    confidence: cleanedValue ? 85 : 0,
                    isConsistent: !!cleanedValue,
                    sources: cleanedValue ? (isPdfContent ? [{ url: "PDF Document", title: "Extracted from PDF" }] : []) : []
                  };
                } else if (propertyData && typeof propertyData === 'object') {
                  // New structured format with source attribution
                  const value = this.cleanupValue(propertyData.value || "");
                  const sources = propertyData.sources || [];
                  
                  // Map source indices to actual validated sources
                  const mappedSources = sources.map((source: any) => {
                    if (source.url && source.url !== "actual_url_1" && source.url !== "actual_url_2") {
                      // Already has real URL
                      return {
                        url: source.url,
                        title: source.title || source.sourceLabel || "Unknown Title",
                        sourceLabel: source.sourceLabel || source.title || "Unknown Source"
                      };
                    } else {
                      // Try to map by source label to validated sources
                      const sourceIndex = parseInt(source.sourceLabel?.match(/Source (\d+)/)?.[1]) - 1;
                      if (sourceIndex >= 0 && sourceIndex < validSources.length) {
                        const validatedSource = validSources[sourceIndex];
                        if (validatedSource) {
                          return {
                            url: validatedSource.url || "Unknown URL",
                            title: validatedSource.title || source.sourceLabel || "Unknown Title",
                            sourceLabel: source.sourceLabel || `Source ${sourceIndex + 1}`,
                          };
                        }
                      }
                      return source;
                    }
                  });
                  
                  extractedProperties[exactPropertyName] = {
                    name: exactPropertyName,
                    value: value.trim(),
                    confidence: propertyData.confidence || (value ? 85 : 0),
                    isConsistent: propertyData.isConsistent || false,
                    consistencyCount: propertyData.consistencyCount || (value ? 1 : 0),
                    sourceCount: propertyData.sourceCount || validSources.length,
                    sources: mappedSources
                  };
                } else {
                  // No data found
                  extractedProperties[exactPropertyName] = {
                    name: exactPropertyName,
                    value: "",
                    confidence: 0,
                    isConsistent: false,
                    consistencyCount: 0,
                    sourceCount: validSources.length,
                    sources: []
                  };
                }
              }
              
              console.log(`Final ordered output contains ${Object.keys(extractedProperties).length} properties`);
            }
          } catch (error) {
            console.error("❌ Failed to parse OpenAI extraction result:", error);
            console.log("Raw AI response that failed to parse:", content);
            console.log("Response length:", content.length);
            console.log("First 1000 chars:", content.substring(0, 1000));
            console.log("Last 1000 chars:", content.substring(Math.max(0, content.length - 1000)));
            
            // Try to extract any valid JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const extractedJson = JSON.parse(jsonMatch[0]);
                console.log("🔧 Recovered JSON from response:", Object.keys(extractedJson).length, "properties");
                
                // Process recovered JSON
                if (requiredProperties && requiredProperties.length > 0) {
                  const sortedProperties = requiredProperties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                  
                  for (const prop of sortedProperties) {
                    const exactPropertyName = prop.name;
                    let propertyData = null;
                    
                    // Look for exact match
                    if (extractedJson[exactPropertyName] !== undefined) {
                      propertyData = extractedJson[exactPropertyName];
                    }
                    
                    // Set the property value
                    if (propertyData !== null && propertyData !== undefined) {
                      extractedProperties[exactPropertyName] = {
                        name: exactPropertyName,
                        value: String(propertyData).trim(),
                        confidence: 74,
                        isConsistent: false,
                        sources: []
                      };
                    } else {
                      extractedProperties[exactPropertyName] = {
                        name: exactPropertyName,
                        value: "",
                        confidence: 0,
                        isConsistent: false,
                        sources: []
                      };
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to parse extracted JSON:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Technical specification extraction error:", error);
    }
    
    return extractedProperties;
  }

  // Set API key for OpenAI
  setApiKey(apiKey: string) {
    this.openaiApiKey = apiKey;
    this.openai = new OpenAI({ apiKey });
    console.log("OpenAI API key configured");
  }

  // Set the model provider (kept for compatibility, always uses OpenAI)
  setModelProvider(provider: 'openai') {
    console.log(`Model provider set to: ${provider}`);
  }

  // Check if OpenAI key is available
  hasOpenAiKey(): boolean {
    return !!(this.openaiApiKey || process.env.OPENAI_API_KEY);
  }

  // Dedicated method for URL Manual Input mode - uses user's selected model
  async extractFromUrlManualInput(
    scrapedContent: string,
    articleNumber: string,
    productName: string,
    properties: { name: string; description?: string; expectedFormat?: string; orderIndex?: number }[],
    userId?: number | null,
    sourceUrl?: string,
    modelId?: string
  ): Promise<Record<string, PropertyResult>> {
    const model = this.validateModel(modelId);
    console.log(`[URL-MANUAL] Starting extraction for ${productName} (${articleNumber}) using ${model}`);
    console.log(`[URL-MANUAL] Content length: ${scrapedContent.length} characters`);
    console.log(`[URL-MANUAL] Properties to extract: ${properties.length}`);
    
    const extractedProperties: Record<string, PropertyResult> = {};
    
    // Initialize all properties with empty values to maintain order
    const sortedProperties = properties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    for (const prop of sortedProperties) {
      extractedProperties[prop.name] = {
        name: prop.name,
        value: "",
        confidence: 0,
        isConsistent: false,
        sources: []
      };
    }
    
    // Ensure we have OpenAI configured
    if (!this.openai && !process.env.OPENAI_API_KEY) {
      console.error("[URL-MANUAL] No OpenAI API key available");
      return extractedProperties;
    }
    
    // Set up OpenAI if not already configured
    if (!this.openai && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log("[URL-MANUAL] OpenAI initialized with environment key");
    }
    
    try {
      // Clean and prepare content for extraction
      const cleanedContent = parseHtmlToCleanText(scrapedContent);
      const truncatedContent = cleanedContent.substring(0, 100000); // Limit to avoid token issues
      
      console.log(`[URL-MANUAL] Cleaned content length: ${truncatedContent.length} characters`);
      
      // Create property list for prompt
      const propertyList = sortedProperties.map((prop, index) => 
        `${index + 1}. "${prop.name}"${prop.description ? ` (${prop.description})` : ''}${prop.expectedFormat ? ` - Format: ${prop.expectedFormat}` : ''}`
      ).join('\n');
      
      // Create expected JSON structure
      const expectedStructure = sortedProperties.reduce((acc, prop) => {
        acc[prop.name] = "actual_value_or_empty_string";
        return acc;
      }, {} as Record<string, string>);
      
      const systemPrompt = `You are a precise web data extraction expert for URL Manual Input mode. You extract ONLY technical values that actually exist in the provided HTML content. You NEVER fabricate data.

CORE RULES FOR URL MANUAL INPUT:

1. STRICT DATA VALIDATION:
   - Extract ONLY values explicitly found in the provided content
   - If a value doesn't exist, respond with empty string ""
   - NEVER invent data or use estimates
   - All values must originate directly from the provided content
   - Use property descriptions to understand what each property means

2. PROPERTY ORDER MAINTENANCE:
   - Return properties in the EXACT order specified
   - Include ALL ${properties.length} properties even if some are empty
   - Maintain the property names exactly as provided

3. ENHANCED SEARCH STRATEGY WITH PROPERTY CONTEXT:
   - Look for property values in product specifications
   - Check technical data tables and lists
   - Search product descriptions and feature lists
   - Look for measurements, ratings, and technical details
   - Use German and English property names as synonyms
   - Use property descriptions to understand what to look for
   - For ambiguous cases, prefer values that match the property description

4. INTELLIGENT PROPERTY MATCHING:
   - Use property descriptions to disambiguate between similar values
   - For Bauart: CRITICAL SYNONYM MAPPING:
     * "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
     * "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
     * "Bauart: 1" → extract "1"
     * "Bauart: 2" → extract "2"
   - For measurements: Ensure correct unit interpretation based on expected format
   - If multiple values could match a property, choose the one that best fits the description
   - Consider the expected format when validating extracted values

5. OUTPUT FORMAT:
   - Return valid JSON object only
   - Use exact property names as keys
   - Empty string for missing values
   - Include units when found (e.g., "580 mm", "114 kg", "92%")
   - Format values according to expected format if specified

PROPERTIES TO EXTRACT (in exact order with descriptions):
${propertyList}

EXPECTED JSON STRUCTURE:
${JSON.stringify(expectedStructure, null, 2)}

Extract from the provided content using property descriptions as context and return only the JSON object.`;

      console.log(`[URL-MANUAL] Sending request to ${model} with ${truncatedContent.length} chars`);
      
      const response = await this.openai!.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: `PRODUCT: ${productName} (Article: ${articleNumber})

WEB CONTENT:
${truncatedContent}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      // Track token usage with per-user tracking
      if (response.usage) {
        const inputTokens = response.usage.prompt_tokens || 0;
        const outputTokens = response.usage.completion_tokens || 0;
        console.log(`[URL-MANUAL] Token usage: ${inputTokens} input + ${outputTokens} output tokens for user ${userId || 'system'}`);
        
        try {
          await TokenTracker.trackOpenAIUsage(userId || null, model, inputTokens, outputTokens, "url-manual");
        } catch (tokenError) {
          console.error("[URL-MANUAL] Error tracking token usage:", tokenError);
        }
      }
      
      // Parse response
      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content || "{}";
        console.log(`[URL-MANUAL] AI response received: ${content.length} characters`);
        
        try {
          const extractedData = JSON.parse(content);
          console.log(`[URL-MANUAL] Successfully parsed JSON with ${Object.keys(extractedData).length} properties`);
          
          // Process extracted data and maintain order
          let propertiesFound = 0;
          for (const prop of sortedProperties) {
            if (extractedData.hasOwnProperty(prop.name)) {
              const value = extractedData[prop.name] || "";
              extractedProperties[prop.name] = {
                name: prop.name,
                value: value,
                confidence: value ? 85 : 0,
                isConsistent: true,
                sources: value ? [{ url: sourceUrl || "Manual URL Input", title: productName }] : []
              };
              
              if (value) {
                propertiesFound++;
                console.log(`[URL-MANUAL] Extracted ${prop.name}: ${value}`);
              }
            }
          }
          
          console.log(`[URL-MANUAL] Extraction completed: ${propertiesFound}/${properties.length} properties found`);
          
        } catch (parseError) {
          console.error("[URL-MANUAL] Failed to parse AI response as JSON:", parseError);
          console.error("[URL-MANUAL] Raw response:", content);
        }
      } else {
        console.error("[URL-MANUAL] No response choices received from OpenAI");
      }
      
    } catch (error) {
      console.error("[URL-MANUAL] Error during extraction:", error);
    }
    
    return extractedProperties;
  }

  // Dedicated method for URL File Upload mode - uses user's selected model
  async extractFromUrlFileUpload(
    scrapedContent: string,
    articleNumber: string,
    productName: string,
    properties: { name: string; description?: string; expectedFormat?: string; orderIndex?: number }[],
    userId?: number | null,
    sourceUrl?: string,
    modelId?: string
  ): Promise<Record<string, PropertyResult>> {
    const model = this.validateModel(modelId);
    console.log(`[URL-FILE-UPLOAD] Starting extraction for ${productName} (${articleNumber}) using ${model}`);
    console.log(`[URL-FILE-UPLOAD] Content length: ${scrapedContent.length} characters`);
    console.log(`[URL-FILE-UPLOAD] Properties to extract: ${properties.length}`);
    
    const extractedProperties: Record<string, PropertyResult> = {};
    
    // Initialize all properties with empty values to maintain order
    const sortedProperties = properties.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    for (const prop of sortedProperties) {
      extractedProperties[prop.name] = {
        name: prop.name,
        value: "",
        confidence: 0,
        isConsistent: false,
        sources: []
      };
    }
    
    // Ensure we have OpenAI configured
    if (!this.openai && !process.env.OPENAI_API_KEY) {
      console.error("[URL-FILE-UPLOAD] No OpenAI API key available");
      return extractedProperties;
    }
    
    // Set up OpenAI if not already configured
    if (!this.openai && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log("[URL-FILE-UPLOAD] OpenAI initialized with environment key");
    }
    
    try {
      // Clean and prepare content for extraction
      const cleanedContent = parseHtmlToCleanText(scrapedContent);
      const truncatedContent = cleanedContent.substring(0, 100000); // Limit to avoid token issues
      
      console.log(`[URL-FILE-UPLOAD] Cleaned content length: ${truncatedContent.length} characters`);
      
      // Create property list for prompt
      const propertyList = sortedProperties.map((prop, index) => 
        `${index + 1}. "${prop.name}"${prop.description ? ` (${prop.description})` : ''}${prop.expectedFormat ? ` - Format: ${prop.expectedFormat}` : ''}`
      ).join('\n');
      
      // Create expected JSON structure
      const expectedStructure = sortedProperties.reduce((acc, prop) => {
        acc[prop.name] = "actual_value_or_empty_string";
        return acc;
      }, {} as Record<string, string>);
      
      const systemPrompt = `You are a precise web data extraction expert for URL File Upload mode (batch processing). You extract ONLY technical values that actually exist in the provided HTML content. You NEVER fabricate data.

CORE RULES FOR URL FILE UPLOAD:

1. STRICT DATA VALIDATION:
   - Extract ONLY values explicitly found in the provided content
   - If a value doesn't exist, respond with empty string ""
   - NEVER invent data or use estimates
   - All values must originate directly from the provided content

2. PROPERTY ORDER MAINTENANCE:
   - Return properties in the EXACT order specified
   - Include ALL ${properties.length} properties even if some are empty
   - Maintain the property names exactly as provided

3. BATCH PROCESSING EFFICIENCY:
   - Focus on the most relevant technical specifications
   - Look for product datasheets, specifications tables, and technical details
   - Prioritize numerical values with units (dimensions, power, efficiency, etc.)
   - Search for certifications and standards compliance

4. SEARCH STRATEGY:
   - Look for property values in product specifications
   - Check technical data tables and lists
   - Search product descriptions and feature lists
   - Look for measurements, ratings, and technical details
   - Use German and English property names as synonyms

5. OUTPUT FORMAT:
   - Return valid JSON object only
   - Use exact property names as keys
   - Empty string for missing values
   - Include units when found (e.g., "580 mm", "114 kg", "92%")

PROPERTIES TO EXTRACT (in exact order):
${propertyList}

EXPECTED JSON STRUCTURE:
${JSON.stringify(expectedStructure, null, 2)}

Extract from the provided content and return only the JSON object.`;

      console.log(`[URL-FILE-UPLOAD] Sending request to ${model} with ${truncatedContent.length} chars`);
      
      const response = await this.openai!.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: `PRODUCT: ${productName} (Article: ${articleNumber})

WEB CONTENT:
${truncatedContent}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      // Track token usage with per-user tracking
      if (response.usage) {
        const inputTokens = response.usage.prompt_tokens || 0;
        const outputTokens = response.usage.completion_tokens || 0;
        console.log(`[URL-FILE-UPLOAD] Token usage: ${inputTokens} input + ${outputTokens} output tokens for user ${userId || 'system'}`);
        
        try {
          await TokenTracker.trackOpenAIUsage(userId || null, model, inputTokens, outputTokens, "url-file-upload");
        } catch (tokenError) {
          console.error("[URL-FILE-UPLOAD] Error tracking token usage:", tokenError);
        }
      }
      
      // Parse response
      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content || "{}";
        console.log(`[URL-FILE-UPLOAD] AI response received: ${content.length} characters`);
        
        try {
          const extractedData = JSON.parse(content);
          console.log(`[URL-FILE-UPLOAD] Successfully parsed JSON with ${Object.keys(extractedData).length} properties`);
          
          // Process extracted data and maintain order
          let propertiesFound = 0;
          for (const prop of sortedProperties) {
            if (extractedData.hasOwnProperty(prop.name)) {
              const value = extractedData[prop.name] || "";
              extractedProperties[prop.name] = {
                name: prop.name,
                value: value,
                confidence: value ? 85 : 0,
                isConsistent: true,
                sources: value ? [{ url: sourceUrl || "URL File Upload", title: productName }] : []
              };
              
              if (value) {
                propertiesFound++;
                console.log(`[URL-FILE-UPLOAD] Extracted ${prop.name}: ${value}`);
              }
            }
          }
          
          console.log(`[URL-FILE-UPLOAD] Extraction completed: ${propertiesFound}/${properties.length} properties found`);
          
        } catch (parseError) {
          console.error("[URL-FILE-UPLOAD] Failed to parse AI response as JSON:", parseError);
          console.error("[URL-FILE-UPLOAD] Raw response:", content);
        }
      } else {
        console.error("[URL-FILE-UPLOAD] No response choices received from OpenAI");
      }
      
    } catch (error) {
      console.error("[URL-FILE-UPLOAD] Error during extraction:", error);
    }
    
    return extractedProperties;
  }

  // Extract only technical sections from content for faster processing
  private extractTechnicalSections(content: string, articleNumber: string, productName: string): string {
    if (!content) return '';
    
    // Keywords that indicate technical specification sections
    const technicalKeywords = [
      'technische daten', 'specifications', 'eigenschaften', 'abmessungen', 'dimensions',
      'gewicht', 'weight', 'masse', 'leistung', 'power', 'kw', 'watt', 'energie',
      'effizienz', 'efficiency', 'maße', 'größe', 'size', 'material', 'brennstoff',
      'heizleistung', 'wärmeleistung', 'raumheizvermögen', 'wirkungsgrad',
      'anschluss', 'durchmesser', 'höhe', 'breite', 'tiefe', 'länge'
    ];
    
    // Product-specific keywords
    const productKeywords = [
      articleNumber.toLowerCase(),
      ...productName.toLowerCase().split(' ').filter(word => word.length > 2)
    ];
    
    const lines = content.split('\n');
    const relevantSections = [];
    let currentSection = '';
    let inTechnicalSection = false;
    let sectionScore = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const lineScore = this.calculateLineRelevance(line, technicalKeywords, productKeywords);
      
      // Start a new section if we find a highly relevant line
      if (lineScore > 2 && !inTechnicalSection) {
        inTechnicalSection = true;
        currentSection = lines[i];
        sectionScore = lineScore;
      } 
      // Continue section if we're in one and line is somewhat relevant
      else if (inTechnicalSection) {
        currentSection += '\n' + lines[i];
        sectionScore += lineScore;
        
        // End section if we hit too many irrelevant lines or section gets too long
        if (lineScore === 0 && sectionScore < 5) {
          if (currentSection.length > 200) {
            relevantSections.push(currentSection);
          }
          inTechnicalSection = false;
          currentSection = '';
          sectionScore = 0;
        } else if (currentSection.length > 10000) {
          relevantSections.push(currentSection);
          inTechnicalSection = false;
          currentSection = '';
          sectionScore = 0;
        }
      }
      
      // Limit processing to avoid performance issues
      if (relevantSections.join('\n').length > 50000) break;
    }
    
    // Add final section if we were still in one
    if (inTechnicalSection && currentSection.length > 200) {
      relevantSections.push(currentSection);
    }
    
    // If no technical sections found, return first part of content
    if (relevantSections.length === 0) {
      return content.substring(0, 20000);
    }
    
    return relevantSections.join('\n\n');
  }

  // Calculate how relevant a line is for technical specifications
  private calculateLineRelevance(line: string, technicalKeywords: string[], productKeywords: string[]): number {
    let score = 0;
    
    // Check for technical keywords
    for (const keyword of technicalKeywords) {
      if (line.includes(keyword)) {
        score += 2;
      }
    }
    
    // Check for product keywords
    for (const keyword of productKeywords) {
      if (line.includes(keyword)) {
        score += 1;
      }
    }
    
    // Check for numeric values with units (strong indicator of specs)
    if (/\d+\s*(mm|cm|kg|kw|%|°c|pa|mg\/m³|v|w|a|hz|bar|psi|l|ml|g|t|m²|m³)/i.test(line)) {
      score += 3;
    }
    
    // Check for colon-separated key-value pairs
    if (/^[^:]+:\s*[^:]+$/.test(line.trim())) {
      score += 1;
    }
    
    return score;
  }

  // Enhanced method to validate web page relevance with precise product matching
  private async validateWebPageRelevance(
    htmlContents: Array<string | {content: string, url: string, title: string}>, 
    articleNumber: string, 
    productName: string
  ): Promise<Array<{content: string, url: string, title: string}>> {
    console.log(`Validating ${htmlContents.length} sources for exact product match: "${productName}" (${articleNumber})`);
    
    const validatedSources = [];
    const productScores = [];
    const validationStartTime = Date.now();
    
    // Process all sources sequentially for now (parallel validation was causing issues)
    for (let i = 0; i < htmlContents.length; i++) {
      const htmlItem = htmlContents[i];
      let html: string;
      let sourceUrl = `Source ${i + 1}`;
      let sourceTitle = `Web Page ${i + 1}`;
      
      // Handle both string and object formats
      if (typeof htmlItem === 'string') {
        html = htmlItem;
      } else if (htmlItem && typeof htmlItem === 'object') {
        html = htmlItem.content;
        sourceUrl = htmlItem.url || `Source ${i + 1}`;
        sourceTitle = htmlItem.title || `Web Page ${i + 1}`;
      } else {
        continue;
      }
      
      if (!html) continue;
      
      try {
        // Clean HTML to text for analysis
        let cleanText = html;
        cleanText = cleanText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        cleanText = cleanText.replace(/<[^>]*>/g, ' ');
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        let relevanceScore = 0;
        let validationDetails = [];
        
        // 1. Check for exact article number match (highest priority - 50 points)
        const hasArticleNumber = articleNumber && cleanText.toLowerCase().includes(articleNumber.toLowerCase());
        if (hasArticleNumber) {
          relevanceScore += 50;
          validationDetails.push(`exact article number "${articleNumber}"`);
        }
        
        // 2. Check for exact product name match (40 points)
        if (cleanText.toLowerCase().includes(productName.toLowerCase())) {
          relevanceScore += 40;
          validationDetails.push(`exact product name "${productName}"`);
        } else {
          // 3. If no article number found, use intelligent product name matching
          if (!hasArticleNumber) {
            const bestProductMatch = this.findBestProductNameMatch(cleanText, productName);
            if (bestProductMatch.score > 0) {
              relevanceScore += bestProductMatch.score;
              validationDetails.push(`intelligent product match: "${bestProductMatch.matchedName}" (${bestProductMatch.score} pts)`);
            }
          }
          
          // 4. Advanced word-by-word matching with exact boundaries
          const productWords = productName.toLowerCase().split(/[\s\.\-]+/).filter(word => word.length > 1);
          let exactWordMatches = 0;
          let partialWordMatches = 0;
          
          for (const word of productWords) {
            // Use word boundaries for exact matching to avoid false positives
            const exactWordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            const partialWordRegex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            
            if (exactWordRegex.test(cleanText)) {
              exactWordMatches++;
            } else if (partialWordRegex.test(cleanText)) {
              partialWordMatches++;
            }
          }
          
          const exactWordRatio = exactWordMatches / productWords.length;
          const totalWordRatio = (exactWordMatches + partialWordMatches * 0.5) / productWords.length;
          
          if (exactWordRatio >= 0.8) { // 80%+ exact word matches
            relevanceScore += 35;
            validationDetails.push(`${exactWordMatches}/${productWords.length} exact word matches`);
          } else if (exactWordRatio >= 0.6) { // 60-79% exact matches
            relevanceScore += 25;
            validationDetails.push(`${exactWordMatches}/${productWords.length} exact + partial matches`);
          } else if (totalWordRatio >= 0.6) { // 60%+ total matches (including partial)
            relevanceScore += 15;
            validationDetails.push(`${exactWordMatches + partialWordMatches}/${productWords.length} mixed matches`);
          } else if (totalWordRatio >= 0.4) { // 40%+ total matches (more lenient for complex product names)
            relevanceScore += 10;
            validationDetails.push(`${exactWordMatches + partialWordMatches}/${productWords.length} basic matches`);
          }
        }
        
        // 4. Check for conflicting similar products (negative scoring)
        // This is crucial for distinguishing "ISOTTA.16" from "ISOTTA CON CERCHI.16"
        const conflictingProducts = this.findConflictingProducts(cleanText, productName);
        if (conflictingProducts.length > 0) {
          // If we found conflicting products and don't have exact match, penalize but not too heavily
          if (relevanceScore < 40) { // No exact product name match
            relevanceScore -= 15; // Reduced penalty to be less restrictive
            validationDetails.push(`found conflicting products: ${conflictingProducts.slice(0, 2).join(', ')}`);
          }
        }
        
        // 5. URL and title validation for additional confidence
        const urlTitleScore = this.validateProductInUrlAndTitle(html, articleNumber, productName);
        if (urlTitleScore.score > 0) {
          relevanceScore += urlTitleScore.score;
          validationDetails.push(`URL/title contains ${urlTitleScore.matchType}`);
        }
        
        // 6. Brand-specific bonus for manufacturer pages
        // If this appears to be from the actual manufacturer, give bonus points
        const productBrand = productName.split(' ')[0].toLowerCase(); // e.g., "austroflamm"
        if (cleanText.toLowerCase().includes(productBrand) && cleanText.toLowerCase().includes('austroflamm.com')) {
          relevanceScore += 10;
          validationDetails.push('manufacturer website detected');
        }
        
        // Store score for ranking
        productScores.push({
          index: i,
          score: relevanceScore,
          details: validationDetails,
          content: cleanText,
          url: sourceUrl,
          title: sourceTitle
        });
        
        console.log(`Source ${i + 1}: Score ${relevanceScore} - ${validationDetails.join(', ') || 'no matches'}`);
        
      } catch (error) {
        console.error(`Error validating source ${i + 1}:`, error);
      }
    }
    
    // Sort by relevance score (highest first) and keep more sources for comprehensive analysis
    productScores.sort((a, b) => b.score - a.score);
    
    // Filter sources based on relevance score to ensure accuracy
    // Only include sources with sufficient confidence they contain the exact product
    const MIN_RELEVANCE_SCORE = 35; // Require at least article number OR good product name match
    let validScores = productScores.filter(item => item.score >= MIN_RELEVANCE_SCORE);
    
    // If no sources meet the threshold, take top sources but warn about potential inaccuracy
    if (validScores.length === 0 && productScores.length > 0) {
      console.log(`⚠️ No sources met minimum relevance score of ${MIN_RELEVANCE_SCORE}. Using top sources with caution.`);
      validScores = productScores.slice(0, Math.min(3, productScores.length));
    }
    
    console.log(`Selected ${validScores.length} sources with score >= ${MIN_RELEVANCE_SCORE} (from ${productScores.length} total sources)`)
    
    // Convert to expected format using stored URL and title data
    for (const item of validScores) { // Process all available sources
      validatedSources.push({
        content: item.content,
        url: item.url || `Source ${item.index + 1}`,
        title: item.title || `Web Page ${item.index + 1} (Score: ${item.score})`
      });
    }
    
    console.log(`Selected ${validatedSources.length} high-quality sources for analysis`);
    return validatedSources;
  }

  // Helper method to find conflicting products that might cause confusion
  private findConflictingProducts(content: string, targetProductName: string): string[] {
    const conflicts: string[] = [];
    const targetLower = targetProductName.toLowerCase();
    
    // Extract the brand and base model from target product
    const words = targetProductName.split(/\s+/);
    if (words.length < 2) return conflicts;
    
    const brand = words[0]; // e.g., "La"
    const baseModel = words.slice(1).join(' '); // e.g., "Nordica ISOTTA.16"
    
    // CRITICAL FIX: Escape regex special characters in product name to prevent regex errors
    // This fixes the "Blade12++" regex error (++ is invalid in regex)
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedBrand = escapeRegex(brand);
    const escapedBaseModel = escapeRegex(baseModel.split(/[\s\.]/)[0]);
    
    // Look for similar patterns but with different specifications
    // This regex finds products with same brand but different model variations
    const conflictPattern = new RegExp(
      `${escapedBrand}\\s+[^\\n]*${escapedBaseModel}[^\\n]*(?:CON|WITH|PLUS|PRO|MAX|MINI|\\d+[A-Z]?)`,
      'gi'
    );
    
    const matches = content.match(conflictPattern) || [];
    
    for (const match of matches) {
      const cleanMatch = match.trim().replace(/\s+/g, ' ');
      if (cleanMatch.toLowerCase() !== targetLower && cleanMatch.length > 0) {
        conflicts.push(cleanMatch);
      }
    }
    
    return Array.from(new Set(conflicts)).slice(0, 10); // Allow more conflicts for better analysis
  }

  // Intelligent product name matching when article numbers aren't available
  private findBestProductNameMatch(content: string, targetProductName: string): { score: number; matchedName: string } {
    const targetWords = targetProductName.toLowerCase().split(/[\s\.\-]+/).filter(word => word.length > 1);
    const targetBrand = targetWords[0]; // First word is usually the brand
    
    let bestMatch = { score: 0, matchedName: '' };
    
    // Extract potential product names from the content
    const productNamePatterns = [
      // Pattern 1: Brand + model patterns (e.g., "Austroflamm Fynn Xtra", "Kaminofen Fynn Xtra")
      new RegExp(`(?:^|\\s)((?:${targetBrand}|kaminofen|ofen)\\s+[^\\n\\.]{5,50})`, 'gi'),
      // Pattern 2: Title or heading patterns
      new RegExp(`<(?:title|h[1-6])[^>]*>([^<]*(?:${targetBrand}|fynn|xtra)[^<]*)</(?:title|h[1-6])>`, 'gi'),
      // Pattern 3: Product name in structured data or meta tags
      new RegExp(`(?:product[_-]?name|title|name)["']?\\s*[:=]\\s*["']?([^"'\n]*(?:${targetBrand}|fynn|xtra)[^"'\n]*)["']?`, 'gi')
    ];
    
    for (const pattern of productNamePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const candidateName = match[1].trim().replace(/\s+/g, ' ');
        if (candidateName.length < 5 || candidateName.length > 100) continue;
        
        const matchScore = this.calculateProductNameSimilarity(candidateName, targetProductName, targetWords);
        if (matchScore > bestMatch.score) {
          bestMatch = { score: matchScore, matchedName: candidateName };
        }
      }
    }
    
    // Additional fuzzy matching for common product name variations
    if (bestMatch.score < 20) {
      const fuzzyMatch = this.findFuzzyProductMatch(content, targetProductName, targetWords);
      if (fuzzyMatch.score > bestMatch.score) {
        bestMatch = fuzzyMatch;
      }
    }
    
    return bestMatch;
  }

  // Calculate similarity score between candidate and target product names
  private calculateProductNameSimilarity(candidate: string, target: string, targetWords: string[]): number {
    const candidateLower = candidate.toLowerCase();
    const targetLower = target.toLowerCase();
    
    let score = 0;
    
    // Exact match bonus
    if (candidateLower.includes(targetLower.substring(0, Math.min(20, targetLower.length)))) {
      score += 35;
    }
    
    // Word-by-word matching
    let wordMatches = 0;
    for (const word of targetWords) {
      if (candidateLower.includes(word)) {
        wordMatches++;
        score += 5;
      }
    }
    
    // Brand presence bonus
    const brand = targetWords[0];
    if (candidateLower.includes(brand)) {
      score += 10;
    }
    
    // Model number/identifier bonus
    const modelPattern = /(?:xtra|fynn|\d+(?:\.\d+)?)/gi;
    const targetModels = target.match(modelPattern) || [];
    const candidateModels = candidate.match(modelPattern) || [];
    
    for (const model of targetModels) {
      if (candidateModels.some(cm => cm.toLowerCase() === model.toLowerCase())) {
        score += 8;
      }
    }
    
    // Penalty for very different lengths
    const lengthDiff = Math.abs(candidate.length - target.length);
    if (lengthDiff > target.length * 0.5) {
      score -= 5;
    }
    
    return Math.max(0, score);
  }

  // Fuzzy matching for product names when exact patterns don't work
  private findFuzzyProductMatch(content: string, targetProductName: string, targetWords: string[]): { score: number; matchedName: string } {
    const sentences = content.split(/[.\n!?]+/).filter(s => s.length > 10 && s.length < 200);
    let bestMatch = { score: 0, matchedName: '' };
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase().trim();
      
      // Skip sentences that don't contain at least the brand
      if (!sentenceLower.includes(targetWords[0])) continue;
      
      let score = 0;
      let wordMatches = 0;
      
      for (const word of targetWords) {
        if (sentenceLower.includes(word)) {
          wordMatches++;
          score += 3;
        }
      }
      
      // Require at least 40% word matches for fuzzy matching
      if (wordMatches / targetWords.length >= 0.4) {
        score += 5; // Base fuzzy match bonus
        
        if (score > bestMatch.score) {
          bestMatch = { score, matchedName: sentence.trim() };
        }
      }
    }
    
    return bestMatch;
  }

  // Helper method to clean advertisement text from page titles
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

  // Helper method to validate product information in URLs and page titles
  private validateProductInUrlAndTitle(html: string, articleNumber: string, productName: string): { score: number; matchType: string } {
    let score = 0;
    let matchTypes = [];
    
    // Extract URLs from HTML
    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    const urls = html.match(urlRegex) || [];
    
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    
    // Clean the title to remove advertisement text
    const title = this.cleanPageTitle(rawTitle);
    
    const searchTexts = [...urls, title].filter(text => text);
    
    for (const text of searchTexts) {
      const textLower = text.toLowerCase();
      
      // Check for article number
      if (articleNumber && textLower.includes(articleNumber.toLowerCase())) {
        score += 15;
        matchTypes.push('article number');
      }
      
      // Check for exact product name
      if (textLower.includes(productName.toLowerCase())) {
        score += 10;
        matchTypes.push('product name');
      } else {
        // Check for individual product words
        const productWords = productName.toLowerCase().split(/[\s\.\-]+/).filter(word => word.length > 2);
        const matchingWords = productWords.filter(word => textLower.includes(word));
        
        if (matchingWords.length >= productWords.length * 0.7) {
          score += 5;
          matchTypes.push('product keywords');
        }
      }
    }
    
    return {
      score: Math.min(score, 20), // Cap at 20 points
      matchType: matchTypes.join(' and ') || 'none'
    };
  }

  // Helper method to extract data from a single source
  private async extractFromSingleSource(
    content: string,
    sourceNumber: number,
    articleNumber: string,
    productName: string,
    requiredProperties?: { name: string; description?: string; expectedFormat?: string; orderIndex?: number; isRequired?: boolean }[],
    userId?: number | null,
    modelId?: string
  ): Promise<Record<string, string>> {
    const model = this.validateModel(modelId);
    const extractedData: Record<string, string> = {};
    
    if (!this.openai) {
      console.log(`No AI service available for source ${sourceNumber} extraction`);
      return extractedData;
    }
    
    try {
      const systemPrompt = `You are a precise web data extraction expert. Extract ONLY technical values that actually exist in the provided content. NEVER fabricate data.

⚠️ CRITICAL PRODUCT VERIFICATION REQUIREMENT:
Before extracting ANY data, you MUST verify this content is about the EXACT product:
- Article Number MUST match: "${articleNumber}"
- Product Name MUST match: "${productName}"

If the content contains data about a DIFFERENT product (even similar ones), you MUST:
- Return empty string "" for ALL properties
- DO NOT extract data from similar or related products
- Only extract data if you are 100% certain it's for the exact product specified

Examples of INVALID matches (return "" for all properties):
- Content about "DEBBY EVO" when searching for "DEBBY PLUS EVO"
- Content about "ISOTTA CON CERCHI.16" when searching for "ISOTTA.16"
- Content about different article numbers or model variations

CRITICAL EXTRACTION RULES:
1. Extract ONLY values explicitly found in the content
2. MANDATORY: If a value doesn't exist, respond with EXACTLY "" (empty string)
3. NEVER use "nicht explizit angegeben", "nicht angegeben", "not specified", "n/a", or ANY explanatory text
4. NEVER invent data or use estimates - only actual values from content
5. Search using ALL possible synonyms, variations, and contextual clues:
   - Check multiple languages (German, English, Italian, French)
   - Look for abbreviations and alternative spellings
   - Consider contextual synonyms (e.g., "Leistung" = "Power" = "Potenza" = "Wärmeleistung")
   - Check for values in sentences, not just tables
6. Prioritize structured data but also extract from descriptive text
7. CRITICAL BAUART SYNONYM MAPPING:
   - "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
   - "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
   - "Bauart: 1" → extract "1"
   - "Bauart: 2" → extract "2"

CONTEXTUAL EXTRACTION STRATEGY:
- If searching for "Breite", also look for: "Width", "Larghezza", "Largeur", "B x H x T" (first value)
- If searching for "Höhe", also look for: "Height", "Altezza", "Hauteur", "B x H x T" (second value)
- If searching for "Tiefe", also look for: "Depth", "Profondità", "Profondeur", "B x H x T" (third value)
- For dimensions in format "550x1200x573 mm", extract individual values
- For ranges like "3 - 9 kW", extract the full range as is
- Check product names, model numbers, and descriptions for contextual clues

EMPTY VALUE RULES:
- Return "" for missing values - NO explanatory text
- Return "" if uncertain - NO guessing
- Return "" if not found - NO placeholders

OUTPUT: JSON object with exact property names as keys and extracted values (or "") as strings.`;

      const userPrompt = `EXTRACT TECHNICAL DATA FROM SOURCE ${sourceNumber}:
• Article: ${articleNumber}
• Product: ${productName}

${requiredProperties && requiredProperties.length > 0 ? 
  `PROPERTIES TO EXTRACT (MANDATORY: use EXACTLY "" for missing values - NO explanatory text):
${requiredProperties
  .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  .map((prop, index) => {
    let desc = `${index + 1}. "${prop.name}"`;
    if (prop.description) desc += ` (${prop.description})`;
    if (prop.expectedFormat) desc += ` - Format: ${prop.expectedFormat}`;
    
    // Add synonym hints for common properties
    const synonymHints: Record<string, string> = {
      'Breite (in mm)': 'Also check: Width, Larghezza, Largeur, B x H x T (first value), Abmessungen',
      'Höhe (in mm)': 'Also check: Height, Altezza, Hauteur, B x H x T (second value), Abmessungen',
      'Tiefe (in mm)': 'Also check: Depth, Profondità, Profondeur, B x H x T (third value), Abmessungen',
      'Gewicht (in kg)': 'Also check: Weight, Peso, Poids, Nettogewicht, Bruttogewicht',
      'Nennwärmeleistung (in kW)': 'Also check: Power, Potenza, Puissance, Leistung, Heizleistung',
      'Wirkungsgrad (in %)': 'Also check: Efficiency, Rendimento, Rendement, Ertrag',
      'CO-Emission (in mg/m³)': 'Also check: CO, Emissioni CO, Émissions CO, Kohlenmonoxid',
      'Staubemission (in mg/m³)': 'Also check: Dust, Polveri, Poussières, Particulate, PM',
      'Abgastemperatur Stutzen max. (in °C)': 'Also check: Flue temperature, Temperatura fumi, Température fumées',
      'Volumen Pelletbehälter (in kg)': 'Also check: Tank capacity, Capacità serbatoio, Capacité réservoir, Gesamttankinhalt',
      'Brennstoffverbrauch (in kg/h)': 'Also check: Consumption, Consumo, Consommation, Stündlicher Verbrauch'
    };
    
    if (synonymHints[prop.name]) {
      desc += `\n     ${synonymHints[prop.name]}`;
    }
    
    return desc;
  }).join('\n')}

CRITICAL OUTPUT RULES:
- Return EXACTLY "" (empty string) for missing values
- NEVER use "nicht explizit angegeben", "nicht angegeben", "not specified" or similar
- Extract actual values or ""  - nothing else

OUTPUT FORMAT - JSON with EXACTLY ${requiredProperties.length} properties:
{
  "${requiredProperties[0]?.name || 'Property1'}": "actual value or exactly empty string",
  "${requiredProperties[1]?.name || 'Property2'}": "actual value or exactly empty string"
}` : 'Extract available technical properties'} 

CONTENT:
${content.substring(0, 15000)}`;

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      // Track token usage with per-user tracking for each source extraction
      if (response.usage) {
        const inputTokens = response.usage.prompt_tokens || 0;
        const outputTokens = response.usage.completion_tokens || 0;
        console.log(`[SOURCE-${sourceNumber}] Token usage: ${inputTokens} input + ${outputTokens} output tokens for user ${userId || 'system'}`);
        
        try {
          await TokenTracker.trackOpenAIUsage(userId || null, model, inputTokens, outputTokens, `extract-source-${sourceNumber}`);
        } catch (tokenError) {
          console.error(`[SOURCE-${sourceNumber}] Error tracking token usage:`, tokenError);
        }
      }

      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content || "{}";
        try {
          const parsedData = JSON.parse(content);
          // Clean up any remaining explanatory text from the parsed data
          const cleanedData: Record<string, string> = {};
          for (const [key, value] of Object.entries(parsedData)) {
            cleanedData[key] = this.cleanupValue(value as string);
          }
          console.log(`Source ${sourceNumber}: Extracted ${Object.keys(cleanedData).length} properties`);
          return cleanedData;
        } catch (error) {
          console.error(`Error parsing extraction result from source ${sourceNumber}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error extracting from source ${sourceNumber}:`, error);
    }
    
    return extractedData;
  }

  // Helper method to analyze value consistency across sources
  private analyzeValueConsistency(
    sourceExtractions: Array<{sourceIndex: number, properties: Record<string, string>}>,
    requiredProperties: { name: string; description?: string; expectedFormat?: string; orderIndex?: number; isRequired?: boolean }[]
  ): Record<string, {
    mostConsistentValue: string,
    consistencyCount: number,
    confidence: number,
    sourceIndices: number[]
  }> {
    const analysis: Record<string, {
      mostConsistentValue: string,
      consistencyCount: number,
      confidence: number,
      sourceIndices: number[]
    }> = {};

    for (const prop of requiredProperties) {
      const propertyName = prop.name;
      const valueOccurrences: Record<string, {count: number, sourceIndices: number[]}> = {};
      
      // Count occurrences of each value across sources
      for (const source of sourceExtractions) {
        const value = source.properties[propertyName];
        if (value && value.trim() !== "") {
          const normalizedValue = value.trim();
          if (!valueOccurrences[normalizedValue]) {
            valueOccurrences[normalizedValue] = { count: 0, sourceIndices: [] };
          }
          valueOccurrences[normalizedValue].count++;
          valueOccurrences[normalizedValue].sourceIndices.push(source.sourceIndex);
        }
      }
      
      // Find the most consistent value
      let mostConsistentValue = "";
      let maxCount = 0;
      let sourceIndices: number[] = [];
      
      for (const [value, occurrence] of Object.entries(valueOccurrences)) {
        if (occurrence.count > maxCount) {
          maxCount = occurrence.count;
          mostConsistentValue = value;
          sourceIndices = occurrence.sourceIndices;
        }
      }
      
      // Calculate confidence based on consistency
      const totalSources = sourceExtractions.length;
      const consistency = maxCount / totalSources;
      let confidence = 0;
      
      if (mostConsistentValue) {
        if (maxCount >= 2) {
          // Consistent value (appears in 2+ sources)
          confidence = Math.min(95, 60 + (consistency * 35));
        } else {
          // Inconsistent value (appears in only 1 source)
          confidence = 30;
        }
      }
      
      analysis[propertyName] = {
        mostConsistentValue: this.cleanupValue(mostConsistentValue),
        consistencyCount: maxCount,
        confidence: Math.round(confidence),
        sourceIndices
      };
      
      console.log(`${propertyName}: "${mostConsistentValue}" (${maxCount}/${totalSources} sources, ${Math.round(confidence)}% confidence)`);
    }
    
    return analysis;
  }

  // Clean up any remaining explanatory text that might have slipped through
  private cleanupValue(value: string): string {
    if (!value) return "";
    
    const forbidden = [
      "nicht explizit angegeben",
      "nicht angegeben",
      "not specified",
      "nicht verfügbar",
      "keine Angabe",
      "n/a",
      "nicht vorhanden",
      "nicht erwähnt",
      "nicht gefunden",
      "nicht spezifiziert",
      "nicht aufgeführt",
      "nicht genannt",
      "nicht definiert",
      "nicht bekannt",
      "nicht dokumentiert",
      "nicht bestimmt",
      "nicht ermittelt",
      "nicht festgelegt",
      "nicht beschrieben",
      "nicht ausgewiesen",
      "nicht ersichtlich",
      "nicht enthalten",
      "nicht angeführt",
      "nicht aufgezeigt",
      "nicht präzisiert",
      "nicht erkennbar",
      "nicht auffindbar",
      "nicht sichtbar",
      "nicht lesbar",
      "nicht identifiziert",
      "nicht einsehbar",
      "nicht konkretisiert",
      "nicht quantifiziert",
      "nicht klassifiziert",
      "nicht charakterisiert",
      "nicht detailliert",
      "nicht übertragen",
      "nicht zugeordnet",
      "nicht registriert",
      "nicht verzeichnet",
      "nicht katalogisiert",
      "nicht markiert",
      "nicht bezeichnet",
      "nicht benannt",
      "nicht betitelt",
      "nicht gelabelt",
      "nicht beschriftet",
      "nicht gestempelt",
      "nicht signiert",
      "nicht signalisiert",
      "nicht hervorgehoben",
      "nicht unterstrichen",
      "nicht fettgedruckt",
      "nicht kursiv",
      "nicht formatiert",
      "nicht strukturiert",
      "nicht geordnet",
      "nicht organisiert",
      "nicht gegliedert",
      "nicht unterteilt",
      "nicht aufgeteilt",
      "nicht abgegrenzt",
      "nicht differenziert",
      "nicht unterschieden",
      "nicht getrennt",
      "nicht isoliert",
      "nicht separiert",
      "nicht individualisiert",
      "nicht personalisiert",
      "nicht individuell",
      "nicht spezifisch",
      "nicht eindeutig",
      "nicht klar",
      "nicht deutlich",
      "nicht genau",
      "nicht exakt",
      "nicht präzise",
      "nicht akkurat",
      "nicht korrekt",
      "nicht richtig",
      "nicht zutreffend",
      "nicht passend",
      "nicht angemessen",
      "nicht geeignet",
      "nicht entsprechend",
      "nicht adäquat",
      "nicht ausreichend",
      "nicht vollständig",
      "nicht komplett",
      "nicht total",
      "nicht gänzlich",
      "nicht vollkommen",
      "nicht perfekt",
      "nicht optimal",
      "nicht ideal",
      "nicht maximal",
      "nicht minimal",
      "nicht standard",
      "nicht normal",
      "nicht gewöhnlich",
      "nicht üblich",
      "nicht typisch",
      "nicht charakteristisch",
      "nicht repräsentativ",
      "nicht beispielhaft",
      "nicht exemplarisch",
      "nicht veranschaulichend",
      "nicht illustrativ",
      "nicht demonstrativ",
      "nicht beweisend",
      "nicht zeigend",
      "nicht darstellend",
      "nicht präsentierend",
      "nicht vorführend",
      "nicht vorstellend",
      "nicht einführend",
      "nicht erläuternd",
      "nicht erklärend",
      "nicht beschreibend",
      "nicht schildernd",
      "nicht erzählend",
      "nicht berichtend",
      "nicht mitteilend",
      "nicht informierend",
      "nicht benachrichtigend",
      "nicht unterrichtend",
      "nicht belehrend",
      "nicht lehrend",
      "nicht ausbildend",
      "nicht erziehend",
      "nicht schulend",
      "nicht trainierend",
      "nicht übend",
      "nicht praktizierend",
      "nicht anwendend",
      "nicht verwendend",
      "nicht nutzend",
      "nicht einsetzend",
      "nicht einbauend",
      "nicht installierend",
      "nicht montierend",
      "nicht aufbauend",
      "nicht errichtend",
      "nicht konstruierend",
      "nicht bauend",
      "nicht schaffend",
      "nicht erzeugend",
      "nicht produzierend",
      "nicht herstellend",
      "nicht fabrizierend",
      "nicht anfertigen",
      "nicht kreierend",
      "nicht entwickelnd",
      "nicht entfaltend",
      "nicht ausbreitend",
      "nicht verbreitend",
      "nicht übertragend",
      "nicht sendend",
      "nicht übermittelnd",
      "nicht liefernd",
      "nicht bereitstellend",
      "nicht zur Verfügung stellend",
      "nicht anbietend",
      "nicht gewährend",
      "nicht garantierend",
      "nicht zusichernd",
      "nicht versprechend",
      "nicht zusagend",
      "nicht bestätigend",
      "nicht verifizierend",
      "nicht validierend",
      "nicht überprüfend",
      "nicht kontrollierend",
      "nicht überwachend",
      "nicht beobachtend",
      "nicht verfolgend",
      "nicht verfolgen",
      "nicht nachverfolgen",
      "nicht zurückverfolgen",
      "nicht aufspüren",
      "nicht ausfindig machen",
      "nicht lokalisieren",
      "nicht orten",
      "nicht positionieren",
      "nicht platzieren",
      "nicht setzen",
      "nicht stellen",
      "nicht legen",
      "nicht ablegen",
      "nicht deponieren",
      "nicht lagern",
      "nicht speichern",
      "nicht aufbewahren",
      "nicht konservieren",
      "nicht erhalten",
      "nicht bewahren",
      "nicht schützen",
      "nicht sichern",
      "nicht absichern",
      "nicht versichern",
      "nicht gewährleisten",
      "nicht sicherstellen",
      "nicht garantieren",
      "nicht zusichern",
      "nicht versprechen",
      "nicht zusagen",
      "nicht bestätigen",
      "nicht verifizieren",
      "nicht validieren",
      "nicht überprüfen",
      "nicht kontrollieren",
      "nicht überwachen",
      "nicht beobachten",
      "nicht verfolgen",
      "nicht nachverfolgen",
      "nicht zurückverfolgen",
      "nicht aufspüren",
      "nicht ausfindig machen",
      "nicht lokalisieren",
      "nicht orten",
      "nicht positionieren",
      "nicht platzieren",
      "nicht setzen",
      "nicht stellen",
      "nicht legen",
      "nicht ablegen",
      "nicht deponieren",
      "nicht lagern",
      "nicht speichern",
      "nicht aufbewahren",
      "nicht konservieren",
      "nicht erhalten",
      "nicht bewahren",
      "nicht schützen",
      "nicht sichern",
      "nicht absichern",
      "nicht versichern",
      "nicht gewährleisten",
      "nicht sicherstellen"
    ];
    
    const cleanedValue = value.trim();
    
    // Check if the value is one of the forbidden phrases
    if (forbidden.some(phrase => cleanedValue.toLowerCase().includes(phrase.toLowerCase()))) {
      return "";
    }
    
    return cleanedValue;
  }
}

// Create a singleton instance
export const openaiService = new OpenAIService();

// Initialize with environment variables if available
if (process.env.OPENAI_API_KEY) {
  openaiService.setApiKey(process.env.OPENAI_API_KEY);
}