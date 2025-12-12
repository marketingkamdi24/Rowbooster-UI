import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Search, Filter, Download,
  AlertTriangle, CheckCircle, ChevronDown,
  XCircle, Info, AlertOctagon, Calendar
} from 'lucide-react';
import { authFetch } from '@/lib/api';

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const severityLevels = ['all', 'info', 'warning', 'error', 'critical'];

  const fetchLogs = async () => {
    try {
      let url = '/api/errors?limit=200';
      
      if (filterSeverity !== 'all') {
        url += `&severity=${filterSeverity}`;
      }
      
      if (filterResolved !== 'all') {
        url += `&resolved=${filterResolved}`;
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
      console.error('Failed to fetch error logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const markResolved = async (errorId: number) => {
    try {
      const response = await authFetch(`/api/errors/${errorId}/resolve`, {
        method: 'PATCH',
      });
      if (response.ok) {
        fetchLogs();
      }
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000); // Refresh every 15s
    
    return () => {
      clearInterval(interval);
    };
  }, [filterSeverity, filterResolved, startDate, endDate]);

  const filteredLogs = logs.filter(log =>
    log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.error_message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.error_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.endpoint?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'badge-critical';
      case 'error':
        return 'badge-high';
      case 'warning':
        return 'badge-info';
      case 'info':
        return 'badge-normal';
      default:
        return 'badge-info';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">LADE FEHLERPROTOKOLLE...</div>
      </div>
    );
  }

  return (
    <>
        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-red">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">TOTAL</div>
              <AlertOctagon className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-xl sm:text-3xl font-bold neon-red">
              {logs.length.toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-red">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">CRITICAL</div>
              <AlertOctagon className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-xl sm:text-3xl font-bold neon-red">
              {logs.filter(l => l.severity === 'critical').length}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">UNGELÖST</div>
              <XCircle className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-xl sm:text-3xl font-bold neon-cyan">
              {logs.filter(l => !l.resolved).length}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">GELÖST</div>
              <CheckCircle className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-3xl font-bold neon-cyan">
              {logs.filter(l => l.resolved).length}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-yellow-400" />
            <Input
              type="text"
              placeholder="FEHLER SUCHEN..."
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
              className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
            >
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">FILTER</span>
              <ChevronDown className={`h-4 w-4 ml-1 sm:ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">EXPORTIEREN</span>
            </Button>

            <div className="text-xs sm:text-sm text-cyan-400 ml-auto">
              {filteredLogs.length} <span className="hidden sm:inline">FEHLER</span>
            </div>
          </div>

          {showFilters && (
            <div className="cyber-panel p-3 sm:p-4 rounded space-y-3 sm:space-y-4">
              <div>
                <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-2">SCHWEREGRAD</div>
                <div className="flex flex-wrap gap-2">
                  {severityLevels.map(level => (
                    <button
                      key={level}
                      onClick={() => setFilterSeverity(level)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded font-bold tracking-wide transition text-xs sm:text-sm ${
                        filterSeverity === level
                          ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                          : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 hover:border-cyan-500/60'
                      }`}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-2">STATUS</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterResolved('all')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded font-bold tracking-wide transition text-xs sm:text-sm ${
                      filterResolved === 'all'
                        ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                        : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 hover:border-cyan-500/60'
                    }`}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => setFilterResolved('false')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded font-bold tracking-wide transition text-xs sm:text-sm ${
                      filterResolved === 'false'
                        ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                        : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 hover:border-cyan-500/60'
                    }`}
                  >
                    UNRESOLVED
                  </button>
                  <button
                    onClick={() => setFilterResolved('true')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded font-bold tracking-wide transition text-xs sm:text-sm ${
                      filterResolved === 'true'
                        ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                        : 'border border-cyan-500/30 text-cyan-400/60 hover:text-cyan-400 hover:border-cyan-500/60'
                    }`}
                  >
                    RESOLVED
                  </button>
                </div>
              </div>

              <div>
                <div className="text-yellow-400 text-xs sm:text-sm font-bold mb-2 flex items-center gap-2">
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
                    className="mt-2 text-xs glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                  >
                    DATEN LÖSCHEN
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Logs */}
        <div className="cyber-panel p-3 sm:p-6 rounded">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">FEHLERPROTOKOLL-STREAM</h2>
            <div className="flex items-center gap-2">
              <div className={logs.filter(l => !l.resolved && l.severity === 'critical').length > 0 ? 'status-offline' : 'status-online'}></div>
              <span className={`text-xs sm:text-sm ${logs.filter(l => !l.resolved && l.severity === 'critical').length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {logs.filter(l => !l.resolved && l.severity === 'critical').length > 0 ? 'CRITICAL' : 'STABLE'}
              </span>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredLogs.slice(0, 30).map((log) => (
              <div key={log.id} className={`bg-black/40 rounded p-3 border ${
                log.severity === 'critical' && !log.resolved ? 'border-red-500/30' : 'border-yellow-500/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(log.severity)}
                    <span className={`${getSeverityBadgeClass(log.severity)} px-2 py-0.5 rounded text-[10px] font-bold`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </div>
                  {log.resolved ? (
                    <span className="badge-normal px-2 py-0.5 rounded text-[10px] font-bold">GELÖST</span>
                  ) : (
                    <span className="badge-critical px-2 py-0.5 rounded text-[10px] font-bold">OFFEN</span>
                  )}
                </div>
                <p className="text-xs text-red-400 mb-1 line-clamp-2">{log.error_message}</p>
                <p className="text-[10px] text-cyan-400 mb-2">{log.error_type}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">{log.username || 'SYSTEM'}</span>
                  <span className="text-gray-500">{new Date(log.timestamp).toLocaleString('de-DE')}</span>
                </div>
                {!log.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markResolved(log.id)}
                    className="mt-2 w-full glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-xs h-8"
                  >
                    LÖSEN
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block responsive-table-wrapper">
            <div className="responsive-table-inner">
              <div className="cyber-table rounded overflow-hidden min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow className="border-yellow-500/30">
                  <TableHead className="text-yellow-400 font-bold">ID</TableHead>
                  <TableHead className="text-yellow-400 font-bold">SEVERITY</TableHead>
                  <TableHead className="text-yellow-400 font-bold">TYP</TableHead>
                  <TableHead className="text-yellow-400 font-bold">BENUTZER</TableHead>
                  <TableHead className="text-yellow-400 font-bold">NACHRICHT</TableHead>
                  <TableHead className="text-yellow-400 font-bold">ENDPUNKT</TableHead>
                  <TableHead className="text-yellow-400 font-bold">STATUS</TableHead>
                  <TableHead className="text-yellow-400 font-bold">ZEITSTEMPEL</TableHead>
                  <TableHead className="text-yellow-400 font-bold">AKTIONEN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className={`border-yellow-500/10 ${
                    log.severity === 'critical' && !log.resolved ? 'bg-red-500/5' : ''
                  }`}>
                    <TableCell className="text-gray-400 font-mono text-xs">
                      #{log.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(log.severity)}
                        <span className={`${getSeverityBadgeClass(log.severity)} px-2 py-1 rounded text-xs font-bold`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-cyan-400 text-sm">
                      {log.error_type}
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">
                      {log.username || 'SYSTEM'}
                    </TableCell>
                    <TableCell className="text-red-400 text-sm max-w-md truncate">
                      {log.error_message}
                    </TableCell>
                    <TableCell className="text-cyan-400/60 text-xs font-mono">
                      {log.endpoint || '-'}
                    </TableCell>
                    <TableCell>
                      {log.resolved ? (
                        <span className="badge-normal px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          GELÖST
                        </span>
                      ) : (
                        <span className="badge-critical px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          OFFEN
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs">
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell>
                      {!log.resolved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markResolved(log.id)}
                          className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                        >
                          LÖSEN
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}