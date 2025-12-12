import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, Download, FileText, ExternalLink, Copy, AlertCircle } from 'lucide-react';
import { ProductProperty, SearchResponse } from '@shared/schema';
import { toast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProcessingStatusItem {
  articleNumber: string;
  productName: string;
  url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: SearchResponse;
  error?: string;
  pdfContent?: string;
  webContent?: string;
}

interface PdfBatchResultsTableProps {
  processingStatus: ProcessingStatusItem[];
  properties: ProductProperty[];
  onSearchResult: (result: SearchResponse) => void;
  onDeleteResult: (index: number) => void;
  onExportAll?: () => void;
}

export const PdfBatchResultsTable: React.FC<PdfBatchResultsTableProps> = ({
  processingStatus,
  properties,
  onSearchResult,
  onDeleteResult,
  onExportAll
}) => {
  if (!processingStatus || processingStatus.length === 0) return null;

  // Create clean column list based on Eigenschaften properties only
  const orderedPropertyKeys: string[] = [];
  
  // Add standard columns first (only the essential ones)
  orderedPropertyKeys.push("Status", "Fortschritt", "Artikelnummer", "Produktname", "Quelle", "Inhalte");
  
  // Add properties in the order they appear in the properties array
  properties.forEach(prop => {
    // Skip duplicates and system properties
    if (!orderedPropertyKeys.includes(prop.name) && 
        prop.name !== "Artikelnummer" && 
        prop.name !== "Produktname" && 
        prop.name !== "Status" &&
        prop.name !== "Fortschritt" &&
        prop.name !== "Quelle" &&
        prop.name !== "Inhalte" &&
        prop.name !== "Artikel Nr." &&
        prop.name !== "Produkt Name" &&
        prop.name !== "id" &&
        prop.name !== "productName" &&
        !prop.name.startsWith('__')) {
      orderedPropertyKeys.push(prop.name);
    }
  });
  
  // Track which products have data to show proper property columns
  let hasCompletedProducts = false;
  
  // Check if we have completed products for display
  processingStatus.forEach(item => {
    if (item.status === 'completed' && item.result?.products?.[0]) {
      hasCompletedProducts = true;
    }
  });
  
  // Use the clean ordered property keys
  const propertyKeys = orderedPropertyKeys;
  
  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">PDF Batch-Extraktionsergebnisse</h3>
          {hasCompletedProducts && onExportAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportAll}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Alle Ergebnisse exportieren
            </Button>
          )}
        </div>
        
        {/* Color Legend */}
        <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <div className="font-medium text-gray-700">Bestätigte Quellen:</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>1 Quelle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-lime-500 rounded-full"></div>
              <span>2 Quellen</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>3 oder mehr Quellen</span>
            </div>
            <span className="text-gray-400">|</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
              <span>Nicht gefunden</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-blue-100">
              <tr>
                <th className="p-2 text-left whitespace-nowrap sticky left-0 bg-blue-100 z-10 border border-blue-200">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 mr-2" 
                  />
                  Alle auswählen
                </th>
                {propertyKeys.map(key => (
                  <th key={key} className="p-2 text-left whitespace-nowrap border border-blue-200 font-medium">
                    {key}
                  </th>
                ))}
                <th className="p-2 text-left whitespace-nowrap border border-blue-200">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {processingStatus.map((item, index) => {
                const product = item.result?.products?.[0];
                const productProperties = product?.properties || {};
                
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                    <td className="p-2 whitespace-nowrap sticky left-0 bg-inherit z-10 border border-gray-200">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300" 
                      />
                    </td>
                    {propertyKeys.map(key => {
                      if (key === 'Status') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200">
                            <div className="flex items-center gap-2">
                              {item.status === 'pending' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                  Ausstehend
                                </span>
                              )}
                              {item.status === 'processing' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  Verarbeitung...
                                </span>
                              )}
                              {item.status === 'completed' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                  ✓ Abgeschlossen
                                </span>
                              )}
                              {item.status === 'failed' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                  ✗ Fehlgeschlagen
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      } else if (key === 'Fortschritt') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200">
                            {item.status === 'failed' && item.error ? (
                              <span className="text-red-600 text-xs">{item.error}</span>
                            ) : (
                              <div className="w-24">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      item.status === 'completed' ? 'bg-green-600' :
                                      item.status === 'failed' ? 'bg-red-600' :
                                      'bg-blue-600'
                                    }`}
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 mt-1">{item.progress}%</span>
                              </div>
                            )}
                          </td>
                        );
                      } else if (key === 'Quelle') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200">
                            {item.url ? (
                              <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                                title={item.url}
                              >
                                <ExternalLink className="h-3 w-3" />
                                {item.url.length > 30 ? `${item.url.substring(0, 30)}...` : item.url}
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">Keine URL</span>
                            )}
                          </td>
                        );
                      } else if (key === 'Inhalte') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200">
                            {(item.pdfContent || item.webContent) && (
                              <div className="flex gap-1">
                                {item.pdfContent && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(item.pdfContent || '');
                                      toast({
                                        title: "PDF-Inhalt kopiert",
                                        description: `PDF-Inhalt für ${item.productName} wurde in die Zwischenablage kopiert`,
                                      });
                                    }}
                                    className="text-xs h-6 px-2"
                                    title="PDF-Inhalt kopieren"
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    PDF ({Math.round((item.pdfContent?.length || 0) / 1000)}k)
                                  </Button>
                                )}
                                {item.webContent && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(item.webContent || '');
                                      toast({
                                        title: "Web-Inhalt kopiert",
                                        description: `Web-Inhalt für ${item.productName} wurde in die Zwischenablage kopiert`,
                                      });
                                    }}
                                    className="text-xs h-6 px-2"
                                    title="Web-Inhalt kopieren"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Web ({Math.round((item.webContent?.length || 0) / 1000)}k)
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      } else if (key === 'Artikelnummer') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200 font-medium">
                            {item.articleNumber || '-'}
                          </td>
                        );
                      } else if (key === 'Produktname') {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200 font-medium">
                            {item.productName}
                          </td>
                        );
                      } else if (product && productProperties[key]) {
                        const propData = productProperties[key];
                        const hasValue = propData.value && propData.value !== 'Nicht gefunden' && propData.value !== 'Not found' && propData.value !== 'Not Found' && propData.value.trim() !== '';
                        const sourceCount = propData.consistencyCount || propData.sources?.length || 0;
                        
                        let bgColor = '';
                        let borderColor = 'border-gray-200';
                        let dotColor = 'bg-gray-300';
                        let consistencyInfo = '';
                        
                        if (hasValue) {
                          if (sourceCount === 1) {
                            bgColor = 'bg-yellow-50';
                            borderColor = 'border-yellow-200';
                            dotColor = 'bg-yellow-500';
                            consistencyInfo = `1 bestätigte Quelle`;
                          } else if (sourceCount === 2) {
                            bgColor = 'bg-lime-50';
                            borderColor = 'border-lime-200';
                            dotColor = 'bg-lime-500';
                            consistencyInfo = `2 bestätigte Quellen`;
                          } else if (sourceCount >= 3) {
                            bgColor = 'bg-green-50';
                            borderColor = 'border-green-200';
                            dotColor = 'bg-green-500';
                            consistencyInfo = `${sourceCount} bestätigte Quellen`;
                          }
                        }
                        
                        const getConfidenceColor = (confidence: number) => {
                          if (confidence >= 85) return "bg-green-500";
                          if (confidence >= 70) return "bg-yellow-500";
                          if (confidence >= 30) return "bg-orange-500";
                          return "bg-red-300";
                        };
                        
                        return (
                          <td key={key} className={`p-2 whitespace-nowrap border ${borderColor} ${bgColor}`}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0 shadow-sm`}></div>
                                    <span className={!hasValue ? 'text-gray-400 italic' : ''}>
                                      {propData.value || '-'}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm p-4 bg-white border border-gray-200 shadow-xl rounded-lg">
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Eigenschaft</div>
                                      <p className="text-sm text-gray-800 font-medium">{key}</p>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Wert</div>
                                      <p className="text-sm text-gray-800 font-medium">
                                        {hasValue ? propData.value : 'Keine Daten gefunden'}
                                      </p>
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 mb-1">Bestätigte Quellen</div>
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const count = propData.consistencyCount || propData.sources?.length || 0;
                                          let color = '';
                                          
                                          if (count === 0) {
                                            color = 'bg-gray-400';
                                          } else if (count === 1) {
                                            color = 'bg-yellow-500';
                                          } else if (count === 2) {
                                            color = 'bg-lime-500';
                                          } else {
                                            color = 'bg-green-500';
                                          }
                                          
                                          return (
                                            <>
                                              <div className={`w-2 h-2 rounded-full ${color}`}></div>
                                              <span className="text-sm font-medium text-gray-700">
                                                {count} {count === 1 ? 'Quelle' : 'Quellen'}
                                              </span>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    {propData.sources && propData.sources.length > 0 && (
                                      <div>
                                        <div className="text-xs font-medium text-gray-500 mb-2">Quellen ({propData.sources.length})</div>
                                        <div className="space-y-1">
                                          {propData.sources.map((source: any, idx: number) => (
                                            <a
                                              key={idx}
                                              href={source.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-start gap-2 hover:bg-blue-50 p-1 rounded transition-colors group"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 group-hover:bg-blue-700"></div>
                                              <div className="min-w-0 flex-1">
                                                <div className="text-xs text-gray-700 font-medium truncate group-hover:text-blue-600">
                                                  {source.sourceLabel || source.title || `Quelle ${idx + 1}`}
                                                </div>
                                                {source.url && source.url !== 'Unknown URL' && (
                                                  <div className="text-xs text-gray-500 truncate group-hover:text-blue-500 group-hover:underline">
                                                    {source.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                                  </div>
                                                )}
                                              </div>
                                              <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {consistencyInfo && (
                                      <div>
                                        <div className="text-xs font-medium text-gray-500 mb-1">Datenqualität</div>
                                        <div className="text-xs text-gray-600">{consistencyInfo}</div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      } else {
                        return (
                          <td key={key} className="p-2 whitespace-nowrap border border-gray-200 text-gray-400">
                            -
                          </td>
                        );
                      }
                    })}
                    <td className="p-2 whitespace-nowrap border border-gray-200">
                      <div className="flex space-x-2">
                        {item.result && (
                          <>
                            <Button 
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                onSearchResult(item.result!);
                                toast({
                                  title: "Ergebnis geladen",
                                  description: `Details für ${item.productName} werden angezeigt`,
                                });
                              }}
                            >
                              Bearbeiten
                            </Button>
                            <Button 
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm(`Verarbeitungsergebnis für ${item.productName} löschen?`)) {
                                  onDeleteResult(index);
                                  toast({
                                    title: "Ergebnis gelöscht",
                                    description: `Ergebnis für ${item.productName} wurde entfernt`,
                                  });
                                }
                              }}
                            >
                              Löschen
                            </Button>
                          </>
                        )}
                        {item.error && (
                          <span className="text-xs text-red-600">{item.error}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Summary statistics */}
        <div className="mt-4 flex gap-4 text-sm text-gray-600">
          <span>Gesamt: {processingStatus.length}</span>
          <span>Abgeschlossen: {processingStatus.filter(s => s.status === 'completed').length}</span>
          <span>Fehlgeschlagen: {processingStatus.filter(s => s.status === 'failed').length}</span>
          <span>In Bearbeitung: {processingStatus.filter(s => s.status === 'processing' || s.status === 'pending').length}</span>
        </div>
      </CardContent>
    </Card>
  );
};