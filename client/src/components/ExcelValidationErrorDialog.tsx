import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";

export interface ExcelValidationError {
  message: string;
  details?: string;
  missingColumns: string[];
  detectedColumns: {
    hasProduktname: boolean;
    hasArtikelnummer: boolean;
    hasUrl?: boolean;
  };
  mode: 'automated' | 'url' | 'url+pdf';
  modeName: string;
}

interface ExcelValidationErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: ExcelValidationError | null;
}

export default function ExcelValidationErrorDialog({
  open,
  onOpenChange,
  error
}: ExcelValidationErrorDialogProps) {
  if (!error) return null;

  // Determine required columns based on mode
  const getRequiredColumns = (mode: string) => {
    switch (mode) {
      case 'automated':
        return [
          { name: 'Artikelnummer', required: false },
          { name: 'Produktname', required: true },
        ];
      case 'url':
        return [
          { name: 'Artikelnummer', required: false },
          { name: 'Produktname', required: true },
          { name: 'URL', required: true },
        ];
      case 'url+pdf':
        return [
          { name: 'Artikelnummer', required: true },
          { name: 'Produktname', required: true },
          { name: 'URL', required: true },
        ];
      default:
        return [
          { name: 'Artikelnummer', required: false },
          { name: 'Produktname', required: true },
        ];
    }
  };

  const requiredColumns = getRequiredColumns(error.mode);
  const isMissing = (colName: string) => error.missingColumns.includes(colName);
  const isDetected = (colName: string) => {
    if (colName === 'Produktname') return error.detectedColumns.hasProduktname;
    if (colName === 'Artikelnummer') return error.detectedColumns.hasArtikelnummer;
    if (colName === 'URL') return error.detectedColumns.hasUrl ?? false;
    return false;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="rounded-lg border-2 border-red-200 bg-red-50 overflow-hidden">
          {/* Error Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border-b border-red-200">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
            <span className="text-sm sm:text-base font-semibold text-red-700">
              Fehlende Spalte{error.missingColumns.length > 1 ? 'n' : ''}: {error.missingColumns.join(', ')}
            </span>
          </div>
          
          {/* Error Details */}
          <div className="p-3 sm:p-4 space-y-3">
            {error.details && (
              <p className="text-xs sm:text-sm text-red-600">
                {error.details}
              </p>
            )}
            
            {/* Expected Format Section */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-red-700">
                📋 Erwartetes Excel-Format für {error.modeName}:
              </p>
              
              {/* Visual Expected Format Table */}
              <div className="bg-white rounded border border-red-200 overflow-hidden text-[10px] sm:text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {requiredColumns.map((col, index) => (
                        <th
                          key={col.name}
                          className={`px-2 sm:px-3 py-1 sm:py-2 text-left font-semibold ${
                            index < requiredColumns.length - 1 ? 'border-r border-gray-200' : ''
                          } ${
                            isMissing(col.name)
                              ? 'bg-red-100 text-red-700'
                              : isDetected(col.name)
                                ? 'text-green-700 bg-green-50'
                                : 'text-gray-500 bg-gray-50'
                          }`}
                        >
                          {col.name}
                          {col.required ? (
                            <span className="ml-1 text-[8px] sm:text-[9px] font-bold text-red-500">*Pflicht</span>
                          ) : (
                            <span className="ml-1 text-[8px] sm:text-[9px] text-gray-400 italic">(optional)</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-gray-500">
                    <tr className="border-t border-gray-100">
                      <td className="px-2 sm:px-3 py-1 sm:py-1.5 border-r border-gray-100 font-mono text-gray-400">
                        TV-001
                      </td>
                      <td className={`px-2 sm:px-3 py-1 sm:py-1.5 ${requiredColumns.length > 2 ? 'border-r border-gray-100' : ''}`}>
                        Samsung TV 55"
                      </td>
                      {requiredColumns.length > 2 && (
                        <td className="px-2 sm:px-3 py-1 sm:py-1.5 text-blue-500 truncate max-w-[120px] sm:max-w-[180px]">
                          https://samsung.de/...
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Detected columns summary */}
              <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs">
                <span className="text-gray-500">Erkannte Spalten:</span>
                {error.detectedColumns.hasProduktname && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✓ Produktname</span>
                )}
                {error.detectedColumns.hasArtikelnummer && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✓ Artikelnummer</span>
                )}
                {error.detectedColumns.hasUrl && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✓ URL</span>
                )}
                {error.missingColumns.map(col => (
                  <span key={col} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">✗ {col}</span>
                ))}
              </div>
            </div>
          </div>
          
          {/* Footer with OK button */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 bg-red-50 border-t border-red-200 flex justify-end">
            <AlertDialogAction 
              onClick={() => onOpenChange(false)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 text-sm font-medium"
            >
              Verstanden
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}