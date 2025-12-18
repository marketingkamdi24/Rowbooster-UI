import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import rowboosterLogo from "@konzept/Logo/RowBooster_WortBildmarke.png";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, Sparkles, Settings2, Download, FileSpreadsheet, 
  Globe, FileText, Bot, Search, Key, HelpCircle, Zap, Check
} from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Accordion Item Component
function AccordionItem({ 
  title, 
  icon: Icon, 
  children, 
  isOpen, 
  onToggle,
  accentColor = "cyan"
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  isOpen: boolean; 
  onToggle: () => void;
  accentColor?: "cyan" | "lime";
}) {
  const colors = {
    cyan: {
      iconBg: "bg-[#17c3ce]/10",
      iconText: "text-[#17c3ce]",
      border: "border-[#17c3ce]/20",
      hover: "hover:border-[#17c3ce]/40"
    },
    lime: {
      iconBg: "bg-[#c8fa64]/10",
      iconText: "text-[#c8fa64]",
      border: "border-[#c8fa64]/20",
      hover: "hover:border-[#c8fa64]/40"
    }
  };
  const c = colors[accentColor];

  return (
    <div className={`rounded-xl border ${c.border} ${c.hover} bg-white/[0.02] backdrop-blur-sm transition-all duration-300 ${isOpen ? 'bg-white/[0.04]' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${c.iconText}`} />
        </div>
        <span className="flex-1 font-semibold text-white text-sm sm:text-base">{title}</span>
        <ChevronDown className={`h-5 w-5 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-5 pt-0">
          <div className="pl-14">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Component for Quick Start
function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#17c3ce] to-[#c8fa64] flex items-center justify-center flex-shrink-0">
        <span className="text-[#0c2443] font-bold text-sm">{number}</span>
      </div>
      <div className="flex-1 pt-1">
        <h4 className="font-semibold text-white text-sm">{title}</h4>
        <p className="text-white/50 text-xs mt-1">{description}</p>
      </div>
    </div>
  );
}

// Info Box Component
function InfoBox({ children, variant = "info" }: { children: React.ReactNode; variant?: "info" | "tip" | "warning" }) {
  const styles = {
    info: "bg-[#17c3ce]/10 border-[#17c3ce]/20 text-[#17c3ce]",
    tip: "bg-[#c8fa64]/10 border-[#c8fa64]/20 text-[#c8fa64]",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-400"
  };
  return (
    <div className={`rounded-lg border p-3 ${styles[variant]}`}>
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}

// Feature List Item
function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-white/70">
      <Check className="h-4 w-4 text-[#c8fa64] flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

// Quality Badge Component
function QualityBadge({ sources, color }: { sources: number; color: "yellow" | "lime" | "cyan" }) {
  const styles = {
    yellow: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    lime: "bg-[#c8fa64]/20 text-[#c8fa64] border-[#c8fa64]/30",
    cyan: "bg-[#17c3ce]/20 text-[#17c3ce] border-[#17c3ce]/30"
  };
  const labels = {
    yellow: "Prüfen empfohlen",
    lime: "Gute Qualität",
    cyan: "Hohe Zuverlässigkeit"
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${styles[color]}`}>
        {sources} {sources === 1 ? 'Quelle' : 'Quellen'}
      </div>
      <span className="text-xs text-white/50">{labels[color]}</span>
    </div>
  );
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [openSection, setOpenSection] = useState<string | null>("quickstart");

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 overflow-hidden bg-gradient-to-b from-[#0E1621] to-[#0c2443] border border-white/[0.08] shadow-2xl rounded-2xl">
        
        {/* Header */}
        <DialogHeader className="relative p-6 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#17c3ce]/20 to-[#c8fa64]/20 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-[#17c3ce]" />
            </div>
            <DialogTitle className="text-xl font-bold text-white">Hilfe & Anleitung</DialogTitle>
          </div>
          <DialogDescription className="text-center text-white/50 text-sm mt-2">
            Alles was Sie über RowBooster wissen müssen
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-4 sm:p-6 space-y-3">

            {/* Quick Start */}
            <AccordionItem
              title="Schnellstart – In 4 Schritten loslegen"
              icon={Zap}
              isOpen={openSection === "quickstart"}
              onToggle={() => toggleSection("quickstart")}
              accentColor="cyan"
            >
              <div className="space-y-4">
                <Step number="1" title="Modus wählen" description="Automatisch (KI sucht) oder Manuell (Sie bestimmen URLs)" />
                <Step number="2" title="Daten eingeben" description="Produktname eingeben oder Excel-Datei hochladen" />
                <Step number="3" title="Extraktion starten" description="KI analysiert Quellen und extrahiert Daten" />
                <Step number="4" title="Ergebnisse exportieren" description="Als Excel-Datei mit Farbcodierung herunterladen" />
              </div>
            </AccordionItem>

            {/* Automatic Mode */}
            <AccordionItem
              title="Automatischer Modus"
              icon={Sparkles}
              isOpen={openSection === "auto"}
              onToggle={() => toggleSection("auto")}
              accentColor="cyan"
            >
              <div className="space-y-4">
                <p className="text-sm text-white/60">
                  Die KI sucht selbstständig nach passenden Datenquellen im Web.
                </p>
                
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Vorteile</h5>
                  <ul className="space-y-2">
                    <FeatureItem>Kein Vorwissen über URLs nötig</FeatureItem>
                    <FeatureItem>Schneller Einstieg mit nur Produktname</FeatureItem>
                    <FeatureItem>KI findet automatisch Herstellerseiten</FeatureItem>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Excel-Format</h5>
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs">
                      <FileSpreadsheet className="h-4 w-4 text-[#c8fa64]" />
                      <code className="text-white/70">Artikelnummer | <span className="text-[#17c3ce] font-semibold">Produktname*</span></code>
                    </div>
                    <p className="text-[10px] text-white/40 mt-2">* Pflichtfeld</p>
                  </div>
                </div>

                <InfoBox variant="tip">
                  <strong>Tipp:</strong> Aktivieren Sie den PDF Extractor, um auch Datenblätter aus der Web-Suche zu nutzen.
                </InfoBox>
              </div>
            </AccordionItem>

            {/* Manual Mode */}
            <AccordionItem
              title="Manueller Modus"
              icon={Settings2}
              isOpen={openSection === "manual"}
              onToggle={() => toggleSection("manual")}
              accentColor="lime"
            >
              <div className="space-y-4">
                <p className="text-sm text-white/60">
                  Sie bestimmen selbst die Datenquellen (URLs und lokale PDFs).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* URL Only */}
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-[#17c3ce]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-[#17c3ce]" />
                      <span className="text-sm font-semibold text-white">Nur URLs</span>
                    </div>
                    <ul className="text-xs text-white/60 space-y-1">
                      <li>• Produktname (Pflicht)</li>
                      <li>• URL (Pflicht)</li>
                      <li>• Artikelnummer (optional)</li>
                    </ul>
                  </div>

                  {/* URL + PDF */}
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-[#c8fa64]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-[#c8fa64]" />
                      <span className="text-sm font-semibold text-white">URL + PDF</span>
                    </div>
                    <ul className="text-xs text-white/60 space-y-1">
                      <li>• <span className="text-[#c8fa64]">Artikelnummer (Pflicht!)</span></li>
                      <li>• Produktname (Pflicht)</li>
                      <li>• URL (Pflicht)</li>
                    </ul>
                  </div>
                </div>

                <InfoBox variant="warning">
                  <strong>PDF-Benennung:</strong> Dateiname muss mit Artikelnummer beginnen, z.B. <code className="bg-white/10 px-1 rounded">TV-001_Datenblatt.pdf</code>
                </InfoBox>
              </div>
            </AccordionItem>

            {/* API Keys */}
            <AccordionItem
              title="API-Schlüssel einrichten"
              icon={Key}
              isOpen={openSection === "api"}
              onToggle={() => toggleSection("api")}
              accentColor="cyan"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-[#c8fa64]" />
                        <span className="text-sm font-semibold text-white">OpenAI</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Pflicht</span>
                    </div>
                    <p className="text-xs text-white/50">KI-Modell für Datenextraktion</p>
                  </div>

                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-[#17c3ce]" />
                        <span className="text-sm font-semibold text-white">ValueSERP</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#17c3ce]/20 text-[#17c3ce]">Empfohlen</span>
                    </div>
                    <p className="text-xs text-white/50">Web-Suche für Auto-Modus</p>
                  </div>
                </div>

                <InfoBox variant="info">
                  API-Schlüssel werden in den <strong>Einstellungen</strong> konfiguriert. Ohne OpenAI-Key ist keine Extraktion möglich.
                </InfoBox>
              </div>
            </AccordionItem>

            {/* Export & Quality */}
            <AccordionItem
              title="Export & Datenqualität"
              icon={Download}
              isOpen={openSection === "export"}
              onToggle={() => toggleSection("export")}
              accentColor="lime"
            >
              <div className="space-y-4">
                <p className="text-sm text-white/60">
                  Die Farbcodierung zeigt, wie viele Quellen einen Wert bestätigen.
                </p>

                <div className="space-y-2">
                  <QualityBadge sources={1} color="yellow" />
                  <QualityBadge sources={2} color="lime" />
                  <QualityBadge sources={3} color="cyan" />
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Best Practices</h5>
                  <ul className="space-y-2">
                    <FeatureItem>Vollständige Produktnamen verwenden</FeatureItem>
                    <FeatureItem>Herstellerseiten bevorzugen</FeatureItem>
                    <FeatureItem>Gelb markierte Werte manuell prüfen</FeatureItem>
                  </ul>
                </div>

                <InfoBox variant="tip">
                  Der Export enthält alle Daten mit Farbcodierung als <code className="bg-white/10 px-1 rounded">.xlsx</code> Datei.
                </InfoBox>
              </div>
            </AccordionItem>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-center gap-2">
            <img src={rowboosterLogo} alt="RowBooster" className="h-5 opacity-50" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
