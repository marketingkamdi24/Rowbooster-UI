// PDF.js types declaration
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface ExtractedContent {
  text: string;
  pages: number;
}

export interface ProcessedPDF {
  id: string;
  file: File;
  text: string;
  pages: number;
  isProcessing: boolean;
  error?: string;
}

export interface MultiPDFStats {
  totalFiles: number;
  totalPages: number;
  totalCharacters: number;
  totalWords: number;
}

export interface TextStats {
  characters: number;
  words: number;
}

export function validatePDFFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'Bitte wählen Sie eine PDF-Datei aus.';
  }
  
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return 'Dateigröße muss kleiner als 100MB sein.';
  }
  
  return null;
}

export function calculateTextStats(text: string): TextStats {
  const characters = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  
  return { characters, words };
}

/**
 * Sanitize text content to remove characters that may cause issues with JSON encoding
 * or server-side validation. This is critical for PDF text which may contain control characters.
 */
export function sanitizeTextContent(text: string): string {
  if (!text) return '';
  
  let sanitized = text;
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters except newlines (\n), carriage returns (\r), and tabs (\t)
  // Control characters: 0x00-0x1F and 0x7F-0x9F
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // Replace invalid Unicode surrogate pairs with replacement character
  // This handles characters that can't be properly encoded in JSON
  sanitized = sanitized.replace(/[\uD800-\uDFFF]/g, '\uFFFD');
  
  // Remove Unicode replacement characters and other problematic chars
  sanitized = sanitized.replace(/\uFFFD/g, '');
  sanitized = sanitized.replace(/\uFEFF/g, ''); // BOM
  
  // Normalize various types of spaces to regular spaces
  sanitized = sanitized.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
  
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u206F]/g, '');
  
  // Normalize line endings to \n
  sanitized = sanitized.replace(/\r\n/g, '\n');
  sanitized = sanitized.replace(/\r/g, '\n');
  
  // Remove excessive consecutive newlines (more than 3)
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  
  // Ensure valid UTF-8 by removing any remaining problematic sequences
  // Try to encode and decode as UTF-8 to filter out invalid sequences
  try {
    sanitized = decodeURIComponent(encodeURIComponent(sanitized));
  } catch (e) {
    // If encoding fails, do a more aggressive cleanup
    sanitized = sanitized.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF\n\r\t]/g, '');
  }
  
  return sanitized.trim();
}

export function calculateMultiPDFStats(pdfs: ProcessedPDF[]): MultiPDFStats {
  const totalFiles = pdfs.length;
  let totalPages = 0;
  let totalCharacters = 0;
  let totalWords = 0;

  pdfs.forEach(pdf => {
    if (pdf.text && !pdf.error) {
      totalPages += pdf.pages;
      const stats = calculateTextStats(pdf.text);
      totalCharacters += stats.characters;
      totalWords += stats.words;
    }
  });

  return {
    totalFiles,
    totalPages,
    totalCharacters,
    totalWords
  };
}

export function combineExtractedTexts(pdfs: ProcessedPDF[]): string {
  const validPdfs = pdfs.filter(pdf => pdf.text && !pdf.error);
  
  if (validPdfs.length === 0) {
    return '';
  }

  // Enhanced PDF text combination with better structure markers
  const combinedText = validPdfs
    .map((pdf, index) => {
      const docSeparator = validPdfs.length > 1 ? 
        `\n\n=== DOCUMENT ${index + 1}: ${pdf.file.name} ===\n` : 
        `\n=== PDF DOCUMENT: ${pdf.file.name} ===\n`;
      
      // Add structured content markers for AI processing
      const structuredText = pdf.text
        .replace(/\[TABLE_START\]/g, '\n[STRUCTURED_DATA_START]')
        .replace(/\[TABLE_END\]/g, '[STRUCTURED_DATA_END]\n')
        .replace(/=== ([^=]+) ===/g, '\n[SECTION: $1]\n');
      
      return docSeparator + 
             '[ENHANCED_PDF_PROCESSING]\n' +
             structuredText + 
             '\n[END_DOCUMENT]\n';
    })
    .join('\n\n');

  return combinedText;
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function extractTextFromPDF(file: File): Promise<ExtractedContent> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        
        // Configure PDF.js worker
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
          const numPages = pdf.numPages;
          const textPromises: Promise<string>[] = [];
          
          // Extract text from all pages with enhanced table structure preservation
          for (let i = 1; i <= numPages; i++) {
            const pagePromise = pdf.getPage(i).then(async (page: any) => {
              const textContent = await page.getTextContent();
              
              // Enhanced table detection and structure preservation
              const textItems: Array<{
                str: string;
                x: number;
                y: number;
                width: number;
                height: number;
                fontName?: string;
                fontSize?: number;
              }> = [];
              
              textContent.items.forEach((item: any) => {
                if (item.str.trim()) {
                  textItems.push({
                    str: item.str.trim(),
                    x: item.transform[4],
                    y: item.transform[5],
                    width: item.width || 0,
                    height: item.height || 0,
                    fontName: item.fontName || '',
                    fontSize: item.transform[0] || 0
                  });
                }
              });
              
              // Sort by Y position first (top to bottom), then by X position (left to right)
              textItems.sort((a, b) => {
                const yDiff = Math.round(b.y / 2) - Math.round(a.y / 2); // More precise Y grouping
                if (yDiff !== 0) return yDiff;
                return a.x - b.x; // Then sort by X position within the same row
              });
              
              // Advanced table structure detection
              const rows: Array<Array<{str: string, x: number, isHeader?: boolean}>> = [];
              let currentRow: Array<{str: string, x: number, isHeader?: boolean}> = [];
              let lastY = textItems.length > 0 ? Math.round(textItems[0].y / 2) : 0;
              
              textItems.forEach(item => {
                const currentY = Math.round(item.y / 2);
                
                // If Y position changed significantly, start a new row
                if (Math.abs(currentY - lastY) > 1) {
                  if (currentRow.length > 0) {
                    // Sort current row by X position
                    currentRow.sort((a, b) => a.x - b.x);
                    rows.push(currentRow);
                  }
                  currentRow = [];
                  lastY = currentY;
                }
                
                // Detect if this might be a header (based on font size or specific patterns)
                const isHeader = (item.fontSize ?? 0) > 12 || 
                               item.str.includes('Technische Daten') || 
                               item.str.includes('Specifications') ||
                               item.str.includes('Eigenschaften') ||
                               item.str.includes('Parameter');
                
                currentRow.push({ str: item.str, x: item.x, isHeader });
              });
              
              // Add the last row
              if (currentRow.length > 0) {
                currentRow.sort((a, b) => a.x - b.x);
                rows.push(currentRow);
              }
              
              // Analyze column structure and detect tables
              const columnPositions = new Set<number>();
              rows.forEach(row => {
                row.forEach(cell => {
                  columnPositions.add(Math.round(cell.x / 10) * 10); // Round to nearest 10
                });
              });
              
              const sortedColumns = Array.from(columnPositions).sort((a, b) => a - b);
              
              // Convert rows to formatted text with enhanced table detection
              const formattedRows = rows.map((row, rowIndex) => {
                if (row.length === 1) {
                  const cell = row[0];
                  if (cell.isHeader) {
                    return `\n=== ${cell.str} ===`;
                  }
                  return cell.str;
                }
                
                // Multi-column rows - detect if this is a table
                const hasTabularStructure = row.length >= 2 && 
                  row.some(cell => /\d+\s*(mm|kg|kw|%|°c|cm|pa|mg\/m³|g\/s|m³|v|w)/i.test(cell.str));
                
                if (hasTabularStructure) {
                  // This looks like a table row
                  let formattedRow = '';
                  
                  // Map cells to columns
                  const cellsByColumn = new Map<number, string>();
                  row.forEach(cell => {
                    const columnIndex = sortedColumns.findIndex(pos => Math.abs(pos - cell.x) <= 15);
                    if (columnIndex !== -1) {
                      cellsByColumn.set(columnIndex, cell.str);
                    }
                  });
                  
                  // Create table row with proper alignment
                  const tableRow = [];
                  for (let i = 0; i < Math.max(3, sortedColumns.length); i++) {
                    const cellValue = cellsByColumn.get(i) || '';
                    tableRow.push(cellValue.padEnd(20));
                  }
                  
                  formattedRow = `| ${tableRow.join(' | ')} |`;
                  
                  // Add table markers for AI processing
                  if (rowIndex === 0 || !rows[rowIndex - 1] || rows[rowIndex - 1].length === 1) {
                    formattedRow = `[TABLE_START]\n${formattedRow}`;
                  }
                  
                  return formattedRow;
                } else {
                  // Regular multi-column text
                  let formattedRow = '';
                  for (let j = 0; j < row.length; j++) {
                    if (j === 0) {
                      formattedRow = row[j].str;
                    } else {
                      // Calculate spacing based on X position difference
                      const prevX = row[j-1].x;
                      const currentX = row[j].x;
                      const spacing = Math.max(1, Math.round((currentX - prevX) / 15));
                      
                      if (spacing <= 3) {
                        formattedRow += ' : ' + row[j].str; // Use colon for property-value pairs
                      } else {
                        formattedRow += '\t' + row[j].str; // Use tab for wider spacing
                      }
                    }
                  }
                  return formattedRow;
                }
              });
              
              // Add table end markers
              let finalText = formattedRows.join('\n');
              finalText = finalText.replace(/(\[TABLE_START\][\s\S]*?)(?=\n[^|]|\n$|$)/g, '$1\n[TABLE_END]');
              
              return finalText;
            });
            textPromises.push(pagePromise);
          }
          
          const pagesText = await Promise.all(textPromises);
          const fullText = pagesText.join('\n\n');
          
          resolve({
            text: fullText,
            pages: numPages
          });
        } else {
          reject(new Error('PDF.js library not loaded. Please refresh the page.'));
        }
      } catch (error) {
        console.error('PDF extraction error:', error);
        reject(new Error('Error processing PDF. Please try again with a different file.'));
      }
    };
    
    fileReader.onerror = () => {
      reject(new Error('Error reading the file. Please try again.'));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
}

export function downloadTextAsFile(text: string, filename: string = 'extracted-text.txt') {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
}