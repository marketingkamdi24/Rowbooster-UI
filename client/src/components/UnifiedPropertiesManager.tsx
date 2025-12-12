import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Edit2, Trash2, Save, X, Plus, List, Star, Table2, PlusCircle, Download, 
  AlertCircle, Upload, FileSpreadsheet, Check, Loader2, Info, 
  ChevronRight, FolderPlus, Database, Sparkles, ArrowRight, HelpCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportPropertyTable } from "@/lib/utils/exportData";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';

const MAX_TABLES_PER_USER = 25;

interface PropertyTable {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  userId?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TableCountResponse {
  count: number;
  maxTables: number;
}

interface Property {
  id: number;
  propertyTableId?: number;
  name: string;
  description?: string;
  expectedFormat?: string;
  orderIndex?: number;
  isRequired?: boolean;
}

interface PropertyImportPreview {
  name: string;
  description?: string;
  expectedFormat?: string;
  order: number;
}

type CreateMode = 'choice' | 'manual' | 'import';
type ImportStep = 'upload' | 'preview';

export default function UnifiedPropertiesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Main state
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('choice');
  const [showCreateSection, setShowCreateSection] = useState(false);
  
  // Edit/Add property state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', expectedFormat: '', isRequired: false });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', description: '', expectedFormat: '', isRequired: false });
  
  // Create table state
  const [newTableName, setNewTableName] = useState('');
  const [newTableDescription, setNewTableDescription] = useState('');
  
  // Import state
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<PropertyImportPreview[]>([]);
  const [importStep, setImportStep] = useState<ImportStep>('upload');

  // Fetch table count for current user
  const tableCountQuery = useQuery({
    queryKey: ['/api/property-tables/count'],
    async queryFn() {
      const response = await apiRequest('GET', '/api/property-tables/count');
      return response.json() as Promise<TableCountResponse>;
    }
  });

  // Fetch property tables for current user
  const tablesQuery = useQuery({
    queryKey: ['/api/property-tables'],
    async queryFn() {
      const response = await apiRequest('GET', '/api/property-tables');
      return response.json();
    }
  });

  const tableCount = tableCountQuery.data?.count || 0;
  const canCreateMoreTables = tableCount < MAX_TABLES_PER_USER;

  // Fetch properties for selected table
  const propertiesQuery = useQuery({
    queryKey: ['/api/properties', selectedTableId],
    async queryFn() {
      const url = selectedTableId ? `/api/properties?tableId=${selectedTableId}` : '/api/properties';
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: selectedTableId !== null
  });

  // Get current user to reset state when user changes
  const { user } = useAuth();
  
  // Reset selectedTableId when user changes (login/logout)
  useEffect(() => {
    setSelectedTableId(null);
  }, [user?.id]);
  
  // Set default table when tables are loaded
  useEffect(() => {
    if (tablesQuery.data && tablesQuery.data.length > 0 && selectedTableId === null) {
      const defaultTable = tablesQuery.data.find((t: PropertyTable) => t.isDefault);
      if (defaultTable) {
        setSelectedTableId(defaultTable.id);
      } else {
        setSelectedTableId(tablesQuery.data[0].id);
      }
    }
  }, [tablesQuery.data, selectedTableId]);

  // Delete property mutation
  const deletePropertyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/properties/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Eigenschaft gelöscht",
        description: "Die Eigenschaft wurde erfolgreich entfernt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen",
        description: (error as Error).message || "Eigenschaft konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  });

  // Update property mutation
  const updatePropertyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PUT', `/api/properties/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setEditingId(null);
      toast({
        title: "Eigenschaft aktualisiert",
        description: "Die Eigenschaft wurde erfolgreich bearbeitet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Bearbeiten",
        description: (error as Error).message || "Eigenschaft konnte nicht bearbeitet werden",
        variant: "destructive",
      });
    }
  });

  // Add new property mutation
  const addPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/properties', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setIsAddingNew(false);
      setNewProperty({ name: '', description: '', expectedFormat: '', isRequired: false });
      toast({
        title: "Eigenschaft hinzugefügt",
        description: "Die neue Eigenschaft wurde erfolgreich erstellt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Hinzufügen",
        description: (error as Error).message || "Eigenschaft konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  });

  // Create new property table mutation
  const createTableMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; isDefault?: boolean }) => {
      const response = await apiRequest('POST', '/api/property-tables', data);
      return response.json();
    },
    onSuccess: (newTable) => {
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables/count'] });
      setSelectedTableId(newTable.id);
      resetCreateForm();
      toast({
        title: "Tabelle erstellt",
        description: `Eigenschaftentabelle "${newTable.name}" wurde erfolgreich erstellt.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: (error as Error).message || "Tabelle konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  });

  // Import properties mutation
  const importPropertiesMutation = useMutation({
    mutationFn: async ({ properties, propertyTableId }: { properties: PropertyImportPreview[], propertyTableId: number }) => {
      const response = await apiRequest('POST', '/api/import-properties', { 
        properties,
        propertyTableId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      toast({
        title: "Eigenschaften erfolgreich importiert",
        description: `${previewData.length} Eigenschaften wurden importiert.`,
      });
      resetCreateForm();
    },
    onError: (error) => {
      toast({
        title: "Import fehlgeschlagen",
        description: (error as Error).message || "Eigenschaften konnten nicht importiert werden",
        variant: "destructive",
      });
    }
  });

  // Set default table mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/property-tables/${id}/set-default`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Standard festgelegt",
        description: "Die Standard-Eigenschaftentabelle wurde aktualisiert. Seite wird neu geladen...",
      });
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: (error as Error).message || "Standard konnte nicht festgelegt werden",
        variant: "destructive",
      });
    }
  });

  // Delete table mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/property-tables/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables/count'] });
      setSelectedTableId(null);
      toast({
        title: "Tabelle gelöscht",
        description: "Die Eigenschaftentabelle wurde erfolgreich entfernt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Löschen",
        description: (error as Error).message || "Tabelle konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  });

  const resetCreateForm = () => {
    setShowCreateSection(false);
    setCreateMode('choice');
    setNewTableName('');
    setNewTableDescription('');
    setPreviewData([]);
    setImportStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (property: Property) => {
    setEditingId(property.id);
    setEditForm({
      name: property.name,
      description: property.description || '',
      expectedFormat: property.expectedFormat || '',
      isRequired: property.isRequired || false
    });
  };

  const handleSave = () => {
    if (editingId && editForm.name.trim()) {
      updatePropertyMutation.mutate({
        id: editingId,
        data: {
          name: editForm.name.trim(),
          description: editForm.description?.trim() || null,
          expectedFormat: editForm.expectedFormat?.trim() || null
        }
      });
    }
  };

  const handleAddNew = () => {
    if (newProperty.name.trim()) {
      const maxOrder = Math.max(...(propertiesQuery.data?.map((p: Property) => p.orderIndex || 0) || [0]));
      addPropertyMutation.mutate({
        name: newProperty.name.trim(),
        description: newProperty.description?.trim() || null,
        expectedFormat: newProperty.expectedFormat?.trim() || null,
        isRequired: newProperty.isRequired,
        orderIndex: maxOrder + 1,
        propertyTableId: selectedTableId
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Sind Sie sicher, dass Sie diese Eigenschaft löschen möchten?')) {
      deletePropertyMutation.mutate(id);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte laden Sie eine Excel-Datei (.xlsx oder .xls) hoch.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (rawData.length < 1) {
        throw new Error("Die Excel-Datei muss mindestens eine Datenzeile enthalten.");
      }

      const firstRow = rawData[0];
      const hasHeaderRow = firstRow && (
        String(firstRow[0] || '').toLowerCase().includes('name') ||
        String(firstRow[0] || '').toLowerCase().includes('property') ||
        String(firstRow[0] || '').toLowerCase().includes('eigenschaft') ||
        String(firstRow[1] || '').toLowerCase().includes('description') ||
        String(firstRow[1] || '').toLowerCase().includes('beschreibung') ||
        String(firstRow[2] || '').toLowerCase().includes('format')
      );
      
      const startIndex = hasHeaderRow ? 1 : 0;
      
      const properties: PropertyImportPreview[] = [];
      let orderCounter = 1;
      
      for (let i = startIndex; i < rawData.length; i++) {
        const row = rawData[i];
        
        if (!row || row.length === 0) continue;
        
        const propertyName = row[0] ? String(row[0]).trim() : '';
        
        if (!propertyName) continue;
        
        const propertyDesc = row[1] ? String(row[1]).trim() : '';
        const propertyFormat = row[2] ? String(row[2]).trim() : undefined;
        const propertyOrder = row[3] && !isNaN(Number(row[3])) ? Number(row[3]) : orderCounter;
        orderCounter++;
        
        properties.push({
          name: propertyName,
          description: propertyDesc || undefined,
          expectedFormat: propertyFormat || undefined,
          order: propertyOrder
        });
      }

      if (properties.length === 0) {
        throw new Error("Keine gültigen Eigenschaften in der Datei gefunden.");
      }

      properties.sort((a, b) => a.order - b.order);

      setPreviewData(properties);
      setImportStep('preview');

      if (!newTableName) {
        const suggestedName = file.name.replace(/\.(xlsx|xls)$/i, '').replace(/_/g, ' ');
        setNewTableName(suggestedName);
      }

      toast({
        title: "Datei erfolgreich gelesen",
        description: `${properties.length} Eigenschaften gefunden. Bitte überprüfen und bestätigen.`,
      });

    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast({
        title: "Fehler beim Lesen der Datei",
        description: (error as Error).message || "Die Excel-Datei konnte nicht gelesen werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    try {
      if (!newTableName.trim()) {
        toast({
          title: "Tabellenname erforderlich",
          description: "Bitte geben Sie einen Namen für die neue Eigenschaftentabelle ein.",
          variant: "destructive",
        });
        return;
      }

      const tables = tablesQuery.data || [];
      const newTable = await createTableMutation.mutateAsync({
        name: newTableName.trim(),
        description: newTableDescription.trim() || undefined,
        isDefault: tables.length === 0
      });
      
      await importPropertiesMutation.mutateAsync({
        properties: previewData,
        propertyTableId: newTable.id
      });

    } catch (error) {
      console.error('Error during import:', error);
    }
  };

  const handleCreateManualTable = async () => {
    if (!newTableName.trim()) {
      toast({
        title: "Tabellenname erforderlich",
        description: "Bitte geben Sie einen Namen für die neue Eigenschaftentabelle ein.",
        variant: "destructive",
      });
      return;
    }

    const tables = tablesQuery.data || [];
    await createTableMutation.mutateAsync({
      name: newTableName.trim(),
      description: newTableDescription.trim() || undefined,
      isDefault: tables.length === 0
    });
  };

  const properties = propertiesQuery.data || [];
  const tables = tablesQuery.data || [];
  const selectedTable = tables.find((t: PropertyTable) => t.id === selectedTableId);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg text-gray-900">Eigenschaftentabellen</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Erstellen und verwalten Sie Eigenschaftentabellen für verschiedene Produkttypen
            </CardDescription>
          </div>
          {/* Table count badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            tableCount >= MAX_TABLES_PER_USER
              ? 'bg-red-100 text-red-700 border border-red-200'
              : tableCount >= MAX_TABLES_PER_USER - 5
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          }`}>
            <Table2 className="h-3.5 w-3.5" />
            <span>{tableCount} / {MAX_TABLES_PER_USER} Tabellen</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Limit warnings */}
        {tableCount >= MAX_TABLES_PER_USER - 3 && tableCount < MAX_TABLES_PER_USER && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Sie nähern sich dem Limit von {MAX_TABLES_PER_USER} Tabellen. Noch {MAX_TABLES_PER_USER - tableCount} verfügbar.</span>
          </div>
        )}
        {tableCount >= MAX_TABLES_PER_USER && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Tabellenlimit erreicht ({MAX_TABLES_PER_USER}/{MAX_TABLES_PER_USER}). Löschen Sie eine Tabelle, um eine neue zu erstellen.</span>
          </div>
        )}

        {/* ===== CREATE NEW TABLE SECTION ===== */}
        {!showCreateSection ? (
          <Button
            onClick={() => {
              if (!canCreateMoreTables) {
                toast({
                  title: "Limit erreicht",
                  description: `Sie können maximal ${MAX_TABLES_PER_USER} Tabellen erstellen. Bitte löschen Sie eine bestehende Tabelle, um eine neue zu erstellen.`,
                  variant: "destructive",
                });
                return;
              }
              setShowCreateSection(true);
            }}
            disabled={!canCreateMoreTables}
            className="w-full h-14 gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md"
          >
            <PlusCircle className="h-5 w-5" />
            <span className="font-medium">Neue Eigenschaftentabelle erstellen</span>
          </Button>
        ) : (
          <div className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-indigo-50">
            {/* Create Mode Selection */}
            {createMode === 'choice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Neue Tabelle erstellen</h3>
                  <Button variant="ghost" size="sm" onClick={resetCreateForm} className="text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600">Wählen Sie, wie Sie Ihre Eigenschaftentabelle erstellen möchten:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manual Option */}
                  <button
                    onClick={() => setCreateMode('manual')}
                    className="group relative flex flex-col items-center p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all text-left"
                  >
                    <div className="h-14 w-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                      <FolderPlus className="h-7 w-7 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Leere Tabelle erstellen</h4>
                    <p className="text-sm text-gray-500 text-center">
                      Beginnen Sie mit einer leeren Tabelle und fügen Sie Eigenschaften manuell hinzu
                    </p>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-5 w-5 text-purple-500" />
                    </div>
                  </button>
                  
                  {/* Import Option */}
                  <button
                    onClick={() => setCreateMode('import')}
                    className="group relative flex flex-col items-center p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-left"
                  >
                    <div className="h-14 w-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                      <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Aus Excel importieren</h4>
                    <p className="text-sm text-gray-500 text-center">
                      Laden Sie eine Excel-Datei mit Ihrer Eigenschaftenliste hoch, um schnell eine Tabelle zu erstellen
                    </p>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-5 w-5 text-blue-500" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Manual Creation Form */}
            {createMode === 'manual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCreateMode('choice')} className="text-gray-500 hover:text-gray-700 p-1">
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <h3 className="text-lg font-semibold text-gray-900">Leere Tabelle erstellen</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetCreateForm} className="text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="bg-white rounded-lg p-4 space-y-4 border border-gray-200">
                  <div className="space-y-2">
                    <Label htmlFor="manual-table-name" className="text-sm font-medium text-gray-700">
                      Tabellenname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="manual-table-name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="e.g., Kamin, Grill, Pelletofen"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-table-desc" className="text-sm font-medium text-gray-700">
                      Beschreibung (optional)
                    </Label>
                    <Input
                      id="manual-table-desc"
                      value={newTableDescription}
                      onChange={(e) => setNewTableDescription(e.target.value)}
                      placeholder="Kurze Beschreibung dieser Tabelle"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={resetCreateForm}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleCreateManualTable}
                    disabled={!newTableName.trim() || createTableMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {createTableMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Erstellen...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Tabelle erstellen
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Import Creation Form */}
            {createMode === 'import' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setCreateMode('choice'); setImportStep('upload'); setPreviewData([]); }} className="text-gray-500 hover:text-gray-700 p-1">
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <h3 className="text-lg font-semibold text-gray-900">Aus Excel importieren</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetCreateForm} className="text-gray-500 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    importStep === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {importStep === 'upload' ? (
                      <><span className="h-5 w-5 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs">1</span> Datei hochladen</>
                    ) : (
                      <><Check className="h-4 w-4" /> Datei hochgeladen</>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    importStep === 'preview' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`h-5 w-5 flex items-center justify-center rounded-full text-xs ${
                      importStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>2</span>
                    Überprüfen & Erstellen
                  </div>
                </div>

                {importStep === 'upload' && (
                  <div className="space-y-4">
                    {/* Excel format guide */}
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Info className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">Excel-Dateiformat</h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Ihre Datei sollte Eigenschaftsnamen in Spalte A haben. Spalten B-D sind optional.
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700">A</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700">B</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700">C</th>
                              <th className="px-2 py-1.5 text-left font-semibold text-gray-700">D</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t border-gray-200">
                              <td className="px-2 py-1.5 text-gray-900">Eigenschaftsname*</td>
                              <td className="px-2 py-1.5 text-gray-600">Beschreibung</td>
                              <td className="px-2 py-1.5 text-gray-600">Format</td>
                              <td className="px-2 py-1.5 text-gray-600">Reihenfolge</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Upload area */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white hover:border-blue-400 transition-colors">
                      <div className="space-y-4">
                        <div className="mx-auto h-14 w-14 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Upload className="h-7 w-7 text-blue-600" />
                        </div>
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="gap-2"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Datei wird gelesen...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                Excel-Datei auswählen
                              </>
                            )}
                          </Button>
                          <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="hidden"
                          />
                        </div>
                        <p className="text-sm text-gray-500">
                          Unterstützte Formate: .xlsx, .xls
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {importStep === 'preview' && (
                  <div className="space-y-4">
                    {/* Table name input */}
                    <div className="bg-white rounded-lg p-4 space-y-4 border border-gray-200">
                      <div className="space-y-2">
                        <Label htmlFor="import-table-name" className="text-sm font-medium text-gray-700">
                          Tabellenname <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="import-table-name"
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          placeholder="e.g., Kamin, Grill, Pelletofen"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="import-table-desc" className="text-sm font-medium text-gray-700">
                          Beschreibung (optional)
                        </Label>
                        <Input
                          id="import-table-desc"
                          value={newTableDescription}
                          onChange={(e) => setNewTableDescription(e.target.value)}
                          placeholder="Kurze Beschreibung dieser Tabelle"
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Preview summary */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <Sparkles className="h-4 w-4" />
                        <span>{previewData.length} Eigenschaften bereit zum Import</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setImportStep('upload'); setPreviewData([]); }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Datei ändern
                      </Button>
                    </div>

                    {/* Preview table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Eigenschaftsname</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Format</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {previewData.slice(0, 10).map((property, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-500">{property.order}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{property.name}</td>
                                <td className="px-3 py-2 text-gray-600">{property.description || '-'}</td>
                                <td className="px-3 py-2 text-gray-600">{property.expectedFormat || 'Auto'}</td>
                              </tr>
                            ))}
                            {previewData.length > 10 && (
                              <tr className="bg-gray-50">
                                <td colSpan={4} className="px-3 py-2 text-center text-gray-500 text-xs">
                                  ... und {previewData.length - 10} weitere Eigenschaften
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={resetCreateForm}>
                        Abbrechen
                      </Button>
                      <Button
                        onClick={handleConfirmImport}
                        disabled={
                          !newTableName.trim() || 
                          importPropertiesMutation.isPending || 
                          createTableMutation.isPending
                        }
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {(importPropertiesMutation.isPending || createTableMutation.isPending) ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {createTableMutation.isPending ? 'Erstellen...' : 'Importieren...'}
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Tabelle erstellen & Importieren
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== EXISTING TABLES SECTION ===== */}
        {tables.length > 0 && (
          <>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Table2 className="h-4 w-4 text-purple-600" />
                Ihre Eigenschaftentabellen
              </h3>
              
              {/* Table selector */}
              <div className="flex items-center gap-3 mb-4">
                <Select 
                  value={selectedTableId?.toString() || ''} 
                  onValueChange={(value) => setSelectedTableId(parseInt(value))}
                >
                  <SelectTrigger className="h-11 flex-1">
                    <SelectValue placeholder="Eigenschaftentabelle auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table: PropertyTable) => (
                      <SelectItem key={table.id} value={table.id.toString()}>
                        <div className="flex items-center gap-2">
                          {table.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                          <span>{table.name}</span>
                          {table.description && (
                            <span className="text-gray-400 text-xs">- {table.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected table info and actions */}
              {selectedTable && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Table2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{selectedTable.name}</span>
                        {selectedTable.isDefault && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-600 text-amber-600" />
                            Default
                          </span>
                        )}
                      </div>
                      {selectedTable.description && (
                        <p className="text-xs text-gray-500">{selectedTable.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{properties.length} Eigenschaften</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (properties.length === 0) {
                          toast({
                            title: "Keine Eigenschaften zum Exportieren",
                            description: "Fügen Sie zuerst einige Eigenschaften hinzu, bevor Sie exportieren.",
                            variant: "destructive",
                          });
                          return;
                        }
                        exportPropertyTable(selectedTable.name, properties);
                        toast({
                          title: "Tabelle exportiert",
                          description: `"${selectedTable.name}" wurde erfolgreich nach Excel exportiert.`,
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="h-8 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Exportieren
                    </Button>
                    {!selectedTable.isDefault && (
                      <Button
                        onClick={() => setDefaultMutation.mutate(selectedTable.id)}
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={setDefaultMutation.isPending}
                      >
                        <Star className="h-3.5 w-3.5 mr-1" />
                        Als Standard setzen
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (confirm(`Sind Sie sicher, dass Sie "${selectedTable.name}" löschen möchten? Alle Eigenschaften in dieser Tabelle werden ebenfalls gelöscht.`)) {
                          deleteTableMutation.mutate(selectedTable.id);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="h-8 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                      disabled={selectedTable.isDefault || deleteTableMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== PROPERTIES SECTION ===== */}
        {selectedTableId && (
          <>
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <List className="h-4 w-4 text-purple-600" />
                  Eigenschaften in {selectedTable?.name}
                </h3>
                {!isAddingNew && properties.length > 0 && (
                  <Button
                    onClick={() => setIsAddingNew(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Eigenschaft hinzufügen
                  </Button>
                )}
              </div>

              {/* Empty state */}
              {properties.length === 0 && !isAddingNew && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <div className="mx-auto h-14 w-14 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <List className="h-7 w-7 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Noch keine Eigenschaften</h4>
                  <p className="text-gray-500 mb-4 max-w-sm mx-auto">
                    Diese Tabelle ist leer. Fügen Sie Eigenschaften hinzu, um zu definieren, welche Daten für Produkte extrahiert werden sollen.
                  </p>
                  <Button onClick={() => setIsAddingNew(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Erste Eigenschaft hinzufügen
                  </Button>
                </div>
              )}

              {/* Add new property form */}
              {isAddingNew && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4 space-y-4">
                  <h4 className="font-medium text-gray-900">Neue Eigenschaft hinzufügen</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-name" className="text-sm font-medium text-gray-700">Name *</Label>
                      <Input
                        id="new-name"
                        value={newProperty.name}
                        onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                        placeholder="Eigenschaftsname"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-description" className="text-sm font-medium text-gray-700">Beschreibung</Label>
                      <Input
                        id="new-description"
                        value={newProperty.description}
                        onChange={(e) => setNewProperty({ ...newProperty, description: e.target.value })}
                        placeholder="Kurze Beschreibung"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-format" className="text-sm font-medium text-gray-700">Format</Label>
                      <Input
                        id="new-format"
                        value={newProperty.expectedFormat}
                        onChange={(e) => setNewProperty({ ...newProperty, expectedFormat: e.target.value })}
                        placeholder="Erwartetes Format"
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-required"
                      checked={newProperty.isRequired}
                      onCheckedChange={(checked) => setNewProperty({ ...newProperty, isRequired: !!checked })}
                    />
                    <Label htmlFor="new-required" className="text-sm font-medium text-gray-700">
                      Pflichtfeld
                    </Label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t border-blue-200">
                    <Button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewProperty({ name: '', description: '', expectedFormat: '', isRequired: false });
                      }}
                      variant="outline"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleAddNew}
                      disabled={!newProperty.name.trim() || addPropertyMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Eigenschaft hinzufügen
                    </Button>
                  </div>
                </div>
              )}

              {/* Properties table */}
              {properties.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Eigenschaftsname
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Beschreibung
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                            Format
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                            Pflicht
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                            Aktionen
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {properties.map((property: Property, index: number) => (
                          <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {editingId === property.id ? (
                                <Input
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="h-9"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-900">{property.name}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {editingId === property.id ? (
                                <Input
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="h-9"
                                />
                              ) : (
                                <span className="text-sm text-gray-600">{property.description || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {editingId === property.id ? (
                                <Input
                                  value={editForm.expectedFormat}
                                  onChange={(e) => setEditForm({ ...editForm, expectedFormat: e.target.value })}
                                  className="h-9"
                                />
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                  {property.expectedFormat || 'Auto'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {editingId === property.id ? (
                                <Checkbox
                                  checked={editForm.isRequired}
                                  onCheckedChange={(checked) => setEditForm({ ...editForm, isRequired: !!checked })}
                                />
                              ) : (
                                <Checkbox
                                  checked={property.isRequired || false}
                                  onCheckedChange={(checked) => {
                                    updatePropertyMutation.mutate({
                                      id: property.id,
                                      data: { isRequired: !!checked }
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {editingId === property.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    onClick={handleSave}
                                    size="sm"
                                    variant="outline"
                                    disabled={updatePropertyMutation.isPending}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    onClick={() => setEditingId(null)}
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <Button
                                    onClick={() => handleEdit(property)}
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    onClick={() => handleDelete(property.id)}
                                    size="sm"
                                    variant="outline"
                                    disabled={deletePropertyMutation.isPending}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state when no tables exist */}
        {tables.length === 0 && !showCreateSection && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="mx-auto h-16 w-16 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
              <Database className="h-8 w-8 text-gray-400" />
            </div>
            <p className="mb-2">Noch keine Eigenschaftentabellen.</p>
            <p className="text-xs text-gray-400">Klicken Sie auf die Schaltfläche oben, um Ihre erste Tabelle zu erstellen.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}