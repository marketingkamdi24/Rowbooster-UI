import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import RawContentViewer from "@/components/RawContentViewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit2,
  FileDown,
  FileText,
  AlertCircle,
  Info,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  Trash2,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchResponse, PropertyResult, ProductResult, SearchRequest } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ProductProperty } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { ResultsTable } from "./ResultsTable";

interface ResultsSectionProps {
  searchResult: SearchResponse | null;
  allSearchResults?: SearchResponse[];
  onExport: (selectedProduct?: ProductResult | null) => void;
  onDeleteResult?: (id?: number | string) => void;
  onSearchResult?: (result: SearchResponse, sourceTab?: string) => void;
  isPdfMode?: boolean;
  isSearching?: boolean;
  // Add AI configuration props
  useAI?: boolean;
  modelProvider?: string;
  openaiApiKey?: string;
  maxResults?: number;
}

export default function ResultsSection({
  searchResult,
  allSearchResults = [],
  onExport,
  onDeleteResult,
  onSearchResult,
  isPdfMode = false,
  isSearching = false,
  useAI = true,
  modelProvider = 'openai',
  openaiApiKey = '',
  maxResults = 10
}: ResultsSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [allProperties, setAllProperties] = useState<Record<string, PropertyResult>>({});
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isRawContentViewerOpen, setIsRawContentViewerOpen] = useState(false);
  const [isDownloadingAIContent, setIsDownloadingAIContent] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(true);
  const [showAllSources, setShowAllSources] = useState(false);
  const [isProductsExpanded, setIsProductsExpanded] = useState(false);


  // Fetch all defined properties
  const { data: properties } = useQuery<ProductProperty[]>({
    queryKey: ["/api/properties"],
  });

  // Update selected product when results change or index changes
  useEffect(() => {
    if (!searchResult || !searchResult.products || searchResult.products.length === 0) {
      setSelectedProduct(null);
      setIsExpanded(false);
      return;
    }
    
    // Auto-expand when search results appear
    setIsExpanded(true);
    
    // Ensure index is valid
    const validIndex = Math.min(selectedProductIndex, searchResult.products.length - 1);
    setSelectedProductIndex(validIndex);
    setSelectedProduct(searchResult.products[validIndex]);
  }, [searchResult, selectedProductIndex]);

  // Process search results to include all properties (even if not found)
  // IMPORTANT: Maintain exact order from database to preserve column order
  useEffect(() => {
    if (!selectedProduct || !properties) return;

    const result: Record<string, PropertyResult> = {};
    
    // Always ensure Artikelnummer and Produktname are direct from user input
    // Add Artikelnummer directly from user input
    result["Artikelnummer"] = {
      name: "Artikelnummer",
      value: selectedProduct.articleNumber || "",
      sources: [],
      confidence: 100, // 100% confidence as this is user input
      isConsistent: true
    };
    
    // Add Produktname directly from user input
    result["ArtikelName"] = {
      name: "ArtikelName",
      value: selectedProduct.productName,
      sources: [],
      confidence: 100, // 100% confidence as this is user input
      isConsistent: true
    };
    
    // Process properties in the EXACT order defined in the database to preserve column order
    properties.forEach(property => {
      if (property.name === "Artikelnummer" || property.name === "ArtikelName") {
        // Skip these as they were already set directly from user input above
        return;
      }
      
      // Check if this property exists in the selected product
      if (selectedProduct.properties && selectedProduct.properties[property.name]) {
        result[property.name] = selectedProduct.properties[property.name];
      } else {
        // Create an empty property result if not found
        result[property.name] = {
          name: property.name,
          value: "Not found",
          sources: [],
          confidence: 0
        };
      }
    });
    
    setAllProperties(result);
  }, [selectedProduct, properties, searchResult]); // Added searchResult as dependency to ensure updates



  const handleEdit = (propertyName: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [propertyName]: value,
    }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "bg-green-500";
    if (confidence >= 70) return "bg-yellow-500";
    if (confidence >= 30) return "bg-orange-500";
    return "bg-red-300";
  };
  
  const getConsistencyDotColor = (hasValue: boolean, isAutomatedMode: boolean, consistencyCount?: number) => {
    if (isAutomatedMode && hasValue) {
      const count = consistencyCount || 1;
      if (count >= 3) {
        return "bg-green-500";
      } else if (count === 2) {
        return "bg-lime-500";
      } else {
        return "bg-yellow-500";
      }
    }
    return 'bg-gray-300'; // Gray for empty or unknown values
  };
  
  // Check if the current search result is just initial results waiting for AI analysis
  const isInitialSearchResult = (): boolean => {
    if (!searchResult) return false;
    
    // Check for search status indicators
    return searchResult.searchStatus === 'searching' || 
           (searchResult.statusMessage?.includes('Step 1/2') || 
           searchResult.statusMessage?.includes('Click \'Analyze Content\'')) ||
           (searchResult.products[0]?.properties?.__search_status !== undefined) ||
           (Object.keys(searchResult.products[0]?.properties || {}).length === 1 && 
            searchResult.products[0]?.properties?.__meta_sources !== undefined);
  };
  
  // Mutation for triggering content analysis after initial search
  const analyzeContentMutation = useMutation({
    mutationFn: async () => {
      if (!searchResult || !searchResult.products || searchResult.products.length === 0) {
        return null;
      }
      
      // Get the product data
      const product = searchResult.products[selectedProductIndex];
      
      // Get the original search sources from the meta property
      const originalSources = product.properties?.["__meta_sources"]?.sources || [];
      
      // Prepare the analysis request with all required AI configuration
      const analysisRequest: SearchRequest = {
        searchMethod: (searchResult.searchMethod as "auto" | "url" | "pdf") || "auto",
        articleNumber: product.articleNumber,
        productName: product.productName,
        properties: properties?.map(p => ({ 
          id: p.id, 
          name: p.name, 
          description: p.description || undefined, 
          expectedFormat: p.expectedFormat || undefined
        })) || [],
        sources: originalSources, // Pass the original search sources
        useAI,
        aiModelProvider: useAI ? "openai" : undefined,
        openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
        searchEngine: "google",
        maxResults
      };
      
      // Call the analysis endpoint
      const response = await apiRequest("POST", "/api/analyze-content", analysisRequest);
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      console.log("🔍 Analyze content response received:", data);
      console.log("🔍 Products in response:", data?.products?.length);
      console.log("🔍 Properties in first product:", data?.products?.[0]?.properties ? Object.keys(data.products[0].properties).length : 0);
      
      // Log sample properties
      if (data?.products?.[0]?.properties) {
        const sampleProps = Object.entries(data.products[0].properties).slice(0, 5);
        console.log("🔍 Sample properties from response:");
        sampleProps.forEach(([key, prop]: [string, any]) => {
          console.log(`  ${key}: "${prop.value}" (${prop.sources?.length || 0} sources)`);
        });
      }
      
      if (data && onSearchResult) {
        // Preserve original sources from the initial search result
        const originalSources = searchResult?.products[0]?.properties["__meta_sources"]?.sources || [];
        
        // If we have original sources and the AI response doesn't have them, preserve them
        if (originalSources.length > 0 && data.products[0]?.properties) {
          // Ensure the __meta_sources property is preserved in the AI response
          if (!data.products[0].properties["__meta_sources"]?.sources || data.products[0].properties["__meta_sources"].sources.length === 0) {
            data.products[0].properties["__meta_sources"] = {
              name: "__meta_sources",
              value: "Found Web Pages",
              sources: originalSources,
              confidence: 100,
              isConsistent: true
            };
          }
        }
        
        onSearchResult(data);
        toast({
          title: "Analyse abgeschlossen",
          description: "Technische Daten wurden erfolgreich extrahiert und verarbeitet.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analyse fehlgeschlagen",
        description: (error as Error).message || "Inhaltsanalyse fehlgeschlagen",
        variant: "destructive",
      });
    }
  });

  const formatSearchMethod = (method: string) => {
    switch (method) {
      case "auto": return "Automatisiert";
      case "domain": return "Domain";
      case "url": return "Produkt-URL";
      default: return method;
    }
  };

  // Handle deleting a specific product
  const handleDeleteProduct = (productIndex: number) => {
    if (!searchResult || !searchResult.products) return;
    
    // If it's the only product, delete the entire search result
    if (searchResult.products.length === 1) {
      onDeleteResult && onDeleteResult();
      return;
    }
    
    // Otherwise, filter out this product and update the state in the parent component
    const updatedProducts = searchResult.products.filter((_, index) => index !== productIndex);
    const updatedSearchResult: SearchResponse = {
      ...searchResult,
      products: updatedProducts
    };
    
    // Select another product if the current one is being deleted
    if (productIndex === selectedProductIndex) {
      const newIndex = productIndex > 0 ? productIndex - 1 : 0;
      setSelectedProductIndex(newIndex);
    }
    
    // Update the search result through the callback
    onDeleteResult && onDeleteResult();
  };
  
  // Function to download the raw AI content
  const handleDownloadAIContent = async () => {
    if (!selectedProduct) return;
    
    try {
      setIsDownloadingAIContent(true);
      
      // Validate that we have at least a product name
      if (!selectedProduct.productName || selectedProduct.productName.trim() === '') {
        toast({
          title: "Download fehlgeschlagen",
          description: "Produktname ist für den Inhalts-Download erforderlich",
          variant: "destructive",
        });
        return;
      }

      // Prepare the request
      const requestData = {
        articleNumber: selectedProduct.articleNumber || "",
        productName: selectedProduct.productName
      };
      
      console.log('Downloading AI content for:', requestData);
      
      // Call the API to get the raw content
      const response = await fetch('/api/get-ai-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch AI content');
      }
      
      // Get the content as text
      const contentText = await response.text();
      
      // Create a Blob from the content
      const blob = new Blob([contentText], { type: 'text/plain' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = selectedProduct.articleNumber 
        ? `ai-content-${selectedProduct.articleNumber}.txt`
        : `ai-content-${selectedProduct.productName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      a.download = filename;
      
      // Trigger the download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download abgeschlossen",
        description: "Der KI-Inhalt wurde erfolgreich heruntergeladen.",
      });
    } catch (error) {
      console.error('Error downloading AI content:', error);
      toast({
        title: "Download fehlgeschlagen",
        description: (error as Error).message || "KI-Inhalt konnte nicht heruntergeladen werden",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAIContent(false);
    }
  };


  return (
    <div className={`transition-all duration-300 ${
      isFullscreen
        ? 'fixed inset-0 z-50 bg-white overflow-y-auto'
        : 'relative'
    }`}>
      {/* Content Section - Removed extra nested frames - Mobile Optimized */}
      <div className={`transition-all duration-300 ${isExpanded ? 'p-2 sm:p-4' : 'p-2 sm:p-3'}`}>
          {/* Raw Content Viewer Component */}
          <RawContentViewer
            isOpen={isRawContentViewerOpen}
            onClose={() => setIsRawContentViewerOpen(false)}
            searchResult={searchResult}
          />
          
          {/* Show empty state when no search has been performed - Modern Glass Design - Mobile Optimized */}
          {!searchResult ? (
            <div className="py-2">
              <div className="relative overflow-hidden rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]">
                {/* Subtle ambient glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--rb-cyan)]/[0.03] to-transparent pointer-events-none" />
                
                {/* Clean content - Mobile Optimized */}
                <div className="relative px-4 sm:px-6 py-5 sm:py-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-center sm:text-left">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[color:var(--rb-cyan)]/20 to-[color:var(--rb-cyan)]/5 flex items-center justify-center">
                    <Info className="h-5 w-5 sm:h-6 sm:w-6 text-[color:var(--rb-cyan)]/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-white/90">Bereit für die Suche</p>
                    <p className="text-xs sm:text-sm text-white/40 mt-1">Produktnamen eingeben oder Datei hochladen</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-[10px] sm:text-xs font-medium text-[color:var(--rb-cyan)]/60 bg-[color:var(--rb-cyan)]/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">Wartend</span>
                  </div>
                </div>
                
                {/* Faded bottom edge */}
                <div className="h-1 bg-gradient-to-r from-transparent via-[color:rgba(23,195,206,0.3)] to-transparent" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Product Selector - Only show if multiple products - Dark Theme - Mobile Optimized */}
              {searchResult.products && searchResult.products.length > 1 && (
                <div className="rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                    <h3 className="text-sm sm:text-base font-semibold text-white/90">Produkte ({searchResult.products.length})</h3>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm text-white/50">
                        {selectedProductIndex + 1} / {searchResult.products.length}
                      </span>
                      {searchResult.products.length > 2 && (
                        <button
                          onClick={() => setIsProductsExpanded(!isProductsExpanded)}
                          className="text-[color:var(--rb-cyan)] hover:text-[color:var(--rb-lime)] text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                          {isProductsExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Weniger anzeigen
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Alle {searchResult.products.length} anzeigen
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(isProductsExpanded ? searchResult.products : searchResult.products.slice(0, 2)).map((product, displayIndex) => {
                      const actualIndex = isProductsExpanded ? displayIndex : displayIndex;
                      const originalIndex = searchResult.products.findIndex(p => p.id === product.id);
                      return (
                        <div key={product.id} className="relative group">
                          <button
                            className={`w-full text-left rounded-lg p-3 transition-all duration-200 ${
                              selectedProductIndex === originalIndex 
                                ? 'bg-[color:var(--rb-cyan)]/20 border border-[color:var(--rb-cyan)]/40 text-white' 
                                : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white'
                            }`}
                            onClick={() => setSelectedProductIndex(originalIndex)}
                          >
                            <div className="flex flex-col">
                              <div className="font-medium text-sm">{product.articleNumber}</div>
                              <div className="text-xs opacity-70 truncate">
                                {product.productName}
                              </div>
                            </div>
                          </button>
                          <button
                            className="absolute -top-1 -right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500"
                            onClick={() => handleDeleteProduct(originalIndex)}
                            title="Dieses Produkt löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Product Info Header with Search Results - Dark Theme Glass Design */}
              {searchResult && searchResult.products[0] && !isPdfMode && (
                <div className="rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-gradient-to-b from-[color:var(--rb-lime)] to-[color:var(--rb-cyan)] rounded-full"></div>
                        <h2 className="text-sm font-semibold text-white">
                          {searchResult?.searchMethod === 'url' ? 'Extraktionsergebnisse' : 'Suchergebnisse'}
                        </h2>
                        <span className="text-white/30">•</span>
                        <span className="text-xs text-white/60 font-medium">
                          {formatSearchMethod(searchResult.searchMethod)}
                        </span>
                        {searchResult.searchMethod === "auto" && searchResult.minConsistentSources && (
                          <>
                            <span className="text-white/30">•</span>
                            <span className="text-xs text-[color:var(--rb-cyan)]">
                              {searchResult.minConsistentSources} Quellen
                            </span>
                          </>
                        )}
                        {/* Status Badge - Dark Theme */}
                        {searchResult?.searchStatus === 'searching' && (
                          <span className="inline-flex items-center text-xs font-medium text-[color:var(--rb-cyan)] bg-[color:var(--rb-cyan)]/10 px-2.5 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 bg-[color:var(--rb-cyan)] rounded-full animate-pulse mr-1.5"></div>
                            Suche läuft
                          </span>
                        )}
                        {searchResult?.searchStatus === 'analyzing' && (
                          <span className="inline-flex items-center text-xs font-medium text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse mr-1.5"></div>
                            Analysiert
                          </span>
                        )}
                        {searchResult?.searchStatus === 'complete' && (
                          <span className="inline-flex items-center text-xs font-medium text-[color:var(--rb-lime)] bg-[color:var(--rb-lime)]/10 px-2.5 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Abgeschlossen
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons - Dark Theme */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-8 w-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-8 w-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
                      >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Product Information - Dark Theme */}
                  <div className="mb-3">
                    <h3 className="font-medium text-sm text-white/80">
                      - {searchResult.products[0].productName}
                    </h3>
                  </div>
                  
                  {/* Sources section - Dark Theme */}
                  {searchResult.searchMethod !== 'url' && searchResult.searchMethod !== 'pdf' && !isPdfMode && (
                    <Collapsible open={isSourcesExpanded} onOpenChange={setIsSourcesExpanded}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                          <ExternalLink className="h-4 w-4" />
                          <span className="text-sm font-medium">Verwendete Quellen</span>
                          {isSourcesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(() => {
                            if (searchResult.products[0]?.properties?.["__meta_sources"]?.sources) {
                              const sources = searchResult.products[0].properties["__meta_sources"].sources;
                              const displaySources = showAllSources ? sources : sources.slice(0, 4);
                              
                              return (
                                <>
                                  {displaySources.map((source, index) => (
                                    <a 
                                      key={index} 
                                      href={source.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-[color:var(--rb-cyan)]/30 transition-all cursor-pointer group"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="w-2 h-2 bg-[color:var(--rb-cyan)] rounded-full mr-2.5 flex-shrink-0"></div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-white/90 truncate group-hover:text-[color:var(--rb-cyan)]">
                                          {source.title || `Quelle ${index + 1}`}
                                        </div>
                                        <div className="text-xs text-white/40 truncate">
                                          {source.url?.replace(/^https?:\/\//, '').replace(/^www\./, '') || 'Keine URL verfügbar'}
                                        </div>
                                      </div>
                                      <ExternalLink className="h-3.5 w-3.5 text-white/40 group-hover:text-[color:var(--rb-cyan)] ml-2" />
                                    </a>
                                  ))}
                                  
                                  {sources.length > 4 && (
                                    <div className="col-span-full flex justify-center mt-3">
                                      <button
                                        onClick={() => setShowAllSources(!showAllSources)}
                                        className="text-[color:var(--rb-cyan)] hover:text-[color:var(--rb-lime)] text-xs font-medium flex items-center gap-1 transition-colors"
                                      >
                                        {showAllSources ? (
                                          <>
                                            <ChevronUp className="h-3 w-3" />
                                            Weniger anzeigen
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="h-3 w-3" />
                                            Alle {sources.length} Quellen anzeigen
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </>
                              );
                            } else if (isSearching) {
                              return (
                                <div className="col-span-full text-center py-8">
                                  <div className="flex flex-col items-center gap-4">
                                    {/* Modern Dark Theme Search Animation */}
                                    <div className="relative w-14 h-14">
                                      <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
                                      <div className="absolute inset-0 rounded-full border-2 border-[color:var(--rb-cyan)] border-t-transparent animate-spin"></div>
                                      <div className="absolute inset-2 rounded-full border-2 border-white/5"></div>
                                      <div className="absolute inset-2 rounded-full border-2 border-[color:var(--rb-lime)] border-t-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                                      <div className="absolute inset-5 rounded-full bg-gradient-to-r from-[color:var(--rb-cyan)]/50 to-[color:var(--rb-lime)]/50 animate-pulse"></div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 bg-[color:var(--rb-cyan)] rounded-full animate-bounce"></div>
                                      <div className="w-1.5 h-1.5 bg-[color:var(--rb-lime)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                      <div className="w-1.5 h-1.5 bg-[color:var(--rb-cyan)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                    
                                    <div className="text-sm text-[color:var(--rb-cyan)] font-medium">Durchsuche Internet nach Produktdaten...</div>
                                    <div className="text-xs text-white/40">Bitte warten, dies kann einen Moment dauern</div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="col-span-full text-center py-6 text-white/40">
                                  <div className="text-sm">Keine Quellen verfügbar</div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  
                </div>
              )}
              
              {/* New Prototype-Style Results Table */}
              {properties && (
                <div className="mt-4">
                  <ResultsTable
                    searchResult={searchResult}
                    allSearchResults={allSearchResults}
                    properties={properties}
                    isPdfMode={isPdfMode}
                    onExport={() => {
                      const productsToExport = isPdfMode && allSearchResults?.length > 0 
                        ? allSearchResults.flatMap(result => result.products || [])
                        : searchResult?.products || [];
                      
                      const tableProperties = properties?.filter(property => 
                        !property.name.startsWith('__') && 
                        property.name !== 'Artikelnummer' && 
                        property.name !== 'ArtikelName'
                      ) || [];
                      
                      const exportData = {
                        searchResult: {
                          ...searchResult,
                          products: productsToExport.map(product => ({
                            ...product,
                            productName: product.productName || 'N/A'
                          }))
                        },
                        format: 'xlsx' as const,
                        includeProductData: true,
                        includeSourceUrls: false,
                        includeConfidenceScores: false,
                        filename: `product_data_${new Date().toISOString().split('T')[0]}`,
                        properties: tableProperties.map(p => ({
                          name: p.name,
                          orderIndex: p.orderIndex ?? undefined
                        }))
                      };
                      
                      import('@/lib/utils/exportData').then(({ exportToFile }) => {
                        exportToFile(exportData);
                      });
                    }}
                  />
                </div>
              )}
              
              {/* Scraped Data Section - After Table */}
              {searchResult && searchResult.searchMethod === 'auto' && searchResult.rawContent && searchResult.rawContent.length > 0 && (
                <div className="mt-6">
                  <Collapsible defaultOpen={false}>
                    <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[color:var(--rb-cyan)]" />
                            <h4 className="text-sm font-medium text-white">
                              Gescrapte Daten ({searchResult.rawContent.length} Quellen)
                            </h4>
                          </div>
                          <ChevronDown className="h-4 w-4 text-white/60 transition-transform" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
                          {searchResult.rawContent.map((content, index) => (
                            <div key={index} className="border border-white/[0.06] rounded-lg overflow-hidden">
                              <div className="bg-white/[0.02] px-3 py-2 border-b border-white/[0.06]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[color:var(--rb-cyan)] rounded-full"></div>
                                    <span className="text-xs font-medium text-white/80">
                                      {content.sourceLabel || `Quelle ${index + 1}`}
                                    </span>
                                    {content.url && (
                                      <>
                                        <span className="text-white/30">•</span>
                                        <a
                                          href={content.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-[color:var(--rb-cyan)] hover:text-[color:var(--rb-lime)] hover:underline flex items-center gap-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {content.title || new URL(content.url).hostname}
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </>
                                    )}
                                  </div>
                                  <span className="text-xs text-white/40">
                                    {Math.round((content.contentLength || 0) / 1024)}KB
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-white/[0.01]">
                                <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto bg-white/[0.02] p-3 rounded border border-white/[0.06]">
                                  {content.content.substring(0, 2000)}{content.content.length > 2000 ? '...\n\n[Inhalt gekürzt]' : ''}
                                </pre>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              )}
            </div>
        )}
      </div>
    </div>
  );
}
