"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  TrendingUp, 
  CheckCircle2,
  Sparkles,
  Eye,
  AlertTriangle,
  Plus,
  Upload,
  Loader2,
  FileUp,
  ReceiptText
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, Liquidation, RentalApplication, DocumentInfo, Invoice, ChargeType } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { query, collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface OwnerPortalViewProps {
  properties: Property[];
  liquidations: Liquidation[];
}

const APP_ID = "alquilagestion-pro";

export function OwnerPortalView({ properties, liquidations }: OwnerPortalViewProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newInvoice, setNewInvoice] = useState({
    propertyId: '',
    type: 'Alquiler' as ChargeType,
    amount: 0,
    period: new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    fileName: '',
    fileUrl: ''
  });

  // El administrador de referencia para este prototipo
  const ADMIN_ID = "W1b1I6DKA7fEluL5gugUyKBuSvD3";

  const myProperties = properties.filter(p => 
    p.owners.some(o => o.email.toLowerCase() === user?.email?.toLowerCase())
  );

  const myLiquidations = liquidations.filter(l => 
    l.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    myProperties.some(p => p.id === l.propertyId)
  );

  // Consultar facturas para ver morosidad
  const facturasQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', ADMIN_ID, 'facturas'));
  }, [db]);
  const { data: allInvoices } = useCollection<Invoice>(facturasQuery);

  const myInvoices = (allInvoices || []).filter(inv => 
    myProperties.some(p => p.name === inv.propertyName)
  );

  const overdueAmount = myInvoices
    .filter(inv => inv.status === 'Vencido')
    .reduce((acc, inv) => acc + inv.totalAmount, 0);

  const totalNetRecieved = myLiquidations
    .filter(l => l.status === 'Pagada')
    .reduce((acc, l) => acc + l.netAmount, 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewInvoice({ ...newInvoice, fileName: file.name, fileUrl: event.target?.result as string });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitInvoice = () => {
    if (!newInvoice.propertyId || !newInvoice.amount || !newInvoice.fileUrl || !db) {
      toast({ title: "Datos incompletos", description: "Por favor complete el monto y suba el archivo.", variant: "destructive" });
      return;
    }
    
    const prop = properties.find(p => p.id === newInvoice.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', ADMIN_ID, 'facturas', docId);

    const invoiceData: Partial<Invoice> = {
      id: docId,
      contractId: 'pending_admin',
      tenantName: 'Pendiente Vincular',
      propertyName: prop?.name || 'Unidad',
      period: newInvoice.period || 'Actual',
      totalAmount: newInvoice.amount,
      currency: 'ARS',
      status: 'Esperando Factura ARCA', // Lo ponemos en este estado para que el admin lo vea
      dueDate: new Date().toLocaleDateString('es-AR'),
      arcaInvoiceUrl: newInvoice.fileUrl, // La guardamos como factura formal directamente
      arcaInvoiceName: newInvoice.fileName,
      isFromOwner: true,
      ownerId: user?.uid,
      charges: [{
        id: 'c1',
        type: newInvoice.type,
        description: `${newInvoice.type} enviado por el dueño`,
        amount: newInvoice.amount,
        imputedTo: 'Inquilino'
      }]
    };

    setDocumentNonBlocking(docRef, invoiceData, { merge: true });
    toast({ title: "Factura Enviada", description: "El administrador ha sido notificado y la enviará al inquilino." });
    setIsInvoiceDialogOpen(false);
    setNewInvoice({ propertyId: '', type: 'Alquiler', amount: 0, period: '', fileName: '', fileUrl: '' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-600">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Total Cobrado (Neto)</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ {totalNetRecieved.toLocaleString('es-AR')}</h3>
              <div className="p-2 bg-green-50 rounded-full"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Morosidad en Unidades</p>
            <div className="flex items-center justify-between">
              <h3 className={cn("text-2xl font-black", overdueAmount > 0 ? "text-red-600" : "text-green-600")}>
                $ {overdueAmount.toLocaleString('es-AR')}
              </h3>
              <div className={cn("p-2 rounded-full", overdueAmount > 0 ? "bg-red-50" : "bg-green-50")}>
                {overdueAmount > 0 ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Estado Ocupación</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">
                {myProperties.filter(p => p.status === 'Alquilada').length} / {myProperties.length}
              </h3>
              <div className="p-2 bg-blue-50 rounded-full"><Building className="h-4 w-4 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5 border-primary/20 border">
          <CardContent className="p-6 flex flex-col justify-center">
            <Button size="sm" className="w-full gap-2 font-black h-11 bg-primary text-white shadow-md hover:bg-primary/90" onClick={() => setIsInvoiceDialogOpen(true)}>
              <FileUp className="h-4 w-4" /> Cargar Mi Factura
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Cobros</CardTitle>
                <CardDescription>Liquidaciones netas recibidas por sus propiedades.</CardDescription>
              </div>
              <ReceiptText className="h-5 w-5 text-muted-foreground opacity-50" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Unidad / Periodo</TableHead>
                    <TableHead className="text-right">Neto Liquidado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLiquidations.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{l.propertyName}</span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase">{l.period}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-green-700">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge className={cn("border-none font-bold", l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myLiquidations.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic text-xs">No hay liquidaciones registradas.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-primary" /> Mis Unidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {myProperties.map((p) => (
                <div key={p.id} className="p-4 bg-white rounded-xl border hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-black truncate max-w-[150px] group-hover:text-primary transition-colors">{p.name}</p>
                    <Badge className={cn("text-[9px] font-black uppercase px-2 py-0 h-4 border-none", p.status === 'Alquilada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mb-2">{p.address}</p>
                  <Separator className="my-2 opacity-50" />
                  <div className="flex justify-between text-[9px] font-bold uppercase text-muted-foreground">
                    <span>Participación:</span>
                    <span className="text-foreground">{p.owners.find(o => o.email.toLowerCase() === user?.email?.toLowerCase())?.percentage}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogo: Cargar Factura Propietario */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> Cargar Mi Factura</DialogTitle>
            <DialogDescription>Suba su factura de alquiler (ARCA) o facturas de servicios para que el administrador las procese y envíe al inquilino.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Unidad Asociada</Label>
              <Select value={newInvoice.propertyId} onValueChange={(v) => setNewInvoice({ ...newInvoice, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger>
                <SelectContent>{myProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={newInvoice.type} onValueChange={(v: any) => setNewInvoice({ ...newInvoice, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alquiler">Factura Alquiler (ARCA)</SelectItem>
                    <SelectItem value="Luz/Gas">Factura de Luz / Gas</SelectItem>
                    <SelectItem value="Aguas">Factura de Aguas</SelectItem>
                    <SelectItem value="TGI/ABL">Factura de ABL / TGI</SelectItem>
                    <SelectItem value="Expensa Ordinaria">Factura Expensas</SelectItem>
                    <SelectItem value="Otros">Otros (Reparaciones/IVA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto Total</Label>
                <CurrencyInput value={newInvoice.amount || 0} onChange={v => setNewInvoice({ ...newInvoice, amount: v })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Período (Mes/Año)</Label>
              <Input placeholder="Ej: Junio 2024" value={newInvoice.period} onChange={e => setNewInvoice({ ...newInvoice, period: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Archivo Digital (PDF o Foto)</Label>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 border-primary/20 transition-all"
              >
                {isUploading ? (
                  <Loader2 className="animate-spin mx-auto text-primary" />
                ) : newInvoice.fileName ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
                    <p className="text-xs font-bold text-primary truncate max-w-[200px]">{newInvoice.fileName}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs font-bold">Pulse para subir factura</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Formatos: PDF, JPG, PNG</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setIsInvoiceDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-primary text-white font-black px-8" 
              disabled={!newInvoice.fileUrl || isUploading} 
              onClick={handleSubmitInvoice}
            >
              Enviar a Administración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
