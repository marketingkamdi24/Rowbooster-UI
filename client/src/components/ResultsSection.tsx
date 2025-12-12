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
      {/* Content Section - Removed extra nested frames */}
      <div className={`transition-all duration-300 ${isExpanded ? 'p-4' : 'p-3'}`}>
          {/* Raw Content Viewer Component */}
          <RawContentViewer
            isOpen={isRawContentViewerOpen}
            onClose={() => setIsRawContentViewerOpen(false)}
            searchResult={searchResult}
          />
          
          {/* Show empty state when no search has been performed - Compact dark blue faded table */}
          {!searchResult ? (
            <div className="py-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[color:var(--rb-primary-dark)] via-[color:rgba(12,36,67,0.95)] to-[color:rgba(12,36,67,0.85)] border border-[color:rgba(23,195,206,0.2)] shadow-[0_4px_20px_rgba(12,36,67,0.3)]">
                {/* Subtle glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[color:rgba(23,195,206,0.05)] to-transparent pointer-events-none" />
                
                {/* Mini table header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[color:rgba(23,195,206,0.15)] bg-[color:rgba(0,0,0,0.15)]">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-gradient-to-b from-[color:var(--rb-cyan)] to-[color:rgba(23,195,206,0.4)] rounded-full" />
                    <span className="text-xs font-semibold text-white/90">Suchergebnisse</span>
                  </div>
                  <span className="text-[10px] font-medium text-[color:var(--rb-cyan)]/70 bg-[color:rgba(23,195,206,0.1)] px-2 py-0.5 rounded-full">Wartend</span>
                </div>
                
                {/* Compact content */}
                <div className="px-4 py-4 flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[color:rgba(23,195,206,0.2)] to-[color:rgba(23,195,206,0.1)] flex items-center justify-center border border-[color:rgba(23,195,206,0.2)]">
                    <Info className="h-5 w-5 text-[color:var(--rb-cyan)]/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90">Bereit für die Suche</p>
                    <p className="text-xs text-white/50 mt-0.5">Geben Sie einen Produktnamen ein oder laden Sie eine Datei hoch</p>
                  </div>
                </div>
                
                {/* Faded bottom edge */}
                <div className="h-1 bg-gradient-to-r from-transparent via-[color:rgba(23,195,206,0.3)] to-transparent" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Product Selector - Only show if multiple products */}
              {searchResult.products && searchResult.products.length > 1 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Produkte ({searchResult.products.length})</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        Zeige {selectedProductIndex + 1} von {searchResult.products.length}
                      </span>
                      {searchResult.products.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsProductsExpanded(!isProductsExpanded)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center gap-1"
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
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(isProductsExpanded ? searchResult.products : searchResult.products.slice(0, 2)).map((product, displayIndex) => {
                      const actualIndex = isProductsExpanded ? displayIndex : displayIndex;
                      const originalIndex = searchResult.products.findIndex(p => p.id === product.id);
                      return (
                        <div key={product.id} className="relative group">
                          <Button
                            variant={selectedProductIndex === originalIndex ? "default" : "outline"}
                            size="sm"
                            className={`w-full justify-start text-left h-auto py-2 px-3 ${
                              selectedProductIndex === originalIndex 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedProductIndex(originalIndex)}
                          >
                            <div className="flex flex-col items-start">
                              <div className="font-medium text-sm">{product.articleNumber}</div>
                              <div className="text-xs opacity-80 truncate max-w-full">
                                {product.productName}
                              </div>
                            </div>
                          </Button>
                          <button
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md hover:bg-red-600"
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
              
              {/* Product Info Header with Search Results - Hide in PDF batch mode */}
              {searchResult && searchResult.products[0] && !isPdfMode && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                        <h2 className="text-base font-medium text-gray-900">
                          {searchResult?.searchMethod === 'url' ? 'Extraktionsergebnisse' : 'Suchergebnisse'}
                        </h2>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-600 font-medium">
                          {formatSearchMethod(searchResult.searchMethod)}
                        </span>
                        {searchResult.searchMethod === "auto" && searchResult.minConsistentSources && (
                          <>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-blue-600">
                              {searchResult.minConsistentSources} Quellen
                            </span>
                          </>
                        )}
                        {/* Status Badge */}
                        {searchResult?.searchStatus === 'searching' && (
                          <>
                            <span className="text-sm text-gray-500">•</span>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1"></div>
                              Suche läuft
                            </Badge>
                          </>
                        )}
                        {searchResult?.searchStatus === 'analyzing' && (
                          <>
                            <span className="text-sm text-gray-500">•</span>
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse mr-1"></div>
                              Analysiert
                            </Badge>
                          </>
                        )}
                        {searchResult?.searchStatus === 'complete' && (
                          <>
                            <span className="text-sm text-gray-500">•</span>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Abgeschlossen
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                      >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Product Information */}
                  <div className="mb-3">
                    <h3 className="font-medium text-sm text-gray-900">
                      {searchResult.products[0].articleNumber} - {searchResult.products[0].productName}
                    </h3>
                  </div>
                  
                  {/* Sources section */}
                  {searchResult.searchMethod !== 'url' && searchResult.searchMethod !== 'pdf' && !isPdfMode && (
                    <Collapsible open={isSourcesExpanded} onOpenChange={setIsSourcesExpanded}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Verwendete Quellen
                            {isSourcesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </h4>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(() => {
                            if (searchResult.products[0]?.properties?.["__meta_sources"]?.sources) {
                              const sources = searchResult.products[0].properties["__meta_sources"].sources;
                              const displaySources = showAllSources ? sources : sources.slice(0, 4); // Show only first 4 sources (2 rows)
                              
                              return (
                                <>
                                  {displaySources.map((source, index) => (
                                    <a 
                                      key={index} 
                                      href={source.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center p-1.5 bg-white rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-900 truncate hover:text-blue-600">
                                          {source.title || `Quelle ${index + 1}`}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {source.url?.replace(/^https?:\/\//, '').replace(/^www\./, '') || 'Keine URL verfügbar'}
                                        </div>
                                      </div>
                                      <ExternalLink className="h-4 w-4 text-blue-600 hover:text-blue-800 ml-2" />
                                    </a>
                                  ))}
                                  
                                  {/* Expand/Collapse Button */}
                                  {sources.length > 4 && (
                                    <div className="col-span-full flex justify-center mt-3">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowAllSources(!showAllSources)}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center gap-1 text-xs px-2 py-1"
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
                                      </Button>
                                    </div>
                                  )}
                                </>
                              );
                            } else if (isSearching) {
                              return (
                                <div className="col-span-full text-center py-8">
                                  <div className="flex flex-col items-center gap-4">
                                    {/* Modern Search Animation */}
                                    <div className="relative w-16 h-16">
                                      <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                                      <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                                      <div className="absolute inset-2 rounded-full border-4 border-purple-100"></div>
                                      <div className="absolute inset-2 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                                      <div className="absolute inset-4 rounded-full border-4 border-emerald-100"></div>
                                      <div className="absolute inset-4 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" style={{ animationDuration: '1.2s' }}></div>
                                      
                                      {/* Pulsing Center */}
                                      <div className="absolute inset-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                                    </div>
                                    
                                    {/* Animated Dots */}
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                    
                                    <div className="text-sm text-blue-600 font-medium">Durchsuche Internet nach Produktdaten...</div>
                                    <div className="text-xs text-gray-500">Bitte warten, dies kann einen Moment dauern</div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="col-span-full text-center py-8 text-gray-500">
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
              
              {/* Modern Horizontal Table */}

                {/* Enhanced Table with All Properties */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mt-6">
                  {/* Table Header with Actions */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse"></div>
                      <h3 className="text-sm font-medium text-gray-800">Technische Spezifikationen</h3>
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {searchResult?.products?.length || 0} Produkt{(searchResult?.products?.length || 0) !== 1 ? 'e' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Download AI Content Button - Hidden per user request
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 font-normal text-xs px-3 py-1"
                        onClick={handleDownloadAIContent}
                        disabled={isDownloadingAIContent || !selectedProduct}
                        title="Download parsed web content sent to AI model"
                      >
                        {isDownloadingAIContent ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Herunterladen...
                          </>
                        ) : (
                          <>
                            <FileText className="h-3 w-3 mr-1" />
                            Herunterladen
                          </>
                        )}
                      </Button>
                      */}

                      {/* Download Debug Data Button - Hidden per user request
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-normal text-xs px-3 py-1"
                        onClick={() => {
                          const dataToDownload = {
                            searchResult,
                            properties: allProperties,
                            timestamp: new Date().toISOString()
                          };
                          const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `debug-data-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Debug (JSON)
                      </Button>
                      */}
                      
                      {/* Export Button */}
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-normal text-xs px-3 py-1 shadow-md hover:shadow-lg"
                        onClick={() => {
                          // Export the exact table data
                          const productsToExport = isPdfMode && allSearchResults?.length > 0 
                            ? allSearchResults.flatMap(result => result.products || [])
                            : searchResult?.products || [];
                          
                          // Get all properties from the table (excluding internal ones)
                          const tableProperties = properties?.filter(property => 
                            !property.name.startsWith('__') && 
                            property.name !== 'Artikelnummer' && 
                            property.name !== 'ArtikelName'
                          ) || [];
                          
                          // Create export data matching the table structure
                          const exportData = {
                            searchResult: {
                              ...searchResult,
                              products: productsToExport.map(product => ({
                                ...product,
                                // Ensure the product name shown in the table is exported
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
                          
                          // Import and use the exportToFile function directly
                          import('@/lib/utils/exportData').then(({ exportToFile }) => {
                            exportToFile(exportData);
                          });
                        }}
                        disabled={!searchResult?.products || searchResult.products.length === 0}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Daten exportieren
                      </Button>
                    </div>
                  </div>

                  {/* Status Legend */}
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-6 text-xs text-gray-600">
                      <div className="font-medium text-gray-700">Bestätigte Quellen:</div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>1 Quelle</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-lime-500 rounded-full"></div>
                        <span>2 Quellen</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>3 oder mehr Quellen</span>
                      </div>
                      <span className="text-gray-400">|</span>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
                        <span>Nicht gefunden</span>
                      </div>
                    </div>
                  </div>

                  {/* Table with All Properties */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12 sticky left-0 z-20 bg-gradient-to-r from-gray-100 to-gray-50">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px] sticky left-12 z-20 bg-gradient-to-r from-gray-100 to-gray-50">
                            Verarbeitungsstatus
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">
                            Artikelnummer
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[160px]">
                            Eingegebener Produktname
                          </th>
                          {/* All Properties as Columns */}
                          {properties
                            ?.filter(property => !property.name.startsWith('__') &&
                                               property.name !== 'Artikelnummer' &&
                                               property.name !== 'ArtikelName')
                            .map((property, propIndex) => (
                              <th key={`header-${property.id || propIndex}-${property.name}`} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px] border-l border-gray-200">
                                <div className="flex items-center gap-2">
                                  <div className="truncate" title={property.name}>
                                    {property.name}
                                  </div>
                                  {property.description && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center cursor-help">
                                            <span className="text-xs text-gray-600">?</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs text-sm">{property.description}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {searchResult && searchResult.products && searchResult.products.length > 0 && (
                          // For PDF mode, show all products; otherwise show only selected product
                          isPdfMode ? (
                            searchResult.products.map((product, productIndex) => (
                              <tr key={product.id || productIndex} 
                                  className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-b border-gray-100 cursor-pointer transition-all duration-200" 
                                  onClick={() => {
                                    // Make entire row clickable to open the first available source
                                    const sources = product?.properties?.["__meta_sources"]?.sources;
                                    if (sources && sources.length > 0) {
                                      window.open(sources[0].url, '_blank');
                                    }
                                  }}
                                  title="Klicken Sie hier, um die Webseite zu öffnen"
                              >
                            <td className="px-4 py-4 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-indigo-50">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selectedProducts.includes(product.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) {
                                    setSelectedProducts(prev => [...prev, product.id]);
                                  } else {
                                    setSelectedProducts(prev => prev.filter(id => id !== product.id));
                                  }
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap sticky left-12 z-10 bg-white group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-indigo-50">
                              {(() => {
                                const isValueSerpSearching = searchResult.searchStatus === 'searching';
                                const isAiAnalyzing = searchResult.searchStatus === 'analyzing';
                                const isComplete = searchResult.searchStatus === 'complete';
                                
                                if (isValueSerpSearching) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-blue-600 font-medium">RowBooster Suche</span>
                                        <span className="text-xs text-blue-500">Durchsucht Internet...</span>
                                      </div>
                                    </div>
                                  );
                                } else if (isAiAnalyzing) {
                                  return (
                                    <div className="flex flex-col gap-3 min-w-[200px]">
                                      {/* Header with Enhanced Icon */}
                                      <div className="flex items-center gap-3">
                                        <div className="relative">
                                          <div className="w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse"></div>
                                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm text-amber-600 font-medium">KI-Datenextraktion</span>
                                          <span className="text-xs text-amber-500">Analysiert Inhalte...</span>
                                        </div>
                                      </div>
                                      
                                      {/* Multi-stage Progress Bar */}
                                      <div className="space-y-2">
                                        {/* Progress Bar */}
                                        <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%] animate-pulse"></div>
                                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                                          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" style={{ width: '65%' }}></div>
                                        </div>
                                        
                                        {/* Stage Indicators */}
                                        <div className="flex justify-between items-center text-xs">
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-green-600">Inhalte laden</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                                            <span className="text-amber-600">KI-Analyse</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                            <span className="text-gray-500">Validierung</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else if (isComplete) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-blue-600 font-medium">Parallele Verarbeitung</span>
                                        <span className="text-xs text-blue-500">Mehrere Quellen...</span>
                                      </div>
                                    </div>
                                  );
                                } else if (isComplete) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-green-600 font-medium">Abgeschlossen</span>
                                        <span className="text-xs text-green-500">Daten extrahiert</span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-gray-600 font-medium">Bereit</span>
                                        <span className="text-xs text-gray-500">Warten auf Verarbeitung</span>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {product?.articleNumber || '—'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{product?.productName || '—'}</span>
                                <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                              </div>
                            </td>
                            
                            {/* Property Values */}
                            {properties
                              ?.filter(property => !property.name.startsWith('__') &&
                                                 property.name !== 'Artikelnummer' &&
                                                 property.name !== 'ArtikelName')
                              .map((property, propIndex) => {
                                const propertyName = property.name;
                                const propertyData = product?.properties?.[propertyName] || {
                                  name: propertyName,
                                  value: "Nicht gefunden",
                                  sources: [],
                                  confidence: 0
                                };
                                
                                const hasValue = Boolean(
                                  propertyData.value &&
                                  propertyData.value !== 'Nicht gefunden' &&
                                  propertyData.value !== 'Not found' &&
                                  propertyData.value !== 'Not Found' &&
                                  propertyData.value.trim() !== ''
                                );
                                const isAutomatedMode = searchResult?.searchMethod === 'auto';
                                // Check if URL mode has multiple sources (PDF + URL)
                                const hasMultipleSources = propertyData.sources && propertyData.sources.length >= 2;
                                const shouldShowConsistency = Boolean(isAutomatedMode || (searchResult?.searchMethod === 'url' && hasMultipleSources));
                                
                                let cellBgClass = '';
                                let consistencyInfo = '';
                                
                                // Set cell background color based on number of confirmed sources
                                if (hasValue) {
                                  const sourceCount = propertyData.consistencyCount || propertyData.sources?.length || 0;
                                  
                                  if (sourceCount === 1) {
                                    cellBgClass = 'bg-yellow-50 border-yellow-200';
                                    consistencyInfo = `1 bestätigte Quelle`;
                                  } else if (sourceCount === 2) {
                                    cellBgClass = 'bg-lime-50 border-lime-200';
                                    consistencyInfo = `2 bestätigte Quellen`;
                                  } else if (sourceCount >= 3) {
                                    cellBgClass = 'bg-green-50 border-green-200';
                                    consistencyInfo = `${sourceCount} bestätigte Quellen`;
                                  }
                                }
                                
                                const dotColor = getConsistencyDotColor(hasValue, !!shouldShowConsistency, propertyData.consistencyCount);
                                
                                return (
                                  <td key={`pdf-cell-${property.id || propIndex}-${propertyName}`} className={`px-3 py-3 whitespace-nowrap text-sm text-gray-900 border-l border-gray-200 ${cellBgClass}`}>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-2 cursor-help w-full h-full">
                                            <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0 shadow-sm`}></div>
                                            <div className="truncate max-w-[120px]">
                                              {editMode ? (
                                                <Input
                                                  className="w-full min-w-[120px] h-8 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                                  defaultValue={hasValue ? propertyData.value : ''}
                                                  onChange={(e) => handleEdit(propertyName, e.target.value)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              ) : (
                                                <span className={`${!hasValue ? 'text-gray-400 italic' : 'text-gray-900'} hover:text-gray-700 transition-colors`}>
                                                  {hasValue ? propertyData.value : '—'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm p-4 bg-white border border-gray-200 shadow-xl rounded-lg">
                                          <div className="space-y-3">
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Eigenschaft</div>
                                              <p className="text-sm text-gray-800 font-medium">{propertyName}</p>
                                            </div>
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Wert</div>
                                              <p className="text-sm text-gray-800 font-medium">
                                                {hasValue ? propertyData.value : 'Keine Daten gefunden'}
                                              </p>
                                            </div>
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Vertrauen</div>
                                              <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${getConfidenceColor(propertyData.confidence)}`}></div>
                                                <span className="text-sm text-gray-600">{propertyData.confidence}%</span>
                                              </div>
                                            </div>
                                            {propertyData.sources && propertyData.sources.length > 0 && (
                                              <div>
                                                <div className="text-xs font-medium text-gray-500 mb-2">Quellen ({propertyData.sources.length})</div>
                                                <div className="space-y-1">
                                                  {propertyData.sources.map((source, idx) => (
                                                    <a
                                                      key={idx}
                                                      href={source.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-start gap-2 hover:bg-blue-50 p-1 rounded transition-colors group"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 group-hover:bg-blue-700"></div>
                                                      <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-gray-700 font-medium truncate group-hover:text-blue-600">
                                                          {source.sourceLabel || source.title || `Quelle ${idx + 1}`}
                                                          {propertyData.confidence && (
                                                            <span className="ml-2 text-gray-500">({propertyData.confidence}%)</span>
                                                          )}
                                                        </div>
                                                        {source.url && source.url !== 'Unknown URL' && (
                                                          <div className="text-xs text-gray-500 truncate group-hover:text-blue-500 group-hover:underline">
                                                            {source.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                                          </div>
                                                        )}
                                                      </div>
                                                      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {consistencyInfo && (
                                              <div>
                                                <div className="text-xs font-medium text-gray-500 mb-1">Datenqualität</div>
                                                <div className="text-xs text-gray-600">{consistencyInfo}</div>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                );
                              })}
                          </tr>
                            ))
                          ) : (
                            // For non-PDF mode, show only the selected product (current behavior)
                            <tr className="group hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-b border-gray-100 cursor-pointer transition-all duration-200" 
                                onClick={() => {
                                  // Make entire row clickable to open the first available source
                                  const sources = searchResult.products[0]?.properties?.["__meta_sources"]?.sources;
                                  if (sources && sources.length > 0) {
                                    window.open(sources[0].url, '_blank');
                                  }
                                }}
                                title="Klicken Sie hier, um die Webseite zu öffnen"
                            >
                            <td className="px-4 py-4 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-indigo-50">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selectedProducts.includes(searchResult.products[0].id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) {
                                    setSelectedProducts(prev => [...prev, searchResult.products[0].id]);
                                  } else {
                                    setSelectedProducts(prev => prev.filter(id => id !== searchResult.products[0].id));
                                  }
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap sticky left-12 z-10 bg-white group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-indigo-50">
                              {(() => {
                                const isValueSerpSearching = searchResult.searchStatus === 'searching';
                                const isAiAnalyzing = searchResult.searchStatus === 'analyzing';
                                const isComplete = searchResult.searchStatus === 'complete';
                                
                                if (isValueSerpSearching) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-blue-600 font-medium">RowBooster Suche</span>
                                        <span className="text-xs text-blue-500">Durchsucht Internet...</span>
                                      </div>
                                    </div>
                                  );
                                } else if (isAiAnalyzing) {
                                  return (
                                    <div className="flex flex-col gap-3 min-w-[200px]">
                                      {/* Header with Enhanced Icon */}
                                      <div className="flex items-center gap-3">
                                        <div className="relative">
                                          <div className="w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse"></div>
                                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm text-amber-600 font-medium">KI-Datenextraktion</span>
                                          <span className="text-xs text-amber-500">Analysiert Inhalte...</span>
                                        </div>
                                      </div>
                                      
                                      {/* Multi-stage Progress Bar */}
                                      <div className="space-y-2">
                                        {/* Progress Bar */}
                                        <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%] animate-pulse"></div>
                                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                                          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse" style={{ width: '65%' }}></div>
                                        </div>
                                        
                                        {/* Stage Indicators */}
                                        <div className="flex justify-between items-center text-xs">
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-green-600">Inhalte laden</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                                            <span className="text-amber-600">KI-Analyse</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                            <span className="text-gray-500">Validierung</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else if (isComplete) {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-green-600 font-medium">Abgeschlossen</span>
                                        <span className="text-xs text-green-500">Daten extrahiert</span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                      <div className="flex flex-col">
                                        <span className="text-sm text-gray-600 font-medium">Bereit</span>
                                        <span className="text-xs text-gray-500">Warten auf Verarbeitung</span>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {searchResult.products[0]?.articleNumber || '—'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{searchResult.products[0]?.productName || '—'}</span>
                                <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                              </div>
                            </td>
                            
                            {/* Property Values */}
                            {properties
                              ?.filter(property => !property.name.startsWith('__') &&
                                                 property.name !== 'Artikelnummer' &&
                                                 property.name !== 'ArtikelName')
                              .map((property, propIndex) => {
                                const propertyName = property.name;
                                const propertyData = allProperties[propertyName] || {
                                  name: propertyName,
                                  value: "Nicht gefunden",
                                  sources: [],
                                  confidence: 0
                                };
                                
                                const hasValue = Boolean(
                                  propertyData.value &&
                                  propertyData.value !== 'Nicht gefunden' &&
                                  propertyData.value !== 'Not found' &&
                                  propertyData.value !== 'Not Found' &&
                                  propertyData.value.trim() !== ''
                                );
                                const isAutomatedMode = searchResult?.searchMethod === 'auto';
                                // Check if URL mode has multiple sources (PDF + URL)
                                const hasMultipleSources = propertyData.sources && propertyData.sources.length >= 2;
                                const shouldShowConsistency = Boolean(isAutomatedMode || (searchResult?.searchMethod === 'url' && hasMultipleSources));
                                
                                let cellBgClass = '';
                                let consistencyInfo = '';
                                
                                // Set cell background color based on number of confirmed sources
                                if (hasValue) {
                                  const sourceCount = propertyData.consistencyCount || propertyData.sources?.length || 0;
                                  
                                  if (sourceCount === 1) {
                                    cellBgClass = 'bg-yellow-50 border-yellow-200';
                                    consistencyInfo = `1 bestätigte Quelle`;
                                  } else if (sourceCount === 2) {
                                    cellBgClass = 'bg-lime-50 border-lime-200';
                                    consistencyInfo = `2 bestätigte Quellen`;
                                  } else if (sourceCount >= 3) {
                                    cellBgClass = 'bg-green-50 border-green-200';
                                    consistencyInfo = `${sourceCount} bestätigte Quellen`;
                                  }
                                }
                                
                                const dotColor = getConsistencyDotColor(hasValue, !!shouldShowConsistency, propertyData.consistencyCount);
                                
                                return (
                                  <td key={`cell-${property.id || propIndex}-${propertyName}`} className={`px-3 py-3 whitespace-nowrap text-sm text-gray-900 border-l border-gray-200 ${cellBgClass}`}>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-2 cursor-help w-full h-full">
                                            <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0 shadow-sm`}></div>
                                            <div className="truncate max-w-[120px]">
                                              {editMode ? (
                                                <Input
                                                  className="w-full min-w-[120px] h-8 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                                  defaultValue={hasValue ? propertyData.value : ''}
                                                  onChange={(e) => handleEdit(propertyName, e.target.value)}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              ) : (
                                                <span className={`${!hasValue ? 'text-gray-400 italic' : 'text-gray-900'} hover:text-gray-700 transition-colors`}>
                                                  {hasValue ? propertyData.value : '—'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm p-4 bg-white border border-gray-200 shadow-xl rounded-lg">
                                          <div className="space-y-3">
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Eigenschaft</div>
                                              <p className="text-sm text-gray-800 font-medium">{propertyName}</p>
                                            </div>
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Wert</div>
                                              <p className="text-sm text-gray-800 font-medium">
                                                {hasValue ? propertyData.value : 'Keine Daten gefunden'}
                                              </p>
                                            </div>
                                            <div>
                                              <div className="text-xs font-medium text-gray-500 mb-1">Bestätigte Quellen</div>
                                              <div className="flex items-center gap-2">
                                                {(() => {
                                                  const sourceCount = propertyData.consistencyCount || propertyData.sources?.length || 0;
                                                  let dotColor = '';
                                                  
                                                  if (sourceCount === 0) {
                                                    dotColor = 'bg-gray-400';
                                                  } else if (sourceCount === 1) {
                                                    dotColor = 'bg-yellow-500';
                                                  } else if (sourceCount === 2) {
                                                    dotColor = 'bg-lime-500';
                                                  } else {
                                                    dotColor = 'bg-green-500';
                                                  }
                                                  
                                                  return (
                                                    <>
                                                      <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                                                      <span className="text-sm font-medium text-gray-700">
                                                        {sourceCount} {sourceCount === 1 ? 'Quelle' : 'Quellen'}
                                                      </span>
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                            {propertyData.sources && propertyData.sources.length > 0 && (
                                              <div>
                                                <div className="text-xs font-medium text-gray-500 mb-2">Quellen ({propertyData.sources.length})</div>
                                                <div className="space-y-1">
                                                  {propertyData.sources.map((source, idx) => (
                                                    <a
                                                      key={idx}
                                                      href={source.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-start gap-2 hover:bg-blue-50 p-1 rounded transition-colors group"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 group-hover:bg-blue-700"></div>
                                                      <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-gray-700 font-medium truncate group-hover:text-blue-600">
                                                          {source.sourceLabel || source.title || `Quelle ${idx + 1}`}
                                                          {propertyData.confidence && (
                                                            <span className="ml-2 text-gray-500">({propertyData.confidence}%)</span>
                                                          )}
                                                        </div>
                                                        {source.url && source.url !== 'Unknown URL' && (
                                                          <div className="text-xs text-gray-500 truncate group-hover:text-blue-500 group-hover:underline">
                                                            {source.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                                          </div>
                                                        )}
                                                      </div>
                                                      <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {consistencyInfo && (
                                              <div>
                                                <div className="text-xs font-medium text-gray-500 mb-1">Datenqualität</div>
                                                <div className="text-xs text-gray-600">{consistencyInfo}</div>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                );
                              })}
                          </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Scraped Data Section - After Table */}
                {searchResult.searchMethod === 'auto' && searchResult.rawContent && searchResult.rawContent.length > 0 && (
                  <div className="mt-6">
                    <Collapsible defaultOpen={false}>
                      <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <h4 className="text-sm font-medium text-blue-800">
                                Gescrapte Daten ({searchResult.rawContent.length} Quellen)
                              </h4>
                            </div>
                            <ChevronDown className="h-4 w-4 text-blue-600 transition-transform" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto bg-white">
                            {searchResult.rawContent.map((content, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      <span className="text-xs font-medium text-gray-700">
                                        {content.sourceLabel || `Quelle ${index + 1}`}
                                      </span>
                                      {content.url && (
                                        <>
                                          <span className="text-gray-300">•</span>
                                          <a
                                            href={content.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {content.title || new URL(content.url).hostname}
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {Math.round((content.contentLength || 0) / 1024)}KB
                                    </span>
                                  </div>
                                </div>
                                <div className="p-3 bg-gray-50">
                                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto bg-white p-3 rounded border border-gray-200">
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
