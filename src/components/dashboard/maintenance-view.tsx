"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Wrench, Upload, Search, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function MaintenanceView() {
  const [tasks] = useState<MaintenanceTask[]>([
    { id: '1', concept: 'Reparación de Caño PB - Edificio Las Heras', amount: 85000, dueDate: '20/03/2024', status: 'Completado', hasFile: true },
    { id: '2', concept: 'Pintura Fachada - Quinta del Sol', amount: 450000, dueDate: '15/04/2024', status: 'En curso', hasFile: false },
    { id: '3', concept: 'Revisión Gas - Local Centro', amount: 25000, dueDate: '30/03/2024', status: 'Pendiente', hasFile: false },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar reparación..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Wrench className="h-4 w-4" />
          Nueva Tarea
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Concepto / Tarea</TableHead>
              <TableHead>Fecha Estimada</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Comprobante</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-foreground">{t.concept}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.dueDate}</TableCell>
                <TableCell className="text-right font-bold">$ {t.amount.toLocaleString('es-AR')}</TableCell>
                <TableCell>
                  <Badge className={cn(
                    "border-none",
                    t.status === 'Completado' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                    t.status === 'En curso' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"
                  )}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {t.hasFile ? (
                    <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50 gap-1 h-8">
                      <CheckCircle className="h-4 w-4" /> Recibo
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
