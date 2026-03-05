
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calculator, 
  Search, 
  Download, 
  Send,
  MoreVertical,
  ArrowUpRight,
  TrendingDown,
  FileCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MOCK_LIQUIDATIONS: Liquidation[] = [
  { 
    id: '1', 
    propertyId: 'p1',
    propertyName: 'Las Heras 4B', 
    ownerId: 'o1',
    ownerName: 'Juan Pérez',
    rentIncome: 185000, 
    adminFeeDeduction: 9250, 
    maintenanceDeductions: 0, 
    expenseDeductions: 12000, // Expensas Extraordinarias a cargo del dueño
    netAmount: 163750, 
    period: 'Abril 2024',
    status: 'Pendiente',
    dateCreated: '2024-04-15'
  },
  { 
    id: '2', 
    propertyId: 'p2',
    propertyName: 'Quinta del Sol', 
    ownerId: 'o2',
    ownerName: 'Marta Rodriguez',
    rentIncome: 250000, 
    adminFeeDeduction: 12500, 
    maintenanceDeductions: 85000, 
    expenseDeductions: 0,
    netAmount: 152500, 
    period: 'Marzo 2024',
    status: 'Pagada',
    dateCreated: '2024-03-15',
    paymentReference: 'TRANSF-GALICIA-221'
  },
];

export function LiquidationsView() {
  const [liquidations] = useState<Liquidation[]>(MOCK_LIQUIDATIONS);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar liquidación o dueño..." className="pl-9 bg-white shadow-sm" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar Reporte Mensual
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Calculator className="h-4 w-4" />
            Nueva Liquidación
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Recaudado (Bruto)</span>
          <span className="text-xl font-black">$ 435.000</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-primary block">Comisiones Adm.</span>
          <span className="text-xl font-black text-primary">$ 21.750</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Deducciones (Gastos/Exp)</span>
          <span className="text-xl font-black text-red-600">$ 97.000</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-green-500">
          <span className="text-[10px] uppercase font-bold text-green-700 block">Total a Liquidar</span>
          <span className="text-xl font-black text-green-700">$ 316.250</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propietario / Unidad</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Alquiler Bruto</TableHead>
              <TableHead className="text-right">Deducciones Totales</TableHead>
              <TableHead className="text-right">Neto a Transferir</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{l.ownerName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{l.propertyName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{l.period}</TableCell>
                <TableCell className="text-right text-xs font-medium">$ {l.rentIncome.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end text-[10px]">
                    <span className="text-primary">Adm: - $ {l.adminFeeDeduction.toLocaleString('es-AR')}</span>
                    {l.maintenanceDeductions > 0 && (
                      <span className="text-red-600">Reparaciones: - $ {l.maintenanceDeductions.toLocaleString('es-AR')}</span>
                    )}
                    {l.expenseDeductions > 0 && (
                      <span className="text-orange-600 font-bold">Exp. Extraord: - $ {l.expenseDeductions.toLocaleString('es-AR')}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 text-green-700 font-black text-sm">
                    $ {l.netAmount.toLocaleString('es-AR')}
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "border font-bold",
                    l.status === 'Pagada' ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"
                  )}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-700">
                      <FileCheck className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
