import { useEffect, useState } from "react";
import SearchTabs from "@/components/SearchTabs";
import PropertyDefinitions from "@/components/PropertyDefinitions";
import ExportModal from "@/components/ExportModal";
import ApiSettings from "@/components/ApiSettings";
import ManufacturerSettings from "@/components/ManufacturerSettings";
import ExcludedDomainsSettings from "@/components/ExcludedDomainsSettings";
import CompanySettings from "@/components/CompanySettings";
import { useQuery } from "@tanstack/react-query";
import { ProductProperty, SearchResponse, ProductResult } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, FileUp, Search, Settings } from "lucide-react";
import useFileUpload from "@/hooks/useFileUpload";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSearchTabsStore } from "@/stores/searchTabsStore";
import { useTheme } from "@/contexts/ThemeContext";

export default function Home() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedProductForExport, setSelectedProductForExport] = useState<ProductResult | null>(null);
  const { theme } = useTheme();
  
  // Use Zustand store for state persistence across page navigation
  const {
    autoSearchResult, setAutoSearchResult,
    manualModeSearchResult: manualSearchResult, setManualModeSearchResult: setManualSearchResult,
    fileSearchResult, setFileSearchResult,
    batchPdfResults, setBatchPdfResults,
    hasPerformedAutoSearch, setHasPerformedAutoSearch,
    hasPerformedManualSearch, setHasPerformedManualSearch,
    hasPerformedFileSearch, setHasPerformedFileSearch,
    activeSearchTab, setActiveSearchTab,
    currentResultSource, setCurrentResultSource,
    allSearchResults, setAllSearchResults,
    isFileUploadMode, setIsFileUploadMode,
    isPdfMode, setIsPdfMode,
    isSearching, setIsSearching,
    urlFileModeProcessingStatus: urlProcessingStatus,
    setUrlFileModeProcessingStatus: setUrlProcessingStatus,
  } = useSearchTabsStore();
  
  // Wrapper function to route search results to correct state based on source
  const handleSearchResult = (result: SearchResponse, sourceTab?: string) => {
    const source = sourceTab || 'auto';
    
    // Map search tabs to their corresponding modes
    const tabToModeMap: Record<string, string> = {
      'auto': 'auto',
      'manual': 'manual', 
      'url': 'file',
      'pdf': 'file'
    };
    
    const mode = tabToModeMap[source] || source;
    
    if (mode === 'auto') {
      setAutoSearchResult(result);
      setHasPerformedAutoSearch(true);
    } else if (mode === 'manual') {
      setManualSearchResult(result);
      setHasPerformedManualSearch(true);
    } else if (mode === 'file') {
      // For PDF batch processing, accumulate results instead of replacing
      if (source === 'pdf') {
        setBatchPdfResults(prev => {
          const newResults = [...prev, result];
          console.log('Batch PDF results accumulated:', newResults.length, 'results');
          return newResults;
        });
      }
      setFileSearchResult(result);
      setHasPerformedFileSearch(true);
    }
    
    // For PDF results, ensure PDF mode is activated
    if (source === 'pdf') {
      setIsPdfMode(true);
      setIsFileUploadMode(false);
    }
    
    setActiveSearchTab(mode);
    setCurrentResultSource(source); // Track the exact source that generated these results
  };
  
  // Get current search result based on active tab
  const getCurrentSearchResult = () => {
    if (activeSearchTab === 'auto') return autoSearchResult;
    if (activeSearchTab === 'manual') return manualSearchResult;
    if (activeSearchTab === 'file') {
      // For PDF batch mode, combine all batch results into a single response
      if (isPdfMode && batchPdfResults.length > 0) {
        // Combine all products from batch results
        const allProducts = batchPdfResults.flatMap(result => result.products || []);
        console.log('Combining batch PDF results:', batchPdfResults.length, 'results into', allProducts.length, 'products');
        return {
          products: allProducts,
          searchStatus: 'complete' as const,
          searchMethod: 'pdf'
        } as SearchResponse;
      }
      return fileSearchResult;
    }
    return null;
  };
  
  // Check if current tab has performed a search AND matches the current input method
  const hasCurrentTabPerformedSearch = () => {
    if (activeSearchTab === 'auto') return hasPerformedAutoSearch;
    if (activeSearchTab === 'manual') return hasPerformedManualSearch;
    if (activeSearchTab === 'file') return hasPerformedFileSearch;
    return false;
  };
  
  // Check if current input method matches the source of displayed results
  const shouldShowResults = () => {
    // For PDF mode, always show results if they came from PDF tab
    if (isPdfMode && currentResultSource === 'pdf') {
      return true;
    }
    
    // For auto tab, always show manual search results regardless of fileUploadMode
    // This preserves search results when toggling between Datei and Manual
    if (activeSearchTab === 'auto' && (currentResultSource === 'auto' || currentResultSource === 'manual')) {
      return true;
    }
    
    // For file upload modes, check if we're currently in file upload mode
    if (isFileUploadMode || isPdfMode) {
      return currentResultSource === 'url' || currentResultSource === 'pdf' || currentResultSource === 'file';
    }
    
    // For other modes, show results if they match current mode
    return hasCurrentTabPerformedSearch();
  };

  // Local state that doesn't need persistence
  const [activeTab, setActiveTab] = useState("search");
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [valueSerpApiKey, setValueSerpApiKey] = useState<string>("");
  const [useAI, setUseAI] = useState<boolean>(false);
  const [useValueSerp, setUseValueSerp] = useState<boolean>(false);
  const [modelProvider] = useState<'openai'>('openai');
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLogo, setCompanyLogo] = useState<string>("");
  
  const { fileInputRef, selectedFileName, processedData, handleFileChange } = useFileUpload();

  // Preserve result source when switching between input methods to maintain state
  useEffect(() => {
    // Don't clear result source to preserve manual mode search results
    // when switching from file upload to manual input or vice versa
  }, [isFileUploadMode, isPdfMode, activeSearchTab]);

  // Fetch product properties
  const { data: properties, isLoading: propertiesLoading } = useQuery<ProductProperty[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch all stored search results
  const { data: storedSearchResults } = useQuery<SearchResponse[]>({
    queryKey: ["/api/search-results"]
  });
  
  // Process stored search results when they arrive (but don't auto-display them)
  useEffect(() => {
    if (storedSearchResults && storedSearchResults.length > 0) {
      // Sort in descending order (newest first) based on createdAt or id as fallback
      const sortedResults = [...storedSearchResults].sort((a, b) => {
        // First try to sort by ID (higher/newer IDs first)
        if (a.id && b.id) {
          return b.id - a.id;
        }
        
        // Fallback to product IDs if database IDs aren't available
        const aId = a.products?.[0]?.id || '';
        const bId = b.products?.[0]?.id || '';
        return bId.localeCompare(aId);
      });
      
      // Ensure all loaded results have complete status and valid properties
      const resultsWithStatus = sortedResults.map(result => {
        // Make sure each product has the correct status
        return {
          ...result,
          searchStatus: "complete" as const
        };
      });
      
      // Only update allSearchResults but don't auto-display the latest one
      setAllSearchResults(resultsWithStatus);
      
      // IMPORTANT: Never auto-set searchResult from stored results
      // Results should only appear when actually searched in current session
    }
  }, [storedSearchResults]);
  
  // When a new search result is received, add it to the list of all results
  useEffect(() => {
    const currentResult = getCurrentSearchResult();
    if (currentResult && hasCurrentTabPerformedSearch()) {
      // Add the new search result to the beginning of the list (newest first)
      setAllSearchResults(prev => {
        // Check if this result is already in the list to avoid duplicates
        const isDuplicate = prev.some(result => 
          result.products?.[0]?.articleNumber === currentResult.products?.[0]?.articleNumber &&
          result.products?.[0]?.productName === currentResult.products?.[0]?.productName
        );
        
        if (isDuplicate) return prev;
        return [currentResult, ...prev];
      });
    }
  }, [autoSearchResult, manualSearchResult, fileSearchResult]);
  
  // Add batch PDF results to allSearchResults
  useEffect(() => {
    if (batchPdfResults.length > 0) {
      setAllSearchResults(prev => {
        // Get only new results that aren't already in the list
        const newResults = batchPdfResults.filter(newResult => 
          !prev.some(existingResult => 
            existingResult.products?.[0]?.articleNumber === newResult.products?.[0]?.articleNumber &&
            existingResult.products?.[0]?.productName === newResult.products?.[0]?.productName
          )
        );
        
        // Add new results to the beginning
        return [...newResults, ...prev];
      });
    }
  }, [batchPdfResults]);
  
  // Handle deleting a search result
  const handleDeleteResult = async (resultId?: number | string) => {
    // If resultId is provided, delete that specific result from the database
    if (resultId) {
      try {
        await apiRequest("DELETE", `/api/search-results/${resultId}`);
        
        // If the current search result was deleted, clear it
        const currentResult = getCurrentSearchResult();
        if (currentResult && currentResult.id === resultId) {
          if (activeSearchTab === 'auto') {
            setAutoSearchResult(null);
            setHasPerformedAutoSearch(false);
          } else if (activeSearchTab === 'manual') {
            setManualSearchResult(null);
            setHasPerformedManualSearch(false);
          } else if (activeSearchTab === 'file') {
            setFileSearchResult(null);
            setHasPerformedFileSearch(false);
          }
        }
        
        // Remove from all results state
        setAllSearchResults(prev => prev.filter(result => result.id !== resultId));
        
        toast({
          title: "Suchergebnis gelöscht",
          description: "Das Suchergebnis wurde erfolgreich gelöscht.",
        });
      } catch (error) {
        toast({
          title: "Fehler beim Löschen des Suchergebnisses",
          description: (error as Error).message || "Ein Fehler ist beim Löschen des Suchergebnisses aufgetreten",
          variant: "destructive",
        });
      }
    } else {
      const currentResult = getCurrentSearchResult();
      if (currentResult) {
        // If no resultId is provided but we have a current search result, remove it from the UI
        if (window.confirm("Sind Sie sicher, dass Sie dieses Suchergebnis löschen möchten?")) {
          // If we have an ID, also delete from database
          if (currentResult.id) {
            try {
              await apiRequest("DELETE", `/api/search-results/${currentResult.id}`);
              
              // Remove from all results state
              setAllSearchResults(prev => prev.filter(result => result.id !== currentResult.id));
              
              toast({
                title: "Suchergebnis gelöscht",
                description: "Das Suchergebnis wurde erfolgreich gelöscht.",
              });
            } catch (error) {
              toast({
                title: "Fehler beim Löschen des Suchergebnisses",
                description: (error as Error).message || "Ein Fehler ist beim Löschen des Suchergebnisses aufgetreten",
                variant: "destructive",
              });
            }
          }
          
          // Clear from UI
          if (activeSearchTab === 'auto') {
            setAutoSearchResult(null);
            setHasPerformedAutoSearch(false);
          } else if (activeSearchTab === 'manual') {
            setManualSearchResult(null);
            setHasPerformedManualSearch(false);
          } else if (activeSearchTab === 'file') {
            setFileSearchResult(null);
            setHasPerformedFileSearch(false);
          }
        }
      }
    }
  };

  // Handle importing properties from Excel/CSV
  const handleImportProperties = async () => {
    if (processedData.length > 0) {
      try {
        const response = await apiRequest("POST", "/api/process-file", { data: processedData });
        const result = await response.json();
        
        toast({
          title: "Import erfolgreich",
          description: `${result.imported} Eigenschaften wurden importiert.`,
        });
      } catch (error) {
        toast({
          title: "Fehler beim Import",
          description: (error as Error).message || "Ein unbekannter Fehler ist aufgetreten",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Keine Daten zum Import",
        description: "Bitte laden Sie zuerst eine Datei hoch",
        variant: "destructive",
      });
    }
  };

  // Trigger file input click
  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`min-h-screen flex flex-col relative transition-colors duration-300 ${
      theme === 'dark' ? 'text-white' : 'text-[#0c2443]'
    }`}>
      <main className="relative z-10 container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 flex-1 max-w-5xl w-full overflow-x-hidden">
        <div
          className={`relative overflow-hidden rounded-2xl backdrop-blur-xl transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-white/[0.02]'
              : 'bg-white/60 border border-[#17c3ce]/20'
          }`}
        >
          {/* Ambient glows inside card */}
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className={`absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl ${
              theme === 'dark'
                ? 'bg-[color:rgba(23,195,206,0.12)]'
                : 'bg-[color:rgba(23,195,206,0.15)]'
            }`} />
            <div className={`absolute -right-24 -bottom-24 h-72 w-72 rounded-full blur-3xl ${
              theme === 'dark'
                ? 'bg-[color:rgba(200,250,100,0.08)]'
                : 'bg-[color:rgba(23,195,206,0.10)]'
            }`} />
          </div>

          <div className={`relative px-4 sm:px-6 py-4 sm:py-5 border-b transition-colors duration-300 ${
            theme === 'dark' ? 'border-white/[0.06]' : 'border-[#17c3ce]/10'
          }`}>
            <div className="flex flex-col gap-0.5">
              <div className={`text-lg sm:text-xl font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-[#0c2443]'
              }`}>
                Datenboost
              </div>
              <div className={`text-xs sm:text-sm ${
                theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'
              }`}>
                Produktdaten finden, analysieren und exportieren.
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative">
            <div className="px-4 sm:px-6 pt-3">
              <TabsList className="grid w-full grid-cols-2 rounded-lg bg-transparent p-0 gap-3">
                <TabsTrigger
                  value="search"
                  className={`gap-2 rounded-lg border-2 border-transparent bg-transparent py-2.5 transition-all duration-200 ${
                    theme === 'dark'
                      ? 'text-white/60 data-[state=active]:border-[#c8fa64] data-[state=active]:text-white hover:text-white/80'
                      : 'text-[#0c2443]/60 data-[state=active]:border-[#17c3ce] data-[state=active]:text-[#0c2443] hover:text-[#0c2443]/80'
                  } data-[state=active]:bg-transparent`}
                >
                  <Search className="h-4 w-4" />
                  Suche
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className={`gap-1.5 sm:gap-2 rounded-lg border-2 border-transparent bg-transparent py-2.5 px-2 sm:px-4 transition-all duration-200 text-xs sm:text-sm ${
                    theme === 'dark'
                      ? 'text-white/60 data-[state=active]:border-[#c8fa64] data-[state=active]:text-white hover:text-white/80'
                      : 'text-[#0c2443]/60 data-[state=active]:border-[#17c3ce] data-[state=active]:text-[#0c2443] hover:text-[#0c2443]/80'
                  } data-[state=active]:bg-transparent`}
                >
                  <Settings className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Einstellungen für Unternehmen</span>
                  <span className="sm:hidden">Unternehmen</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="search" className="focus:outline-none px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
            <SearchTabs
              onSearchResult={handleSearchResult}
              properties={properties || []}
              openaiApiKey={openaiApiKey}
              valueSerpApiKey={valueSerpApiKey}
              useAI={useAI}
              useValueSerp={useValueSerp}
              modelProvider={modelProvider}
              onFileUploadModeChange={setIsFileUploadMode}
              onPdfModeChange={setIsPdfMode}
              onClearResults={() => {
                // Clear batch PDF results when starting a new batch
                setBatchPdfResults([]);
                // Don't clear other search results to preserve them
                setCurrentResultSource('pdf');
              }}

              urlProcessingStatus={urlProcessingStatus}
              setUrlProcessingStatus={setUrlProcessingStatus}
              onSearchingChange={setIsSearching}
              searchResult={shouldShowResults() ? getCurrentSearchResult() : null}
              allSearchResults={isPdfMode ? batchPdfResults : allSearchResults}
              onExport={(selectedProduct) => {
                setSelectedProductForExport(selectedProduct || null);
                setIsExportModalOpen(true);
              }}
              onDeleteResult={handleDeleteResult}
              isPdfMode={isPdfMode}
              isSearching={isSearching}
              domainPrioritizationEnabled={true}
              searchEngine="google"
              maxResults={10}
            />
            </TabsContent>
            
            <TabsContent value="settings" className="focus:outline-none px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
            {/* Company Settings Section */}
            <CompanySettings 
              onCompanyNameChange={setCompanyName}
              onCompanyLogoChange={setCompanyLogo}
            />
            
            {/* API Configuration Section */}
            <ApiSettings
              onApiKeyChange={setOpenaiApiKey}
              onUseAIChange={setUseAI}
              onValueSerpApiKeyChange={setValueSerpApiKey}
              onUseValueSerpChange={setUseValueSerp}
            />
            
            {/* Manufacturer Domains Section */}
            <ManufacturerSettings />
            
            {/* Excluded Domains Section */}
            <div className="mt-6">
              <ExcludedDomainsSettings />
            </div>

            {/* Property Definition Section */}
            {propertiesLoading ? (
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl mb-4 sm:mb-6 p-4">
                <Skeleton className="h-8 w-1/3 mb-4 bg-white/10" />
                <Skeleton className="h-12 w-full mb-2 bg-white/10" />
                <Skeleton className="h-12 w-full mb-2 bg-white/10" />
                <Skeleton className="h-12 w-full bg-white/10" />
              </div>
            ) : (
              <PropertyDefinitions properties={properties || []} />
            )}
            
            {/* File Import Section */}
            <Card className="bg-black/20 backdrop-blur-sm border-white/10">
              <CardHeader className="p-4 border-b border-white/10">
                <CardTitle className="text-base sm:text-lg font-semibold text-white">
                  Eigenschaften importieren (Excel/CSV)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-white/60">
                    Laden Sie eine Excel- oder CSV-Datei hoch, um Produkteigenschaften zu importieren. 
                    Die Datei sollte mindestens die Spalten "Artikelnummer/ArticleNumber" und 
                    "Produktname/ProductName" enthalten.
                  </p>
                  
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-4 sm:p-6 bg-black/20 transition-all duration-300 hover:border-[color:rgba(200,250,100,0.4)] hover:bg-[color:rgba(200,250,100,0.05)] cursor-pointer"
                    onClick={handleFileUploadClick}
                  >
                    <FileUp className="h-8 w-8 sm:h-10 sm:w-10 text-white/50 mb-2" />
                    <p className="text-sm text-white/80 mb-1 text-center">Klicken Sie hier, um eine Datei auszuwählen</p>
                    <p className="text-xs text-white/50 text-center">Unterstützte Formate: .xlsx, .xls, .csv</p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  
                  {selectedFileName && (
                    <div className="p-3 bg-black/30 border border-white/15 rounded-xl flex justify-between items-center">
                      <span className="text-sm text-white/90">{selectedFileName}</span>
                      <span className="text-xs text-[color:var(--rb-lime)]">{processedData.length} Einträge gefunden</span>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleImportProperties}
                      disabled={processedData.length === 0}
                      className="flex items-center gap-2 bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] hover:bg-[color:rgba(200,250,100,0.9)] shadow-[0_4px_16px_rgba(200,250,100,0.3)]"
                    >
                      <Database className="h-4 w-4" />
                      Eigenschaften importieren
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => {
          setIsExportModalOpen(false);
          setSelectedProductForExport(null);
        }}
        searchResult={selectedProductForExport ? {
          searchMethod: getCurrentSearchResult()?.searchMethod || 'auto',
          products: [selectedProductForExport],
          searchStatus: 'complete',
          minConsistentSources: 1
        } as SearchResponse : null}
      />
    </div>
  );
}
