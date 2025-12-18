import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Loader2, FileText, Globe, FolderOpen,
  FileSpreadsheet, Table2, CheckCircle2,
  Play, AlertCircle, Check, X, Upload, Square,
  Sparkles, Zap, Database
} from "lucide-react";
import * as XLSX from 'xlsx';
import { extractTextFromPDF, sanitizeTextContent } from "@/lib/pdf-utils";
import {
  CustomProcessingStatusItem,
  useSearchTabsStore,
  CustomExtractionMode
} from "@/stores/searchTabsStore";
import ExcelValidationErrorDialog, { ExcelValidationError } from "./ExcelValidationErrorDialog";

// Use the ExtractionMode type from the store
type ExtractionMode = CustomExtractionMode;

interface CustomSearchTabProps {
  onSearchResult: (result: SearchResponse, sourceTab?: string) => void;
  properties: ProductProperty[];
  openaiApiKey?: string;
  useAI?: boolean;
  modelProvider?: 'openai';
  onClearResults?: () => void;
  // Processing status from parent component for batch table display
  processingStatus: CustomProcessingStatusItem[];
  setProcessingStatus: React.Dispatch<React.SetStateAction<CustomProcessingStatusItem[]>>;
}

interface ExcelProduct {
  id: string;
  articleNumber: string;
  productName: string;
  url?: string;
}

// Mode configuration with requirements - simplified to two modes
const MODE_CONFIG = {
  'url': {
    name: 'URL',
    description: 'Nur aus Webseiten',
    excelRequirements: {
      artikelnummer: { required: false, label: 'Artikelnummer' },
      produktname: { required: true, label: 'Produktname' },
      url: { required: true, label: 'URL' }
    },
    needsPdfFolder: false
  },
  'url+pdf': {
    name: 'URL + PDF',
    description: 'Web + lokale PDFs',
    excelRequirements: {
      artikelnummer: { required: true, label: 'Artikelnummer' },
      produktname: { required: true, label: 'Produktname' },
      url: { required: true, label: 'URL' }
    },
    needsPdfFolder: true
  }
} as const;

export default function CustomSearchTab({ 
  onSearchResult, 
  properties,
  openaiApiKey = "",
  useAI = false,
  modelProvider = 'openai',
  onClearResults,
  processingStatus,
  setProcessingStatus
}: CustomSearchTabProps) {
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

  // Use store for persisted state across tab switches
  const {
    customTabExcelFileName,
    setCustomTabExcelFileName,
    customTabExcelData,
    setCustomTabExcelData,
    customTabExcelColumns,
    setCustomTabExcelColumns,
    customTabExtractionMode,
    setCustomTabExtractionMode,
    customTabPdfFolderName,
    setCustomTabPdfFolderName,
    customTabPdfCount,
    setCustomTabPdfCount,
    isCustomSearchStopping,
    setIsCustomSearchStopping,
    parallelSearches, // Use global parallel searches setting from Settings
  } = useSearchTabsStore();

  // Local state for actual file objects (can't be persisted)
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFolder, setPdfFolder] = useState<FileList | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Validation error dialog state
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationDialogError, setValidationDialogError] = useState<ExcelValidationError | null>(null);
  
  // Use parallelSearches from settings store (default 10) for parallel processing
  const parallelCount = parallelSearches;
  
  // Use store values for persisted data
  const excelData = customTabExcelData;
  const setExcelData = setCustomTabExcelData;
  const excelColumns = customTabExcelColumns;
  const setExcelColumns = setCustomTabExcelColumns;
  const extractionMode = customTabExtractionMode;
  const setExtractionMode = setCustomTabExtractionMode;
  
  // Refs
  const excelInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Sync file name display with store
  useEffect(() => {
    if (excelFile) {
      setCustomTabExcelFileName(excelFile.name);
    }
  }, [excelFile, setCustomTabExcelFileName]);
  
  // Sync PDF folder info with store
  useEffect(() => {
    if (pdfFolder) {
      const pdfFiles = Array.from(pdfFolder).filter(file => file.name.toLowerCase().endsWith('.pdf'));
      setCustomTabPdfCount(pdfFiles.length);
      // Set display name based on number of files
      if (pdfFiles.length > 0) {
        setCustomTabPdfFolderName(`${pdfFiles.length} PDF-Dateien ausgewählt`);
      }
    } else {
      setCustomTabPdfCount(0);
      setCustomTabPdfFolderName('');
    }
  }, [pdfFolder, setCustomTabPdfCount, setCustomTabPdfFolderName]);

  // Get current mode configuration
  const currentModeConfig = MODE_CONFIG[extractionMode];

  // Generate detailed error message showing expected format
  const generateColumnErrorDetails = (missingColumns: string[], mode: ExtractionMode): { title: string, description: string, example: React.ReactNode } => {
    const modeConfig = MODE_CONFIG[mode];
    const modeName = mode === 'url' ? 'URL-Modus' : 'URL + PDF-Modus';
    
    // Build required columns list
    const requiredCols: string[] = [];
    if (modeConfig.excelRequirements.produktname.required) requiredCols.push('Produktname');
    if (modeConfig.excelRequirements.url.required) requiredCols.push('URL');
    if (modeConfig.excelRequirements.artikelnummer.required) requiredCols.push('Artikelnummer');
    
    const optionalCols: string[] = [];
    if (!modeConfig.excelRequirements.artikelnummer.required) optionalCols.push('Artikelnummer (optional)');
    
    return {
      title: `❌ Fehlende Spalten für ${modeName}`,
      description: `Die hochgeladene Excel-Datei enthält nicht alle erforderlichen Spalten für den ${modeName}.`,
      example: null
    };
  };

  // Validate current setup based on mode
  const validation = useMemo(() => {
    const errors: { message: string; details?: string; missingCols?: string[] }[] = [];
    const warnings: string[] = [];
    const modeConfig = MODE_CONFIG[extractionMode];
    const modeName = extractionMode === 'url' ? 'URL-Modus' : 'URL + PDF-Modus';
    
    // Check Excel file
    if (!excelFile) {
      errors.push({ message: 'Excel-Datei erforderlich', details: 'Bitte laden Sie eine Excel-Datei mit Produktdaten hoch.' });
    } else {
      // Collect missing columns
      const missingColumns: string[] = [];
      
      // Check required columns based on mode
      if (modeConfig.excelRequirements.produktname.required && !excelColumns.hasProduktname) {
        missingColumns.push('Produktname');
      }
      if (modeConfig.excelRequirements.artikelnummer.required && !excelColumns.hasArtikelnummer) {
        missingColumns.push('Artikelnummer');
      }
      if (modeConfig.excelRequirements.url.required && !excelColumns.hasUrl) {
        missingColumns.push('URL');
      }
      
      // Generate rich error message if columns are missing
      if (missingColumns.length > 0) {
        const requiredColsForMode = extractionMode === 'url'
          ? ['Produktname (Pflicht)', 'URL (Pflicht)', 'Artikelnummer (optional)']
          : ['Artikelnummer (Pflicht)', 'Produktname (Pflicht)', 'URL (Pflicht)'];
        
        errors.push({
          message: `Fehlende Spalte${missingColumns.length > 1 ? 'n' : ''}: ${missingColumns.join(', ')}`,
          details: `Für den ${modeName} werden folgende Spalten benötigt: ${requiredColsForMode.join(', ')}.`,
          missingCols: missingColumns
        });
      }
    }
    
    // Check PDF folder for modes that need it
    if (modeConfig.needsPdfFolder && !pdfFolder) {
      errors.push({
        message: 'PDF-Dateien erforderlich',
        details: 'Für den URL + PDF-Modus müssen Sie PDF-Dateien hochladen, deren Dateinamen mit der Artikelnummer beginnen.'
      });
    }
    
    // Warnings (non-blocking)
    if (excelFile && excelData.length === 0) {
      warnings.push('Keine gültigen Produkte in Excel gefunden');
    }
    
    const isValid = errors.length === 0 && excelData.length > 0;
    
    return { errors, warnings, isValid, modeName };
  }, [extractionMode, excelFile, excelColumns, pdfFolder, excelData]);

  // Handle clear excel data
  const handleClearExcel = useCallback(() => {
    setExcelFile(null);
    setExcelData([]);
    setExcelColumns({ hasArtikelnummer: false, hasProduktname: false, hasUrl: false });
    setCustomTabExcelFileName('');
    if (excelInputRef.current) excelInputRef.current.value = '';
  }, [setExcelData, setExcelColumns, setCustomTabExcelFileName]);
  
  // Handle clear PDF folder
  const handleClearPdfFolder = useCallback(() => {
    setPdfFolder(null);
    setCustomTabPdfCount(0);
    setCustomTabPdfFolderName('');
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [setCustomTabPdfCount, setCustomTabPdfFolderName]);

  // Handle Excel file upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setExcelFile(file);
    setCustomTabExcelFileName(file.name);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        toast({
          title: "Fehler: Leere Excel-Datei",
          description: "Die Excel-Datei enthält keine Arbeitsblätter.",
          variant: "destructive",
        });
        handleClearExcel();
        return;
      }
      
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);
      
      if (data.length === 0) {
        toast({
          title: "Fehler: Keine Daten gefunden",
          description: "Die Excel-Datei enthält keine Daten.",
          variant: "destructive",
        });
        handleClearExcel();
        return;
      }
      
      // Check columns
      const firstRow = data[0] as any;
      const columnKeys = Object.keys(firstRow || {}).map(k => k.toLowerCase());
      
      const hasProductName = columnKeys.some(k =>
        ['produktname', 'productname', 'product name'].includes(k)
      );
      
      const hasArticleNumber = columnKeys.some(k =>
        ['artikelnummer', 'articlenumber', 'article number', 'article_number', 'sku'].includes(k)
      );
      
      const hasUrl = columnKeys.some(k =>
        ['url', 'link', 'webseite', 'website'].includes(k)
      );
      
      // Update column detection state
      setExcelColumns({
        hasArtikelnummer: hasArticleNumber,
        hasProduktname: hasProductName,
        hasUrl: hasUrl
      });
      
      // Check for missing required columns based on current mode and show dialog
      const modeConfig = MODE_CONFIG[extractionMode];
      const missingColumnsForMode: string[] = [];
      
      if (modeConfig.excelRequirements.produktname.required && !hasProductName) {
        missingColumnsForMode.push('Produktname');
      }
      if (modeConfig.excelRequirements.url.required && !hasUrl) {
        missingColumnsForMode.push('URL');
      }
      if (modeConfig.excelRequirements.artikelnummer.required && !hasArticleNumber) {
        missingColumnsForMode.push('Artikelnummer');
      }
      
      // Show validation error dialog if columns are missing
      if (missingColumnsForMode.length > 0) {
        const modeName = extractionMode === 'url' ? 'URL-Modus' : 'URL + PDF-Modus';
        const missingText = missingColumnsForMode.length === 1
          ? `Die Spalte "${missingColumnsForMode[0]}" fehlt in Ihrer Excel-Datei`
          : `Die Spalten "${missingColumnsForMode.join('", "')}" fehlen in Ihrer Excel-Datei`;
        
        setValidationDialogError({
          message: `Fehlende Spalte${missingColumnsForMode.length > 1 ? 'n' : ''}: ${missingColumnsForMode.join(', ')}`,
          details: `${missingText}. Bitte fügen Sie ${missingColumnsForMode.length === 1 ? 'diese Spalte' : 'diese Spalten'} hinzu und laden Sie die Datei erneut hoch. Für den ${modeName} werden benötigt: ${
            extractionMode === 'url'
              ? 'Produktname (Pflicht), URL (Pflicht), Artikelnummer (optional)'
              : 'Artikelnummer (Pflicht), Produktname (Pflicht), URL (Pflicht)'
          }.`,
          missingColumns: missingColumnsForMode,
          detectedColumns: {
            hasProduktname: hasProductName,
            hasArtikelnummer: hasArticleNumber,
            hasUrl: hasUrl
          },
          mode: extractionMode,
          modeName: modeName
        });
        setShowValidationDialog(true);
        
        // Clear the file input so the same file can be uploaded again
        if (excelInputRef.current) {
          excelInputRef.current.value = '';
        }
        
        // Don't continue - clear state and return early
        setExcelFile(null);
        setCustomTabExcelFileName('');
        setExcelData([]);
        return;
      }
      
      // Parse Excel data (validation passed)
      const parsedData = data.map((row: any, index: number) => {
        const findColumn = (columnVariants: string[]) => {
          for (const variant of columnVariants) {
            const key = Object.keys(row).find(k => k.toLowerCase() === variant.toLowerCase());
            if (key) return row[key];
          }
          return '';
        };
        
        const productName = String(
          findColumn(['Produktname', 'ProductName', 'Product Name'])
        ).trim();
        
        const articleNumber = String(
          findColumn(['Artikelnummer', 'ArticleNumber', 'Article Number', 'Article_Number', 'SKU'])
        ).trim();
        
        const url = String(
          findColumn(['URL', 'url', 'Url', 'Link', 'link', 'Webseite', 'Website'])
        ).trim();
        
        return {
          id: `custom_${index + 1}`,
          articleNumber: articleNumber || `auto_${index + 1}`,
          productName,
          url: url || undefined
        };
      }).filter(item => item.productName);
      
      setExcelData(parsedData);
      
      const withArticleNumbers = parsedData.filter(item => !item.articleNumber.startsWith('auto_')).length;
      const withUrls = parsedData.filter(item => item.url).length;
      
      // Show what was detected
      const detectedColumns = [];
      if (hasProductName) detectedColumns.push('Produktname ✓');
      if (hasArticleNumber) detectedColumns.push('Artikelnummer ✓');
      if (hasUrl) detectedColumns.push('URL ✓');
      
      toast({
        title: "Excel-Datei geladen",
        description: `${parsedData.length} Produkte gefunden. Spalten: ${detectedColumns.join(', ') || 'keine erkannt'}`,
      });
      
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      toast({
        title: "Fehler beim Verarbeiten der Excel-Datei",
        description: "Die Datei konnte nicht gelesen werden.",
        variant: "destructive",
      });
      handleClearExcel();
    }
  };

  // Reset all state for a new task
  const resetAllState = useCallback(() => {
    // Reset processing status
    setProcessingStatus([]);
    
    // Reset Excel data
    setExcelFile(null);
    setExcelData([]);
    setExcelColumns({ hasArtikelnummer: false, hasProduktname: false, hasUrl: false });
    setCustomTabExcelFileName('');
    if (excelInputRef.current) excelInputRef.current.value = '';
    
    // Reset PDF folder
    setPdfFolder(null);
    setCustomTabPdfCount(0);
    setCustomTabPdfFolderName('');
    if (folderInputRef.current) folderInputRef.current.value = '';
    
    // Reset extraction mode to default
    setExtractionMode('url');
    
    // Reset processing flag
    setIsProcessing(false);
    setIsCustomSearchStopping(false);
    
    // Clear the abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
    
    // Clear results
    if (onClearResults) {
      onClearResults();
    }
  }, [setProcessingStatus, setExcelData, setExcelColumns, setCustomTabExcelFileName,
      setCustomTabPdfCount, setCustomTabPdfFolderName, setExtractionMode,
      setIsCustomSearchStopping, onClearResults]);

  // Stop extraction handler - immediately aborts and resets everything
  const handleStopExtraction = useCallback(() => {
    // First, abort any pending requests immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Set stopping flag (for any checks in flight)
    setIsCustomSearchStopping(true);
    
    // Show toast immediately with proper German message
    toast({
      title: "Vorgang abgebrochen",
      description: "Der Vorgang wurde durch den Nutzer gestoppt.",
    });
    
    // Immediately reset all state for a fresh start
    // Use setTimeout to ensure toast shows before heavy state updates
    setTimeout(() => {
      resetAllState();
    }, 100);
  }, [setIsCustomSearchStopping, resetAllState]);

  // Reset Excel data when mode changes (optional - to re-validate)
  const handleModeChange = (newMode: ExtractionMode) => {
    setExtractionMode(newMode);
    // Clear PDF folder if switching to URL-only mode
    if (newMode === 'url') {
      setPdfFolder(null);
    }
  };
  
  // Handle PDF file selection
  const handlePdfSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setPdfFolder(files);
      const pdfFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.pdf'));
      toast({
        title: "PDF-Dateien ausgewählt",
        description: `${pdfFiles.length} PDF-Datei${pdfFiles.length !== 1 ? 'en' : ''} hochgeladen`,
      });
    }
  };

  // Find PDF files by article number
  const findPdfsByArticleNumber = (articleNumber: string): File[] => {
    if (!pdfFolder || !articleNumber) return [];
    
    const articleNumberStr = String(articleNumber).trim();
    if (!articleNumberStr || articleNumberStr.startsWith('auto_')) return [];
    
    const pdfFiles = Array.from(pdfFolder).filter(file => 
      file.name.toLowerCase().endsWith('.pdf') &&
      file.name.toLowerCase().startsWith(articleNumberStr.toLowerCase())
    );
    
    return pdfFiles;
  };
  
  // Extract text from PDF file
  const extractTextFromPdfFile = async (file: File): Promise<string> => {
    try {
      const result = await extractTextFromPDF(file);
      return result.text || '';
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract PDF text');
    }
  };

  // Extract text from multiple PDF files
  const extractTextFromMultiplePdfs = async (pdfFiles: File[]): Promise<string> => {
    if (pdfFiles.length === 0) return '';
    
    const extractedTexts: string[] = [];
    
    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfFile = pdfFiles[i];
      try {
        const text = await extractTextFromPdfFile(pdfFile);
        if (text) {
          extractedTexts.push(`[PDF ${i + 1}: ${pdfFile.name}]\n${text}`);
        }
      } catch (error) {
        console.error(`Error extracting text from PDF ${pdfFile.name}:`, error);
      }
    }
    
    return extractedTexts.join('\n\n[PDF CONTENT SEPARATOR]\n\n');
  };

  // Derived values for extraction logic
  const enableUrlExtraction = true; // Always enabled in both modes
  const enablePdfExtraction = extractionMode === 'url+pdf';

  // Process a single product with combined extraction
  const processProduct = async (
    product: ExcelProduct,
    index: number
  ): Promise<SearchResponse | null> => {
    try {
      // Update status to searching
      setProcessingStatus(prev => prev.map((item, i) =>
        item.id === product.id
          ? { ...item, status: 'searching' as const, progress: 10, statusDetails: 'Initialisierung...' }
          : item
      ));
      
      let pdfText = '';
      let webContent = '';
      let pdfFilesInfo: any[] = [];
      
      // Step 1: Extract PDF content if enabled (for pdf or url+pdf modes)
      if (enablePdfExtraction && pdfFolder && product.articleNumber && !product.articleNumber.startsWith('auto_')) {
        const pdfFiles = findPdfsByArticleNumber(product.articleNumber);
        if (pdfFiles.length > 0) {
          console.log(`Found ${pdfFiles.length} PDF file(s) for ${product.articleNumber}`);
          
          setProcessingStatus(prev => prev.map(item => 
            item.id === product.id 
              ? { ...item, progress: 25, statusDetails: `Extrahiere ${pdfFiles.length} PDF(s)...` }
              : item
          ));
          
          pdfText = await extractTextFromMultiplePdfs(pdfFiles);
          
          // Create blob URLs for PDF files
          pdfFilesInfo = pdfFiles.map(file => ({
            name: file.name,
            url: URL.createObjectURL(file)
          }));
          
          setProcessingStatus(prev => prev.map(item => 
            item.id === product.id 
              ? { ...item, progress: 35 }
              : item
          ));
        }
      }
      
      // Step 2: Scrape web content if enabled and URL exists
      if (enableUrlExtraction && product.url) {
        // Check for abort before making request
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Aborted by user');
        }
        
        try {
          console.log(`Scraping web content from: ${product.url}`);
          
          setProcessingStatus(prev => prev.map(item =>
            item.id === product.id
              ? { ...item, progress: 50, statusDetails: 'Webseite wird analysiert...' }
              : item
          ));
          
          const webResponse = await fetch('/api/search/web-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: product.url.trim(),
              articleNumber: product.articleNumber
            }),
            signal: abortControllerRef.current?.signal,
          });
          
          if (webResponse.ok) {
            const webData = await webResponse.json();
            if (webData.success && webData.content) {
              webContent = webData.content;
              console.log(`Web content extracted: ${webContent.length} characters`);
            }
          }
        } catch (webError) {
          // Check if this was an abort
          if ((webError as Error).name === 'AbortError') {
            throw new Error('Aborted by user');
          }
          console.warn(`Web scraping error for ${product.url}:`, webError);
        }
      }
      
      // Step 3: If no sources are available, try URL-based extraction
      if (!pdfText && !webContent && enableUrlExtraction && product.url) {
        // Check for abort before making request
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Aborted by user');
        }
        
        // Fallback to direct URL extraction
        setProcessingStatus(prev => prev.map(item =>
          item.id === product.id
            ? { ...item, status: 'extracting' as const, progress: 60, statusDetails: 'KI analysiert URL...' }
            : item
        ));
        
        const response = await apiRequest("POST", "/api/extract-url-product-data", {
          url: product.url,
          productName: product.productName,
          articleNumber: product.articleNumber,
          properties: properties.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            expectedFormat: p.expectedFormat || undefined
          })),
          useAI: true,
          aiModelProvider: 'openai',
          openaiApiKey: openaiApiKey
        }, abortControllerRef.current?.signal);
        
        const result = await response.json() as SearchResponse;
        
        // Update status to completed
        setProcessingStatus(prev => prev.map(item => 
          item.id === product.id 
            ? { ...item, status: 'completed' as const, progress: 100, result, statusDetails: 'Abgeschlossen' }
            : item
        ));
        
        return result;
      }
      
      // Step 4: Combine content and process with AI
      let combinedContent = '';
      const sourceLabels: string[] = [];
      
      if (pdfText && webContent) {
        combinedContent = `[WEB CONTENT FROM ${product.url}]\n${webContent}\n\n[PDF CONTENT]\n${pdfText}`;
        sourceLabels.push('web', 'pdf');
      } else if (pdfText) {
        combinedContent = pdfText;
        sourceLabels.push('pdf');
      } else if (webContent) {
        combinedContent = `[WEB CONTENT FROM ${product.url}]\n${webContent}`;
        sourceLabels.push('web');
      }
      
      if (!combinedContent) {
        throw new Error('Keine Inhalte aus den ausgewählten Quellen extrahiert');
      }
      
      // Check for abort before making final AI request
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Aborted by user');
      }
      
      setProcessingStatus(prev => prev.map(item =>
        item.id === product.id
          ? { ...item, status: 'extracting' as const, progress: 75, statusDetails: 'KI extrahiert Daten...' }
          : item
      ));
      
      // Make AI extraction request with combined content
      // Use extract-url-product-data endpoint which handles PDF+Web content
      // Sanitize all text content to remove invalid characters that could cause server-side validation errors
      const sanitizedPdfText = pdfText ? sanitizeTextContent(pdfText) : undefined;
      const sanitizedWebContent = webContent ? sanitizeTextContent(webContent) : undefined;
      const sanitizedCombinedContent = combinedContent ? sanitizeTextContent(combinedContent) : '';
      
      const requestData = {
        url: product.url || '',
        productName: product.productName,
        articleNumber: product.articleNumber,
        properties: properties.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          expectedFormat: p.expectedFormat || undefined
        })),
        useAI: true,
        aiModelProvider: 'openai',
        openaiApiKey: openaiApiKey,
        // Include both PDF and web content (sanitized to remove invalid characters)
        pdfText: sanitizedPdfText,
        webContent: sanitizedWebContent,
        includePdfContent: !!sanitizedPdfText,
        pdfFilesInfo: pdfFilesInfo.length > 0 ? JSON.stringify(pdfFilesInfo) : undefined,
        // Combined content for processing (sanitized)
        combinedContent: sanitizedCombinedContent,
        sourceLabels: sourceLabels
      };
      
      const response = await apiRequest("POST", "/api/extract-url-product-data", requestData, abortControllerRef.current?.signal);
      const result = await response.json() as SearchResponse;
      
      // Add source information to result for tooltip display
      if (result.products && result.products[0]) {
        // Add metadata about sources used
        result.products[0].properties['__sourceInfo'] = {
          name: '__sourceInfo',
          value: JSON.stringify({
            hasWeb: !!webContent,
            hasPdf: !!pdfText,
            webUrl: product.url,
            pdfFiles: pdfFilesInfo.map(f => f.name)
          }),
          confidence: 100,
          isConsistent: true,
          sources: []
        };
      }
      
      // Update status to completed
      setProcessingStatus(prev => prev.map(item => 
        item.id === product.id 
          ? { ...item, status: 'completed' as const, progress: 100, result, statusDetails: 'Abgeschlossen' }
          : item
      ));
      
      return result;
    } catch (error) {
      // Check if this was an abort - don't log as error
      if ((error as Error).message === 'Aborted by user' || (error as Error).name === 'AbortError') {
        console.log('Processing aborted by user for product:', product.id);
        return null;
      }
      
      console.error('Error processing product:', error);
      // Update status to failed
      setProcessingStatus(prev => prev.map(item =>
        item.id === product.id
          ? { ...item, status: 'failed' as const, error: (error as Error).message, statusDetails: 'Fehlgeschlagen' }
          : item
      ));
      return null;
    }
  };

  // Handle batch extraction
  const handleBatchExtraction = async () => {
    // Validate before starting
    if (!validation.isValid) {
      const errorMsg = validation.errors[0]?.message || "Bitte überprüfen Sie die Eingaben";
      const errorDetails = validation.errors[0]?.details || "";
      toast({
        title: "❌ " + errorMsg,
        description: errorDetails,
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    setIsCustomSearchStopping(false);
    
    // Create new abort controller for this batch
    abortControllerRef.current = new AbortController();
    
    // Clear previous results
    if (onClearResults) {
      onClearResults();
    }
    
    // Initialize processing status - matches format expected by parent
    const initialStatus: CustomProcessingStatusItem[] = excelData.map(item => ({
      id: item.id,
      articleNumber: item.articleNumber,
      productName: item.productName,
      url: item.url,
      status: 'pending' as const,
      progress: 0,
      result: null,
      statusDetails: 'Wartend...'
    }));
    setProcessingStatus(initialStatus);
    
    let completedCount = 0;
    let failedCount = 0;
    let stoppedCount = 0;
    
    // Process in batches with stop support
    const processBatch = async (batch: ExcelProduct[], startIndex: number) => {
      const promises = batch.map(async (product, batchIndex) => {
        // Check if stop was requested before starting each product - use signal.aborted for immediate check
        if (abortControllerRef.current?.signal.aborted) {
          stoppedCount++;
          return null;
        }
        
        const result = await processProduct(product, startIndex + batchIndex);
        
        // Check again after processing in case it was aborted during
        if (abortControllerRef.current?.signal.aborted) {
          stoppedCount++;
          return null;
        }
        
        if (result) {
          completedCount++;
          invalidateTokenUsage();
          onSearchResult(result, 'custom');
        } else {
          // Don't count as failed if it was aborted
          if (!abortControllerRef.current?.signal.aborted) {
            failedCount++;
          }
        }
        return result;
      });
      
      await Promise.all(promises);
    };
    
    // Process in chunks with stop check
    try {
      for (let i = 0; i < excelData.length; i += parallelCount) {
        // Check for stop before starting each batch - use signal.aborted for immediate check
        if (abortControllerRef.current?.signal.aborted) {
          stoppedCount += excelData.length - i;
          break;
        }
        
        const batch = excelData.slice(i, i + parallelCount);
        await processBatch(batch, i);
        
        // Check again after batch completes
        if (abortControllerRef.current?.signal.aborted) {
          const remaining = excelData.length - (i + parallelCount);
          if (remaining > 0) {
            stoppedCount += remaining;
          }
          break;
        }
      }
    } catch (error) {
      // Handle any unexpected errors
      console.error('Batch processing error:', error);
    }
    
    // Only show completion toast if not aborted (abort handler shows its own toast)
    if (!abortControllerRef.current?.signal.aborted) {
      setIsProcessing(false);
      setIsCustomSearchStopping(false);
      abortControllerRef.current = null;
      
      if (stoppedCount > 0) {
        toast({
          title: "Extraktion gestoppt",
          description: `${completedCount} erfolgreich, ${failedCount} fehlgeschlagen, ${stoppedCount} gestoppt`,
        });
      } else {
        toast({
          title: "Batch-Extraktion abgeschlossen",
          description: `${completedCount} erfolgreich, ${failedCount} fehlgeschlagen von ${excelData.length} Produkten`,
        });
      }
    }
    // If aborted, resetAllState callback will handle cleanup
  };

  // Stats for display
  const pdfCount = pdfFolder ? Array.from(pdfFolder).filter(f => f.name.toLowerCase().endsWith('.pdf')).length : 0;
  const productsWithUrl = excelData.filter(p => p.url).length;
  const productsWithArticleNumber = excelData.filter(p => !p.articleNumber.startsWith('auto_')).length;

  // Determine if PDF enhancement is enabled
  const withPdf = extractionMode === 'url+pdf';

  return (
    <div className="relative overflow-hidden">
      {/* Ambient Background Glow - Premium Touch */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#17c3ce]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#c8fa64]/8 rounded-full blur-3xl" />
      </div>
      
      {/* Main Container with Dark Glassmorphism */}
      <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.06] overflow-hidden">
        {/* Header Section with Gradient */}
        <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#17c3ce] via-[#0c2443] to-[#c8fa64]" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[color:var(--rb-lime)]/20 to-[color:var(--rb-cyan)]/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[color:var(--rb-lime)]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[color:var(--rb-cyan)] rounded-full flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Batch-Extraktion</h3>
              <p className="text-xs sm:text-sm text-white/50">Excel hochladen • Daten automatisch extrahieren</p>
            </div>
          </div>
        </div>

        {/* Main Content Area - Dark Theme */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-5 space-y-4">
          {/* Excel Upload Zone - Dark Glass Style */}
          <div
            className={`group relative rounded-xl transition-all duration-300 cursor-pointer overflow-hidden ${
              excelFile
                ? 'bg-[color:var(--rb-lime)]/10 border-2 border-[color:var(--rb-lime)]/30'
                : 'bg-white/[0.02] border-2 border-dashed border-white/20 hover:border-[color:var(--rb-cyan)]/50 hover:bg-white/[0.04]'
            }`}
            onClick={() => excelInputRef.current?.click()}
          >
            {/* Hover Glow Effect */}
            {!excelFile && (
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--rb-cyan)]/5 to-[color:var(--rb-lime)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            )}
            
            {(excelFile || customTabExcelFileName) ? (
              // Success State - File Uploaded - Dark Theme
              <div className="relative p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {/* Success Icon */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[color:var(--rb-lime)]/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-[color:var(--rb-lime)]" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[color:var(--rb-lime)] rounded-full flex items-center justify-center">
                      <FileSpreadsheet className="h-3 w-3 text-[#0c2443]" />
                    </div>
                  </div>
                  
                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-bold text-white truncate">
                      {excelFile?.name || customTabExcelFileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[color:var(--rb-lime)]/20 text-[color:var(--rb-lime)]">
                        <span className="w-1.5 h-1.5 bg-[color:var(--rb-lime)] rounded-full animate-pulse" />
                        {excelData.length} Produkte
                      </span>
                      {excelColumns.hasProduktname && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-500/20 text-blue-400">
                          Name ✓
                        </span>
                      )}
                      {excelColumns.hasUrl && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-violet-500/20 text-violet-400">
                          URL ✓
                        </span>
                      )}
                      {excelColumns.hasArtikelnummer && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-amber-500/20 text-amber-400">
                          Art.Nr. ✓
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearExcel();
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all duration-200"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            ) : (
              // Empty State - Upload Prompt - Dark Theme
              <div className="relative p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[color:var(--rb-cyan)]/20 flex items-center justify-center">
                      <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-[color:var(--rb-cyan)]" />
                    </div>
                    <div>
                      <span className="text-sm sm:text-base font-semibold text-white">Excel-Datei</span>
                      <p className="text-[10px] sm:text-xs text-white/50">Produktliste hochladen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[color:var(--rb-cyan)]/10 text-[color:var(--rb-cyan)]">
                    <Upload className="h-3.5 w-3.5" />
                    <span className="text-[10px] sm:text-xs font-medium">Drag & Drop</span>
                  </div>
                </div>
                
                {/* Sample Table Preview - Dark Theme */}
                <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-white/[0.03]">
                        <th className="px-3 py-2 text-left font-semibold text-white/50 border-r border-white/[0.06]">
                          <span>Artikelnummer</span>
                          <span className="ml-1 text-[8px] text-white/30 italic">(optional)</span>
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-white/70 border-r border-white/[0.06]">Produktname</th>
                        <th className="px-3 py-2 text-left font-semibold text-white/70">URL</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/60">
                      <tr className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2 border-r border-white/[0.04] font-mono text-[color:var(--rb-cyan)]">TV-001</td>
                        <td className="px-3 py-2 border-r border-white/[0.04]">Samsung TV 55"</td>
                        <td className="px-3 py-2 text-[color:var(--rb-cyan)] truncate max-w-[100px] sm:max-w-[160px]">https://samsung.de/...</td>
                      </tr>
                      <tr className="border-t border-white/[0.04] opacity-60">
                        <td className="px-3 py-2 border-r border-white/[0.04] font-mono text-[color:var(--rb-cyan)]">TV-002</td>
                        <td className="px-3 py-2 border-r border-white/[0.04]">LG OLED 65"</td>
                        <td className="px-3 py-2 text-[color:var(--rb-cyan)]">https://lg.com/...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Upload Hint - Dark Theme */}
                <div className="mt-4 text-center">
                  <p className="text-xs sm:text-sm text-white/60 font-medium">
                    Klicken oder Datei hierher ziehen
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/40 mt-1">
                    Unterstützt: .xlsx, .xls, .csv
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={handleExcelUpload}
          />

          {/* PDF Enhancement Option - Dark Theme Toggle Card */}
          <div className={`relative rounded-xl transition-all duration-300 overflow-hidden ${
            withPdf
              ? 'bg-purple-500/10 border-2 border-purple-500/30'
              : 'bg-white/[0.02] border border-white/[0.08] hover:border-white/20'
          }`}>
            <button
              onClick={() => handleModeChange(withPdf ? 'url' : 'url+pdf')}
              className="w-full px-4 py-3 sm:py-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                {/* Custom Checkbox - Dark Theme */}
                <div className={`relative w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                  withPdf
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-white/30 bg-transparent group-hover:border-[color:var(--rb-cyan)]'
                }`}>
                  {withPdf && (
                    <Check className="h-4 w-4 text-white animate-in zoom-in-50 duration-200" />
                  )}
                </div>
                
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm sm:text-base font-semibold transition-colors ${
                      withPdf ? 'text-purple-400' : 'text-white/90'
                    }`}>
                      PDF-Dateien hinzufügen
                    </span>
                    <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                      withPdf
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-white/10 text-white/50'
                    }`}>
                      Optional
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">
                    Ergänzt Web-Daten mit lokalen PDF-Dokumenten
                  </p>
                </div>
              </div>
              
              {/* Enhancement Badge - Dark Theme */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                withPdf
                  ? 'bg-[color:var(--rb-lime)]/20 text-[color:var(--rb-lime)]'
                  : 'bg-white/10 text-white/40'
              }`}>
                <Zap className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">+Genauigkeit</span>
              </div>
            </button>
            
            {/* PDF Upload Zone - Animated Expand */}
            {withPdf && (
              <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-2 duration-300">
                <div
                  className={`rounded-xl transition-all duration-300 cursor-pointer overflow-hidden ${
                    pdfFolder
                      ? 'bg-[color:var(--rb-lime)]/10 border-2 border-[color:var(--rb-lime)]/30'
                      : 'bg-white/[0.03] border-2 border-dashed border-white/20 hover:border-[color:var(--rb-cyan)]/50 hover:bg-white/[0.05]'
                  }`}
                  onClick={() => folderInputRef.current?.click()}
                >
                  {(pdfFolder || customTabPdfCount > 0) ? (
                    // PDF Success State - Dark Theme
                    <div className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[color:var(--rb-lime)]/20 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-[color:var(--rb-lime)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm sm:text-base font-bold text-white">
                            {pdfFolder ? pdfCount : customTabPdfCount} PDF-Datei{(pdfFolder ? pdfCount : customTabPdfCount) !== 1 ? 'en' : ''}
                          </p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-[color:var(--rb-lime)]/20 text-[color:var(--rb-lime)]">
                            <span className="w-1.5 h-1.5 bg-[color:var(--rb-lime)] rounded-full animate-pulse" />
                            Bereit
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">Wird mit Web-Daten kombiniert</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearPdfFolder();
                        }}
                        className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    // PDF Empty State - Dark Theme
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-orange-400" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-white">PDF-Dateien</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[color:var(--rb-cyan)]/10 text-[color:var(--rb-cyan)]">
                          <Upload className="h-3 w-3" />
                          <span className="text-[10px] font-medium">Mehrfachauswahl</span>
                        </div>
                      </div>
                      
                      {/* Sample PDF Preview - Dark Theme */}
                      <div className="bg-white/[0.03] rounded-lg p-2.5 space-y-1.5 border border-white/[0.06]">
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                          <FileText className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                          <span className="font-mono text-white/60">
                            <span className="text-[color:var(--rb-cyan)] font-semibold">TV-001</span>_Datenblatt.pdf
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                          <FileText className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                          <span className="font-mono text-white/60">
                            <span className="text-[color:var(--rb-cyan)] font-semibold">TV-001</span>_Manual.pdf
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs opacity-50">
                          <FileText className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                          <span className="font-mono text-white/60">
                            <span className="text-[color:var(--rb-cyan)] font-semibold">TV-002</span>_Specs.pdf
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-[10px] sm:text-xs text-white/40 mt-2 text-center">
                        Dateiname muss mit <span className="font-semibold text-[color:var(--rb-cyan)]">Artikelnummer</span> beginnen
                      </p>
                    </div>
                  )}
                </div>
                
                <input
                  ref={folderInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handlePdfSelect}
                />
              </div>
            )}
          </div>

          {/* Validation Messages - Dark Theme Alert Style */}
          {validation.errors.length > 0 && (
            <div className="flex items-start gap-3 p-3 sm:p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 animate-in slide-in-from-top-2 duration-300">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-amber-400">{validation.errors[0].message}</span>
                {validation.errors[0].details && (
                  <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">{validation.errors[0].details}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Validation Error Dialog */}
          <ExcelValidationErrorDialog
            open={showValidationDialog}
            onOpenChange={setShowValidationDialog}
            error={validationDialogError}
          />
        </div>

        {/* Action Footer - Dark Theme */}
        <div className="relative px-4 sm:px-6 py-4 bg-white/[0.02] border-t border-white/[0.06]">
          <div className="flex items-center justify-between gap-4">
            {/* Property Table Selector - Dark Theme */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                <Database className="h-3.5 w-3.5 text-[color:var(--rb-cyan)]" />
                <span className="hidden sm:inline text-xs font-medium text-white/60">Tabelle:</span>
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
                <SelectTrigger className="h-8 sm:h-9 w-[90px] sm:w-[150px] text-xs sm:text-sm bg-white/[0.04] border-white/[0.12] text-white/80 rounded-lg hover:border-[color:var(--rb-cyan)]/50 transition-colors">
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-[#0c2443] border-white/10">
                  {propertyTables.map((table) => (
                    <SelectItem key={table.id} value={table.id.toString()} className="text-xs sm:text-sm text-white/80 rounded-lg focus:bg-white/10">
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Action Button - Dark Theme */}
            {isProcessing ? (
              <button
                onClick={handleStopExtraction}
                className="h-10 sm:h-11 px-5 sm:px-7 text-sm sm:text-base font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-300 flex items-center"
              >
                <Square className="h-4 w-4 sm:h-5 sm:w-5 mr-2 fill-current" />
                Stoppen
              </button>
            ) : (
              <button
                onClick={handleBatchExtraction}
                disabled={!validation.isValid}
                className={`h-10 sm:h-11 px-5 sm:px-7 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 flex items-center ${
                  validation.isValid
                    ? 'bg-[color:var(--rb-lime)] hover:bg-[color:var(--rb-lime)]/90 text-[#0c2443]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {validation.isValid ? (
                  <>
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span>Extraktion starten</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0c2443]/20 text-[#0c2443] text-xs font-bold">
                      {excelData.length}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Daten extrahieren
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}