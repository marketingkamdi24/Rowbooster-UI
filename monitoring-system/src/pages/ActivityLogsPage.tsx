import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Search, Filter, Download, Package,
  Activity, Users, Clock, ChevronDown, Calendar, Zap, FileText
} from 'lucide-react';
import { ExpandableActivityCard } from '@/components/ExpandableActivityCard';
import { authFetch } from '@/lib/api';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const activityTypes = [
    'all',
    'search',
    'batch_search',
    'custom_search',
    'extraction',
    'login',
    'logout',
    'api_call',
    'error',
    'upload'
  ];

  const fetchLogs = async () => {
    try {
      let url = '/api/activity?limit=200';
      
      if (filterType !== 'all') {
        url += `&activity_type=${filterType}`;
      }
      
      if (startDate) {
        url += `&start_date=${startDate}`;
      }
      
      if (endDate) {
        url += `&end_date=${endDate}`;
      }
        
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
    
    return () => {
      clearInterval(interval);
    };
  }, [filterType, startDate, endDate]);

  const filteredLogs = logs.filter(log => 
    log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.endpoint?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'badge-critical';
      case 'login':
      case 'logout':
        return 'badge-info';
      case 'api_call':
        return 'badge-normal';
      default:
        return 'badge-info';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">LADE AKTIVITÄTSPROTOKOLLE...</div>
      </div>
    );
  }

  // Count search-related activities
  const searchActivities = logs.filter(l =>
    l.activity_type?.includes('search') ||
    l.activity_type?.includes('batch') ||
    l.activity_type?.includes('extraction')
  );

  return (
    <>
        {/* Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">GESAMT</div>
              <Activity className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold neon-cyan">
              {logs.length.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">BENUTZER</div>
              <Users className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold neon-cyan">
              {new Set(logs.map(l => l.username)).size}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-green">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">SUCHEN</div>
              <Search className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-400">
              {searchActivities.length.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">BATCHES</div>
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold neon-cyan">
              {logs.filter(l => l.activity_type?.includes('batch')).length.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">MANUELL</div>
              <FileText className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold neon-cyan">
              {logs.filter(l => l.activity_type?.includes('custom_search')).length.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-red">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">FEHLER</div>
              <Filter className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold neon-red">
              {logs.filter(l => !l.success || l.activity_type === 'error').length}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-yellow-400" />
            <Input
              type="text"
              placeholder="PROTOKOLLE SUCHEN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 text-base sm:text-lg"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-xs sm:text-sm"
            >
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">FILTERN</span>
              <ChevronDown className={`h-4 w-4 ml-1 sm:ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 text-xs sm:text-sm"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">EXPORTIEREN</span>
            </Button>

            <div className="text-xs sm:text-sm text-cyan-400 ml-auto">
              {filteredLogs.length} EINTRÄGE
            </div>
          </div>

          {showFilters && (
            <div className="cyber-panel p-3 sm:p-4 rounded space-y-4">
              <div>
                <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-2">AKTIVITÄTSTYP</div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {activityTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded font-bold tracking-wide transition text-xs sm:text-sm ${
                        filterType === type
                          ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                          : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 hover:border-cyan-500/60'
                      }`}
                    >
                      {type.toUpperCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  DATUMSBEREICH
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-cyan-400 text-xs mb-1 block">VON DATUM</label>
                    <Input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-black/50 border-yellow-500/30 text-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-cyan-400 text-xs mb-1 block">BIS DATUM</label>
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
                    className="mt-2 text-xs glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                  >
                    DATEN LÖSCHEN
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Activity Logs */}
        <div className="cyber-panel p-4 sm:p-6 rounded">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">AKTIVITÄTS-STREAM</h2>
              <div className="flex items-center gap-2">
                <div className="status-online"></div>
                <span className="text-green-400 text-xs sm:text-sm">LIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Ansicht:</span>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  viewMode === 'cards'
                    ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                    : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400'
                }`}
              >
                <Package className="h-3 w-3 inline mr-1" />
                KARTEN
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                    : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400'
                }`}
              >
                <Activity className="h-3 w-3 inline mr-1" />
                TABELLE
              </button>
            </div>
          </div>

          {/* Card View with Expandable Search Activities */}
          {viewMode === 'cards' && (
            <div className="space-y-3">
              {filteredLogs.slice(0, 100).map((log) => (
                <ExpandableActivityCard key={log.id} log={log} />
              ))}
              {filteredLogs.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  Keine Aktivitätslogs gefunden
                </div>
              )}
              {filteredLogs.length > 100 && (
                <div className="text-center text-sm text-gray-500 py-2">
                  Zeige die letzten 100 von {filteredLogs.length} Aktivitäten
                </div>
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="responsive-table-wrapper">
              <div className="responsive-table-inner">
                <div className="cyber-table rounded overflow-hidden min-w-[900px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-yellow-500/30">
                        <TableHead className="text-yellow-400 font-bold">ID</TableHead>
                        <TableHead className="text-yellow-400 font-bold">BENUTZER</TableHead>
                        <TableHead className="text-yellow-400 font-bold">TYP</TableHead>
                        <TableHead className="text-yellow-400 font-bold">AKTION</TableHead>
                        <TableHead className="text-yellow-400 font-bold">ENDPUNKT</TableHead>
                        <TableHead className="text-yellow-400 font-bold">METHODE</TableHead>
                        <TableHead className="text-yellow-400 font-bold">STATUS</TableHead>
                        <TableHead className="text-yellow-400 font-bold">DAUER</TableHead>
                        <TableHead className="text-yellow-400 font-bold">IP</TableHead>
                        <TableHead className="text-yellow-400 font-bold">ZEIT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} className="border-yellow-500/10">
                          <TableCell className="text-gray-400 font-mono text-xs">
                            #{log.id}
                          </TableCell>
                          <TableCell className="font-bold text-cyan-400">
                            {log.username}
                          </TableCell>
                          <TableCell>
                            <span className={`${getTypeBadgeClass(log.activity_type)} px-2 py-1 rounded text-xs font-bold`}>
                              {log.activity_type?.replace(/_/g, ' ').replace(/:/g, ' - ').toUpperCase().substring(0, 30)}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-300 text-sm max-w-xs truncate">
                            {log.action}
                          </TableCell>
                          <TableCell className="text-cyan-400/60 text-xs font-mono max-w-[150px] truncate">
                            {log.endpoint || '-'}
                          </TableCell>
                          <TableCell>
                            {log.method && (
                              <span className="badge-info px-2 py-1 rounded text-xs font-bold">
                                {log.method}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.status_code ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                log.status_code < 300 ? 'text-green-400' :
                                log.status_code < 400 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {log.status_code}
                              </span>
                            ) : log.success !== undefined ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                log.success ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {log.success ? 'OK' : 'FAIL'}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-cyan-400 text-sm">
                            {log.duration ? `${log.duration}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs font-mono">
                            {log.ip_address || '-'}
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {new Date(log.timestamp).toLocaleTimeString('de-DE')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
    </>
  );
}