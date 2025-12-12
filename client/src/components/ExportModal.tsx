import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { SearchResponse, ExportOptions } from "@shared/schema";
import { exportToFile } from "@/lib/utils/exportData";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResult: SearchResponse | null;
}

export default function ExportModal({ isOpen, onClose, searchResult }: ExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [includeProductData, setIncludeProductData] = useState(true);
  const [includeSourceUrls, setIncludeSourceUrls] = useState(true);
  const [includeConfidenceScores, setIncludeConfidenceScores] = useState(true);
  const [filename, setFilename] = useState("product_data_export");

  const exportMutation = useMutation({
    mutationFn: async (exportOptions: ExportOptions) => {
      const response = await apiRequest("POST", "/api/export", exportOptions);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.ready && searchResult) {
        // Handle client-side export
        exportToFile({
          searchResult,
          format: exportFormat,
          includeProductData,
          includeSourceUrls,
          includeConfidenceScores,
          filename,
        });
        
        toast({
          title: "Export erfolgreich",
          description: `Daten exportiert nach ${filename}.${exportFormat}`,
        });
        
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: "Export fehlgeschlagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!searchResult) {
      toast({
        title: "Export-Fehler",
        description: "Keine Suchergebnisse zum Exportieren vorhanden",
        variant: "destructive",
      });
      return;
    }

    const exportOptions: ExportOptions = {
      format: exportFormat,
      includeProductData,
      includeSourceUrls,
      includeConfidenceScores,
      filename,
    };

    exportMutation.mutate(exportOptions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daten exportieren</DialogTitle>
          <DialogDescription>
            Wählen Sie Ihre Exportoptionen und das Format
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Exportformat</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as "xlsx" | "csv")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="format-xlsx" />
                <Label htmlFor="format-xlsx">Excel (XLSX)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv">CSV</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Was einschließen</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-product-data"
                  checked={includeProductData}
                  onCheckedChange={(checked) => setIncludeProductData(!!checked)}
                />
                <Label htmlFor="include-product-data">Produktdaten</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-source-urls"
                  checked={includeSourceUrls}
                  onCheckedChange={(checked) => setIncludeSourceUrls(!!checked)}
                />
                <Label htmlFor="include-source-urls">Quell-URLs</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-confidence-scores"
                  checked={includeConfidenceScores}
                  onCheckedChange={(checked) => setIncludeConfidenceScores(!!checked)}
                />
                <Label htmlFor="include-confidence-scores">Konfidenzwerte</Label>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="filename">Dateiname</Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exportMutation.isPending || !searchResult}
          >
            Exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
