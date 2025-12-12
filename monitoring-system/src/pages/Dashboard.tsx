import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, Activity, DollarSign, AlertCircle,
  Cpu, HardDrive, Database, Zap, Clock,
  Bell, Shield, Eye, Search, Download, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Hash
} from 'lucide-react';
import { authFetch } from '@/lib/api';
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart';
import { LineChart, MiniLineChart } from '@/components/charts/LineChart';
import { BarChart, ProgressBar } from '@/components/charts/BarChart';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

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
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  modelInfo: string;
  duration: number;
  success: boolean;
  errorMessage: string;
  propertiesExtracted: number;
}

interface UserStats {
  id: number;
  username: string;
  total_api_calls: number;
  total_tokens_used: number;
  total_cost: string;
  total_errors: number;
  is_active: boolean;
  last_activity: string;
}

interface UserOption {
  id: number;
  username: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0
  });
  
  // Users state
  const [users, setUsers] = useState<UserStats[]>([]);
  
  // Product searches state
  const [searchRows, setSearchRows] = useState<FlatSearchRow[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLimit] = useState(10);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Filters
  const [userFilter, setUserFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const fetchStats = async () => {
    try {
      const response = await authFetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        
        // Simulate system metrics (in production, get from actual system monitoring)
        setSystemMetrics({
          cpu: Math.floor(Math.random() * 40) + 30,
          memory: Math.floor(Math.random() * 30) + 50,
          disk: Math.floor(Math.random() * 20) + 60,
          network: Math.floor(Math.random() * 50) + 20
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await authFetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchSearches = async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', searchLimit.toString());
      params.append('offset', ((searchPage - 1) * searchLimit).toString());
      
      if (userFilter) {
        params.append('user_id', userFilter);
      }
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
        setSearchRows(data.rows || []);
        setSearchTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch product searches:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchSearches();
    
    // Refresh both stats and searches every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchSearches();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [searchPage, userFilter, methodFilter, startDate, endDate]);

  // Derived data for charts
  const userCostData = useMemo(() => {
    return users
      .filter(u => parseFloat(u.total_cost || '0') > 0)
      .sort((a, b) => parseFloat(b.total_cost) - parseFloat(a.total_cost))
      .slice(0, 6)
      .map((u, i) => ({
        label: u.username,
        value: parseFloat(u.total_cost || '0'),
        color: ['#4191FF', '#00C8FF', '#50DC64', '#FFB432', '#FF5050', '#A855F7'][i] || '#4191FF'
      }));
  }, [users]);

  const methodDistribution = useMemo(() => {
    const auto = searchRows.filter(r => r.method === 'Automatisch').length;
    const manual = searchRows.filter(r => r.method !== 'Automatisch').length;
    return [
      { label: 'Automatisch', value: auto, color: '#4191FF' },
      { label: 'Manuelle Quellen', value: manual, color: '#A855F7' }
    ];
  }, [searchRows]);

  const trendData = useMemo(() => {
    // Generate last 10 days mock trend data
    const days = Array.from({ length: 10 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (9 - i));
      return {
        label: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        value: Math.floor(Math.random() * 500) + 200
      };
    });
    return days;
  }, []);

  const costTrendData = useMemo(() => {
    // Generate last 10 days cost trend
    return Array.from({ length: 10 }, () => Math.random() * 5 + 1);
  }, []);

  // Filter rows client-side for search term
  const filteredSearchRows = searchRows.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      row.productName?.toLowerCase().includes(term) ||
      row.username?.toLowerCase().includes(term) ||
      row.articleNumber?.toLowerCase().includes(term)
    );
  });

  const searchTotalPages = Math.ceil(searchTotal / searchLimit);

  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString() || '0';
  };

  const formatSearchDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate totals
  const totalCostNum = parseFloat(stats?.totalCost || '0');
  const todayCostNum = parseFloat(stats?.todayStats?.cost || '0');
  const totalTokens = users.reduce((sum, u) => {
    const tokens = typeof u.total_tokens_used === 'string'
      ? parseInt(u.total_tokens_used, 10)
      : (u.total_tokens_used || 0);
    return sum + (isNaN(tokens) ? 0 : tokens);
  }, 0);
  const totalApiCalls = typeof stats?.totalApiCalls === 'string'
    ? parseInt(stats.totalApiCalls, 10)
    : (stats?.totalApiCalls || 0);
  const totalUsers = stats?.totalUsers || 0;
  const activeUsers = stats?.activeUsers || 0;
  const totalErrors = stats?.totalErrors || 0;

  // Top users by cost
  const topUsersByCost = useMemo(() => {
    return [...users]
      .sort((a, b) => parseFloat(b.total_cost || '0') - parseFloat(a.total_cost || '0'))
      .slice(0, 5);
  }, [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">SYSTEM WIRD GELADEN...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date/Time */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold neon-yellow tracking-wide">
            Überwachungs-Dashboard
          </h1>
          <p className="text-sm text-cyan-400/60 mt-1">
            Echtzeit-Systemübersicht und Analysen
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-400">
              {new Date().toLocaleDateString('de-DE', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-online"></div>
            <span className="text-green-400 text-sm font-medium">SYSTEM AKTIV</span>
          </div>
        </div>
      </div>

      {/* Row 1: Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="dashboard-widget cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <MiniLineChart data={costTrendData} color="#50DC64" />
          </div>
          <div className="big-number text-3xl md:text-4xl">{formatCurrency(totalCostNum)}</div>
          <div className="text-sm text-gray-400 mt-2">Gesamtkosten (Gesamt)</div>
          <div className="flex items-center gap-2 mt-3">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-400">+{formatCurrency(todayCostNum)} heute</span>
          </div>
        </div>

        {/* Total Users */}
        <div className="dashboard-widget cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Aktiv</div>
              <div className="text-lg font-bold text-cyan-400">{activeUsers}</div>
            </div>
          </div>
          <div className="big-number text-3xl md:text-4xl">{totalUsers}</div>
          <div className="text-sm text-gray-400 mt-2">Benutzer Gesamt</div>
          <ProgressBar 
            value={activeUsers} 
            max={totalUsers || 1} 
            color="#4191FF" 
            size="sm" 
            showPercentage={false} 
          />
        </div>

        {/* API Calls */}
        <div className="dashboard-widget cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-cyan-500/10">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Heute</div>
              <div className="text-lg font-bold text-cyan-400">+{stats?.todayStats?.apiCalls || 0}</div>
            </div>
          </div>
          <div className="big-number text-3xl md:text-4xl">{formatNumber(totalApiCalls)}</div>
          <div className="text-sm text-gray-400 mt-2">API-Aufrufe Gesamt</div>
        </div>

        {/* Total Tokens */}
        <div className="dashboard-widget cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Hash className="h-6 w-6 text-purple-400" />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Fehler</div>
              <div className="text-lg font-bold text-red-400">{totalErrors}</div>
            </div>
          </div>
          <div className="big-number text-3xl md:text-4xl">{formatNumber(totalTokens)}</div>
          <div className="text-sm text-gray-400 mt-2">Tokens Verbraucht</div>
        </div>
      </div>

      {/* Row 2: Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Cost Distribution - Donut Chart */}
        <div className="cyber-panel p-6 rounded-xl">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">Kosten pro Benutzer</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <DonutChart 
              data={userCostData}
              size={140}
              strokeWidth={18}
              centerValue={formatCurrency(totalCostNum)}
              centerLabel="Total"
            />
            <div className="flex-1 w-full">
              <DonutLegend data={userCostData} showPercentage={false} />
            </div>
          </div>
        </div>

        {/* Search Trend - Line Chart */}
        <div className="cyber-panel p-6 rounded-xl">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">Suchaktivitäts-Trend</h3>
          <LineChart 
            data={trendData}
            height={180}
            lineColor="#4191FF"
            fillColor="rgba(65, 145, 255, 0.1)"
            showDots={true}
            showGrid={true}
            showLabels={true}
          />
        </div>

        {/* Method Distribution - Bar Chart */}
        <div className="cyber-panel p-6 rounded-xl">
          <h3 className="text-lg font-bold text-yellow-400 mb-4">Suchmethoden</h3>
          <div className="flex items-center gap-6">
            <DonutChart 
              data={methodDistribution}
              size={120}
              strokeWidth={16}
            />
            <div className="flex-1">
              <DonutLegend data={methodDistribution} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: System & User Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Resources */}
        <div className="cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-yellow-400">Systemressourcen</h3>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" />
              <span className="text-xs text-green-400">Geschützt</span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Prozessor</span>
                </div>
                <span className="text-sm font-bold text-cyan-400">{systemMetrics.cpu}%</span>
              </div>
              <ProgressBar value={systemMetrics.cpu} showPercentage={false} size="sm" 
                color={systemMetrics.cpu > 80 ? '#FF5050' : systemMetrics.cpu > 60 ? '#FFB432' : '#4191FF'} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Speicher</span>
                </div>
                <span className="text-sm font-bold text-cyan-400">{systemMetrics.memory}%</span>
              </div>
              <ProgressBar value={systemMetrics.memory} showPercentage={false} size="sm"
                color={systemMetrics.memory > 80 ? '#FF5050' : systemMetrics.memory > 60 ? '#FFB432' : '#4191FF'} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Festplatte</span>
                </div>
                <span className="text-sm font-bold text-cyan-400">{systemMetrics.disk}%</span>
              </div>
              <ProgressBar value={systemMetrics.disk} showPercentage={false} size="sm"
                color={systemMetrics.disk > 80 ? '#FF5050' : systemMetrics.disk > 60 ? '#FFB432' : '#4191FF'} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Netzwerk</span>
                </div>
                <span className="text-sm font-bold text-cyan-400">{systemMetrics.network}%</span>
              </div>
              <ProgressBar value={systemMetrics.network} showPercentage={false} size="sm"
                color={systemMetrics.network > 80 ? '#FF5050' : systemMetrics.network > 60 ? '#FFB432' : '#4191FF'} />
            </div>
          </div>
        </div>

        {/* Top Users by Cost */}
        <div className="cyber-panel p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-yellow-400">Top-Benutzer nach Kosten</h3>
            <Link href="/users">
              <Button variant="outline" size="sm" className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
                <Eye className="h-4 w-4 mr-2" />
                Alle anzeigen
              </Button>
            </Link>
          </div>
          <div className="data-table-card">
            <div className="data-table-header grid grid-cols-4">
              <span>Benutzer</span>
              <span className="text-right">API-Aufrufe</span>
              <span className="text-right">Tokens</span>
              <span className="text-right">Kosten</span>
            </div>
            {topUsersByCost.map((user, idx) => (
              <div key={user.id} className="data-table-row grid grid-cols-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-cyan-400 truncate">{user.username}</span>
                </div>
                <span className="text-right text-gray-300">{formatNumber(user.total_api_calls || 0)}</span>
                <span className="text-right text-gray-300">{formatNumber(user.total_tokens_used || 0)}</span>
                <span className="text-right text-green-400 font-bold">{formatCurrency(user.total_cost)}</span>
              </div>
            ))}
            {topUsersByCost.length === 0 && (
              <div className="text-center text-gray-500 py-8">Keine Benutzerdaten verfügbar</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Searches */}
      <div className="cyber-panel p-6 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-yellow-400">Letzte Produktsuchen</h3>
            <p className="text-sm text-cyan-400/60 mt-1">Aktuelle Suchen mit Token-Verbrauch und Kosten</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-yellow-400" />
              <Input
                type="text"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-48 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40"
              />
            </div>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setSearchPage(1); }}
              className="bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-2 rounded text-sm"
            >
              <option value="">Alle Benutzer</option>
              {users.map(user => (
                <option key={user.id} value={user.id.toString()}>{user.username}</option>
              ))}
            </select>
            <Link href="/product-searches">
              <Button variant="outline" size="sm" className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
                <Eye className="h-4 w-4 mr-2" />
                Alle anzeigen
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading indicator */}
        {searchLoading && (
          <div className="text-center py-4 text-yellow-400">
            <RefreshCw className="h-6 w-6 animate-spin inline mr-2" />
            Suchen werden geladen...
          </div>
        )}

        {/* Desktop Table View */}
        <div className="responsive-table-wrapper">
          <div className="responsive-table-inner">
            <div className="cyber-table rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-yellow-500/30">
                    <TableHead className="text-yellow-400 font-bold">Zeit</TableHead>
                    <TableHead className="text-yellow-400 font-bold">Benutzer</TableHead>
                    <TableHead className="text-yellow-400 font-bold">Produkt</TableHead>
                    <TableHead className="text-yellow-400 font-bold">Methode</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">Tokens</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-right">Kosten</TableHead>
                    <TableHead className="text-yellow-400 font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSearchRows.map((row) => (
                    <TableRow key={row.searchId} className="border-yellow-500/10 hover:bg-yellow-500/5">
                      <TableCell className="text-gray-400 text-xs whitespace-nowrap">
                        {formatSearchDate(row.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium text-cyan-400">
                        {row.username}
                      </TableCell>
                      <TableCell className="text-cyan-300 max-w-48">
                        <div className="truncate" title={row.productName}>
                          {row.productName}
                        </div>
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
                      <TableCell className="text-right text-yellow-400 font-medium">
                        {formatNumber(row.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-bold">
                        {formatCurrency(row.totalCost)}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredSearchRows.length === 0 && !searchLoading && (
          <div className="text-center text-gray-500 py-12">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Keine Produktsuchen gefunden</p>
          </div>
        )}

        {/* Pagination */}
        {searchTotalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-yellow-500/20">
            <div className="text-sm text-gray-500">
              Zeige {((searchPage - 1) * searchLimit) + 1} - {Math.min(searchPage * searchLimit, searchTotal)} von {searchTotal}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchPage(p => Math.max(1, p - 1))}
                disabled={searchPage === 1}
                className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-cyan-400 px-3">
                {searchPage} / {searchTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchPage(p => Math.min(searchTotalPages, p + 1))}
                disabled={searchPage === searchTotalPages}
                className="glow-yellow border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Row 5: Recent Activity */}
      <div className="cyber-panel p-6 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-yellow-400">Letzte Aktivitäten</h3>
            <p className="text-sm text-cyan-400/60 mt-1">Neueste Systemereignisse</p>
          </div>
          <Link href="/activity">
            <Button variant="outline" size="sm" className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">
              <Eye className="h-4 w-4 mr-2" />
              Alle anzeigen
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats?.recentActivity?.slice(0, 6).map((activity: any) => (
            <div key={activity.id} className="bg-black/40 rounded-lg p-4 border border-yellow-500/10 hover:border-yellow-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-cyan-400 text-sm">{activity.username}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activity.activity_type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  activity.activity_type === 'api_call' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                  'bg-green-500/20 text-green-400 border border-green-500/30'
                }`}>
                  {activity.activity_type?.toUpperCase().replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 mb-2">{activity.action}</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <Clock className="h-3 w-3" />
                {new Date(activity.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
          <div className="text-center text-gray-500 py-8">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
            Keine aktuellen Aktivitäten
          </div>
        )}
      </div>
    </div>
  );
}