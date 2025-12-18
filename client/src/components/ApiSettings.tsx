import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Info, CheckCircle2, Search, Sparkles, BrainCircuit, Globe, Shield, Loader2, Trash2, RefreshCw, AlertCircle } from "lucide-react";

interface ApiSettingsProps {
  onApiKeyChange: (apiKey: string) => void;
  onUseAIChange: (useAI: boolean) => void;
  onValueSerpApiKeyChange?: (apiKey: string) => void;
  onUseValueSerpChange?: (useValueSerp: boolean) => void;
}

interface ApiKeyStatus {
  userId: number;
  keys: {
    openai: {
      configured: boolean;
      source: 'user' | 'environment' | 'none';
    };
    valueserp: {
      configured: boolean;
      source: 'user' | 'environment' | 'none';
    };
  };
}

export default function ApiSettings({
  onApiKeyChange,
  onUseAIChange,
  onValueSerpApiKeyChange,
  onUseValueSerpChange,
}: ApiSettingsProps) {
  const queryClient = useQueryClient();
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [valueSerpApiKey, setValueSerpApiKey] = useState<string>("");
  const [useAI, setUseAI] = useState<boolean>(false);
  const [useValueSerp, setUseValueSerp] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<'openai' | 'valueserp' | null>(null);
  
  const openaiApiKeyRef = useRef<HTMLInputElement>(null);
  const valueSerpApiKeyRef = useRef<HTMLInputElement>(null);

  // Fetch API key status from server (secure - never reveals actual keys)
  const apiKeyStatusQuery = useQuery<ApiKeyStatus>({
    queryKey: ['/api/user/api-keys'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API key status');
      return response.json();
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Mutation to store API key securely on server
  const storeApiKeyMutation = useMutation({
    mutationFn: async ({ keyType, apiKey }: { keyType: 'openai' | 'valueserp'; apiKey: string }) => {
      const response = await apiRequest('POST', `/api/user/api-keys/${keyType}`, { apiKey });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to store API key');
      }
      return response.json();
    },
    onSuccess: (_, { keyType }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] });
      toast({
        title: "API-Schlüssel sicher gespeichert",
        description: `Ihr ${keyType === 'openai' ? 'OpenAI' : 'ValueSERP'} API-Schlüssel wurde verschlüsselt und sicher gespeichert.`,
      });
      // Clear the input field after successful save
      if (keyType === 'openai') {
        setOpenaiApiKey('');
        if (openaiApiKeyRef.current) openaiApiKeyRef.current.value = '';
      } else {
        setValueSerpApiKey('');
        if (valueSerpApiKeyRef.current) valueSerpApiKeyRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast({
        title: "API-Schlüssel konnte nicht gespeichert werden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete API key
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyType: 'openai' | 'valueserp') => {
      const response = await apiRequest('DELETE', `/api/user/api-keys/${keyType}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete API key');
      }
      return response.json();
    },
    onSuccess: (_, keyType) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] });
      toast({
        title: "API-Schlüssel entfernt",
        description: `Ihr ${keyType === 'openai' ? 'OpenAI' : 'ValueSERP'} API-Schlüssel wurde sicher entfernt.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "API-Schlüssel konnte nicht entfernt werden",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to test API key
  const testApiKeyMutation = useMutation({
    mutationFn: async ({ keyType, apiKey }: { keyType: 'openai' | 'valueserp'; apiKey: string }) => {
      setTestingKey(keyType);
      const response = await apiRequest('POST', `/api/user/api-keys/${keyType}/test`, { apiKey });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to test API key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTestingKey(null);
      if (data.valid) {
        toast({
          title: "API-Schlüssel gültig",
          description: data.message,
        });
      } else {
        toast({
          title: "API-Schlüssel ungültig",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setTestingKey(null);
      toast({
        title: "Test fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load UI preferences from localStorage (not sensitive data)
  useEffect(() => {
    const savedUseAI = localStorage.getItem("use_ai") === "true";
    const savedUseValueSerp = localStorage.getItem("use_valueserp") === "true";
    
    setUseAI(savedUseAI);
    onUseAIChange(savedUseAI);
    
    setUseValueSerp(savedUseValueSerp);
    if (onUseValueSerpChange) {
      onUseValueSerpChange(savedUseValueSerp);
    }
  }, [onApiKeyChange, onUseAIChange, onValueSerpApiKeyChange, onUseValueSerpChange]);

  // Update parent when API key status changes (signal that key is available, not the actual key)
  useEffect(() => {
    if (apiKeyStatusQuery.data) {
      const { keys } = apiKeyStatusQuery.data;
      // Signal to parent that keys are available (doesn't expose actual keys)
      onApiKeyChange(keys.openai.configured ? 'server-stored' : '');
      if (onValueSerpApiKeyChange) {
        onValueSerpApiKeyChange(keys.valueserp.configured ? 'server-stored' : '');
      }
    }
  }, [apiKeyStatusQuery.data, onApiKeyChange, onValueSerpApiKeyChange]);

  // Handle useAI toggle
  const handleUseAIToggle = (checked: boolean) => {
    setUseAI(checked);
    onUseAIChange(checked);
    localStorage.setItem("use_ai", String(checked));
    
    const openaiConfigured = apiKeyStatusQuery.data?.keys.openai.configured || 
                             apiKeyStatusQuery.data?.keys.openai.source === 'environment';
    
    if (checked && !openaiConfigured) {
      toast({
        title: "OpenAI API-Schlüssel erforderlich",
        description: "Bitte geben Sie Ihren OpenAI API-Schlüssel ein, um die KI-gestützte Extraktion zu verwenden.",
        variant: "destructive",
      });
    }
  };

  // Handle ValueSERP toggle
  const handleUseValueSerpToggle = (checked: boolean) => {
    setUseValueSerp(checked);
    if (onUseValueSerpChange) {
      onUseValueSerpChange(checked);
    }
    localStorage.setItem("use_valueserp", String(checked));
    
    const valueSerpConfigured = apiKeyStatusQuery.data?.keys.valueserp.configured || 
                                apiKeyStatusQuery.data?.keys.valueserp.source === 'environment';
    
    if (checked && !valueSerpConfigured) {
      toast({
        title: "ValueSERP API-Schlüssel erforderlich",
        description: "Bitte geben Sie Ihren ValueSERP API-Schlüssel ein, um die ValueSERP-Suche zu verwenden.",
        variant: "destructive",
      });
    }
  };

  // Save OpenAI API key securely on server
  const handleSaveOpenAIKey = () => {
    const key = openaiApiKeyRef.current?.value || openaiApiKey;
    if (!key || key.trim() === "") {
      toast({
        title: "API-Schlüssel erforderlich",
        description: "Bitte geben Sie einen gültigen OpenAI API-Schlüssel ein.",
        variant: "destructive",
      });
      return;
    }
    storeApiKeyMutation.mutate({ keyType: 'openai', apiKey: key.trim() });
  };

  // Save ValueSERP API key securely on server
  const handleSaveValueSerpKey = () => {
    const key = valueSerpApiKeyRef.current?.value || valueSerpApiKey;
    if (!key || key.trim() === "") {
      toast({
        title: "API-Schlüssel erforderlich",
        description: "Bitte geben Sie einen gültigen ValueSERP API-Schlüssel ein.",
        variant: "destructive",
      });
      return;
    }
    storeApiKeyMutation.mutate({ keyType: 'valueserp', apiKey: key.trim() });
  };

  // Test API key before saving
  const handleTestKey = (keyType: 'openai' | 'valueserp') => {
    const key = keyType === 'openai' 
      ? (openaiApiKeyRef.current?.value || openaiApiKey)
      : (valueSerpApiKeyRef.current?.value || valueSerpApiKey);
    
    if (!key || key.trim() === "") {
      toast({
        title: "API-Schlüssel erforderlich",
        description: "Bitte geben Sie einen API-Schlüssel zum Testen ein.",
        variant: "destructive",
      });
      return;
    }
    testApiKeyMutation.mutate({ keyType, apiKey: key.trim() });
  };

  if (apiKeyStatusQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-24 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>API-Konfiguration wird geladen...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openaiStatus = apiKeyStatusQuery.data?.keys.openai;
  const valueSerpStatus = apiKeyStatusQuery.data?.keys.valueserp;

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <div className="bg-[rgba(200,250,100,0.1)] border border-[rgba(200,250,100,0.2)] rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
        <Shield className="h-5 w-5 text-[var(--rb-lime)] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-medium text-[var(--rb-lime)]">Sichere API-Schlüssel-Speicherung</h4>
          <p className="text-xs sm:text-sm text-white/70 mt-1 break-words">
            Ihre API-Schlüssel werden mit AES-256-GCM verschlüsselt und sicher auf dem Server gespeichert. Schlüssel werden nach der ersten Eingabe nie mehr im Browser angezeigt.
          </p>
        </div>
      </div>

      {/* AI Configuration Section */}
      <Card className="bg-black/20 backdrop-blur-sm border-white/10">
        <CardHeader className="p-3 sm:p-4 border-b border-white/10">
          <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--rb-lime)] flex-shrink-0" />
            <span className="hidden sm:inline">KI-gestützte Extraktions-Einstellungen</span>
            <span className="sm:hidden">KI-Einstellungen</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-toggle" className="cursor-pointer text-white/90">KI-gestützte Extraktion aktivieren</Label>
            </div>
            <Switch 
              id="ai-toggle" 
              checked={useAI} 
              onCheckedChange={handleUseAIToggle}
            />
          </div>
          
          {useAI && (
            <div className="space-y-6">
              <div className="bg-black/30 p-3 rounded-xl border border-white/10 text-sm flex gap-2">
                <Info className="h-5 w-5 text-[var(--rb-cyan)] flex-shrink-0" />
                <p className="text-white/70">
                  Die KI-Verbesserung analysiert Produktinformationen mit OpenAI GPT-4.1, um die Extraktionsgenauigkeit zu verbessern.
                </p>
              </div>
              
              {/* OpenAI Key Input */}
              <div className="p-4 rounded-xl border border-white/10 bg-black/20">
                <Label className="text-sm text-white/90 font-medium mb-2 block flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-[var(--rb-lime)]" />
                  OpenAI API Key (GPT-4.1)
                </Label>
                
                {openaiStatus?.source === 'environment' ? (
                  <div className="flex items-center gap-2 p-3 bg-[rgba(200,250,100,0.1)] rounded-xl border border-[rgba(200,250,100,0.2)]">
                    <CheckCircle2 className="h-5 w-5 text-[var(--rb-lime)]" />
                    <p className="text-sm text-white/80">
                      OpenAI API-Schlüssel aus Umgebungsvariablen wird verwendet.
                    </p>
                  </div>
                ) : openaiStatus?.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-[rgba(200,250,100,0.1)] rounded-xl border border-[rgba(200,250,100,0.2)]">
                      <CheckCircle2 className="h-5 w-5 text-[var(--rb-lime)]" />
                      <div className="flex-1">
                        <p className="text-sm text-white/80">
                          OpenAI API-Schlüssel ist sicher gespeichert und verschlüsselt.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteApiKeyMutation.mutate('openai')}
                        disabled={deleteApiKeyMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleteApiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Option to update key */}
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-sm text-white/60 mb-2 flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" />
                        API-Schlüssel aktualisieren (neuen Schlüssel eingeben)
                      </p>
                      <div className="relative">
                        <input
                          ref={openaiApiKeyRef}
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          placeholder="Neuen OpenAI API-Schlüssel eingeben"
                          className="w-full h-10 px-3 py-2 bg-black/30 border border-white/15 rounded-xl pr-9 text-white placeholder:text-white/40 focus:border-[var(--rb-cyan)] focus:outline-none"
                        />
                        <Key className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestKey('openai')}
                          disabled={!openaiApiKey || testingKey === 'openai'}
                        >
                          {testingKey === 'openai' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Schlüssel testen
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveOpenAIKey}
                          disabled={!openaiApiKey || storeApiKeyMutation.isPending}
                        >
                          {storeApiKeyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Schlüssel aktualisieren
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-[rgba(251,191,36,0.1)] rounded-xl border border-[rgba(251,191,36,0.2)]">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      <p className="text-sm text-white/80">
                        Kein OpenAI API-Schlüssel konfiguriert. Geben Sie unten Ihren Schlüssel ein, um KI-Funktionen zu aktivieren.
                      </p>
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          ref={openaiApiKeyRef}
                          type="password"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          placeholder="sk-proj-..."
                          className="w-full h-10 px-3 py-2 bg-black/30 border border-white/15 rounded-xl pr-9 text-white placeholder:text-white/40 focus:border-[var(--rb-cyan)] focus:outline-none"
                        />
                        <Key className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                      </div>
                      <p className="text-xs text-white/50 mt-1">Ihr Schlüssel wird verschlüsselt und sicher gespeichert</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handleTestKey('openai')}
                        disabled={!openaiApiKey || testingKey === 'openai'}
                      >
                        {testingKey === 'openai' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Schlüssel testen
                      </Button>
                      <Button
                        onClick={handleSaveOpenAIKey}
                        disabled={!openaiApiKey || storeApiKeyMutation.isPending}
                      >
                        {storeApiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Shield className="h-4 w-4 mr-1" />
                        )}
                        Sicher speichern
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Engine API Section */}
      <Card className="bg-black/20 backdrop-blur-sm border-white/10">
        <CardHeader className="p-4 border-b border-white/10">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-[var(--rb-cyan)]" />
            Such-API-Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--rb-cyan)]" />
                <Label htmlFor="valueserp-toggle" className="cursor-pointer text-white/90 font-medium">
                  ValueSERP als Suchanbieter verwenden
                </Label>
              </div>
              <Switch 
                id="valueserp-toggle" 
                checked={useValueSerp} 
                onCheckedChange={handleUseValueSerpToggle}
              />
            </div>
            
            {useValueSerp && (
              <div className="space-y-4 mt-4">
                {valueSerpStatus?.source === 'environment' ? (
                  <div className="flex items-center gap-2 p-3 bg-[rgba(200,250,100,0.1)] rounded-xl border border-[rgba(200,250,100,0.2)]">
                    <CheckCircle2 className="h-5 w-5 text-[var(--rb-lime)]" />
                    <p className="text-sm text-white/80">
                      ValueSERP API-Schlüssel aus Umgebungsvariablen wird verwendet.
                    </p>
                  </div>
                ) : valueSerpStatus?.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-[rgba(200,250,100,0.1)] rounded-xl border border-[rgba(200,250,100,0.2)]">
                      <CheckCircle2 className="h-5 w-5 text-[var(--rb-lime)]" />
                      <div className="flex-1">
                        <p className="text-sm text-white/80">
                          ValueSERP API-Schlüssel ist sicher gespeichert und verschlüsselt.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteApiKeyMutation.mutate('valueserp')}
                        disabled={deleteApiKeyMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleteApiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Option to update key */}
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-sm text-white/60 mb-2 flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" />
                        API-Schlüssel aktualisieren
                      </p>
                      <div className="relative">
                        <input
                          ref={valueSerpApiKeyRef}
                          type="password"
                          value={valueSerpApiKey}
                          onChange={(e) => setValueSerpApiKey(e.target.value)}
                          placeholder="Neuen ValueSERP API-Schlüssel eingeben"
                          className="w-full h-10 px-3 py-2 bg-black/30 border border-white/15 rounded-xl pr-9 text-white placeholder:text-white/40 focus:border-[var(--rb-cyan)] focus:outline-none"
                        />
                        <Key className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestKey('valueserp')}
                          disabled={!valueSerpApiKey || testingKey === 'valueserp'}
                        >
                          {testingKey === 'valueserp' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Schlüssel testen
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveValueSerpKey}
                          disabled={!valueSerpApiKey || storeApiKeyMutation.isPending}
                        >
                          {storeApiKeyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          Schlüssel aktualisieren
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-[rgba(251,191,36,0.1)] rounded-xl border border-[rgba(251,191,36,0.2)]">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      <p className="text-sm text-white/80">
                        Kein ValueSERP API-Schlüssel konfiguriert. Geben Sie unten Ihren Schlüssel ein.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="valueserp-api-key" className="text-sm text-white/90 font-medium">ValueSERP API-Schlüssel</Label>
                      <div className="relative mt-1">
                        <input
                          id="valueserp-api-key"
                          ref={valueSerpApiKeyRef}
                          type="password"
                          value={valueSerpApiKey}
                          onChange={(e) => setValueSerpApiKey(e.target.value)}
                          placeholder="Geben Sie Ihren ValueSERP API-Schlüssel ein"
                          className="w-full h-10 px-3 py-2 bg-black/30 border border-white/15 rounded-xl pr-9 text-white placeholder:text-white/40 focus:border-[var(--rb-cyan)] focus:outline-none"
                        />
                        <Key className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                      </div>
                      <p className="text-xs text-white/50 mt-1">Ihr Schlüssel wird verschlüsselt und sicher gespeichert</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handleTestKey('valueserp')}
                        disabled={!valueSerpApiKey || testingKey === 'valueserp'}
                      >
                        {testingKey === 'valueserp' ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Schlüssel testen
                      </Button>
                      <Button
                        onClick={handleSaveValueSerpKey}
                        disabled={!valueSerpApiKey || storeApiKeyMutation.isPending}
                      >
                        {storeApiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Shield className="h-4 w-4 mr-1" />
                        )}
                        Sicher speichern
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}