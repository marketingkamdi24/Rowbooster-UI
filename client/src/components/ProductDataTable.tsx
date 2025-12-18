import React, { useState } from 'react';
import { Loader2, Trash2, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { ProductProperty } from '@shared/schema';

interface ProcessingStatusItem {
  productName: string;
  articleNumber: string;
  status: 'pending' | 'searching' | 'browser-rendering' | 'extracting' | 'completed' | 'failed';
  progress: number;
  result?: any;
}

interface ProductDataTableProps {
  processingStatus: ProcessingStatusItem[];
  properties: ProductProperty[];
  onDeleteItem: (index: number) => void;
}

export function ProductDataTable({ processingStatus, properties, onDeleteItem }: ProductDataTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Build ordered property keys
  const orderedPropertyKeys: string[] = ["Status", "Artikelnummer", "Produktname"];
  properties.forEach(prop => {
    if (!orderedPropertyKeys.includes(prop.name) && 
        prop.name !== "Artikelnummer" && 
        prop.name !== "Produktname" && 
        prop.name !== "Status" &&
        prop.name !== "Artikel Nr." &&
        prop.name !== "Produkt Name" &&
        prop.name !== "id" &&
        prop.name !== "productName" &&
        !prop.name.startsWith('__')) {
      orderedPropertyKeys.push(prop.name);
    }
  });

  const mainFields = orderedPropertyKeys.slice(0, 9); // First 9 fields for card view
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
    if (!propData?.value || propData.value === 'Nicht gefunden' || propData.value === 'Not found' || propData.value.trim() === '') {
      return 'gray';
    }
    const sourceCount = propData.consistencyCount || propData.sources?.length || 0;
    if (sourceCount >= 3) return 'green';
    if (sourceCount === 2) return 'lime';
    if (sourceCount === 1) return 'yellow';
    return 'gray';
  };

  const getCellValue = (item: ProcessingStatusItem, key: string) => {
    if (key === 'Status') return { type: 'status', value: item.status };
    if (key === 'Artikelnummer') return { type: 'article', value: item.articleNumber || '—' };
    if (key === 'Produktname') return { type: 'product', value: item.productName };
    
    const product = item.result?.products?.[0];
    const propData = product?.properties?.[key];
    if (!propData) return { type: 'empty', value: '—' };
    
    return {
      type: 'data',
      value: propData.value || '—',
      color: getIndicatorColor(propData),
      sources: propData.sources,
      consistencyCount: propData.consistencyCount
    };
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent" style={{ maxHeight: '70vh' }}>
          <table className="w-full border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: 'linear-gradient(90deg, rgba(23,195,206,0.08), rgba(200,250,100,0.05))' }}>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.08] whitespace-nowrap sticky left-0 z-25" style={{ background: 'linear-gradient(90deg, #0E1621, rgba(23,195,206,0.1))' }}>
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" className="w-4 h-4 rounded accent-[#17c3ce] cursor-pointer" style={{ accentColor: '#17c3ce' }} />
                    <span>#</span>
                  </div>
                </th>
                {orderedPropertyKeys.map(key => (
                  <th key={key} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.08] whitespace-nowrap">
                    {key}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.08] whitespace-nowrap">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {processingStatus.map((item, index) => (
                <tr 
                  key={index} 
                  className="transition-colors duration-150 hover:bg-[rgba(23,195,206,0.04)] group"
                  style={{ background: index % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}
                >
                  <td className="px-4 py-2.5 text-[13px] border-b border-white/[0.03] whitespace-nowrap sticky left-0 z-10 border-r border-white/[0.06] group-hover:bg-[rgba(14,22,33,0.98)]" style={{ background: '#0E1621' }}>
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: '#17c3ce' }} />
                      <span className="text-[11px] font-semibold text-white/50 min-w-[24px]">{index + 1}</span>
                    </div>
                  </td>
                  {orderedPropertyKeys.map(key => {
                    const cellData = getCellValue(item, key);
                    
                    if (cellData.type === 'status') {
                      return (
                        <td key={key} className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap">
                          {item.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/10 text-white/60">
                              <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                              Wartend
                            </span>
                          )}
                          {item.status === 'searching' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#17c3ce]/20 text-[#17c3ce]">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Suche
                            </span>
                          )}
                          {item.status === 'browser-rendering' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/20 text-purple-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              JS
                            </span>
                          )}
                          {item.status === 'extracting' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              KI
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#10b981]/15 text-[#10b981]">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              OK
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/20 text-red-400">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Fehler
                            </span>
                          )}
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'article') {
                      return (
                        <td key={key} className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap">
                          <span className="font-mono text-[11px] px-2 py-1 bg-white/[0.04] rounded text-white/50">
                            {cellData.value}
                          </span>
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'product') {
                      return (
                        <td key={key} className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap">
                          <span className="font-semibold text-white text-[13px]" title={cellData.value}>
                            {cellData.value}
                          </span>
                        </td>
                      );
                    }
                    
                    if (cellData.type === 'empty') {
                      return (
                        <td key={key} className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#6b7280]"></div>
                            <span className="text-white/40 italic text-[13px]">—</span>
                          </div>
                        </td>
                      );
                    }
                    
                    // Data cell with indicator
                    const colorMap: Record<string, { bg: string; dot: string }> = {
                      green: { bg: 'rgba(16,185,129,0.06)', dot: '#10b981' },
                      lime: { bg: 'rgba(200,250,100,0.06)', dot: '#c8fa64' },
                      yellow: { bg: 'rgba(245,158,11,0.06)', dot: '#f59e0b' },
                      gray: { bg: 'transparent', dot: '#6b7280' }
                    };
                    const colors = colorMap[cellData.color || 'gray'];
                    
                    return (
                      <td key={key} className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap" style={{ background: colors.bg }}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.dot }}></div>
                                <span className={`text-[13px] ${cellData.value === '—' ? 'text-white/40 italic' : 'text-white/90'}`} title={cellData.value}>
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
                  <td className="px-4 py-2.5 border-b border-white/[0.03] whitespace-nowrap">
                    <div className="flex justify-end">
                      <button
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                        title="Löschen"
                        onClick={() => {
                          if (confirm(`Ergebnis für ${item.productName} löschen?`)) {
                            onDeleteItem(index);
                            toast({ title: "Gelöscht", description: `${item.productName} entfernt` });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3 p-3">
        {processingStatus.map((item, index) => {
          const isExpanded = expandedCards.has(index);
          
          return (
            <div 
              key={index} 
              className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ 
                background: 'rgba(255,255,255,0.02)',
                animation: `fadeIn 0.3s ease ${index * 0.05}s backwards`
              }}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between p-4 border-b border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white mb-1 leading-tight">{item.productName}</div>
                  <span className="text-[11px] font-mono text-white/50 bg-white/[0.04] px-1.5 py-0.5 rounded inline-block">
                    {item.articleNumber || '—'}
                  </span>
                </div>
                {item.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#10b981]/15 text-[#10b981]">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    OK
                  </span>
                )}
                {item.status === 'searching' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#17c3ce]/20 text-[#17c3ce]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                )}
                {item.status === 'extracting' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                )}
              </div>

              {/* Card Body - Main Fields */}
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {mainFields.filter(k => k !== 'Status' && k !== 'Artikelnummer' && k !== 'Produktname').slice(0, 6).map(key => {
                    const cellData = getCellValue(item, key);
                    const colorMap: Record<string, string> = {
                      green: '#10b981', lime: '#c8fa64', yellow: '#f59e0b', gray: '#6b7280'
                    };
                    const dotColor = colorMap[cellData.color || 'gray'];
                    
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
                      const cellData = getCellValue(item, key);
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
    </>
  );
}
