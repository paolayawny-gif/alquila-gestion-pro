"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Edit2, Trash2, Search, ArrowRight, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation } from '@/lib/types';

export function LiquidationsView() {
  const [liquidations] = useState<Liquidation[]>([
    { id: '1', propertyName: 'Edificio Las Heras 4B', rentAmount: 120000, adminFee: 6000, maintenanceDeductions: 0, netAmount: 114000, period: 'Marzo 2024' },
    { id: '2', propertyName: 'Quinta del Sol', rentAmount: 250000, adminFee: 12500, maintenanceDeductions: 85000, netAmount: 152500, period: 'Marzo 2024' },
    { id: '3', propertyName: 'Local Florida', rentAmount: 300000, adminFee: 15000, maintenanceDeductions: 25000, netAmount: 260000, period: 'Marzo 2024' },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar liquidación..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Calculator className="h-4 w-4" />
          Nueva Liquidación
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propiedad</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">Alquiler Bruto</TableHead>
              <TableHead className="text-right">Honorarios</TableHead>
              <TableHead className="text-right">Gastos Mant.</TableHead>
              <TableHead className="text-right">Neto a Pagar</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium text-foreground">{l.propertyName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.period}</TableCell>
                <TableCell className="text-right font-medium">$ {l.rentAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-accent">- $ {l.adminFee.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-accent">- $ {l.maintenanceDeductions.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 text-green-700 font-black">
                    $ {l.netAmount.toLocaleString('es-AR')}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
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
