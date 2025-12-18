import { useState, useEffect } from "react";
import { ManufacturerDomain } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Factory, Trash2, Globe, Plus, Edit, Loader2, CheckCircle2, Info } from "lucide-react";
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
    <div className="p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.08]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#17c3ce] to-[#0ea5e9] shadow-[0_0_20px_rgba(23,195,206,0.4)] flex items-center justify-center">
          <Factory className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Hersteller & Domänen Priorisierung</h3>
          <p className="text-sm text-white/50">Priorisieren Sie Suchergebnisse von Herstellerseiten</p>
        </div>
      </div>

      {/* Toggle Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-6">
        <div className="flex-1">
          <Label htmlFor="domain-prioritization" className="text-sm font-semibold text-white cursor-pointer">
            Domänen-Priorisierung aktivieren
          </Label>
          <p className="text-xs text-white/50 mt-1">
            Suchergebnisse von Herstellerwebseiten werden höher gewichtet
          </p>
        </div>
        <Switch
          id="domain-prioritization"
          checked={domainPrioritizationEnabled}
          onCheckedChange={handleDomainPrioritizationToggle}
          className="data-[state=checked]:bg-[#17c3ce]"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-[#17c3ce]/10 border border-[#17c3ce]/20 p-4 rounded-xl mb-6 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#17c3ce] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-white/70">
          Fügen Sie Ihre wichtigsten Hersteller hinzu, um die Relevanz der Suchergebnisse zu verbessern.
        </p>
      </div>

      {/* Add New Manufacturer Form */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="manufacturer-name" className="text-sm font-medium text-white/70 mb-2 block">
              Herstellername
            </Label>
            <Input
              id="manufacturer-name"
              placeholder="z.B. Beefer GmbH"
              value={newManufacturer.name}
              onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
              className="h-11 bg-black/30 border-white/[0.1] text-white placeholder:text-white/40 rounded-xl focus:border-[#17c3ce]/50 focus:ring-2 focus:ring-[#17c3ce]/20"
            />
          </div>
          <div>
            <Label htmlFor="website-url" className="text-sm font-medium text-white/70 mb-2 block">
              Website URL
            </Label>
            <Input
              id="website-url"
              placeholder="z.B. https://www.beefer.com"
              value={newManufacturer.websiteUrl}
              onChange={(e) => setNewManufacturer({ ...newManufacturer, websiteUrl: e.target.value })}
              className="h-11 bg-black/30 border-white/[0.1] text-white placeholder:text-white/40 rounded-xl focus:border-[#17c3ce]/50 focus:ring-2 focus:ring-[#17c3ce]/20"
            />
          </div>
        </div>
        <button 
          onClick={handleAddManufacturer} 
          disabled={addManufacturerMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#17c3ce] to-[#0ea5e9] hover:from-[#14b8c4] hover:to-[#0d9cd8] text-white font-semibold text-sm rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(23,195,206,0.3)] hover:shadow-[0_0_30px_rgba(23,195,206,0.5)] disabled:opacity-50"
        >
          {addManufacturerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Hersteller hinzufügen
        </button>
      </div>

      {/* Manufacturers List */}
      <div>
        <h4 className="text-sm font-semibold text-white/80 mb-4">Gespeicherte Hersteller</h4>
        {isLoading ? (
          <div className="text-center py-8 text-white/50 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Lade Hersteller...
          </div>
        ) : manufacturerDomains && manufacturerDomains.length > 0 ? (
          <div className="space-y-3">
            {manufacturerDomains.map((domain) => (
              <div 
                key={domain.id} 
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  editMode === domain.id 
                    ? 'bg-[#17c3ce]/10 border-[#17c3ce]/30' 
                    : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12]'
                }`}
              >
                {editMode === domain.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={newManufacturer.name}
                        onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
                        placeholder="Herstellername"
                        className="h-10 bg-black/30 border-white/[0.1] text-white rounded-lg"
                      />
                      <Input
                        value={newManufacturer.websiteUrl}
                        onChange={(e) => setNewManufacturer({ ...newManufacturer, websiteUrl: e.target.value })}
                        placeholder="Website URL"
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
                        onClick={() => handleUpdateManufacturer(domain.id, newManufacturer.name, newManufacturer.websiteUrl)}
                        disabled={updateManufacturerMutation.isPending}
                        className="bg-[#17c3ce] hover:bg-[#14b8c4] text-white"
                      >
                        {updateManufacturerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{domain.name}</span>
                        {domain.isActive && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#c8fa64]/20 text-[#c8fa64] text-[10px] font-medium rounded-full border border-[#c8fa64]/30">
                            <CheckCircle2 className="h-3 w-3" /> Aktiv
                          </span>
                        )}
                      </div>
                      <a
                        href={domain.websiteUrl.startsWith("http") ? domain.websiteUrl : `https://${domain.websiteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#17c3ce] hover:text-[#14b8c4] flex items-center gap-1 truncate"
                      >
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        {normalizeUrl(domain.websiteUrl)}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={domain.isActive || false}
                        onCheckedChange={() => handleToggleActive(domain.id, domain.isActive || false)}
                        disabled={toggleActiveStatusMutation.isPending}
                        className="data-[state=checked]:bg-[#c8fa64]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditMode(domain.id);
                          setNewManufacturer({ name: domain.name, websiteUrl: domain.websiteUrl });
                        }}
                        className="h-8 w-8 p-0 border-white/[0.1] text-white/60 hover:bg-white/[0.1] hover:text-white"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteManufacturer(domain.id)}
                        disabled={deleteManufacturerMutation.isPending}
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
            <Factory className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Keine Hersteller vorhanden</p>
            <p className="text-white/30 text-xs mt-1">Fügen Sie Hersteller hinzu, um die Suchergebnisse zu verbessern</p>
          </div>
        )}
      </div>
    </div>
  );
}