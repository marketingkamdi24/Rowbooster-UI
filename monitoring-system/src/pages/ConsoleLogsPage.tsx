import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Terminal, AlertTriangle,
  Info, Bug, XCircle, Download, Search,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api';

interface ConsoleLog {
  id: number;
  user_id: number | null;
  username: string | null;
  log_level: string;
  category: string;
  message: string;
  metadata: any;
  stack_trace: string | null;
  source: string | null;
  request_id: string | null;
  session_id: string | null;
  duration: number | null;
  timestamp: string;
}

interface LogStats {
  byLevel: { log_level: string; count: string }[];
  byCategory: { category: string; count: string }[];
  errorTrend: { date: string; count: number }[];
  recentCritical: ConsoleLog[];
}

export default function ConsoleLogsPage() {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [autoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      let url = '/api/console-logs?limit=200';
      if (logLevelFilter) url += `&log_level=${logLevelFilter}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;

      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch console logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await authFetch('/api/console-logs/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch log stats:', error);
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchLogs(), fetchStats()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    let refreshInterval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      refreshInterval = setInterval(fetchData, 5000);
    }
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [logLevelFilter, categoryFilter, autoRefresh]);

  const toggleExpanded = (logId: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const filterData = (data: ConsoleLog[]) => {
    if (!searchTerm) return data;
    return data.filter(item => 
      item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.source?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'fatal': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info': return <Info className="h-4 w-4 text-cyan-400" />;
      case 'debug': return <Bug className="h-4 w-4 text-gray-400" />;
      default: return <Terminal className="h-4 w-4 text-gray-400" />;
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'fatal': return 'bg-red-900 text-red-200 border-red-700';
      case 'error': return 'bg-red-800/50 text-red-300 border-red-600/50';
      case 'warn': return 'bg-yellow-800/50 text-yellow-300 border-yellow-600/50';
      case 'info': return 'bg-cyan-800/50 text-cyan-300 border-cyan-600/50';
      case 'debug': return 'bg-gray-800/50 text-gray-300 border-gray-600/50';
      default: return 'bg-gray-800/50 text-gray-300 border-gray-600/50';
    }
  };

  const exportLogs = () => {
    const csvContent = logs.map(log => 
      `"${log.timestamp}","${log.log_level}","${log.category}","${log.username || 'system'}","${log.message.replace(/"/g, '""')}","${log.source || ''}"`
    ).join('\n');
    const header = 'Timestamp,Level,Category,User,Message,Source\n';
    const blob = new Blob([header + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">LADE KONSOLENPROTOKOLLE...</div>
      </div>
    );
  }

  return (
    <>
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
            {/* Level Stats */}
            {['fatal', 'error', 'warn', 'info', 'debug'].map(level => {
              const levelData = stats.byLevel.find(l => l.log_level === level);
              const count = levelData ? parseInt(levelData.count) : 0;
              return (
                <div
                  key={level}
                  className={`stat-card-cyber p-2 sm:p-4 rounded cursor-pointer transition ${
                    logLevelFilter === level ? 'ring-2 ring-yellow-400' : ''
                  }`}
                  onClick={() => setLogLevelFilter(logLevelFilter === level ? '' : level)}
                >
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <div className="text-yellow-400 text-[8px] sm:text-xs font-bold tracking-wide">
                      {level.toUpperCase()}
                    </div>
                    <span className="hidden sm:block">{getLogLevelIcon(level)}</span>
                  </div>
                  <div className={`text-lg sm:text-2xl font-bold ${
                    level === 'fatal' || level === 'error' ? 'text-red-400' :
                    level === 'warn' ? 'text-yellow-400' :
                    level === 'info' ? 'text-cyan-400' :
                    'text-gray-400'
                  }`}>
                    {count.toLocaleString()}
                  </div>
                  <div className="text-[8px] sm:text-xs text-cyan-400/60 mt-0.5 sm:mt-1">24h</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex-1 relative min-w-0 sm:min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-yellow-400" />
            <Input
              type="text"
              placeholder="Protokolle suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 h-12 sm:h-10"
            />
          </div>
          <div className="flex gap-2 sm:gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 sm:flex-none bg-black/50 border border-yellow-500/30 text-cyan-400 px-3 py-2 rounded text-sm"
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
              <option value="security">Sicherheit</option>
              <option value="system">System</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 h-10"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">EXPORTIEREN</span>
            </Button>
          </div>
        </div>

        {/* Recent Critical Errors */}
        {stats?.recentCritical && stats.recentCritical.length > 0 && (
          <div className="mb-4 sm:mb-6 cyber-panel p-3 sm:p-4 rounded border-l-4 border-red-500">
            <h3 className="text-base sm:text-lg font-bold text-red-400 mb-2 sm:mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              KÜRZLICH KRITISCH
            </h3>
            <div className="space-y-2">
              {stats.recentCritical.slice(0, 3).map((log) => (
                <div
                  key={log.id}
                  className="bg-red-900/20 border border-red-800/50 rounded p-2 sm:p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getLogLevelClass(log.log_level)}`}>
                      {log.log_level.toUpperCase()}
                    </span>
                    <span className="text-cyan-400 text-[10px]">{log.category}</span>
                    {log.username && (
                      <span className="text-yellow-400 text-[10px]">@{log.username}</span>
                    )}
                    <span className="text-gray-500 text-[10px] ml-auto">
                      {new Date(log.timestamp).toLocaleTimeString('de-DE')}
                    </span>
                  </div>
                  <p className="text-red-300 text-xs sm:text-sm line-clamp-2">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="cyber-panel p-3 sm:p-6 rounded">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-xl font-bold neon-yellow tracking-wide">
              TERMINAL ({filterData(logs).length})
            </h3>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto">
            {filterData(logs).slice(0, 50).map((log) => (
              <div
                key={log.id}
                className={`bg-black/40 rounded p-3 border ${
                  log.log_level === 'fatal' || log.log_level === 'error' ? 'border-red-500/30' :
                  log.log_level === 'warn' ? 'border-yellow-500/30' :
                  'border-cyan-500/10'
                }`}
                onClick={() => toggleExpanded(log.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getLogLevelClass(log.log_level)}`}>
                    {log.log_level?.toUpperCase()}
                  </span>
                  <span className="text-cyan-400 text-[10px]">{log.category}</span>
                </div>
                <p className="text-xs text-gray-200 font-mono mb-2 line-clamp-2">{log.message}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-yellow-400">{log.username || 'system'}</span>
                  <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString('de-DE')}</span>
                </div>
                {expandedLogs.has(log.id) && (log.stack_trace || log.metadata) && (
                  <div className="mt-2 pt-2 border-t border-gray-800 space-y-2">
                    {log.stack_trace && (
                      <pre className="text-[10px] text-red-300/70 whitespace-pre-wrap bg-red-900/20 p-2 rounded max-h-24 overflow-auto">
                        {log.stack_trace}
                      </pre>
                    )}
                    {log.metadata && (
                      <pre className="text-[10px] text-cyan-300/70 whitespace-pre-wrap bg-cyan-900/20 p-2 rounded max-h-24 overflow-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Terminal className="h-12 w-12 mx-auto mb-2 opacity-20" />
                Keine Konsolenprotokolle gefunden
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block responsive-table-wrapper">
            <div className="responsive-table-inner max-h-[600px] overflow-y-auto">
              <div className="cyber-table rounded overflow-hidden min-w-[700px]">
            <Table>
              <TableHeader className="sticky top-0 bg-black z-10">
                <TableRow className="border-yellow-500/30">
                  <TableHead className="text-yellow-400 font-bold w-8"></TableHead>
                  <TableHead className="text-yellow-400 font-bold w-24">STUFE</TableHead>
                  <TableHead className="text-yellow-400 font-bold w-28">KATEGORIE</TableHead>
                  <TableHead className="text-yellow-400 font-bold w-28">BENUTZER</TableHead>
                  <TableHead className="text-yellow-400 font-bold">NACHRICHT</TableHead>
                  <TableHead className="text-yellow-400 font-bold w-40">ZEITSTEMPEL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterData(logs).map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className={`border-yellow-500/10 cursor-pointer hover:bg-yellow-500/5 ${
                        expandedLogs.has(log.id) ? 'bg-yellow-500/10' : ''
                      }`}
                      onClick={() => toggleExpanded(log.id)}
                    >
                      <TableCell>
                        {(log.stack_trace || log.metadata) && (
                          expandedLogs.has(log.id)
                            ? <ChevronDown className="h-4 w-4 text-yellow-400" />
                            : <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getLogLevelClass(log.log_level)}`}>
                          {getLogLevelIcon(log.log_level)}
                          {log.log_level?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-cyan-400 text-xs">
                          {log.category?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-yellow-400 text-sm">
                          {log.username || <span className="text-gray-500">system</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-200 text-sm font-mono">
                        <div className="truncate max-w-xl" title={log.message}>
                          {log.message}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs">
                        {new Date(log.timestamp).toLocaleString('de-DE')}
                      </TableCell>
                    </TableRow>
                    {expandedLogs.has(log.id) && (log.stack_trace || log.metadata) && (
                      <TableRow key={`${log.id}-details`} className="bg-black/50">
                        <TableCell colSpan={6} className="p-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            {log.stack_trace && (
                              <div>
                                <h4 className="text-red-400 text-sm font-bold mb-2">Stacktrace</h4>
                                <pre className="text-xs text-red-300/70 whitespace-pre-wrap bg-red-900/20 p-3 rounded max-h-60 overflow-auto border border-red-800/30">
                                  {log.stack_trace}
                                </pre>
                              </div>
                            )}
                            {log.metadata && (
                              <div>
                                <h4 className="text-cyan-400 text-sm font-bold mb-2">Metadata</h4>
                                <pre className="text-xs text-cyan-300/70 whitespace-pre-wrap bg-cyan-900/20 p-3 rounded max-h-60 overflow-auto border border-cyan-800/30">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {log.source && (
                            <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-4">
                              <span><span className="text-gray-400">Quelle:</span> {log.source}</span>
                              {log.request_id && (
                                <span><span className="text-gray-400">Anfrage-ID:</span> {log.request_id}</span>
                              )}
                              {log.duration && (
                                <span><span className="text-gray-400">Dauer:</span> {log.duration}ms</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                      <Terminal className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg">Keine Konsolenprotokolle gefunden</p>
                      <p className="text-sm mt-2">Protokolle erscheinen hier, während das System arbeitet</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}