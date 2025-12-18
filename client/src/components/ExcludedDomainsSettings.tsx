import { useState } from "react";
import { ExcludedDomain } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Ban, Trash2, Plus, Globe, Edit, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
    <div className="p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.08]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center">
          <Ban className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Ausgeschlossene Domänen</h3>
          <p className="text-sm text-white/50">Schließen Sie unerwünschte Quellen aus</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-white/70">
          Fügen Sie Domänen hinzu, die aus Ihren Suchergebnissen ausgeschlossen werden sollen. 
          Beispiel: youtube.com, pinterest.com
        </p>
      </div>

      {/* Add New Domain Form */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="excluded-domain" className="text-sm font-medium text-white/70 mb-2 block">
              Domäne
            </Label>
            <Input
              id="excluded-domain"
              placeholder="z.B. youtube.com"
              value={newDomain.domain}
              onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
              className="h-11 bg-black/30 border-white/[0.1] text-white placeholder:text-white/40 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            />
            <p className="text-xs text-white/40 mt-1">
              Nur Domainnamen, ohne http:// oder www.
            </p>
          </div>
          <div>
            <Label htmlFor="reason" className="text-sm font-medium text-white/70 mb-2 block">
              Grund (optional)
            </Label>
            <Input
              id="reason"
              placeholder="z.B. Keine technischen Daten"
              value={newDomain.reason}
              onChange={(e) => setNewDomain({ ...newDomain, reason: e.target.value })}
              className="h-11 bg-black/30 border-white/[0.1] text-white placeholder:text-white/40 rounded-xl focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
        </div>
        <button
          onClick={handleAddDomain}
          disabled={addDomainMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold text-sm rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] disabled:opacity-50"
        >
          {addDomainMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Domäne ausschließen
        </button>
      </div>

      {/* Excluded Domains List */}
      <div>
        <h4 className="text-sm font-semibold text-white/80 mb-4">Ausgeschlossene Domänen</h4>
        {isLoading ? (
          <div className="text-center py-8 text-white/50 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Lade Domänen...
          </div>
        ) : excludedDomains && excludedDomains.length > 0 ? (
          <div className="space-y-3">
            {excludedDomains.map((domain) => (
              <div 
                key={domain.id} 
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  editMode === domain.id 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12]'
                }`}
              >
                {editMode === domain.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={newDomain.domain}
                        onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                        placeholder="Domäne"
                        className="h-10 bg-black/30 border-white/[0.1] text-white rounded-lg"
                      />
                      <Input
                        value={newDomain.reason}
                        onChange={(e) => setNewDomain({ ...newDomain, reason: e.target.value })}
                        placeholder="Grund (optional)"
                        className="h-10 bg-black/30 border-white/[0.1] text-white rounded-lg"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMode(null)}
                        className="border-white/[0.1] text-white/70 hover:bg-white/[0.1] hover:text-white"
                      >
                        Abbrechen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateDomain(domain.id, newDomain.domain, newDomain.reason)}
                        disabled={updateDomainMutation.isPending}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        {updateDomainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="h-4 w-4 text-red-400 flex-shrink-0" />
                        <span className="font-semibold text-white truncate">{formatDomain(domain.domain)}</span>
                        {domain.isActive && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-medium rounded-full border border-red-500/30">
                            <CheckCircle2 className="h-3 w-3" /> Aktiv
                          </span>
                        )}
                      </div>
                      {domain.reason && (
                        <p className="text-sm text-white/50 truncate">{domain.reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={domain.isActive || false}
                        onCheckedChange={() => handleToggleActive(domain.id, domain.isActive || false)}
                        disabled={toggleActiveStatusMutation.isPending}
                        className="data-[state=checked]:bg-red-500"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditMode(domain.id);
                          setNewDomain({ domain: domain.domain, reason: domain.reason || "" });
                        }}
                        className="h-8 w-8 p-0 border-white/[0.1] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                        disabled={deleteDomainMutation.isPending}
                        className="h-8 w-8 p-0 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-white/[0.1] rounded-xl bg-white/[0.01]">
            <Ban className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Keine ausgeschlossenen Domänen</p>
            <p className="text-white/30 text-xs mt-1">Fügen Sie Domänen hinzu, um sie von der Suche auszuschließen</p>
          </div>
        )}
      </div>
    </div>
  );
}