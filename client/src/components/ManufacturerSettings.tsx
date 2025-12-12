import { useState, useEffect } from "react";
import { ManufacturerDomain } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Factory, Trash2, Globe, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ManufacturerSettings() {
  const [newManufacturer, setNewManufacturer] = useState({ name: "", websiteUrl: "" });
  const [editMode, setEditMode] = useState<number | null>(null);
  const [domainPrioritizationEnabled, setDomainPrioritizationEnabled] = useState<boolean>(
    localStorage.getItem("domain_prioritization_enabled") === "true"
  );

  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // Fetch manufacturer domains
  const { data: manufacturerDomains, isLoading } = useQuery<ManufacturerDomain[]>({
    queryKey: ["/api/manufacturer-domains"],
  });

  // Add a new manufacturer domain
  const addManufacturerMutation = useMutation({
    mutationFn: async (domain: { name: string; websiteUrl: string; isActive: boolean }) => {
      return await apiRequest("POST", "/api/manufacturer-domains", domain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturer-domains"] });
      setNewManufacturer({ name: "", websiteUrl: "" });
      toast({
        title: "Hersteller hinzugefügt",
        description: "Der Hersteller wurde erfolgreich hinzugefügt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Hinzufügen des Herstellers: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Update a manufacturer domain
  const updateManufacturerMutation = useMutation({
    mutationFn: async (data: { id: number; domain: Partial<ManufacturerDomain> }) => {
      return await apiRequest("PUT", `/api/manufacturer-domains/${data.id}`, 
        data.domain
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturer-domains"] });
      setEditMode(null);
      toast({
        title: "Hersteller aktualisiert",
        description: "Der Hersteller wurde erfolgreich aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Aktualisieren des Herstellers: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Delete a manufacturer domain
  const deleteManufacturerMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/manufacturer-domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturer-domains"] });
      toast({
        title: "Hersteller gelöscht",
        description: "Der Hersteller wurde erfolgreich gelöscht.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Löschen des Herstellers: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Toggle manufacturer active status
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async (data: { id: number; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/manufacturer-domains/${data.id}`, 
        { isActive: data.isActive }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturer-domains"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Ändern des Status: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Handle domain prioritization toggle
  const handleDomainPrioritizationToggle = (enabled: boolean) => {
    setDomainPrioritizationEnabled(enabled);
    localStorage.setItem("domain_prioritization_enabled", String(enabled));
    toast({
      title: enabled ? "Domänen-Priorisierung aktiviert" : "Domänen-Priorisierung deaktiviert",
      description: enabled
        ? "Suchergebnisse von Herstellerwebseiten werden höher gewichtet."
        : "Suchergebnisse werden normal gewichtet.",
    });
  };

  // Handle adding a new manufacturer
  const handleAddManufacturer = () => {
    console.log("Adding manufacturer:", newManufacturer); // Debug log
    
    if (!newManufacturer.name || !newManufacturer.websiteUrl) {
      toast({
        title: "Fehlende Daten",
        description: "Bitte geben Sie sowohl einen Herstellernamen als auch eine Website-URL ein.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format and ensure proper formatting
    let formattedUrl = newManufacturer.websiteUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    try {
      new URL(formattedUrl);
    } catch (e) {
      toast({
        title: "Ungültige URL",
        description: "Bitte geben Sie eine gültige URL ein (z.B. https://example.com).",
        variant: "destructive",
      });
      return;
    }

    // Send the data to the server
    addManufacturerMutation.mutate({
      name: newManufacturer.name.trim(),
      websiteUrl: formattedUrl,
      isActive: true,
    });
  };

  // Handle toggling a manufacturer's active status
  const handleToggleActive = (id: number, currentStatus: boolean) => {
    toggleActiveStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  // Handle updating a manufacturer
  const handleUpdateManufacturer = (id: number, name: string, websiteUrl: string) => {
    // Validate URL format and ensure proper formatting
    let formattedUrl = websiteUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    try {
      new URL(formattedUrl);
    } catch (e) {
      toast({
        title: "Ungültige URL",
        description: "Bitte geben Sie eine gültige URL ein (z.B. https://example.com).",
        variant: "destructive",
      });
      return;
    }

    updateManufacturerMutation.mutate({
      id,
      domain: { name: name.trim(), websiteUrl: formattedUrl },
    });
  };

  // Handle deleting a manufacturer
  const handleDeleteManufacturer = (id: number) => {
    if (confirm("Sind Sie sicher, dass Sie diesen Hersteller löschen möchten?")) {
      deleteManufacturerMutation.mutate(id);
    }
  };

  // Normalize website URL for display (remove protocol, www, trailing slashes)
  const normalizeUrl = (url: string): string => {
    return url.replace(/^(https?:\/\/)?(www\.)?/i, "").replace(/\/+$/, "");
  };

  return (
    <Card>
      <CardHeader className="p-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Factory className="h-5 w-5 text-blue-600" />
          Hersteller & Domänen Priorisierung
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="domain-prioritization" className="text-sm font-medium">
                Domänen-Priorisierung aktivieren
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Wenn aktiviert, werden Suchergebnisse von den unten aufgeführten Herstellerwebseiten in der
                Suche höher gewichtet.
              </p>
            </div>
            <Switch
              id="domain-prioritization"
              checked={domainPrioritizationEnabled}
              onCheckedChange={handleDomainPrioritizationToggle}
            />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-md mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Hinweis</h3>
          <p className="text-sm text-blue-700">
            Fügen Sie Ihre wichtigsten Hersteller mit ihren Webseiten hinzu, um die Relevanz der
            Suchergebnisse zu verbessern. Die Suchergebnisse von diesen Webseiten werden höher gewichtet,
            wenn die Domänen-Priorisierung aktiviert ist.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manufacturer-name" className="text-sm font-medium">
                Herstellername
              </Label>
              <Input
                id="manufacturer-name"
                placeholder="z.B. Beefer GmbH"
                value={newManufacturer.name}
                onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="website-url" className="text-sm font-medium">
                Website URL
              </Label>
              <Input
                id="website-url"
                placeholder="z.B. https://www.beefer.com"
                value={newManufacturer.websiteUrl}
                onChange={(e) => setNewManufacturer({ ...newManufacturer, websiteUrl: e.target.value })}
              />
            </div>
          </div>
          <Button 
            onClick={handleAddManufacturer} 
            className="w-full md:w-auto"
            disabled={addManufacturerMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Hersteller hinzufügen
          </Button>
        </div>

        <div className="mt-8">
          <h3 className="text-md font-medium mb-4">Gespeicherte Hersteller</h3>
          {isLoading ? (
            <div className="text-center py-4">Lade Hersteller...</div>
          ) : manufacturerDomains && manufacturerDomains.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Herstellername</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manufacturerDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        {editMode === domain.id ? (
                          <Input
                            value={newManufacturer.name}
                            onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
                          />
                        ) : (
                          domain.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editMode === domain.id ? (
                          <Input
                            value={newManufacturer.websiteUrl}
                            onChange={(e) =>
                              setNewManufacturer({ ...newManufacturer, websiteUrl: e.target.value })
                            }
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-blue-500" />
                            <a
                              href={domain.websiteUrl.startsWith("http") ? domain.websiteUrl : `https://${domain.websiteUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {normalizeUrl(domain.websiteUrl)}
                            </a>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={domain.isActive || false}
                          onCheckedChange={() => handleToggleActive(domain.id, domain.isActive || false)}
                          disabled={toggleActiveStatusMutation.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {editMode === domain.id ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditMode(null)}
                            >
                              Abbrechen
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUpdateManufacturer(
                                  domain.id,
                                  newManufacturer.name,
                                  newManufacturer.websiteUrl
                                )
                              }
                              disabled={updateManufacturerMutation.isPending}
                            >
                              Speichern
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditMode(domain.id);
                                setNewManufacturer({
                                  name: domain.name,
                                  websiteUrl: domain.websiteUrl,
                                });
                              }}
                            >
                              Bearbeiten
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteManufacturer(domain.id)}
                              disabled={deleteManufacturerMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed rounded-md">
              <p className="text-gray-500">Keine Hersteller vorhanden. Fügen Sie Hersteller hinzu, um die Suchergebnisse zu verbessern.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}