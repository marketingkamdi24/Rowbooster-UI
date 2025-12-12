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

export default function Home() {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedProductForExport, setSelectedProductForExport] = useState<ProductResult | null>(null);
  
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
    <div className="min-h-screen flex flex-col bg-[var(--rb-light)] text-[var(--rb-text-dark)]">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1">
        <div
          className="relative overflow-hidden rounded-2xl border border-black/5 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60"
        >
          <div className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(circle_at_30%_20%,black,transparent_60%)]">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[color:rgba(23,195,206,0.08)] blur-2xl" />
            <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-[color:rgba(12,36,67,0.06)] blur-2xl" />
          </div>

          <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-7 border-b border-black/5">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--rb-text-muted-dark)]">
                RowBooster
              </div>
              <div className="text-xl sm:text-2xl font-semibold">
                Suche & Extraktion
              </div>
              <div className="text-sm text-[var(--rb-text-muted-dark)]">
                Produktdaten finden, analysieren und exportieren.
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="relative">
            <div className="px-4 sm:px-6 lg:px-8 pt-4">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-[color:rgba(12,36,67,0.06)] p-1">
                <TabsTrigger
                  value="search"
                  className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[var(--rb-primary)] data-[state=active]:shadow-sm"
                >
                  <Search className="h-4 w-4" />
                  Suche
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[var(--rb-primary)] data-[state=active]:shadow-sm"
                >
                  <Settings className="h-4 w-4" />
                  Einstellungen
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
              <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6 p-4">
                <Skeleton className="h-8 w-1/3 mb-4" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <PropertyDefinitions properties={properties || []} />
            )}
            
            {/* File Import Section */}
            <Card>
              <CardHeader className="p-4 border-b border-black/5">
                <CardTitle className="text-base sm:text-lg font-semibold">
                  Eigenschaften importieren (Excel/CSV)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-[var(--rb-text-muted-dark)]">
                    Laden Sie eine Excel- oder CSV-Datei hoch, um Produkteigenschaften zu importieren. 
                    Die Datei sollte mindestens die Spalten "Artikelnummer/ArticleNumber" und 
                    "Produktname/ProductName" enthalten.
                  </p>
                  
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-black/15 rounded-xl p-4 sm:p-6 bg-[color:rgba(12,36,67,0.03)] transition-colors hover:border-[color:rgba(23,195,206,0.35)] cursor-pointer"
                    onClick={handleFileUploadClick}
                  >
                    <FileUp className="h-8 w-8 sm:h-10 sm:w-10 text-[var(--rb-text-muted-dark)] mb-2" />
                    <p className="text-sm text-[var(--rb-text-dark)] mb-1 text-center">Klicken Sie hier, um eine Datei auszuwählen</p>
                    <p className="text-xs text-[var(--rb-text-muted-dark)] text-center">Unterstützte Formate: .xlsx, .xls, .csv</p>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  
                  {selectedFileName && (
                    <div className="p-3 bg-white border border-black/10 rounded-xl flex justify-between items-center">
                      <span className="text-sm text-[var(--rb-text-dark)]">{selectedFileName}</span>
                      <span className="text-xs text-[color:var(--rb-cyan)]">{processedData.length} Einträge gefunden</span>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleImportProperties}
                      disabled={processedData.length === 0}
                      className="flex items-center gap-2 bg-[color:var(--rb-primary)] text-white hover:bg-[color:rgba(12,36,67,0.92)]"
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
