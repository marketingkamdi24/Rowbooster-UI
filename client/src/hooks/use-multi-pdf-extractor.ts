import { useState, useCallback, useEffect } from 'react';
import { extractTextFromPDF, validatePDFFile, ProcessedPDF, MultiPDFStats, calculateMultiPDFStats, combineExtractedTexts, generateUniqueId } from '@/lib/pdf-utils';
import { toast } from '@/hooks/use-toast';

const MAX_PDF_FILES = 3;

export function useMultiPDFExtractor() {
  const [pdfs, setPdfs] = useState<ProcessedPDF[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [combinedText, setCombinedText] = useState<string>('');
  const [stats, setStats] = useState<MultiPDFStats | null>(null);

  const addPDFFile = useCallback(async (file: File) => {
    // Check if we've reached the maximum number of files
    if (pdfs.length >= MAX_PDF_FILES) {
      toast({
        title: "Maximum erreicht",
        description: `Sie können maximal ${MAX_PDF_FILES} PDF-Dateien gleichzeitig hochladen.`,
        variant: "destructive"
      });
      return;
    }

    // Validate file
    const validationError = validatePDFFile(file);
    if (validationError) {
      toast({
        title: "Ungültige Datei",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    // Check if file is already added
    const existingFile = pdfs.find(pdf => pdf.file.name === file.name && pdf.file.size === file.size);
    if (existingFile) {
      toast({
        title: "Datei bereits vorhanden",
        description: "Diese Datei wurde bereits hinzugefügt.",
        variant: "destructive"
      });
      return;
    }

    const pdfId = generateUniqueId();
    const newPdf: ProcessedPDF = {
      id: pdfId,
      file,
      text: '',
      pages: 0,
      isProcessing: true,
      error: undefined
    };

    // Add PDF to list immediately
    setPdfs(prev => [...prev, newPdf]);
    setIsProcessing(true);

    try {
      const result = await extractTextFromPDF(file);
      
      // Update the PDF with extracted content
      setPdfs(prev => prev.map(pdf => 
        pdf.id === pdfId 
          ? { ...pdf, text: result.text, pages: result.pages, isProcessing: false }
          : pdf
      ));

      toast({
        title: "Extraktion erfolgreich",
        description: `Text aus "${file.name}" erfolgreich extrahiert (${result.pages} Seiten).`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unerwarteter Fehler beim Extrahieren des Textes.';
      
      // Update the PDF with error
      setPdfs(prev => prev.map(pdf => 
        pdf.id === pdfId 
          ? { ...pdf, isProcessing: false, error: errorMessage }
          : pdf
      ));

      toast({
        title: "Extraktion fehlgeschlagen",
        description: `Fehler beim Extrahieren von "${file.name}": ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      // Check if any PDF is still processing
      setTimeout(() => {
        setPdfs(current => {
          const stillProcessing = current.some(pdf => pdf.isProcessing);
          setIsProcessing(stillProcessing);
          return current;
        });
      }, 100);
    }
  }, [pdfs]);

  const removePDF = useCallback((pdfId: string) => {
    setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
    toast({
      title: "Datei entfernt",
      description: "PDF-Datei wurde aus der Liste entfernt."
    });
  }, []);

  const clearAllPDFs = useCallback(() => {
    setPdfs([]);
    setCombinedText('');
    setStats(null);
    setIsProcessing(false);
  }, []);

  const retryPDF = useCallback(async (pdfId: string) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (!pdf) return;

    // Set as processing
    setPdfs(prev => prev.map(p => 
      p.id === pdfId 
        ? { ...p, isProcessing: true, error: undefined }
        : p
    ));
    setIsProcessing(true);

    try {
      const result = await extractTextFromPDF(pdf.file);
      
      setPdfs(prev => prev.map(p => 
        p.id === pdfId 
          ? { ...p, text: result.text, pages: result.pages, isProcessing: false }
          : p
      ));

      toast({
        title: "Wiederholung erfolgreich",
        description: `Text aus "${pdf.file.name}" erfolgreich extrahiert.`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unerwarteter Fehler.';
      
      setPdfs(prev => prev.map(p => 
        p.id === pdfId 
          ? { ...p, isProcessing: false, error: errorMessage }
          : p
      ));

      toast({
        title: "Wiederholung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setPdfs(current => {
          const stillProcessing = current.some(pdf => pdf.isProcessing);
          setIsProcessing(stillProcessing);
          return current;
        });
      }, 100);
    }
  }, []);

  // Update combined text and stats whenever PDFs change
  useEffect(() => {
    const combined = combineExtractedTexts(pdfs);
    const calculatedStats = calculateMultiPDFStats(pdfs);
    
    setCombinedText(combined);
    setStats(calculatedStats);
  }, [pdfs]);

  const canAddMore = pdfs.length < MAX_PDF_FILES;
  const hasValidPDFs = pdfs.some(pdf => pdf.text && !pdf.error);
  const hasErrors = pdfs.some(pdf => pdf.error);

  return {
    pdfs,
    combinedText,
    stats,
    isProcessing,
    canAddMore,
    hasValidPDFs,
    hasErrors,
    maxFiles: MAX_PDF_FILES,
    addPDFFile,
    removePDF,
    clearAllPDFs,
    retryPDF,
    updateCombinedText: setCombinedText
  };
}