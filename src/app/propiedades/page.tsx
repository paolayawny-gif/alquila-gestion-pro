"use client";

import { useEffect, useState } from "react";
import { Plus, Home, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Property = {
  id: string;
  address: string;
  type: string;
  status: string;
  owner?: { firstName: string; lastName: string };
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProperties(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Propiedades</h1>
          <p className="text-muted-foreground mt-1">Gestión del catálogo de inmuebles</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nueva Propiedad
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              No hay propiedades registradas. Haz clic en "Nueva Propiedad" para comenzar.
            </div>
          ) : (
            properties.map((prop) => (
              <Card key={prop.id} className="overflow-hidden">
                <div className="h-40 bg-gray-200 flex items-center justify-center relative">
                  <Home className="h-10 w-10 text-gray-400" />
                  <span className="absolute top-2 right-2 bg-white/90 px-2 py-1 text-xs font-semibold rounded-md shadow-sm">
                    {prop.status}
                  </span>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate">{prop.address}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Tipo: <span className="font-medium text-foreground">{prop.type}</span></p>
                    <p>Propietario: <span className="font-medium text-foreground">{prop.owner ? `${prop.owner.firstName} ${prop.owner.lastName}` : "Sin asignar"}</span></p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full">Ver Detalles</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
