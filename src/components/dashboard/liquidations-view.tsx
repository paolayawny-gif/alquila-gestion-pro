
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2,
  Search,
  Download,
  Calculator,
  ArrowDownCircle,
  TrendingUp,
  FileCheck,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Liquidation, Property, Person, Invoice, MaintenanceTask } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, query } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from '@/components/ui/separator';

interface LiquidationsViewProps {
  liquidations: Liquidation[];
  userId?: string;
  properties: Property[];
  people: Person[];
}

const APP_ID = "alquilagestion-pro";

export function LiquidationsView({ liquidations, userId, properties, people }: LiquidationsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();
  
  const [isNewLiqOpen, setIsNewLiqOpen] = useState(false);
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [period, setPeriod] = useState(new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
  const [propSearch, setPropSearch] = useState('');

  const sortedProperties = React.useMemo(
    () => [...properties].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [properties]
  );

  const filteredProperties = React.useMemo(() => {
    const q = propSearch.trim().toLowerCase();
    if (!q) return sortedProperties;
    return sortedProperties.filter(p => p.name.toLowerCase().includes(q));
  }, [sortedProperties, propSearch]);

  const allFilteredSelected = filteredProperties.length > 0 && filteredProperties.every(p => selectedPropIds.includes(p.id));
  const someFilteredSelected = filteredProperties.some(p => selectedPropIds.includes(p.id));

  const toggleProp = (id: string) => {
    setSelectedPropIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedPropIds(prev => prev.filter(id => !filteredProperties.some(p => p.id === id)));
    } else {
      setSelectedPropIds(prev => Array.from(new Set([...prev, ...filteredProperties.map(p => p.id)])));
    }
  };

  const facturasQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'facturas'));
  }, [db, userId]);
  const { data: invoicesData } = useCollection<Invoice>(facturasQuery);
  const invoices = invoicesData || [];

  const mantenimientoQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'mantenimiento'));
  }, [db, userId]);
  const { data: maintenanceData } = useCollection<MaintenanceTask>(mantenimientoQuery);
  const tasks = maintenanceData || [];

  const handleCreateLiq = () => {
    if (selectedPropIds.length === 0 || !userId || !db) return;

    let totalDeductions = 0;
    let generated = 0;

    selectedPropIds.forEach(propId => {
      const property = properties.find(p => p.id === propId);
      if (!property) return;

      const owner = people.find(p => p.id === property.owners?.[0]?.ownerId) || { id: 'dueño-ext', fullName: property.owners?.[0]?.name || 'Propietario' };

      const propInvoices = invoices.filter(i => i.propertyName === property.name && i.period === period);

      let rentIncome = 0;
      let serviceDeductions = 0;

      propInvoices.forEach(inv => {
        inv.charges.forEach(charge => {
          if (charge.type === 'Alquiler') rentIncome += charge.amount;
          if (charge.imputedTo === 'Propietario') serviceDeductions += charge.amount;
        });
      });

      const approvedRepairs = tasks.filter(t =>
        t.propertyId === propId &&
        t.chargedTo === 'Propietario' &&
        t.isApprovedByOwner === true &&
        t.status === 'Cerrado'
      );

      const maintenanceDeductions = approvedRepairs.reduce((acc, t) => acc + (t.actualCost || 0), 0);

      const adminFee = rentIncome * 0.1;
      const net = rentIncome - adminFee - serviceDeductions - maintenanceDeductions;

      const docId = Math.random().toString(36).substr(2, 9);
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', docId);

      const liqData: Liquidation = {
        id: docId,
        propertyId: propId,
        propertyName: property.name,
        ownerId: owner.id,
        ownerName: owner.fullName,
        ownerEmail: property.owners?.[0]?.email,
        period: period,
        ingresoAlquiler: rentIncome,
        adminFeeDeduction: adminFee,
        maintenanceDeductions: maintenanceDeductions,
        expenseDeductions: serviceDeductions,
        netAmount: net,
        status: 'Pendiente',
        dateCreated: new Date().toLocaleDateString('es-AR')
      };

      setDocumentNonBlocking(docRef, liqData, { merge: true });
      totalDeductions += serviceDeductions + maintenanceDeductions;
      generated += 1;
    });

    setIsNewLiqOpen(false);
    setSelectedPropIds([]);
    setPropSearch('');
    toast({
      title: generated > 1 ? `${generated} Liquidaciones Generadas` : "Liquidación Generada",
      description: `Deducciones totales aplicadas: $${totalDeductions.toLocaleString('es-AR')}.`
    });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'liquidaciones', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar liquidación..." className="pl-9 bg-white" />
        </div>
        <Dialog open={isNewLiqOpen} onOpenChange={setIsNewLiqOpen}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button className="bg-primary text-white gap-2 font-bold shadow-md">
                <Calculator className="h-4 w-4" /> Generar Periodo
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Liquidación Mensual</DialogTitle>
              <DialogDescription>El sistema aplicará deducciones bajo reglas estrictas de responsabilidad.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Propiedades / Unidades</Label>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {selectedPropIds.length} de {properties.length} seleccionadas
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={propSearch}
                    onChange={e => setPropSearch(e.target.value)}
                    placeholder="Buscar unidad..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <div className="rounded-md border border-input">
                  <label className="flex items-center gap-2 p-2.5 border-b border-input bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors">
                    <Checkbox
                      checked={allFilteredSelected ? true : (someFilteredSelected ? 'indeterminate' : false)}
                      onCheckedChange={toggleAll}
                      disabled={filteredProperties.length === 0}
                    />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      {allFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </span>
                  </label>
                  <ScrollArea className="h-36">
                    {filteredProperties.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground italic">
                        Sin coincidencias.
                      </div>
                    ) : (
                      <ul className="divide-y divide-input/50">
                        {filteredProperties.map(p => {
                          const checked = selectedPropIds.includes(p.id);
                          return (
                            <li key={p.id}>
                              <label className={cn(
                                "flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/40 transition-colors",
                                checked && "bg-primary/5"
                              )}>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleProp(p.id)}
                                />
                                <span className="text-xs font-medium truncate">{p.name}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Período de Liquidación</Label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ej: Junio 2026" />
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-[10px] space-y-1 border border-blue-100">
                  <p className="font-bold text-blue-700 flex items-center gap-1.5"><ArrowDownCircle className="h-3 w-3" /> Deducciones Fiscales/Servicios</p>
                  <p className="text-blue-600 leading-tight">Se restarán automáticamente las facturas cargadas con la marca "Imputar a Propietario".</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg text-[10px] space-y-1 border border-orange-100">
                  <p className="font-bold text-orange-700 flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Deducciones Mantenimiento</p>
                  <p className="text-orange-600 leading-tight">SOLO se restarán reparaciones cerradas, marcadas como "Cargo Propietario" y con aprobación explícita tildada.</p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4 shrink-0">
              <Button
                className="w-full h-11 font-black"
                onClick={handleCreateLiq}
                disabled={selectedPropIds.length === 0}
              >
                {selectedPropIds.length > 1
                  ? `Generar ${selectedPropIds.length} Liquidaciones`
                  : 'Cerrar y Generar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propietario / Unidad</TableHead>
              <TableHead className="text-right">Bruto (Alquiler)</TableHead>
              <TableHead className="text-right text-orange-600">Deducciones</TableHead>
              <TableHead className="text-right">Neto a Pagar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liquidations.map((l) => (
              <TableRow key={l.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{l.ownerName}</span>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{l.propertyName} • {l.period}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-xs">$ {l.ingresoAlquiler.toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-orange-600 font-medium text-xs">
                  <div className="flex flex-col items-end">
                    <span>$ {(l.maintenanceDeductions + l.expenseDeductions + l.adminFeeDeduction).toLocaleString('es-AR')}</span>
                    {l.maintenanceDeductions > 0 && <span className="text-[8px] flex items-center gap-0.5"><Wrench className="h-2 w-2" /> Reparaciones incl.</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-black text-green-700 text-base">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                <TableCell>
                   <Badge className={cn("border-none", l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                    {l.status}
                   </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Descargar Recibo"><Download className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {liquidations.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No se han generado liquidaciones en este período.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}
