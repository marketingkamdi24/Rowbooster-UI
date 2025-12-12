import { SearchResponse, ExportOptions, ProductResult, PropertyResult } from "@shared/schema";
import * as XLSX from "xlsx-js-style";

interface ExportData extends ExportOptions {
  searchResult: SearchResponse;
  properties?: { name: string; orderIndex?: number }[];
}

// Cell styling colors matching the table highlighting
const CELL_COLORS = {
  oneSource: "FEFCE8",     // yellow-50 - 1 confirmed source
  twoSources: "F7FEE7",    // lime-50 - 2 confirmed sources
  threeOrMore: "F0FDF4",   // green-50 - 3+ confirmed sources
  header: "F3F4F6",        // gray-100 - header background
  notFound: "FFFFFF",      // white - no data found
};

// Helper function to get cell background color based on property data
function getCellColor(propertyData: PropertyResult | undefined): string {
  if (!propertyData || !propertyData.value ||
      propertyData.value === 'Not found' ||
      propertyData.value === 'Not Found' ||
      propertyData.value === 'Nicht gefunden' ||
      propertyData.value.trim() === '') {
    return CELL_COLORS.notFound;
  }

  // Get source count (use consistencyCount if available, otherwise sources length)
  const sourceCount = propertyData.consistencyCount || propertyData.sources?.length || 0;
  
  if (sourceCount >= 3) {
    return CELL_COLORS.threeOrMore;
  } else if (sourceCount === 2) {
    return CELL_COLORS.twoSources;
  } else if (sourceCount === 1) {
    return CELL_COLORS.oneSource;
  }
  
  return CELL_COLORS.notFound;
}

// Create cell with styling
function createStyledCell(value: any, bgColor?: string, isHeader = false): any {
  const cell: any = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
  };
  
  cell.s = {
    fill: bgColor ? {
      fgColor: { rgb: bgColor },
      patternType: "solid"
    } : undefined,
    font: {
      bold: isHeader,
      sz: isHeader ? 11 : 10,
    },
    alignment: {
      vertical: "center",
      horizontal: isHeader ? "center" : "left",
    },
    border: {
      top: { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left: { style: "thin", color: { rgb: "E5E7EB" } },
      right: { style: "thin", color: { rgb: "E5E7EB" } },
    }
  };
  
  return cell;
}

export const exportToFile = (data: ExportData) => {
  const {
    searchResult,
    format,
    includeProductData,
    includeSourceUrls,
    includeConfidenceScores,
    filename
  } = data;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Create a single worksheet with all products as rows (with styling)
  const { wsData, cellStyles } = createAllProductsWorksheetWithStyles(
    searchResult,
    includeProductData,
    includeSourceUrls,
    includeConfidenceScores,
    data.properties
  );
  
  // Create worksheet from styled data
  const ws = XLSX.utils.aoa_to_sheet(wsData.map(row => row.map(cell => cell.v !== undefined ? cell.v : cell)));
  
  // Apply cell styles
  for (let rowIdx = 0; rowIdx < wsData.length; rowIdx++) {
    for (let colIdx = 0; colIdx < wsData[rowIdx].length; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const styledCell = wsData[rowIdx][colIdx];
      if (styledCell && styledCell.s) {
        if (!ws[cellRef]) {
          ws[cellRef] = { v: styledCell.v, t: styledCell.t || 's' };
        }
        ws[cellRef].s = styledCell.s;
      }
    }
  }
  
  // Set column widths
  const colWidths: XLSX.ColInfo[] = [];
  if (wsData[0]) {
    for (let i = 0; i < wsData[0].length; i++) {
      colWidths.push({ wch: 18 }); // Default width
    }
  }
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Product Data");
  
  // Generate file
  if (format === "xlsx") {
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    // For CSV, export the single worksheet (without styling)
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Create download link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

function createAllProductsWorksheetWithStyles(
  searchResult: SearchResponse,
  includeProductData: boolean,
  includeSourceUrls: boolean,
  includeConfidenceScores: boolean,
  properties?: { name: string; orderIndex?: number }[]
): { wsData: any[][]; cellStyles: any } {
  const wsData: any[][] = [];
  
  // Collect all unique property names from all products (excluding internal properties)
  const allPropertyNames = new Set<string>();
  searchResult.products.forEach(product => {
    Object.keys(product.properties).forEach(propertyName => {
      // Skip internal properties that start with __
      if (!propertyName.startsWith('__')) {
        allPropertyNames.add(propertyName);
      }
    });
  });
  
  // Use properties order if provided, otherwise fallback to alphabetical sorting
  let sortedPropertyNames: string[];
  if (properties && properties.length > 0) {
    // Sort properties by orderIndex and filter to only include existing properties
    const orderedProperties = properties
      .filter(prop => allPropertyNames.has(prop.name))
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      .map(prop => prop.name);
    
    // Add any remaining properties that weren't in the properties list
    const remainingProperties = Array.from(allPropertyNames)
      .filter(name => !orderedProperties.includes(name))
      .sort();
    
    sortedPropertyNames = [...orderedProperties, ...remainingProperties];
  } else {
    // Fallback to alphabetical sorting
    sortedPropertyNames = Array.from(allPropertyNames).sort();
  }
  
  // Create headers with styling
  const headerRow: any[] = [];
  
  // Add basic product info columns if requested
  if (includeProductData) {
    headerRow.push(createStyledCell("Article Number", CELL_COLORS.header, true));
    headerRow.push(createStyledCell("Product Name", CELL_COLORS.header, true));
    headerRow.push(createStyledCell("Search Method", CELL_COLORS.header, true));
  }
  
  // Add all property columns
  sortedPropertyNames.forEach(propertyName => {
    headerRow.push(createStyledCell(propertyName, CELL_COLORS.header, true));
    
    // Add additional columns if requested
    if (includeConfidenceScores) {
      headerRow.push(createStyledCell(`${propertyName} - Confidence`, CELL_COLORS.header, true));
    }
    
    if (includeSourceUrls) {
      headerRow.push(createStyledCell(`${propertyName} - Sources`, CELL_COLORS.header, true));
    }
  });
  
  // Add header row
  wsData.push(headerRow);
  
  // Add data rows - one for each product
  searchResult.products.forEach(product => {
    const row: any[] = [];
    
    // Add basic product info if requested (with white background)
    if (includeProductData) {
      row.push(createStyledCell(product.articleNumber || '', CELL_COLORS.notFound));
      row.push(createStyledCell(product.productName || '', CELL_COLORS.notFound));
      row.push(createStyledCell(searchResult.searchMethod || '', CELL_COLORS.notFound));
    }
    
    // Add property values for each property column with dynamic coloring
    sortedPropertyNames.forEach(propertyName => {
      const propertyData = product.properties[propertyName];
      
      // Get the appropriate cell color based on source count
      const cellColor = getCellColor(propertyData);
      
      // Add property value with color
      if (propertyData) {
        const value = (!propertyData.value || propertyData.value === 'Not found' || propertyData.value === 'Not Found' || propertyData.value === 'Nicht gefunden') ? '' : propertyData.value;
        row.push(createStyledCell(value, cellColor));
      } else {
        row.push(createStyledCell('', CELL_COLORS.notFound));
      }
      
      // Add confidence score if requested
      if (includeConfidenceScores) {
        row.push(createStyledCell(propertyData ? `${propertyData.confidence}%` : '', cellColor));
      }
      
      // Add source URLs if requested
      if (includeSourceUrls) {
        if (propertyData && propertyData.sources && propertyData.sources.length > 0) {
          const sourceUrls = propertyData.sources.map(source => source.url).join(', ');
          row.push(createStyledCell(sourceUrls, cellColor));
        } else {
          row.push(createStyledCell('', CELL_COLORS.notFound));
        }
      }
    });
    
    wsData.push(row);
  });
  
  return { wsData, cellStyles: {} };
}

// Keep the old function for backward compatibility (returns plain data without styles)
function createAllProductsWorksheet(
  searchResult: SearchResponse,
  includeProductData: boolean,
  includeSourceUrls: boolean,
  includeConfidenceScores: boolean,
  properties?: { name: string; orderIndex?: number }[]
): any[][] {
  const result = createAllProductsWorksheetWithStyles(
    searchResult,
    includeProductData,
    includeSourceUrls,
    includeConfidenceScores,
    properties
  );
  
  // Convert styled cells back to plain values
  return result.wsData.map(row => row.map(cell => cell.v !== undefined ? cell.v : cell));
}

function createProductWorksheet(
  product: ProductResult,
  searchMethod: string,
  includeProductData: boolean,
  includeSourceUrls: boolean,
  includeConfidenceScores: boolean
): any[][] {
  // Create worksheet data
  const wsData: any[] = [];
  
  // Create horizontal layout - property names as column headers
  const headers: string[] = [];
  const values: any[] = [];
  
  // Add basic product info columns if requested
  if (includeProductData) {
    headers.push("Article Number", "Product Name", "Search Method");
    values.push(product.articleNumber || '', product.productName || '', searchMethod);
  }
  
  // Add property columns (excluding confidence and sources as requested)
  Object.entries(product.properties).forEach(([propertyName, propertyData]) => {
    headers.push(propertyName);
    const value = (!propertyData.value || propertyData.value === 'Not found' || propertyData.value === 'Not Found') ? '' : propertyData.value;
    values.push(value);
  });
  
  // Add header row
  wsData.push(headers);
  
  // Add data row
  wsData.push(values);
  
  return wsData;
}

function createSummaryWorksheet(searchResult: SearchResponse): any[][] {
  // Create summary data showing all products in a table
  const summaryData: any[] = [];
  
  // Add headers
  summaryData.push(["#", "Article Number", "Product Name", "Properties Count", "Avg. Confidence"]);
  
  // Add product rows
  searchResult.products.forEach((product, index) => {
    const propertiesCount = Object.keys(product.properties).length;
    
    // Calculate average confidence
    let totalConfidence = 0;
    let confidentPropertiesCount = 0;
    
    Object.values(product.properties).forEach(prop => {
      if (prop.confidence > 0) {
        totalConfidence += prop.confidence;
        confidentPropertiesCount++;
      }
    });
    
    const avgConfidence = confidentPropertiesCount > 0 
      ? Math.round(totalConfidence / confidentPropertiesCount) 
      : 0;
    
    summaryData.push([
      index + 1,
      product.articleNumber,
      product.productName,
      propertiesCount,
      `${avgConfidence}%`
    ]);
  });
  
  return summaryData;
};

// Export property table data to Excel
export const exportPropertyTable = (
  tableName: string,
  properties: Array<{
    name: string;
    description?: string;
    expectedFormat?: string;
    isRequired?: boolean;
    orderIndex?: number;
  }>
) => {
  const wb = XLSX.utils.book_new();
  
  // Create worksheet data
  const wsData: any[][] = [];
  
  // Add headers
  wsData.push([
    'Order',
    'Property Name',
    'Description',
    'Expected Format',
    'Required'
  ]);
  
  // Sort properties by orderIndex
  const sortedProperties = [...properties].sort(
    (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)
  );
  
  // Add property rows
  sortedProperties.forEach((property, index) => {
    wsData.push([
      index + 1,
      property.name,
      property.description || '',
      property.expectedFormat || '',
      property.isRequired ? 'Yes' : 'No'
    ]);
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // Order
    { wch: 25 }, // Property Name
    { wch: 35 }, // Description
    { wch: 20 }, // Expected Format
    { wch: 10 }  // Required
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Properties');
  
  // Generate filename with table name and timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${tableName.replace(/[^a-z0-9]/gi, '_')}_properties_${timestamp}.xlsx`;
  
  // Write file
  XLSX.writeFile(wb, filename);
};
