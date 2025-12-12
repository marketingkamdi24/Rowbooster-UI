import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";
import { SearchResponse } from "@shared/schema";

interface RawContentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  searchResult: SearchResponse | null;
}

export default function RawContentViewer({ isOpen, onClose, searchResult }: RawContentViewerProps) {
  const [activeTab, setActiveTab] = useState(0);

  // If no search result or no raw content, show a message
  if (!searchResult || !searchResult.products || !searchResult.products[0]) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Suchergebnis-Inhalt</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md">
            <p className="text-gray-500">Kein Rohinhalt für dieses Suchergebnis verfügbar.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Access raw content from the product
  // The __rawContent property is not in the type definition but it's available at runtime
  const rawContent = (searchResult.products[0] as any).__rawContent || [];
  
  // Download raw content as a text file
  const downloadContent = () => {
    if (rawContent.length === 0 || activeTab >= rawContent.length) {
      return;
    }
    
    const selectedContent = rawContent[activeTab];
    const content = typeof selectedContent === 'string' ? selectedContent : JSON.stringify(selectedContent, null, 2);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-content-${activeTab + 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Download all content as a single file
  const downloadAllContent = () => {
    if (rawContent.length === 0) {
      return;
    }
    
    const allContent = rawContent.map((content: any, index: number) => {
      const processedContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return `---------- CONTENT SOURCE #${index + 1} ----------\n\n${processedContent}\n\n`;
    }).join('\n\n');
    
    const blob = new Blob([allContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-search-content.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Suchergebnis-Inhalt</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="bg-blue-50 p-3 rounded-md text-sm mb-2">
          <p className="text-blue-700">
            Unten finden Sie den Rohinhalt, der an das KI-Modell zur Datenextraktion gesendet wurde.
            Dieser Inhalt wurde aus den Suchergebnissen gesammelt.
          </p>
        </div>
        
        <div className="flex space-x-2 mb-2 overflow-x-auto">
          {rawContent.length > 0 && rawContent.map((_: any, index: number) => (
            <Button
              key={index}
              variant={activeTab === index ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(index)}
            >
              Inhalt {index + 1}
            </Button>
          ))}
        </div>
        
        <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-md border">
          <pre className="text-sm whitespace-pre-wrap">
            {typeof rawContent[activeTab] === 'string'
              ? rawContent[activeTab]
              : JSON.stringify(rawContent[activeTab], null, 2)}
          </pre>
        </div>
        
        <DialogFooter className="flex justify-between items-center mt-2">
          <div>
            <span className="text-sm text-gray-500">
              Zeige Inhalt {activeTab + 1} von {rawContent.length}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={downloadContent}>
              <FileDown className="h-4 w-4 mr-1" />
              Aktuellen Inhalt herunterladen
            </Button>
            <Button variant="default" onClick={downloadAllContent}>
              <FileDown className="h-4 w-4 mr-1" />
              Alle Inhalte herunterladen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}