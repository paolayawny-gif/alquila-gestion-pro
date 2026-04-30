"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TenantPortal() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch for tenant details
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
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portal del Inquilino</h1>
        <p className="text-muted-foreground mt-1">Gestión de su alquiler y pagos.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900">Aviso: Próximo Ajuste</h3>
          <p className="text-sm text-blue-800 mt-1">
            Recuerde que en el mes de Enero 2024 se aplicará el ajuste anual correspondiente a su contrato según el Índice ICL.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de Cuenta: Noviembre 2023</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg text-center border">
              <p className="text-sm text-muted-foreground mb-1">Monto Alquiler</p>
              <p className="text-2xl font-bold">$120,000</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center border">
              <p className="text-sm text-muted-foreground mb-1">Expensas / Gastos</p>
              <p className="text-2xl font-bold">$15,500</p>
            </div>
            <div className="p-4 bg-red-50 text-red-900 rounded-lg text-center border border-red-200">
              <p className="text-sm font-medium mb-1">Total a Pagar</p>
              <p className="text-2xl font-bold">$135,500</p>
            </div>
          </div>
          
          <Button className="w-full h-12 text-lg">
            <CreditCard className="mr-2 h-5 w-5" /> Pagar con MercadoPago
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            El vencimiento opera el día 10 de cada mes. Pasada esta fecha aplicarán intereses resarcitorios.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mi Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Propiedad</span>
                <span className="font-medium">Av. Libertador 1234, 4to B</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Inicio</span>
                <span className="font-medium">01/10/2023</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Fin</span>
                <span className="font-medium">30/09/2026</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-muted-foreground">Índice de Ajuste</span>
                <span className="font-medium">ICL Anual</span>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              <FileText className="mr-2 h-4 w-4" /> Bajar PDF del Contrato
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos Recibos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Alquiler Octubre 2023</p>
                <p className="text-xs text-green-600 font-semibold">Pagado el 05/10/2023</p>
              </div>
              <Button size="sm" variant="ghost">PDF</Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Alquiler Septiembre 2023</p>
                <p className="text-xs text-green-600 font-semibold">Pagado el 08/09/2023</p>
              </div>
              <Button size="sm" variant="ghost">PDF</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
