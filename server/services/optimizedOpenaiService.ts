import { OpenAI } from 'openai';
import { PropertyResult } from '@shared/schema';
import { MonitoringLogger } from './monitoringLogger';

export class OptimizedOpenAIService {
  private openai: OpenAI | null = null;
  private openaiApiKey: string | null = null;

  setApiKey(apiKey: string) {
    this.openaiApiKey = apiKey;
    this.openai = new OpenAI({ apiKey });
  }

  hasOpenAiKey(): boolean {
    return !!this.openaiApiKey || !!process.env.OPENAI_API_KEY;
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

  // Optimized method that processes multiple sources in a single AI call
  async extractFromBatchedSources(
    sources: Array<{content: string, url: string, title: string, pdfFiles?: Array<{name: string, url: string}>}>,
    articleNumber: string,
    productName: string,
    requiredProperties?: { name: string; description?: string; expectedFormat?: string }[],
    userId?: number | null,
    modelId?: string
  ): Promise<Record<string, PropertyResult>> {
    if (!this.hasOpenAiKey()) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate and use the user's selected model, default to gpt-4.1-mini
    const validModels = ["gpt-4.1", "gpt-4.1-mini"];
    const selectedModel = modelId && validModels.includes(modelId) ? modelId : "gpt-4.1-mini";
    console.log(`[OPTIMIZED] Using AI model: ${selectedModel} (requested: ${modelId || 'not specified'})`);

    // Detect if we have PDF sources
    const hasPdfSource = sources.some(s => s.url === 'PDF_SOURCE' || s.title?.includes('.pdf') || s.pdfFiles);
    const hasWebSource = sources.some(s => s.url !== 'PDF_SOURCE' && s.url.startsWith('http'));

    const systemPrompt = `You are an EXPERT technical data extraction specialist with ADVANCED capabilities in analyzing BOTH PDF documents AND web pages. Your mission is to extract MAXIMUM possible technical specifications from ALL provided sources.

CRITICAL CONTEXT - PRODUKTNAME SEARCH KEY:
The product name "${productName}" is your PRIMARY SEARCH KEY. Use it to:
- Find sections in PDFs that mention this exact product name or similar variations
- Locate product-specific technical data sheets within larger documents
- Identify the correct product when multiple products are listed in the same document
- Cross-reference product mentions between PDF and web sources

${hasPdfSource ? `
===== PDF CONTENT EXTRACTION PROTOCOL (CRITICAL) =====
You are receiving content extracted from PDF documents. PDF content requires SPECIAL ATTENTION:

1. PDF STRUCTURAL ANALYSIS:
   - PDF tables are often converted as: "Property | Value | Unit" or "Property: Value"
   - Look for structured data markers: [STRUCTURED_DATA_START], [STRUCTURED_DATA_END]
   - Table rows may appear as: "Breite 550 mm" or "Width: 550mm"
   - Technical specifications often appear in dedicated sections

2. PDF-SPECIFIC SEARCH STRATEGY:
   - Search for "${productName}" to find the product-specific section first
   - After finding the product, extract ALL surrounding technical data
   - Look for specification tables within 500 characters of the product name mention
   - Check headers like "Technische Daten", "Technical Data", "Specifications", "Dati Tecnici"
   - Parse multi-column layouts: values may appear in separate columns

3. PDF DATA PATTERNS TO RECOGNIZE:
   - Dimension patterns: "465 x 1090 x 465 mm", "B x H x T: 465/1090/465"
   - Weight patterns: "Gewicht: 142 kg", "Weight 142kg", "142 kg netto"
   - Power patterns: "3-9 kW", "Nennleistung 7 kW", "Output: 3-9kW"
   - Efficiency patterns: "η = 94.3%", "Wirkungsgrad: 94,3%", "Efficiency 94.3%"
   - Temperature patterns: "max. 250°C", "Abgastemperatur 180-250°C"

4. AGGRESSIVE PDF PARSING:
   - Do NOT assume PDF content is incomplete - search thoroughly
   - Values may be scattered across different sections
   - Some values appear only in PDF and not on websites - EXTRACT THEM
   - Check the ENTIRE PDF content, not just the first few paragraphs
` : ''}

${hasWebSource ? `
===== WEB CONTENT EXTRACTION PROTOCOL =====
For web content from URLs:

1. WEB-SPECIFIC SEARCH STRATEGY:
   - Product pages often have structured specification tables
   - Look for: data tables, specification lists, technical data sections
   - Check breadcrumbs or headers for product identification
   - Manufacturer sites have the most reliable technical data

2. WEB DATA PATTERNS:
   - HTML tables converted to text: "Property: Value"
   - Bullet-point lists with specifications
   - Structured product attributes in e-commerce sites
` : ''}

===== UNIFIED EXTRACTION PRINCIPLES =====

IMPORTANT: You are receiving content from ${sources.length} sources${hasPdfSource && hasWebSource ? ' (BOTH PDF and Web)' : ''}. You MUST:
- Search through ALL provided sources EXHAUSTIVELY
- Use "${productName}" as your PRIMARY search key to find relevant sections
- Cross-reference information between PDF and web sources when both available
- PDF sources often contain detailed specs not found on websites - PRIORITIZE THEM
- Web sources may have updated or additional information - CHECK BOTH
- Extract data from ANY source that contains the needed property

PROPERTIES TO EXTRACT (${requiredProperties?.length || 0} TOTAL - EXTRACT ALL POSSIBLE):
${requiredProperties?.map((p, i) => {
  let line = `${i + 1}. "${p.name}"`;
  if (p.description) line += ` - ${p.description}`;
  if (p.expectedFormat) line += ` [Expected: ${p.expectedFormat}]`;
  return line;
}).join('\n')}

===== COMPREHENSIVE EXTRACTION RULES =====

1. STRICT DATA VALIDATION:
   - Extract ONLY values explicitly found in the provided content
   - If a value doesn't exist after thorough search, respond with empty string ""
   - NEVER invent data or use estimates
   - Use property descriptions to understand what each property means

2. AGGRESSIVE MULTI-PASS SEARCH STRATEGY:
   PASS 1: Search for "${productName}" and extract ALL technical data near it
   PASS 2: Search for article number "${articleNumber}" if provided
   PASS 3: Search for each property name in German, English, Italian, French
   PASS 4: Search for property synonyms and abbreviations
   PASS 5: Search for numerical patterns with appropriate units
   
   For EACH property, try ALL these search patterns:
   - Exact property name match
   - German synonyms: Breite/Width, Höhe/Height, Tiefe/Depth, Gewicht/Weight
   - Italian terms: Larghezza, Altezza, Profondità, Peso, Potenza, Efficienza
   - French terms: Largeur, Hauteur, Profondeur, Poids, Puissance, Efficacité
   - Abbreviations: B x H x T, L x W x D, mm, cm, kg, kW, %

3. INTELLIGENT PROPERTY MATCHING:
   - Use property descriptions to disambiguate between similar values
   - For Bauart: CRITICAL SYNONYM MAPPING:
     * "Mehrfachbelegung: ja" OR "Selbstschließende Tür: ja" → extract "1"
     * "Mehrfachbelegung: nein" OR "Selbstschließende Tür: nein" → extract "2"
     * "Bauart: 1" → extract "1", "Bauart: 2" → extract "2"
   - For measurements: Convert units when needed (cm→mm multiply by 10)
   - For dimensions "550x1200x573" → extract individual values for Breite, Höhe, Tiefe

4. COMPREHENSIVE MULTILINGUAL EXTRACTION WITH GERMAN OUTPUT:
   - Extract values from ALL available languages - never skip content because it's in a different language
   - Language-specific technical terms to search:
     * German: Gewicht, Breite, Höhe, Tiefe, Leistung, Wirkungsgrad, Brennstoff
     * English: Weight, Width, Height, Depth, Power, Efficiency, Fuel
     * Italian: Peso, Larghezza, Altezza, Profondità, Potenza, Efficienza, Combustibile
     * French: Poids, Largeur, Hauteur, Profondeur, Puissance, Efficacité, Combustible
   - CRITICAL TRANSLATION: ALL OUTPUT MUST BE IN GERMAN
     * "Black/Nero/Noir" → "Schwarz", "Steel/Acciaio/Acier" → "Stahl"
     * "Automatic/Automatico" → "Automatisch", "Pellets/Granulés" → "Pellet"
     * Keep numerical values: "3-9 kW", "550 mm", "94.3%"

5. CONTEXTUAL EXTRACTION FROM SENTENCES:
   - "Der Ofen hat eine Breite von 55cm" → Breite: "550" (converted to mm)
   - "suitable for rooms up to 120m²" → extract "120"
   - "Leistungsbereich zwischen 3 und 9 kW" → "3-9"
   - "Abmessungen (BxHxT): 465 x 1090 x 465" → Extract ALL three dimensions
   - "Peso: circa 142 kg" → Gewicht: "142"
   - "Rendimento: 94,3%" → Wirkungsgrad: "94.3"
   - Look for values in parentheses, brackets, after colons, equals signs
   - Extract from image captions, footnotes, headers, margins

===== SOURCE ATTRIBUTION AND CONSISTENCY =====
- For EACH property, search ALL ${sources.length} sources
- Track which source(s) contain each value using 1-based source indices
- Source 1 might be PDF, Source 2 might be Web - identify correctly
- CONSISTENCY TRACKING (CRITICAL):
  * "isConsistent": true ONLY if EXACT SAME value appears in 2+ sources
  * "consistencyCount": Count how many sources contain this EXACT value
  * PDF + Web agreement = HIGH confidence
- IMPORTANT: Even if a value is found in only 1 source (e.g., only in PDF), still extract it!

JSON OUTPUT FORMAT (source indices are 1-based):
{
  "${requiredProperties?.[0]?.name || 'Property1'}": {
    "value": "extracted_value_or_empty",
    "sources": [1, 3, 5],
    "consistencyCount": 3,
    "isConsistent": true
  }${requiredProperties && requiredProperties.length > 1 ? ',' : ''}
  ${requiredProperties?.slice(1).map(p => `"${p.name}": {...}`).join(',\n  ') || ''}
}

CRITICAL SUCCESS MANDATE:
- Use "${productName}" as search key to find relevant product sections
- Search ALL ${sources.length} sources exhaustively
- PDF content contains valuable data - EXTRACT IT
- Extract MAXIMUM possible properties - empty fields should be rare
- Only return "" (empty) after thorough search of ALL sources in ALL languages`;

    // Prepare content from all sources with cleaned titles and proper labeling
    const consolidatedContent = sources.map((source, index) => {
      const cleanTitle = this.cleanPageTitle(source.title);
      const isPdfSource = source.url === 'PDF_SOURCE' || source.title?.includes('.pdf') || source.pdfFiles;
      const sourceType = isPdfSource ? 'PDF DOCUMENT' : 'WEB PAGE';
      const pdfInfo = source.pdfFiles ? `\n[PDF FILES: ${source.pdfFiles.map(p => p.name).join(', ')}]` : '';
      
      return `\n======= SOURCE ${index + 1} - ${sourceType} =======
[URL: ${source.url}]
[TITLE: ${cleanTitle}]${pdfInfo}
[CONTENT START]
${this.cleanHtmlContent(source.content)}
[CONTENT END]
======= END SOURCE ${index + 1} =======`;
    }).join('\n\n');

    const userPrompt = `PRODUCT IDENTIFICATION:
- Article Number: "${articleNumber}"
- Product Name: "${productName}" (USE THIS AS YOUR PRIMARY SEARCH KEY!)

EXTRACTION TASK:
Extract all ${requiredProperties?.length || 0} properties for "${productName}" from these ${sources.length} sources.

CRITICAL INSTRUCTIONS:
1. First, search for "${productName}" in ALL sources to locate product-specific data
2. Extract technical specifications found near the product name mention
3. For EACH property, search ALL ${sources.length} sources systematically
4. Track which source(s) contain each value using source indices [1, 2, etc.]
5. PDF sources often have detailed specs - search them thoroughly!

SOURCES TO ANALYZE:
${consolidatedContent}

REMINDER: Search for "${productName}" first, then extract ALL available technical properties. PDF content is valuable - don't skip it!`;

    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const startTime = Date.now();
      
      // Log AI operation start
      MonitoringLogger.info(
        `Starting batch extraction from ${sources.length} sources for article ${articleNumber}`,
        'ai',
        { userId: userId || undefined, metadata: { articleNumber, productName, sourceCount: sources.length, propertyCount: requiredProperties?.length } }
      ).catch(() => {});

      const completion = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const duration = Date.now() - startTime;
      const responseContent = completion.choices[0].message.content || "{}";
      
      // Track token usage with per-user tracking
      if (completion.usage) {
        const inputTokens = completion.usage.prompt_tokens || 0;
        const outputTokens = completion.usage.completion_tokens || 0;
        console.log(`[OPTIMIZED] Token usage: ${inputTokens} input + ${outputTokens} output tokens for user ${userId || 'system'}`);
        
        // Import TokenTracker for accurate cost calculation
        const { TokenTracker } = await import('./tokenTracker');
        
        // Calculate accurate costs using TokenTracker's pricing
        const costs = TokenTracker.calculateCost(selectedModel, inputTokens, outputTokens);
        console.log(`[OPTIMIZED] Cost breakdown: input=$${costs.inputCost}, output=$${costs.outputCost}, total=$${costs.totalCost}`);
        
        // Log detailed AI API call to monitoring system if user is authenticated
        if (userId) {
          try {
            await MonitoringLogger.logAiApiCall({
              userId,
              username: `user_${userId}`, // Will be resolved by monitoring system
              articleNumber,
              productName,
              provider: 'openai',
              modelName: selectedModel,
              apiCallType: 'extraction',
              systemPrompt: systemPrompt.substring(0, 3000), // Truncate for storage
              userPrompt: userPrompt.substring(0, 5000), // Truncate for storage
              rawResponse: responseContent.substring(0, 10000), // Truncate for storage
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              cost: costs.totalCost,
              inputCost: costs.inputCost,
              outputCost: costs.outputCost,
              responseTime: duration,
              success: true,
            });
            console.log(`[MONITORING] Logged AI API call for batch extraction: ${productName} (${inputTokens + outputTokens} tokens, $${costs.totalCost})`);
          } catch (monitoringError) {
            console.error('[MONITORING] Failed to log AI API call:', monitoringError);
          }
        }
        
        // Also track via TokenTracker for main app's token_usage table
        try {
          await TokenTracker.trackOpenAIUsage(userId || null, selectedModel, inputTokens, outputTokens, "batch-extract");
        } catch (tokenError) {
          console.error("[OPTIMIZED] Error tracking token usage:", tokenError);
        }
      }
      
      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const extractedData = JSON.parse(response);
      
      // Convert to PropertyResult format with consistency analysis
      const results: Record<string, PropertyResult> = {};
      
      // Process all required properties to ensure they all appear in output
      if (requiredProperties && requiredProperties.length > 0) {
        for (const prop of requiredProperties) {
          const propName = prop.name;
          const data = extractedData[propName];
          
          if (data) {
            const sourceIndices = data.sources || [];
            const consistencyCount = data.consistencyCount || sourceIndices.length || 1;
            const isConsistent = data.isConsistent !== undefined ? data.isConsistent : (consistencyCount >= 2);
            
            // Map source indices to actual source objects
            const mappedSources = sourceIndices.map((idx: number) => {
              const actualSource = sources[idx - 1]; // Convert 1-based to 0-based
              return {
                url: actualSource?.url || `Source ${idx}`,
                title: actualSource?.title || `Web Page ${idx}`,
                sourceLabel: `Source ${idx}`
              };
            });
            
            results[propName] = {
              name: propName,
              value: data.value || "",
              confidence: consistencyCount >= 2 ? Math.min(95, 60 + (consistencyCount * 10)) : (sourceIndices.length > 0 ? 30 : 0),
              isConsistent: isConsistent,
              consistencyCount: consistencyCount,
              sourceCount: sources.length,
              sources: mappedSources
            };
          } else {
            // Property not found in any source
            results[propName] = {
              name: propName,
              value: "",
              confidence: 0,
              isConsistent: false,
              consistencyCount: 0,
              sourceCount: sources.length,
              sources: []
            };
          }
        }
      } else {
        // Fallback: process whatever properties were extracted
        for (const [propName, data] of Object.entries(extractedData as Record<string, any>)) {
          const sourceIndices = (data as any).sources || [];
          const consistencyCount = (data as any).consistencyCount || sourceIndices.length || 1;
          
          results[propName] = {
            name: propName,
            value: (data as any).value || "",
            confidence: sourceIndices.length > 0 ? Math.min(100, sourceIndices.length * 30) : 0,
            isConsistent: consistencyCount >= 2,
            consistencyCount: consistencyCount,
            sourceCount: sources.length,
            sources: sourceIndices.map((idx: number) => ({
              url: sources[idx - 1]?.url || `Source ${idx}`,
              title: sources[idx - 1]?.title || `Web Page ${idx}`,
              sourceLabel: `Source ${idx}`
            }))
          };
        }
      }
      
      // Add article number
      results["Artikelnummer"] = {
        name: "Artikelnummer",
        value: articleNumber,
        confidence: 100,
        isConsistent: true,
        consistencyCount: sources.length,
        sourceCount: sources.length,
        sources: []
      };
      
      return results;
      
    } catch (error) {
      console.error('Batch extraction error:', error);
      
      // Log error to monitoring
      MonitoringLogger.error(
        `AI batch extraction failed for article ${articleNumber}: ${(error as Error).message}`,
        error as Error,
        'ai',
        { userId: userId || undefined, metadata: { articleNumber, productName, sourceCount: sources.length } }
      ).catch(() => {});
      
      throw error;
    }
  }

  private cleanHtmlContent(html: string): string {
    // Remove scripts and styles but preserve content
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove HTML tags but keep content
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    
    // Clean up whitespace more efficiently
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // INCREASED: Use larger content chunks to capture all data from each source
    // This matches the main service's approach for better data extraction
    const MAX_CHARS = 150000; // Increased from 15k to 150k to match main service
    if (cleaned.length > MAX_CHARS) {
      // Try to keep the most relevant parts with technical specifications
      const parts = cleaned.split(/\b(specifications?|technical|data|features?|eigenschaften|technische daten|spezifikationen|abmessungen|dimensions|gewicht|weight|leistung|power)\b/i);
      if (parts.length > 1) {
        // Keep content around technical keywords - use more content
        cleaned = parts.slice(1, 5).join(' ').substring(0, MAX_CHARS);
      } else {
        cleaned = cleaned.substring(0, MAX_CHARS);
      }
    }
    
    return cleaned;
  }

  // Quick validation using simple pattern matching (no AI needed)
  validateSourcesQuick(
    sources: Array<{content: string, url: string, title: string}>,
    articleNumber: string,
    productName: string
  ): Array<{content: string, url: string, title: string, score: number}> {
    const validated = sources.map(source => {
      let score = 0;
      const content = source.content.toLowerCase();
      const url = source.url.toLowerCase();
      const title = source.title.toLowerCase();
      
      // Check article number
      if (articleNumber && content.includes(articleNumber.toLowerCase())) {
        score += 50;
      }
      
      // Check product name
      if (content.includes(productName.toLowerCase())) {
        score += 40;
      } else {
        // Check individual words
        const words = productName.toLowerCase().split(/\s+/);
        const matchedWords = words.filter(w => content.includes(w)).length;
        score += (matchedWords / words.length) * 30;
      }
      
      // URL/title bonus
      if (url.includes(articleNumber.toLowerCase()) || title.includes(articleNumber.toLowerCase())) {
        score += 10;
      }
      if (url.includes(productName.toLowerCase()) || title.includes(productName.toLowerCase())) {
        score += 10;
      }
      
      return { ...source, score };
    });
    
    // Sort by score and return all (let the user's maxResults setting control the limit)
    return validated.sort((a, b) => b.score - a.score);
  }
}

export const optimizedOpenaiService = new OptimizedOpenAIService();