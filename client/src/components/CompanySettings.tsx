import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CompanySettingsProps {
  onCompanyNameChange?: (name: string) => void;
  onCompanyLogoChange?: (logo: string) => void;
}

export default function CompanySettings({ 
  onCompanyNameChange, 
  onCompanyLogoChange 
}: CompanySettingsProps) {
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedCompanyName = localStorage.getItem("company_name") || "";
    const savedCompanyLogo = localStorage.getItem("company_logo") || null;
    
    setCompanyName(savedCompanyName);
    if (onCompanyNameChange) {
      onCompanyNameChange(savedCompanyName);
    }
    
    if (savedCompanyLogo) {
      setCompanyLogo(savedCompanyLogo);
      if (onCompanyLogoChange) {
        onCompanyLogoChange(savedCompanyLogo);
      }
    }
  }, [onCompanyNameChange, onCompanyLogoChange]);

  // Handle company name change
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCompanyName(name);
    localStorage.setItem("company_name", name);
    if (onCompanyNameChange) {
      onCompanyNameChange(name);
    }
  };

  // Handle logo file selection
  const handleLogoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte wählen Sie eine Bilddatei (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Das Logo-Bild sollte kleiner als 2MB sein",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const logoDataUrl = event.target?.result as string;
      setCompanyLogo(logoDataUrl);
      localStorage.setItem("company_logo", logoDataUrl);
      if (onCompanyLogoChange) {
        onCompanyLogoChange(logoDataUrl);
      }
      toast({
        title: "Logo hochgeladen",
        description: "Ihr Unternehmenslogo wurde aktualisiert",
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle logo removal
  const handleRemoveLogo = () => {
    setCompanyLogo(null);
    localStorage.removeItem("company_logo");
    if (onCompanyLogoChange) {
      onCompanyLogoChange("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "Logo entfernt",
      description: "Ihr Unternehmenslogo wurde entfernt",
    });
  };

  return (
    <Card className="bg-black/20 backdrop-blur-sm border-white/10">
      <CardHeader className="p-3 sm:p-4 border-b border-white/10">
        <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--rb-cyan)] flex-shrink-0" />
          Unternehmenseinstellungen
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-sm font-medium text-white/90">Unternehmensname</Label>
            <Input 
              id="company-name" 
              placeholder="Ihr Unternehmen GmbH" 
              value={companyName}
              onChange={handleCompanyNameChange}
              className="bg-black/30 border-white/15 text-white placeholder:text-white/40 focus:border-[var(--rb-cyan)]"
            />
            <p className="text-xs text-white/50">Der Name wird in der Kopfzeile angezeigt</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/90">Unternehmenslogo</Label>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="min-w-20 min-h-20 w-20 h-20 sm:min-w-24 sm:min-h-24 sm:w-24 sm:h-24 bg-black/30 border border-white/15 rounded-xl flex items-center justify-center relative flex-shrink-0">
                {companyLogo ? (
                  <>
                    <img 
                      src={companyLogo} 
                      alt="Company Logo" 
                      className="max-w-full max-h-full p-1 object-contain"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                      title="Logo entfernen"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <Building2 className="h-10 w-10 text-white/30" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mb-2 border-white/20 text-white/80 hover:bg-white/10 hover:text-white whitespace-nowrap"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2 flex-shrink-0" />
                  Logo hochladen
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelection}
                />
                <p className="text-xs text-white/50 break-words">
                  Empfohlene Größe: 200x200 Pixel, max. 2MB
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}