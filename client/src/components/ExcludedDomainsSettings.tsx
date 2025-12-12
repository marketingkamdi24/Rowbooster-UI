import { useState } from "react";
import { ExcludedDomain } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Ban, Trash2, Plus, Globe, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ExcludedDomainsSettings() {
  const [newDomain, setNewDomain] = useState({ domain: "", reason: "" });
  const [editMode, setEditMode] = useState<number | null>(null);

  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // Fetch excluded domains
  const { data: excludedDomains, isLoading } = useQuery<ExcludedDomain[]>({
    queryKey: ["/api/excluded-domains"],
  });

  // Add a new excluded domain
  const addDomainMutation = useMutation({
    mutationFn: async (domain: { domain: string; reason: string; isActive: boolean }) => {
      return await apiRequest("POST", "/api/excluded-domains", domain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excluded-domains"] });
      setNewDomain({ domain: "", reason: "" });
      toast({
        title: "Domäne ausgeschlossen",
        description: "Die Domäne wurde erfolgreich zur Ausschlussliste hinzugefügt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Hinzufügen der Domäne: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Update an excluded domain
  const updateDomainMutation = useMutation({
    mutationFn: async (data: { id: number; domain: Partial<ExcludedDomain> }) => {
      return await apiRequest("PUT", `/api/excluded-domains/${data.id}`, data.domain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excluded-domains"] });
      setEditMode(null);
      toast({
        title: "Domäne aktualisiert",
        description: "Die ausgeschlossene Domäne wurde erfolgreich aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Aktualisieren der Domäne: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Delete an excluded domain
  const deleteDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/excluded-domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excluded-domains"] });
      toast({
        title: "Domäne entfernt",
        description: "Die Domäne wurde erfolgreich von der Ausschlussliste entfernt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Entfernen der Domäne: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Toggle domain active status
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async (data: { id: number; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/excluded-domains/${data.id}`, { isActive: data.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/excluded-domains"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Ändern des Status: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Handle adding a new excluded domain
  const handleAddDomain = () => {
    if (!newDomain.domain) {
      toast({
        title: "Fehlende Daten",
        description: "Bitte geben Sie eine Domäne ein.",
        variant: "destructive",
      });
      return;
    }

    // Format domain (remove protocol, www, etc.)
    let formattedDomain = newDomain.domain.trim().toLowerCase();
    formattedDomain = formattedDomain.replace(/^(https?:\/\/)?(www\.)?/i, "").replace(/\/.*$/, "");

    if (!formattedDomain) {
      toast({
        title: "Ungültige Domäne",
        description: "Bitte geben Sie eine gültige Domäne ein (z.B. youtube.com).",
        variant: "destructive",
      });
      return;
    }

    // Add domain to the exclusion list
    addDomainMutation.mutate({
      domain: formattedDomain,
      reason: newDomain.reason.trim(),
      isActive: true,
    });
  };

  // Handle updating an excluded domain
  const handleUpdateDomain = (id: number, domain: string, reason: string) => {
    // Format domain (remove protocol, www, etc.)
    let formattedDomain = domain.trim().toLowerCase();
    formattedDomain = formattedDomain.replace(/^(https?:\/\/)?(www\.)?/i, "").replace(/\/.*$/, "");

    if (!formattedDomain) {
      toast({
        title: "Ungültige Domäne",
        description: "Bitte geben Sie eine gültige Domäne ein (z.B. youtube.com).",
        variant: "destructive",
      });
      return;
    }

    updateDomainMutation.mutate({
      id,
      domain: { domain: formattedDomain, reason: reason.trim() },
    });
  };

  // Handle toggling a domain's active status
  const handleToggleActive = (id: number, currentStatus: boolean) => {
    toggleActiveStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  // Handle deleting an excluded domain
  const handleDeleteDomain = (id: number) => {
    if (confirm("Sind Sie sicher, dass Sie diese Domäne von der Ausschlussliste entfernen möchten?")) {
      deleteDomainMutation.mutate(id);
    }
  };

  // Function to display domain in a nice format
  const formatDomain = (domain: string): string => {
    return domain.replace(/^(https?:\/\/)?(www\.)?/i, "").replace(/\/+$/, "");
  };

  return (
    <Card>
      <CardHeader className="p-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-600" />
          Ausgeschlossene Domänen
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="bg-red-50 p-4 rounded-md mb-6">
          <h3 className="text-sm font-medium text-red-800 mb-2">Hinweis</h3>
          <p className="text-sm text-red-700">
            Fügen Sie Domänen hinzu, die aus Ihren Suchergebnissen ausgeschlossen werden sollen. 
            Inhalte von diesen Domänen werden in den Suchergebnissen nicht angezeigt oder verarbeitet.
            Beispiel: youtube.com, pinterest.com
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="excluded-domain" className="text-sm font-medium">
                Domäne
              </Label>
              <Input
                id="excluded-domain"
                placeholder="z.B. youtube.com"
                value={newDomain.domain}
                onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Geben Sie nur den Domainnamen ein, ohne http:// oder www.
              </p>
            </div>
            <div>
              <Label htmlFor="reason" className="text-sm font-medium">
                Grund (optional)
              </Label>
              <Input
                id="reason"
                placeholder="z.B. Enthält keine technischen Spezifikationen"
                value={newDomain.reason}
                onChange={(e) => setNewDomain({ ...newDomain, reason: e.target.value })}
              />
            </div>
          </div>
          <Button
            onClick={handleAddDomain}
            className="w-full md:w-auto"
            disabled={addDomainMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Domäne hinzufügen
          </Button>
        </div>

        <div className="mt-8">
          <h3 className="text-md font-medium mb-4">Ausgeschlossene Domänen</h3>
          {isLoading ? (
            <div className="text-center py-4">Lade Domänen...</div>
          ) : excludedDomains && excludedDomains.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domäne</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excludedDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        {editMode === domain.id ? (
                          <Input
                            value={newDomain.domain}
                            onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-red-500" />
                            <span className="font-medium">{formatDomain(domain.domain)}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {editMode === domain.id ? (
                          <Input
                            value={newDomain.reason}
                            onChange={(e) => setNewDomain({ ...newDomain, reason: e.target.value })}
                          />
                        ) : (
                          domain.reason || "-"
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
                                handleUpdateDomain(
                                  domain.id,
                                  newDomain.domain,
                                  newDomain.reason
                                )
                              }
                              disabled={updateDomainMutation.isPending}
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
                                setNewDomain({
                                  domain: domain.domain,
                                  reason: domain.reason || "",
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteDomain(domain.id)}
                              disabled={deleteDomainMutation.isPending}
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
              <p className="text-gray-500">
                Keine ausgeschlossenen Domänen vorhanden. Fügen Sie Domänen hinzu, um sie von der Suche auszuschließen.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}