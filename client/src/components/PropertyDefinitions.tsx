import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trash2, PlusCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { ProductProperty, InsertProductProperty } from "@shared/schema";

interface PropertyDefinitionsProps {
  properties: ProductProperty[];
}

export default function PropertyDefinitions({ properties }: PropertyDefinitionsProps) {
  const queryClient = useQueryClient();
  const [editedProperties, setEditedProperties] = useState<Record<number, ProductProperty>>({});

  // Create a new property mutation
  const createMutation = useMutation({
    mutationFn: async (property: InsertProductProperty) => {
      const response = await apiRequest("POST", "/api/properties", property);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Erfolg",
        description: "Eigenschaft erfolgreich hinzugefügt",
      });
    },
    onError: (error) => {
      toast({
        title: "Eigenschaft hinzufügen fehlgeschlagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Update property mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertProductProperty> }) => {
      const response = await apiRequest("PUT", `/api/properties/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Erfolg",
        description: "Eigenschaft erfolgreich aktualisiert",
      });
      setEditedProperties({});
    },
    onError: (error) => {
      toast({
        title: "Eigenschaft aktualisieren fehlgeschlagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Delete property mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Erfolg",
        description: "Eigenschaft erfolgreich gelöscht",
      });
    },
    onError: (error) => {
      toast({
        title: "Eigenschaft löschen fehlgeschlagen",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleAddProperty = () => {
    const newProperty: InsertProductProperty = {
      name: "",
      description: "",
      expectedFormat: "",
    };
    createMutation.mutate(newProperty);
  };

  const handlePropertyChange = (id: number, field: keyof ProductProperty, value: string) => {
    setEditedProperties((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || properties.find((p) => p.id === id) || { id }),
        [field]: value,
      },
    }));
  };

  const handleSaveProperty = (id: number) => {
    if (editedProperties[id]) {
      const { name, description, expectedFormat } = editedProperties[id];
      updateMutation.mutate({
        id,
        data: { name, description, expectedFormat },
      });
    }
  };

  const handleDeleteProperty = (id: number) => {
    if (confirm("Sind Sie sicher, dass Sie diese Eigenschaft löschen möchten?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="p-4 border-b border-gray-200 flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Produkteigenschaften Definition</h2>
        <Button
          onClick={handleAddProperty}
          variant="ghost"
          className="text-primary hover:text-primary-700 flex items-center gap-1 p-2"
        >
          <PlusCircle className="h-4 w-4" />
          Eigenschaft hinzufügen
        </Button>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/[0.06]">
                <TableHead className="w-1/4 text-white/60">Eigenschaftsname</TableHead>
                <TableHead className="w-2/5 text-white/60">Beschreibung</TableHead>
                <TableHead className="w-1/4 text-white/60">Erwartetes Format</TableHead>
                <TableHead className="w-1/12 text-white/60">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => {
                const isEdited = !!editedProperties[property.id];
                const currentValue = isEdited ? editedProperties[property.id] : property;
                
                return (
                  <TableRow key={property.id}>
                    <TableCell>
                      <Input
                        value={currentValue.name}
                        onChange={(e) => handlePropertyChange(property.id, "name", e.target.value)}
                        onBlur={() => handleSaveProperty(property.id)}
                        placeholder="Eigenschaftsname"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={currentValue.description || ""}
                        onChange={(e) => handlePropertyChange(property.id, "description", e.target.value)}
                        onBlur={() => handleSaveProperty(property.id)}
                        placeholder="Beschreibung"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={currentValue.expectedFormat || ""}
                        onChange={(e) => handlePropertyChange(property.id, "expectedFormat", e.target.value)}
                        onBlur={() => handleSaveProperty(property.id)}
                        placeholder="z.B. in kg, in mm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProperty(property.id)}
                        className="text-red-500 hover:text-red-700 p-1 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    Keine Eigenschaften definiert. Fügen Sie eine Eigenschaft hinzu, um zu beginnen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
