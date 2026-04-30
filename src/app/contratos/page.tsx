"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Loader2, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Contract = {
  id: string;
  startDate: string;
  durationMonths: number;
  initialAmount: number;
  currency: string;
  adjustmentIndex: string;
  status: string;
  property?: { address: string };
  tenant?: { firstName: string; lastName: string };
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contracts")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setContracts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground mt-1">Gestión de alquileres vigentes e históricos</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Contrato
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contracts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              No hay contratos registrados. Haz clic en "Nuevo Contrato" para comenzar.
            </div>
          ) : (
            contracts.map((contract) => (
              <Card key={contract.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">
                      {contract.property?.address || "Propiedad no especificada"}
                    </CardTitle>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                    {contract.status}
                  </span>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Inquilino</p>
                    <p className="font-medium text-sm">
                      {contract.tenant ? `${contract.tenant.firstName} ${contract.tenant.lastName}` : "No asignado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Monto Inicial
                    </p>
                    <p className="font-medium text-sm">
                      {contract.currency} ${contract.initialAmount.toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Inicio de Contrato
                    </p>
                    <p className="font-medium text-sm">
                      {new Date(contract.startDate).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ajuste y Frecuencia</p>
                    <p className="font-medium text-sm">
                      Índice: {contract.adjustmentIndex}
                    </p>
                  </div>
                  
                  <div className="col-span-2 pt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full text-xs">Ver Contrato Completo</Button>
                    <Button variant="default" size="sm" className="w-full text-xs">Ajuste de Alquiler</Button>
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
