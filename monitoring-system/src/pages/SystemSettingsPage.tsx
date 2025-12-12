import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Database, HardDrive,
  Shield, CheckCircle, XCircle, AlertTriangle, Download, Trash2,
  Play, Clock, Archive, FileText,
  Loader2, ChevronRight, Eye, X, ChevronDown, ChevronUp, Key, Link as LinkIcon,
  RotateCcw, Calendar, Power, ChevronLeft, ExternalLink
} from 'lucide-react';
import { authFetch } from '@/lib/api';

interface Backup {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  compressed: boolean;
  timestamp?: string;
  isComplete?: boolean;
  tableCount?: number;
  totalRows?: number;
}

interface BackupData {
  backups: Backup[];
  totalBackups: number;
  totalSize: number;
  totalSizeFormatted: string;
  config: {
    backupDir: string;
    retentionDays: number;
    autoBackupEnabled: boolean;
    lastBackup: string | null;
  };
}

interface BackupSchedule {
  enabled: boolean;
  time: string;
  retentionDays: number;
  lastAutoBackup: string | null;
}

interface TableInfo {
  tablename: string;
  size: string;
  size_bytes: number;
  rowCount: number;
}

interface IntegrityData {
  database: {
    size: string;
    sizeBytes: number;
    active_connections: number;
    transactions_committed: number;
    transactions_rolled_back: number;
  };
  tables: TableInfo[];
  foreignKeys: any[];
  indexes: any[];
  integrityIssues: any[];
  status: string;
}

interface ValidationResult {
  check: string;
  passed: boolean;
  issues: number;
}

interface MigrationInfo {
  name: string;
  status: string;
  details: string;
}

interface BackupPreview {
  filename: string;
  preview: string;
  totalLines?: number;
  previewLines?: number;
  truncated?: boolean;
  metadata?: {
    timestampISO: string;
    tables: { name: string; rowCount: number }[];
    totalRows: number;
    backupType: string;
  };
  tablesSummary?: { name: string; rowCount: number }[];
  isComplete?: boolean;
  backupDate?: string;
  totalRows?: number;
  tableCount?: number;
}

interface TableColumn {
  name: string;
  type: string;
}

interface TableData {
  tableName: string;
  columns: TableColumn[];
  rows: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  sorting: {
    sortBy: string;
    sortOrder: string;
  };
}

interface RestoreConfirmation {
  filename: string;
  show: boolean;
}

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<'backups' | 'integrity' | 'migrations'>('backups');
  
  // Backup state
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [backupLoading, setBackupLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Backup schedule state
  const [backupSchedule, setBackupSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [scheduleRetention, setScheduleRetention] = useState(30);
  
  // Restore state
  const [restoreConfirmation, setRestoreConfirmation] = useState<RestoreConfirmation | null>(null);
  const [restoring, setRestoring] = useState(false);
  
  // Integrity state
  const [integrityData, setIntegrityData] = useState<IntegrityData | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(true);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [showForeignKeys, setShowForeignKeys] = useState(false);
  const [showIndexes, setShowIndexes] = useState(false);
  
  // Table data viewer state
  const [tableDataModal, setTableDataModal] = useState<TableData | null>(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const [_currentPage, setCurrentPage] = useState(1);
  
  // Migration state
  const [migrations, setMigrations] = useState<MigrationInfo[]>([]);
  const [migrationsLoading, setMigrationsLoading] = useState(true);
  const [runningMigrations, setRunningMigrations] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchBackups();
    fetchIntegrity();
    fetchMigrations();
    fetchBackupSchedule();
  }, []);

  const fetchBackups = async () => {
    try {
      const response = await authFetch('/api/system/backups');
      if (response.ok) {
        const data = await response.json();
        setBackupData(data);
        if (data.config?.retentionDays) {
          setRetentionDays(data.config.retentionDays);
        }
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchIntegrity = async () => {
    try {
      const response = await authFetch('/api/system/integrity');
      if (response.ok) {
        const data = await response.json();
        setIntegrityData(data);
      }
    } catch (error) {
      console.error('Failed to fetch integrity:', error);
    } finally {
      setIntegrityLoading(false);
    }
  };

  const fetchMigrations = async () => {
    try {
      const response = await authFetch('/api/system/migrations');
      if (response.ok) {
        const data = await response.json();
        setMigrations(data.migrations || []);
      }
    } catch (error) {
      console.error('Failed to fetch migrations:', error);
    } finally {
      setMigrationsLoading(false);
    }
  };

  const fetchBackupSchedule = async () => {
    try {
      const response = await authFetch('/api/system/backup-schedule');
      if (response.ok) {
        const data = await response.json();
        setBackupSchedule(data);
        setScheduleEnabled(data.enabled);
        setScheduleTime(data.time || '02:00');
        setScheduleRetention(data.retentionDays || 30);
      }
    } catch (error) {
      console.error('Failed to fetch backup schedule:', error);
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveBackupSchedule = async () => {
    setSavingSchedule(true);
    try {
      const response = await authFetch('/api/system/backup-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: scheduleEnabled,
          time: scheduleTime,
          retentionDays: scheduleRetention,
        }),
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Zeitplan gespeichert',
          description: `Automatische Sicherungen ${scheduleEnabled ? 'aktiviert' : 'deaktiviert'} um ${scheduleTime}`,
        });
        fetchBackupSchedule();
      } else {
        toast({
          title: 'Speichern fehlgeschlagen',
          description: data.message || 'Zeitplan konnte nicht gespeichert werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Sicherungszeitplan konnte nicht gespeichert werden',
        variant: 'destructive',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const response = await authFetch('/api/system/backups', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Sicherung erstellt',
          description: `${data.backup?.filename || 'Sicherung'} erfolgreich erstellt`,
        });
        fetchBackups();
      } else {
        toast({
          title: 'Sicherung fehlgeschlagen',
          description: data.message || 'Sicherung konnte nicht erstellt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Sicherung konnte nicht erstellt werden',
        variant: 'destructive',
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Möchten Sie die Sicherung "${filename}" wirklich löschen?`)) return;
    
    try {
      const response = await authFetch(`/api/system/backups/${filename}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast({
          title: 'Sicherung gelöscht',
          description: `${filename} erfolgreich gelöscht`,
        });
        fetchBackups();
      } else {
        const data = await response.json();
        toast({
          title: 'Löschen fehlgeschlagen',
          description: data.message || 'Sicherung konnte nicht gelöscht werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Sicherung konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    }
  };

  const cleanupBackups = async () => {
    if (!confirm(`Sicherungen älter als ${retentionDays} Tage löschen?`)) return;
    
    setCleaningUp(true);
    try {
      const response = await authFetch('/api/system/backups/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays }),
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Bereinigung abgeschlossen',
          description: `${data.deletedCount} alte Sicherungen gelöscht (${data.deletedSizeFormatted})`,
        });
        fetchBackups();
      } else {
        toast({
          title: 'Bereinigung fehlgeschlagen',
          description: data.message || 'Sicherungen konnten nicht bereinigt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Sicherungen konnten nicht bereinigt werden',
        variant: 'destructive',
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const runValidation = async () => {
    setValidating(true);
    try {
      const response = await authFetch('/api/system/integrity/validate', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        setValidationResults(data.results);
        toast({
          title: data.status === 'passed' ? 'Validierung bestanden' : 'Validierungsprobleme gefunden',
          description: `${data.passedChecks}/${data.totalChecks} Prüfungen bestanden`,
          variant: data.status === 'passed' ? 'default' : 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Validierung konnte nicht ausgeführt werden',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  const runMigrations = async () => {
    if (!confirm('Alle ausstehenden Migrationen ausführen? Dies wird Ihr Datenbankschema ändern.')) return;
    
    setRunningMigrations(true);
    try {
      const response = await authFetch('/api/system/migrations/run', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Migrationen abgeschlossen',
          description: `${data.results?.length || 0} Migrationen angewendet`,
        });
        fetchMigrations();
        fetchIntegrity();
      } else {
        toast({
          title: 'Migration fehlgeschlagen',
          description: data.message || 'Migrationen konnten nicht ausgeführt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Migrationen konnten nicht ausgeführt werden',
        variant: 'destructive',
      });
    } finally {
      setRunningMigrations(false);
    }
  };

  const viewBackupPreview = async (filename: string) => {
    setLoadingPreview(true);
    try {
      const response = await authFetch(`/api/system/backups/${filename}/preview`);
      if (response.ok) {
        const data = await response.json();
        setBackupPreview(data);
      } else {
        toast({
          title: 'Vorschau fehlgeschlagen',
          description: 'Sicherungsvorschau konnte nicht geladen werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Sicherungsvorschau konnte nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const downloadBackup = (filename: string) => {
    window.open(`/api/system/backups/${filename}/download`, '_blank');
  };

  const showRestoreConfirmation = (filename: string) => {
    setRestoreConfirmation({ filename, show: true });
  };

  const restoreBackup = async () => {
    if (!restoreConfirmation) return;
    
    setRestoring(true);
    try {
      const response = await authFetch(`/api/system/backups/${restoreConfirmation.filename}/restore`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Datenbank wiederhergestellt',
          description: `Wiederhergestellt aus ${restoreConfirmation.filename}. Sicherheitskopie: ${data.safetyBackup}`,
        });
        setRestoreConfirmation(null);
        fetchBackups();
        fetchIntegrity();
      } else {
        toast({
          title: 'Wiederherstellung fehlgeschlagen',
          description: data.message || 'Datenbank konnte nicht wiederhergestellt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Datenbank konnte nicht wiederhergestellt werden',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const fetchTableData = async (tableName: string, page: number = 1) => {
    setTableDataLoading(true);
    try {
      const response = await authFetch(`/api/system/tables/${tableName}/data?page=${page}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setTableDataModal(data);
        setCurrentPage(page);
      } else {
        toast({
          title: 'Laden fehlgeschlagen',
          description: 'Tabellendaten konnten nicht geladen werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Tabellendaten konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setTableDataLoading(false);
    }
  };

  const toggleTableExpand = (tableName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-orange-400" />;
      default:
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  return (
    <>
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 sm:gap-4 mb-4 sm:mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Button
            variant={activeTab === 'backups' ? 'default' : 'outline'}
            onClick={() => setActiveTab('backups')}
            size="sm"
            className={`flex-shrink-0 ${activeTab === 'backups'
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10'}`}
          >
            <Archive className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">SICHERUNGEN</span>
          </Button>
          <Button
            variant={activeTab === 'integrity' ? 'default' : 'outline'}
            onClick={() => setActiveTab('integrity')}
            size="sm"
            className={`flex-shrink-0 ${activeTab === 'integrity'
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10'}`}
          >
            <Shield className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">INTEGRITÄT</span>
          </Button>
          <Button
            variant={activeTab === 'migrations' ? 'default' : 'outline'}
            onClick={() => setActiveTab('migrations')}
            size="sm"
            className={`flex-shrink-0 ${activeTab === 'migrations'
              ? 'bg-yellow-500 text-black hover:bg-yellow-400'
              : 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10'}`}
          >
            <Database className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">MIGRATIONEN</span>
          </Button>
        </div>

        {/* Backups Tab */}
        {activeTab === 'backups' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Backup Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">SICHERUNGEN</span>
                  <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-3xl font-bold neon-cyan">
                  {backupData?.totalBackups || 0}
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">GRÖSSE</span>
                  <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-lg sm:text-3xl font-bold neon-cyan">
                  {backupData?.totalSizeFormatted || '0 Bytes'}
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">AUFBEWAHRUNG</span>
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-3xl font-bold neon-cyan">
                  {backupData?.config?.retentionDays || 30}T
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">LETZTE</span>
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                </div>
                <div className="text-sm sm:text-lg font-bold neon-cyan">
                  {backupData?.config?.lastBackup
                    ? new Date(backupData.config.lastBackup).toLocaleDateString('de-DE')
                    : 'Nie'}
                </div>
              </div>
            </div>

            {/* Backup Schedule Configuration */}
            <div className="cyber-panel p-3 sm:p-6 rounded">
              <h2 className="text-base sm:text-xl font-bold neon-yellow tracking-wide mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                AUTOMATISCHE SICHERUNG
              </h2>
              
              {scheduleLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-cyan-400">Status</label>
                    <Button
                      variant={scheduleEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScheduleEnabled(!scheduleEnabled)}
                      className={`w-full ${scheduleEnabled
                        ? 'bg-green-500 text-black hover:bg-green-400'
                        : 'border-gray-500 text-gray-400 hover:bg-gray-500/10'}`}
                    >
                      <Power className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">{scheduleEnabled ? 'AN' : 'AUS'}</span>
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-cyan-400">Uhrzeit</label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="bg-black/50 border-cyan-500/50 text-cyan-400"
                      disabled={!scheduleEnabled}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-cyan-400">Behalten (Tage)</label>
                    <Input
                      type="number"
                      value={scheduleRetention}
                      onChange={(e) => setScheduleRetention(parseInt(e.target.value) || 30)}
                      className="bg-black/50 border-cyan-500/50 text-cyan-400"
                      min={1}
                      max={365}
                      disabled={!scheduleEnabled}
                    />
                  </div>
                  
                  <Button
                    onClick={saveBackupSchedule}
                    disabled={savingSchedule}
                    className="bg-cyan-500 text-black hover:bg-cyan-400 col-span-2 sm:col-span-1"
                  >
                    {savingSchedule ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 sm:mr-2" />}
                    <span className="hidden sm:inline">SPEICHERN</span>
                  </Button>
                </div>
              )}
              
              {backupSchedule?.lastAutoBackup && (
                <p className="text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">
                  Letzte Auto-Sicherung: {new Date(backupSchedule.lastAutoBackup).toLocaleString('de-DE')}
                </p>
              )}
            </div>

            {/* Backup Actions */}
            <div className="cyber-panel p-3 sm:p-6 rounded">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                <h2 className="text-base sm:text-xl font-bold neon-yellow tracking-wide">SICHERUNGSVERWALTUNG</h2>
                <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
                      className="w-16 sm:w-20 bg-black/50 border-cyan-500/50 text-cyan-400 text-sm"
                      min={1}
                      max={365}
                    />
                    <span className="text-xs sm:text-sm text-cyan-400">Tage</span>
                  </div>
                  <Button
                    onClick={cleanupBackups}
                    disabled={cleaningUp}
                    variant="outline"
                    size="sm"
                    className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                  >
                    {cleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={createBackup}
                    disabled={creatingBackup}
                    size="sm"
                    className="bg-cyan-500 text-black hover:bg-cyan-400"
                  >
                    {creatingBackup ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Download className="h-4 w-4 sm:mr-2" />}
                    <span className="hidden sm:inline">SICHERN</span>
                  </Button>
                </div>
              </div>

              {backupLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <div className="cyber-table rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-yellow-500/30">
                        <TableHead className="text-yellow-400 font-bold">DATEINAME</TableHead>
                        <TableHead className="text-yellow-400 font-bold">GRÖSSE</TableHead>
                        <TableHead className="text-yellow-400 font-bold">ERSTELLT</TableHead>
                        <TableHead className="text-yellow-400 font-bold">TYP</TableHead>
                        <TableHead className="text-yellow-400 font-bold hidden md:table-cell">DATEN</TableHead>
                        <TableHead className="text-yellow-400 font-bold">AKTIONEN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupData?.backups && backupData.backups.length > 0 ? (
                        backupData.backups.map((backup) => (
                          <TableRow key={backup.filename} className="border-yellow-500/10">
                            <TableCell className="font-mono text-cyan-400">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="truncate max-w-[200px]">{backup.filename}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-300">{backup.sizeFormatted}</TableCell>
                            <TableCell className="text-gray-300">
                              {new Date(backup.createdAt).toLocaleString('de-DE')}
                            </TableCell>
                            <TableCell>
                              {backup.isComplete ? (
                                <span className="px-2 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  VOLLSTÄNDIG
                                </span>
                              ) : backup.compressed ? (
                                <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400">
                                  KOMPRIMIERT
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-400">
                                  SQL
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-300 hidden md:table-cell">
                              {backup.isComplete ? (
                                <div className="text-xs">
                                  <span className="text-cyan-400">{backup.tableCount || 0}</span> Tabellen,{' '}
                                  <span className="text-cyan-400">{(backup.totalRows || 0).toLocaleString()}</span> Zeilen
                                </div>
                              ) : (
                                <span className="text-gray-500 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 sm:gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewBackupPreview(backup.filename)}
                                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                  title="Vorschau"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => showRestoreConfirmation(backup.filename)}
                                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                  title="Zu diesem Punkt wiederherstellen"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadBackup(backup.filename)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  title="Herunterladen"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteBackup(backup.filename)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  title="Löschen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                            Keine Sicherungen gefunden. Erstellen Sie Ihre erste Sicherung!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Backup Preview Modal - Enhanced for complete backups */}
            {backupPreview && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="cyber-panel p-3 sm:p-6 rounded w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold neon-yellow flex items-center gap-2">
                        {backupPreview.filename}
                        {backupPreview.isComplete && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">
                            VOLLSTÄNDIG
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-cyan-400/60">
                        {backupPreview.isComplete ? (
                          <>
                            {backupPreview.backupDate && (
                              <span>Sicherung vom: {new Date(backupPreview.backupDate).toLocaleString('de-DE')} • </span>
                            )}
                            <span className="text-cyan-400">{backupPreview.tableCount}</span> Tabellen,{' '}
                            <span className="text-cyan-400">{(backupPreview.totalRows || 0).toLocaleString()}</span> Zeilen
                          </>
                        ) : (
                          <>
                            Zeilen: {backupPreview.previewLines} / {backupPreview.totalLines}
                            {backupPreview.truncated && ' (gekürzt)'}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadBackup(backupPreview.filename)}
                        className="border-green-500 text-green-400 hover:bg-green-500/10"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        HERUNTERLADEN
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBackupPreview(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tables Summary for complete backups */}
                  {backupPreview.isComplete && backupPreview.tablesSummary && backupPreview.tablesSummary.length > 0 && (
                    <div className="mb-4 p-3 bg-black/30 rounded border border-cyan-500/30">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">TABELLEN IN DER SICHERUNG</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                        {backupPreview.tablesSummary.map((table) => (
                          <div key={table.name} className="text-xs bg-black/30 px-2 py-1 rounded flex justify-between">
                            <span className="text-cyan-400 truncate">{table.name}</span>
                            <span className="text-gray-400 ml-2">{table.rowCount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 overflow-auto bg-black/50 rounded p-4 font-mono text-xs">
                    <pre className="text-cyan-400 whitespace-pre-wrap">{backupPreview.preview}</pre>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Preview Overlay */}
            {loadingPreview && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
                  <p className="text-cyan-400">Vorschau wird geladen...</p>
                </div>
              </div>
            )}

            {/* Restore Confirmation Modal - Enhanced with complete backup info */}
            {restoreConfirmation && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="cyber-panel p-4 sm:p-6 rounded w-full max-w-md">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="h-8 w-8 text-yellow-400" />
                    <h3 className="text-xl font-bold text-yellow-400">DATENBANK WIEDERHERSTELLEN?</h3>
                  </div>
                  
                  <div className="mb-6 space-y-3">
                    <p className="text-gray-300">
                      Sie sind dabei, die Datenbank auf diesen Sicherungsstand zurückzusetzen:
                    </p>
                    <div className="font-mono text-cyan-400 bg-black/50 p-3 rounded">
                      <div className="text-sm mb-1">{restoreConfirmation.filename}</div>
                      {restoreConfirmation.filename.endsWith('.json') && (
                        <div className="text-xs text-cyan-400/60 mt-2 border-t border-cyan-500/20 pt-2">
                          <CheckCircle className="h-3 w-3 inline mr-1 text-green-400" />
                          Vollständige Sicherung - ALLE Daten werden wiederhergestellt
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                      <p className="text-red-400 text-sm font-bold mb-1">⚠️ KRITISCHE WARNUNG</p>
                      <p className="text-gray-300 text-sm">
                        Dies wird alle aktuellen Datenbankdaten <strong className="text-red-400">VOLLSTÄNDIG ERSETZEN</strong> mit den Sicherungsdaten.
                      </p>
                      <ul className="text-gray-400 text-xs mt-2 list-disc list-inside space-y-1">
                        <li>Alle nach dieser Sicherung hinzugefügten Benutzer werden entfernt</li>
                        <li>Alle Aktivitätsprotokolle nach dieser Sicherung werden gelöscht</li>
                        <li>Alle nach dieser Sicherung vorgenommenen Änderungen gehen verloren</li>
                        <li>Eine Sicherheitskopie wird vor der Wiederherstellung erstellt</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                      <p className="text-green-400 text-sm font-bold mb-1">✓ SICHERHEITSKOPIE</p>
                      <p className="text-gray-300 text-sm">
                        Eine vollständige Sicherung des aktuellen Zustands wird automatisch vor der Wiederherstellung erstellt.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setRestoreConfirmation(null)}
                      disabled={restoring}
                      className="border-gray-500 text-gray-400 hover:bg-gray-500/10"
                    >
                      ABBRECHEN
                    </Button>
                    <Button
                      onClick={restoreBackup}
                      disabled={restoring}
                      className="bg-red-500 text-white hover:bg-red-400"
                    >
                      {restoring ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          WIEDERHERSTELLUNG...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          JETZT WIEDERHERSTELLEN
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Integrity Tab */}
        {activeTab === 'integrity' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Database Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">DB-GRÖSSE</span>
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-lg sm:text-3xl font-bold neon-cyan">
                  {integrityData?.database?.size || '0 MB'}
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">TABELLEN</span>
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-3xl font-bold neon-cyan">
                  {integrityData?.tables?.length || 0}
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">FK</span>
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-3xl font-bold neon-cyan">
                  {integrityData?.foreignKeys?.length || 0}
                </div>
              </div>
              <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] sm:text-xs font-bold">STATUS</span>
                  {integrityData?.status === 'healthy'
                    ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                    : <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />}
                </div>
                <div className={`text-lg sm:text-2xl font-bold ${
                  integrityData?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {integrityData?.status === 'healthy' ? 'OK' : 'WARNUNG'}
                </div>
              </div>
            </div>

            {/* Validation */}
            <div className="cyber-panel p-3 sm:p-6 rounded">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-xl font-bold neon-yellow tracking-wide">VALIDIERUNG</h2>
                  <p className="text-xs sm:text-sm text-cyan-400/60 mt-1">Datenintegrität überprüfen</p>
                </div>
                <Button
                  onClick={runValidation}
                  disabled={validating}
                  size="sm"
                  className="bg-cyan-500 text-black hover:bg-cyan-400"
                >
                  {validating ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Play className="h-4 w-4 sm:mr-2" />}
                  <span className="hidden sm:inline">AUSFÜHREN</span>
                </Button>
              </div>

              {validationResults && (
                <div className="cyber-table rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-yellow-500/30">
                        <TableHead className="text-yellow-400 font-bold">PRÜFUNG</TableHead>
                        <TableHead className="text-yellow-400 font-bold">STATUS</TableHead>
                        <TableHead className="text-yellow-400 font-bold">PROBLEME</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.map((result, index) => (
                        <TableRow key={index} className="border-yellow-500/10">
                          <TableCell className="font-mono text-cyan-400">{result.check}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {result.passed
                                ? <CheckCircle className="h-4 w-4 text-green-400" />
                                : <XCircle className="h-4 w-4 text-red-400" />}
                              <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                                {result.passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={result.issues > 0 ? 'text-red-400' : 'text-gray-400'}>
                            {result.issues}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Tables Overview */}
            <div className="cyber-panel p-6 rounded">
              <h2 className="text-xl font-bold neon-yellow tracking-wide mb-4">TABELLENÜBERSICHT</h2>
              
              {integrityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <div className="cyber-table rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-yellow-500/30">
                        <TableHead className="text-yellow-400 font-bold w-8"></TableHead>
                        <TableHead className="text-yellow-400 font-bold">TABELLE</TableHead>
                        <TableHead className="text-yellow-400 font-bold">ZEILEN</TableHead>
                        <TableHead className="text-yellow-400 font-bold">GRÖSSE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrityData?.tables?.map((table) => (
                        <>
                          <TableRow
                            key={table.tablename}
                            className="border-yellow-500/10 cursor-pointer hover:bg-cyan-500/5"
                          >
                            <TableCell onClick={() => toggleTableExpand(table.tablename)}>
                              {expandedTables.has(table.tablename)
                                ? <ChevronDown className="h-4 w-4 text-cyan-400" />
                                : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            </TableCell>
                            <TableCell
                              className="font-mono text-cyan-400"
                              onClick={() => toggleTableExpand(table.tablename)}
                            >
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                {table.tablename}
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-gray-300"
                              onClick={() => toggleTableExpand(table.tablename)}
                            >
                              {table.rowCount?.toLocaleString() || 0}
                            </TableCell>
                            <TableCell className="text-gray-300 flex items-center justify-between">
                              <span onClick={() => toggleTableExpand(table.tablename)}>{table.size}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchTableData(table.tablename);
                                }}
                                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 ml-2"
                                title="Daten anzeigen"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedTables.has(table.tablename) && (
                            <TableRow key={`${table.tablename}-details`} className="bg-black/30">
                              <TableCell colSpan={4} className="p-4">
                                <div className="space-y-3">
                                  {/* Related Foreign Keys */}
                                  {integrityData?.foreignKeys?.filter(fk =>
                                    fk.table_name === table.tablename || fk.foreign_table_name === table.tablename
                                  ).length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                                        <Key className="h-3 w-3" /> Fremdschlüssel
                                      </h4>
                                      <div className="space-y-1">
                                        {integrityData?.foreignKeys?.filter(fk =>
                                          fk.table_name === table.tablename || fk.foreign_table_name === table.tablename
                                        ).map((fk, i) => (
                                          <div key={i} className="text-xs text-gray-400 font-mono flex items-center gap-2">
                                            <LinkIcon className="h-3 w-3 text-cyan-400" />
                                            <span className="text-cyan-400">{fk.table_name}.{fk.column_name}</span>
                                            <span className="text-gray-500">→</span>
                                            <span className="text-green-400">{fk.foreign_table_name}.{fk.foreign_column_name}</span>
                                            <span className="text-gray-500 text-xs">({fk.constraint_name})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* Related Indexes */}
                                  {integrityData?.indexes?.filter(idx => idx.tablename === table.tablename).length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                                        <Database className="h-3 w-3" /> Indizes
                                      </h4>
                                      <div className="space-y-1">
                                        {integrityData?.indexes?.filter(idx => idx.tablename === table.tablename).map((idx, i) => (
                                          <div key={i} className="text-xs text-gray-400 font-mono">
                                            <span className="text-cyan-400">{idx.indexname}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* No FK or Index message */}
                                  {!integrityData?.foreignKeys?.some(fk =>
                                    fk.table_name === table.tablename || fk.foreign_table_name === table.tablename
                                  ) && !integrityData?.indexes?.some(idx => idx.tablename === table.tablename) && (
                                    <p className="text-xs text-gray-500">Keine Fremdschlüssel oder benutzerdefinierten Indizes für diese Tabelle definiert.</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Foreign Keys & Indexes Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Foreign Keys Panel */}
              <div className="cyber-panel p-6 rounded">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => setShowForeignKeys(!showForeignKeys)}
                >
                  <h2 className="text-lg font-bold neon-yellow tracking-wide flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    FREMDSCHLÜSSEL ({integrityData?.foreignKeys?.length || 0})
                  </h2>
                  {showForeignKeys ? <ChevronUp className="h-5 w-5 text-cyan-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
                {showForeignKeys && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {integrityData?.foreignKeys?.map((fk, i) => (
                      <div key={i} className="text-xs p-2 bg-black/30 rounded font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400">{fk.table_name}.{fk.column_name}</span>
                          <span className="text-gray-500">→</span>
                          <span className="text-green-400">{fk.foreign_table_name}.{fk.foreign_column_name}</span>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">{fk.constraint_name}</div>
                      </div>
                    ))}
                    {(!integrityData?.foreignKeys || integrityData.foreignKeys.length === 0) && (
                      <p className="text-gray-500 text-sm">Keine Fremdschlüssel definiert.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Indexes Panel */}
              <div className="cyber-panel p-6 rounded">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => setShowIndexes(!showIndexes)}
                >
                  <h2 className="text-lg font-bold neon-yellow tracking-wide flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    INDIZES ({integrityData?.indexes?.length || 0})
                  </h2>
                  {showIndexes ? <ChevronUp className="h-5 w-5 text-cyan-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
                {showIndexes && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {integrityData?.indexes?.map((idx, i) => (
                      <div key={i} className="text-xs p-2 bg-black/30 rounded font-mono">
                        <div className="text-cyan-400">{idx.indexname}</div>
                        <div className="text-gray-500 text-xs mt-1">auf {idx.tablename}</div>
                      </div>
                    ))}
                    {(!integrityData?.indexes || integrityData.indexes.length === 0) && (
                      <p className="text-gray-500 text-sm">Keine benutzerdefinierten Indizes definiert.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Table Data Viewer Modal */}
            {tableDataModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="cyber-panel p-3 sm:p-6 rounded w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold neon-yellow flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        {tableDataModal.tableName}
                      </h3>
                      <p className="text-sm text-cyan-400/60">
                        {tableDataModal.pagination.total} Zeilen gesamt •
                        Seite {tableDataModal.pagination.page} von {tableDataModal.pagination.totalPages}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTableDataModal(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {tableDataLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-black">
                            <tr>
                              {tableDataModal.columns.map((col) => (
                                <th
                                  key={col.name}
                                  className="text-left px-3 py-2 text-yellow-400 font-bold border-b border-yellow-500/30"
                                >
                                  <div className="flex flex-col">
                                    <span>{col.name}</span>
                                    <span className="text-xs text-gray-500 font-normal">{col.type}</span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableDataModal.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-gray-800 hover:bg-cyan-500/5">
                                {tableDataModal.columns.map((col) => (
                                  <td key={col.name} className="px-3 py-2 text-gray-300 font-mono text-xs max-w-xs truncate">
                                    {row[col.name] === null ? (
                                      <span className="text-gray-500 italic">NULL</span>
                                    ) : typeof row[col.name] === 'boolean' ? (
                                      <span className={row[col.name] ? 'text-green-400' : 'text-red-400'}>
                                        {row[col.name] ? 'true' : 'false'}
                                      </span>
                                    ) : (
                                      String(row[col.name])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Pagination */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-yellow-500/30">
                        <div className="text-sm text-gray-400">
                          Zeige {((tableDataModal.pagination.page - 1) * tableDataModal.pagination.limit) + 1} - {Math.min(tableDataModal.pagination.page * tableDataModal.pagination.limit, tableDataModal.pagination.total)} von {tableDataModal.pagination.total}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={tableDataModal.pagination.page <= 1}
                            onClick={() => fetchTableData(tableDataModal.tableName, tableDataModal.pagination.page - 1)}
                            className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Zurück
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={tableDataModal.pagination.page >= tableDataModal.pagination.totalPages}
                            onClick={() => fetchTableData(tableDataModal.tableName, tableDataModal.pagination.page + 1)}
                            className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                          >
                            Weiter
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Integrity Issues */}
            {integrityData?.integrityIssues && integrityData.integrityIssues.length > 0 && (
              <div className="cyber-panel p-6 rounded border-2 border-yellow-500/50">
                <h2 className="text-xl font-bold text-yellow-400 tracking-wide mb-4">
                  <AlertTriangle className="h-5 w-5 inline mr-2" />
                  INTEGRITÄTSPROBLEME
                </h2>
                <div className="space-y-2">
                  {integrityData.integrityIssues.map((issue, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      <div>
                        <div className="text-yellow-400 font-bold">{issue.table}</div>
                        <div className="text-sm text-gray-300">{issue.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Migrations Tab */}
        {activeTab === 'migrations' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Migration Actions */}
            <div className="cyber-panel p-3 sm:p-6 rounded">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                <div>
                  <h2 className="text-base sm:text-xl font-bold neon-yellow tracking-wide">MIGRATIONEN</h2>
                  <p className="text-xs sm:text-sm text-cyan-400/60 mt-1">Schema-Aktualisierungen anwenden</p>
                </div>
                <Button
                  onClick={runMigrations}
                  disabled={runningMigrations}
                  size="sm"
                  className="bg-cyan-500 text-black hover:bg-cyan-400"
                >
                  {runningMigrations ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Play className="h-4 w-4 sm:mr-2" />}
                  <span className="hidden sm:inline">AUSFÜHREN</span>
                </Button>
              </div>

              {migrationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {migrations.map((migration, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-black/30 rounded border border-cyan-500/20">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(migration.status)}
                        <div>
                          <div className="text-cyan-400 font-bold">{migration.name}</div>
                          <div className="text-sm text-gray-400">{migration.details}</div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-bold ${
                        migration.status === 'applied' ? 'bg-green-500/20 text-green-400' :
                        migration.status === 'partial' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {migration.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Migration Info */}
            <div className="cyber-panel p-3 sm:p-6 rounded">
              <h2 className="text-base sm:text-xl font-bold neon-yellow tracking-wide mb-3 sm:mb-4">WAS MIGRATIONEN BEWIRKEN</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 bg-black/30 rounded border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">Optimistische Sperrung</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Fügt Versionsspalten hinzu, um gleichzeitige Aktualisierungskonflikte zu verhindern.
                    Gewährleistet Datenkonsistenz, wenn mehrere Benutzer denselben Datensatz bearbeiten.
                  </p>
                </div>
                <div className="p-4 bg-black/30 rounded border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-5 w-5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">Leistungsindizes</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Erstellt Datenbankindizes für häufig abgefragte Spalten.
                    Verbessert die Such- und Nachschlageleistung erheblich.
                  </p>
                </div>
                <div className="p-4 bg-black/30 rounded border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight className="h-5 w-5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">Fremdschlüssel-Einschränkungen</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Erzwingt referenzielle Integrität zwischen verknüpften Tabellen.
                    Verhindert verwaiste Datensätze und Dateninkonsistenzen.
                  </p>
                </div>
                <div className="p-4 bg-black/30 rounded border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">Auto-Update-Trigger</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Aktualisiert automatisch Zeitstempel- und Versionsspalten.
                    Führt genaue Prüfpfade für alle Änderungen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}