import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Globe, Package, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

interface ExtractedProperty {
  name?: string;
  propertyName?: string;
  value: string;
  confidence: number;
  isConsistent?: boolean;
  source?: string;
  sources?: { url: string; title: string }[];
}

interface ScrapedDataSummary {
  totalSources?: number;
  successfulSources?: number;
  failedSources?: number;
  totalContentLength?: number;
  webContentLength?: number;
  pdfContentLength?: number;
}

interface ActivityLog {
  id: number;
  user_id: number;
  username: string;
  activity_type: string;
  action: string;
  endpoint?: string;
  method?: string;
  request_data?: {
    searchTab?: string;
    searchMode?: string;
    articleNumber?: string;
    productName?: string;
    sourceUrls?: string[];
    tableId?: number;
    tableName?: string;
    totalProducts?: number;
    webUrl?: string;
    pdfFilesCount?: number;
    pdfFilesInfo?: string[];
    products?: Array<{
      articleNumber?: string;
      productName: string;
      status?: string;
    }>;
  };
  response_data?: {
    scrapedDataSummary?: ScrapedDataSummary;
    extractedPropertiesCount?: number;
    extractedProperties?: ExtractedProperty[];
    successCount?: number;
    failedCount?: number;
    products?: Array<{
      articleNumber?: string;
      productName: string;
      status?: string;
      extractedPropertiesCount?: number;
      processingTime?: number;
      errorMessage?: string;
    }>;
  };
  duration?: number;
  status_code?: number;
  success?: boolean;
  error_message?: string;
  timestamp: string;
}

interface ExpandableActivityCardProps {
  log: ActivityLog;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function ExpandableActivityCard({ log, isExpanded: controlledExpanded, onToggle }: ExpandableActivityCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Determine if this is a detailed search activity
  const isSearchActivity = log.activity_type?.includes('search') || 
                           log.activity_type?.includes('extraction') ||
                           log.activity_type?.includes('batch');
  
  // Parse activity type for display
  const getActivityTypeLabel = (activityType: string) => {
    if (activityType.includes('search:automatisch:manual')) return 'Automatisch - Einzeln';
    if (activityType.includes('batch_search:automatisch:datei')) return 'Automatisch - Datei Upload';
    if (activityType.includes('custom_search:manuelle_quellen:url_only')) return 'Manuelle Quellen - URL';
    if (activityType.includes('custom_search:manuelle_quellen:url_pdf')) return 'Manuelle Quellen - URL+PDF';
    if (activityType.includes('extraction')) return 'Datenextraktion';
    return activityType.replace(/_/g, ' ').replace(/:/g, ' - ');
  };

  // Get badge color based on activity type
  const getBadgeClass = (activityType: string) => {
    if (activityType.includes('error')) return 'badge-critical';
    if (activityType.includes('batch')) return 'badge-high';
    if (activityType.includes('custom_search') || activityType.includes('manuelle')) return 'badge-info';
    if (activityType.includes('search')) return 'badge-normal';
    return 'badge-normal';
  };

  const requestData = log.request_data || {};
  const responseData = log.response_data || {};

  return (
    <div className={`bg-black/40 rounded border ${
      log.success === false ? 'border-red-500/30' : 'border-yellow-500/10'
    } overflow-hidden transition-all duration-200`}>
      {/* Header - Always visible */}
      <div 
        className={`p-3 sm:p-4 cursor-pointer hover:bg-yellow-500/5 transition-colors ${
          isSearchActivity ? 'pr-10 relative' : ''
        }`}
        onClick={isSearchActivity ? handleToggle : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${getBadgeClass(log.activity_type)} px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold`}>
                {getActivityTypeLabel(log.activity_type)}
              </span>
              {log.success === false && (
                <span className="badge-critical px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  FEHLER
                </span>
              )}
              {log.duration && (
                <span className="text-cyan-400 text-[10px] flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {log.duration}ms
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-cyan-400 line-clamp-2">{log.action}</p>
            {requestData.productName && (
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <Package className="h-3 w-3" />
                <span className="truncate">
                  {requestData.articleNumber && <span className="text-yellow-400">{requestData.articleNumber}</span>}
                  {requestData.articleNumber && ' - '}
                  {requestData.productName}
                </span>
              </div>
            )}
            {requestData.totalProducts && (
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <Zap className="h-3 w-3" />
                <span>
                  {requestData.totalProducts} Produkte
                  {responseData.successCount !== undefined && (
                    <span className="ml-2">
                      <span className="text-green-400">{responseData.successCount} ✓</span>
                      {responseData.failedCount !== undefined && responseData.failedCount > 0 && (
                        <span className="text-red-400 ml-1">{responseData.failedCount} ✗</span>
                      )}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] sm:text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleDateString('de-DE')}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleTimeString('de-DE')}
            </div>
          </div>
        </div>
        
        {/* Expand/Collapse indicator */}
        {isSearchActivity && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-yellow-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </div>
        )}
      </div>

      {/* Expandable Details Section */}
      {isSearchActivity && isExpanded && (
        <div className="border-t border-yellow-500/20 p-3 sm:p-4 space-y-4 bg-black/20">
          {/* Product Information */}
          {(requestData.articleNumber || requestData.productName) && (
            <div>
              <h4 className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                PRODUKTINFORMATION
              </h4>
              <div className="bg-black/30 rounded p-3 space-y-2">
                {requestData.articleNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Artikelnr.:</span>
                    <span className="text-cyan-400 font-mono">{requestData.articleNumber}</span>
                  </div>
                )}
                {requestData.productName && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Produktname:</span>
                    <span className="text-cyan-400">{requestData.productName}</span>
                  </div>
                )}
                {requestData.tableName && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-28 flex-shrink-0">Tabelle:</span>
                    <span className="text-cyan-400">{requestData.tableName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source URLs */}
          {(requestData.sourceUrls?.length || requestData.webUrl || requestData.pdfFilesInfo?.length) && (
            <div>
              <h4 className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                QUELLEN
              </h4>
              <div className="bg-black/30 rounded p-3 space-y-2 max-h-40 overflow-y-auto">
                {requestData.webUrl && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <a 
                      href={requestData.webUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 truncate flex items-center gap-1"
                    >
                      {requestData.webUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {requestData.pdfFilesInfo?.map((pdf, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-red-400 flex-shrink-0" />
                    <span className="text-gray-300 truncate">{pdf}</span>
                  </div>
                ))}
                {requestData.sourceUrls?.slice(0, 10).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 truncate flex items-center gap-1"
                    >
                      {url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
                {requestData.sourceUrls && requestData.sourceUrls.length > 10 && (
                  <div className="text-xs text-gray-500">
                    ... und {requestData.sourceUrls.length - 10} weitere Quellen
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scraped Data Summary */}
          {responseData.scrapedDataSummary && (
            <div>
              <h4 className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                SCRAPING ZUSAMMENFASSUNG
              </h4>
              <div className="bg-black/30 rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {responseData.scrapedDataSummary.totalSources !== undefined && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-cyan-400">
                      {responseData.scrapedDataSummary.totalSources}
                    </div>
                    <div className="text-[10px] text-gray-500">Quellen</div>
                  </div>
                )}
                {responseData.scrapedDataSummary.successfulSources !== undefined && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">
                      {responseData.scrapedDataSummary.successfulSources}
                    </div>
                    <div className="text-[10px] text-gray-500">Erfolgreich</div>
                  </div>
                )}
                {responseData.scrapedDataSummary.failedSources !== undefined && responseData.scrapedDataSummary.failedSources > 0 && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-400">
                      {responseData.scrapedDataSummary.failedSources}
                    </div>
                    <div className="text-[10px] text-gray-500">Fehlgeschlagen</div>
                  </div>
                )}
                {(responseData.scrapedDataSummary.totalContentLength || 
                  responseData.scrapedDataSummary.webContentLength) && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-400">
                      {Math.round(
                        (responseData.scrapedDataSummary.totalContentLength || 
                         (responseData.scrapedDataSummary.webContentLength || 0) + 
                         (responseData.scrapedDataSummary.pdfContentLength || 0)) / 1024
                      )}KB
                    </div>
                    <div className="text-[10px] text-gray-500">Inhalt</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extracted Properties */}
          {responseData.extractedProperties && responseData.extractedProperties.length > 0 && (
            <div>
              <h4 className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                EXTRAHIERTE EIGENSCHAFTEN ({responseData.extractedPropertiesCount || responseData.extractedProperties.length})
              </h4>
              <div className="bg-black/30 rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2 border-b border-yellow-500/20 text-[10px] font-bold text-yellow-400">
                  <div className="col-span-4">Eigenschaft</div>
                  <div className="col-span-5">Wert</div>
                  <div className="col-span-2 text-center">Konfidenz</div>
                  <div className="col-span-1 text-center">Status</div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {responseData.extractedProperties.map((prop, idx) => (
                    <div 
                      key={idx} 
                      className="grid grid-cols-12 gap-2 p-2 text-xs border-b border-yellow-500/5 hover:bg-yellow-500/5"
                    >
                      <div className="col-span-4 text-cyan-400 font-medium truncate" title={prop.name || prop.propertyName}>
                        {prop.name || prop.propertyName}
                      </div>
                      <div className="col-span-5 text-gray-300 truncate" title={prop.value}>
                        {prop.value || '-'}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          prop.confidence >= 80 ? 'bg-green-900/30 text-green-400' :
                          prop.confidence >= 50 ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-red-900/30 text-red-400'
                        }`}>
                          {prop.confidence}%
                        </span>
                      </div>
                      <div className="col-span-1 text-center">
                        {prop.isConsistent ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-500 mx-auto" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Batch Products List */}
          {responseData.products && responseData.products.length > 0 && (
            <div>
              <h4 className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                VERARBEITETE PRODUKTE ({responseData.products.length})
              </h4>
              <div className="bg-black/30 rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2 border-b border-yellow-500/20 text-[10px] font-bold text-yellow-400">
                  <div className="col-span-3">Artikelnr.</div>
                  <div className="col-span-4">Produkt</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-2 text-center">Eigenschaften</div>
                  <div className="col-span-1 text-center">Zeit</div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {responseData.products.map((product, idx) => (
                    <div 
                      key={idx} 
                      className={`grid grid-cols-12 gap-2 p-2 text-xs border-b border-yellow-500/5 ${
                        product.status === 'failed' ? 'bg-red-900/10' : 'hover:bg-yellow-500/5'
                      }`}
                    >
                      <div className="col-span-3 text-cyan-400 font-mono truncate">
                        {product.articleNumber || '-'}
                      </div>
                      <div className="col-span-4 text-gray-300 truncate" title={product.productName}>
                        {product.productName}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          product.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                          product.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                          product.status === 'processing' ? 'bg-yellow-900/30 text-yellow-400' :
                          'bg-gray-900/30 text-gray-400'
                        }`}>
                          {product.status?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2 text-center text-gray-400">
                        {product.extractedPropertiesCount || 0}
                      </div>
                      <div className="col-span-1 text-center text-gray-400">
                        {product.processingTime ? `${Math.round(product.processingTime / 1000)}s` : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {log.error_message && (
            <div>
              <h4 className="text-red-400 text-xs font-bold mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                FEHLERMELDUNG
              </h4>
              <div className="bg-red-900/20 rounded p-3 text-xs text-red-300 font-mono">
                {log.error_message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExpandableActivityCard;