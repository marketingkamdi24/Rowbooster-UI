import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { SearchResponse, ProductProperty } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { Loader2, Globe, Download, FileText, Upload, Plus, Trash2, FileUp, Search, X, FolderOpen, ChevronDown, ChevronUp, Copy, RefreshCw, AlertCircle, Table2 } from "lucide-react";
import useFileUpload from "@/hooks/useFileUpload";
import * as XLSX from "xlsx-js-style";
import { useMultiPDFExtractor } from "@/hooks/use-multi-pdf-extractor";
import { extractTextFromPDF, copyTextToClipboard, downloadTextAsFile, sanitizeTextContent } from "@/lib/pdf-utils";

interface UrlSearchTabProps {
  onSearchResult: (result: SearchResponse) => void;
  properties: ProductProperty[];
  openaiApiKey?: string;
  useAI?: boolean;
  modelProvider?: 'openai';
  processingStatus: Array<{
    id: string;
    articleNumber: string;
    productName: string;
    status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
    progress: number;
    result: SearchResponse | null;
    error?: string;
  }>;
  setProcessingStatus: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    articleNumber: string;
    productName: string;
    status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
    progress: number;
    result: SearchResponse | null;
    error?: string;
  }>>>;
  inputMode?: 'manual' | 'file';
  currentResult?: SearchResponse | null;
  manualModeResult?: SearchResponse | null;
  onExtractionProgressChange?: (progress: {
    status: 'idle' | 'web-scraping' | 'ai-processing' | 'complete';
    progress: number;
    message: string;
  }) => void;
}

interface UrlProduct {
  id: string;
  articleNumber: string;
  productName: string;
  productUrl: string;
}

export default function UrlSearchTab({ 
  onSearchResult, 
  properties,
  openaiApiKey = "",
  useAI = false,
  modelProvider = 'openai',
  processingStatus,
  setProcessingStatus,
  inputMode = 'manual',
  currentResult,
  manualModeResult,
  onExtractionProgressChange
}: UrlSearchTabProps) {
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
  
  const [singleProduct, setSingleProduct] = useState<UrlProduct>({
    id: '1',
    articleNumber: '',
    productName: '',
    productUrl: ''
  });
  
  const [urlProducts, setUrlProducts] = useState<UrlProduct[]>([]);
  const [parallelProcesses, setParallelProcesses] = useState<number>(3);
  const [tableViewMode, setTableViewMode] = useState<'list' | 'data'>('list');
  const [showPreviousResults, setShowPreviousResults] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    status: 'idle' | 'web-scraping' | 'ai-processing' | 'complete';
    progress: number;
    message: string;
  }>({ status: 'idle', progress: 0, message: '' });

  // PDF extraction states
  const [isPdfExtractionEnabled, setIsPdfExtractionEnabled] = useState<boolean>(false);
  const [pdfFolder, setPdfFolder] = useState<FileList | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFolderInputRef = useRef<HTMLInputElement>(null);
  
  // Use ref to store the callback to prevent infinite loops
  const onExtractionProgressChangeRef = useRef(onExtractionProgressChange);
  onExtractionProgressChangeRef.current = onExtractionProgressChange;

  // Notify parent component of extraction progress changes
  // Only run when extractionProgress status or progress changes, not on function reference changes
  const prevExtractionProgressRef = useRef<string>('');
  useEffect(() => {
    const progressKey = `${extractionProgress.status}-${extractionProgress.progress}`;
    if (progressKey !== prevExtractionProgressRef.current) {
      prevExtractionProgressRef.current = progressKey;
      if (onExtractionProgressChangeRef.current) {
        onExtractionProgressChangeRef.current(extractionProgress);
      }
    }
  }, [extractionProgress.status, extractionProgress.progress, extractionProgress.message]);

  const { fileInputRef, handleFileChange, selectedFileName, processedData } = useFileUpload();
  
  // Use the multi-PDF extractor hook for manual mode
  const {
    pdfs,
    combinedText,
    stats,
    isProcessing,
    canAddMore,
    hasValidPDFs,
    hasErrors,
    maxFiles,
    addPDFFile,
    removePDF,
    clearAllPDFs,
    retryPDF,
    updateCombinedText
  } = useMultiPDFExtractor();

  // Parse content from URL mutation
  const parseUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/parse-url", { url });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Inhalt erfolgreich geparst",
        description: `Inhalt wurde erfolgreich von der URL extrahiert`,
      });
    },
    onError: (error) => {
      toast({
        title: "URL-Parsing fehlgeschlagen",
        description: (error as Error).message || "Inhalt konnte nicht von der URL extrahiert werden",
        variant: "destructive",
      });
    },
  });

  // Download parsed content mutation
  const downloadContentMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/download-parsed-content", { url });
      return response.json();
    },
    onSuccess: (data) => {
      // Create and download the file
      const blob = new Blob([data.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download erfolgreich",
        description: `Geparster Inhalt heruntergeladen als ${data.filename}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Download fehlgeschlagen",
        description: (error as Error).message || "Geparster Inhalt konnte nicht heruntergeladen werden",
        variant: "destructive",
      });
    },
  });

  // Extract product data mutation
  const extractDataMutation = useMutation({
    mutationFn: async (product: UrlProduct) => {
      // Update progress to web scraping
      setExtractionProgress({
        status: 'web-scraping',
        progress: 30,
        message: 'Webseite wird geladen und analysiert...'
      });

      const response = await apiRequest("POST", "/api/extract-url-product-data", {
        url: product.productUrl,
        productName: product.productName,
        articleNumber: product.articleNumber,
        properties: properties.map(p => ({ 
          id: p.id, 
          name: p.name, 
          description: p.description || undefined, 
          expectedFormat: p.expectedFormat || undefined
        })),
        useAI: useAI,
        aiModelProvider: useAI ? modelProvider : undefined,
        openaiApiKey: useAI ? openaiApiKey : undefined,
      });

      // Update progress to AI processing
      setExtractionProgress({
        status: 'ai-processing',
        progress: 70,
        message: 'KI analysiert die Produktdaten...'
      });

      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      // Invalidate token usage cache to show updated stats immediately
      invalidateTokenUsage();
      
      console.log("URL extraction result:", data);
      // Set progress to complete
      setExtractionProgress({
        status: 'complete',
        progress: 100,
        message: 'Datenextraktion abgeschlossen!'
      });
      
      // Reset progress after a delay
      setTimeout(() => {
        setExtractionProgress({ status: 'idle', progress: 0, message: '' });
      }, 2000);

      // Always call onSearchResult - parent will handle storing in appropriate mode
      onSearchResult(data);
      toast({
        title: "Datenextraktion abgeschlossen",
        description: `Produktdaten erfolgreich extrahiert mit ${useAI ? 'KI-verstärktem' : 'einfachem'} Parsing`,
      });
    },
    onError: (error) => {
      setExtractionProgress({ status: 'idle', progress: 0, message: '' });
      toast({
        title: "Extraktion fehlgeschlagen",
        description: (error as Error).message || "Produktdaten konnten nicht extrahiert werden",
        variant: "destructive",
      });
    },
  });

  // Handle single product parsing
  const handleParseContent = () => {
    if (!singleProduct.productUrl) {
      toast({
        title: "URL erforderlich",
        description: "Bitte geben Sie eine Produkt-URL zum Parsen an",
        variant: "destructive",
      });
      return;
    }
    parseUrlMutation.mutate(singleProduct.productUrl);
  };

  // Handle single product download
  const handleDownloadContent = () => {
    if (!singleProduct.productUrl) {
      toast({
        title: "URL erforderlich",
        description: "Bitte geben Sie eine Produkt-URL zum Herunterladen des Inhalts an",
        variant: "destructive",
      });
      return;
    }
    downloadContentMutation.mutate(singleProduct.productUrl);
  };

  // Handle PDF file input change for manual mode
  const handlePdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      Array.from(selectedFiles).forEach(file => {
        addPDFFile(file);
      });
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    }
  };

  // Handle folder selection for Datei mode
  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setPdfFolder(files);
      const pdfFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.pdf'));
      toast({
        title: "Ordner ausgewählt",
        description: `${pdfFiles.length} PDF-Dateien gefunden`,
      });
    }
  };

  // Find PDF files by article number
  const findPdfsByArticleNumber = (articleNumber: string): File[] => {
    if (!pdfFolder || !articleNumber) return [];
    
    const articleNumberStr = String(articleNumber).trim();
    if (!articleNumberStr) return [];
    
    const pdfFiles = Array.from(pdfFolder).filter(file =>
      file.name.toLowerCase().endsWith('.pdf') &&
      file.name.toLowerCase().startsWith(articleNumberStr.toLowerCase())
    );
    
    return pdfFiles;
  };

  // Extract text from multiple PDF files
  const extractTextFromMultiplePdfs = async (pdfFiles: File[]): Promise<string> => {
    if (pdfFiles.length === 0) return '';
    
    const extractedTexts: string[] = [];
    
    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfFile = pdfFiles[i];
      try {
        const result = await extractTextFromPDF(pdfFile);
        if (result.text) {
          extractedTexts.push(`[PDF ${i + 1}: ${pdfFile.name}]\n${result.text}`);
        }
      } catch (error) {
        console.error(`Error extracting text from PDF ${pdfFile.name}:`, error);
      }
    }
    
    return extractedTexts.join('\n\n[PDF CONTENT SEPARATOR]\n\n');
  };

  // Handle single product data extraction
  const handleExtractData = async () => {
    if (!singleProduct.productUrl || !singleProduct.productName) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte geben Sie sowohl Produktname als auch URL an",
        variant: "destructive",
      });
      return;
    }
    
    // Reset progress and start extraction
    setExtractionProgress({
      status: 'web-scraping',
      progress: 10,
      message: 'Initialisiere Datenextraktion...'
    });
    
    // If PDF extraction is enabled and we have PDFs, combine them with URL content
    if (isPdfExtractionEnabled && hasValidPDFs && combinedText) {
      try {
        // First scrape URL content
        setExtractionProgress({
          status: 'web-scraping',
          progress: 30,
          message: 'Webseite wird geladen und analysiert...'
        });

        // Create blob URLs for PDF files so they can be opened
        const pdfFilesInfo = pdfs.map(pdf => {
          const blobUrl = URL.createObjectURL(pdf.file);
          return {
            name: pdf.file.name,
            url: blobUrl
          };
        });

        const response = await apiRequest("POST", "/api/extract-url-product-data", {
          url: singleProduct.productUrl,
          productName: singleProduct.productName,
          articleNumber: singleProduct.articleNumber,
          properties: properties.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            expectedFormat: p.expectedFormat || undefined
          })),
          useAI: useAI,
          aiModelProvider: useAI ? modelProvider : undefined,
          openaiApiKey: useAI ? openaiApiKey : undefined,
          pdfText: combinedText, // Include PDF text
          pdfFilesInfo: JSON.stringify(pdfFilesInfo), // Include PDF file info with blob URLs
          includePdfContent: true
        });

        setExtractionProgress({
          status: 'ai-processing',
          progress: 70,
          message: 'KI analysiert die Produktdaten...'
        });

        const data = await response.json() as SearchResponse;
        
        setExtractionProgress({
          status: 'complete',
          progress: 100,
          message: 'Datenextraktion abgeschlossen!'
        });
        
        setTimeout(() => {
          setExtractionProgress({ status: 'idle', progress: 0, message: '' });
        }, 2000);

        onSearchResult(data);
        toast({
          title: "Datenextraktion abgeschlossen",
          description: `Produktdaten erfolgreich aus URL und ${pdfs.length} PDF(s) extrahiert`,
        });
      } catch (error) {
        setExtractionProgress({ status: 'idle', progress: 0, message: '' });
        toast({
          title: "Extraktion fehlgeschlagen",
          description: (error as Error).message || "Produktdaten konnten nicht extrahiert werden",
          variant: "destructive",
        });
      }
    } else {
      // Normal extraction without PDFs
      extractDataMutation.mutate(singleProduct);
    }
  };

  const handleCopyText = async () => {
    const success = await copyTextToClipboard(combinedText);
    if (success) {
      toast({
        title: "In Zwischenablage kopiert",
        description: "Text wurde in die Zwischenablage kopiert",
      });
    } else {
      toast({
        title: "Kopieren fehlgeschlagen",
        description: "Text konnte nicht in die Zwischenablage kopiert werden",
        variant: "destructive",
      });
    }
  };

  const handleDownloadText = () => {
    const fileName = pdfs.length > 1 ? 'combined-pdfs-extracted-text.txt' : `${pdfs[0]?.file.name || 'pdf'}-extracted-text.txt`;
    downloadTextAsFile(combinedText, fileName);
    toast({
      title: "Download gestartet",
      description: "Textdatei-Download wurde gestartet",
    });
  };

  // Add product to list for batch processing
  const addProductToList = () => {
    if (!singleProduct.productUrl || !singleProduct.productName) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte geben Sie sowohl Produktname als auch URL an",
        variant: "destructive",
      });
      return;
    }

    const newProduct: UrlProduct = {
      ...singleProduct,
      id: Date.now().toString()
    };

    setUrlProducts(prev => [...prev, newProduct]);
    setSingleProduct({
      id: '1',
      articleNumber: '',
      productName: '',
      productUrl: ''
    });

    toast({
      title: "Produkt hinzugefügt",
      description: "Produkt wurde zur Verarbeitungsliste hinzugefügt",
    });
  };

  // Remove product from list
  const removeProduct = (id: string) => {
    setUrlProducts(prev => prev.filter(p => p.id !== id));
  };

  // Load products from uploaded file and start processing
  const loadFromFile = () => {
    if (processedData && processedData.length > 0) {
      const products: UrlProduct[] = processedData.map((item, index) => ({
        id: (index + 1).toString(),
        articleNumber: item.ArticleNumber || item.articleNumber || '',
        productName: item.ProductName || item.productName || '',
        productUrl: item.URL || item.url || item.ProductURL || item.productUrl || ''
      })).filter(p => p.productUrl && p.productName);

      if (products.length === 0) {
        toast({
          title: "Keine gültigen Produkte gefunden",
          description: "Die Datei muss Spalten für Produktname und URL enthalten",
          variant: "destructive",
        });
        return;
      }

      setUrlProducts(products);
      
      // Automatically start processing for file upload mode
      const initialStatus = products.map(product => ({
        id: product.id,
        articleNumber: product.articleNumber,
        productName: product.productName,
        status: 'pending' as const,
        progress: 0,
        result: null
      }));
      setProcessingStatus(initialStatus);
      
      // Start batch processing
      processBatchFromFile(products);
      
      toast({
        title: "Verarbeitung gestartet",
        description: `Extraktion für ${products.length} Produkte wird gestartet`,
      });
    }
  };

  // Process products from file upload
  const processBatchFromFile = async (products: UrlProduct[]) => {
    // Process products in parallel batches
    const batches = [];
    for (let i = 0; i < products.length; i += parallelProcesses) {
      batches.push(products.slice(i, i + parallelProcesses));
    }

    for (const batch of batches) {
      const promises = batch.map(async (product) => {
        try {
          // Update status to extracting
          setProcessingStatus(prev => prev.map(item =>
            item.id === product.id
              ? { ...item, status: 'extracting', progress: 25 }
              : item
          ));

          // If PDF extraction is enabled, find and extract PDF content
          let pdfText = '';
          let pdfFilesInfo: any[] = [];
          if (isPdfExtractionEnabled && pdfFolder && product.articleNumber) {
            const pdfFiles = findPdfsByArticleNumber(product.articleNumber);
            if (pdfFiles.length > 0) {
              console.log(`Found ${pdfFiles.length} PDF file(s) for ${product.articleNumber}`);
              pdfText = await extractTextFromMultiplePdfs(pdfFiles);
              
              // Create blob URLs for each PDF file
              pdfFilesInfo = pdfFiles.map(file => {
                const blobUrl = URL.createObjectURL(file);
                return {
                  name: file.name,
                  url: blobUrl
                };
              });
              
              setProcessingStatus(prev => prev.map(item =>
                item.id === product.id
                  ? { ...item, progress: 50 }
                  : item
              ));
            }
          }

          // Extract data with optional PDF content
          // Sanitize PDF text to remove invalid characters that could cause server-side validation errors
          const sanitizedPdfText = pdfText ? sanitizeTextContent(pdfText) : '';
          
          const response = await apiRequest("POST", "/api/extract-url-product-data", {
            url: product.productUrl,
            productName: product.productName,
            articleNumber: product.articleNumber,
            properties: properties.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description || undefined,
              expectedFormat: p.expectedFormat || undefined
            })),
            useAI: useAI,
            aiModelProvider: 'openai',
            openaiApiKey: useAI ? openaiApiKey : undefined,
            pdfText: sanitizedPdfText || undefined,
            pdfFilesInfo: pdfFilesInfo.length > 0 ? JSON.stringify(pdfFilesInfo) : undefined,
            includePdfContent: sanitizedPdfText.length > 0
          });
          const result = await response.json() as SearchResponse;
          
          // Invalidate token usage cache after successful extraction
          invalidateTokenUsage();
          
          // Update status to completed
          setProcessingStatus(prev => prev.map(item =>
            item.id === product.id
              ? { ...item, status: 'completed', progress: 100, result }
              : item
          ));

        } catch (error) {
          // Update status to failed
          setProcessingStatus(prev => prev.map(item =>
            item.id === product.id
              ? { ...item, status: 'failed', progress: 0, error: (error as Error).message }
              : item
          ));
        }
      });

      await Promise.all(promises);
    }

    toast({
      title: "Stapelverarbeitung abgeschlossen",
      description: "Alle Produkte wurden verarbeitet",
    });
  };

  // Process all products in the list
  const processBatch = async () => {
    if (urlProducts.length === 0) {
      toast({
        title: "Keine Produkte zu verarbeiten",
        description: "Bitte fügen Sie zuerst Produkte zur Liste hinzu",
        variant: "destructive",
      });
      return;
    }

    // Initialize processing status
    const initialStatus = urlProducts.map(product => ({
      id: product.id,
      articleNumber: product.articleNumber,
      productName: product.productName,
      status: 'pending' as const,
      progress: 0,
      result: null
    }));
    setProcessingStatus(initialStatus);

    toast({
      title: "Stapelverarbeitung gestartet",
      description: `Verarbeitung von ${urlProducts.length} Produkten`,
    });

    // Process products in parallel batches
    const batches = [];
    for (let i = 0; i < urlProducts.length; i += parallelProcesses) {
      batches.push(urlProducts.slice(i, i + parallelProcesses));
    }

    for (const batch of batches) {
      const promises = batch.map(async (product) => {
        try {
          // Update status to extracting
          setProcessingStatus(prev => prev.map(item => 
            item.id === product.id 
              ? { ...item, status: 'extracting', progress: 50 }
              : item
          ));

          // Extract data
          const result = await extractDataMutation.mutateAsync(product);
          
          // Update status to completed
          setProcessingStatus(prev => prev.map(item => 
            item.id === product.id 
              ? { ...item, status: 'completed', progress: 100, result }
              : item
          ));

        } catch (error) {
          // Update status to failed
          setProcessingStatus(prev => prev.map(item => 
            item.id === product.id 
              ? { ...item, status: 'failed', progress: 0, error: (error as Error).message }
              : item
          ));
        }
      });

      await Promise.all(promises);
    }

    toast({
      title: "Stapelverarbeitung abgeschlossen",
      description: "Alle Produkte wurden verarbeitet",
    });
  };

  // Export results to Excel
  const exportResults = () => {
    const completedResults = processingStatus.filter(item => item.status === 'completed' && item.result);
    
    if (completedResults.length === 0) {
      toast({
        title: "Keine Ergebnisse zum Exportieren",
        description: "Bitte verarbeiten Sie zuerst einige Produkte",
        variant: "destructive",
      });
      return;
    }

    try {
      const wsData: any[] = [];
      
      // Collect all property keys
      const allPropertyKeys = new Set<string>();
      allPropertyKeys.add("Article Number");
      allPropertyKeys.add("Product Name");
      allPropertyKeys.add("URL");
      
      completedResults.forEach(item => {
        if (item.result?.products?.[0]?.properties) {
          Object.keys(item.result.products[0].properties).forEach(key => {
            if (!key.startsWith('__')) {
              allPropertyKeys.add(key);
            }
          });
        }
      });
      
      const headers = Array.from(allPropertyKeys);
      wsData.push(headers);
      
      // Add data rows
      completedResults.forEach(item => {
        const product = item.result?.products?.[0];
        const properties = product?.properties || {};
        const originalProduct = urlProducts.find(p => p.id === item.id);
        
        const row: any[] = [];
        headers.forEach(header => {
          if (header === "Article Number") {
            row.push(originalProduct?.articleNumber || '');
          } else if (header === "Product Name") {
            row.push(originalProduct?.productName || '');
          } else if (header === "URL") {
            row.push(originalProduct?.productUrl || '');
          } else {
            const propValue = properties[header];
            if (propValue && typeof propValue === 'object' && propValue.value !== undefined) {
              const value = propValue.value;
              row.push((value && value !== 'Not found' && value !== 'Not Found') ? value : '');
            } else {
              row.push('');
            }
          }
        });
        
        wsData.push(row);
      });
      
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
      completedResults.forEach((item, rowIndex) => {
        const product = item.result?.products?.[0];
        const properties = product?.properties || {};
        
        headers.forEach((header, colIndex) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
          
          // Ensure cell exists
          if (!ws[cellRef]) return;
          
          if (header === "Article Number" || header === "Product Name" || header === "URL") {
            // Basic styling for standard columns
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
                  fill: { fgColor: { rgb: "BBF7D0" } },
                  font: { color: { rgb: "166534" } },
                  alignment: { horizontal: "left" }
                };
              } else if (sourceCount >= 2) {
                // Light green for 2 sources
                ws[cellRef].s = {
                  fill: { fgColor: { rgb: "D9F99D" } },
                  font: { color: { rgb: "3F6212" } },
                  alignment: { horizontal: "left" }
                };
              } else if (sourceCount === 1 || (propValue.value && propValue.value.trim() !== '')) {
                // Yellow for 1 source
                ws[cellRef].s = {
                  fill: { fgColor: { rgb: "FEF3C7" } },
                  font: { color: { rgb: "92400E" } },
                  alignment: { horizontal: "left" }
                };
              }
            }
          }
        });
      });
      
      // Set column widths for better readability
      const colWidths = headers.map((header) => {
        if (header === "Article Number") return { wch: 15 };
        if (header === "Product Name") return { wch: 35 };
        if (header === "URL") return { wch: 50 };
        return { wch: 20 };
      });
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, "URL Extraction Results");
      
      const fileName = `url_extraction_results_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Export erfolgreich",
        description: `Ergebnisse exportiert nach ${fileName}`,
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: (error as Error).message || "Ergebnisse konnten nicht exportiert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">

      


      {inputMode === 'file' ? (
        <div className="space-y-3">
          {/* File Format Instructions Card for URL Tab */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-emerald-900 mb-2">Excel-Datei Format für URL-Modus</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* Required: Product Name */}
                  <div className="bg-white/60 rounded-md p-2.5 border border-red-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">Erforderlich</span>
                    </div>
                    <div className="bg-red-50 rounded px-2 py-1 font-mono text-xs text-red-800">
                      Produktname
                    </div>
                  </div>
                  {/* Required: URL */}
                  <div className="bg-white/60 rounded-md p-2.5 border border-red-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">Erforderlich</span>
                    </div>
                    <div className="bg-red-50 rounded px-2 py-1 font-mono text-xs text-red-800">
                      URL
                    </div>
                  </div>
                  {/* Optional: Article Number */}
                  <div className="bg-white/60 rounded-md p-2.5 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700">Optional</span>
                    </div>
                    <div className="bg-gray-100/50 rounded px-2 py-1 font-mono text-xs text-gray-700">
                      Artikelnummer
                    </div>
                  </div>
                </div>
                {/* Example Preview */}
                <div className="mt-3 bg-white rounded-md border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-2 py-1 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-600">📋 Beispiel Excel-Struktur:</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-gray-600 border-r border-gray-200">Artikelnummer</th>
                          <th className="px-2 py-1 text-left font-medium text-red-600 border-r border-gray-200">Produktname *</th>
                          <th className="px-2 py-1 text-left font-medium text-red-600">URL *</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-100">
                          <td className="px-2 py-1 text-gray-600 border-r border-gray-200">AB-001</td>
                          <td className="px-2 py-1 text-gray-800 border-r border-gray-200">iPhone 15 Pro</td>
                          <td className="px-2 py-1 text-blue-600 truncate max-w-[200px]">https://apple.com/iphone-15-pro</td>
                        </tr>
                        <tr className="border-t border-gray-100 bg-gray-50/50">
                          <td className="px-2 py-1 text-gray-600 border-r border-gray-200">CD-002</td>
                          <td className="px-2 py-1 text-gray-800 border-r border-gray-200">Sony WH-1000XM5</td>
                          <td className="px-2 py-1 text-blue-600 truncate max-w-[200px]">https://sony.com/wh-1000xm5</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  <span className="font-medium">Tipp:</span> Die URL-Spalte enthält direkte Links zu den Produktseiten für automatische Datenextraktion.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm">
            <div
              className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg p-6 bg-gray-50 transition-all duration-150 hover:bg-blue-50 hover:border-blue-300 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
            <div className="relative">
              <div className="bg-blue-500 rounded-full p-3">
                <FileUp className="h-6 w-6 text-white" />
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-sm font-medium text-gray-700">Produktdatei hochladen</p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedFileName || "Excel oder CSV (.xlsx, .xls, .csv)"}
              </p>
            </div>
          </div>
          
          {selectedFileName && processedData.length > 0 && (
            <>
              {processedData.length > 0 && (
                <div className="mt-4 flex flex-col items-center w-full">
                  <div className="w-full mb-4">
                    <div className="flex items-center space-x-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-3">
                      {/* Parallel Processing */}
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="parallelProcesses-url" className="text-xs font-medium text-gray-600 whitespace-nowrap">
                          Parallele Verarbeitung:
                        </Label>
                        <Input
                          id="parallelProcesses-url"
                          type="number"
                          value={parallelProcesses}
                          onChange={(e) => setParallelProcesses(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          min="1"
                          max="10"
                          className="w-12 h-6 px-1 rounded border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-center font-medium bg-white"
                        />
                      </div>
                      
                      {/* Property Table Selector */}
                      <div className="flex items-center gap-2 pl-3 ml-2 border-l border-gray-300">
                        <div className="flex items-center gap-1">
                          <Table2 className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-700">Tabelle:</span>
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
                          <SelectTrigger className="h-6 w-[120px] text-xs bg-white border-gray-300">
                            <SelectValue placeholder="Tabelle wählen" />
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
                    </div>
                  </div>

                  {/* PDF Extraction Toggle for File Mode */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <div>
                        <Label htmlFor="pdf-extraction-toggle-file" className="text-xs font-medium cursor-pointer">
                          PDF-Datenextraktion
                        </Label>
                        <p className="text-xs text-gray-500">PDF-Inhalte zusätzlich zu URL-Daten extrahieren</p>
                      </div>
                    </div>
                    <Switch
                      id="pdf-extraction-toggle-file"
                      checked={isPdfExtractionEnabled}
                      onCheckedChange={setIsPdfExtractionEnabled}
                    />
                  </div>

                  {/* PDF Folder Selection - File Mode */}
                  {isPdfExtractionEnabled && (
                    <div className="space-y-2">
                      <div
                        className="flex flex-col items-center justify-center border-2 border-dashed border-purple-300 rounded-lg p-4 bg-purple-50 transition-colors hover:border-purple-400 cursor-pointer"
                        onClick={() => pdfFolderInputRef.current?.click()}
                      >
                        <FolderOpen className="h-8 w-8 text-purple-400 mb-1" />
                        <p className="text-xs text-purple-600 mb-1">
                          {pdfFolder ? `${Array.from(pdfFolder).filter(f => f.name.toLowerCase().endsWith('.pdf')).length} PDF-Dateien ausgewählt` : 'PDF-Ordner auswählen'}
                        </p>
                        <p className="text-xs text-gray-500">PDF-Dateinamen müssen mit Artikelnummer beginnen</p>
                      </div>
                      <input
                        ref={pdfFolderInputRef}
                        type="file"
                        {...{ webkitdirectory: "", directory: "" } as any}
                        multiple
                        className="hidden"
                        onChange={handleFolderSelect}
                      />
                    </div>
                  )}
                  
                  <Button
                    onClick={loadFromFile}
                    disabled={isPdfExtractionEnabled && !pdfFolder}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    URL-Datenextraktion starten
                  </Button>
                </div>
              )}
            </>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="articleNumber">Artikelnummer (Optional)</Label>
            <Input
              id="articleNumber"
              value={singleProduct.articleNumber}
              onChange={(e) => setSingleProduct(prev => ({ ...prev, articleNumber: e.target.value }))}
              placeholder="Artikelnummer eingeben"
            />
          </div>
          
          <div>
            <Label htmlFor="productName">Produktname *</Label>
            <Input
              id="productName"
              value={singleProduct.productName}
              onChange={(e) => setSingleProduct(prev => ({ ...prev, productName: e.target.value }))}
              placeholder="Produktname eingeben"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="productUrl">Produkt-URL *</Label>
            <Input
              id="productUrl"
              type="url"
              value={singleProduct.productUrl}
              onChange={(e) => setSingleProduct(prev => ({ ...prev, productUrl: e.target.value }))}
              placeholder="https://example.com/product-page"
              required
            />
          </div>

          {/* PDF Extraction Toggle */}
          <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <Label htmlFor="pdf-extraction-toggle" className="text-sm font-medium cursor-pointer">
                  PDF-Datenextraktion
                </Label>
                <p className="text-xs text-gray-500">PDF-Inhalte zusätzlich zu URL-Daten extrahieren</p>
              </div>
            </div>
            <Switch
              id="pdf-extraction-toggle"
              checked={isPdfExtractionEnabled}
              onCheckedChange={setIsPdfExtractionEnabled}
            />
          </div>

          {/* PDF Upload Section - Manual Mode */}
          {isPdfExtractionEnabled && (
            <Card className="border-purple-200">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <Label className="text-sm font-medium">PDF-Dateien hochladen ({pdfs.length}/{maxFiles})</Label>
                  </div>
                  
                  {canAddMore && (
                    <div
                      className="flex flex-col items-center justify-center border-2 border-dashed border-purple-300 rounded-lg p-4 bg-purple-50 transition-colors hover:border-purple-400 cursor-pointer"
                      onClick={() => pdfFileInputRef.current?.click()}
                    >
                      <Plus className="h-8 w-8 text-purple-400 mb-1" />
                      <p className="text-xs text-purple-600">
                        {pdfs.length === 0 ? 'PDF-Dateien auswählen' : 'Weitere PDF hinzufügen'}
                      </p>
                    </div>
                  )}

                  {pdfs.length > 0 && (
                    <div className="space-y-2">
                      {pdfs.map((pdf) => (
                        <div key={pdf.id} className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className={`h-4 w-4 ${pdf.error ? 'text-red-600' : 'text-blue-600'}`} />
                              <div>
                                <p className="text-xs font-medium">{pdf.file.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(pdf.file.size / 1024 / 1024).toFixed(2)} MB
                                  {pdf.pages > 0 && ` • ${pdf.pages} Seiten`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {pdf.isProcessing && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                              {pdf.error && (
                                <Button variant="outline" size="sm" onClick={() => retryPDF(pdf.id)} className="h-6 px-2">
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => removePDF(pdf.id)} className="h-6 px-2 text-red-600">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {pdf.error && (
                            <div className="mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-red-600" />
                              <p className="text-xs text-red-600">{pdf.error}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {stats && stats.totalFiles > 0 && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <span>{stats.totalFiles} Dateien</span>
                          <span>{stats.totalPages} Seiten</span>
                          <span>{stats.totalCharacters.toLocaleString()} Zeichen</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsTextExpanded(!isTextExpanded)} className="h-6 px-2">
                          {isTextExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      </div>
                      {isTextExpanded && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <div className="flex justify-between mb-1">
                            <Label className="text-xs">Extrahierter Text</Label>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={handleCopyText} className="h-6 px-2">
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleDownloadText} className="h-6 px-2">
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            value={combinedText}
                            onChange={(e) => updateCombinedText(e.target.value)}
                            className="min-h-[100px] text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {hasErrors && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <p className="text-xs text-red-600">Einige Dateien konnten nicht verarbeitet werden</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Property Table Selector for Manual Mode */}
          <div className="flex items-center space-x-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Table2 className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Tabelle:</span>
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
                <SelectTrigger className="h-6 w-[120px] text-xs bg-white border-gray-300">
                  <SelectValue placeholder="Tabelle wählen" />
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
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleExtractData}
              disabled={extractDataMutation.isPending || !singleProduct.productUrl || !singleProduct.productName || (isPdfExtractionEnabled && !hasValidPDFs)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              {extractDataMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Daten extrahieren
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={pdfFileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handlePdfFileChange}
          />
        </div>
      )}



    </div>
  );
}