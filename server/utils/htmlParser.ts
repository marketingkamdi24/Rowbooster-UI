import { parse } from 'node-html-parser';

/**
 * Parses HTML content and extracts clean text content while preserving structure
 * Simply removes HTML tags and extracts text in an organized way
 */
export function parseHtmlToCleanText(htmlContent: string): string {
  try {
    // Ensure we have a string to work with
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }
    
    // Parse the HTML content
    const root = parse(htmlContent);
    
    // Remove script and style tags as they don't contain useful content
    root.querySelectorAll('script').forEach(el => el.remove());
    root.querySelectorAll('style').forEach(el => el.remove());
    root.querySelectorAll('noscript').forEach(el => el.remove());
    
    // Extract text content while preserving basic structure
    const textContent = extractTextWithStructure(root);
    
    // Clean up the text
    return cleanupText(textContent);
    
  } catch (error) {
    console.error('Error parsing HTML content:', error);
    // Fallback: basic HTML tag removal
    if (typeof htmlContent === 'string') {
      return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }
}

/**
 * Extracts text content from an HTML element while preserving basic structure
 */
function extractTextWithStructure(element: any): string {
  // Simply get all text content and preserve basic structure with line breaks
  let text = '';
  
  // Handle tables - convert to readable format
  const tables = element.querySelectorAll('table');
  tables.forEach((table: any) => {
    text += '\n--- TABLE ---\n';
    const rows = table.querySelectorAll('tr');
    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td, th');
      const cellTexts = cells.map((cell: any) => cell.text.trim()).filter((t: string) => t);
      if (cellTexts.length > 0) {
        text += cellTexts.join(' | ') + '\n';
      }
    });
    text += '--- END TABLE ---\n';
  });
  
  // Handle lists - convert to readable format
  const lists = element.querySelectorAll('ul, ol');
  lists.forEach((list: any) => {
    const items = list.querySelectorAll('li');
    items.forEach((item: any) => {
      const itemText = item.text.trim();
      if (itemText) {
        text += `• ${itemText}\n`;
      }
    });
  });
  
  // Get all remaining text content from the element
  const clonedElement = element.clone();
  clonedElement.querySelectorAll('table, ul, ol').forEach((el: any) => el.remove());
  
  // Extract text from common content elements
  const contentElements = clonedElement.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, span');
  contentElements.forEach((el: any) => {
    const elementText = el.text.trim();
    if (elementText && elementText.length > 2) {
      text += elementText + '\n';
    }
  });
  
  // If we didn't get much structured content, just get all text
  if (text.trim().length < 100) {
    text = element.text || '';
  }
  
  return text;
}

/**
 * Cleans up extracted text content
 */
function cleanupText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    // Remove very short lines that are likely noise
    .split('\n')
    .filter(line => line.length > 2 || line.match(/\d/) || line.includes(':'))
    .join('\n')
    .trim();
}

/**
 * Simple function to remove HTML tags and get clean text
 */
function simpleHtmlToText(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Remove script and style content
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML tags but keep the text content
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Processes multiple HTML content sources and returns clean text
 */
export function processMultipleHtmlSources(htmlSources: string[]): string {
  const cleanedSources = htmlSources.map((html, index) => {
    // Use simple HTML to text conversion
    const cleanText = simpleHtmlToText(html);
    return `
=========================================================================================
WEBSITE SOURCE ${index + 1}
=========================================================================================

${cleanText}

`;
  }).filter(source => source.length > 200); // Only include sources with meaningful content
  
  return cleanedSources.join('\n\n');
}