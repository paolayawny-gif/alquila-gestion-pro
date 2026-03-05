"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, FileText, Upload, Search, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function InvoicesView() {
  const [invoices] = useState<Invoice[]>([
    { id: '1', concept: 'Luz (Edenor) - Edificio Centro', amount: 45000, dueDate: '25/03/2024', status: 'Pagado', hasFile: true },
    { id: '2', concept: 'Expensas - Las Heras 4B', amount: 120000, dueDate: '10/04/2024', status: 'Pendiente', hasFile: false },
    { id: '3', concept: 'ABL - Quinta del Sol', amount: 35000, dueDate: '05/04/2024', status: 'Vencido', hasFile: true },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar concepto..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Concepto</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Documento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium text-foreground">{i.concept}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.dueDate}</TableCell>
                <TableCell className="text-right font-bold">$ {i.amount.toLocaleString('es-AR')}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    "border-none",
                    i.status === 'Pagado' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                    i.status === 'Vencido' ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"
                  )}>
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {i.hasFile ? (
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1 h-8">
                      <FileText className="h-4 w-4" /> PDF
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 gap-1 h-8">
                      <Upload className="h-4 w-4" /> Subir
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit2 className="h-4 w-4" />
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
