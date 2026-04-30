"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, DollarSign, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Payment = {
  id: string;
  monthYear: string;
  amount: number;
  totalDue: number;
  amountPaid: number;
  status: string;
  paymentDate?: string;
  contract?: { property: { address: string }; tenant: { firstName: string; lastName: string } };
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPayments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobros y Pagos</h1>
          <p className="text-muted-foreground mt-1">Control de alquileres, expensas y MercadoPago</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Registrar Pago
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {payments.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
              No hay reportes de pagos en el sistema.
            </div>
          ) : (
            payments.map((payment) => (
              <Card key={payment.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${payment.status === 'PAGADO' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {payment.status === 'PAGADO' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-1">
                        Mes: {payment.monthYear}
                      </CardTitle>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${payment.status === 'PAGADO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {payment.status}
                  </span>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm">
                    <strong>Propiedad:</strong> {payment.contract?.property.address}
                  </p>
                  <p className="text-sm">
                    <strong>Inquilino:</strong> {payment.contract?.tenant.firstName} {payment.contract?.tenant.lastName}
                  </p>
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md mt-2">
                    <span className="text-sm text-muted-foreground">Total a pagar:</span>
                    <span className="font-bold text-lg">${payment.totalDue.toLocaleString('es-AR')}</span>
                  </div>
                  
                  <div className="pt-3 flex gap-2">
                    {payment.status !== 'PAGADO' && (
                      <Button variant="default" size="sm" className="w-full">Generar Link MP</Button>
                    )}
                    <Button variant="outline" size="sm" className="w-full">
                      {payment.status === 'PAGADO' ? 'Descargar Recibo' : 'Enviar Aviso'}
                    </Button>
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
