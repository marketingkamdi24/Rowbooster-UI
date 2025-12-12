import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Upload, FileSpreadsheet, Check, X, Loader2, Table2, Plus, AlertCircle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as XLSX from 'xlsx';

interface PropertyImportPreview {
  name: string;
  description?: string;
  expectedFormat?: string;
  order: number;
}

interface PropertyTable {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
}

export default function PropertyImporter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<PropertyImportPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Import destination state
  const [importMode, setImportMode] = useState<'existing' | 'new'>('new');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newTableDescription, setNewTableDescription] = useState('');

  // Fetch existing property tables
  const tablesQuery = useQuery({
    queryKey: ['/api/property-tables'],
    async queryFn() {
      const response = await apiRequest('GET', '/api/property-tables');
      return response.json() as Promise<PropertyTable[]>;
    }
  });

  // Mutation to create a new property table
  const createTableMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/property-tables', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
      queryClient.invalidateQueries({ queryKey: ['/api/property-tables/count'] });
    }
  });

  // Mutation to import properties
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
        description: `${previewData.length} Eigenschaften wurden in der richtigen Reihenfolge importiert.`,
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Import fehlgeschlagen",
        description: (error as Error).message || "Eigenschaften konnten nicht importiert werden",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setPreviewData([]);
    setShowPreview(false);
    setNewTableName('');
    setNewTableDescription('');
    setSelectedTableId(null);
    setImportMode('new');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
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
      
      // Get the first worksheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to array format (no headers) to read by column position
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (rawData.length < 1) {
        throw new Error("Die Excel-Datei muss mindestens eine Datenzeile enthalten.");
      }

      // Check if first row is a header row
      const firstRow = rawData[0];
      const hasHeaderRow = firstRow && (
        String(firstRow[0] || '').toLowerCase().includes('name') ||
        String(firstRow[0] || '').toLowerCase().includes('property') ||
        String(firstRow[0] || '').toLowerCase().includes('eigenschaft') ||
        String(firstRow[1] || '').toLowerCase().includes('description') ||
        String(firstRow[1] || '').toLowerCase().includes('beschreibung') ||
        String(firstRow[2] || '').toLowerCase().includes('format')
      );
      
      // Determine start index - skip header row if present
      const startIndex = hasHeaderRow ? 1 : 0;
      console.log(`Excel parsing: hasHeaderRow=${hasHeaderRow}, starting from row ${startIndex + 1}`);
      
      // Parse properties from rows
      const properties: PropertyImportPreview[] = [];
      let orderCounter = 1;
      
      for (let i = startIndex; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Skip empty rows
        if (!row || row.length === 0) continue;
        
        // First column is property name (required)
        const propertyName = row[0] ? String(row[0]).trim() : '';
        
        // Skip if no property name
        if (!propertyName) continue;
        
        // Second column is description (optional)
        const propertyDesc = row[1] ? String(row[1]).trim() : '';
        
        // Third column is format (optional)
        const propertyFormat = row[2] ? String(row[2]).trim() : undefined;
        
        // Fourth column is order (optional) - if not provided, use sequential order
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
        throw new Error("Keine gültigen Eigenschaften in der Datei gefunden. Stellen Sie sicher, dass die erste Spalte Eigenschaftsnamen enthält.");
      }

      // Sort by order to maintain sequence
      properties.sort((a, b) => a.order - b.order);

      setPreviewData(properties);
      setShowPreview(true);

      // Auto-fill table name from file name if in new mode
      if (importMode === 'new' && !newTableName) {
        const suggestedName = file.name.replace(/\.(xlsx|xls)$/i, '').replace(/_/g, ' ');
        setNewTableName(suggestedName);
      }

      toast({
        title: "Datei erfolgreich gelesen",
        description: `${properties.length} Eigenschaften gefunden. Bitte überprüfen Sie die Vorschau.`,
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
      let targetTableId: number;

      if (importMode === 'new') {
        // Validate new table name
        if (!newTableName.trim()) {
          toast({
            title: "Tabellenname erforderlich",
            description: "Bitte geben Sie einen Namen für die neue Eigenschaftentabelle ein.",
            variant: "destructive",
          });
          return;
        }

        // Create the new table first
        const newTable = await createTableMutation.mutateAsync({
          name: newTableName.trim(),
          description: newTableDescription.trim() || undefined
        });
        
        targetTableId = newTable.id;
        
        toast({
          title: "Tabelle erstellt",
          description: `Eigenschaftentabelle "${newTableName}" wurde erfolgreich erstellt.`,
        });
      } else {
        // Using existing table
        if (!selectedTableId) {
          toast({
            title: "Keine Tabelle ausgewählt",
            description: "Bitte wählen Sie eine bestehende Tabelle für den Import aus.",
            variant: "destructive",
          });
          return;
        }
        targetTableId = selectedTableId;
      }

      // Import properties into the target table
      await importPropertiesMutation.mutateAsync({
        properties: previewData,
        propertyTableId: targetTableId
      });

    } catch (error) {
      console.error('Error during import:', error);
      toast({
        title: "Import fehlgeschlagen",
        description: (error as Error).message || "Beim Import ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  };

  const handleCancelImport = () => {
    resetForm();
  };

  const tables = tablesQuery.data || [];

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg text-gray-900">Eigenschaften aus Excel importieren</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Laden Sie eine Excel-Datei hoch, um eine neue Eigenschaftentabelle mit Ihren benutzerdefinierten Eigenschaften zu erstellen
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!showPreview ? (
          <div className="space-y-6">
            {/* Required Excel Structure - Visual Table */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Info className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Erforderliches Excel-Format</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Ihre Excel-Datei sollte diese Spalten haben. Nur Spalte A (Eigenschaftsname) ist erforderlich.
                  </p>
                </div>
              </div>
              
              {/* Visual Column Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 w-16">Spalte</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Inhalt</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Erforderlich</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Beispiel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="bg-green-50">
                      <td className="px-3 py-2 font-mono font-bold text-green-700">A</td>
                      <td className="px-3 py-2 text-gray-900">Eigenschaftsname</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Ja</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">Hersteller</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono font-bold text-gray-500">B</td>
                      <td className="px-3 py-2 text-gray-900">Beschreibung</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">Optional</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">Name des Herstellers</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono font-bold text-gray-500">C</td>
                      <td className="px-3 py-2 text-gray-900">Erwartetes Format</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">Optional</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">Text</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono font-bold text-gray-500">D</td>
                      <td className="px-3 py-2 text-gray-900">Sortierreihenfolge</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">Optional</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Destination Selection */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Importziel</h4>
              
              <RadioGroup
                value={importMode}
                onValueChange={(value) => setImportMode(value as 'existing' | 'new')}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <div className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                  importMode === 'new' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="new" id="new-table" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="new-table" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                      <Plus className="h-4 w-4 text-blue-600" />
                      Neue Tabelle erstellen
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Erstellen Sie eine neue Eigenschaftentabelle für diesen Import
                    </p>
                  </div>
                </div>
                
                <div className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                  importMode === 'existing' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="existing" id="existing-table" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="existing-table" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-purple-600" />
                      Bestehende Tabelle ersetzen
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Eigenschaften in einer bestehenden Tabelle ersetzen
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* New Table Name Input */}
              {importMode === 'new' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-table-name" className="text-sm font-medium text-gray-700">
                      Neuer Tabellenname <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="new-table-name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="e.g., Kamin, Grill, Pelletofen"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-table-desc" className="text-sm font-medium text-gray-700">
                      Beschreibung (optional)
                    </Label>
                    <Input
                      id="new-table-desc"
                      value={newTableDescription}
                      onChange={(e) => setNewTableDescription(e.target.value)}
                      placeholder="Optionale Beschreibung für diese Tabelle"
                      className="bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Existing Table Selection */}
              {importMode === 'existing' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="existing-table-select" className="text-sm font-medium text-gray-700">
                      Zu ersetzende Tabelle auswählen <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={selectedTableId?.toString() || ''}
                      onValueChange={(value) => setSelectedTableId(parseInt(value))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Eigenschaftentabelle auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table) => (
                          <SelectItem key={table.id} value={table.id.toString()}>
                            {table.name}
                            {table.isDefault && ' (Default)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Warnung: Alle bestehenden Eigenschaften in der ausgewählten Tabelle werden durch die importierten Eigenschaften ersetzt.</span>
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Area */}
            <div className="space-y-3">
              <Label htmlFor="excel-file" className="text-sm font-medium text-gray-700">
                Excel-Datei auswählen
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <div className="space-y-3">
                  <div className="mx-auto h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-600" />
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
                          Verarbeitung...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Datei auswählen
                        </>
                      )}
                    </Button>
                    <Input
                      ref={fileInputRef}
                      id="excel-file"
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

            {isUploading && (
              <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-blue-700">Datei wird gelesen...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Import Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  {importMode === 'new' ? (
                    <>Tabelle erstellen: <span className="text-blue-600">{newTableName || 'Unbenannt'}</span></>
                  ) : (
                    <>Tabelle ersetzen: <span className="text-purple-600">
                      {tables.find(t => t.id === selectedTableId)?.name || 'Unknown'}
                    </span></>
                  )}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {previewData.length} Eigenschaften werden importiert
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {previewData.length} Eigenschaften
              </span>
            </div>

            {/* Preview Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
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
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((property, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {property.order}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {property.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {property.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                            {property.expectedFormat || 'Automatisch'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-3 w-3 text-blue-600" />
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Import-Informationen</p>
                  <p>
                    {importMode === 'new'
                      ? `Eine neue Eigenschaftentabelle "${newTableName}" wird mit ${previewData.length} Eigenschaften erstellt.`
                      : `Alle bestehenden Eigenschaften in der ausgewählten Tabelle werden durch diese ${previewData.length} Eigenschaften ersetzt.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={handleCancelImport}
                disabled={importPropertiesMutation.isPending || createTableMutation.isPending}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Abbrechen
              </Button>
              <Button 
                onClick={handleConfirmImport}
                disabled={
                  importPropertiesMutation.isPending || 
                  createTableMutation.isPending ||
                  (importMode === 'new' && !newTableName.trim()) ||
                  (importMode === 'existing' && !selectedTableId)
                }
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {(importPropertiesMutation.isPending || createTableMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {createTableMutation.isPending ? 'Tabelle wird erstellt...' : 'Importieren...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {importMode === 'new' ? 'Tabelle erstellen & Importieren' : 'Ersetzen & Importieren'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}