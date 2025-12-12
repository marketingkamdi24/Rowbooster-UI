import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Clean and normalize extracted PDF text to handle encoding issues
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  
  // Remove null bytes and other control characters except newlines and tabs
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // Normalize whitespace - replace multiple spaces with single space
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Normalize line breaks - replace multiple newlines with double newline
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading/trailing whitespace from each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  // Remove empty lines
  cleaned = cleaned.split('\n').filter(line => line.length > 0).join('\n');
  
  return cleaned.trim();
}

/**
 * Detect if extracted text is garbled (has encoding issues)
 */
function isTextGarbled(text: string): boolean {
  if (!text || text.length < 50) return true;
  
  // Check for common garbled text patterns
  const garbledPatterns = [
    /[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]{10,}/g, // Too many non-printable chars
    /\([A-Z]{3,}\)/g, // Pattern like (YR or common in garbled PDFs
    /[\\x[0-9A-F]{2}]{5,}/gi, // Hex escape sequences
    /'[A-Z]{2,}/g, // Single quotes with caps like 'HUVFK
  ];
  
  let garbledScore = 0;
  for (const pattern of garbledPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 5) {
      garbledScore++;
    }
  }
  
  // Check ratio of readable characters
  const readableChars = text.match(/[a-zA-Z0-9\s.,;:!?-]/g)?.length || 0;
  const readableRatio = readableChars / text.length;
  
  if (readableRatio < 0.7) garbledScore++;
  
  return garbledScore >= 2;
}

/**
 * Get the Chromium executable path based on the environment
 * - If PUPPETEER_EXECUTABLE_PATH env var is set, use it
 * - If running on Replit/Nix, use the Nix store path
 * - Otherwise, let Puppeteer use its bundled Chromium
 */
function getChromiumPath(): string | undefined {
  // Allow override via environment variable (most flexible)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Check if running on Replit (Nix environment)
  const nixChromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    if (fs.existsSync(nixChromiumPath)) {
      return nixChromiumPath;
    }
  } catch (e) {
    // fs.existsSync failed, proceed to default
  }
  
  // Check for common Chromium/Chrome paths on Linux servers
  const commonPaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  
  try {
    for (const chromePath of commonPaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  } catch (e) {
    // fs.existsSync failed, proceed to default
  }
  
  // Let Puppeteer use its bundled Chromium
  return undefined;
}

/**
 * Build Puppeteer launch options for cross-platform compatibility
 */
function getPuppeteerLaunchOptions(): any {
  const executablePath = getChromiumPath();
  
  const options: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote'
    ]
  };
  
  if (executablePath) {
    options.executablePath = executablePath;
  }
  
  return options;
}

/**
 * Check if Puppeteer and Chromium are available
 */
async function checkPuppeteerAvailability(): Promise<boolean> {
  try {
    // Try to import puppeteer and launch browser
    const puppeteer = await import('puppeteer');
    
    // Try a quick launch to see if browser is available
    const launchOptions = getPuppeteerLaunchOptions();
    const browser = await puppeteer.launch(launchOptions);
    
    await browser.close();
    return true;
  } catch (error) {
    // Puppeteer not installed, Chromium not found, or other error
    console.log(`[PDF-UPLOAD] Puppeteer availability check failed: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Extract text from PDF using Puppeteer (handles encoding issues better)
 */
async function extractWithPuppeteer(pdfBuffer: Buffer): Promise<string> {
  let browser;
  let tempFile: string | null = null;
  
  try {
    console.log('[PDF-PUPPETEER] Starting Puppeteer-based PDF extraction');
    
    // Save PDF to temporary file
    const tempDir = os.tmpdir();
    tempFile = path.join(tempDir, `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
    fs.writeFileSync(tempFile, pdfBuffer);
    console.log(`[PDF-PUPPETEER] Saved PDF to temp file: ${tempFile}`);
    
    // Launch Puppeteer with cross-platform options
    const puppeteer = await import('puppeteer');
    const launchOptions = getPuppeteerLaunchOptions();
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    
    // Load PDF in browser
    const fileUrl = `file:///${tempFile.replace(/\\/g, '/')}`;
    console.log(`[PDF-PUPPETEER] Loading PDF: ${fileUrl}`);
    
    await page.goto(fileUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for PDF to render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract text from rendered PDF
    const extractedText = await page.evaluate(() => {
      // Get all text content from the page
      return document.body.innerText || document.body.textContent || '';
    });
    
    console.log(`[PDF-PUPPETEER] ✅ Extracted ${extractedText.length} characters using Puppeteer`);
    
    return extractedText;
    
  } catch (error) {
    console.error('[PDF-PUPPETEER] ❌ Puppeteer extraction failed:', error);
    throw error;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
        console.log(`[PDF-PUPPETEER] Cleaned up temp file: ${tempFile}`);
      } catch (err) {
        console.error('[PDF-PUPPETEER] Failed to delete temp file:', err);
      }
    }
  }
}

/**
 * Extract text content from a PDF file
 * @param url - URL or path to the PDF file
 * @returns Extracted text content as plain text
 */
export async function extractPdfText(url: string): Promise<string> {
  try {
    console.log(`[PDF-EXTRACTION] Starting PDF text extraction from: ${url}`);
    
    // Download the PDF file
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 10,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,application/x-pdf,*/*'
      }
    });
    
    const pdfBuffer = Buffer.from(response.data);
    console.log(`[PDF-EXTRACTION] Downloaded PDF, size: ${pdfBuffer.length} bytes`);
    
    // Verify it's actually a PDF by checking the header
    const header = pdfBuffer.toString('utf8', 0, 8);
    if (!header.startsWith('%PDF-')) {
      console.error(`[PDF-EXTRACTION] File does not appear to be a PDF. Header: ${header}`);
      throw new Error('Downloaded file is not a valid PDF');
    }
    
    console.log(`[PDF-EXTRACTION] Verified PDF signature: ${header}`);
    
    // Try extraction with buffer
    const result = await extractPdfTextFromBuffer(pdfBuffer);
    
    // Format the output with metadata
    const formattedText = `[PDF Document: ${url}]\n[Total Pages: ${result.numpages}]\n\n${result.text}`;
    
    return formattedText.trim();
    
  } catch (error) {
    console.error(`[PDF-EXTRACTION] ❌ Error extracting PDF text:`, error);
    throw new Error(`Failed to extract PDF text: ${(error as Error).message}`);
  }
}

/**
 * Extract text from PDF buffer (for file uploads) with encoding issue detection
 * @param pdfBuffer - PDF file buffer  
 * @returns Extracted text data
 */
export async function extractPdfTextFromBuffer(pdfBuffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
  try {
    console.log(`[PDF-UPLOAD] Processing uploaded PDF, size: ${pdfBuffer.length} bytes`);
    
    // First, try standard pdf-parse extraction
    console.log(`[PDF-UPLOAD] Attempting standard PDF text extraction...`);
    const uint8Array = new Uint8Array(pdfBuffer);
    const parser = new PDFParse(uint8Array);
    
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    
    const rawText = textResult.text || '';
    const numPages = infoResult.total || 0;
    
    console.log(`[PDF-UPLOAD] Standard extraction: ${rawText.length} characters from ${numPages} pages`);
    
    // Check if text is garbled
    const textIsGarbled = isTextGarbled(rawText);
    
    if (textIsGarbled) {
      console.warn(`[PDF-UPLOAD] ⚠️ Detected garbled text from standard extraction`);
      console.log(`[PDF-UPLOAD] Sample of garbled text: ${rawText.substring(0, 200)}`);
      
      // Only try Puppeteer if it's available (check for common Chromium paths)
      const isPuppeteerAvailable = await checkPuppeteerAvailability();
      
      if (isPuppeteerAvailable) {
        console.log(`[PDF-UPLOAD] Attempting Puppeteer-based extraction as fallback...`);
        
        try {
          const puppeteerText = await extractWithPuppeteer(pdfBuffer);
          
          if (puppeteerText && puppeteerText.length > 100 && !isTextGarbled(puppeteerText)) {
            console.log(`[PDF-UPLOAD] ✅ Puppeteer extraction successful: ${puppeteerText.length} characters`);
            const cleanedText = cleanPdfText(puppeteerText);
            
            return {
              text: cleanedText,
              numpages: numPages,
              info: { Pages: numPages, Method: 'Puppeteer (encoding fix)' }
            };
          } else {
            console.warn(`[PDF-UPLOAD] Puppeteer extraction also produced garbled text`);
          }
        } catch (puppeteerError) {
          console.error(`[PDF-UPLOAD] Puppeteer extraction failed:`, puppeteerError);
        }
      } else {
        console.log(`[PDF-UPLOAD] ⚠️ Puppeteer/Chromium not available for fallback extraction`);
        console.log(`[PDF-UPLOAD] Proceeding with standard extraction (may have encoding issues)`);
      }
    }
    
    // Use standard extraction (either it's good, or Puppeteer failed)
    const cleanedText = cleanPdfText(rawText);
    console.log(`[PDF-UPLOAD] ✅ Using standard extraction: ${cleanedText.length} characters`);
    
    return {
      text: cleanedText,
      numpages: numPages,
      info: { Pages: numPages, Method: 'Standard pdf-parse' }
    };
    
  } catch (error) {
    console.error(`[PDF-UPLOAD] ❌ Error extracting PDF text:`, error);
    throw new Error(`Failed to extract PDF text: ${(error as Error).message}`);
  }
}