import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, RefreshCw, LogOut, User, Activity, DollarSign,
  AlertCircle, Database, Download, Search, Terminal, Calendar, Package,
  ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ExpandableActivityCard } from '@/components/ExpandableActivityCard';
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

interface UserDetailsPageProps {
  userId: string;
  onLogout: () => void;
}

export default function UserDetailsPage({ userId, onLogout }: UserDetailsPageProps) {
  const [user, setUser] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [tokenLogs, setTokenLogs] = useState<any[]>([]);
  const [apiCalls, setApiCalls] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const [productSearches, setProductSearches] = useState<FlatSearchRow[]>([]);
  const [searchesTotalCount, setSearchesTotalCount] = useState(0);
  const [searchesPage, setSearchesPage] = useState(1);
  const [expandedSearchRows, setExpandedSearchRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'searches' | 'activity' | 'tokens' | 'api' | 'errors' | 'console'>('searches');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [logLevelFilter, setLogLevelFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const toggleSearchRowExpansion = (searchId: number) => {
    setExpandedSearchRows(prev => {
      const next = new Set(prev);
      if (next.has(searchId)) {
        next.delete(searchId);
      } else {
        next.add(searchId);
      }
      return next;
    });
  };

  const fetchUserData = async () => {
    try {
      // Fetch user details
      const userResponse = await authFetch(`/api/users/${userId}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      // Build date filters for URLs
      let dateParams = '';
      if (startDate) dateParams += `&start_date=${startDate}`;
      if (endDate) dateParams += `&end_date=${endDate}`;

      // Fetch product searches for this user
      let searchParams = `limit=50&offset=${(searchesPage - 1) * 50}&user_id=${userId}`;
      if (methodFilter) searchParams += `&search_tab=${methodFilter}`;
      if (startDate) searchParams += `&start_date=${startDate}`;
      if (endDate) searchParams += `&end_date=${endDate}`;
      
      const searchesResponse = await authFetch(`/api/product-searches/flat?${searchParams}`);
      if (searchesResponse.ok) {
        const data = await searchesResponse.json();
        setProductSearches(data.rows || []);
        setSearchesTotalCount(data.total || 0);
      }

      // Fetch activity logs
      const activityResponse = await authFetch(`/api/users/${userId}/activity?limit=50${dateParams}`);
      if (activityResponse.ok) {
        const data = await activityResponse.json();
        setActivityLogs(data.logs);
      }

      // Fetch token logs
      const tokenResponse = await authFetch(`/api/users/${userId}/tokens?limit=50${dateParams}`);
      if (tokenResponse.ok) {
        const data = await tokenResponse.json();
        setTokenLogs(data.logs);
      }

      // Fetch API calls
      const apiResponse = await authFetch(`/api/users/${userId}/api-calls?limit=50${dateParams}`);
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        setApiCalls(data.logs);
      }

      // Fetch errors
      const errorResponse = await authFetch(`/api/users/${userId}/errors?limit=50${dateParams}`);
      if (errorResponse.ok) {
        const data = await errorResponse.json();
        setErrors(data.logs);
      }

      // Fetch console logs
      let consoleUrl = `/api/users/${userId}/console-logs?limit=100`;
      if (logLevelFilter) consoleUrl += `&log_level=${logLevelFilter}`;
      if (categoryFilter) consoleUrl += `&category=${categoryFilter}`;
      
      const consoleResponse = await authFetch(consoleUrl);
      if (consoleResponse.ok) {
        const data = await consoleResponse.json();
        setConsoleLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    const interval = setInterval(fetchUserData, 10000); // Refresh every 10s
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [userId, logLevelFilter, categoryFilter, startDate, endDate, methodFilter, searchesPage]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const filterData = (data: any[]) => {
    if (!searchTerm) return data;
    return data.filter(item => 
      JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center cyber-grid scanlines">
        <div className="text-lg neon-yellow">LADE BENUTZERDATEN...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black cyber-grid scanlines">
      {/* Header */}
      <header className="border-b-2 border-yellow-500/30 bg-black/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/users" className="inline-block">
                <Button
                  variant="outline"
                  size="sm"
                  className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 px-2 sm:px-3"
                >
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">ZURÜCK</span>
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold neon-yellow tracking-wider">
                  <span className="hidden sm:inline">BENUTZER-ÜBERWACHUNG</span>
                  <span className="sm:hidden">BENUTZER</span>
                </h1>
                <p className="hidden sm:block text-sm text-cyan-400 mt-1">
                  DETAILLIERTE AKTIVITÄTSANALYSE
                </p>
              </div>
            </div>
            
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <div className="digital-clock text-2xl">
                  {formatTime(currentTime)}
                </div>
                <div className="text-xs text-yellow-500">
                  {formatDate(currentTime)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUserData}
                  className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  AKTUALISIEREN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  ABMELDEN
                </Button>
              </div>
            </div>
            
            {/* Mobile actions */}
            <div className="flex md:hidden items-center gap-2">
              <div className="digital-clock text-sm">
                {formatTime(currentTime)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUserData}
                className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="glow-red border-red-500 text-red-400 hover:bg-red-500/10 px-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* User Info Banner */}
        <div className="mb-4 sm:mb-6 cyber-panel p-4 sm:p-6 rounded">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-yellow-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-black" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold neon-cyan">{user?.username}</h2>
                <p className="text-xs sm:text-sm text-yellow-400">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                    user?.is_active ? 'badge-normal' : 'badge-critical'
                  }`}>
                    {user?.is_active ? 'AKTIV' : 'INAKTIV'}
                  </span>
                  <span className="badge-info px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                    {user?.role?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right flex sm:flex-col gap-4 sm:gap-0">
              <div>
                <div className="text-[10px] sm:text-xs text-yellow-400/60">MITGLIED SEIT</div>
                <div className="text-xs sm:text-sm text-cyan-400">
                  {new Date(user?.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="sm:mt-2">
                <div className="text-[10px] sm:text-xs text-yellow-400/60">LETZTER LOGIN</div>
                <div className="text-xs sm:text-sm text-cyan-400">
                  {user?.last_login ? new Date(user.last_login).toLocaleDateString('de-DE') : 'Nie'}
                </div>
              </div>
            </div>
          </div>

          {/* User Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
            <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
              <div className="flex items-center justify-between mb-2">
                <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">API-AUFRUFE</div>
                <Activity className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold neon-cyan">
                {user?.statistics?.total_api_calls?.toLocaleString() || 0}
              </div>
            </div>

            <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
              <div className="flex items-center justify-between mb-2">
                <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">TOKENS</div>
                <Database className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold neon-cyan">
                {user?.statistics?.total_tokens_used?.toLocaleString() || 0}
              </div>
            </div>

            <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
              <div className="flex items-center justify-between mb-2">
                <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">KOSTEN</div>
                <DollarSign className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold neon-cyan">
                ${parseFloat(user?.statistics?.total_cost || '0').toFixed(2)}
              </div>
            </div>

            <div className="stat-card-cyber p-3 sm:p-4 rounded glow-red">
              <div className="flex items-center justify-between mb-2">
                <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">FEHLER</div>
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold neon-red">
                {user?.statistics?.total_errors?.toLocaleString() || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Horizontal scrollable on mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="flex overflow-x-auto border-b border-yellow-500/20 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => setActiveTab('searches')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'searches'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              <Package className="h-4 w-4 inline mr-1" />
              SUCHEN ({searchesTotalCount})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              AKTIVITÄT ({activityLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'tokens'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              TOKENS ({tokenLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'api'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              API ({apiCalls.length})
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'errors'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              ERRORS ({errors.length})
            </button>
            <button
              onClick={() => setActiveTab('console')}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 font-bold tracking-wide transition text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'console'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              <Terminal className="h-4 w-4 inline mr-1" />
              CONSOLE ({consoleLogs.length})
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-yellow-400" />
              <Input
                type="text"
                placeholder="SUCHEN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 h-12"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 h-12 sm:h-auto"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="sm:inline">EXPORTIEREN</span>
            </Button>
          </div>

          {/* Date Range Filter */}
          <div className="cyber-panel p-3 sm:p-4 rounded">
            <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              DATUMSBEREICH
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-cyan-400 text-xs mb-1 block">VON</label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black/50 border-yellow-500/30 text-cyan-400"
                />
              </div>
              <div>
                <label className="text-cyan-400 text-xs mb-1 block">BIS</label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black/50 border-yellow-500/30 text-cyan-400"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="mt-3 text-xs glow-red border-red-500 text-red-400 hover:bg-red-500/10"
              >
                DATEN LÖSCHEN
              </Button>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="cyber-panel p-4 sm:p-6 rounded">
          {activeTab === 'searches' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">PRODUKTSUCHEN</h3>
                <div className="flex gap-2">
                  <select
                    value={methodFilter}
                    onChange={(e) => { setMethodFilter(e.target.value); setSearchesPage(1); }}
                    className="bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-1 rounded text-sm"
                  >
                    <option value="">Alle Methoden</option>
                    <option value="automatisch">Automatisch</option>
                    <option value="manuelle_quellen">Manuelle Quellen</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const headers = ['Zeitstempel', 'Produkt', 'Methode', 'URLs', 'Tokens', 'Kosten'];
                      const csv = [headers.join('\t'), ...productSearches.map(r =>
                        [new Date(r.timestamp).toLocaleString(), r.productName, r.method, r.urls.replace(/\n/g, '; '), r.totalTokens, r.totalCost].join('\t')
                      )].join('\n');
                      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${user?.username}-searches.csv`;
                      link.click();
                    }}
                    className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">EXPORTIEREN</span>
                  </Button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-black/30 rounded p-3 border border-cyan-500/20 text-center">
                  <div className="text-cyan-400 text-xl font-bold">{searchesTotalCount}</div>
                  <div className="text-[10px] text-gray-500">Gesamtsuchen</div>
                </div>
                <div className="bg-black/30 rounded p-3 border border-yellow-500/20 text-center">
                  <div className="text-yellow-400 text-xl font-bold">
                    {productSearches.reduce((sum, r) => sum + (r.totalTokens || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">Gesamt-Tokens</div>
                </div>
                <div className="bg-black/30 rounded p-3 border border-green-500/20 text-center">
                  <div className="text-green-400 text-xl font-bold">
                    ${productSearches.reduce((sum, r) => sum + parseFloat(r.totalCost || '0'), 0).toFixed(4)}
                  </div>
                  <div className="text-[10px] text-gray-500">Gesamtkosten</div>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-3">
                {productSearches.map((row) => (
                  <div key={row.searchId} className="bg-black/40 rounded p-4 border border-yellow-500/10">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-cyan-400">{row.productName}</div>
                        {row.articleNumber && (
                          <div className="text-xs text-gray-500">Art: {row.articleNumber}</div>
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
                        <span className="text-yellow-400/60">Methode:</span>
                        <span className={`ml-1 ${row.method === 'Automatisch' ? 'text-blue-400' : 'text-purple-400'}`}>
                          {row.method}
                        </span>
                      </div>
                      <div>
                        <span className="text-yellow-400/60">Tokens:</span>
                        <span className="text-cyan-400 ml-1">{row.totalTokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-yellow-400/60">Kosten:</span>
                        <span className="text-green-400 ml-1">${parseFloat(row.totalCost).toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-yellow-400/60">URLs:</span>
                        <span className="text-cyan-400 ml-1">{row.urlCount}</span>
                      </div>
                    </div>
                    {row.urls && (
                      <button onClick={() => toggleSearchRowExpansion(row.searchId)} className="w-full text-left">
                        <div className="flex items-center gap-1 text-xs text-cyan-400 mb-2">
                          {expandedSearchRows.has(row.searchId) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          <span>{row.urlCount} URLs anzeigen</span>
                        </div>
                        {expandedSearchRows.has(row.searchId) && (
                          <div className="text-[10px] bg-black/30 p-2 rounded max-h-32 overflow-y-auto">
                            {row.urls.split('\n').filter((u: string) => u.trim()).map((url: string, idx: number) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                className="block text-cyan-400/60 hover:text-cyan-400 truncate" onClick={(e) => e.stopPropagation()}>
                                <ExternalLink className="h-3 w-3 inline mr-1" />{url}
                              </a>
                            ))}
                          </div>
                        )}
                      </button>
                    )}
                    <div className="text-[10px] text-gray-500 mt-2">{new Date(row.timestamp).toLocaleString('de-DE')}</div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block responsive-table-wrapper">
                <div className="responsive-table-inner">
                  <div className="cyber-table rounded overflow-hidden" style={{ minWidth: '1000px' }}>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-yellow-500/30">
                          <TableHead className="text-yellow-400 font-bold">ZEITSTEMPEL</TableHead>
                          <TableHead className="text-yellow-400 font-bold">PRODUKT</TableHead>
                          <TableHead className="text-yellow-400 font-bold">ARTIKEL-NR.</TableHead>
                          <TableHead className="text-yellow-400 font-bold">METHODE</TableHead>
                          <TableHead className="text-yellow-400 font-bold">URLs</TableHead>
                          <TableHead className="text-yellow-400 font-bold text-right">TOKENS</TableHead>
                          <TableHead className="text-yellow-400 font-bold text-right">KOSTEN</TableHead>
                          <TableHead className="text-yellow-400 font-bold text-center">STATUS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productSearches.map((row) => (
                          <React.Fragment key={row.searchId}>
                            <TableRow className="border-yellow-500/10 hover:bg-yellow-500/5">
                              <TableCell className="text-gray-400 text-xs">{new Date(row.timestamp).toLocaleString('de-DE')}</TableCell>
                              <TableCell className="text-cyan-300 max-w-48">
                                <div className="truncate" title={row.productName}>{row.productName}</div>
                              </TableCell>
                              <TableCell className="text-gray-400 text-sm">{row.articleNumber || '-'}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  row.method === 'Automatisch' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                }`}>{row.method}</span>
                              </TableCell>
                              <TableCell>
                                {row.urls ? (
                                  <button onClick={() => toggleSearchRowExpansion(row.searchId)}
                                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300">
                                    {expandedSearchRows.has(row.searchId) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    <span>{row.urlCount} URLs</span>
                                  </button>
                                ) : <span className="text-gray-600 text-[10px]">Keine URLs</span>}
                              </TableCell>
                              <TableCell className="text-right text-yellow-400 font-bold">{row.totalTokens.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-green-400">${parseFloat(row.totalCost).toFixed(4)}</TableCell>
                              <TableCell className="text-center">
                                {row.success ? <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                                  : <span title={row.errorMessage}><XCircle className="h-4 w-4 text-red-400 mx-auto" /></span>}
                              </TableCell>
                            </TableRow>
                            {expandedSearchRows.has(row.searchId) && row.urls && (
                              <TableRow className="bg-black/60">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="p-4 bg-black/40 border-t border-yellow-500/10">
                                    <div className="text-xs text-yellow-400/60 font-bold mb-2">ALLE URLs FÜR: {row.productName}</div>
                                    <div className="grid gap-1 max-h-48 overflow-y-auto">
                                      {row.urls.split('\n').filter((url: string) => url.trim()).map((url: string, idx: number) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 bg-black/30 px-3 py-2 rounded hover:bg-cyan-500/10 transition">
                                          <ExternalLink className="h-3 w-3 flex-shrink-0" /><span className="truncate">{url}</span>
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

              {productSearches.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  Keine Produktsuchen für diesen Benutzer gefunden
                </div>
              )}

              {/* Pagination */}
              {searchesTotalCount > 50 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-yellow-500/20">
                  <div className="text-sm text-gray-500">
                    Seite {searchesPage} von {Math.ceil(searchesTotalCount / 50)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSearchesPage(p => Math.max(1, p - 1))} disabled={searchesPage === 1}
                      className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSearchesPage(p => p + 1)} disabled={searchesPage >= Math.ceil(searchesTotalCount / 50)}
                      className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">AKTIVITÄTSPROTOKOLLE</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Package className="h-4 w-4 text-cyan-400" />
                  <span>Klicken Sie auf Suchaktivitäten, um Details anzuzeigen</span>
                </div>
              </div>
              
              {/* Search Activity Summary */}
              {activityLogs.filter((log: any) =>
                log.activity_type?.includes('search') ||
                log.activity_type?.includes('batch') ||
                log.activity_type?.includes('extraction')
              ).length > 0 && (
                <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-black/30 rounded p-3 border border-cyan-500/20">
                    <div className="text-cyan-400 text-lg font-bold">
                      {activityLogs.filter((log: any) =>
                        log.activity_type?.includes('search:automatisch:manual')
                      ).length}
                    </div>
                    <div className="text-[10px] text-gray-500">Einzeln Suchen</div>
                  </div>
                  <div className="bg-black/30 rounded p-3 border border-yellow-500/20">
                    <div className="text-yellow-400 text-lg font-bold">
                      {activityLogs.filter((log: any) =>
                        log.activity_type?.includes('batch_search')
                      ).length}
                    </div>
                    <div className="text-[10px] text-gray-500">Datei Uploads</div>
                  </div>
                  <div className="bg-black/30 rounded p-3 border border-green-500/20">
                    <div className="text-green-400 text-lg font-bold">
                      {activityLogs.filter((log: any) =>
                        log.activity_type?.includes('custom_search')
                      ).length}
                    </div>
                    <div className="text-[10px] text-gray-500">Manuelle Quellen</div>
                  </div>
                  <div className="bg-black/30 rounded p-3 border border-red-500/20">
                    <div className="text-red-400 text-lg font-bold">
                      {activityLogs.filter((log: any) => !log.success).length}
                    </div>
                    <div className="text-[10px] text-gray-500">Fehler</div>
                  </div>
                </div>
              )}
              
              {/* Activity Cards - Unified View for Mobile and Desktop */}
              <div className="space-y-3">
                {filterData(activityLogs).slice(0, 50).map((log: any) => (
                  <ExpandableActivityCard key={log.id} log={log} />
                ))}
                {activityLogs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    Keine Aktivitätslogs gefunden
                  </div>
                )}
              </div>
              
              {activityLogs.length > 50 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Zeige die letzten 50 von {activityLogs.length} Aktivitäten
                </div>
              )}
            </div>
          )}

          {activeTab === 'tokens' && (
            <div>
              <h3 className="text-lg sm:text-xl font-bold neon-yellow mb-4 tracking-wide">TOKEN-VERBRAUCH</h3>
              
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filterData(tokenLogs).slice(0, 20).map((log: any) => (
                  <div key={log.id} className="bg-black/40 rounded p-3 border border-yellow-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-cyan-400 font-bold text-sm">{log.model_provider.toUpperCase()}</span>
                      <span className="text-green-400 text-sm">${parseFloat(log.total_cost).toFixed(4)}</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2">{log.model_name}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-yellow-400/60">Eingabe:</span>
                        <span className="text-cyan-400 ml-1">{log.input_tokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-yellow-400/60">Ausgabe:</span>
                        <span className="text-cyan-400 ml-1">{log.output_tokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-yellow-400/60">Gesamt:</span>
                        <span className="text-yellow-400 ml-1">{log.total_tokens.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-2">
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block responsive-table-wrapper">
                <div className="responsive-table-inner">
                  <div className="cyber-table rounded overflow-hidden min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-yellow-500/30">
                      <TableHead className="text-yellow-400 font-bold">ANBIETER</TableHead>
                      <TableHead className="text-yellow-400 font-bold">MODELL</TableHead>
                      <TableHead className="text-yellow-400 font-bold">EINGABE</TableHead>
                      <TableHead className="text-yellow-400 font-bold">AUSGABE</TableHead>
                      <TableHead className="text-yellow-400 font-bold">GESAMT</TableHead>
                      <TableHead className="text-yellow-400 font-bold">KOSTEN</TableHead>
                      <TableHead className="text-yellow-400 font-bold">ZEITSTEMPEL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterData(tokenLogs).map((log: any) => (
                      <TableRow key={log.id} className="border-yellow-500/10">
                        <TableCell className="text-cyan-400 font-bold">
                          {log.model_provider.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {log.model_name}
                        </TableCell>
                        <TableCell className="text-cyan-400">
                          {log.input_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-cyan-400">
                          {log.output_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-yellow-400 font-bold">
                          {log.total_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-400">
                          ${parseFloat(log.total_cost).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <h3 className="text-lg sm:text-xl font-bold neon-yellow mb-4 tracking-wide">API-AUFRUFE</h3>
              
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filterData(apiCalls).slice(0, 20).map((log: any) => (
                  <div key={log.id} className="bg-black/40 rounded p-3 border border-yellow-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="badge-info px-2 py-0.5 rounded text-[10px] font-bold">{log.method}</span>
                      <span className={`text-xs ${
                        log.status_code < 300 ? 'text-green-400' :
                        log.status_code < 400 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>{log.status_code}</span>
                    </div>
                    <p className="text-xs text-cyan-400 font-mono mb-2 truncate">{log.endpoint}</p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-cyan-400">{log.duration}ms</span>
                      <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString('de-DE')}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block responsive-table-wrapper">
                <div className="responsive-table-inner">
                  <div className="cyber-table rounded overflow-hidden min-w-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-yellow-500/30">
                      <TableHead className="text-yellow-400 font-bold">METHODE</TableHead>
                      <TableHead className="text-yellow-400 font-bold">ENDPUNKT</TableHead>
                      <TableHead className="text-yellow-400 font-bold">STATUS</TableHead>
                      <TableHead className="text-yellow-400 font-bold">DAUER</TableHead>
                      <TableHead className="text-yellow-400 font-bold">IP</TableHead>
                      <TableHead className="text-yellow-400 font-bold">ZEITSTEMPEL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterData(apiCalls).map((log: any) => (
                      <TableRow key={log.id} className="border-yellow-500/10">
                        <TableCell>
                          <span className="badge-info px-2 py-1 rounded text-xs font-bold">
                            {log.method}
                          </span>
                        </TableCell>
                        <TableCell className="text-cyan-400 text-sm font-mono">
                          {log.endpoint}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.status_code < 300 ? 'text-green-400' :
                            log.status_code < 400 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {log.status_code}
                          </span>
                        </TableCell>
                        <TableCell className="text-cyan-400">
                          {log.duration}ms
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs font-mono">
                          {log.ip_address}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div>
              <h3 className="text-lg sm:text-xl font-bold neon-yellow mb-4 tracking-wide">FEHLERPROTOKOLLE</h3>
              
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filterData(errors).slice(0, 20).map((log: any) => (
                  <div key={log.id} className="bg-black/40 rounded p-3 border border-red-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-cyan-400 text-sm">{log.error_type}</span>
                      <span className={`badge-${
                        log.severity === 'critical' ? 'critical' :
                        log.severity === 'error' ? 'high' :
                        'normal'
                      } px-2 py-0.5 rounded text-[10px] font-bold`}>
                        {log.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-red-400 mb-2 line-clamp-2">{log.error_message}</p>
                    {log.endpoint && (
                      <p className="text-[10px] text-gray-400 font-mono mb-2 truncate">{log.endpoint}</p>
                    )}
                    <div className="text-[10px] text-gray-500">
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block responsive-table-wrapper">
                <div className="responsive-table-inner">
                  <div className="cyber-table rounded overflow-hidden min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-yellow-500/30">
                      <TableHead className="text-yellow-400 font-bold">TYP</TableHead>
                      <TableHead className="text-yellow-400 font-bold">NACHRICHT</TableHead>
                      <TableHead className="text-yellow-400 font-bold">SCHWEREGRAD</TableHead>
                      <TableHead className="text-yellow-400 font-bold">ENDPUNKT</TableHead>
                      <TableHead className="text-yellow-400 font-bold">ZEITSTEMPEL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterData(errors).map((log: any) => (
                      <TableRow key={log.id} className="border-yellow-500/10">
                        <TableCell className="text-cyan-400 text-sm">
                          {log.error_type}
                        </TableCell>
                        <TableCell className="text-red-400 text-sm">
                          {log.error_message}
                        </TableCell>
                        <TableCell>
                          <span className={`badge-${
                            log.severity === 'critical' ? 'critical' :
                            log.severity === 'error' ? 'high' :
                            'normal'
                          } px-2 py-1 rounded text-xs font-bold`}>
                            {log.severity.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs font-mono">
                          {log.endpoint || '-'}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">KONSOLENPROTOKOLLE</h3>
                <div className="flex gap-2 overflow-x-auto">
                  <select
                    value={logLevelFilter}
                    onChange={(e) => setLogLevelFilter(e.target.value)}
                    className="bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-1 rounded text-sm"
                  >
                    <option value="">Alle Stufen</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warnung</option>
                    <option value="error">Fehler</option>
                    <option value="fatal">Kritisch</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-1 rounded text-sm"
                  >
                    <option value="">Alle Kategorien</option>
                    <option value="general">Allgemein</option>
                    <option value="api">API</option>
                    <option value="database">Datenbank</option>
                    <option value="auth">Auth</option>
                    <option value="search">Suche</option>
                    <option value="scraping">Scraping</option>
                    <option value="ai">KI</option>
                    <option value="pdf">PDF</option>
                    <option value="performance">Leistung</option>
                  </select>
                </div>
              </div>
              
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filterData(consoleLogs).slice(0, 30).map((log: any) => (
                  <div key={log.id} className={`bg-black/40 rounded p-3 border ${
                    log.log_level === 'fatal' || log.log_level === 'error' ? 'border-red-500/30' :
                    log.log_level === 'warn' ? 'border-yellow-500/30' :
                    'border-cyan-500/10'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.log_level === 'fatal' ? 'bg-red-900 text-red-200' :
                        log.log_level === 'error' ? 'bg-red-800/50 text-red-300' :
                        log.log_level === 'warn' ? 'bg-yellow-800/50 text-yellow-300' :
                        log.log_level === 'info' ? 'bg-cyan-800/50 text-cyan-300' :
                        'bg-gray-800/50 text-gray-300'
                      }`}>
                        {log.log_level?.toUpperCase()}
                      </span>
                      <span className="text-cyan-400 text-[10px]">{log.category?.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-gray-200 font-mono mb-2 line-clamp-3">{log.message}</p>
                    {log.stack_trace && (
                      <details className="mb-2">
                        <summary className="text-red-400 text-[10px] cursor-pointer">Stacktrace</summary>
                        <pre className="text-[10px] text-red-300/70 mt-1 whitespace-pre-wrap bg-red-900/20 p-2 rounded max-h-24 overflow-auto">
                          {log.stack_trace}
                        </pre>
                      </details>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{log.source || '-'}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString('de-DE')}</span>
                    </div>
                  </div>
                ))}
                {consoleLogs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Terminal className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    Keine Konsolenprotokolle gefunden
                  </div>
                )}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block responsive-table-wrapper">
                <div className="responsive-table-inner">
                  <div className="cyber-table rounded overflow-hidden min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-yellow-500/30">
                      <TableHead className="text-yellow-400 font-bold w-24">STUFE</TableHead>
                      <TableHead className="text-yellow-400 font-bold w-28">KATEGORIE</TableHead>
                      <TableHead className="text-yellow-400 font-bold">NACHRICHT</TableHead>
                      <TableHead className="text-yellow-400 font-bold w-32">QUELLE</TableHead>
                      <TableHead className="text-yellow-400 font-bold w-40">ZEITSTEMPEL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterData(consoleLogs).map((log: any) => (
                      <TableRow key={log.id} className="border-yellow-500/10 hover:bg-yellow-500/5">
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.log_level === 'fatal' ? 'bg-red-900 text-red-200' :
                            log.log_level === 'error' ? 'bg-red-800/50 text-red-300' :
                            log.log_level === 'warn' ? 'bg-yellow-800/50 text-yellow-300' :
                            log.log_level === 'info' ? 'bg-cyan-800/50 text-cyan-300' :
                            'bg-gray-800/50 text-gray-300'
                          }`}>
                            {log.log_level?.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-cyan-400 text-xs">
                            {log.category?.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-200 text-sm font-mono max-w-md">
                          <div className="truncate" title={log.message}>
                            {log.message}
                          </div>
                          {log.stack_trace && (
                            <details className="mt-1">
                              <summary className="text-red-400 text-xs cursor-pointer">
                                Stacktrace
                              </summary>
                              <pre className="text-xs text-red-300/70 mt-1 whitespace-pre-wrap bg-red-900/20 p-2 rounded max-h-40 overflow-auto">
                                {log.stack_trace}
                              </pre>
                            </details>
                          )}
                          {log.metadata && (
                            <details className="mt-1">
                              <summary className="text-cyan-400 text-xs cursor-pointer">
                                Metadata
                              </summary>
                              <pre className="text-xs text-cyan-300/70 mt-1 whitespace-pre-wrap bg-cyan-900/20 p-2 rounded max-h-40 overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs font-mono">
                          {log.source || '-'}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {consoleLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                          <Terminal className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          Keine Konsolenprotokolle für diesen Benutzer gefunden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </div>
              {consoleLogs.length > 0 && (
                <div className="mt-4 text-sm text-cyan-400/60">
                  Zeige {consoleLogs.length} Protokolleinträge •
                  <span className="text-red-400 ml-2">
                    {consoleLogs.filter(l => l.log_level === 'error' || l.log_level === 'fatal').length} Fehler
                  </span> •
                  <span className="text-yellow-400 ml-2">
                    {consoleLogs.filter(l => l.log_level === 'warn').length} Warnungen
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}