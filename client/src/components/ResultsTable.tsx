import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Trash2, ChevronDown, FileDown, ExternalLink, Filter, ArrowUpDown, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { ProductProperty, SearchResponse, ProductResult } from '@shared/schema';

interface ResultsTableProps {
  searchResult: SearchResponse | null;
  allSearchResults?: SearchResponse[];
  properties: ProductProperty[];
  onExport?: () => void;
  onDeleteProduct?: (index: number) => void;
  isPdfMode?: boolean;
}

export function ResultsTable({ 
  searchResult, 
  allSearchResults = [],
  properties, 
  onExport,
  onDeleteProduct,
  isPdfMode = false
}: ResultsTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle horizontal scroll with mouse wheel
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle if there's horizontal overflow
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Get all products to display
  const products = isPdfMode && allSearchResults.length > 0
    ? allSearchResults.flatMap(r => r.products || [])
    : searchResult?.products || [];

  if (!products || products.length === 0) {
    return null;
  }

  // Build ordered property keys
  const orderedPropertyKeys: string[] = ["Status", "Artikelnummer", "Produktname"];
  properties.forEach(prop => {
    if (!orderedPropertyKeys.includes(prop.name) && 
        prop.name !== "Artikelnummer" && 
        prop.name !== "Produktname" && 
        prop.name !== "Status" &&
        prop.name !== "ArtikelName" &&
        prop.name !== "Artikel Nr." &&
        prop.name !== "Produkt Name" &&
        prop.name !== "id" &&
        prop.name !== "productName" &&
        !prop.name.startsWith('__')) {
      orderedPropertyKeys.push(prop.name);
    }
  });

  const mainFields = orderedPropertyKeys.slice(0, 9);
  const detailFields = orderedPropertyKeys.slice(9);

  const toggleCardExpand = (index: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getIndicatorColor = (propData: any): string => {
    if (!propData?.value || propData.value === 'Nicht gefunden' || propData.value === 'Not found' || propData.value === 'Not Found' || propData.value.trim?.() === '') {
      return 'gray';
    }
    const sourceCount = propData.consistencyCount || propData.sources?.length || 0;
    if (sourceCount >= 3) return 'green';
    if (sourceCount === 2) return 'lime';
    if (sourceCount === 1) return 'yellow';
    return 'gray';
  };

  const getCellValue = (product: ProductResult, key: string, searchStatus?: string) => {
    if (key === 'Status') {
      return { type: 'status', value: searchStatus || 'complete' };
    }
    if (key === 'Artikelnummer') {
      return { type: 'article', value: product.articleNumber || '—' };
    }
    if (key === 'Produktname') {
      return { type: 'product', value: product.productName || '—' };
    }
    
    const propData = product.properties?.[key];
    if (!propData || !propData.value || propData.value === 'Nicht gefunden' || propData.value === 'Not found') {
      return { type: 'empty', value: '—' };
    }
    
    return {
      type: 'data',
      value: propData.value,
      color: getIndicatorColor(propData),
      sources: propData.sources,
      consistencyCount: propData.consistencyCount
    };
  };

  // Calculate stats
  const stats = {
    complete: 0,
    partial: 0,
    aiGenerated: 0,
    missing: 0
  };

  products.forEach(product => {
    orderedPropertyKeys.forEach(key => {
      if (key === 'Status' || key === 'Artikelnummer' || key === 'Produktname') return;
      const propData = product.properties?.[key];
      if (!propData?.value || propData.value === 'Nicht gefunden' || propData.value === 'Not found') {
        stats.missing++;
      } else {
        const sourceCount = propData.consistencyCount || propData.sources?.length || 0;
        if (sourceCount >= 3) stats.complete++;
        else if (sourceCount === 2) stats.partial++;
        else stats.aiGenerated++;
      }
    });
  });

  const colorMap: Record<string, { bg: string; dot: string }> = {
    green: { bg: 'rgba(16,185,129,0.06)', dot: '#10b981' },
    lime: { bg: 'rgba(200,250,100,0.06)', dot: '#c8fa64' },
    yellow: { bg: 'rgba(245,158,11,0.06)', dot: '#f59e0b' },
    gray: { bg: 'transparent', dot: '#6b7280' }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap justify-between items-center gap-3" style={{ background: 'linear-gradient(90deg, rgba(23,195,206,0.08), rgba(200,250,100,0.05))' }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 bg-gradient-to-b from-[#c8fa64] to-[#17c3ce] rounded-full"></div>
          <div>
            <h3 className="text-sm font-semibold text-white">Produkt Datenbank</h3>
            <p className="text-[10px] text-white/50">Extrahierte Produktdaten</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <button
            onClick={() => {
              toast({
                title: "KI-Filter",
                description: "KI-gestützte Filterung wird bald verfügbar sein",
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/[0.1] hover:border-[#17c3ce]/50 hover:bg-white/[0.04]"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'white' }}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
          
          {/* Sort Button */}
          <button
            onClick={() => {
              toast({
                title: "KI-Sortierung",
                description: "KI-gestützte Sortierung wird bald verfügbar sein",
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/[0.1] hover:border-[#17c3ce]/50 hover:bg-white/[0.04]"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'white' }}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sortieren</span>
          </button>
          
          {/* Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ background: '#c8fa64', color: '#0c2443' }}
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex flex-wrap gap-4 text-[11px]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }}></div>
          <span className="text-white/50">Vollständig:</span>
          <span className="font-bold text-white">{stats.complete}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }}></div>
          <span className="text-white/50">Teilweise:</span>
          <span className="font-bold text-white">{stats.partial}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#c8fa64' }}></div>
          <span className="text-white/50">KI-generiert:</span>
          <span className="font-bold text-white">{stats.aiGenerated}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#6b7280' }}></div>
          <span className="text-white/50">Fehlend:</span>
          <span className="font-bold text-white">{stats.missing}</span>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: 'linear-gradient(90deg, rgba(23,195,206,0.08), rgba(200,250,100,0.05))' }}>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.08] whitespace-nowrap sticky left-0 z-25" style={{ background: 'linear-gradient(90deg, #0E1621, rgba(23,195,206,0.1))' }}>
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: '#17c3ce' }} />
                    <span>#</span>
                  </div>
                </th>
                {orderedPropertyKeys.map(key => (
                  <th key={key} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.08] whitespace-nowrap">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr 
                  key={product.id || index} 
                  className="transition-colors duration-150 hover:bg-[rgba(23,195,206,0.04)] group"
                  style={{ background: index % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                >
                  <td className="px-4 py-5 text-[13px] border-b border-white/[0.03] whitespace-nowrap sticky left-0 z-10 border-r border-white/[0.06] group-hover:bg-[rgba(14,22,33,0.98)]" style={{ background: '#0E1621' }}>
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: '#17c3ce' }} />
                      <span className="text-[11px] font-semibold text-white/50 min-w-[24px]">{index + 1}</span>
                    </div>
                  </td>
                  {orderedPropertyKeys.map(key => {
                    const cellData = getCellValue(product, key, searchResult?.searchStatus);
                    
                    if (cellData.type === 'status') {
                      const status = searchResult?.searchStatus;
                      return (
                        <td key={key} className="px-4 py-5 border-b border-white/[0.03] whitespace-nowrap">
                          {status === 'searching' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#17c3ce]/20 text-[#17c3ce]">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Suche
                            </span>
                          )}
                          {status === 'analyzing' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              KI
                            </span>
                          )}
                          {(status === 'complete' || !status) && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#10b981]/15 text-[#10b981]">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              OK
                            </span>
                          )}
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'article') {
                      return (
                        <td key={key} className="px-4 py-5 border-b border-white/[0.03] whitespace-nowrap">
                          <span className="font-mono text-[11px] px-2 py-1 bg-white/[0.04] rounded text-white/50">
                            {cellData.value}
                          </span>
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'product') {
                      return (
                        <td key={key} className="px-4 py-5 border-b border-white/[0.03] whitespace-nowrap">
                          <span className="font-semibold text-white text-[13px]" title={cellData.value}>
                            {cellData.value}
                          </span>
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'empty') {
                      return (
                        <td key={key} className="px-4 py-5 border-b border-white/[0.03] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#6b7280]"></div>
                            <span className="text-white/40 italic text-[13px]">—</span>
                          </div>
                        </td>
                      );
                    }
                    
                    const colors = colorMap[cellData.color || 'gray'];
                    
                    return (
                      <td key={key} className="px-4 py-5 border-b border-white/[0.03] whitespace-nowrap" style={{ background: colors.bg, minHeight: '56px' }}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.dot }}></div>
                                <span className="text-[13px] text-white/90" title={cellData.value}>
                                  {cellData.value}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4 bg-[#1a2332] border border-white/10 shadow-xl rounded-lg">
                              <div className="space-y-3">
                                <div>
                                  <div className="text-[10px] font-medium text-white/50 mb-1">Eigenschaft</div>
                                  <p className="text-sm text-white font-medium">{key}</p>
                                </div>
                                <div>
                                  <div className="text-[10px] font-medium text-white/50 mb-1">Wert</div>
                                  <p className="text-sm text-white">{cellData.value}</p>
                                </div>
                                <div>
                                  <div className="text-[10px] font-medium text-white/50 mb-1">Quellen</div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: colors.dot }}></div>
                                    <span className="text-sm text-white">{cellData.consistencyCount || cellData.sources?.length || 0} Quellen</span>
                                  </div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3 p-3">
        {products.map((product, index) => {
          const isExpanded = expandedCards.has(index);
          
          return (
            <div 
              key={product.id || index} 
              className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ 
                background: 'rgba(255,255,255,0.02)',
                animation: `fadeIn 0.3s ease ${index * 0.05}s backwards`
              }}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between p-4 border-b border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-1 leading-tight">{product.productName}</div>
                  <span className="text-[11px] font-mono text-white/50 bg-white/[0.04] px-1.5 py-0.5 rounded inline-block">
                    {product.articleNumber || '—'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#10b981]/15 text-[#10b981]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  OK
                </span>
              </div>

              {/* Card Body - Main Fields */}
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {mainFields.filter(k => k !== 'Status' && k !== 'Artikelnummer' && k !== 'Produktname').slice(0, 6).map(key => {
                    const cellData = getCellValue(product, key);
                    const dotColor = colorMap[cellData.color || 'gray'].dot;
                    
                    return (
                      <div key={key} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">{key}</div>
                        <div className="text-[13px] font-medium text-white flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }}></div>
                          <span className="truncate">{cellData.value || '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-white/[0.04]">
                  <div className="grid grid-cols-2 gap-1.5 pt-3">
                    {detailFields.map(key => {
                      const cellData = getCellValue(product, key);
                      return (
                        <div key={key} className="p-2 rounded-md text-[11px]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="text-white/40">{key}</div>
                          <div className="text-white font-medium mt-0.5 truncate">{cellData.value || '—'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expand Button - Always at bottom */}
              {detailFields.length > 0 && (
                <button
                  className="w-full py-2.5 border-t border-white/[0.04] text-[#17c3ce] text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleCardExpand(index)}
                >
                  <span>{isExpanded ? 'Weniger anzeigen' : 'Alle Details'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
