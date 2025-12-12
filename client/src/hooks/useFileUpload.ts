import { useState, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { FileUploadData } from "@/lib/types";
import * as XLSX from "xlsx";

// Column detection state type for validation display
export interface ColumnDetection {
  hasProductName: boolean;
  hasArticleNumber: boolean;
  detectedColumns: string[];
  missingRequired: string[];
}

// Validation error type for dialog display
export interface FileValidationError {
  message: string;
  details: string;
  missingColumns: string[];
  detectedColumns: {
    hasProduktname: boolean;
    hasArtikelnummer: boolean;
    hasUrl?: boolean;
  };
  mode: 'automated' | 'url' | 'url+pdf';
  modeName: string;
}

export default function useFileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [processedData, setProcessedData] = useState<FileUploadData[]>([]);
  const [columnDetection, setColumnDetection] = useState<ColumnDetection>({
    hasProductName: false,
    hasArticleNumber: false,
    detectedColumns: [],
    missingRequired: []
  });
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [showValidationErrorDialog, setShowValidationErrorDialog] = useState(false);

  const processExcel = (data: ArrayBuffer) => {
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<FileUploadData>(worksheet);
    
    // Get first row headers to check column names
    const rawHeaders = Object.keys(jsonData[0] || {});
    const headers = rawHeaders.map(h => h.toLowerCase());
    
    // Check if ProductName column exists
    const hasProductName = headers.some(h =>
      h === "productname" || h === "produktname" || h === "product name"
    );
    
    // Check if ArticleNumber column exists (optional)
    const hasArticleNumber = headers.some(h =>
      h === "articlenumber" || h === "artikelnummer" || h === "article number" || h === "article_number" || h === "sku"
    );
    
    // Calculate missing required columns
    const missingRequired: string[] = [];
    if (!hasProductName) missingRequired.push('Produktname');
    
    // Update column detection state
    setColumnDetection({
      hasProductName,
      hasArticleNumber,
      detectedColumns: rawHeaders,
      missingRequired
    });
    
    if (!hasProductName) {
      // Set validation error for dialog display
      setValidationError({
        message: `Fehlende Spalte: Produktname`,
        details: `Die Spalte "Produktname" (oder "ProductName") fehlt in Ihrer Excel-Datei. Bitte fügen Sie diese Spalte hinzu und laden Sie die Datei erneut hoch.`,
        missingColumns: ['Produktname'],
        detectedColumns: {
          hasProduktname: false,
          hasArtikelnummer: hasArticleNumber,
          hasUrl: false
        },
        mode: 'automated',
        modeName: 'Automatisch-Modus'
      });
      setShowValidationErrorDialog(true);
      return null;
    }
    
    // Validate that every row has ProductName
    const isValid = jsonData.every(item =>
      (item.ProductName || item.Produktname)
    );
    
    if (!isValid) {
      // Set validation error for dialog display
      setValidationError({
        message: `Leere Produktnamen gefunden`,
        details: `Einige Zeilen in Ihrer Excel-Datei haben keinen Produktnamen. Bitte füllen Sie alle Produktnamen aus und laden Sie die Datei erneut hoch.`,
        missingColumns: ['Produktname (einige Zeilen leer)'],
        detectedColumns: {
          hasProduktname: true,
          hasArtikelnummer: hasArticleNumber,
          hasUrl: false
        },
        mode: 'automated',
        modeName: 'Automatisch-Modus'
      });
      setShowValidationErrorDialog(true);
      return null;
    }
    
    // Normalize column names if needed
    const normalizedData = jsonData.map(item => {
      const { ArticleNumber, Artikelnummer, ProductName, Produktname, ...rest } = item;
      return {
        ArticleNumber: ArticleNumber || Artikelnummer || "",
        ProductName: ProductName || Produktname || "",
        ...rest
      };
    });
    
    return normalizedData;
  };

  const processCSV = (text: string) => {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map(header => header.trim());
    const headersLower = headers.map(h => h.toLowerCase());
    
    // Validate required headers - only ProductName is required, ArticleNumber is optional
    const hasProductName = headersLower.some(h =>
      h === "productname" || h === "produktname" || h === "product name"
    );
    
    // Check if ArticleNumber column exists (optional)
    const hasArticleNumber = headersLower.some(h =>
      h === "articlenumber" || h === "artikelnummer" || h === "article number" || h === "article_number" || h === "sku"
    );
    
    // Calculate missing required columns
    const missingRequired: string[] = [];
    if (!hasProductName) missingRequired.push('Produktname');
    
    // Update column detection state
    setColumnDetection({
      hasProductName,
      hasArticleNumber,
      detectedColumns: headers,
      missingRequired
    });
    
    if (!hasProductName) {
      // Set validation error for dialog display
      setValidationError({
        message: `Fehlende Spalte: Produktname`,
        details: `Die Spalte "Produktname" (oder "ProductName") fehlt in Ihrer CSV-Datei. Bitte fügen Sie diese Spalte hinzu und laden Sie die Datei erneut hoch.`,
        missingColumns: ['Produktname'],
        detectedColumns: {
          hasProduktname: false,
          hasArtikelnummer: hasArticleNumber,
          hasUrl: false
        },
        mode: 'automated',
        modeName: 'Automatisch-Modus'
      });
      setShowValidationErrorDialog(true);
      return null;
    }
    
    const result: FileUploadData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(",").map(value => value.trim());
      const obj: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      
      // Normalize column names - exclude the original keys to avoid duplicates
      const { ArticleNumber, Artikelnummer, ProductName, Produktname, ...rest } = obj;
      result.push({
        ArticleNumber: ArticleNumber || Artikelnummer || "",
        ProductName: ProductName || Produktname || "",
        ...rest
      });
    }
    
    return result;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Clear file input value immediately to allow re-uploading the same file
    // This ensures onChange fires even if the same file is selected again
    if (event.target) {
      event.target.value = '';
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const target = e.target;
        if (!target || !target.result) {
          throw new Error("Failed to read file");
        }
        
        let data: FileUploadData[] | null = null;
        
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          data = processExcel(target.result as ArrayBuffer);
        } else if (file.name.endsWith(".csv")) {
          data = processCSV(target.result as string);
        } else {
          toast({
            title: "Unsupported file format",
            description: "Please upload a .xlsx, .xls, or .csv file",
            variant: "destructive",
          });
          return;
        }
        
        // Only set filename and show success toast if data is valid
        if (data && data.length > 0) {
          setSelectedFileName(file.name);
          setProcessedData(data);
          toast({
            title: "File processed successfully",
            description: `Loaded ${data.length} product(s) from file`,
          });
        } else {
          // Validation failed - don't set filename or show success toast
          // The validation error dialog will be shown by processExcel/processCSV
          setSelectedFileName("");
          setProcessedData([]);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setSelectedFileName("");
        setProcessedData([]);
        toast({
          title: "Error processing file",
          description: (error as Error).message || "An unknown error occurred",
          variant: "destructive",
        });
      }
    };
    
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Reset function to clear all file upload state
  const resetFileUpload = () => {
    setSelectedFileName("");
    setProcessedData([]);
    setColumnDetection({
      hasProductName: false,
      hasArticleNumber: false,
      detectedColumns: [],
      missingRequired: []
    });
    setValidationError(null);
    setShowValidationErrorDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Close validation error dialog
  const closeValidationErrorDialog = () => {
    setShowValidationErrorDialog(false);
  };

  return {
    fileInputRef,
    selectedFileName,
    processedData,
    columnDetection,
    handleFileChange,
    resetFileUpload,
    validationError,
    showValidationErrorDialog,
    setShowValidationErrorDialog,
    closeValidationErrorDialog,
  };
}
