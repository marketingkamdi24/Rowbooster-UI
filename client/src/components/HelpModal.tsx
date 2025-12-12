import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, 
  Bot, 
  Settings, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Database,
  Globe,
  Download,
  ChevronDown,
  ChevronRight,
  Key,
  FileText,
  FileSpreadsheet,
  Upload,
  Table2,
  Sparkles,
  Edit3,
  Settings2,
  Play,
  Square,
  BookOpen,
  Palette,
  Target,
  Layers,
  ArrowRight,
  ArrowDown,
  Check,
  X as XIcon,
  MousePointer,
  Eye,
  Clock,
  Star,
  Lightbulb,
  Rocket,
  CircleDot,
  Workflow,
  FolderOpen,
  ExternalLink,
  Info,
  HelpCircle,
  ChevronUp,
  Link
} from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock UI Tab Button - matches the actual interface style
function MockTabButton({ active, icon, label, color }: { active: boolean; icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
      active 
        ? `bg-white shadow-sm ring-1 ring-${color}-100 text-${color}-600`
        : 'text-gray-500'
    }`}>
      <div className={`p-1 rounded-md ${active ? `bg-${color}-100` : 'bg-gray-200'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </div>
  );
}

// Mock UI Input Toggle - matches the Einzeln/Excel toggle in the real UI
function MockInputToggle({ leftLabel, rightLabel, activeLeft }: { leftLabel: string; rightLabel: string; activeLeft: boolean }) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
        activeLeft ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500'
      }`}>
        <Edit3 className="h-3.5 w-3.5" />
        <span>{leftLabel}</span>
      </div>
      <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
        !activeLeft ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900' : 'text-gray-500'
      }`}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// Animated Excel Preview matching actual UI
function ExcelPreviewReal({ title, columns, rows, requiredCols, optionalInfo }: {
  title: string;
  columns: string[];
  rows: string[][];
  requiredCols: string[];
  optionalInfo?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Excel-style header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
            <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-700">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Formate:</span>
          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">.xlsx</span>
          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">.csv</span>
        </div>
      </div>
      
      {/* Table content */}
      <div className="flex">
        {/* Row Numbers */}
        <div className="bg-gray-100 border-r border-gray-200 flex-shrink-0">
          <div className="h-7 w-8 flex items-center justify-center border-b border-gray-200 bg-gray-200"></div>
          <div className="h-6 w-8 flex items-center justify-center border-b border-gray-100 text-[10px] text-gray-400">1</div>
          {rows.map((_, idx) => (
            <div key={idx} className="h-6 w-8 flex items-center justify-center border-b border-gray-100 text-[10px] text-gray-400">{idx + 2}</div>
          ))}
        </div>
        
        {/* Columns */}
        {columns.map((col, colIdx) => {
          const isRequired = requiredCols.includes(col);
          const colLetter = String.fromCharCode(65 + colIdx);
          return (
            <div key={colIdx} className={`flex-1 min-w-[120px] border-r border-gray-100 ${colIdx === columns.length - 1 ? 'border-r-0' : ''}`}>
              <div className="h-7 flex items-center justify-center border-b border-gray-200 bg-gray-50">
                <span className="text-[10px] font-bold text-gray-500">{colLetter}</span>
              </div>
              <div className={`h-6 flex items-center px-2 border-b border-gray-100 ${isRequired ? 'bg-blue-50/50' : 'bg-gray-50/50'}`}>
                <span className={`text-xs font-semibold ${isRequired ? 'text-blue-700' : 'text-gray-600'}`}>{col}</span>
                {isRequired && <span className="ml-1 text-[9px] text-red-500 font-bold">*</span>}
                {!isRequired && <span className="ml-1 text-[9px] text-gray-400 italic">(opt.)</span>}
              </div>
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className={`h-6 flex items-center px-2 border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <span className="text-xs text-gray-600 font-mono truncate">{row[colIdx]}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      
      {optionalInfo && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600" />
          <span className="text-xs text-amber-700">{optionalInfo}</span>
        </div>
      )}
    </div>
  );
}

// Mode description card matching UI style
function ModeDescriptionCard({ icon, color, title, description }: {
  icon: React.ReactNode;
  color: 'blue' | 'violet' | 'emerald' | 'orange';
  title: string;
  description: string;
}) {
  const colors = {
    blue: 'from-blue-50 to-indigo-50/50 text-blue-900 text-blue-600/70',
    violet: 'from-violet-50 to-purple-50/50 text-violet-900 text-violet-600/70',
    emerald: 'from-emerald-50 to-teal-50/50 text-emerald-900 text-emerald-600/70',
    orange: 'from-orange-50 to-amber-50/50 text-orange-900 text-orange-600/70',
  };
  const bgColors = {
    blue: 'bg-blue-100/80',
    violet: 'bg-violet-100/80',
    emerald: 'bg-emerald-100/80',
    orange: 'bg-orange-100/80',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]}`}>
      <div className={`flex-shrink-0 p-2 rounded-lg ${bgColors[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${colors[color].split(' ')[2]}`}>{title}</p>
        <p className={`text-xs mt-0.5 ${colors[color].split(' ')[3]}`}>{description}</p>
      </div>
    </div>
  );
}

// Data quality indicator matching actual UI
function DataQualityLegendReal() {
  const items = [
    { color: 'from-yellow-400 to-amber-500', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', label: '1 Quelle', desc: 'Einzelne Quelle – Überprüfung empfohlen' },
    { color: 'from-lime-400 to-green-500', bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200', label: '2 Quellen', desc: 'Von 2 Quellen bestätigt – Gute Qualität' },
    { color: 'from-green-400 to-emerald-600', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: '3+ Quellen', desc: 'Mehrfach bestätigt – Hohe Zuverlässigkeit' },
  ];
  
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl ${item.bg} border ${item.border}`}>
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
            <span className="text-white font-bold text-lg">{idx + 1}</span>
          </div>
          <div className="flex-1">
            <span className={`font-bold ${item.text}`}>{item.label}</span>
            <p className="text-xs text-gray-600">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Settings card matching actual UI
function SettingsCardReal({ icon, title, description, items, color }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
  color: 'green' | 'blue' | 'purple' | 'orange';
}) {
  const gradients = {
    green: 'from-green-500 to-emerald-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
    orange: 'from-orange-500 to-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className={`h-1 bg-gradient-to-r ${gradients[color]}`} />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-md`}>
            {icon}
          </div>
          <div>
            <h4 className="font-bold text-gray-800">{title}</h4>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
              <CircleDot className="h-3 w-3 text-gray-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// PDF naming example matching actual UI
function PdfNamingExample() {
  const examples = [
    { article: 'TV-001', suffix: '_Datenblatt.pdf', correct: true },
    { article: 'TV-001', suffix: '_Manual.pdf', correct: true },
    { article: 'TV-002', suffix: '_Specs.pdf', correct: true },
    { article: 'Datenblatt', suffix: '_TV.pdf', correct: false },
  ];
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
      {examples.map((ex, idx) => (
        <div key={idx} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
          ex.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <FileText className={`h-4 w-4 ${ex.correct ? 'text-red-500' : 'text-gray-400'}`} />
          <code className="flex-1 font-mono">
            <span className={ex.correct ? 'text-orange-600 font-bold' : 'text-gray-400'}>{ex.article}</span>
            <span className="text-gray-600">{ex.suffix}</span>
          </code>
          {ex.correct ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Korrekt</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600">
              <XIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Falsch</span>
            </span>
          )}
        </div>
      ))}
      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Dateiname muss mit <span className="font-semibold text-orange-600">Artikelnummer</span> beginnen
      </p>
    </div>
  );
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl blur opacity-40"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Rocket className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">rowbooster</span>
              <span className="text-lg text-gray-500 ml-2">Benutzerhandbuch</span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Lernen Sie, wie Sie die KI-gestützte Produktdatenextraktion nutzen
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[75vh] pr-4 mt-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Navigation */}
            <div className="sticky top-0 z-30 bg-gradient-to-b from-white to-white/95 backdrop-blur pb-3">
              <TabsList className="grid w-full grid-cols-5 p-1 bg-gray-100 rounded-xl h-auto">
                {[
                  { value: 'overview', icon: <Rocket className="h-4 w-4" />, label: 'Übersicht' },
                  { value: 'auto', icon: <Sparkles className="h-4 w-4" />, label: 'Automatisch' },
                  { value: 'manual', icon: <Settings2 className="h-4 w-4" />, label: 'Manuelle Quellen' },
                  { value: 'settings', icon: <Settings className="h-4 w-4" />, label: 'Einstellungen' },
                  { value: 'export', icon: <Download className="h-4 w-4" />, label: 'Export' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-1.5 py-2.5 px-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ==================== OVERVIEW TAB ==================== */}
            <TabsContent value="overview" className="space-y-6 mt-2">
              {/* Hero */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-32 translate-x-32"></div>
                <div className="relative z-10">
                  <Badge className="bg-white/20 text-white border-white/30 mb-3">KI-gestützt</Badge>
                  <h2 className="text-2xl font-bold mb-2">Willkommen bei rowbooster</h2>
                  <p className="text-blue-100 max-w-2xl mb-4">
                    Extrahieren Sie Produktdaten automatisch aus dem Web und lokalen PDFs. 
                    Unsere KI findet, analysiert und strukturiert technische Spezifikationen.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-sm backdrop-blur">
                      <Bot className="h-4 w-4" /> OpenAI GPT-4.1
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-sm backdrop-blur">
                      <Search className="h-4 w-4" /> ValueSERP Suche
                    </span>
                  </div>
                </div>
              </div>

              {/* Two Main Modes */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-blue-500" />
                  Zwei Extraktionsmodi
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Automatisch Mode */}
                  <div className="bg-white rounded-2xl p-5 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">Automatisch</h4>
                        <p className="text-sm text-gray-500">KI findet Quellen</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
                        <Bot className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">KI sucht im Web nach Datenquellen</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">Keine URLs notwendig</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800">Schneller Start mit Produktname</span>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300">Ideal für: Schnelle Recherche</Badge>
                  </div>

                  {/* Manuelle Quellen Mode */}
                  <div className="bg-white rounded-2xl p-5 border-2 border-violet-200 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
                        <Settings2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">Manuelle Quellen</h4>
                        <p className="text-sm text-gray-500">Sie definieren Quellen</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 p-2.5 bg-violet-50 rounded-lg">
                        <Target className="h-4 w-4 text-violet-600" />
                        <span className="text-sm text-violet-800">Sie bestimmen die URLs</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-violet-50 rounded-lg">
                        <FileText className="h-4 w-4 text-violet-600" />
                        <span className="text-sm text-violet-800">Lokale PDFs möglich</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-violet-50 rounded-lg">
                        <Shield className="h-4 w-4 text-violet-600" />
                        <span className="text-sm text-violet-800">Volle Kontrolle über Quellen</span>
                      </div>
                    </div>
                    <Badge className="bg-violet-100 text-violet-700 border-violet-300">Ideal für: Vertrauenswürdige Quellen</Badge>
                  </div>
                </div>
              </div>

              {/* Quick Start Steps */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-green-500" />
                  Schnellstart
                </h3>
                
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { step: '1', icon: <Layers className="h-5 w-5 text-blue-600" />, title: 'Modus wählen', desc: 'Auto oder Manuell', color: 'border-blue-200' },
                    { step: '2', icon: <Upload className="h-5 w-5 text-orange-600" />, title: 'Daten eingeben', desc: 'Name oder Excel', color: 'border-orange-200' },
                    { step: '3', icon: <Sparkles className="h-5 w-5 text-purple-600" />, title: 'Extrahieren', desc: 'KI analysiert', color: 'border-purple-200' },
                    { step: '4', icon: <Download className="h-5 w-5 text-green-600" />, title: 'Exportieren', desc: 'Excel Download', color: 'border-green-200' },
                  ].map((item, idx) => (
                    <div key={idx} className={`bg-white rounded-xl p-4 border-2 ${item.color} text-center`}>
                      <div className="text-xs font-bold text-gray-400 mb-2">SCHRITT {item.step}</div>
                      <div className="w-10 h-10 mx-auto rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                        {item.icon}
                      </div>
                      <h4 className="font-bold text-sm text-gray-800">{item.title}</h4>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ==================== AUTOMATISCH TAB ==================== */}
            <TabsContent value="auto" className="space-y-6 mt-2">
              {/* Header */}
              <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Automatisch</h2>
                    <p className="text-blue-100 text-sm">Die KI sucht selbstständig nach Datenquellen</p>
                  </div>
                </div>
              </div>

              {/* What it looks like in UI */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-500" />
                  So sieht es in der Oberfläche aus:
                </h4>
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <MockTabButton active={true} icon={<Sparkles className="h-3.5 w-3.5 text-blue-600" />} label="Automatisch" color="blue" />
                    <MockTabButton active={false} icon={<Settings2 className="h-3.5 w-3.5 text-gray-500" />} label="Manuelle Quellen" color="violet" />
                    <div className="ml-auto">
                      <MockInputToggle leftLabel="Einzeln" rightLabel="Excel" activeLeft={false} />
                    </div>
                  </div>
                  <ModeDescriptionCard
                    icon={<Sparkles className="h-4 w-4 text-blue-600" />}
                    color="blue"
                    title="Excel-Datei mit Produktnamen hochladen"
                    description="KI sucht automatisch passende Quellen im Web"
                  />
                </div>
              </div>

              {/* Input Modes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Edit3 className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Einzeln-Modus</h4>
                      <p className="text-xs text-gray-500">Ein Produkt eingeben</p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Produktname eingeben (Pflicht)
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Artikelnummer (optional)
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Ideal für einzelne Abfragen
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-even justify-center">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Excel-Modus</h4>
                      <p className="text-xs text-gray-500">Viele Produkte auf einmal</p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Excel-Datei hochladen
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Parallele Verarbeitung
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500" /> Automatischer Export
                    </li>
                  </ul>
                </div>
              </div>

              {/* Excel Format */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Erforderliches Excel-Format
                </h4>
                <ExcelPreviewReal
                  title="So sollte Ihre Excel-Datei aussehen:"
                  columns={['Artikelnummer', 'Produktname']}
                  rows={[['AB-12345', 'Samsung Galaxy S24 Ultra'], ['CD-67890', 'Apple iPhone 15 Pro Max']]}
                  requiredCols={['Produktname']}
                  optionalInfo="Artikelnummer ist optional, Produktname ist Pflicht"
                />
              </div>

              {/* Features */}
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shadow">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-orange-900">PDF Extractor</h4>
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Toggle</Badge>
                  </div>
                </div>
                <p className="text-sm text-orange-800">
                  Aktivieren Sie den PDF Extractor um auch Daten aus PDF-Datenblättern zu extrahieren, 
                  die bei der Web-Suche gefunden werden. Besonders nützlich für technische Spezifikationen.
                </p>
              </div>
            </TabsContent>

            {/* ==================== MANUELLE QUELLEN TAB ==================== */}
            <TabsContent value="manual" className="space-y-6 mt-2">
              {/* Header */}
              <div className="rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Manuelle Quellen</h2>
                    <p className="text-violet-100 text-sm">Sie bestimmen die Datenquellen (URLs und PDFs)</p>
                  </div>
                </div>
              </div>

              {/* Two Sub-Modes */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-500" />
                  Zwei Modi verfügbar
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* URL Mode */}
                  <div className="bg-white rounded-xl p-5 border-2 border-emerald-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow">
                        <Globe className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">URL-Modus</h4>
                        <p className="text-xs text-gray-500">Nur aus Webseiten</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        <span className="text-gray-700">Produktname (Pflicht)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        <span className="text-gray-700">URL (Pflicht)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CircleDot className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">Artikelnummer (optional)</span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">Keine PDFs nötig</Badge>
                  </div>

                  {/* URL + PDF Mode */}
                  <div className="bg-white rounded-xl p-5 border-2 border-violet-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
                        <div className="flex items-center">
                          <Globe className="h-3.5 w-3.5 text-white" />
                          <span className="text-white font-bold mx-0.5 text-xs">+</span>
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">URL + PDF-Modus</h4>
                        <p className="text-xs text-gray-500">Web + lokale PDFs</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        <span className="text-gray-700 font-medium">Artikelnummer (Pflicht!)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        <span className="text-gray-700">Produktname (Pflicht)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        <span className="text-gray-700">URL (Pflicht)</span>
                      </div>
                    </div>
                    <Badge className="bg-violet-100 text-violet-700 border-violet-300 text-xs">PDFs erforderlich</Badge>
                  </div>
                </div>
              </div>

              {/* Excel Format for Manual */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-violet-600" />
                  Excel-Format für Manuelle Quellen
                </h4>
                <ExcelPreviewReal
                  title="ProdukteMitURLs.xlsx"
                  columns={['Artikelnummer', 'Produktname', 'URL']}
                  rows={[
                    ['TV-001', 'Samsung TV 55"', 'https://samsung.de/tv-55'],
                    ['TV-002', 'LG OLED 65"', 'https://lg.com/oled65']
                  ]}
                  requiredCols={['Produktname', 'URL']}
                  optionalInfo="Für URL+PDF Modus ist Artikelnummer ebenfalls Pflicht!"
                />
              </div>

              {/* PDF Naming */}
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                <h4 className="font-bold text-violet-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF-Namenskonvention (für URL+PDF Modus)
                </h4>
                <PdfNamingExample />
                <div className="mt-3 p-2 bg-amber-100 rounded-lg border border-amber-300 flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    <strong>Wichtig:</strong> Der Dateiname muss mit der exakten Artikelnummer aus der Excel-Datei beginnen!
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ==================== SETTINGS TAB ==================== */}
            <TabsContent value="settings" className="space-y-6 mt-2">
              {/* Header */}
              <div className="rounded-2xl bg-gradient-to-r from-gray-700 to-gray-900 p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Einstellungen</h2>
                    <p className="text-gray-300 text-sm">Konfigurieren Sie rowbooster</p>
                  </div>
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingsCardReal
                  icon={<Key className="h-5 w-5 text-white" />}
                  title="API-Schlüssel"
                  description="Konfiguration"
                  items={['OpenAI (Pflicht)', 'ValueSERP (Empfohlen)']}
                  color="purple"
                />
                <SettingsCardReal
                  icon={<Search className="h-5 w-5 text-white" />}
                  title="Suche"
                  description="Optimierung"
                  items={['Max. Ergebnisse (1-12)', 'Parallele Verarbeitung (1-10)']}
                  color="blue"
                />
                <SettingsCardReal
                  icon={<Table2 className="h-5 w-5 text-white" />}
                  title="Eigenschaften"
                  description="Datenstruktur"
                  items={['Tabellen erstellen', 'Import/Export', 'Kategorisierung']}
                  color="green"
                />
                <SettingsCardReal
                  icon={<Globe className="h-5 w-5 text-white" />}
                  title="Domains"
                  description="Filterung"
                  items={['Hersteller-Domains', 'Ausschlüsse', 'Priorisierung']}
                  color="orange"
                />
              </div>

              {/* API Keys Details */}
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Key className="h-5 w-5 text-purple-600" />
                  API-Schlüssel konfigurieren
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-green-600" />
                        <span className="font-bold text-gray-800">OpenAI API</span>
                      </div>
                      <Badge className="bg-red-100 text-red-700 text-xs">Pflicht</Badge>
                    </div>
                    <p className="text-xs text-gray-600">KI-Modell für Datenextraktion (GPT-4.1 oder Mini)</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-gray-800">ValueSERP API</span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">Empfohlen</Badge>
                    </div>
                    <p className="text-xs text-gray-600">Web-Suche mit regionalen Ergebnissen</p>
                  </div>
                </div>

                {/* AI Model Selection */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    KI-Modell Auswahl
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800">GPT-4.1</span>
                        <Badge className="bg-purple-100 text-purple-700 text-xs">Premium</Badge>
                      </div>
                      <p className="text-xs text-gray-500">Höchste Qualität, mehr Token</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800">GPT-4.1 Mini</span>
                        <Badge className="bg-green-100 text-green-700 text-xs">Effizient</Badge>
                      </div>
                      <p className="text-xs text-gray-500">Gute Qualität, schneller</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ==================== EXPORT TAB ==================== */}
            <TabsContent value="export" className="space-y-6 mt-2">
              {/* Header */}
              <div className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Export & Datenqualität</h2>
                    <p className="text-green-100 text-sm">Verstehen Sie die Qualitätsindikatoren</p>
                  </div>
                </div>
              </div>

              {/* Data Quality */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-blue-500" />
                  Datenqualität-Farbcodes
                </h4>
                <DataQualityLegendReal />
              </div>

              {/* How tooltips work */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-600" />
                  Interaktive Tooltips
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Bewegen Sie die Maus über einen farbigen Wert in der Ergebnistabelle, um Details zu sehen:
                </p>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-green-100 rounded-lg border border-green-200">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-mono text-sm text-green-800">1920 x 1080</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="bg-gray-900 text-white rounded-lg p-3 text-xs">
                      <div className="mb-1"><span className="text-gray-400">Eigenschaft:</span> Auflösung</div>
                      <div className="mb-1"><span className="text-gray-400">Wert:</span> <span className="text-green-400 font-medium">1920 x 1080</span></div>
                      <div><span className="text-gray-400">Quellen:</span> 3 bestätigt</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Steps */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel-Export in 3 Schritten
                </h4>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Verarbeitung abwarten', desc: 'Alle Produkte müssen verarbeitet sein' },
                    { step: '2', title: '"Exportieren" klicken', desc: 'Button oben rechts in der Ergebnistabelle' },
                    { step: '3', title: 'Excel herunterladen', desc: 'product_data_YYYY-MM-DD.xlsx mit Farbcodierung' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold shadow">
                        {item.step}
                      </div>
                      <div className="flex-1 bg-white rounded-lg p-3 border border-green-200">
                        <span className="font-medium text-gray-800">{item.title}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h5 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Best Practices
                  </h5>
                  <ul className="space-y-1.5">
                    {['Vollständige Produktnamen verwenden', 'Artikelnummern hinzufügen wenn verfügbar', 'Herstellerseiten bevorzugen', 'Gelb markierte Werte überprüfen'].map((tip, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-green-800">
                        <Check className="h-3 w-3 text-green-500" /> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <h5 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Zu vermeiden
                  </h5>
                  <ul className="space-y-1.5">
                    {['Generische Namen wie "TV" oder "Handy"', 'Shop-Seiten (Amazon, eBay)', 'Zu viele Produkte gleichzeitig', 'Unvollständige URLs'].map((tip, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-red-800">
                        <XIcon className="h-3 w-3 text-red-500" /> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}