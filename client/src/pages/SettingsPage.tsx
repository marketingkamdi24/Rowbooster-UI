import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Loader2,
  Check,
  Save,
  Database,
  Globe,
  ArrowLeft,
  Shield,
  Brain,
  Search,
  Sparkles,
  Zap
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ManufacturerSettings from "@/components/ManufacturerSettings";
import ExcludedDomainsSettings from "@/components/ExcludedDomainsSettings";
import UnifiedPropertiesManager from "@/components/UnifiedPropertiesManager";
import { useSearchTabsStore } from "@/stores/searchTabsStore";

// Settings page component
export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for form values
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [valueSerpApiKey, setValueSerpApiKey] = useState('');
  const [valueSerpLocation, setValueSerpLocation] = useState<string>('us');
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gpt-4.1-mini');
  
  // Use Zustand store for search settings (these are client-side preferences)
  const {
    maxResults,
    setMaxResults,
    parallelSearches,
    setParallelSearches,
  } = useSearchTabsStore();
  
  // Fetch current settings
  const settingsQuery = useQuery({
    queryKey: ['/api/settings'],
    async queryFn() {
      const response = await apiRequest('GET', '/api/settings');
      return response.json();
    }
  });
  
  // Fetch user's AI model preference
  const aiModelQuery = useQuery({
    queryKey: ['/api/user/ai-model'],
    async queryFn() {
      const response = await apiRequest('GET', '/api/user/ai-model');
      return response.json();
    }
  });
  
  // Mutation to save AI model preference
  const saveAiModelMutation = useMutation({
    mutationFn: async (model: string) => {
      const response = await apiRequest('PUT', '/api/user/ai-model', { selectedAiModel: model });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/ai-model'] });
      setSelectedAiModel(data.selectedAiModel);
      toast({
        title: "KI-Modell aktualisiert",
        description: `Jetzt wird ${data.selectedAiModel === 'gpt-4.1-mini' ? 'GPT-4.1 Mini (kostengünstig)' : 'GPT-4.1 (Standard)'} verwendet`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren des KI-Modells",
        description: (error as Error).message || "KI-Modell-Einstellung konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  });
  
  // Mutation to save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest('POST', '/api/settings', settings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Einstellungen gespeichert",
        description: "Ihre Einstellungen wurden erfolgreich gespeichert",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Speichern der Einstellungen",
        description: (error as Error).message || "Einstellungen konnten nicht gespeichert werden",
        variant: "destructive",
      });
    }
  });
  
  // Update form state when settings are fetched
  useEffect(() => {
    if (settingsQuery.data) {
      // Only update state if we have data
      setValueSerpLocation(settingsQuery.data.valueSerpLocation || 'us');
      
      // Search settings are managed by Zustand store (client-side)
      // Don't override from API - they persist in local storage
      
      // Don't set API keys - these should be entered by the user each time for security
    }
  }, [settingsQuery.data]);
  
  // Update AI model state when fetched
  useEffect(() => {
    if (aiModelQuery.data) {
      setSelectedAiModel(aiModelQuery.data.selectedAiModel || 'gpt-4.1-mini');
    }
  }, [aiModelQuery.data]);
  
  // Handle form submission (API settings only - search settings are in Zustand)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare settings data - only API settings, not search settings
    const settings = {
      openaiApiKey: openaiApiKey || undefined,
      valueSerpApiKey: valueSerpApiKey || undefined,
      valueSerpLocation,
    };
    
    // Save settings
    saveSettingsMutation.mutate(settings);
  };
  
  // Handle saving search settings to Zustand store
  const handleSaveSearchSettings = () => {
    // Settings are already synced to the store via the setters
    // Just show a success message
    toast({
      title: "Sucheinstellungen gespeichert",
      description: "Ihre Sucheinstellungen wurden lokal gespeichert",
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/20">
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Professional Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-0">
            <div className="relative">
              <div className="h-10 w-10 sm:h-14 sm:w-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <svg viewBox="0 0 32 32" className="w-5 h-5 sm:w-7 sm:h-7">
                  <defs>
                    <linearGradient id="settingsLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="50%" stopColor="#F8FAFC" />
                      <stop offset="100%" stopColor="#E2E8F0" />
                    </linearGradient>
                    <linearGradient id="settingsMagicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="50%" stopColor="#EAB308" />
                      <stop offset="100%" stopColor="#F97316" />
                    </linearGradient>
                  </defs>
                  
                  {/* Magical tabular grid - curved table cells */}
                  <path d="M 4 8 Q 16 6 28 8 Q 28 16 28 24 Q 16 26 4 24 Q 4 16 4 8 Z" 
                        fill="none" stroke="url(#settingsLogoGradient)" strokeWidth="1.5" opacity="0.8" />
                  <path d="M 6 11 Q 16 9.5 26 11 Q 26 16 26 21 Q 16 22.5 6 21 Q 6 16 6 11 Z" 
                        fill="none" stroke="url(#settingsLogoGradient)" strokeWidth="1.2" opacity="0.7" />
                  
                  {/* Floating data cells */}
                  <rect x="7" y="9" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.9" />
                  <rect x="13.25" y="8.5" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.9" />
                  <rect x="19.5" y="9" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.9" />
                  
                  <rect x="7" y="14" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.7" />
                  <rect x="13.25" y="13.8" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.8" />
                  <rect x="19.5" y="14" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.7" />
                  
                  <rect x="7" y="19" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.6" />
                  <rect x="13.25" y="19.2" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.7" />
                  <rect x="19.5" y="19" width="3.5" height="2" rx="0.5" fill="url(#settingsLogoGradient)" opacity="0.6" />
                  
                  {/* Central AI magical core */}
                  <circle cx="16" cy="16" r="2.5" fill="url(#settingsMagicGradient)" />
                  <circle cx="16" cy="16" r="1.5" fill="url(#settingsLogoGradient)" opacity="0.9" />
                  
                  {/* Settings gear overlay */}
                  <circle cx="16" cy="16" r="1" fill="url(#settingsMagicGradient)" opacity="0.8" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">Einstellungen</h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Konfigurieren Sie Ihre Anwendungseinstellungen und Integrationen</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-gray-300 hover:bg-gray-50 transition-colors shadow-sm self-start sm:size-lg" 
            asChild
          >
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Zurück zur Hauptseite</span>
              <span className="sm:hidden">Zurück</span>
            </a>
          </Button>
        </header>
        
        {/* Modern Tabs Layout */}
        <Tabs defaultValue="api-keys" className="w-full space-y-6 sm:space-y-8">
          <TabsList className="grid w-full grid-cols-4 h-12 sm:h-14 bg-gray-50 border border-gray-200 rounded-lg p-1">
            <TabsTrigger
              value="api-keys"
              className="flex items-center gap-1 sm:gap-2 h-10 sm:h-12 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all text-xs sm:text-sm"
            >
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">API-Schlüssel</span>
              <span className="sm:hidden">API</span>
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="flex items-center gap-1 sm:gap-2 h-10 sm:h-12 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-violet-600 transition-all text-xs sm:text-sm"
            >
              <Search className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Suche</span>
              <span className="sm:hidden">Suche</span>
            </TabsTrigger>
            <TabsTrigger
              value="properties"
              className="flex items-center gap-1 sm:gap-2 h-10 sm:h-12 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-purple-600 transition-all text-xs sm:text-sm"
            >
              <Database className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Eigenschaften</span>
              <span className="sm:hidden">Daten</span>
            </TabsTrigger>
            <TabsTrigger
              value="domains"
              className="flex items-center gap-1 sm:gap-2 h-10 sm:h-12 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 transition-all text-xs sm:text-sm"
            >
              <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Domains</span>
              <span className="sm:hidden">Web</span>
            </TabsTrigger>
          </TabsList>
          
          <form onSubmit={handleSubmit}>
            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="mt-6">
              <div className="max-w-4xl">
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">API-Konfiguration</h2>
                  <p className="text-sm sm:text-base text-gray-600">Verbinden Sie Ihre API-Schlüssel, um leistungsstarke KI- und Suchfunktionen zu aktivieren</p>
                </div>
                
                <div className="grid gap-6">
                  {/* OpenAI Section */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Brain className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">OpenAI</h3>
                            <p className="text-sm text-gray-500">GPT-4 basierte Inhaltsanalyse</p>
                          </div>
                        </div>
                        {settingsQuery.data?.hasOpenAiKey && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                            <Check className="h-4 w-4" />
                            Verbunden
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="openai-key" className="text-sm font-medium text-gray-700">API-Schlüssel</Label>
                        <Input
                          id="openai-key"
                          placeholder={settingsQuery.data?.hasOpenAiKey ? "●●●●●●●●●●●●●●●●" : "sk-proj-..."}
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          type="password"
                          className="h-12"
                        />
                        <Button 
                          type="button"
                          onClick={() => {
                            // Save individual API key
                            const settings = { openaiApiKey: openaiApiKey || undefined };
                            saveSettingsMutation.mutate(settings);
                          }}
                          disabled={!openaiApiKey || saveSettingsMutation.isPending}
                          className="w-full"
                        >
                          {saveSettingsMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Speichern...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              OpenAI-Schlüssel speichern
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* AI Model Selection Section */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Zap className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">KI-Modell Auswahl</h3>
                            <p className="text-sm text-gray-500">Wählen Sie Ihr bevorzugtes KI-Modell für die Datenextraktion</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ai-model" className="text-sm font-medium text-gray-700">KI-Modell auswählen</Label>
                          <Select
                            value={selectedAiModel}
                            onValueChange={(value) => {
                              setSelectedAiModel(value);
                              saveAiModelMutation.mutate(value);
                            }}
                          >
                            <SelectTrigger id="ai-model" className="h-12">
                              <SelectValue placeholder="KI-Modell wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gpt-4.1">
                                <div className="flex flex-col">
                                  <span className="font-medium">GPT-4.1 (Standard)</span>
                                  <span className="text-xs text-gray-500">Höhere Qualität, höhere Kosten</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4.1-mini">
                                <div className="flex flex-col">
                                  <span className="font-medium">GPT-4.1 Mini</span>
                                  <span className="text-xs text-gray-500">Kostengünstig, dennoch leistungsstark</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Model Info */}
                        <div className={`p-4 rounded-lg ${selectedAiModel === 'gpt-4.1-mini' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                          {selectedAiModel === 'gpt-4.1-mini' ? (
                            <div>
                              <p className="font-medium text-green-800">💰 Kostenspar-Modus</p>
                              <p className="text-sm text-green-700 mt-1">
                                GPT-4.1 Mini verwendet deutlich weniger Tokens pro Anfrage, wodurch Ihre API-Kosten gesenkt werden, während die Datenextraktion weiterhin präzise bleibt.
                              </p>
                              <p className="text-xs text-green-600 mt-2">
                                Preise: $0,40/1M Eingabe-Tokens, $1,60/1M Ausgabe-Tokens
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium text-blue-800">🚀 Standard-Modus</p>
                              <p className="text-sm text-blue-700 mt-1">
                                GPT-4.1 bietet die höchste Qualität bei der Datenextraktion mit maximaler Genauigkeit für komplexe technische Spezifikationen.
                              </p>
                              <p className="text-xs text-blue-600 mt-2">
                                Preise: $3,00/1M Eingabe-Tokens, $12,00/1M Ausgabe-Tokens
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {saveAiModelMutation.isPending && (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Modell-Einstellung wird gespeichert...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* ValueSERP Section */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Globe className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">ValueSERP</h3>
                              <p className="text-sm text-gray-500">Regionale Suchfunktionen</p>
                            </div>
                          </div>
                          {settingsQuery.data?.hasValueSerpApiKey && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                              <Check className="h-4 w-4" />
                              Verbunden
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valueserp-key" className="text-sm font-medium text-gray-700">API-Schlüssel</Label>
                          <Input
                            id="valueserp-key"
                            placeholder={settingsQuery.data?.hasValueSerpApiKey ? "●●●●●●●●●●●●●●●●" : "ValueSERP-Schlüssel eingeben"}
                            value={valueSerpApiKey}
                            onChange={(e) => setValueSerpApiKey(e.target.value)}
                            type="password"
                            className="h-12"
                          />
                          <Button 
                            type="button"
                            onClick={() => {
                              // Save individual API key
                              const settings = { valueSerpApiKey: valueSerpApiKey || undefined };
                              saveSettingsMutation.mutate(settings);
                            }}
                            disabled={!valueSerpApiKey || saveSettingsMutation.isPending}
                            className="w-full"
                          >
                            {saveSettingsMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Speichern...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                ValueSERP-Schlüssel speichern
                              </>
                            )}
                          </Button>
                        </div>

                      </CardContent>
                    </Card>
                  
                </div>
              </div>
            </TabsContent>
            
            {/* Search Settings Tab */}
            <TabsContent value="search" className="mt-6">
              <div className="max-w-4xl">
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">Sucheinstellungen</h2>
                  <p className="text-sm sm:text-base text-gray-600">Konfigurieren Sie das Suchverhalten und die Leistungsoptionen</p>
                </div>
                
                <div className="grid gap-6">
                  {/* Max Results Setting */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Search className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">Maximale Suchergebnisse</h3>
                            <p className="text-sm text-gray-500">Anzahl der Web-Ergebnisse pro Suche (1-12)</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={maxResults}
                            onChange={(e) => setMaxResults(parseInt(e.target.value) || 10)}
                            className="w-24 h-12 text-center text-lg font-medium"
                          />
                          <span className="text-sm text-gray-500">Webseiten pro Produkt-Suche</span>
                        </div>
                        <p className="text-xs text-gray-400">Höhere Werte können bessere Ergebnisse liefern, benötigen aber mehr Zeit und API-Credits.</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Parallel Searches Setting */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Zap className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">Parallele Verarbeitung</h3>
                            <p className="text-sm text-gray-500">Anzahl gleichzeitiger Produkt-Verarbeitungen (1-10)</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={parallelSearches}
                            onChange={(e) => setParallelSearches(parseInt(e.target.value) || 3)}
                            className="w-24 h-12 text-center text-lg font-medium"
                          />
                          <span className="text-sm text-gray-500">Produkte gleichzeitig verarbeiten</span>
                        </div>
                        <p className="text-xs text-gray-400">Höhere Werte beschleunigen Batch-Verarbeitung, können aber die Serverauslastung erhöhen.</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Save Search Settings Button */}
                  <Button
                    type="button"
                    onClick={handleSaveSearchSettings}
                    className="w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Sucheinstellungen speichern
                  </Button>
                  
                  {/* Info note about local storage */}
                  <p className="text-xs text-gray-500 mt-2">
                    ℹ️ Sucheinstellungen werden lokal in Ihrem Browser gespeichert und sind sofort aktiv.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            {/* Properties Tab */}
            <TabsContent value="properties" className="mt-6">
              <div className="max-w-4xl">
                <UnifiedPropertiesManager />
              </div>
            </TabsContent>

            {/* Domains Tab */}
            <TabsContent value="domains" className="mt-6">
              <div className="max-w-4xl space-y-6">
                <ManufacturerSettings />
                <ExcludedDomainsSettings />
              </div>
            </TabsContent>
            
            {/* Professional Save Button */}
            <div className="mt-12 pt-6 border-t border-gray-200">
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={saveSettingsMutation.isPending}
                  size="lg"
                  className="gap-2 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Einstellungen speichern
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Tabs>
      </div>
    </div>
  );
}