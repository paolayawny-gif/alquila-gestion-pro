"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Building, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property } from '@/lib/types';

export function PropertiesView() {
  const [properties] = useState<Property[]>([
    { id: '1', name: 'Edificio Las Heras', address: 'Las Heras 1234', unit: '4B', ownerName: 'Juan Pérez', monthlyRent: 120000 },
    { id: '2', name: 'Quinta del Sol', address: 'Ruta 2 Km 50', ownerName: 'Maria Garcia', monthlyRent: 250000 },
    { id: '3', name: 'Local Comercial Centro', address: 'Florida 500', ownerName: 'Roberto Gomez', monthlyRent: 300000 },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar propiedad..." className="pl-9 bg-white" />
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Nueva Propiedad
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Nombre / Referencia</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead className="text-right">Alquiler</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    {p.name}
                  </div>
                </TableCell>
                <TableCell>{p.address}</TableCell>
                <TableCell>{p.unit || 'Casa / Piso completo'}</TableCell>
                <TableCell>{p.ownerName}</TableCell>
                <TableCell className="text-right font-semibold">$ {p.monthlyRent.toLocaleString('es-AR')}</TableCell>
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
