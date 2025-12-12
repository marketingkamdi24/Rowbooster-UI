import { useState, useCallback } from 'react';
import { extractTextFromPDF, validatePDFFile, calculateTextStats, ExtractedContent } from '@/lib/pdf-utils';
import { toast } from '@/hooks/use-toast';

export interface PDFStats {
  pages: number;
  characters: number;
  words: number;
}

export function usePDFExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PDFStats | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file
    const validationError = validatePDFFile(selectedFile);
    if (validationError) {
      setError(validationError);
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      const result: ExtractedContent = await extractTextFromPDF(selectedFile);
      const textStats = calculateTextStats(result.text);
      
      setExtractedText(result.text);
      setStats({
        pages: result.pages,
        characters: textStats.characters,
        words: textStats.words
      });
      
      toast({ 
        title: "Success!", 
        description: `Text extracted successfully from ${result.pages} page${result.pages !== 1 ? 's' : ''}.` 
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
      toast({ 
        title: "Extraction Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAll = useCallback(() => {
    setFile(null);
    setExtractedText('');
    setError(null);
    setStats(null);
    setIsLoading(false);
  }, []);

  const updateText = useCallback((newText: string) => {
    setExtractedText(newText);
    if (newText && stats) {
      const textStats = calculateTextStats(newText);
      setStats(prev => prev ? {
        ...prev,
        characters: textStats.characters,
        words: textStats.words
      } : null);
    }
  }, [stats]);

  return {
    file,
    extractedText,
    isLoading,
    error,
    stats,
    handleFileSelect,
    clearAll,
    updateText
  };
}