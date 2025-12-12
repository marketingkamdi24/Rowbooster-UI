import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, 
  Key, 
  Info, 
  CheckCircle2,
  BrainCircuit,
  Shield,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ApiKeyInputProps {
  onApiKeyChange: (apiKey: string) => void;
  onUseAIChange: (useAI: boolean) => void;
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

export default function ApiKeyInput({ 
  onApiKeyChange, 
  onUseAIChange
}: ApiKeyInputProps) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState<string>("");
  const [useAI, setUseAI] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  
  const apiKeyRef = useRef<HTMLInputElement>(null);

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
    mutationFn: async (apiKeyValue: string) => {
      const response = await apiRequest('POST', '/api/user/api-keys/openai', { apiKey: apiKeyValue });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to store API key');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/api-keys'] });
      toast({
        title: "API-Schlüssel sicher gespeichert",
        description: "Ihr OpenAI API-Schlüssel wurde verschlüsselt und sicher auf dem Server gespeichert.",
      });
      // Clear the input field after successful save
      setApiKey('');
      if (apiKeyRef.current) apiKeyRef.current.value = '';
    },
    onError: (error: Error) => {
      toast({
        title: "API-Schlüssel speichern fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to test API key
  const testApiKeyMutation = useMutation({
    mutationFn: async (apiKeyValue: string) => {
      setTestingKey(true);
      const response = await apiRequest('POST', '/api/user/api-keys/openai/test', { apiKey: apiKeyValue });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to test API key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTestingKey(false);
      if (data.valid) {
        toast({
          title: "API-Schlüssel gültig",
          description: "Ihr OpenAI API-Schlüssel funktioniert einwandfrei.",
        });
      } else {
        toast({
          title: "API-Schlüssel ungültig",
          description: data.message || "Der API-Schlüssel scheint ungültig oder abgelaufen zu sein.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setTestingKey(false);
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
    setUseAI(savedUseAI);
    onUseAIChange(savedUseAI);
  }, [onUseAIChange]);

  // Update parent when API key status changes
  useEffect(() => {
    if (apiKeyStatusQuery.data) {
      const { keys } = apiKeyStatusQuery.data;
      // Signal to parent that key is available (doesn't expose actual key)
      onApiKeyChange(keys.openai.configured ? 'server-stored' : '');
    }
  }, [apiKeyStatusQuery.data, onApiKeyChange]);

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

  // Save OpenAI API key securely on server
  const handleSaveApiKey = () => {
    const currentApiKey = apiKeyRef.current?.value || apiKey;
    
    if (!currentApiKey || currentApiKey.trim() === "") {
      toast({
        title: "API-Schlüssel erforderlich",
        description: "Bitte geben Sie einen gültigen OpenAI API-Schlüssel ein, bevor Sie speichern.",
        variant: "destructive",
      });
      return;
    }

    storeApiKeyMutation.mutate(currentApiKey.trim());
  };

  // Test API key
  const handleTestKey = () => {
    const currentApiKey = apiKeyRef.current?.value || apiKey;
    
    if (!currentApiKey || currentApiKey.trim() === "") {
      toast({
        title: "API-Schlüssel erforderlich",
        description: "Bitte geben Sie einen API-Schlüssel zum Testen ein.",
        variant: "destructive",
      });
      return;
    }

    testApiKeyMutation.mutate(currentApiKey.trim());
  };

  if (apiKeyStatusQuery.isLoading) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 mb-6">
        <CardContent className="p-4">
          <div className="h-24 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>KI-Konfiguration wird geladen...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openaiStatus = apiKeyStatusQuery.data?.keys.openai;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 mb-6">
      <CardContent className="p-4">
        {/* AI-Enhanced Extraction */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-medium text-purple-900">KI-gestützte Extraktion</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ai-toggle" className="cursor-pointer">KI aktivieren</Label>
            <Switch
              id="ai-toggle"
              checked={useAI}
              onCheckedChange={handleUseAIToggle}
            />
          </div>
        </div>

        {useAI && (
          <div className="space-y-4">
            <div className="bg-white bg-opacity-70 p-3 rounded border border-purple-100 text-sm flex gap-2">
              <Info className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p className="text-gray-700">
                Die KI-Verbesserung verwendet OpenAI GPT-4.1, um Produktinformationen zu analysieren und die Extraktionsgenauigkeit zu verbessern.
                Ihr API-Schlüssel wird verschlüsselt und sicher auf dem Server gespeichert.
              </p>
            </div>
            
            {/* Security Notice */}
            <div className="bg-green-50 bg-opacity-70 p-3 rounded border border-green-200 text-sm flex gap-2">
              <Shield className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800">
                API-Schlüssel werden mit AES-256-GCM verschlüsselt und nach der ersten Eingabe nie dem Browser angezeigt.
              </p>
            </div>
            
            {/* OpenAI Key Status and Input */}
            {openaiStatus?.source === 'environment' ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800">
                  OpenAI API-Schlüssel aus Umgebungsvariablen wird verwendet. Kein manueller Eintrag erforderlich.
                </p>
              </div>
            ) : openaiStatus?.configured ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800">
                  OpenAI API-Schlüssel ist sicher gespeichert. Sie können ihn in den Einstellungen aktualisieren.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    Kein OpenAI API-Schlüssel konfiguriert. Geben Sie unten Ihren Schlüssel ein, um KI-Funktionen zu aktivieren.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="openai-api-key" className="text-sm text-purple-900 font-medium flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-green-600" />
                      OpenAI API Key (GPT-4.1)
                    </Label>
                    <div className="relative">
                      <input
                        id="openai-api-key"
                        ref={apiKeyRef}
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full h-10 px-3 py-2 bg-white bg-opacity-80 border border-purple-200 rounded-md pr-9"
                      />
                      <Key className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Ihr Schlüssel wird verschlüsselt und sicher gespeichert</p>
                  </div>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestKey}
                    disabled={!apiKey || testingKey}
                  >
                    {testingKey ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Schlüssel testen
                  </Button>
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey || storeApiKeyMutation.isPending}
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
      </CardContent>
    </Card>
  );
}