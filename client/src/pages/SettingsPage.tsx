import React, { useEffect, useState } from 'react';
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
  Zap,
  Key,
  Settings,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle2,
  Factory,
  Ban
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ManufacturerSettings from "@/components/ManufacturerSettings";
import ExcludedDomainsSettings from "@/components/ExcludedDomainsSettings";
import UnifiedPropertiesManager from "@/components/UnifiedPropertiesManager";
import { useSearchTabsStore } from "@/stores/searchTabsStore";
import { useTheme } from "@/contexts/ThemeContext";

// ============================================================================
// GLASSMORPHISM UI COMPONENTS - Award-Winning Design System
// ============================================================================

// Ambient Glow Orb - Creates beautiful background lighting effects
function AmbientOrb({ color = "cyan", size = "lg", position = "top-right", className = "" }: { 
  color?: "cyan" | "lime" | "mixed"; size?: "sm" | "md" | "lg" | "xl"; position?: string; className?: string;
}) {
  const sizes = { sm: "w-32 h-32", md: "w-48 h-48", lg: "w-64 h-64", xl: "w-96 h-96" };
  const positions: Record<string, string> = {
    "top-right": "-top-16 -right-16", "top-left": "-top-16 -left-16",
    "bottom-right": "-bottom-16 -right-16", "bottom-left": "-bottom-16 -left-16",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };
  const colors = { 
    cyan: "bg-[#17c3ce]", 
    lime: "bg-[#c8fa64]", 
    mixed: "bg-gradient-to-br from-[#17c3ce] to-[#c8fa64]" 
  };
  return (
    <div 
      className={`absolute ${sizes[size]} ${positions[position] || position} ${colors[color]} rounded-full blur-[100px] opacity-[0.08] pointer-events-none animate-pulse ${className}`} 
      style={{ animationDuration: '4s' }}
    />
  );
}

// Glass Card - Premium glassmorphism card component
function GlassCard({ children, className = "", glowColor = "cyan", hover = true, gradient = false }: { 
  children: React.ReactNode; 
  className?: string; 
  glowColor?: "cyan" | "lime" | "none"; 
  hover?: boolean;
  gradient?: boolean;
}) {
  const glows = {
    cyan: "hover:shadow-[0_0_40px_rgba(23,195,206,0.15)] hover:border-[#17c3ce]/30",
    lime: "hover:shadow-[0_0_40px_rgba(200,250,100,0.15)] hover:border-[#c8fa64]/30",
    none: "",
  };
  return (
    <div className={`
      relative overflow-hidden rounded-2xl 
      bg-white/[0.03] backdrop-blur-xl 
      border border-white/[0.08] 
      transition-all duration-500 ease-out 
      ${hover ? `hover:bg-white/[0.06] hover:-translate-y-1 ${glows[glowColor]}` : ''} 
      ${gradient ? 'bg-gradient-to-br from-white/[0.05] to-white/[0.02]' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

// Glow Icon - Icon with gradient background and glow effect
function GlowIcon({ icon: Icon, color = "cyan", size = "md" }: { 
  icon: React.ElementType; color?: "cyan" | "lime" | "blue" | "purple" | "orange" | "red"; size?: "sm" | "md" | "lg";
}) {
  const styles: Record<string, { bg: string; shadow: string }> = {
    cyan: { bg: "from-[#17c3ce] to-[#0ea5e9]", shadow: "shadow-[0_0_20px_rgba(23,195,206,0.4)]" },
    lime: { bg: "from-[#c8fa64] to-[#84cc16]", shadow: "shadow-[0_0_20px_rgba(200,250,100,0.4)]" },
    blue: { bg: "from-blue-500 to-blue-600", shadow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]" },
    purple: { bg: "from-purple-500 to-purple-600", shadow: "shadow-[0_0_20px_rgba(168,85,247,0.4)]" },
    orange: { bg: "from-orange-500 to-amber-500", shadow: "shadow-[0_0_20px_rgba(249,115,22,0.4)]" },
    red: { bg: "from-red-500 to-rose-500", shadow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]" },
  };
  const sizeClasses = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };
  return (
    <div className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br ${styles[color].bg} ${styles[color].shadow} flex items-center justify-center transition-transform duration-300 hover:scale-110 flex-shrink-0`}>
      <Icon className={`${iconSizes[size]} text-white`} />
    </div>
  );
}

// Section Header - Consistent section headers with icon
function SectionHeader({ icon: Icon, title, description, color = "cyan" }: {
  icon?: React.ElementType; title: string; description: string; color?: "cyan" | "lime" | "blue" | "purple" | "orange" | "red";
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-6">
      {Icon && <GlowIcon icon={Icon} color={color} size="lg" />}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-white/50">{description}</p>
      </div>
    </div>
  );
}

// Info Banner - Styled information banners
function InfoBanner({ children, variant = "info", icon: CustomIcon }: {
  children: React.ReactNode; variant?: "info" | "success" | "warning" | "error"; icon?: React.ElementType;
}) {
  const variants = {
    info: { bg: "bg-[#17c3ce]/10", border: "border-[#17c3ce]/20", text: "text-[#17c3ce]", icon: Info },
    success: { bg: "bg-[#c8fa64]/10", border: "border-[#c8fa64]/20", text: "text-[#c8fa64]", icon: CheckCircle2 },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: AlertCircle },
    error: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: AlertCircle },
  };
  const v = variants[variant];
  const IconComponent = CustomIcon || v.icon;
  return (
    <div className={`${v.bg} ${v.border} border rounded-xl p-4 flex items-start gap-3`}>
      <IconComponent className={`h-5 w-5 ${v.text} flex-shrink-0 mt-0.5`} />
      <div className="text-sm text-white/70 flex-1">{children}</div>
    </div>
  );
}

// Styled Input - Glassmorphism input field
function GlassInput({ id, type = "text", placeholder, value, onChange, icon: Icon, className = "" }: {
  id?: string; type?: string; placeholder?: string; value?: string; 
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; icon?: React.ElementType; className?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`
          w-full h-12 px-4 py-3 
          bg-black/30 backdrop-blur-sm
          border border-white/[0.1] rounded-xl 
          text-white placeholder:text-white/40 
          focus:border-[#17c3ce]/50 focus:outline-none focus:ring-2 focus:ring-[#17c3ce]/20
          transition-all duration-300
          ${Icon ? 'pr-12' : ''}
          ${className}
        `}
      />
      {Icon && (
        <Icon className="h-5 w-5 absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40" />
      )}
    </div>
  );
}

// Primary Button - Gradient button with glow
function GlassButton({ children, onClick, disabled, variant = "primary", size = "md", className = "", type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; 
  variant?: "primary" | "secondary" | "success" | "danger"; size?: "sm" | "md" | "lg"; className?: string; type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-gradient-to-r from-[#17c3ce] to-[#0ea5e9] hover:from-[#14b8c4] hover:to-[#0d9cd8] shadow-[0_0_20px_rgba(23,195,206,0.3)] hover:shadow-[0_0_30px_rgba(23,195,206,0.5)]",
    secondary: "bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2]",
    success: "bg-gradient-to-r from-[#c8fa64] to-[#84cc16] hover:from-[#bef264] hover:to-[#7cb518] shadow-[0_0_20px_rgba(200,250,100,0.3)] hover:shadow-[0_0_30px_rgba(200,250,100,0.5)] text-[#0c2443]",
    danger: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
  };
  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-sm",
    lg: "h-12 px-8 text-base",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-xl font-semibold text-white
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// Settings page component
export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  
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
    <div className={`min-h-screen relative transition-colors duration-300 ${
      theme === 'dark' ? 'text-white' : 'text-[#0c2443]'
    }`}>
      <div className="container mx-auto py-6 px-4 max-w-6xl relative z-10">
        {/* Simple Header */}
        <header className="mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-[#0c2443]'
              }`}>Einstellungen</h1>
              <p className={`text-sm sm:text-base ${theme === 'dark' ? 'text-white/50' : 'text-[#0c2443]/50'}`}>Konfigurieren Sie Ihre Anwendung</p>
            </div>
            <a 
              href="/"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 text-sm font-medium self-start sm:self-auto ${
                theme === 'dark'
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.1] hover:border-white/[0.2] text-white/80 hover:text-white'
                  : 'bg-[#17c3ce]/5 hover:bg-[#17c3ce]/10 border-[#17c3ce]/20 hover:border-[#17c3ce]/30 text-[#0c2443]/80 hover:text-[#0c2443]'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Zurück zur Hauptseite</span>
              <span className="sm:hidden">Zurück</span>
            </a>
          </div>
        </header>
        
        {/* Modern Glassmorphism Tabs */}
        <Tabs defaultValue="api-keys" className="w-full space-y-6 sm:space-y-8">
          <div className="sticky top-4 z-30">
            <TabsList className={`grid w-full grid-cols-4 p-1.5 h-auto backdrop-blur-xl border rounded-2xl transition-colors duration-300 ${
              theme === 'dark'
                ? 'bg-white/[0.03] border-white/[0.08]'
                : 'bg-white/60 border-[#17c3ce]/20'
            }`}>
              <TabsTrigger
                value="api-keys"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 text-[11px] sm:text-sm font-medium rounded-xl transition-all duration-300 ${
                  theme === 'dark'
                    ? 'text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#17c3ce]/20 data-[state=active]:to-[#c8fa64]/10 data-[state=active]:text-white data-[state=active]:border-white/[0.1] hover:text-white/70'
                    : 'text-[#0c2443]/50 data-[state=active]:bg-[#17c3ce]/10 data-[state=active]:text-[#0c2443] data-[state=active]:border-[#17c3ce]/20 hover:text-[#0c2443]/70'
                } data-[state=active]:shadow-lg data-[state=active]:border`}
              >
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">API-Schlüssel</span>
                <span className="sm:hidden">API</span>
              </TabsTrigger>
              <TabsTrigger
                value="search"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 text-[11px] sm:text-sm font-medium rounded-xl transition-all duration-300 ${
                  theme === 'dark'
                    ? 'text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#17c3ce]/20 data-[state=active]:to-[#c8fa64]/10 data-[state=active]:text-white data-[state=active]:border-white/[0.1] hover:text-white/70'
                    : 'text-[#0c2443]/50 data-[state=active]:bg-[#17c3ce]/10 data-[state=active]:text-[#0c2443] data-[state=active]:border-[#17c3ce]/20 hover:text-[#0c2443]/70'
                } data-[state=active]:shadow-lg data-[state=active]:border`}
              >
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Suche</span>
              </TabsTrigger>
              <TabsTrigger
                value="properties"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 text-[11px] sm:text-sm font-medium rounded-xl transition-all duration-300 ${
                  theme === 'dark'
                    ? 'text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#17c3ce]/20 data-[state=active]:to-[#c8fa64]/10 data-[state=active]:text-white data-[state=active]:border-white/[0.1] hover:text-white/70'
                    : 'text-[#0c2443]/50 data-[state=active]:bg-[#17c3ce]/10 data-[state=active]:text-[#0c2443] data-[state=active]:border-[#17c3ce]/20 hover:text-[#0c2443]/70'
                } data-[state=active]:shadow-lg data-[state=active]:border`}
              >
                <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Eigenschaften</span>
                <span className="sm:hidden">Daten</span>
              </TabsTrigger>
              <TabsTrigger
                value="domains"
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 text-[11px] sm:text-sm font-medium rounded-xl transition-all duration-300 ${
                  theme === 'dark'
                    ? 'text-white/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#17c3ce]/20 data-[state=active]:to-[#c8fa64]/10 data-[state=active]:text-white data-[state=active]:border-white/[0.1] hover:text-white/70'
                    : 'text-[#0c2443]/50 data-[state=active]:bg-[#17c3ce]/10 data-[state=active]:text-[#0c2443] data-[state=active]:border-[#17c3ce]/20 hover:text-[#0c2443]/70'
                } data-[state=active]:shadow-lg data-[state=active]:border`}
              >
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Domains</span>
                <span className="sm:hidden">Web</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <form onSubmit={handleSubmit}>
            {/* ================================================================ */}
            {/* API KEYS TAB - Glassmorphism Design */}
            {/* ================================================================ */}
            <TabsContent value="api-keys" className="mt-6 space-y-6">
              <SectionHeader 
                title="API-Konfiguration" 
                description="Verbinden Sie Ihre API-Schlüssel für KI- und Suchfunktionen"
                color="lime"
              />
              
              {/* Security Notice */}
              <InfoBanner variant="success" icon={Shield}>
                <span className="font-medium text-[#c8fa64]">Sichere Speicherung:</span>{" "}
                Ihre API-Schlüssel werden verschlüsselt und sicher auf dem Server gespeichert.
              </InfoBanner>

              <div className="grid gap-5">
                {/* OpenAI Section */}
                <GlassCard className="p-5 sm:p-6" glowColor="lime">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c8fa64] to-[#84cc16]" />
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <GlowIcon icon={Brain} color="lime" size="lg" />
                      <div>
                        <h3 className="text-lg font-bold text-white">OpenAI</h3>
                        <p className="text-sm text-white/50">GPT-4 basierte Inhaltsanalyse</p>
                      </div>
                    </div>
                    {settingsQuery.data?.hasOpenAiKey && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#c8fa64]/20 text-[#c8fa64] rounded-full text-sm font-medium border border-[#c8fa64]/30">
                        <CheckCircle2 className="h-4 w-4" />
                        Verbunden
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="openai-key" className="text-sm font-medium text-white/70 mb-2 block">API-Schlüssel</Label>
                      <GlassInput
                        id="openai-key"
                        type="password"
                        placeholder={settingsQuery.data?.hasOpenAiKey ? "●●●●●●●●●●●●●●●●" : "sk-proj-..."}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        icon={Key}
                      />
                    </div>
                    <GlassButton 
                      onClick={() => {
                        const settings = { openaiApiKey: openaiApiKey || undefined };
                        saveSettingsMutation.mutate(settings);
                      }}
                      disabled={!openaiApiKey || saveSettingsMutation.isPending}
                      variant="success"
                      className="w-full"
                    >
                      {saveSettingsMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Speichern...</>
                      ) : (
                        <><Save className="h-4 w-4" /> OpenAI-Schlüssel speichern</>
                      )}
                    </GlassButton>
                  </div>
                </GlassCard>
                
                {/* AI Model Selection */}
                <GlassCard className="p-5 sm:p-6" glowColor="lime">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c8fa64] to-[#a8e063]" />
                  <div className="flex items-center gap-3 mb-5">
                    <GlowIcon icon={Zap} color="lime" size="lg" />
                    <div>
                      <h3 className="text-lg font-bold text-white">KI-Modell Auswahl</h3>
                      <p className="text-sm text-white/50">Wählen Sie Ihr bevorzugtes Modell</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ai-model" className="text-sm font-medium text-white/70 mb-2 block">Modell auswählen</Label>
                      <Select
                        value={selectedAiModel}
                        onValueChange={(value) => {
                          setSelectedAiModel(value);
                          saveAiModelMutation.mutate(value);
                        }}
                      >
                        <SelectTrigger id="ai-model" className="h-12 bg-black/30 border-white/[0.1] text-white rounded-xl focus:border-[#17c3ce]/50 focus:ring-2 focus:ring-[#17c3ce]/20">
                          <SelectValue placeholder="KI-Modell wählen" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2332] border-white/[0.1] rounded-xl">
                          <SelectItem value="gpt-4.1" className="text-white focus:bg-white/[0.1] focus:text-white rounded-lg">
                            <div className="flex flex-col py-1">
                              <span className="font-medium">GPT-4.1 (Standard)</span>
                              <span className="text-xs text-white/50">Höhere Qualität, höhere Kosten</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gpt-4.1-mini" className="text-white focus:bg-white/[0.1] focus:text-white rounded-lg">
                            <div className="flex flex-col py-1">
                              <span className="font-medium">GPT-4.1 Mini</span>
                              <span className="text-xs text-white/50">Kostengünstig, dennoch leistungsstark</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Model Info Card */}
                    <div className={`p-4 rounded-xl border ${selectedAiModel === 'gpt-4.1-mini' ? 'bg-[#c8fa64]/10 border-[#c8fa64]/20' : 'bg-[#17c3ce]/10 border-[#17c3ce]/20'}`}>
                      {selectedAiModel === 'gpt-4.1-mini' ? (
                        <div>
                          <p className="font-semibold text-[#c8fa64] flex items-center gap-2">
                            <Sparkles className="h-4 w-4" /> Kostenspar-Modus
                          </p>
                          <p className="text-sm text-white/70 mt-2">
                            GPT-4.1 Mini verwendet weniger Tokens, wodurch Ihre API-Kosten gesenkt werden.
                          </p>
                          <p className="text-xs text-white/50 mt-2">
                            Preise: $0,40/1M Eingabe • $1,60/1M Ausgabe
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-[#17c3ce] flex items-center gap-2">
                            <Zap className="h-4 w-4" /> Standard-Modus
                          </p>
                          <p className="text-sm text-white/70 mt-2">
                            GPT-4.1 bietet höchste Qualität für komplexe technische Spezifikationen.
                          </p>
                          <p className="text-xs text-white/50 mt-2">
                            Preise: $3,00/1M Eingabe • $12,00/1M Ausgabe
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {saveAiModelMutation.isPending && (
                      <p className="text-sm text-white/50 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Modell wird gespeichert...
                      </p>
                    )}
                  </div>
                </GlassCard>
                
                {/* ValueSERP Section */}
                <GlassCard className="p-5 sm:p-6" glowColor="cyan">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#17c3ce] to-[#0ea5e9]" />
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <GlowIcon icon={Globe} color="cyan" size="lg" />
                      <div>
                        <h3 className="text-lg font-bold text-white">ValueSERP</h3>
                        <p className="text-sm text-white/50">Regionale Suchfunktionen</p>
                      </div>
                    </div>
                    {settingsQuery.data?.hasValueSerpApiKey && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#c8fa64]/20 text-[#c8fa64] rounded-full text-sm font-medium border border-[#c8fa64]/30">
                        <CheckCircle2 className="h-4 w-4" />
                        Verbunden
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="valueserp-key" className="text-sm font-medium text-white/70 mb-2 block">API-Schlüssel</Label>
                      <GlassInput
                        id="valueserp-key"
                        type="password"
                        placeholder={settingsQuery.data?.hasValueSerpApiKey ? "●●●●●●●●●●●●●●●●" : "ValueSERP-Schlüssel eingeben"}
                        value={valueSerpApiKey}
                        onChange={(e) => setValueSerpApiKey(e.target.value)}
                        icon={Key}
                      />
                    </div>
                    <GlassButton 
                      onClick={() => {
                        const settings = { valueSerpApiKey: valueSerpApiKey || undefined };
                        saveSettingsMutation.mutate(settings);
                      }}
                      disabled={!valueSerpApiKey || saveSettingsMutation.isPending}
                      variant="primary"
                      className="w-full"
                    >
                      {saveSettingsMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Speichern...</>
                      ) : (
                        <><Save className="h-4 w-4" /> ValueSERP-Schlüssel speichern</>
                      )}
                    </GlassButton>
                  </div>
                </GlassCard>
              </div>
            </TabsContent>
            
            {/* ================================================================ */}
            {/* SEARCH SETTINGS TAB - Glassmorphism Design */}
            {/* ================================================================ */}
            <TabsContent value="search" className="mt-6 space-y-6">
              <SectionHeader 
                title="Sucheinstellungen" 
                description="Konfigurieren Sie das Suchverhalten und die Leistung"
                color="cyan"
              />

              <div className="grid gap-5">
                {/* Max Results Setting */}
                <GlassCard className="p-5 sm:p-6" glowColor="cyan">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#17c3ce] to-[#0ea5e9]" />
                  <div className="flex items-center gap-3 mb-5">
                    <GlowIcon icon={Search} color="cyan" size="lg" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Maximale Suchergebnisse</h3>
                      <p className="text-sm text-white/50">Anzahl der Web-Ergebnisse pro Suche (1-12)</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={maxResults}
                        onChange={(e) => setMaxResults(parseInt(e.target.value) || 10)}
                        className="w-20 h-12 px-3 text-center text-lg font-bold bg-black/30 border border-white/[0.1] rounded-xl text-white focus:border-[#17c3ce]/50 focus:outline-none focus:ring-2 focus:ring-[#17c3ce]/20"
                      />
                      <span className="text-sm text-white/60">Webseiten pro Produkt-Suche</span>
                    </div>
                    <p className="text-xs text-white/40">Höhere Werte können bessere Ergebnisse liefern, benötigen aber mehr Zeit und API-Credits.</p>
                  </div>
                </GlassCard>
                
                {/* Parallel Searches Setting */}
                <GlassCard className="p-5 sm:p-6" glowColor="lime">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#c8fa64] to-[#84cc16]" />
                  <div className="flex items-center gap-3 mb-5">
                    <GlowIcon icon={Zap} color="lime" size="lg" />
                    <div>
                      <h3 className="text-lg font-bold text-white">Parallele Verarbeitung</h3>
                      <p className="text-sm text-white/50">Anzahl gleichzeitiger Produkt-Verarbeitungen (1-10)</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={parallelSearches}
                        onChange={(e) => setParallelSearches(parseInt(e.target.value) || 3)}
                        className="w-20 h-12 px-3 text-center text-lg font-bold bg-black/30 border border-white/[0.1] rounded-xl text-white focus:border-[#c8fa64]/50 focus:outline-none focus:ring-2 focus:ring-[#c8fa64]/20"
                      />
                      <span className="text-sm text-white/60">Produkte gleichzeitig verarbeiten</span>
                    </div>
                    <p className="text-xs text-white/40">Höhere Werte beschleunigen Batch-Verarbeitung, können aber die Serverauslastung erhöhen.</p>
                  </div>
                </GlassCard>
                
                {/* Save Search Settings Button */}
                <GlassButton
                  onClick={handleSaveSearchSettings}
                  variant="success"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  Sucheinstellungen speichern
                </GlassButton>
                
                {/* Info note about local storage */}
                <InfoBanner variant="info">
                  Sucheinstellungen werden lokal in Ihrem Browser gespeichert und sind sofort aktiv.
                </InfoBanner>
              </div>
            </TabsContent>
            
            {/* ================================================================ */}
            {/* PROPERTIES TAB - Glassmorphism Design */}
            {/* ================================================================ */}
            <TabsContent value="properties" className="mt-6 space-y-6">
              <SectionHeader 
                title="Eigenschaften-Verwaltung" 
                description="Definieren Sie die zu extrahierenden Produkteigenschaften"
                color="cyan"
              />
              <GlassCard className="p-0 overflow-hidden" hover={false} glowColor="none">
                <UnifiedPropertiesManager />
              </GlassCard>
            </TabsContent>

            {/* ================================================================ */}
            {/* DOMAINS TAB - Glassmorphism Design */}
            {/* ================================================================ */}
            <TabsContent value="domains" className="mt-6 space-y-6">
              <SectionHeader 
                title="Domain-Verwaltung" 
                description="Konfigurieren Sie Hersteller-Domains und Ausschlüsse"
                color="cyan"
              />
              <div className="space-y-6">
                <GlassCard className="p-0 overflow-hidden" hover={false} glowColor="none">
                  <ManufacturerSettings />
                </GlassCard>
                <GlassCard className="p-0 overflow-hidden" hover={false} glowColor="none">
                  <ExcludedDomainsSettings />
                </GlassCard>
              </div>
            </TabsContent>
            
            {/* Premium Save Button */}
            <div className="mt-10 pt-6 border-t border-white/[0.08]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-sm text-white/40">
                  Änderungen werden automatisch gespeichert, wenn Sie auf die jeweiligen Speichern-Buttons klicken.
                </p>
                <GlassButton 
                  type="submit" 
                  disabled={saveSettingsMutation.isPending}
                  variant="success"
                  size="lg"
                >
                  {saveSettingsMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Speichern...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Alle Einstellungen speichern</>
                  )}
                </GlassButton>
              </div>
            </div>
          </form>
        </Tabs>
      </div>
    </div>
  );
}