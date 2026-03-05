"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Edit2, Trash2, FileCheck, Upload, Search, Phone, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tenant } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function TenantsView() {
  const [tenants] = useState<Tenant[]>([
    { id: '1', name: 'Carlos Sosa', propertyId: '1', propertyName: 'Edificio Las Heras 4B', phone: '11 4455-6677', leaseEndDate: '15/05/2025', status: 'Al día', hasContractFile: true },
    { id: '2', name: 'Marta Rodriguez', propertyId: '2', propertyName: 'Quinta del Sol', phone: '11 2233-4455', leaseEndDate: '01/12/2024', status: 'Atrasado', hasContractFile: false },
    { id: '3', name: 'Estudio Jurídico Lynch', propertyId: '3', propertyName: 'Local Florida', phone: '11 9988-7766', leaseEndDate: '10/01/2026', status: 'Al día', hasContractFile: true },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inquilino..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo Inquilino
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Contrato</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {t.phone}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.propertyName}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {t.leaseEndDate}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={t.status === 'Al día' ? 'default' : t.status === 'Atrasado' ? 'destructive' : 'outline'} className={cn(
                    t.status === 'Al día' && "bg-green-100 text-green-700 hover:bg-green-100 border-none",
                    t.status === 'Atrasado' && "bg-orange-100 text-orange-700 hover:bg-orange-100 border-none",
                  )}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {t.hasContractFile ? (
                    <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50 gap-1 h-8">
                      <FileCheck className="h-4 w-4" /> Ver
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

import { cn } from '@/lib/utils';
