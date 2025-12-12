import { useEffect, useRef, useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchTabsStore } from "@/stores/searchTabsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SearchResponse, ProductProperty, SearchRequest } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, Upload, Sparkles, FileUp, FileText, Download, Globe, Link, Plus, File, ChevronDown, ChevronUp, Eye, Trash2, RefreshCw, Zap, ExternalLink, FileInput, Settings, Globe2, LinkIcon, FileCheck, Edit3, FileSpreadsheet, Table2, Settings2, Square, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import UrlSearchTab from "./UrlSearchTab";
import PdfSearchTab from "./PdfSearchTab";
import CustomSearchTab from "./CustomSearchTab";
import { PdfBatchResultsTable } from "./PdfBatchResultsTable";
import useFileUpload from "@/hooks/useFileUpload";
import { Switch } from "@/components/ui/switch";
import * as XLSX from "xlsx-js-style";
import ResultsSection from "./ResultsSection";
import ExcelValidationErrorDialog from "./ExcelValidationErrorDialog";

interface SearchTabsProps {
  onSearchResult: (result: SearchResponse, sourceTab?: string) => void;
  properties: ProductProperty[];
  openaiApiKey?: string;
  valueSerpApiKey?: string;
  useAI?: boolean;
  useValueSerp?: boolean;
  modelProvider?: 'openai';
  onFileUploadModeChange?: (isFileUploadMode: boolean) => void;
  onPdfModeChange?: (isPdfMode: boolean) => void;
  onClearResults?: () => void;
  urlProcessingStatus: Array<{
    id: string;
    articleNumber: string;
    productName: string;
    status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
    progress: number;
    result: SearchResponse | null;
    error?: string;
  }>;
  setUrlProcessingStatus: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    articleNumber: string;
    productName: string;
    status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
    progress: number;
    result: SearchResponse | null;
    error?: string;
  }>>>;
  onSearchingChange?: (isSearching: boolean) => void;
  // New props for integrated results section
  searchResult?: SearchResponse | null;
  allSearchResults?: SearchResponse[];
  onExport?: (selectedProduct: any) => void;
  onDeleteResult?: (id?: number | string) => void;
  isPdfMode?: boolean;
  isSearching?: boolean;
  searchEngine?: string;
  maxResults?: number;
  domainPrioritizationEnabled?: boolean;
}

export default function SearchTabs({
  onSearchResult,
  properties,
  openaiApiKey = "",
  valueSerpApiKey = "",
  useAI = false,
  useValueSerp = false,
  modelProvider = 'openai',
  onFileUploadModeChange,
  onPdfModeChange,
  onClearResults,
  urlProcessingStatus,
  setUrlProcessingStatus,
  onSearchingChange,
  
  // New props for integrated results section
  searchResult,
  allSearchResults,
  onExport,
  onDeleteResult,
  isPdfMode,
  isSearching,
  searchEngine: searchEngineProp = "google",
  maxResults: maxResultsProp = 10,
  domainPrioritizationEnabled: domainPrioritizationEnabledProp = false
}: SearchTabsProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Property tables query and mutation for default table selection
  const { data: propertyTables = [] } = useQuery<Array<{ id: number; name: string; isDefault: boolean }>>({
    queryKey: ['/api/property-tables'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/property-tables');
      return response.json();
    }
  });
  
  const setDefaultTableMutation = useMutation({
    mutationFn: async (tableId: number) => {
      const response = await apiRequest('POST', `/api/property-tables/${tableId}/set-default`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Eigenschaftstabelle geändert",
        description: "Die Standardtabelle wurde erfolgreich geändert",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: (error as Error).message || "Fehler beim Ändern der Standardtabelle",
        variant: "destructive",
      });
    },
  });
  
  // Get the current default table
  const currentDefaultTable = propertyTables.find(t => t.isDefault);
  
  // Helper function to invalidate token usage cache after API calls
  const invalidateTokenUsage = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: [`/api/token-usage/stats/user/${user.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/token-usage/recent/user/${user.id}`] });
    }
  };
  
  // Function to export table data as Excel/CSV
  const exportTableData = () => {
    try {
      // Determine data source based on active tab and mode
      let dataSource: any[] = [];
      
      // CRITICAL: Handle Custom tab specifically to export its own results table
      if (activeTab === 'custom' && customProcessingStatus.length > 0) {
        // For Custom tab, ONLY use customProcessingStatus - this is the new table data
        dataSource = customProcessingStatus
          .filter(item => item.status === 'completed' && item.result)
          .map(item => item.result!);
      } else if (activeTab === 'pdf' && pdfInputMode === 'file' && pdfProcessingStatus.length > 0) {
        // For PDF batch processing, convert processing status to search results format
        dataSource = pdfProcessingStatus
          .filter(item => item.status === 'completed' && item.result)
          .map(item => item.result!);
      } else if (activeTab === 'auto' && fileUploadMode && processingStatus.length > 0) {
        // For file upload mode in auto tab, only export current batch data
        dataSource = processingStatus
          .filter(item => item.status === 'completed' && item.result)
          .map(item => item.result!);
      } else if (activeTab === 'url' && urlInputMode === 'file' && urlFileModeProcessingStatus.length > 0) {
        // For URL file mode, export current batch data
        dataSource = urlFileModeProcessingStatus
          .filter(item => item.status === 'completed' && item.result)
          .map(item => item.result!);
      } else if (allSearchResults && allSearchResults.length > 0) {
        // For other modes, use all search results
        dataSource = allSearchResults;
      } else if (processingStatus && processingStatus.length > 0) {
        // Fallback to processing status if available
        dataSource = processingStatus
          .filter(item => item.status === 'completed' && item.result)
          .map(item => item.result!);
      }
      
      if (!dataSource || dataSource.length === 0) {
        toast({
          title: "Keine Daten zum Export",
          description: "Es sind keine Daten zum Exportieren verfügbar",
          variant: "destructive",
        });
        return;
      }
      
      // Create worksheet data from all search results
      const wsData: any[] = [];
      
      // Create clean column list based on Eigenschaften properties only
      const orderedHeaders: string[] = [];
      
      // Add standard headers first (only the essential ones)
      orderedHeaders.push("Artikelnummer", "Produktname");
      
      // Add properties in the order they appear in the properties array
      // This preserves the column order from the original Excel file
      properties.forEach(prop => {
        // Skip duplicates and system properties
        if (!orderedHeaders.includes(prop.name) && 
            prop.name !== "Artikelnummer" && 
            prop.name !== "Produktname" && 
            prop.name !== "Status" &&
            prop.name !== "Artikel Nr." &&
            prop.name !== "Produkt Name" &&
            prop.name !== "id" &&
            prop.name !== "productName" &&
            !prop.name.startsWith('__')) {
          orderedHeaders.push(prop.name);
        }
      });
      
      // Use the clean ordered headers
      const headers = orderedHeaders;
      
      // Add headers to worksheet
      wsData.push(headers);
      
      // Handle different data source types
      if (dataSource && dataSource.length > 0) {
        // Handle SearchResponse[] format (from PDF tab and integrated results)
        dataSource.forEach(searchResult => {
          const products = searchResult.products || [];
          
          products.forEach((product: any) => {
            const row: any[] = [];
            const properties = product?.properties || {};
            
            // Add data for each column
            headers.forEach(header => {
              if (header === "Artikelnummer") {
                row.push(product.articleNumber || '');
              } else if (header === "Produktname") {
                row.push(product.productName || '');
              } else {
                // Get value from properties (excluding confidence and sources)
                const propValue = properties[header];
                if (propValue) {
                  if (typeof propValue === 'object' && propValue.value !== undefined) {
                    // Extract only the value, ignoring confidence and sources
                    const value = propValue.value;
                    row.push((value && value !== 'Not found' && value !== 'Not Found') ? value : '');
                  } else {
                    const value = String(propValue);
                    row.push((value && value !== 'Not found' && value !== 'Not Found') ? value : '');
                  }
                } else {
                  row.push('');
                }
              }
            });
            
            wsData.push(row);
          });
        });
      } else {
        // Handle processing status format (from URL batch processing)
        processingStatus.forEach(item => {
          // Get all products from this processing status item
          const products = item.result?.products || [];
          
          // If no products found, still add a row with basic info
          if (products.length === 0) {
            const row: any[] = [];
            headers.forEach(header => {
              if (header === "Artikelnummer") {
                row.push(item.articleNumber);
              } else if (header === "Produktname") {
                row.push(item.productName);
              } else {
                row.push('');
              }
            });
            wsData.push(row);
          } else {
            // Add a row for each product
            products.forEach(product => {
              const row: any[] = [];
              const properties = product?.properties || {};
              
              // Add data for each column
              headers.forEach(header => {
                if (header === "Artikelnummer") {
                  // Use product article number if available, otherwise fallback to item article number
                  row.push(product.articleNumber || item.articleNumber);
                } else if (header === "Produktname") {
                  // Use product name if available, otherwise fallback to item product name
                  row.push(product.productName || item.productName);
                } else {
                  // Get value from properties (excluding confidence and sources)
                  const propValue = properties[header];
                  if (propValue) {
                    if (typeof propValue === 'object' && propValue.value !== undefined) {
                      // Extract only the value, ignoring confidence and sources
                      const value = propValue.value;
                      row.push((value && value !== 'Not found' && value !== 'Not Found') ? value : '');
                    } else {
                      const value = String(propValue);
                      row.push((value && value !== 'Not found' && value !== 'Not Found') ? value : '');
                    }
                  } else {
                    row.push('');
                  }
                }
              });
              
              wsData.push(row);
            });
          }
        });
      }
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Style the header row with bold text and light gray background
      const headerStyle = {
        font: { bold: true, color: { rgb: "333333" } },
        fill: { fgColor: { rgb: "F3F4F6" } },
        alignment: { horizontal: "left" }
      };
      
      // Apply header styles
      headers.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
        if (!ws[cellRef]) ws[cellRef] = { v: headers[colIndex] };
        ws[cellRef].s = headerStyle;
      });
      
      // Apply consistency highlighting to data cells
      let currentRowIndex = 1; // Start from row 1 (after headers)
      
      if (dataSource && dataSource.length > 0) {
        // Handle SearchResponse[] format (from PDF tab and integrated results)
        dataSource.forEach((searchResult) => {
          const products = searchResult.products || [];
          
          products.forEach((product: any) => {
            const properties = product?.properties || {};
            
            headers.forEach((header, colIndex) => {
              const cellRef = XLSX.utils.encode_cell({ r: currentRowIndex, c: colIndex });
              
              // Ensure cell exists
              if (!ws[cellRef]) return;
              
              if (header === "Artikelnummer" || header === "Produktname") {
                // Basic styling for article number and product name
                ws[cellRef].s = {
                  font: { color: { rgb: "374151" } },
                  alignment: { horizontal: "left" }
                };
              } else {
                const propValue = properties[header];
                if (propValue && typeof propValue === 'object' && propValue.value !== undefined) {
                  const sourceCount = propValue.consistencyCount || propValue.sourceCount || (propValue.sources ? propValue.sources.length : 0);
                  
                  // Apply highlighting based on source count
                  if (sourceCount >= 3) {
                    // Strong green for 3+ sources
                    ws[cellRef].s = {
                      fill: { fgColor: { rgb: "BBF7D0" } }, // Strong green
                      font: { color: { rgb: "166534" } },
                      alignment: { horizontal: "left" }
                    };
                  } else if (sourceCount >= 2) {
                    // Light green for 2 sources
                    ws[cellRef].s = {
                      fill: { fgColor: { rgb: "D9F99D" } }, // Lime green
                      font: { color: { rgb: "3F6212" } },
                      alignment: { horizontal: "left" }
                    };
                  } else if (sourceCount === 1 || (propValue.value && propValue.value.trim() !== '')) {
                    // Yellow for 1 source
                    ws[cellRef].s = {
                      fill: { fgColor: { rgb: "FEF3C7" } }, // Light yellow
                      font: { color: { rgb: "92400E" } },
                      alignment: { horizontal: "left" }
                    };
                  }
                }
              }
            });
            
            currentRowIndex++;
          });
        });
      } else {
        // Handle processing status format (from URL batch processing)
        processingStatus.forEach((item) => {
          const products = item.result?.products || [];
          
          // If no products, still process the row
          if (products.length === 0) {
            currentRowIndex++;
          } else {
            // Process each product
            products.forEach((product) => {
              const properties = product?.properties || {};
              
              headers.forEach((header, colIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: currentRowIndex, c: colIndex });
                
                // Ensure cell exists
                if (!ws[cellRef]) return;
                
                if (header === "Artikelnummer" || header === "Produktname") {
                  // Basic styling for article number and product name
                  ws[cellRef].s = {
                    font: { color: { rgb: "374151" } },
                    alignment: { horizontal: "left" }
                  };
                } else {
                  const propValue = properties[header];
                  if (propValue && typeof propValue === 'object' && propValue.value !== undefined) {
                    const sourceCount = propValue.consistencyCount || propValue.sourceCount || (propValue.sources ? propValue.sources.length : 0);
                    
                    // Apply highlighting based on source count
                    if (sourceCount >= 3) {
                      // Strong green for 3+ sources
                      ws[cellRef].s = {
                        fill: { fgColor: { rgb: "BBF7D0" } }, // Strong green
                        font: { color: { rgb: "166534" } },
                        alignment: { horizontal: "left" }
                      };
                    } else if (sourceCount >= 2) {
                      // Light green for 2 sources
                      ws[cellRef].s = {
                        fill: { fgColor: { rgb: "D9F99D" } }, // Lime green
                        font: { color: { rgb: "3F6212" } },
                        alignment: { horizontal: "left" }
                      };
                    } else if (sourceCount === 1 || (propValue.value && propValue.value.trim() !== '')) {
                      // Yellow for 1 source
                      ws[cellRef].s = {
                        fill: { fgColor: { rgb: "FEF3C7" } }, // Light yellow
                        font: { color: { rgb: "92400E" } },
                        alignment: { horizontal: "left" }
                      };
                    }
                  }
                }
              });
              
              currentRowIndex++;
            });
          }
        });
      }
      
      // Set column widths for better readability
      const colWidths = headers.map((header) => {
        if (header === "Artikelnummer") return { wch: 15 };
        if (header === "Produktname") return { wch: 35 };
        return { wch: 20 };
      });
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      
      // Generate file name
      const fileName = `product_data_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Export erfolgreich",
        description: `Daten exportiert nach ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export fehlgeschlagen",
        description: (error as Error).message || "Ein Fehler ist beim Export aufgetreten",
        variant: "destructive",
      });
    }
  };
  // Use Zustand store for state persistence across page navigation
  const {
    activeTab, setActiveTab,
    articleNumber, setArticleNumber,
    productName, setProductName,
    productUrl, setProductUrl,
    searchEngine, setSearchEngine,
    maxResults, setMaxResults,
    parallelSearches, setParallelSearches,
    fileUploadMode, setFileUploadMode,
    urlInputMode, setUrlInputMode,
    pdfInputMode, setPdfInputMode,
    pdfScraperEnabled, setPdfScraperEnabled,
    currentSearchResult, setCurrentSearchResult,
    manualModeSearchResult, setManualModeSearchResult,
    fileModeSearchResult, setFileModeSearchResult,
    manualModeAllResults, setManualModeAllResults,
    fileModeAllResults, setFileModeAllResults,
    urlManualModeResults, setUrlManualModeResults,
    urlFileModeResults, setUrlFileModeResults,
    urlManualModeProcessingStatus, setUrlManualModeProcessingStatus,
    urlFileModeProcessingStatus, setUrlFileModeProcessingStatus,
    pdfManualModeResults, setPdfManualModeResults,
    pdfFileModeResults, setPdfFileModeResults,
    pdfProcessingStatus, setPdfProcessingStatus,
    customModeResults, setCustomModeResults,
    customProcessingStatus, setCustomProcessingStatus,
    customAllResults, setCustomAllResults,
    urlExtractionProgress, setUrlExtractionProgress,
    processingStatus, setProcessingStatus,
    tableViewMode, setTableViewMode,
    resultsExpanded, setResultsExpanded,
    selectedFileName, setSelectedFileName,
    processedData, setProcessedData,
    isAutoSearchStopping, setIsAutoSearchStopping,
  } = useSearchTabsStore();
  
  // Abort controller ref for stopping batch processing
  const batchAbortControllerRef = useRef<AbortController | null>(null);
  
  // Abort controller ref for stopping manual (single product) searches
  const manualSearchAbortControllerRef = useRef<AbortController | null>(null);
  
  // Track if batch processing is running (computed from processing status)
  const isBatchProcessingFromStatus = processingStatus.some(item =>
    item.status === 'searching' || item.status === 'extracting' || item.status === 'browser-rendering'
  );
  
  // Track if currently processing (local state for button display)
  const [isProcessing, setIsProcessing] = useState(false);
  
  // File input ref (this doesn't need to be persisted)
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use the custom file upload hook but integrate with store
  const fileUploadHook = useFileUpload();
  
  // Get column detection and validation error from hook for visual validation display
  const { columnDetection, validationError, showValidationErrorDialog, setShowValidationErrorDialog } = fileUploadHook;

  // Reset all state for a fresh start in Automated tab
  const resetAutoTabState = useCallback(() => {
    // Reset processing status
    setProcessingStatus([]);
    
    // Reset input fields
    setArticleNumber('');
    setProductName('');
    
    // Reset file upload state
    setSelectedFileName('');
    setProcessedData([]);
    if (fileUploadHook.resetFileUpload) {
      fileUploadHook.resetFileUpload();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Reset search results
    setCurrentSearchResult(null);
    setFileModeSearchResult(null);
    setFileModeAllResults([]);
    setManualModeSearchResult(null);
    setManualModeAllResults([]);
    
    // Reset flags
    setIsProcessing(false);
    setIsAutoSearchStopping(false);
    
    // Clear abort controller
    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current = null;
    }
    
    // Clear results via parent callback
    if (onClearResults) {
      onClearResults();
    }
  }, [setProcessingStatus, setArticleNumber, setProductName, setSelectedFileName,
      setProcessedData, setCurrentSearchResult, setFileModeSearchResult,
      setFileModeAllResults, setManualModeSearchResult, setManualModeAllResults,
      setIsAutoSearchStopping, onClearResults, fileUploadHook]);

  // Stop batch search handler - immediately aborts and resets everything
  const handleStopBatchSearch = useCallback(() => {
    // First, abort any pending requests immediately
    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current.abort();
    }
    
    // Set stopping flag (for any checks in flight)
    setIsAutoSearchStopping(true);
    
    // Show toast immediately
    toast({
      title: "Suche abgebrochen",
      description: "Alle laufenden Prozesse wurden gestoppt. Alles wurde zurückgesetzt.",
    });
    
    // Immediately reset all state for a fresh start
    // Use setTimeout to ensure toast shows before heavy state updates
    setTimeout(() => {
      resetAutoTabState();
    }, 100);
  }, [setIsAutoSearchStopping, resetAutoTabState]);
  
  // Handle tab switching without clearing results to preserve state
  const handleTabChange = (newTab: string) => {
    // Don't clear results when switching tabs to preserve manual mode search results
    setActiveTab(newTab);
  };
  
  // Notify parent component when file upload mode or active tab changes
  useEffect(() => {
    if (onFileUploadModeChange) {
      // Pass both file upload mode and whether we're in URL tab
      onFileUploadModeChange(fileUploadMode || activeTab === "url");
    }
    if (onPdfModeChange) {
      // Notify parent when PDF mode is active
      onPdfModeChange(activeTab === "pdf");
    }
  }, [fileUploadMode, activeTab, onFileUploadModeChange, onPdfModeChange]);

  // Automatically expand results section when search results become available
  useEffect(() => {
    if (searchResult || (allSearchResults && allSearchResults.length > 0) || 
        (activeTab === 'pdf' && pdfInputMode === 'file' && pdfProcessingStatus.length > 0)) {
      setResultsExpanded(true);
    }
  }, [searchResult, allSearchResults, activeTab, pdfInputMode, pdfProcessingStatus]);
  
  // Track if we've already synced file upload state to prevent infinite loops
  const lastSyncedFileName = useRef<string>("");
  const lastSyncedDataLength = useRef<number>(0);
  
  // Sync file upload hook state with store - only when hook values actually change
  useEffect(() => {
    // Only sync if the hook's filename changed from what we last synced
    if (fileUploadHook.selectedFileName !== lastSyncedFileName.current) {
      lastSyncedFileName.current = fileUploadHook.selectedFileName;
      setSelectedFileName(fileUploadHook.selectedFileName);
    }
    // Only sync processed data if the hook has new data with different length
    if (fileUploadHook.processedData.length > 0 &&
        fileUploadHook.processedData.length !== lastSyncedDataLength.current) {
      lastSyncedDataLength.current = fileUploadHook.processedData.length;
      setProcessedData(fileUploadHook.processedData);
    }
  }, [fileUploadHook.selectedFileName, fileUploadHook.processedData.length, setSelectedFileName, setProcessedData]);
  
  // Custom file change handler that updates both hook and store
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    fileUploadHook.handleFileChange(e);
  };
  
  // If file upload has data, populate the first item
  useEffect(() => {
    if (processedData && processedData.length > 0 && !articleNumber && !productName) {
      const firstItem = processedData[0];
      if (firstItem.ArticleNumber) setArticleNumber(firstItem.ArticleNumber);
      if (firstItem.ProductName) setProductName(firstItem.ProductName);
    }
  }, [processedData, articleNumber, productName]);

  // Quick search mutation (shows immediate results like Google)
  const quickSearchMutation = useMutation({
    mutationFn: async (searchData: SearchRequest) => {
      const response = await apiRequest("POST", "/api/quick-search", searchData);
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      // Invalidate token cache for quick search too
      invalidateTokenUsage();
      console.log('[SEARCH] Quick search completed, cache invalidated');
      
      // Update existing placeholder result with search data and change status to AI processing
      const updatedResult = {
        ...data,
        searchStatus: "analyzing" as const,
        products: data.products.map(product => ({
          ...product,
          properties: {
            ...product.properties,
            // Keep existing properties and update with search data
            ...properties.reduce((acc, prop) => {
              // If we have actual search data for this property, use it
              if (product.properties[prop.name]) {
                acc[prop.name] = product.properties[prop.name];
              } else {
                // Otherwise keep the processing status until we get data
                acc[prop.name] = {
                  name: prop.name,
                  value: 'Datenbearbeitung...',
                  confidence: 0,
                  isConsistent: false,
                  sources: []
                };
              }
              return acc;
            }, {} as any)
          }
        }))
      };
      
      // Store the current search result and update table
      setCurrentSearchResult(updatedResult);
      
      // Store in appropriate mode-specific state
      if (fileUploadMode) {
        setFileModeSearchResult(updatedResult);
      } else {
        setManualModeSearchResult(updatedResult);
      }
      
      onSearchResult(updatedResult, 'auto');
      
      // Always auto-trigger analysis after ValueSERP search
      toast({
        title: "✅ ValueSERP Suche abgeschlossen",
        description: `${data.products[0]?.properties?.__meta_sources?.sources?.length || 0} Webseiten gefunden. KI-Analyse wird gestartet...`,
      });
      
      // Create search data for analysis
      const analysisData: SearchRequest = {
        articleNumber: data.products[0]?.articleNumber || "",
        productName: data.products[0]?.productName || "",
        searchMethod: "auto",
        properties: properties.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          expectedFormat: p.expectedFormat || undefined
        })),
        useAI: useAI,
        aiModelProvider: useAI ? modelProvider : undefined,
        openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
        
        domainPrioritizationEnabled: domainPrioritizationEnabledProp,
        maxResults: maxResults,
        searchEngine: "google",
        pdfScraperEnabled: pdfScraperEnabled
      };
      
      // Auto-trigger content analysis
      analyzeContentMutation.mutate(analysisData);
    },
    onError: (error) => {
      toast({
        title: "Suche fehlgeschlagen",
        description: (error as Error).message || "Suche konnte nicht durchgeführt werden",
        variant: "destructive",
      });
    },
  });
  
  // Full content analysis mutation (processes results with AI)
  const analyzeContentMutation = useMutation({
    mutationFn: async (searchData: SearchRequest) => {
      const response = await apiRequest("POST", "/api/analyze-content", searchData, manualSearchAbortControllerRef.current?.signal);
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      // Invalidate token usage cache to show updated stats immediately
      invalidateTokenUsage();
      console.log('[SEARCH] Analysis completed, cache invalidated');
      
      // Merge with existing result if we have one (to preserve Perplexity data)
      const mergeWithExistingResult = () => {
        if (currentSearchResult && currentSearchResult.products && currentSearchResult.products[0]) {
          // Create a merged result preserving existing data
          const mergedResult = { ...data };
          if (mergedResult.products && mergedResult.products[0]) {
            const existingProduct = currentSearchResult.products[0];
            const newProduct = mergedResult.products[0];
            
            // Merge properties - prioritize new OpenAI data but preserve existing Perplexity data where OpenAI has no value
            const mergedProperties = { ...existingProduct.properties };
            
            // Add new OpenAI properties, replacing processing status
            Object.entries(newProduct.properties).forEach(([key, newProp]) => {
              if (newProp && newProp.value && newProp.value.trim() !== '' && newProp.value !== 'Not found') {
                mergedProperties[key] = newProp;
              } else if (mergedProperties[key]?.value === 'Datenbearbeitung...') {
                // Replace processing status with empty if no data found
                mergedProperties[key] = {
                  name: key,
                  value: '',
                  confidence: 0,
                  isConsistent: false,
                  sources: []
                };
              }
            });
            
            // Update the merged result
            mergedResult.products[0] = {
              ...newProduct,
              properties: mergedProperties
            };
          }
          return mergedResult;
        }
        return data;
      };

      const finalResult = mergeWithExistingResult();
      
      // Clear any remaining "Datenbearbeitung..." status for properties with no data
      if (finalResult.products && finalResult.products[0]) {
        const finalProperties = { ...finalResult.products[0].properties };
        Object.keys(finalProperties).forEach(key => {
          if (finalProperties[key]?.value === 'Datenbearbeitung...') {
            finalProperties[key] = {
              name: key,
              value: '',
              confidence: 0,
              isConsistent: false,
              sources: []
            };
          }
        });
        finalResult.products[0].properties = finalProperties;
      }
      
      // Set the status to complete
      finalResult.searchStatus = "complete";
      
      setCurrentSearchResult(finalResult);
      
      // Store in appropriate mode-specific state
      if (fileUploadMode) {
        setFileModeSearchResult(finalResult);
      } else {
        setManualModeSearchResult(finalResult);
      }
      
      onSearchResult(finalResult, 'auto');
      // Count how many properties have data
      const propsWithData = finalResult.products && finalResult.products[0] ? 
        Object.values(finalResult.products[0].properties).filter(prop => 
          prop?.value && prop.value.trim() !== '' && prop.value !== 'Not found'
        ).length : 0;

      toast({
        title: "✅ KI-Analyse abgeschlossen",
        description: `${propsWithData} Eigenschaften aus Webinhalten extrahiert`,
      });
    },
    onError: (error) => {
      // Check if this was an abort - don't show error toast
      const errorMessage = (error as Error).message || '';
      const isAbortError = (error as Error).name === 'AbortError' ||
                           errorMessage.includes('aborted') ||
                           errorMessage.includes('signal');
      
      if (!isAbortError) {
        // If we had a placeholder result, mark it as complete and clear processing statuses
        if (currentSearchResult?.products?.[0]?.properties) {
          const clearedResult: SearchResponse = {
            ...currentSearchResult,
            searchStatus: "complete" as const,
            statusMessage: errorMessage || "Fehler bei der Inhaltsanalyse",
            products: currentSearchResult.products.map(p => ({
              ...p,
              properties: Object.fromEntries(
                Object.entries(p.properties).map(([k, v]) => {
                  if (v?.value === 'Datenbearbeitung...') {
                    return [k, { ...v, value: '' }];
                  }
                  return [k, v];
                })
              )
            }))
          };
          setCurrentSearchResult(clearedResult);
          if (fileUploadMode) {
            setFileModeSearchResult(clearedResult);
          } else {
            setManualModeSearchResult(clearedResult);
          }
          onSearchResult(clearedResult, 'auto');
        }

        // Improve error hinting for common backend failures
        const isAuthError = errorMessage.startsWith('401:');
        const isMissingKeysError = errorMessage.startsWith('400:') && errorMessage.toLowerCase().includes('valueserp api key');
        toast({
          title: "Analyse fehlgeschlagen",
          description: isAuthError
            ? "Bitte melde dich erneut an (Session abgelaufen) und starte die Suche erneut."
            : isMissingKeysError
              ? "ValueSERP API-Key fehlt. Bitte in den Einstellungen eintragen oder ValueSERP aktivieren."
              : (errorMessage || "Fehler bei der Inhaltsanalyse"),
          variant: "destructive",
        });
      }
      // If aborted, toast is shown by handleStopManualSearch
    },
  });

  // Legacy search method for backward compatibility
  const searchMutation = useMutation({
    mutationFn: async (searchData: SearchRequest) => {
      const response = await apiRequest("POST", "/api/search", searchData);
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      onSearchResult(data, 'manual');
      toast({
        title: "Suche abgeschlossen",
        description: useAI
          ? `Informationen für ${data.products.length} Produkt(e) mit KI-Unterstützung gefunden`
          : `Informationen für ${data.products.length} Produkt(e) gefunden`,
      });
    },
    onError: (error) => {
      toast({
        title: "Suche fehlgeschlagen",
        description: (error as Error).message || "Suche konnte nicht durchgeführt werden",
        variant: "destructive",
      });
    },
  });

  // URL extraction mutation for single product
  const urlExtractionMutation = useMutation({
    mutationFn: async (searchData: SearchRequest) => {
      const response = await apiRequest("POST", "/api/analyze-content", searchData);
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      onSearchResult(data, 'file');
      toast({
        title: "URL-Extraktion abgeschlossen",
        description: `Produktinformationen wurden erfolgreich aus der URL extrahiert`,
      });
    },
    onError: (error) => {
      toast({
        title: "URL-Extraktion fehlgeschlagen",
        description: (error as Error).message || "Informationen konnten nicht aus der URL extrahiert werden",
        variant: "destructive",
      });
    },
  });

  // Monitor mutation states and update searching status
  useEffect(() => {
    const isSearching = quickSearchMutation.isPending || analyzeContentMutation.isPending || searchMutation.isPending || urlExtractionMutation.isPending;
    if (onSearchingChange) {
      onSearchingChange(isSearching);
    }
  }, [quickSearchMutation.isPending, analyzeContentMutation.isPending, searchMutation.isPending, urlExtractionMutation.isPending, onSearchingChange]);

  // Handle single URL extraction
  const handleUrlExtraction = () => {
    if (!productName || !productUrl) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte geben Sie sowohl Produktname als auch URL an",
        variant: "destructive",
      });
      return;
    }

    const searchData: SearchRequest = {
      articleNumber: articleNumber || "",
      productName: productName,
      searchMethod: "url",
      productUrl: productUrl,
      properties: properties.map(p => ({ 
        id: p.id, 
        name: p.name, 
        description: p.description || undefined, 
        expectedFormat: p.expectedFormat || undefined
      })),
      useAI: useAI,
      aiModelProvider: useAI ? modelProvider : undefined,
      openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
    };

    urlExtractionMutation.mutate(searchData);
  };

  // Handle batch URL extraction for uploaded files
  const handleUrlBatchExtraction = async () => {
    if (!processedData || processedData.length === 0) {
      toast({
        title: "Keine Daten zu verarbeiten",
        description: "Bitte laden Sie zuerst eine Datei mit Produktdaten hoch",
        variant: "destructive",
      });
      return;
    }

    // Validate that uploaded data has URL column
    const hasUrlColumn = processedData.some(item => item.URL || item.url || item.ProductURL || item.productUrl);
    if (!hasUrlColumn) {
      toast({
        title: "Fehlende URL-Spalte",
        description: "Die hochgeladene Datei muss eine URL-Spalte mit Produkt-URLs enthalten",
        variant: "destructive",
      });
      return;
    }

    // Use the existing batch search handler since it already supports URL mode
    await handleBatchSearch();
  };

  // Process multiple products from uploaded file in parallel
  const handleBatchSearch = async () => {
    if (!processedData || processedData.length === 0) {
      toast({
        title: "Keine Daten vorhanden",
        description: "Bitte laden Sie zuerst eine Excel-Datei mit Produktdaten hoch",
        variant: "destructive",
      });
      return;
    }

    // Validate that all products have ProductName
    const invalidProducts = processedData.filter(product => !product.ProductName || product.ProductName.trim() === '');
    if (invalidProducts.length > 0) {
      toast({
        title: "Fehler: Fehlende Produktnamen",
        description: `${invalidProducts.length} Zeile(n) haben keinen Produktnamen. Die Spalte "Produktname" oder "ProductName" ist erforderlich für alle Zeilen.`,
        variant: "destructive",
      });
      return;
    }
    
    // Reset stop flag, set processing flag, and create new abort controller
    setIsAutoSearchStopping(false);
    setIsProcessing(true);
    batchAbortControllerRef.current = new AbortController();

    // Set up the processing state for ALL products - handle optional ArticleNumber
    const allProductsState = processedData.map((product, index) => ({
      articleNumber: product.ArticleNumber || `auto_${index + 1}`,
      productName: product.ProductName,
      status: 'pending' as 'pending' | 'searching' | 'extracting' | 'completed' | 'failed',
      progress: 0,
      result: null as SearchResponse | null
    }));
    
    // Update the state to show all products
    setProcessingStatus(allProductsState);
    
    toast({
      title: "Stapelverarbeitung gestartet",
      description: `Verarbeite ${processedData.length} Produkte mit ${parallelSearches} gleichzeitig`,
    });
    
    // Helper function to update the status of a specific product
    const updateProductStatus = (index: number, status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed', progress: number, result: SearchResponse | null = null) => {
      setProcessingStatus(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status,
          progress,
          ...(result ? { result } : {})
        };
        return updated;
      });
    };
    
    // Function to process products in batches with concurrent ValueSERP + AI + Perplexity support
    const processInBatches = async () => {
      // For automated mode with multiple products, use enhanced concurrent processing
      if (activeTab === "auto" && processedData.length > 1) {
        try {
          const completedResults: SearchResponse[] = [];
          let stoppedCount = 0;
          
          // Show initial toast
          toast({
            title: "🔍 Stapelverarbeitung gestartet",
            description: `Verarbeite ${processedData.length} Produkte mit ValueSERP + KI-Analyse...`,
          });
          
          // OPTIMIZED: Process products in controlled batches respecting parallel limit
          console.log(`[BATCH-OPTIMIZATION] Processing ${processedData.length} products in batches of ${parallelSearches}`);
          
          // Process batches sequentially, but products within each batch in parallel
          for (let i = 0; i < processedData.length; i += parallelSearches) {
            // Check for stop before starting each batch - use signal.aborted for immediate check
            if (batchAbortControllerRef.current?.signal.aborted) {
              console.log(`[BATCH] Stop requested, remaining ${processedData.length - i} items will not be processed`);
              stoppedCount = processedData.length - i;
              break;
            }
            
            const batch = processedData.slice(i, i + parallelSearches);
            const batchStartIndex = i;
            
            console.log(`[BATCH] Processing batch ${Math.floor(i / parallelSearches) + 1}/${Math.ceil(processedData.length / parallelSearches)} (products ${i + 1}-${Math.min(i + parallelSearches, processedData.length)})`);
            
            // Process products in this batch in parallel
            const productPromises = batch.map(async (product, batchIndex) => {
              const globalIndex = batchStartIndex + batchIndex;
              const productIdentifier = `${product.ArticleNumber || 'no-article'} - ${product.ProductName}`;
              
              // Check for stop before starting each product - use signal.aborted for immediate check
              if (batchAbortControllerRef.current?.signal.aborted) {
                return null;
              }
              
              try {
                console.log(`[BATCH-${globalIndex}] Starting processing for: ${productIdentifier}`);
                
                // Mark as searching
                updateProductStatus(globalIndex, 'searching', 20);
                
                // CRITICAL OPTIMIZATION: Single optimized request instead of quick-search → analyze-content
                // This combines ValueSERP search + AI extraction in one efficient call
                const optimizedSearchData: SearchRequest = {
                  articleNumber: String(product.ArticleNumber || ""),
                  productName: String(product.ProductName || ""),
                  searchMethod: "auto" as const,
                  properties: properties.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description || undefined,
                    expectedFormat: p.expectedFormat || undefined
                  })),
                  useAI: useAI,
                  aiModelProvider: useAI ? modelProvider : undefined,
                  openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
                  searchEngine: "google",
                  useValueSerp: useValueSerp,
                  valueSerpApiKey: useValueSerp ? valueSerpApiKey : undefined,
                  maxResults: maxResults,
                  domainPrioritizationEnabled: domainPrioritizationEnabledProp,
                  pdfScraperEnabled: pdfScraperEnabled,
                };

                console.log(`[BATCH-${globalIndex}] Sending request with ${properties.length} properties`);
                
                // Update progress - starting combined search + AI
                updateProductStatus(globalIndex, 'searching', 40);
                
                // Check for abort before API call
                if (batchAbortControllerRef.current?.signal.aborted) {
                  throw new Error('Aborted by user');
                }
                
                // OPTIMIZED: Single API call handles ValueSERP + AI processing
                console.log(`[BATCH-${globalIndex}] Calling /api/analyze-content...`);
                const response = await apiRequest("POST", "/api/analyze-content", optimizedSearchData, batchAbortControllerRef.current?.signal);
                const result = await response.json() as SearchResponse;
                
                // Invalidate token usage cache immediately after each API call
                invalidateTokenUsage();
                console.log(`[BATCH-${globalIndex}] Cache invalidated for user ${user?.id}`);
                
                console.log(`[BATCH-${globalIndex}] Response received, properties found: ${result.products?.[0] ? Object.keys(result.products[0].properties).length : 0}`);
                
                // Validate that we got a proper result
                if (!result || !result.products || !result.products[0]) {
                  console.error(`[BATCH-${globalIndex}] Invalid result structure: ${JSON.stringify(result)}`);
                  throw new Error('Invalid response structure from server');
                }
                
                // Log property extraction results
                const extractedProps = result.products[0].properties;
                const propsWithValues = Object.entries(extractedProps).filter(([key, prop]) =>
                  prop && prop.value && prop.value.trim() !== '' && !key.startsWith('__')
                ).length;
                console.log(`[BATCH-${globalIndex}] Extracted ${propsWithValues}/${properties.length} properties with values`);
                
                // Update progress - AI extraction complete
                updateProductStatus(globalIndex, 'extracting', 75);
                
                let finalResult = result;
                
                // Final validation before marking as completed
                const finalPropsWithValues = Object.entries(finalResult.products[0].properties).filter(([key, prop]) =>
                  prop && prop.value && prop.value.trim() !== '' && !key.startsWith('__')
                ).length;
                
                console.log(`[BATCH-${globalIndex}] Final result has ${finalPropsWithValues}/${properties.length} properties with values`);
                
                // Mark as completed
                updateProductStatus(globalIndex, 'completed', 100, finalResult);
                
                // Show first product result in main view
                if (globalIndex === 0) {
                  onSearchResult(finalResult);
                }
                
                console.log(`[BATCH-${globalIndex}] ✅ Successfully completed processing`);
                return finalResult;
                
              } catch (error) {
                // Check if this was an abort - don't log as error
                if ((error as Error).message === 'Aborted by user' || (error as Error).name === 'AbortError') {
                  console.log(`[BATCH-${globalIndex}] Processing aborted by user`);
                  return null;
                }
                
                const errorMsg = (error as Error).message || 'Unknown error';
                console.error(`[BATCH-${globalIndex}] ❌ Error processing product:`, errorMsg, error);
                console.error(`[BATCH-${globalIndex}] Product details:`, productIdentifier);
                updateProductStatus(globalIndex, 'failed', 100);
                
                // Return a result with error information instead of null
                return {
                  searchMethod: "auto",
                  products: [{
                    id: `error-${globalIndex}`,
                    articleNumber: product.ArticleNumber || "",
                    productName: product.ProductName,
                    properties: {
                      "Artikelnummer": {
                        name: "Artikelnummer",
                        value: product.ArticleNumber || "",
                        confidence: 100,
                        isConsistent: true,
                        sources: []
                      },
                      "__error": {
                        name: "__error",
                        value: errorMsg,
                        confidence: 0,
                        isConsistent: false,
                        sources: []
                      }
                    }
                  }],
                  searchStatus: "complete" as const
                } as SearchResponse;
              }
            });
            
            // Wait for this batch to complete before starting the next one
            const batchResults = await Promise.all(productPromises);
            
            // Check if aborted - don't collect or continue if so
            if (batchAbortControllerRef.current?.signal.aborted) {
              break;
            }
            
            // Collect results from this batch
            batchResults.forEach(result => {
              if (result) {
                completedResults.push(result);
              }
            });
            
            console.log(`[BATCH] Completed batch ${Math.floor(i / parallelSearches) + 1}, total results so far: ${completedResults.length}`);
          }
          
          // Only show completion if not aborted (abort handler shows its own toast and resets)
          if (batchAbortControllerRef.current?.signal.aborted) {
            // Aborted - resetAutoTabState will handle cleanup
            return [];
          }
          
          // Reset stop flag and abort controller
          setIsAutoSearchStopping(false);
          batchAbortControllerRef.current = null;
          setIsProcessing(false);

          const successCount = completedResults.filter(r =>
            !r.products?.[0]?.properties?.__error
          ).length;
          const failedCount = processedData.length - successCount - stoppedCount;
          
          console.log(`[BATCH-COMPLETE] Total results: ${completedResults.length}, Success: ${successCount}, Failed: ${failedCount}, Stopped: ${stoppedCount}`);
          
          // Log any products that have errors
          completedResults.forEach((result, idx) => {
            if (result.products?.[0]?.properties?.__error) {
              console.error(`[BATCH-COMPLETE] Product ${idx} has error:`, result.products[0].properties.__error.value);
            }
          });
          
          if (stoppedCount > 0) {
            toast({
              title: "Stapelverarbeitung gestoppt",
              description: `${successCount} erfolgreich, ${failedCount} fehlgeschlagen, ${stoppedCount} gestoppt`,
            });
          } else {
            toast({
              title: "Stapelverarbeitung abgeschlossen",
              description: `${successCount} Produkte erfolgreich verarbeitet${failedCount > 0 ? ` (${failedCount} mit Problemen)` : ''}.`,
            });
          }
          
          // Store ALL results (including failed ones) in file mode state so they appear in table
          setFileModeAllResults(completedResults);

          return completedResults;

        } catch (error) {
          // Check if this was an abort
          if ((error as Error).message === 'Aborted by user' || (error as Error).name === 'AbortError') {
            console.log('[BATCH] Processing aborted by user');
            return [];
          }
          
          console.error("Batch processing error:", error);
          // Reset stop flag
          setIsAutoSearchStopping(false);
          batchAbortControllerRef.current = null;
          setIsProcessing(false);
          
          // Mark all products as failed
          processedData.forEach((_, index) => {
            updateProductStatus(index, 'failed', 100);
          });
          
          toast({
            title: "Stapelverarbeitung fehlgeschlagen",
            description: "Fehler bei der Verarbeitung von Produkten mit erweiterter paralleler Verarbeitung.",
            variant: "destructive",
          });
          return [];
        }
      }

      // Fallback to individual processing for other modes or single products
      const productQueue = [...processedData];
      const activePromises: Promise<any>[] = [];
      const completedResults: SearchResponse[] = [];
      
      // Process products until the queue is empty
      while (productQueue.length > 0 || activePromises.length > 0) {
        // Fill available slots with new products from the queue
        while (activePromises.length < parallelSearches && productQueue.length > 0) {
          const nextProduct = productQueue.shift()!;
          const productIndex = processedData.findIndex(
            p => p.ArticleNumber === nextProduct.ArticleNumber && p.ProductName === nextProduct.ProductName
          );
          
          try {
            // Process this product and add its promise to active promises
            const processPromise = async () => {
              try {
                // Mark product as processing
                updateProductStatus(productIndex, 'searching', 30);
                
                // Create the search data object for this product - handle optional ArticleNumber
                const searchData: SearchRequest = {
                  articleNumber: nextProduct.ArticleNumber || "",
                  productName: nextProduct.ProductName,
                  searchMethod: activeTab as "auto" | "url",
                  properties: properties.map(p => ({ 
                    id: p.id, 
                    name: p.name, 
                    description: p.description || undefined, 
                    expectedFormat: p.expectedFormat || undefined
                  })),
                  useAI: useAI,
                  aiModelProvider: useAI ? modelProvider : undefined,
                  openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
                  
                  useValueSerp: useValueSerp,
                  valueSerpApiKey: useValueSerp ? valueSerpApiKey : undefined,
                  domainPrioritizationEnabled: domainPrioritizationEnabledProp,
        
                  maxResults: maxResults,
                };
                
                // Add method-specific properties
                if (activeTab === "auto") {
                  searchData.searchEngine = "google";
                } else if (activeTab === "url") {
                  // For URL mode, use the URL from the product data or the global productUrl
                  let urlToUse = nextProduct.URL || nextProduct.url || nextProduct.ProductURL || nextProduct.productUrl || productUrl;
                  
                  if (urlToUse) {
                    // Replace placeholders if they exist - handle optional ArticleNumber
                    if (urlToUse.includes("{articleNumber}")) {
                      urlToUse = urlToUse.replace("{articleNumber}", nextProduct.ArticleNumber || "");
                    }
                    if (urlToUse.includes("{productName}")) {
                      urlToUse = urlToUse.replace("{productName}", encodeURIComponent(nextProduct.ProductName));
                    }
                    searchData.productUrl = urlToUse;
                  }
                }
                
                // Use the analyze-content endpoint directly for complete processing
                const response = await apiRequest("POST", "/api/analyze-content", searchData);
                const result = await response.json() as SearchResponse;
                
                // Update status to completed
                updateProductStatus(productIndex, 'completed', 100, result);
                
                // Show the first product's result in the main view
                if (productIndex === 0) {
                  onSearchResult(result);
                }
                
                // Store the result for completion tracking
                completedResults.push(result);
                return result;
              } catch (err) {
                console.error(`Error processing product ${nextProduct.ArticleNumber}:`, err);
                updateProductStatus(productIndex, 'failed', 100);
                throw err;
              }
            };
            
            const promise = processPromise();
            activePromises.push(promise);
            
            promise.then(() => {
              // When complete, remove from active promises
              const index = activePromises.indexOf(promise);
              if (index !== -1) {
                activePromises.splice(index, 1);
              }
              
              // Show completion toast at milestones
              if (completedResults.length === processedData.length) {
                toast({
                  title: "Alle Produkte verarbeitet",
                  description: `Alle ${processedData.length} Produkte erfolgreich verarbeitet.`,
                });
              } else if (completedResults.length % parallelSearches === 0) {
                toast({
                  title: "Verarbeitungsfortschritt",
                  description: `${completedResults.length} von ${processedData.length} Produkten abgeschlossen.`,
                });
              }
            }).catch(error => {
              // Remove from active promises on error
              const index = activePromises.indexOf(promise);
              if (index !== -1) {
                activePromises.splice(index, 1);
              }
            });
          } catch (error) {
            console.error("Failed to start processing for product:", nextProduct, error);
            updateProductStatus(productIndex, 'failed', 100);
          }

          // Note: Promise is defined and added inside the try block
          
        }
        
        // If we have active promises but no more available slots, wait a bit
        if (activePromises.length > 0) {
          // Wait for at least one promise to resolve
          await Promise.race([
            Promise.all(activePromises.map(p => p.catch(() => {}))),
            new Promise(resolve => setTimeout(resolve, 500))
          ]);
        }
      }
      
      return completedResults;
    };
    
    // Function to process a single product
    const processProduct = async (product: any, index: number) => {
      try {
        // Create the search data object for this product
        const searchData: SearchRequest = {
          articleNumber: String(product.ArticleNumber || ""), // Convert to string to match API expectations
          productName: String(product.ProductName || ""),
          searchMethod: activeTab as "auto" | "url",
          properties: properties.map(p => ({ 
            id: p.id, 
            name: p.name, 
            description: p.description || undefined, 
            expectedFormat: p.expectedFormat || undefined
          })),
          useAI: useAI,
          aiModelProvider: useAI ? modelProvider : undefined,
          openaiApiKey: useAI && modelProvider === 'openai' ? openaiApiKey : undefined,
          
          useValueSerp: useValueSerp,
          valueSerpApiKey: useValueSerp ? valueSerpApiKey : undefined,
          domainPrioritizationEnabled: domainPrioritizationEnabledProp,

          maxResults: maxResults,
        };
        
        // Log which search engine is being used (for debugging)
        console.log(`Batch processing for ${product.ArticleNumber} using search engine: ${searchEngine || 'google'}`);
        console.log(`Sending batch request for ${product.ArticleNumber} - ${product.ProductName}`, 
          JSON.stringify({
            searchMethod: searchData.searchMethod,
            useValueSerp: searchData.useValueSerp || false
          })
        );
        
        // Add method-specific properties
        if (activeTab === "auto") {
          searchData.searchEngine = "google";

        } else if (activeTab === "url" && productUrl) {
          // For URL mode with multiple products, replace placeholders in URL pattern
          let processedUrl = productUrl;
          if (productUrl.includes("{articleNumber}")) {
            processedUrl = processedUrl.replace("{articleNumber}", String(product.ArticleNumber || ""));
          }
          if (productUrl.includes("{productName}")) {
            processedUrl = processedUrl.replace("{productName}", encodeURIComponent(String(product.ProductName || "")));
          }
          searchData.productUrl = processedUrl;
        }
        
        // Update status to searching
        updateProductStatus(index, 'searching', 30);
        
        // Use the analyze-content endpoint directly for complete processing
        const response = await apiRequest("POST", "/api/analyze-content", searchData);
        const result = await response.json() as SearchResponse;
        
        // Update status to extracting
        updateProductStatus(index, 'extracting', 70);
        
        // Short delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update status to completed
        updateProductStatus(index, 'completed', 100, result);
        
        // Display the first result in the main view
        if (index === 0) {
          onSearchResult(result);
        }
        
        return result;
      } catch (error) {
        console.error('Processing error for product:', product, error);
        updateProductStatus(index, 'failed', 100);
        throw error;
      }
    };
    
    // Start the batch processing
    processInBatches().catch(error => {
      console.error("Batch processing error:", error);
      toast({
        title: "Stapelverarbeitungsfehler",
        description: (error as Error).message || "Ein Fehler ist bei der Stapelverarbeitung aufgetreten",
        variant: "destructive",
      });
    });
  };

  // Handler to stop manual mode search
  const handleStopManualSearch = useCallback(() => {
    // Abort any pending manual search requests
    if (manualSearchAbortControllerRef.current) {
      manualSearchAbortControllerRef.current.abort();
      manualSearchAbortControllerRef.current = null;
    }
    
    // Reset mutations
    analyzeContentMutation.reset();
    quickSearchMutation.reset();
    
    // Reset search results and state
    setCurrentSearchResult(null);
    setManualModeSearchResult(null);
    setManualModeAllResults([]);
    
    // Clear input fields for fresh start
    setArticleNumber('');
    setProductName('');
    
    // Clear results via parent callback
    if (onClearResults) {
      onClearResults();
    }
    
    // Show confirmation toast with proper German message
    toast({
      title: "Vorgang abgebrochen",
      description: "Der Vorgang wurde durch den Nutzer gestoppt.",
    });
  }, [analyzeContentMutation, quickSearchMutation,
      setCurrentSearchResult, setManualModeSearchResult, setManualModeAllResults,
      setArticleNumber, setProductName, onClearResults]);

  // OPTIMIZED: Enhanced search with direct single-request pipeline
  const handleSearch = () => {
    if (!productName) {
      toast({
        title: "Validierungsfehler",
        description: "Produktname ist erforderlich",
        variant: "destructive",
      });
      return;
    }

    // Automated tab manual mode is explicitly "Search & Extract".
    // Force the single-request pipeline (ValueSERP search + scraping + AI extraction)
    // and forward any user-provided API keys even if global toggles are off.
    const isAutoManualSearch = activeTab === "auto" && !fileUploadMode;
    const effectiveUseValueSerp = isAutoManualSearch ? true : useValueSerp;
    const effectiveUseAI = isAutoManualSearch ? true : useAI;

    // Create an immediate placeholder result to show the search has started with table
    const placeholderResult: SearchResponse = {
      searchMethod: activeTab as "auto" | "url" | "pdf",
      searchStatus: "searching" as const,
      products: [{
        id: `temp-${Date.now()}`,
        articleNumber: articleNumber || "",
        productName: productName,
        properties: properties.reduce((acc, prop) => {
          acc[prop.name] = {
            name: prop.name,
            value: 'Datenbearbeitung...', // Show processing status
            confidence: 0,
            isConsistent: false,
            sources: []
          };
          return acc;
        }, {} as any)
      }]
    };
    
    // Show the placeholder result immediately with processing status
    setCurrentSearchResult(placeholderResult);
    
    // Store in appropriate mode-specific state
    if (fileUploadMode) {
      setFileModeSearchResult(placeholderResult);
    } else {
      setManualModeSearchResult(placeholderResult);
    }
    
    onSearchResult(placeholderResult, activeTab);
    
    // Create new AbortController for this search
    manualSearchAbortControllerRef.current = new AbortController();
    
    // Show initial toast
    toast({
      title: "🔍 Optimierte Suche gestartet",
      description: "Erweiterte ValueSERP + KI-Analyse wird ausgeführt...",
    });
  
    // CRITICAL OPTIMIZATION: Skip quick-search, go directly to optimized analyze-content
    // This single call handles: ValueSERP search + parallel content fetching + batched AI extraction
    const optimizedSearchData: SearchRequest = {
      articleNumber,
      productName,
      searchMethod: activeTab as "auto" | "url",
      properties: properties.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || undefined,
        expectedFormat: p.expectedFormat || undefined
      })),
      useAI: effectiveUseAI,
      aiModelProvider: effectiveUseAI ? modelProvider : undefined,
      openaiApiKey: (effectiveUseAI && modelProvider === 'openai' && openaiApiKey) ? openaiApiKey : undefined,
      useValueSerp: effectiveUseValueSerp, // Enable ValueSERP in analyze-content
      valueSerpApiKey: (effectiveUseValueSerp && valueSerpApiKey) ? valueSerpApiKey : undefined,
      domainPrioritizationEnabled: domainPrioritizationEnabledProp,
      maxResults: maxResults,
      pdfScraperEnabled: pdfScraperEnabled,
      searchEngine: "google",
    };

    // Add method-specific properties
    if (activeTab === "url") {
      if (!productUrl) {
        toast({
          title: "Validierungsfehler",
          description: "Produkt-URL ist für URL-basierte Suche erforderlich",
          variant: "destructive",
        });
        return;
      }
      optimizedSearchData.productUrl = productUrl;
    }
    
    // OPTIMIZED: Single API call replaces quick-search + analyze-content
    analyzeContentMutation.mutate(optimizedSearchData);
  };

  return (
    <div className="space-y-4">
      {/* Main Card with dark blue gradient background and modern effects */}
      <Card className="relative overflow-hidden border border-[color:rgba(23,195,206,0.15)] shadow-[0_8px_40px_rgba(12,36,67,0.4)] rounded-3xl">
        {/* Dark gradient background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--rb-primary-dark)] via-[color:rgba(12,36,67,0.97)] to-[color:rgba(12,36,67,0.92)] transition-all duration-700" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[color:rgba(23,195,206,0.12)] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[color:rgba(23,195,206,0.08)] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        <CardContent className="relative p-0">
          {/* Sticky Command Bar - Dark Glassmorphism + Glow */}
          <div className="sticky top-0 z-20 border-b border-[color:rgba(23,195,206,0.15)] bg-[color:rgba(12,36,67,0.85)] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                {/* Main Tab Navigation - 3D Pill Style with Glow */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Tab Buttons - Dark Theme with Lime/Cyan Glow on active */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[color:rgba(0,0,0,0.25)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
                    <button
                      onClick={() => handleTabChange("auto")}
                      className={`group relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap rounded-xl ${
                        activeTab === "auto"
                          ? "bg-gradient-to-r from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.9)] text-[color:var(--rb-primary-dark)] shadow-[0_4px_20px_rgba(200,250,100,0.4),0_2px_8px_rgba(0,0,0,0.2)] scale-[1.02]"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === "auto" ? "bg-[color:rgba(12,36,67,0.3)]" : "bg-white/10 group-hover:bg-white/15"}`}>
                        <Sparkles className={`h-4 w-4 transition-all duration-300 ${activeTab === "auto" ? "text-[color:var(--rb-primary-dark)]" : "text-white/70"}`} />
                      </div>
                      <span className="hidden sm:inline">Automatisch</span>
                      <span className="sm:hidden">Auto</span>
                      {activeTab === "auto" && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-[color:rgba(12,36,67,0.25)] text-[color:var(--rb-primary-dark)] rounded-full">
                          KI
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => handleTabChange("url")}
                      className={`group relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap rounded-xl ${
                        activeTab === "url"
                          ? "bg-gradient-to-r from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.9)] text-[color:var(--rb-primary-dark)] shadow-[0_4px_20px_rgba(200,250,100,0.4),0_2px_8px_rgba(0,0,0,0.2)] scale-[1.02]"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === "url" ? "bg-[color:rgba(12,36,67,0.3)]" : "bg-white/10 group-hover:bg-white/15"}`}>
                        <LinkIcon className={`h-4 w-4 transition-all duration-300 ${activeTab === "url" ? "text-[color:var(--rb-primary-dark)]" : "text-white/70"}`} />
                      </div>
                      <span className="hidden sm:inline">URL</span>
                      <span className="sm:hidden">URL</span>
                    </button>

                    <button
                      onClick={() => handleTabChange("pdf")}
                      className={`group relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap rounded-xl ${
                        activeTab === "pdf"
                          ? "bg-gradient-to-r from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.9)] text-[color:var(--rb-primary-dark)] shadow-[0_4px_20px_rgba(200,250,100,0.4),0_2px_8px_rgba(0,0,0,0.2)] scale-[1.02]"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === "pdf" ? "bg-[color:rgba(12,36,67,0.3)]" : "bg-white/10 group-hover:bg-white/15"}`}>
                        <FileText className={`h-4 w-4 transition-all duration-300 ${activeTab === "pdf" ? "text-[color:var(--rb-primary-dark)]" : "text-white/70"}`} />
                      </div>
                      <span className="hidden sm:inline">PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </button>

                    <button
                      onClick={() => handleTabChange("custom")}
                      className={`group relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap rounded-xl ${
                        activeTab === "custom"
                          ? "bg-gradient-to-r from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.9)] text-[color:var(--rb-primary-dark)] shadow-[0_4px_20px_rgba(200,250,100,0.4),0_2px_8px_rgba(0,0,0,0.2)] scale-[1.02]"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === "custom" ? "bg-[color:rgba(12,36,67,0.3)]" : "bg-white/10 group-hover:bg-white/15"}`}>
                        <Settings2 className={`h-4 w-4 transition-all duration-300 ${activeTab === "custom" ? "text-[color:var(--rb-primary-dark)]" : "text-white/70"}`} />
                      </div>
                      <span className="hidden sm:inline">Quellen</span>
                      <span className="sm:hidden">Quellen</span>
                    </button>
                  </div>

                  {/* Input Mode Toggle - Dark Theme Segmented Control */}
                  {activeTab === "auto" && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 font-medium hidden sm:inline">Eingabe:</span>
                      <div className="inline-flex items-center rounded-xl p-1 gap-1 bg-[color:rgba(0,0,0,0.25)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
                        <button
                          type="button"
                          onClick={() => setFileUploadMode(false)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            !fileUploadMode
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Einzeln</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFileUploadMode(true)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            fileUploadMode
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* URL Tab Toggle - Dark Theme */}
                  {activeTab === "url" && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 font-medium hidden sm:inline">Eingabe:</span>
                      <div className="inline-flex items-center rounded-xl p-1 gap-1 bg-[color:rgba(0,0,0,0.25)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
                        <button
                          type="button"
                          onClick={() => setUrlInputMode?.('manual')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            urlInputMode === 'manual'
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Einzeln</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUrlInputMode?.('file')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            urlInputMode === 'file'
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PDF Tab Toggle - Dark Theme */}
                  {activeTab === "pdf" && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/60 font-medium hidden sm:inline">Eingabe:</span>
                      <div className="inline-flex items-center rounded-xl p-1 gap-1 bg-[color:rgba(0,0,0,0.25)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
                        <button
                          type="button"
                          onClick={() => setPdfInputMode('manual')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            pdfInputMode === 'manual'
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Einzeln</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPdfInputMode('file')}
                          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                            pdfInputMode === 'file'
                              ? "bg-[color:var(--rb-lime)] text-[color:var(--rb-primary-dark)] shadow-[0_2px_12px_rgba(200,250,100,0.35)]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode Description Card - Dark with Lime accent */}
                <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-500 bg-[color:rgba(0,0,0,0.2)] ring-1 ring-white/10">
                  <div className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-[color:rgba(200,250,100,0.2)] to-[color:rgba(200,250,100,0.1)] shadow-[0_0_20px_rgba(200,250,100,0.2)]">
                    {activeTab === "auto" && <Sparkles className="h-5 w-5 text-[color:var(--rb-lime)]" />}
                    {activeTab === "custom" && <Settings2 className="h-5 w-5 text-[color:var(--rb-lime)]" />}
                    {activeTab === "url" && <LinkIcon className="h-5 w-5 text-[color:var(--rb-lime)]" />}
                    {activeTab === "pdf" && <FileText className="h-5 w-5 text-[color:var(--rb-lime)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white/95 transition-all duration-500">
                      {activeTab === "auto" && (fileUploadMode
                        ? "Excel-Datei mit Produktnamen hochladen"
                        : "Produktname eingeben")}
                      {activeTab === "custom" && "Excel mit Produktnamen und Quellen hochladen"}
                      {activeTab === "url" && (urlInputMode === 'file'
                        ? "Excel-Datei mit URLs hochladen"
                        : "Produkt-URL eingeben")}
                      {activeTab === "pdf" && (pdfInputMode === 'file'
                        ? "PDF-Dateien hochladen"
                        : "PDF-Datei hochladen")}
                    </p>
                    <p className="text-xs mt-1 text-white/50 transition-all duration-500">
                      {activeTab === "auto" && (fileUploadMode
                        ? "KI sucht automatisch passende Quellen im Web"
                        : "KI findet und analysiert Quellen automatisch")}
                      {activeTab === "custom" && "Sie bestimmen die Datenquellen (URLs und/oder PDFs)"}
                      {activeTab === "url" && (urlInputMode === 'file'
                        ? "Daten werden direkt aus den angegebenen URLs extrahiert"
                        : "Daten werden direkt von der URL extrahiert")}
                      {activeTab === "pdf" && (pdfInputMode === 'file'
                        ? "Mehrere Datenblätter auf einmal analysieren"
                        : "Datenblatt wird analysiert und Werte extrahiert")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area - Dark theme continuation */}
          <div className="relative p-5 bg-[color:rgba(12,36,67,0.6)]">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="auto" className="mt-0">
              <div className="space-y-3">
                {fileUploadMode ? (
                  <>
                  {/* Intuitive Excel Format Preview - Dark Theme */}
                  <div className="bg-[color:rgba(0,0,0,0.3)] backdrop-blur-sm border border-white/10 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.2)] overflow-hidden transition-all duration-300 hover:border-[color:rgba(200,250,100,0.2)]">
                    <div className="flex items-center justify-between px-4 py-3 bg-[color:rgba(0,0,0,0.2)] border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.8)] rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(200,250,100,0.3)]">
                          <FileSpreadsheet className="h-4 w-4 text-[color:var(--rb-primary-dark)]" />
                        </div>
                        <span className="text-sm font-semibold text-white/90">So sollte Ihre Excel-Datei aussehen:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/50">Formate:</span>
                        <span className="text-[10px] font-semibold text-[color:var(--rb-lime)] bg-[color:rgba(200,250,100,0.15)] px-2 py-0.5 rounded-full">.xlsx</span>
                        <span className="text-[10px] font-semibold text-[color:var(--rb-lime)] bg-[color:rgba(200,250,100,0.15)] px-2 py-0.5 rounded-full">.csv</span>
                      </div>
                    </div>
                    {/* Mini Excel Preview Table - Dark Theme */}
                    <div className="flex bg-[color:rgba(0,0,0,0.15)]">
                      {/* Row Numbers */}
                      <div className="bg-[color:rgba(0,0,0,0.2)] border-r border-white/10 flex-shrink-0">
                        <div className="h-8 w-9 flex items-center justify-center border-b border-white/10 bg-[color:rgba(0,0,0,0.15)]">
                          <span className="text-[10px] text-white/30"></span>
                        </div>
                        <div className="h-7 w-9 flex items-center justify-center border-b border-white/5 text-[10px] font-medium text-white/40">1</div>
                        <div className="h-7 w-9 flex items-center justify-center text-[10px] font-medium text-white/40">2</div>
                      </div>
                      {/* Column A - Artikelnummer (Optional) */}
                      <div className="flex-1 min-w-[140px] border-r border-white/5">
                        <div className="h-8 flex items-center justify-center border-b border-white/10 bg-[color:rgba(0,0,0,0.1)]">
                          <span className="text-[10px] font-bold text-white/50">A</span>
                        </div>
                        <div className="h-7 flex items-center px-3 border-b border-white/5 bg-[color:rgba(255,255,255,0.03)]">
                          <span className="text-xs font-medium text-white/70">Artikelnummer</span>
                          <span className="ml-1.5 text-[9px] text-white/40 italic">(optional)</span>
                        </div>
                        <div className="h-7 flex items-center px-3">
                          <span className="text-xs text-white/50 font-mono">AB-12345</span>
                        </div>
                      </div>
                      {/* Column B - Produktname (Required) */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="h-8 flex items-center justify-center border-b border-white/10 bg-[color:rgba(0,0,0,0.1)]">
                          <span className="text-[10px] font-bold text-white/50">B</span>
                        </div>
                        <div className="h-7 flex items-center px-3 border-b border-white/5 bg-[color:rgba(200,250,100,0.08)]">
                          <span className="text-xs font-semibold text-[color:var(--rb-lime)]">Produktname</span>
                          <span className="ml-1.5 text-[9px] text-red-400 font-bold">*pflicht</span>
                        </div>
                        <div className="h-7 flex items-center px-3">
                          <span className="text-xs text-white/70">Samsung Galaxy S24 Ultra</span>
                        </div>
                      </div>
                    </div>
                  </div>
                    
                    {selectedFileName && processedData.length > 0 ? (
                      /* File uploaded - Success indicator - Dark Theme */
                      <div className="relative rounded-2xl border border-[color:rgba(200,250,100,0.3)] bg-[color:rgba(0,0,0,0.25)] p-5 transition-all duration-300 shadow-[0_4px_20px_rgba(200,250,100,0.1)]">
                        <div className="flex items-center gap-5">
                          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.8)] flex items-center justify-center shadow-[0_8px_24px_rgba(200,250,100,0.35)]">
                            <FileCheck className="h-7 w-7 text-[color:var(--rb-primary-dark)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <p className="text-base font-bold text-white/95 truncate">{selectedFileName}</p>
                              <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[color:rgba(200,250,100,0.2)] text-[color:var(--rb-lime)] border border-[color:rgba(200,250,100,0.3)]">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Hochgeladen
                              </span>
                            </div>
                            <p className="text-sm text-white/60 mt-1.5 flex items-center gap-2">
                              <span className="font-semibold text-[color:var(--rb-lime)]">{processedData.length} Produkte</span>
                              <span className="text-white/30">•</span>
                              <span>Bereit zur Verarbeitung</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Reset file upload state
                              setSelectedFileName('');
                              setProcessedData([]);
                              if (fileUploadHook.resetFileUpload) {
                                fileUploadHook.resetFileUpload();
                              }
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="flex-shrink-0 p-2.5 rounded-xl hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all duration-200"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Empty state - File upload zone - Dark Theme */
                      <div
                        className="group flex items-center justify-center border-2 border-dashed border-white/20 rounded-2xl p-5 bg-[color:rgba(0,0,0,0.2)] transition-all duration-300 hover:border-[color:rgba(200,250,100,0.4)] hover:bg-[color:rgba(200,250,100,0.05)] cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-gradient-to-br from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.8)] rounded-2xl p-3.5 shadow-[0_8px_24px_rgba(200,250,100,0.25)] group-hover:shadow-[0_12px_32px_rgba(200,250,100,0.4)] transition-all duration-300 group-hover:scale-105">
                            <FileUp className="h-6 w-6 text-[color:var(--rb-primary-dark)]" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white/90 group-hover:text-[color:var(--rb-lime)] transition-colors">Produktdatei hochladen</p>
                            <p className="text-xs text-white/50 mt-0.5">
                              Excel oder CSV Datei (.xlsx, .xls, .csv)
                            </p>
                          </div>
                          <div className="ml-3 px-4 py-2 bg-[color:rgba(200,250,100,0.15)] text-[color:var(--rb-lime)] text-xs font-bold rounded-xl ring-1 ring-[color:rgba(200,250,100,0.25)] group-hover:bg-[color:var(--rb-lime)] group-hover:text-[color:var(--rb-primary-dark)] group-hover:shadow-[0_4px_16px_rgba(200,250,100,0.4)] transition-all duration-300">
                            Durchsuchen
                          </div>
                        </div>
                      </div>
                    )}

                    
                    {selectedFileName && processedData.length > 0 && (
                      <>
                            {processedData.length > 0 && (
                              <div className="w-full">
                                
                                <div className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                                  {/* Left side: All controls - Dark Theme */}
                                  <div className="w-full lg:w-auto overflow-x-auto">
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-3 bg-[color:rgba(0,0,0,0.25)] border border-white/10 rounded-2xl min-w-fit">
                                      {/* Property Table Selector */}
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[color:rgba(200,250,100,0.15)] rounded-lg">
                                          <Table2 className="h-3.5 w-3.5 text-[color:var(--rb-lime)]" />
                                          <span className="hidden sm:inline text-xs font-semibold text-[color:var(--rb-lime)]">Produkt:</span>
                                        </div>
                                        <Select
                                          value={currentDefaultTable?.id?.toString() || ''}
                                          onValueChange={(value) => {
                                            const tableId = parseInt(value);
                                            if (!isNaN(tableId)) {
                                              setDefaultTableMutation.mutate(tableId);
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="h-8 w-[90px] sm:w-[130px] text-xs font-medium bg-[color:rgba(0,0,0,0.3)] text-white/90 border-white/20 rounded-lg hover:border-[color:rgba(200,250,100,0.4)] transition-colors">
                                            <SelectValue placeholder="Tabelle" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {propertyTables.map((table) => (
                                              <SelectItem key={table.id} value={table.id.toString()}>
                                                {table.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      {/* PDF Extractor Toggle - Dark Theme */}
                                      <div className="flex items-center gap-2 pl-3 border-l border-white/15">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[color:rgba(249,115,22,0.15)] rounded-lg">
                                          <FileText className="h-3.5 w-3.5 text-orange-400" />
                                          <span className="hidden sm:inline text-xs font-semibold text-orange-400">PDF Extractor</span>
                                        </div>
                                        <Switch
                                          checked={pdfScraperEnabled}
                                          onCheckedChange={setPdfScraperEnabled}
                                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-amber-500 data-[state=checked]:shadow-[0_0_12px_rgba(249,115,22,0.4)] scale-90"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Right side: Action button - Lime Glow */}
                                  {(isProcessing || isBatchProcessingFromStatus) ? (
                                    <button
                                      onClick={handleStopBatchSearch}
                                      className="group w-full lg:w-auto justify-center text-sm font-bold h-12 bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 py-3 px-6 rounded-xl flex items-center gap-2.5 transition-all duration-300 shadow-[0_4px_16px_rgba(239,68,68,0.35)] hover:shadow-[0_8px_24px_rgba(239,68,68,0.45)] hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                                    >
                                      <Square className="h-5 w-5 fill-current drop-shadow-sm" />
                                      <span className="hidden sm:inline">Abbrechen</span>
                                      <span className="sm:hidden">Stop</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={handleBatchSearch}
                                      className="group w-full lg:w-auto justify-center text-sm font-bold h-12 bg-gradient-to-r from-[color:var(--rb-lime)] to-[color:rgba(200,250,100,0.85)] text-[color:var(--rb-primary-dark)] hover:from-[color:rgba(200,250,100,0.9)] hover:to-[color:var(--rb-lime)] py-3 px-6 rounded-xl flex items-center gap-2.5 transition-all duration-300 shadow-[0_4px_20px_rgba(200,250,100,0.4)] hover:shadow-[0_8px_30px_rgba(200,250,100,0.5)] hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                                    >
                                      <Sparkles className="h-5 w-5 drop-shadow-sm group-hover:animate-pulse" />
                                      <span className="hidden sm:inline">Suchen & Extrahieren</span>
                                      <span className="sm:hidden">Extrahieren</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      /* Manual Input Mode - Dark Theme Card */
                      <div className="bg-[color:rgba(0,0,0,0.25)] backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                          <div className="space-y-2">
                            <Label htmlFor="auto-artikelnummer" className="text-sm font-semibold text-white/80 block">Artikelnummer</Label>
                            <Input 
                              id="auto-artikelnummer" 
                              placeholder="z.B. AB12345 (optional)"
                              value={articleNumber}
                              onChange={(e) => setArticleNumber(e.target.value)}
                              className="h-11 border-white/15 bg-[color:rgba(0,0,0,0.3)] text-white placeholder:text-white/40 rounded-xl focus:border-[color:var(--rb-lime)] focus:ring-2 focus:ring-[color:rgba(200,250,100,0.2)] transition-all duration-200 hover:border-white/25"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="auto-produktname" className="text-sm font-semibold text-white/80 block">
                              Produktname <span className="text-[color:var(--rb-lime)] font-bold">*</span>
                            </Label>
                            <Input 
                              id="auto-produktname" 
                              placeholder="z.B. Samsung Galaxy S21"
                              value={productName}
                              onChange={(e) => setProductName(e.target.value)}
                              className="h-11 border-[color:rgba(200,250,100,0.25)] bg-[color:rgba(0,0,0,0.3)] text-white placeholder:text-white/40 rounded-xl focus:border-[color:var(--rb-lime)] focus:ring-2 focus:ring-[color:rgba(200,250,100,0.25)] transition-all duration-200 hover:border-[color:rgba(200,250,100,0.4)]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    

                  </div>
                </TabsContent>
                
                <TabsContent value="url" className="mt-0">
                  <UrlSearchTab
                    onSearchResult={(result) => {
                      // Store result in appropriate mode-specific state
                      if (urlInputMode === 'file') {
                        setUrlFileModeResults(result);
                      } else {
                        setUrlManualModeResults(result);
                      }
                      onSearchResult(result);
                    }}
                    properties={properties}
                    openaiApiKey={openaiApiKey}
                    
                    useAI={useAI}
                    modelProvider={modelProvider}
                    processingStatus={urlInputMode === 'file' ? urlFileModeProcessingStatus : urlManualModeProcessingStatus}
                    setProcessingStatus={urlInputMode === 'file' ? setUrlFileModeProcessingStatus : setUrlManualModeProcessingStatus}
                    inputMode={urlInputMode}
                    currentResult={urlInputMode === 'file' ? urlFileModeResults : urlManualModeResults}
                    manualModeResult={urlManualModeResults}
                    onExtractionProgressChange={(progress) => {
                      // Only update progress for manual mode
                      if (urlInputMode === 'manual') {
                        setUrlExtractionProgress(progress);
                      }
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="pdf" className="mt-0">
                  <PdfSearchTab
                    onSearchResult={(result) => {
                      // Store result in appropriate mode-specific state
                      if (pdfInputMode === 'file') {
                        setPdfFileModeResults(result);
                      } else {
                        setPdfManualModeResults(result);
                      }
                      onSearchResult(result);
                    }}
                    properties={properties}
                    openaiApiKey={openaiApiKey}
                    
                    useAI={useAI}
                    modelProvider={modelProvider}
                    inputMode={pdfInputMode}
                    onClearResults={onClearResults}
                    currentResult={pdfInputMode === 'file' ? pdfFileModeResults : pdfManualModeResults}
                    manualModeResult={pdfManualModeResults}
                    processingStatus={pdfProcessingStatus}
                    onProcessingStatusChange={setPdfProcessingStatus}
                  />
                </TabsContent>
                
                <TabsContent value="custom" className="mt-0">
                  <CustomSearchTab
                    onSearchResult={(result) => {
                      // Store result in custom mode state
                      setCustomModeResults(result);
                      setCustomAllResults(prev => [...prev, result]);
                      onSearchResult(result, 'custom');
                    }}
                    properties={properties}
                    openaiApiKey={openaiApiKey}
                    useAI={useAI}
                    modelProvider={modelProvider}
                    onClearResults={() => {
                      setCustomProcessingStatus([]);
                      setCustomAllResults([]);
                      setCustomModeResults(null);
                      if (onClearResults) onClearResults();
                    }}
                    processingStatus={customProcessingStatus}
                    setProcessingStatus={setCustomProcessingStatus}
                  />
                </TabsContent>
                


                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-t border-gray-100 pt-4 mt-4">
                  {/* Left side with search controls */}
                  <div className="w-full sm:w-auto overflow-x-auto">
                    {/* Search Controls for Manual Input Mode - Only show when in Auto tab and Manual mode */}
                    {!fileUploadMode && activeTab === "auto" && (
                      <div className="w-full sm:w-auto">
                        {/* Compact Search Options - Responsive */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-fit">
                          {/* Property Table Selector */}
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="flex items-center gap-1">
                              <Table2 className="h-3 w-3 text-blue-600" />
                              <span className="hidden sm:inline text-xs font-medium text-blue-700">Produkt:</span>
                            </div>
                            <Select
                              value={currentDefaultTable?.id?.toString() || ''}
                              onValueChange={(value) => {
                                const tableId = parseInt(value);
                                if (!isNaN(tableId)) {
                                  setDefaultTableMutation.mutate(tableId);
                                }
                              }}
                            >
                              <SelectTrigger className="h-6 w-[80px] sm:w-[120px] text-xs bg-white border-gray-300">
                                <SelectValue placeholder="Tabelle" />
                              </SelectTrigger>
                              <SelectContent>
                                {propertyTables.map((table) => (
                                  <SelectItem key={table.id} value={table.id.toString()}>
                                    {table.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* PDF Extractor Toggle */}
                          <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 border-l border-gray-300">
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3 text-orange-600" />
                              <span className="hidden sm:inline text-xs font-medium text-orange-700">PDF Extractor</span>
                            </div>
                            <Switch
                              checked={pdfScraperEnabled}
                              onCheckedChange={setPdfScraperEnabled}
                              className="data-[state=checked]:bg-orange-600 scale-75"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Hidden file input (always available but invisible) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  
                  {/* Right side with search button */}
                  <div className="w-full sm:w-auto flex justify-end">
                    {/* Standalone Search Button - Only show for Automated tab */}
                    {!fileUploadMode && activeTab === "auto" && (
                      (quickSearchMutation.isPending || analyzeContentMutation.isPending) ? (
                        <Button
                          onClick={handleStopManualSearch}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[color:var(--rb-error)] hover:bg-[color:rgba(229,57,53,0.92)] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:shadow-lg border-0"
                          size="sm"
                        >
                          <Square className="h-4 w-4 fill-current" />
                          <span className="text-xs sm:text-sm font-medium">Abbrechen</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSearch}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[color:var(--rb-primary)] hover:bg-[color:rgba(12,36,67,0.92)] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:shadow-lg sm:hover:scale-105 active:scale-95 border-0"
                          size="sm"
                        >
                          <Globe className="h-4 w-4" />
                          <span className="hidden sm:inline text-sm font-medium">Suchen & Extrahieren</span>
                          <span className="sm:hidden text-xs font-medium">Extrahieren</span>
                        </Button>
                      )
                    )}
                  </div>
                </div>
          </Tabs>
          </div>
        </CardContent>
        
        {/* Integrated Results Section - Tab-specific display */}
        {(() => {
          // Determine which results to show based on active tab AND input mode
          let tabSearchResult: SearchResponse | null = null;
          let tabAllSearchResults: SearchResponse[] = [];
          let showResults = false;
          let hasActualResults = false;
          let completedResultsCount = 0;
          
          if (activeTab === 'auto') {
            // For auto tab, ONLY use internal mode-specific results, ignore props
            if (fileUploadMode) {
              tabSearchResult = fileModeSearchResult;
              tabAllSearchResults = fileModeAllResults;
              // Count only completed items with actual results
              completedResultsCount = processingStatus.filter(item => item.status === 'completed' && item.result).length;
              hasActualResults = completedResultsCount > 0 || fileModeAllResults.length > 0;
              showResults = true; // Always show results section in Automatisch tab
            } else {
              tabSearchResult = manualModeSearchResult;
              tabAllSearchResults = manualModeAllResults;
              hasActualResults = !!(manualModeSearchResult || manualModeAllResults.length > 0);
              completedResultsCount = manualModeAllResults.length || (manualModeSearchResult ? 1 : 0);
              showResults = true; // Always show results section in Automatisch tab
            }
          } else if (activeTab === 'url') {
            // For URL tab, use URL-specific results based on URL input mode
            if (urlInputMode === 'file') {
              tabSearchResult = urlFileModeResults;
              tabAllSearchResults = urlFileModeProcessingStatus.filter(item => item.result).map(item => item.result!);
              completedResultsCount = urlFileModeProcessingStatus.filter(item => item.status === 'completed' && item.result).length;
              hasActualResults = completedResultsCount > 0;
              showResults = true; // Always show results section in URL tab
            } else {
              tabSearchResult = urlManualModeResults;
              tabAllSearchResults = urlManualModeProcessingStatus.filter(item => item.result).map(item => item.result!);
              completedResultsCount = urlManualModeProcessingStatus.filter(item => item.status === 'completed' && item.result).length;
              hasActualResults = completedResultsCount > 0;
              showResults = true; // Always show results section in URL tab
            }
          } else if (activeTab === 'pdf') {
            // For PDF tab, use PDF-specific results based on PDF input mode
            if (pdfInputMode === 'file') {
              tabSearchResult = pdfFileModeResults;
              tabAllSearchResults = pdfFileModeResults ? [pdfFileModeResults] : [];
              hasActualResults = !!pdfFileModeResults;
              completedResultsCount = pdfFileModeResults ? 1 : 0;
              showResults = !!pdfFileModeResults;
            } else {
              tabSearchResult = pdfManualModeResults;
              tabAllSearchResults = pdfManualModeResults ? [pdfManualModeResults] : [];
              hasActualResults = !!pdfManualModeResults;
              completedResultsCount = pdfManualModeResults ? 1 : 0;
              showResults = !!pdfManualModeResults;
            }
          } else if (activeTab === 'custom') {
            // For Custom tab, use combined results
            tabSearchResult = customModeResults;
            tabAllSearchResults = customAllResults;
            completedResultsCount = customProcessingStatus.filter(item => item.status === 'completed' && item.result).length;
            hasActualResults = completedResultsCount > 0 || customAllResults.length > 0;
            showResults = true; // Always show results section in Custom tab
          }
          
          // Remove the check - always show results section
          
          return (
            <div className="border-t border-gray-200 bg-gradient-to-br from-blue-50/50 to-purple-50/20">
              <div className="px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 bg-gradient-to-b from-green-500 to-blue-600 rounded-full"></div>
                    <div>
                      <h3 className="text-base font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        Suchergebnisse
                      </h3>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResultsExpanded(!resultsExpanded)}
                    className="flex items-center gap-2 bg-white/70 hover:bg-white border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 transition-all duration-200"
                  >
                    {resultsExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Minimieren
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Erweitern
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar for URL Tab Manual Mode */}
              {activeTab === 'url' && urlInputMode === 'manual' && urlExtractionProgress.status !== 'idle' && (
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-blue-800">Datenextraktion läuft...</h4>
                      <span className="text-sm font-medium text-blue-600">{urlExtractionProgress.progress}%</span>
                    </div>
                    
                    <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${urlExtractionProgress.progress}%` }}
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {urlExtractionProgress.status === 'web-scraping' && (
                        <>
                          <Globe className="h-4 w-4 text-blue-600 animate-pulse" />
                          <span className="text-sm text-blue-700">{urlExtractionProgress.message}</span>
                        </>
                      )}
                      {urlExtractionProgress.status === 'ai-processing' && (
                        <>
                          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                          <span className="text-sm text-blue-700">{urlExtractionProgress.message}</span>
                        </>
                      )}
                      {urlExtractionProgress.status === 'complete' && (
                        <>
                          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-green-700">{urlExtractionProgress.message}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            
            {resultsExpanded && (
              <div className="p-4">
                {(activeTab === 'auto' && fileUploadMode && processingStatus.length > 0) ||
                 (activeTab === 'url' && ((urlInputMode === 'file' && urlFileModeProcessingStatus.length > 0) || (urlInputMode === 'manual' && urlManualModeProcessingStatus.length > 0))) ||
                 (activeTab === 'custom' && customProcessingStatus.length > 0) ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    {/* Modern Header */}
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">Verarbeitungsergebnisse</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(() => {
                                const currentProcessingStatus = activeTab === 'custom'
                                  ? customProcessingStatus
                                  : activeTab === 'url'
                                    ? (urlInputMode === 'file' ? urlFileModeProcessingStatus : urlManualModeProcessingStatus)
                                    : processingStatus;
                                const completed = currentProcessingStatus.filter(item => item.status === 'completed').length;
                                const total = currentProcessingStatus.length;
                                return `${completed} von ${total} Produkten verarbeitet`;
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Modern View Toggle */}
                          <div className="flex items-center bg-gray-100 rounded-lg p-1 shadow-inner">
                            <button
                              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                                tableViewMode === 'list'
                                  ? 'bg-white shadow-sm text-gray-800'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setTableViewMode('list')}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                              Liste
                            </button>
                            <button
                              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1.5 ${
                                tableViewMode === 'data'
                                  ? 'bg-white shadow-sm text-gray-800'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setTableViewMode('data' as any)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Daten
                            </button>
                          </div>
                          {/* Export Button */}
                          {(() => {
                            const currentProcessingStatus = activeTab === 'custom'
                              ? customProcessingStatus
                              : activeTab === 'url'
                                ? (urlInputMode === 'file' ? urlFileModeProcessingStatus : urlManualModeProcessingStatus)
                                : processingStatus;
                            return currentProcessingStatus.some(item => item.status === 'completed');
                          })() && (
                            <Button
                              size="sm"
                              className="h-8 px-4 text-xs font-medium bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-sm"
                              onClick={() => exportTableData()}
                            >
                              <Download className="h-3.5 w-3.5 mr-1.5" />
                              Exportieren
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact Color Legend */}
                    <div className="px-5 py-2 bg-gray-50/50 border-b border-gray-100">
                      <div className="flex items-center gap-5 text-[11px] text-gray-500">
                        <span className="font-medium text-gray-600">Datenqualität:</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full shadow-sm"></div>
                          <span>1 Quelle</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-gradient-to-br from-lime-400 to-green-500 rounded-full shadow-sm"></div>
                          <span>2 Quellen</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full shadow-sm"></div>
                          <span>3+ Quellen</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full shadow-sm"></div>
                          <span>KI-Analysiert</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-x-auto">
                      <div className="overflow-y-auto" style={{ maxHeight: '22rem' }}>
                      {tableViewMode === 'list' ? (
                        <table className="w-full text-sm min-w-max">
                          <thead className="bg-gradient-to-r from-slate-100 to-gray-100 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Produkt</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Fortschritt</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Aktionen</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(() => {
                              const currentProcessingStatus = activeTab === 'custom'
                                ? customProcessingStatus
                                : activeTab === 'url'
                                  ? (urlInputMode === 'file' ? urlFileModeProcessingStatus : urlManualModeProcessingStatus)
                                  : processingStatus;
                              return currentProcessingStatus.map((item, index) => (
                              <tr key={index} className="hover:bg-blue-50/50 transition-colors duration-150">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{item.productName}</p>
                                      <p className="text-xs text-gray-400 truncate">{item.articleNumber || 'Keine Art.-Nr.'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {item.status === 'pending' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                        Wartend
                                      </span>
                                    )}
                                    {item.status === 'searching' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Suche läuft
                                      </span>
                                    )}
                                    {item.status === 'browser-rendering' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        JS Rendering
                                      </span>
                                    )}
                                    {item.status === 'extracting' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                        <Sparkles className="h-3 w-3" />
                                        KI Extraktion
                                      </span>
                                    )}
                                    {item.status === 'completed' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Abgeschlossen
                                      </span>
                                    )}
                                    {item.status === 'failed' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        Fehlgeschlagen
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          item.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                          item.status === 'failed' ? 'bg-gradient-to-r from-red-400 to-rose-500' :
                                          'bg-gradient-to-r from-blue-400 to-indigo-500'
                                        }`}
                                        style={{ width: `${item.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500 w-8">{item.progress}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    {item.result && (
                                      <>
                                        <button
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                          onClick={() => {
                                            if (confirm(`Ergebnis für ${item.productName} löschen?`)) {
                                              setProcessingStatus(prev => prev.filter((_, i) => i !== index));
                                              toast({
                                                title: "Ergebnis gelöscht",
                                                description: `${item.productName} wurde entfernt`,
                                              });
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ));
                            })()}
                          </tbody>
                        </table>
                      ) : (
                        <div>
                          {(() => {
                            const currentProcessingStatus = activeTab === 'custom'
                              ? customProcessingStatus
                              : activeTab === 'url'
                                ? (urlInputMode === 'file' ? urlFileModeProcessingStatus : urlManualModeProcessingStatus)
                                : processingStatus;
                            
                            if (currentProcessingStatus.length === 0) return null;
                            
                            return (() => {
                            // Create clean column list based on Eigenschaften properties only
                            const orderedPropertyKeys: string[] = [];
                            
                            // Add standard columns first (only the essential ones)
                            orderedPropertyKeys.push("Status", "Artikelnummer", "Produktname");
                            
                            // Add properties in the order they appear in the properties array
                            // This preserves the column order from the original Excel file
                            properties.forEach(prop => {
                              // Skip duplicates and system properties
                              if (!orderedPropertyKeys.includes(prop.name) && 
                                  prop.name !== "Artikelnummer" && 
                                  prop.name !== "Produktname" && 
                                  prop.name !== "Status" &&
                                  prop.name !== "Artikel Nr." &&
                                  prop.name !== "Produkt Name" &&
                                  prop.name !== "id" &&
                                  prop.name !== "productName" &&
                                  !prop.name.startsWith('__')) {
                                orderedPropertyKeys.push(prop.name);
                              }
                            });
                            
                            // Track which products have data to show proper property columns
                            let hasCompletedProducts = false;
                            
                            // Check if we have completed products for display
                            currentProcessingStatus.forEach(item => {
                              if (item.status === 'completed' && item.result?.products?.[0]) {
                                hasCompletedProducts = true;
                              }
                            });
                            
                            // Use the clean ordered property keys
                            const propertyKeys = orderedPropertyKeys;
                            
                            return (
                              <table className="w-full text-sm border-collapse min-w-max">
                                <thead className="bg-gradient-to-r from-slate-100 to-gray-100 sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2.5 text-left whitespace-nowrap sticky left-0 bg-gradient-to-r from-slate-100 to-gray-100 z-20 border-b border-gray-200">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">#</span>
                                      </div>
                                    </th>
                                    {propertyKeys.map(key => (
                                      <th key={key} className="px-3 py-2.5 text-left whitespace-nowrap border-b border-gray-200">
                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{key}</span>
                                      </th>
                                    ))}
                                    <th className="px-3 py-2.5 text-right whitespace-nowrap border-b border-gray-200">
                                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Aktionen</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {currentProcessingStatus.map((item, index) => {
                                    const product = item.result?.products?.[0];
                                    const properties = product?.properties || {};
                                    
                                    return (
                                      <tr key={index} className="hover:bg-blue-50/30 transition-colors duration-150 group">
                                        <td className="px-3 py-2.5 whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-gray-100">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                            />
                                            <span className="text-xs font-medium text-gray-400">{index + 1}</span>
                                          </div>
                                        </td>
                                        {propertyKeys.map(key => {
                                          if (key === 'Status') {
                                            return (
                                              <td key={key} className="px-3 py-2.5 whitespace-nowrap">
                                                {item.status === 'pending' && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600">
                                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                                    Wartend
                                                  </span>
                                                )}
                                                {item.status === 'searching' && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Suche
                                                  </span>
                                                )}
                                                {item.status === 'extracting' && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600">
                                                    <Sparkles className="h-3 w-3" />
                                                    KI
                                                  </span>
                                                )}
                                                {item.status === 'completed' && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-600">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    OK
                                                  </span>
                                                )}
                                                {item.status === 'failed' && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-600">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                    Fehler
                                                  </span>
                                                )}
                                              </td>
                                            );
                                          } else if (key === 'Artikelnummer') {
                                            return (
                                              <td key={key} className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                                                  {item.articleNumber || '—'}
                                                </span>
                                              </td>
                                            );
                                          } else if (key === 'Produktname') {
                                            return (
                                              <td key={key} className="px-3 py-2.5 whitespace-nowrap max-w-[200px]">
                                                <span className="text-sm font-medium text-gray-800 truncate block" title={item.productName}>
                                                  {item.productName}
                                                </span>
                                              </td>
                                            );
                                          } else if (product && properties[key]) {
                                            const propData = properties[key];
                                            const hasValue = propData.value && propData.value !== 'Nicht gefunden' && propData.value !== 'Not found' && propData.value !== 'Not Found' && propData.value.trim() !== '';
                                            const sourceCount = propData.consistencyCount || propData.sources?.length || 0;
                                            
                                            let bgColor = '';
                                            let borderColor = 'border-gray-200';
                                            let dotColor = 'bg-gray-300';
                                            let consistencyInfo = '';
                                            
                                            if (hasValue) {
                                              if (sourceCount === 1) {
                                                bgColor = 'bg-yellow-50';
                                                borderColor = 'border-yellow-200';
                                                dotColor = 'bg-yellow-500';
                                                consistencyInfo = `1 bestätigte Quelle`;
                                              } else if (sourceCount === 2) {
                                                bgColor = 'bg-lime-50';
                                                borderColor = 'border-lime-200';
                                                dotColor = 'bg-lime-500';
                                                consistencyInfo = `2 bestätigte Quellen`;
                                              } else if (sourceCount >= 3) {
                                                bgColor = 'bg-green-50';
                                                borderColor = 'border-green-200';
                                                dotColor = 'bg-green-500';
                                                consistencyInfo = `${sourceCount} bestätigte Quellen`;
                                              }
                                            }
                                            
                                            const getConfidenceColor = (confidence: number) => {
                                              if (confidence >= 85) return "bg-green-500";
                                              if (confidence >= 70) return "bg-yellow-500";
                                              if (confidence >= 30) return "bg-orange-500";
                                              return "bg-red-300";
                                            };
                                            
                                            return (
                                              <td key={key} className={`px-3 py-2.5 whitespace-nowrap ${bgColor}`}>
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div className="flex items-center gap-1.5 cursor-help max-w-[150px]">
                                                        <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}></div>
                                                        <span className={`text-sm truncate ${!hasValue ? 'text-gray-400 italic' : 'text-gray-700'}`} title={propData.value}>
                                                          {propData.value || '—'}
                                                        </span>
                                                      </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-sm p-4 bg-white border border-gray-200 shadow-xl rounded-lg">
                                                      <div className="space-y-3">
                                                        <div>
                                                          <div className="text-xs font-medium text-gray-500 mb-1">Eigenschaft</div>
                                                          <p className="text-sm text-gray-800 font-medium">{key}</p>
                                                        </div>
                                                        <div>
                                                          <div className="text-xs font-medium text-gray-500 mb-1">Wert</div>
                                                          <p className="text-sm text-gray-800 font-medium">
                                                            {hasValue ? propData.value : 'Keine Daten gefunden'}
                                                          </p>
                                                        </div>
                                                        <div>
                                                          <div className="text-xs font-medium text-gray-500 mb-1">Bestätigte Quellen</div>
                                                          <div className="flex items-center gap-2">
                                                            {(() => {
                                                              const count = propData.consistencyCount || propData.sources?.length || 0;
                                                              let color = '';
                                                              
                                                              if (count === 0) {
                                                                color = 'bg-gray-400';
                                                              } else if (count === 1) {
                                                                color = 'bg-yellow-500';
                                                              } else if (count === 2) {
                                                                color = 'bg-lime-500';
                                                              } else {
                                                                color = 'bg-green-500';
                                                              }
                                                              
                                                              return (
                                                                <>
                                                                  <div className={`w-2 h-2 rounded-full ${color}`}></div>
                                                                  <span className="text-sm font-medium text-gray-700">
                                                                    {count} {count === 1 ? 'Quelle' : 'Quellen'}
                                                                  </span>
                                                                </>
                                                              );
                                                            })()}
                                                          </div>
                                                        </div>
                                                        {propData.sources && propData.sources.length > 0 && (
                                                          <div>
                                                            <div className="text-xs font-medium text-gray-500 mb-2">Quellen ({propData.sources.length})</div>
                                                            <div className="space-y-1">
                                                              {propData.sources.map((source: any, idx: number) => (
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
                                          } else {
                                            return (
                                              <td key={key} className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="text-gray-300">—</span>
                                              </td>
                                            );
                                          }
                                        })}
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                          <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.result && (
                                              <>
                                                <button
                                                  className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                                                  title="Löschen"
                                                  onClick={() => {
                                                    if (confirm(`Ergebnis für ${item.productName} löschen?`)) {
                                                      setProcessingStatus(prev => prev.filter((_, i) => i !== index));
                                                      toast({
                                                        title: "Gelöscht",
                                                        description: `${item.productName} entfernt`,
                                                      });
                                                    }
                                                  }}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            );
                          })();
                          })()}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                ) : (activeTab === 'pdf' && pdfInputMode === 'file' && pdfProcessingStatus && pdfProcessingStatus.length > 0) ? (
                  <PdfBatchResultsTable
                    processingStatus={pdfProcessingStatus}
                    properties={properties}
                    onSearchResult={onSearchResult}
                    onDeleteResult={(index) => {
                      setPdfProcessingStatus(prev => prev.filter((_, i) => i !== index));
                    }}
                    onExportAll={exportTableData}
                  />
                ) : (
                  <ResultsSection
                    searchResult={tabSearchResult}
                    allSearchResults={tabAllSearchResults}
                    onExport={onExport || (() => {})}
                    onDeleteResult={onDeleteResult}
                    onSearchResult={onSearchResult}
                    isPdfMode={isPdfMode}
                    isSearching={isSearching}
                  />
                )}
              </div>
            )}
          </div>
          );
        })()}
      </Card>
      
      {/* Excel Validation Error Dialog for Automated Tab */}
      <ExcelValidationErrorDialog
        open={showValidationErrorDialog}
        onOpenChange={setShowValidationErrorDialog}
        error={validationError}
      />
    </div>
  );
}