"use client";

import { useEffect, useState } from "react";
import { DollarSign, FileText, Home, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OwnerPortal() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch for owner metrics
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12 h-screen items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portal del Propietario</h1>
        <p className="text-muted-foreground mt-1">Bienvenido. Aquí está el resumen de sus propiedades.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$450,000</div>
            <p className="text-xs text-muted-foreground">Liquidación pendiente: $50,000</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propiedades Alquiladas</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 / 3</div>
            <p className="text-xs text-muted-foreground">1 Propiedad disponible</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Ajustes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1 Propiedad</div>
            <p className="text-xs text-muted-foreground">Ajuste programado para el mes que viene</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mis Propiedades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold">Av. Libertador 1234, 4to B</p>
                <p className="text-sm text-muted-foreground">Alquilada - Contrato vence: 10/2026</p>
              </div>
              <Button variant="outline" size="sm">Detalles</Button>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold">Calle Falsa 123</p>
                <p className="text-sm text-yellow-600 font-medium">Disponible</p>
              </div>
              <Button variant="outline" size="sm">Status Visitas</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Liquidaciones y Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-semibold text-sm">Liquidación Octubre 2023</p>
                  <p className="text-xs text-muted-foreground">PDF - 120 KB</p>
                </div>
              </div>
              <Button size="sm">Descargar</Button>
            </div>
            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-semibold text-sm">Contrato Libertador 1234</p>
                  <p className="text-xs text-muted-foreground">PDF Firmado</p>
                </div>
              </div>
              <Button size="sm" variant="secondary">Ver PDF</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
