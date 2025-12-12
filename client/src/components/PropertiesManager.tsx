import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Edit2, Trash2, Save, X, Plus, List, Star, Table2, PlusCircle, Download, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportPropertyTable } from "@/lib/utils/exportData";
import { useAuth } from "@/contexts/AuthContext";

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

export default function PropertiesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', expectedFormat: '', isRequired: false });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', description: '', expectedFormat: '', isRequired: false });
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableDescription, setNewTableDescription] = useState('');

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
    console.log(`[PROPERTIES-MANAGER] User changed to: ${user?.username || 'none'}, resetting table selection`);
    setSelectedTableId(null);
  }, [user?.id]);
  
  // Set default table when tables are loaded
  useEffect(() => {
    if (tablesQuery.data && tablesQuery.data.length > 0 && selectedTableId === null) {
      const defaultTable = tablesQuery.data.find((t: PropertyTable) => t.isDefault);
      if (defaultTable) {
        console.log(`[PROPERTIES-MANAGER] Setting default table: ${defaultTable.name} (ID: ${defaultTable.id})`);
        setSelectedTableId(defaultTable.id);
      } else {
        console.log(`[PROPERTIES-MANAGER] No default table, using first: ${tablesQuery.data[0].name} (ID: ${tablesQuery.data[0].id})`);
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
      setIsAddingTable(false);
      setNewTableName('');
      setNewTableDescription('');
      setSelectedTableId(newTable.id);
      toast({
        title: "Tabelle erstellt",
        description: `Die Eigenschaftentabelle "${newTable.name}" wurde erfolgreich erstellt.`,
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

  // Set default table mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/property-tables/${id}/set-default`, {});
      return response.json();
    },
    onSuccess: () => {
      // Invalidate ALL properties queries - including the Home page cache
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] }); // This invalidates ALL property queries
      toast({
        title: "Standard festgelegt",
        description: "Die Standard-Eigenschaftentabelle wurde aktualisiert. Die Seite wird neu geladen...",
      });
      // Force refresh the page to ensure all components use the new default
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

  const properties = propertiesQuery.data || [];
  const tables = tablesQuery.data || [];
  const selectedTable = tables.find((t: PropertyTable) => t.id === selectedTableId);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Table2 className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg text-gray-900">Eigenschaftenverwaltung</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Verwalten Sie Eigenschaftentabellen für verschiedene Produkttypen
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Property Tables Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-900">Produkttyp-Tabellen</h3>
              {/* Table count indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                tableCount >= MAX_TABLES_PER_USER
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : tableCount >= MAX_TABLES_PER_USER - 5
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                <Table2 className="h-3 w-3" />
                <span>{tableCount} / {MAX_TABLES_PER_USER}</span>
              </div>
            </div>
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
                setIsAddingTable(true);
              }}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!canCreateMoreTables}
            >
              <PlusCircle className="h-4 w-4" />
              Tabelle hinzufügen
            </Button>
          </div>

          {/* Warning when approaching limit */}
          {tableCount >= MAX_TABLES_PER_USER - 3 && tableCount < MAX_TABLES_PER_USER && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Sie nähern sich dem Limit von {MAX_TABLES_PER_USER} Tabellen. Noch {MAX_TABLES_PER_USER - tableCount} verfügbar.</span>
            </div>
          )}

          {/* Limit reached warning */}
          {tableCount >= MAX_TABLES_PER_USER && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Tabellenlimit erreicht ({MAX_TABLES_PER_USER}/{MAX_TABLES_PER_USER}). Löschen Sie eine Tabelle, um eine neue zu erstellen.</span>
            </div>
          )}

          {/* Add new table form */}
          {isAddingTable && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900 text-sm">Neue Eigenschaftentabelle</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-table-name" className="text-sm">Tabellenname *</Label>
                  <Input
                    id="new-table-name"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g., Kamin, Gril, Pelletofen"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-table-desc" className="text-sm">Beschreibung</Label>
                  <Input
                    id="new-table-desc"
                    value={newTableDescription}
                    onChange={(e) => setNewTableDescription(e.target.value)}
                    placeholder="Optionale Beschreibung"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => {
                    setIsAddingTable(false);
                    setNewTableName('');
                    setNewTableDescription('');
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
                <Button
                  onClick={() => createTableMutation.mutate({ 
                    name: newTableName, 
                    description: newTableDescription,
                    isDefault: tables.length === 0 
                  })}
                  disabled={!newTableName.trim() || createTableMutation.isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Tabelle erstellen
                </Button>
              </div>
            </div>
          )}

          {/* Table selector and list */}
          {tables.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm text-gray-700 min-w-fit">Tabelle auswählen:</Label>
                <Select 
                  value={selectedTableId?.toString() || ''} 
                  onValueChange={(value) => setSelectedTableId(parseInt(value))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Eigenschaftentabelle auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table: PropertyTable) => (
                      <SelectItem key={table.id} value={table.id.toString()}>
                        <div className="flex items-center gap-2">
                          {table.isDefault && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                          {table.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected table info and actions */}
              {selectedTable && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{selectedTable.name}</span>
                        {selectedTable.isDefault && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-600 text-yellow-600" />
                            Default
                          </span>
                        )}
                      </div>
                      {selectedTable.description && (
                        <p className="text-xs text-gray-600">{selectedTable.description}</p>
                      )}
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
                      className="h-8 hover:bg-green-50 hover:border-green-200 hover:text-green-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
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
                        <Star className="h-3 w-3 mr-1" />
                        Als Standard setzen
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (confirm(`Sind Sie sicher, dass Sie die Tabelle "${selectedTable.name}" löschen möchten? Alle Eigenschaften in dieser Tabelle werden ebenfalls gelöscht.`)) {
                          deleteTableMutation.mutate(selectedTable.id);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="h-8 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                      disabled={selectedTable.isDefault || deleteTableMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              Noch keine Eigenschaftentabellen. Erstellen Sie Ihre erste Tabelle, um zu beginnen.
            </div>
          )}
        </div>

        {/* Properties section - only show if a table is selected */}
        {selectedTableId && (
          <>
            <div className="border-t border-gray-200 my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  Eigenschaften in {selectedTable?.name}
                </h3>
                {properties.length > 0 && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {properties.length} Eigenschaften
                  </span>
                )}
              </div>

              {properties.length === 0 ? (
                <>
                  {!isAddingNew ? (
                    <div className="text-center py-12">
                      <div className="mx-auto h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                        <List className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Noch keine Eigenschaften</h3>
                      <p className="text-gray-500 mb-4">Laden Sie eine Excel-Datei hoch oder fügen Sie Eigenschaften manuell hinzu.</p>
                      <Button onClick={() => setIsAddingNew(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Erste Eigenschaft hinzufügen
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
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
                            placeholder="Eigenschaftsbeschreibung"
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
                      <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
                        <Button
                          onClick={() => {
                            setIsAddingNew(false);
                            setNewProperty({ name: '', description: '', expectedFormat: '', isRequired: false });
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Abbrechen
                        </Button>
                        <Button
                          onClick={handleAddNew}
                          disabled={!newProperty.name.trim() || addPropertyMutation.isPending}
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Save className="h-4 w-4" />
                          Eigenschaft hinzufügen
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => setIsAddingNew(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Eigenschaft hinzufügen
                    </Button>
                  </div>

                  {/* Add new property form */}
                  {isAddingNew && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
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
                            placeholder="Eigenschaftsbeschreibung"
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
                      <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
                        <Button
                          onClick={() => {
                            setIsAddingNew(false);
                            setNewProperty({ name: '', description: '', expectedFormat: '', isRequired: false });
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Abbrechen
                        </Button>
                        <Button
                          onClick={handleAddNew}
                          disabled={!newProperty.name.trim() || addPropertyMutation.isPending}
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Save className="h-4 w-4" />
                          Eigenschaft hinzufügen
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Properties table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Reihenfolge
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Eigenschaftsname
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Beschreibung
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Format
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Pflicht
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                    {property.expectedFormat || 'Automatisch'}
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
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={handleSave}
                                      size="sm"
                                      variant="outline"
                                      disabled={updatePropertyMutation.isPending}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      onClick={() => setEditingId(null)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleEdit(property)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      onClick={() => handleDelete(property.id)}
                                      size="sm"
                                      variant="outline"
                                      disabled={deletePropertyMutation.isPending}
                                      className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
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
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}