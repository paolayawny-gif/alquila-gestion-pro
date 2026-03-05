"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Edit2, Trash2, FileCheck, Upload, Search, Phone, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tenant, Contract } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INITIAL_CONTRACTS: Contract[] = [
  { 
    id: 'c1', 
    tenantId: '1', 
    tenantName: 'Carlos Sosa',
    propertyId: '1', 
    propertyName: 'Edificio Las Heras 4B',
    startDate: '2023-05-15',
    endDate: '2025-05-15',
    baseRentAmount: 120000,
    currentRentAmount: 185000,
    currency: 'ARS',
    adjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    nextAdjustmentDate: '2024-05-15',
    status: 'Active'
  },
  { 
    id: 'c2', 
    tenantId: '2', 
    tenantName: 'Marta Rodriguez',
    propertyId: '2', 
    propertyName: 'Quinta del Sol',
    startDate: '2022-12-01',
    endDate: '2024-12-01',
    baseRentAmount: 250000,
    currentRentAmount: 420000,
    currency: 'ARS',
    adjustmentMechanism: 'IPC',
    adjustmentFrequencyMonths: 6,
    nextAdjustmentDate: '2024-06-01',
    status: 'Overdue'
  },
];

export function TenantsView() {
  const [contracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredContracts = contracts.filter(c => 
    c.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.propertyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar inquilino o contrato..." 
            className="pl-9 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Alta de Contrato de Alquiler</DialogTitle>
              <DialogDescription>
                Configure los términos financieros y legales del nuevo contrato.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inquilino</Label>
                  <Input placeholder="Nombre completo" />
                </div>
                <div className="space-y-2">
                  <Label>Propiedad</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Edificio Las Heras 4B</SelectItem>
                      <SelectItem value="2">Quinta del Sol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Alquiler Base</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9" placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select defaultValue="ARS">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mecanismo Ajuste</Label>
                  <Select defaultValue="ICL">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ICL">ICL (BCRA)</SelectItem>
                      <SelectItem value="IPC">IPC (INDEC)</SelectItem>
                      <SelectItem value="Fixed">Fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frecuencia de Ajuste</Label>
                  <Select defaultValue="4">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">Cada 3 meses</SelectItem>
                      <SelectItem value="4">Cada 4 meses</SelectItem>
                      <SelectItem value="6">Cada 6 meses</SelectItem>
                      <SelectItem value="12">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Input type="date" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-primary text-white">Generar Contrato</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Contrato</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead className="text-right">Alquiler Actual</TableHead>
              <TableHead>Ajuste</TableHead>
              <TableHead>Vence Ajuste</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{c.tenantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {c.startDate} al {c.endDate}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.propertyName}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-black text-primary">
                      {c.currency} {c.currentRentAmount.toLocaleString('es-AR')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Base: {c.currency} {c.baseRentAmount.toLocaleString('es-AR')}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit bg-primary/5 text-primary border-primary/20">
                    <TrendingUp className="h-3 w-3" /> {c.adjustmentMechanism} ({c.adjustmentFrequencyMonths}m)
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {c.nextAdjustmentDate}
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
