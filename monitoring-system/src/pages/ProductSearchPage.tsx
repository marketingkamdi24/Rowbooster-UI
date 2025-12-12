import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, RefreshCw, Download, ExternalLink, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import { authFetch } from '@/lib/api';

interface FlatSearchRow {
  searchId: number;
  timestamp: string;
  userId: number;
  username: string;
  productName: string;
  articleNumber: string;
  method: string;
  searchType: string;
  searchMode: string;
  urls: string;
  urlCount: number;
  totalTokens: number;
  totalCost: string;
  modelInfo: string;
  duration: number;
  success: boolean;
  errorMessage: string;
  propertiesExtracted: number;
}

export default function ProductSearchPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FlatSearchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleRowExpansion = (searchId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(searchId)) {
        next.delete(searchId);
      } else {
        next.add(searchId);
      }
      return next;
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());
      
      if (methodFilter) {
        params.append('search_tab', methodFilter);
      }
      if (startDate) {
        params.append('start_date', startDate);
      }
      if (endDate) {
        params.append('end_date', endDate);
      }

      const response = await authFetch(`/api/product-searches/flat?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRows(data.rows || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch product search data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, methodFilter, startDate, endDate]);

  // Filter rows client-side for search term
  const filteredRows = rows.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.productName?.toLowerCase().includes(term) ||
      row.username?.toLowerCase().includes(term) ||
      row.articleNumber?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '$0.0000' : `$${num.toFixed(4)}`;
  };

  const formatNumber = (value: number) => {
    return value?.toLocaleString() || '0';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Export to CSV/Excel function
  const exportToExcel = () => {
    // Create CSV content
    const headers = [
      'Zeitstempel',
      'Benutzer',
      'Produktname',
      'Artikelnummer',
      'Methode',
      'Suchtyp',
      'Suchmodus',
      'URLs',
      'URL-Anzahl',
      'Gesamt-Tokens',
      'Kosten ($)',
      'Modell',
      'Dauer (ms)',
      'Erfolg',
      'Eigenschaften extrahiert',
      'Fehler'
    ];

    const csvContent = [
      headers.join('\t'),
      ...filteredRows.map(row => [
        formatDate(row.timestamp),
        row.username,
        `"${row.productName.replace(/"/g, '""')}"`,
        row.articleNumber,
        row.method,
        row.searchType,
        row.searchMode,
        `"${row.urls.replace(/"/g, '""').replace(/\n/g, '; ')}"`,
        row.urlCount,
        row.totalTokens,
        row.totalCost,
        row.modelInfo,
        row.duration,
        row.success ? 'Ja' : 'Nein',
        row.propertiesExtracted,
        `"${(row.errorMessage || '').replace(/"/g, '""')}"`
      ].join('\t'))
    ].join('\n');

    // Create download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-searches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate totals
  const totalTokensSum = filteredRows.reduce((sum, row) => sum + (row.totalTokens || 0), 0);
  const totalCostSum = filteredRows.reduce((sum, row) => sum + parseFloat(row.totalCost || '0'), 0);
  const totalUrlsSum = filteredRows.reduce((sum, row) => sum + (row.urlCount || 0), 0);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">LADE DATEN...</div>
      </div>
    );
  }

  return (
    <>
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold neon-yellow tracking-wide">PRODUKTSUCHEN</h1>
          <p className="text-sm text-cyan-400/60 mt-1">Excel-Ansicht mit allen Suchdaten pro Zeile</p>
        </div>
        <Button
          onClick={exportToExcel}
          className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          ALS EXCEL EXPORTIEREN
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="stat-card-cyber p-3 sm:p-5 rounded glow-yellow">
          <div className="text-yellow-400 text-[10px] sm:text-sm font-bold tracking-wide">GESAMTSUCHEN</div>
          <div className="text-2xl sm:text-3xl font-bold neon-cyan">{formatNumber(total)}</div>
        </div>
        <div className="stat-card-cyber p-3 sm:p-5 rounded glow-cyan">
          <div className="text-yellow-400 text-[10px] sm:text-sm font-bold tracking-wide">GESAMT-TOKENS</div>
          <div className="text-2xl sm:text-3xl font-bold neon-cyan">{formatNumber(totalTokensSum)}</div>
        </div>
        <div className="stat-card-cyber p-3 sm:p-5 rounded glow-yellow">
          <div className="text-yellow-400 text-[10px] sm:text-sm font-bold tracking-wide">GESAMTKOSTEN</div>
          <div className="text-2xl sm:text-3xl font-bold neon-cyan">{formatCurrency(totalCostSum)}</div>
        </div>
        <div className="stat-card-cyber p-3 sm:p-5 rounded glow-cyan">
          <div className="text-yellow-400 text-[10px] sm:text-sm font-bold tracking-wide">GESAMT-URLs</div>
          <div className="text-2xl sm:text-3xl font-bold neon-cyan">{formatNumber(totalUrlsSum)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="cyber-panel p-4 rounded mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-yellow-400" />
            <Input
              type="text"
              placeholder="SUCHE NACH PRODUKT, BENUTZER ODER ARTIKEL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              className="bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-2 rounded text-sm"
            >
              <option value="">Alle Methoden</option>
              <option value="automatisch">Automatisch</option>
              <option value="manuelle_quellen">Manuelle Quellen</option>
            </select>

            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-black/50 border-yellow-500/30 text-cyan-400 w-auto"
            />

            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-black/50 border-yellow-500/30 text-cyan-400 w-auto"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              AKTUALISIEREN
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="cyber-panel p-4 sm:p-6 rounded">
        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-3">
          {filteredRows.map((row) => (
            <div key={row.searchId} className="bg-black/40 rounded p-4 border border-yellow-500/10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-cyan-400">{row.productName}</div>
                  {row.articleNumber && (
                    <div className="text-xs text-gray-500">Art.-Nr.: {row.articleNumber}</div>
                  )}
                </div>
                {row.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-yellow-400/60">Benutzer:</span>
                  <span className="text-cyan-400 ml-1">{row.username}</span>
                </div>
                <div>
                  <span className="text-yellow-400/60">Methode:</span>
                  <span className={`ml-1 ${row.method === 'Automatisch' ? 'text-blue-400' : 'text-purple-400'}`}>
                    {row.method}
                  </span>
                </div>
                <div>
                  <span className="text-yellow-400/60">Tokens:</span>
                  <span className="text-cyan-400 ml-1">{formatNumber(row.totalTokens)}</span>
                </div>
                <div>
                  <span className="text-yellow-400/60">Kosten:</span>
                  <span className="text-green-400 ml-1">{formatCurrency(row.totalCost)}</span>
                </div>
                <div>
                  <span className="text-yellow-400/60">URLs:</span>
                  <span className="text-cyan-400 ml-1">{row.urlCount}</span>
                </div>
                <div>
                  <span className="text-yellow-400/60">Eigens.:</span>
                  <span className="text-cyan-400 ml-1">{row.propertiesExtracted}</span>
                </div>
              </div>

              {row.urls && (
                <div className="text-[10px] text-gray-500 bg-black/30 p-2 rounded max-h-20 overflow-y-auto">
                  {row.urls.split('\n').slice(0, 3).map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-cyan-400/60 hover:text-cyan-400 truncate"
                    >
                      <ExternalLink className="h-3 w-3 inline mr-1" />
                      {url}
                    </a>
                  ))}
                  {row.urls.split('\n').length > 3 && (
                    <div className="text-gray-600">+{row.urls.split('\n').length - 3} weitere</div>
                  )}
                </div>
              )}

              <div className="text-[10px] text-gray-500 mt-2">
                {formatDate(row.timestamp)}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block responsive-table-wrapper">
          <div className="responsive-table-inner">
            <div className="cyber-table rounded overflow-hidden" style={{ minWidth: '1400px' }}>
              <Table>
                <TableHeader>
                  <TableRow className="border-yellow-500/30">
                    <TableHead className="text-yellow-400 font-bold sticky left-0 bg-black/90 z-10">ZEITSTEMPEL</TableHead>
                    <TableHead className="text-yellow-400 font-bold">BENUTZER</TableHead>
                    <TableHead className="text-yellow-400 font-bold">PRODUKTNAME</TableHead>
                    <TableHead className="text-yellow-400 font-bold">ART.-NR.</TableHead>
                    <TableHead className="text-yellow-400 font-bold">METHODE</TableHead>
                    <TableHead className="text-yellow-400 font-bold">URLs</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">URL-ANZAHL</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">TOKENS</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">KOSTEN</TableHead>
                    <TableHead className="text-yellow-400 font-bold">MODELL</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-center">STATUS</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">EIGENS.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <React.Fragment key={row.searchId}>
                    <TableRow className="border-yellow-500/10 hover:bg-yellow-500/5">
                      <TableCell className="text-gray-400 text-xs sticky left-0 bg-black/80 whitespace-nowrap">
                        {formatDate(row.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium text-cyan-400 whitespace-nowrap">
                        {row.username}
                      </TableCell>
                      <TableCell className="text-cyan-300 max-w-48">
                        <div className="truncate" title={row.productName}>
                          {row.productName}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {row.articleNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          row.method === 'Automatisch'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {row.method}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-64">
                        {row.urls && row.urls.length > 0 ? (
                          <div>
                            <button
                              onClick={() => toggleRowExpansion(row.searchId)}
                              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition"
                            >
                              {expandedRows.has(row.searchId) ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              <span>{row.urlCount} URL{row.urlCount !== 1 ? 's' : ''}</span>
                            </button>
                            {!expandedRows.has(row.searchId) && (
                              <div className="text-[10px] text-cyan-400/40 truncate mt-1" title={row.urls.split('\n')[0]}>
                                {row.urls.split('\n')[0]}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-[10px]">Keine URLs</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-cyan-400">
                        {row.urlCount}
                      </TableCell>
                      <TableCell className="text-right text-yellow-400 font-bold">
                        {formatNumber(row.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right text-green-400">
                        {formatCurrency(row.totalCost)}
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs max-w-32 truncate" title={row.modelInfo}>
                        {row.modelInfo || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.success ? (
                          <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                        ) : (
                          <span title={row.errorMessage}>
                            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-cyan-400">
                        {row.propertiesExtracted}
                      </TableCell>
                    </TableRow>
                    {/* Expanded URLs Row */}
                    {expandedRows.has(row.searchId) && row.urls && (
                      <TableRow className="bg-black/60">
                        <TableCell colSpan={12} className="p-0">
                          <div className="p-4 bg-black/40 border-t border-yellow-500/10">
                            <div className="text-xs text-yellow-400/60 font-bold mb-2">
                              ALLE URLs FÜR: {row.productName}
                            </div>
                            <div className="grid gap-1 max-h-48 overflow-y-auto">
                              {row.urls.split('\n').filter(url => url.trim()).map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 bg-black/30 px-3 py-2 rounded hover:bg-cyan-500/10 transition"
                                >
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredRows.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-12">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Keine Produktsuchen gefunden</p>
            <p className="text-sm mt-2">Versuchen Sie, Ihre Filter oder den Datumsbereich anzupassen</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-yellow-500/20">
            <div className="text-sm text-gray-500">
              Zeige {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} von {total} Suchen
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-cyan-400 px-3">
                Seite {page} von {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}