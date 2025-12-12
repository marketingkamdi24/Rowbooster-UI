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
    <Card>
      <CardHeader className="p-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Unternehmenseinstellungen
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-sm font-medium">Unternehmensname</Label>
            <Input 
              id="company-name" 
              placeholder="Ihr Unternehmen GmbH" 
              value={companyName}
              onChange={handleCompanyNameChange}
            />
            <p className="text-xs text-gray-500">Der Name wird in der Kopfzeile angezeigt</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Unternehmenslogo</Label>
            <div className="flex items-start space-x-4">
              <div className="min-w-24 min-h-24 w-24 h-24 bg-gray-100 border rounded-md flex items-center justify-center relative">
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
                  <Building2 className="h-10 w-10 text-gray-300" />
                )}
              </div>
              <div className="flex flex-col">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mb-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Logo hochladen
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelection}
                />
                <p className="text-xs text-gray-500">
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