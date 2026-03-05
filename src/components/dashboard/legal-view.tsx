"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scale, Edit2, Trash2, FileCheck, Upload, Search, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LegalCase } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function LegalView() {
  const [cases] = useState<LegalCase[]>([
    { id: '1', type: 'Desalojo por Falta de Pago', propertyName: 'Quinta del Sol', startDate: '10/01/2024', attorney: 'Dr. Ricardo Darín', status: 'En proceso', hasFile: true },
    { id: '2', type: 'Mediación por Daños', propertyName: 'Edificio Las Heras 4B', startDate: '05/03/2024', attorney: 'Dra. Elena Rogers', status: 'Acuerdo firmado', hasFile: true },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar trámite..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-white gap-2">
          <Scale className="h-4 w-4" />
          Nuevo Trámite
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Tipo de Trámite</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Abogado/a</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Archivo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.propertyName}</TableCell>
                <TableCell className="text-sm">{c.startDate}</TableCell>
                <TableCell className="text-sm">
                   <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                    {c.attorney}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    "border-none",
                    c.status === 'Acuerdo firmado' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                    c.status === 'En proceso' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" : "bg-muted text-muted-foreground"
                  )}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {c.hasFile ? (
                    <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50 gap-1 h-8">
                      <FileCheck className="h-4 w-4" /> PDF
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
