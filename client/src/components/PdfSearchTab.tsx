import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, FileUp, FileText, Upload, Download, Trash2, Copy, BarChart3, ChevronDown, ChevronUp, X, RefreshCw, Plus, AlertCircle, FolderOpen, FileSpreadsheet, ExternalLink, Table2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useMultiPDFExtractor } from "@/hooks/use-multi-pdf-extractor";
import { downloadTextAsFile, copyTextToClipboard, extractTextFromPDF, sanitizeTextContent } from "@/lib/pdf-utils";
import * as XLSX from 'xlsx';

interface PdfSearchTabProps {
  onSearchResult: (result: SearchResponse, sourceTab?: string) => void;
  properties: ProductProperty[];
  openaiApiKey?: string;
  useAI?: boolean;
  modelProvider?: 'openai';
  inputMode?: 'manual' | 'file';
  onClearResults?: () => void;
  currentResult?: SearchResponse | null;
  manualModeResult?: SearchResponse | null;
  processingStatus?: Array<{
    articleNumber: string;
    productName: string;
    url?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: SearchResponse;
    error?: string;
    pdfContent?: string;
    webContent?: string;
  }>;
  onProcessingStatusChange?: (status: Array<{
    articleNumber: string;
    productName: string;
    url?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: SearchResponse;
    error?: string;
    pdfContent?: string;
    webContent?: string;
  }>) => void;
}

export default function PdfSearchTab({ 
  onSearchResult, 
  properties,
  openaiApiKey = "",
  useAI = false,
  modelProvider = 'openai',
  inputMode = 'manual',
  onClearResults,
  currentResult,
  manualModeResult,
  processingStatus: externalProcessingStatus,
  onProcessingStatusChange
}: PdfSearchTabProps) {
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
  
  const [articleNumber, setArticleNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isProcessingStatusExpanded, setIsProcessingStatusExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File mode states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<Array<{articleNumber: string; productName?: string; url?: string}>>([]);
  const [pdfFolder, setPdfFolder] = useState<FileList | null>(null);
  const [parallelCount, setParallelCount] = useState<number>(3);
  type ProcessingStatusItem = {
    articleNumber: string;
    productName: string;
    url?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: SearchResponse;
    error?: string;
    pdfContent?: string;
    webContent?: string;
  };

  // Use external processingStatus if provided, otherwise use internal state
  const [internalProcessingStatus, setInternalProcessingStatus] = useState<ProcessingStatusItem[]>([]);
  
  // Use external status if provided, otherwise use internal
  const processingStatus: ProcessingStatusItem[] = (externalProcessingStatus as ProcessingStatusItem[] | undefined) || internalProcessingStatus;

  const setProcessingStatusArray = (next: ProcessingStatusItem[]) => {
    if (onProcessingStatusChange) {
      onProcessingStatusChange(next);
    } else {
      setInternalProcessingStatus(next);
    }
  };

  const updateProcessingStatus = (updater: (prev: ProcessingStatusItem[]) => ProcessingStatusItem[]) => {
    const next = updater(processingStatus);
    setProcessingStatusArray(next);
  };

  const excelInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Use the multi-PDF extractor hook for handling multiple files
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

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      // Add multiple files if selected
      Array.from(selectedFiles).forEach(file => {
        addPDFFile(file);
      });
      // Clear the input to allow re-selecting the same files
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle Excel file upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setExcelFile(file);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Check if the file has any sheets
      if (workbook.SheetNames.length === 0) {
        toast({
          title: "Fehler: Leere Excel-Datei",
          description: "Die Excel-Datei enthält keine Arbeitsblätter.",
          variant: "destructive",
        });
        setExcelFile(null);
        return;
      }
      
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);
      
      // Check if the file has any data
      if (data.length === 0) {
        toast({
          title: "Fehler: Keine Daten gefunden",
          description: "Die Excel-Datei enthält keine Daten. Bitte stellen Sie sicher, dass die Datei nicht leer ist.",
          variant: "destructive",
        });
        setExcelFile(null);
        return;
      }
      
      // Check if the required column exists
      const firstRow = data[0] as any;
      const hasProductName = firstRow && (
        'Produktname' in firstRow || 
        'ProductName' in firstRow || 
        'Product Name' in firstRow ||
        'produktname' in firstRow ||
        'productname' in firstRow ||
        'product name' in firstRow
      );
      
      if (!hasProductName) {
        const availableColumns = Object.keys(firstRow || {}).join(', ');
        toast({
          title: "Fehler: Pflichtfeld fehlt",
          description: `Die Excel-Datei muss eine Spalte 'Produktname' oder 'ProductName' enthalten. Gefundene Spalten: ${availableColumns || 'keine'}`,
          variant: "destructive",
        });
        setExcelFile(null);
        return;
      }
      
      // Parse Excel data - ProductName is required, ArticleNumber and URL are optional
      const parsedData = data.map((row: any, index: number) => {
        // Case-insensitive column matching
        const findColumn = (columnVariants: string[]) => {
          for (const variant of columnVariants) {
            const key = Object.keys(row).find(k => k.toLowerCase() === variant.toLowerCase());
            if (key) return row[key];
          }
          return '';
        };
        
        const productName = String(
          findColumn(['Produktname', 'ProductName', 'Product Name', 'produktname', 'productname', 'product name'])
        ).trim();
        
        const articleNumber = String(
          findColumn(['Artikelnummer', 'ArticleNumber', 'Article Number', 'artikelnummer', 'articlenumber', 'article number'])
        ).trim();
        
        const url = String(
          findColumn(['URL', 'url', 'Url', 'Link', 'link'])
        ).trim();
        
        return {
          articleNumber: articleNumber || `auto_${index + 1}`, // Generate auto number if not provided
          productName,
          url
        };
      }).filter(item => item.productName); // Only keep rows with product names
      
      if (parsedData.length === 0) {
        toast({
          title: "Fehler: Keine gültigen Produkte",
          description: "Keine Zeilen mit Produktnamen gefunden. Bitte überprüfen Sie, dass die Spalte 'Produktname' ausgefüllt ist.",
          variant: "destructive",
        });
        setExcelFile(null);
        return;
      }
      
      setExcelData(parsedData);
      
      // Provide detailed feedback
      const withArticleNumbers = parsedData.filter(item => !item.articleNumber.startsWith('auto_')).length;
      const withUrls = parsedData.filter(item => item.url).length;
      
      toast({
        title: "Excel-Datei erfolgreich geladen",
        description: `${parsedData.length} Produkte gefunden. ${withArticleNumbers} mit Artikelnummer, ${withUrls} mit URL.`,
      });
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      toast({
        title: "Fehler beim Verarbeiten der Excel-Datei",
        description: "Die Datei konnte nicht gelesen werden. Bitte stellen Sie sicher, dass es sich um eine gültige Excel-Datei (.xlsx oder .xls) handelt.",
        variant: "destructive",
      });
      setExcelFile(null);
    }
  };
  
  // Handle folder selection
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
    
    // Ensure articleNumber is a string
    const articleNumberStr = String(articleNumber).trim();
    if (!articleNumberStr) return [];
    
    const pdfFiles = Array.from(pdfFolder).filter(file => 
      file.name.toLowerCase().endsWith('.pdf') &&
      file.name.toLowerCase().startsWith(articleNumberStr.toLowerCase())
    );
    
    return pdfFiles;
  };
  
  // Extract text from a single PDF file (using client-side extraction)
  const extractTextFromPdfFile = async (file: File): Promise<string> => {
    try {
      const result = await extractTextFromPDF(file);
      return result.text || '';
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract PDF text');
    }
  };

  // Extract text from multiple PDF files and combine them
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
        // Continue with other PDFs even if one fails
      }
    }
    
    // Combine all PDF texts with separators
    return extractedTexts.join('\n\n[PDF CONTENT SEPARATOR]\n\n');
  };
  
  // Process multiple PDFs with AI extraction, including web scraping if URL provided
  const processProductPdfs = async (articleNumber: string, productName: string, pdfFiles: File[], url?: string) => {
    try {
      // Update status to processing
      updateProcessingStatus(prev => prev.map(item => 
        item.articleNumber === articleNumber 
          ? { ...item, status: 'processing' as const, progress: 25 }
          : item
      ));
      
      // Extract text from all PDFs
      const pdfText = await extractTextFromMultiplePdfs(pdfFiles);
      
      if (!pdfText) {
        throw new Error('No text extracted from PDFs');
      }
      
      console.log(`Extracted text from ${pdfFiles.length} PDF file(s) for article ${articleNumber}`);
      
      // Update progress after PDF extraction
      updateProcessingStatus(prev => prev.map(item => 
        item.articleNumber === articleNumber 
          ? { ...item, progress: 50, pdfContent: pdfText }
          : item
      ));
      
      let webContent = '';
      
      // If URL is provided, scrape web content
      if (url && url.trim()) {
        try {
          console.log(`Scraping web content from: ${url}`);
          
          const webResponse = await fetch('/api/search/web-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url.trim(),
              articleNumber
            }),
          });
          
          if (webResponse.ok) {
            const webData = await webResponse.json();
            if (webData.success && webData.content) {
              webContent = webData.content;
              console.log(`Web content extracted: ${webContent.length} characters using method: ${webData.method}`);
            } else {
              console.warn(`Web scraping failed for ${url}: ${webData.error || 'Unknown error'}`);
              console.warn(`Framework detected: ${webData.hasJavaScriptFramework}, Method: ${webData.method}`);
            }
          } else {
            console.warn(`Failed to scrape web content from ${url}: HTTP ${webResponse.status}`);
          }
        } catch (webError) {
          console.warn(`Web scraping error for ${url}:`, webError);
        }
      }
      
      // Update progress after web scraping
      updateProcessingStatus(prev => prev.map(item => 
        item.articleNumber === articleNumber 
          ? { ...item, progress: 75, webContent }
          : item
      ));
      
      // Combine PDFs and web content
      let combinedContent = pdfText;
      if (webContent) {
        combinedContent = `${pdfText}\n\n[WEB CONTENT FROM ${url}]\n${webContent}`;
      }
      
      // Make AI extraction request with combined content
      const requestData = {
        searchMethod: 'pdf' as const,
        articleNumber,
        productName,
        pdfText: combinedContent,
        properties: properties.map(p => ({ name: p.name, type: p.expectedFormat || 'text' })),
        useAI: true,
        modelProvider: 'openai',
        openaiApiKey: openaiApiKey
      };
      
      const response = await fetch('/api/search/pdf-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to extract data from PDF');
      }
      
      const result = await response.json() as SearchResponse;
      
      // Update status to completed
      updateProcessingStatus(prev => prev.map(item => 
        item.articleNumber === articleNumber 
          ? { ...item, status: 'completed' as const, progress: 100, result }
          : item
      ));
      
      return result;
    } catch (error) {
      // Update status to failed
      updateProcessingStatus(prev => prev.map(item => 
        item.articleNumber === articleNumber 
          ? { ...item, status: 'failed' as const, error: (error as Error).message }
          : item
      ));
      throw error;
    }
  };
  
  // Handle batch PDF extraction
  const handleBatchExtraction = async () => {
    if (excelData.length === 0 || !pdfFolder) {
      toast({
        title: "Fehlende Daten",
        description: "Bitte laden Sie eine Excel-Datei und wählen Sie einen PDF-Ordner aus",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessingBatch(true);
    
    // Clear previous results if onClearResults is provided
    if (onClearResults) {
      onClearResults();
    }
    
    // Initialize processing status
    const initialStatus = excelData.map(item => ({
      articleNumber: item.articleNumber,
      productName: item.productName || item.articleNumber,
      url: item.url || '',
      status: 'pending' as const,
      progress: 0,
    }));
    setProcessingStatusArray(initialStatus);
    
    // Track completed and failed results
    let completedCount = 0;
    let failedCount = 0;
    
    // Process PDFs in batches
    const processBatch = async (batch: typeof excelData) => {
      const promises = batch.map(async (item) => {
        const pdfFiles = findPdfsByArticleNumber(item.articleNumber);
        if (pdfFiles.length === 0) {
          updateProcessingStatus(prev => prev.map(status => 
            status.articleNumber === item.articleNumber 
              ? { ...status, status: 'failed' as const, error: 'PDF-Datei nicht gefunden' }
              : status
          ));
          failedCount++;
          return;
        }
        
        console.log(`Found ${pdfFiles.length} PDF file(s) for article ${item.articleNumber}: ${pdfFiles.map(f => f.name).join(', ')}`);
        
        try {
          const result = await processProductPdfs(item.articleNumber, item.productName || item.articleNumber, pdfFiles, item.url);
          if (result) {
            completedCount++;
            // Invalidate token usage cache after successful extraction
            invalidateTokenUsage();
            // Send result to parent component immediately
            onSearchResult(result, 'pdf');
          }
        } catch (error) {
          console.error(`Error processing ${item.articleNumber}:`, error);
          failedCount++;
        }
      });
      
      await Promise.all(promises);
    };
    
    // Process in chunks based on parallelCount
    for (let i = 0; i < excelData.length; i += parallelCount) {
      const batch = excelData.slice(i, i + parallelCount);
      await processBatch(batch);
    }
    
    setIsProcessingBatch(false);
    
    toast({
      title: "Batch-Extraktion abgeschlossen",
      description: `${completedCount} erfolgreich, ${failedCount} fehlgeschlagen von ${excelData.length} PDFs`,
    });
  };
  
  // AI data extraction mutation
  const extractDataMutation = useMutation({
    mutationFn: async () => {
      if (!combinedText || !productName) {
        throw new Error('Missing required fields: PDF content and product name are required');
      }

      // Prepare combined content (PDF + optional URL content)
      let finalContent = combinedText;
      
      // If URL is provided, fetch its content and combine with PDF
      if (productUrl && productUrl.trim()) {
        console.log(`Fetching content from URL: ${productUrl}`);
        
        try {
          const urlResponse = await fetch('/api/search/web-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: productUrl.trim(),
              articleNumber
            }),
          });
          
          if (urlResponse.ok) {
            const urlData = await urlResponse.json();
            if (urlData.success && urlData.content) {
              console.log(`URL content extracted: ${urlData.content.length} characters`);
              finalContent = `${combinedText}\n\n[WEB CONTENT FROM ${productUrl}]\n${urlData.content}`;
            } else {
              console.warn(`Failed to fetch URL content: ${urlData.error || 'Unknown error'}`);
              toast({
                title: "URL-Warnung",
                description: `PDF wird verarbeitet, aber URL-Inhalt konnte nicht abgerufen werden: ${urlData.error || 'Unbekannter Fehler'}`,
                variant: "default",
              });
            }
          }
        } catch (urlError) {
          console.warn('Error fetching URL content:', urlError);
          toast({
            title: "URL-Warnung",
            description: "PDF wird verarbeitet, aber URL-Inhalt konnte nicht abgerufen werden",
            variant: "default",
          });
        }
      }

      // Sanitize PDF text to remove invalid characters that could cause server-side validation errors
      const sanitizedPdfText = sanitizeTextContent(finalContent);
      
      const requestData = {
        searchMethod: 'pdf' as const,
        articleNumber,
        productName,
        pdfText: sanitizedPdfText,
        properties: properties.map(p => ({ name: p.name, type: p.expectedFormat || 'text' })),
        useAI: true,
        modelProvider,
        openaiApiKey: openaiApiKey
      };

      const response = await fetch('/api/search/pdf-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Failed to extract data from PDF');
      }

      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      // Invalidate token usage cache to show updated stats immediately
      invalidateTokenUsage();
      
      onSearchResult(data, 'pdf');
      toast({
        title: "Datenextraktion abgeschlossen",
        description: "Produktdaten erfolgreich aus PDF extrahiert",
      });
    },
    onError: (error) => {
      console.error("AI extraction error:", error);
      toast({
        title: "KI-Extraktion fehlgeschlagen",
        description: (error as Error).message || "Datenextraktion mit KI fehlgeschlagen",
        variant: "destructive",
      });
    }
  });

  const handleExtractData = () => {
    extractDataMutation.mutate();
  };

  const handleClearAll = () => {
    clearAllPDFs();
    setArticleNumber("");
    setProductName("");
    setProductUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

  return (
    <div className="space-y-4">
      {inputMode === 'manual' ? (
        /* Manual Mode - Single PDF Processing */
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Header with Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PDF-Dokumentverarbeitung</h3>
                    <p className="text-sm text-gray-600">Bis zu {maxFiles} PDF-Dateien hochladen und Produktspezifikationen mit KI extrahieren</p>
                  </div>
                </div>
                {pdfs.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Alle löschen
                  </Button>
                )}
              </div>

            {/* File Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">1</div>
                <Label className="text-sm font-medium text-gray-700">PDF-Dateien hochladen ({pdfs.length}/{maxFiles})</Label>
              </div>
              
              {/* Add Files Button */}
              {canAddMore && (
                <div 
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 transition-colors hover:border-purple-400 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    {pdfs.length === 0 ? 'Klicken Sie, um PDF-Dateien auszuwählen' : 'Weitere PDF-Datei hinzufügen'}
                  </p>
                  <p className="text-xs text-gray-500">Nur PDF-Dateien werden unterstützt (max. 100MB je Datei)</p>
                </div>
              )}

              {/* List of uploaded PDFs */}
              {pdfs.length > 0 && (
                <div className="space-y-2">
                  {pdfs.map((pdf) => (
                    <div key={pdf.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className={`h-6 w-6 ${pdf.error ? 'text-red-600' : 'text-blue-600'}`} />
                          <div>
                            <p className="text-sm font-medium text-blue-900">{pdf.file.name}</p>
                            <p className="text-xs text-blue-700">
                              {(pdf.file.size / 1024 / 1024).toFixed(2)} MB
                              {pdf.pages > 0 && ` • ${pdf.pages} Seiten`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pdf.isProcessing && (
                            <div className="flex items-center gap-2 text-blue-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Verarbeitung...</span>
                            </div>
                          )}
                          {pdf.error && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryPDF(pdf.id)}
                              className="text-blue-600 hover:text-blue-700 h-6 px-2"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Wiederholen
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removePDF(pdf.id)}
                            className="text-red-600 hover:text-red-700 h-6 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {pdf.error && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <p className="text-xs text-red-600">{pdf.error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Combined Statistics */}
              {stats && stats.totalFiles > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-green-700">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {stats.totalFiles} Dateien
                      </span>
                      <span>{stats.totalPages} Seiten</span>
                      <span>{stats.totalCharacters.toLocaleString()} Zeichen</span>
                      <span>{stats.totalWords.toLocaleString()} Wörter</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTextExpanded(!isTextExpanded)}
                      className="text-green-600 hover:text-green-700 h-6 px-2"
                    >
                      {isTextExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Verbergen
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Text anzeigen
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Expandable combined text preview */}
                  {isTextExpanded && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-green-700">Kombinierter extrahierter Text</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyText}
                            className="text-green-600 hover:text-green-700 h-6 px-2"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Kopieren
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadText}
                            className="text-green-600 hover:text-green-700 h-6 px-2"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Herunterladen
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-white border rounded p-2">
                        <Textarea
                          value={combinedText}
                          onChange={(e) => updateCombinedText(e.target.value)}
                          placeholder="Extrahierter Text erscheint hier..."
                          className="min-h-[150px] bg-transparent border-none resize-none focus:ring-0 text-xs"
                        />
                      </div>
                      
                      <p className="text-xs text-green-600 mt-1">
                        Sie können den kombinierten Text bei Bedarf vor der Verarbeitung bearbeiten.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Errors summary */}
              {hasErrors && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-xs text-red-600">
                      Einige Dateien konnten nicht verarbeitet werden. Verwenden Sie die "Wiederholen"-Schaltfläche, um es erneut zu versuchen.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Product Information Section */}
            {hasValidPDFs && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">2</div>
                  <Label className="text-sm font-medium text-gray-700">Produktinformationen</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="article-number" className="text-xs text-gray-600">Artikelnummer (optional)</Label>
                    <Input
                      id="article-number"
                      placeholder="z.B. AB12345 (optional)"
                      value={articleNumber}
                      onChange={(e) => setArticleNumber(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="product-name" className="text-xs text-gray-600">Produktname *</Label>
                    <Input
                      id="product-name"
                      placeholder="z.B. Samsung Galaxy S21"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="product-url" className="text-xs text-gray-600">Produkt-URL (optional)</Label>
                  <Input
                    id="product-url"
                    type="url"
                    placeholder="https://example.com/product-page (optional)"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Geben Sie die URL der Produktwebseite ein, um zusätzliche Informationen zu extrahieren
                  </p>
                </div>
              </div>
            )}

            {/* AI Extraction Section */}
            {hasValidPDFs && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">3</div>
                  <Label className="text-sm font-medium text-gray-700">KI-Datenextraktion</Label>
                </div>
                
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
                
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={handleExtractData}
                    disabled={extractDataMutation.isPending || !productName || !combinedText || isProcessing}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2"
                  >
                    {extractDataMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {extractDataMutation.isPending ? "Verarbeitung..." : "Daten mit KI extrahieren"}
                  </Button>
                </div>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>
      ) : (
        /* File Mode - Batch PDF Processing */
        <div className="space-y-4">
          {/* File Format Instructions Card for PDF Tab */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-orange-900 mb-2">PDF Batch-Verarbeitung - Anleitung</h4>
                
                {/* Two-column layout for Excel and PDF instructions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Excel Format Section */}
                  <div className="bg-white/70 rounded-lg p-3 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FileSpreadsheet className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-800">1. Excel-Datei Format</span>
                    </div>
                    <div className="space-y-2">
                      {/* Required Column */}
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs text-gray-700">Erforderlich:</span>
                        <span className="bg-red-50 rounded px-1.5 py-0.5 font-mono text-xs text-red-700">Produktname</span>
                      </div>
                      {/* Optional Columns */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-xs text-gray-700">Optional:</span>
                        <span className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-xs text-gray-600">Artikelnummer</span>
                        <span className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-xs text-gray-600">URL</span>
                      </div>
                    </div>
                    {/* Mini Example Table */}
                    <div className="mt-2 bg-gray-50 rounded border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-1.5 py-0.5 text-left text-gray-600 border-r border-gray-200">Artikelnr.</th>
                            <th className="px-1.5 py-0.5 text-left text-red-600">Produktname *</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="px-1.5 py-0.5 text-gray-600 border-r border-gray-200">12345</td>
                            <td className="px-1.5 py-0.5 text-gray-700">Bosch GSR 18V</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* PDF Naming Convention Section */}
                  <div className="bg-white/70 rounded-lg p-3 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-800">2. PDF-Datei Benennung</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-gray-700">
                        PDF-Dateien müssen mit der <span className="font-semibold text-orange-700">Artikelnummer beginnen</span>:
                      </p>
                      {/* Visual Examples of PDF naming */}
                      <div className="space-y-1.5 bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <code className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">
                            <span className="text-green-600 font-bold">12345</span>-datasheet.pdf
                          </code>
                          <span className="text-xs text-green-600">✓</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <code className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">
                            <span className="text-green-600 font-bold">12345</span>_specs.pdf
                          </code>
                          <span className="text-xs text-green-600">✓</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <code className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-mono">
                            <span className="text-green-600 font-bold">12345</span>.pdf
                          </code>
                          <span className="text-xs text-green-600">✓</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 italic">
                        💡 Mehrere PDFs pro Artikel werden automatisch zusammengeführt
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-orange-700 mt-3">
                  <span className="font-medium">Unterstützte Formate:</span> Excel (.xlsx, .xls, .csv) + PDF-Ordner
                </p>
              </div>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Batch PDF-Verarbeitung</h3>
                    <p className="text-sm text-gray-600">Mehrere PDFs gleichzeitig basierend auf Excel-Datei verarbeiten</p>
                  </div>
                </div>

                {/* Step 1: Excel Upload */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">1</div>
                    <Label className="text-sm font-medium text-gray-700">Excel-Datei mit Produktliste hochladen</Label>
                  </div>
                  
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 transition-colors hover:border-blue-400 cursor-pointer"
                    onClick={() => excelInputRef.current?.click()}
                  >
                    <FileSpreadsheet className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      {excelFile ? excelFile.name : 'Klicken Sie, um Excel-Datei auszuwählen'}
                    </p>
                    <p className="text-xs text-gray-500">Excel-Datei mit Spalten "Artikelnummer" und "Produktname"</p>
                  </div>
                  
                  {excelData.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">{excelData.length} Produkte aus Excel-Datei geladen</p>
                    </div>
                  )}
                </div>

                {/* Step 2: Folder Selection */}
                {excelData.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">2</div>
                      <Label className="text-sm font-medium text-gray-700">PDF-Ordner auswählen</Label>
                    </div>
                    
                    <div 
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 transition-colors hover:border-green-400 cursor-pointer"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderOpen className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 mb-1">
                        {pdfFolder ? `${Array.from(pdfFolder).filter(f => f.name.toLowerCase().endsWith('.pdf')).length} PDF-Dateien ausgewählt` : 'Klicken Sie, um PDF-Ordner auszuwählen'}
                      </p>
                      <p className="text-xs text-gray-500">PDF-Dateinamen müssen mit Artikelnummer beginnen</p>
                    </div>
                  </div>
                )}

                {/* Step 3: Parallel Processing Settings */}
                {excelData.length > 0 && pdfFolder && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">3</div>
                      <Label className="text-sm font-medium text-gray-700">Verarbeitungseinstellungen</Label>
                    </div>
                    
                    <div className="flex items-center space-x-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      {/* Parallel Processing */}
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="parallel-count" className="text-xs font-medium text-gray-600 whitespace-nowrap">
                          Parallele Verarbeitung:
                        </Label>
                        <Input
                          id="parallel-count"
                          type="number"
                          min="1"
                          max="10"
                          value={parallelCount}
                          onChange={(e) => setParallelCount(parseInt(e.target.value) || 1)}
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
                    
                    <Button
                      onClick={handleBatchExtraction}
                      disabled={isProcessingBatch}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                    >
                      {isProcessingBatch ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isProcessingBatch ? "Verarbeitung läuft..." : "Batch-Extraktion starten"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Processing Status Table - Moved to Suchergebnisse section */}
          {/* The processing status is now displayed in the Suchergebnisse section through PdfBatchResultsTable */}

          {/* Hidden Inputs */}
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelUpload}
          />
          <input
            ref={folderInputRef}
            type="file"
            {...{ webkitdirectory: "", directory: "" } as any}
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
        </div>
      )}
    </div>
  );
}