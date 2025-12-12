import { Button } from "@/components/ui/button";
import {
  FileDown,
  HelpCircle,
  Building2,
  Database,
  Search as SearchIcon,
  Settings,
  BarChart3
} from "lucide-react";
import { TokenMonitoringDashboard } from "@/components/TokenMonitoringDashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onExport: () => void;
  companyName?: string;
  companyLogo?: string;
}

export default function Header({ onExport, companyName, companyLogo }: HeaderProps) {
  const defaultAppName = "Produkt-Informationsfinder";
  
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 shadow-lg border-b border-blue-500/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {companyLogo ? (
              <div className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-white/20">
                <img 
                  src={companyLogo} 
                  alt={companyName || defaultAppName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg ring-2 ring-white/20">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                {companyName || defaultAppName}
              </h1>
              <p className="text-blue-100/90 text-sm font-medium">
                KI-gestützte technische Datenextraktion
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white/90 hover:bg-white/15 hover:text-white transition-all duration-200 rounded-lg backdrop-blur-sm h-9 px-3 border border-white/10 hover:border-white/20"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button 
              size="sm"
              className="bg-white/95 text-blue-700 hover:bg-white hover:text-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold rounded-lg backdrop-blur-sm h-9 px-4 border border-white/20"
              onClick={onExport}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportieren
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-purple-500/90 hover:bg-purple-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold rounded-lg h-9 px-4 border border-purple-400/20 hover:border-purple-300/30"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Meine Tokens
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[600px] p-4" align="end">
                <TokenMonitoringDashboard compact={true} />
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              size="sm"
              className="bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold rounded-lg h-9 px-4 border border-emerald-400/20 hover:border-emerald-300/30"
              asChild
            >
              <a href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Einstellungen
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
