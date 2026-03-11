
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  TrendingUp, 
  Calculator, 
  Download, 
  PieChart, 
  FileCheck, 
  CheckCircle2,
  Users2,
  Sparkles,
  Eye,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Plus,
  Upload,
  Loader2,
  FileUp
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
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newInvoice, setNewInvoice] = useState({
    propertyId: '',
    type: 'Luz/Gas' as ChargeType,
    amount: 0,
    period: '',
    fileName: '',
    fileUrl: ''
  });

  const solicitudesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', 'W1b1I6DKA7fEluL5gugUyKBuSvD3', 'solicitudes'));
  }, [db]);
  const { data: applicationsData } = useCollection<RentalApplication>(solicitudesQuery);
  
  const facturasQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', 'W1b1I6DKA7fEluL5gugUyKBuSvD3', 'facturas'));
  }, [db]);
  const { data: invoicesData } = useCollection<Invoice>(facturasQuery);

  const applications = applicationsData || [];
  const invoices = invoicesData || [];

  const myProperties = properties.filter(p => 
    p.owners.some(o => o.email.toLowerCase() === user?.email?.toLowerCase())
  );

  const myLiquidations = liquidations.filter(l => 
    l.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    myProperties.some(p => p.id === l.propertyId)
  );

  const myApprovedApps = applications.filter(app => 
    app.status === 'Aprobada' && 
    myProperties.some(p => p.id === app.propertyId)
  );

  const myInvoices = invoices.filter(inv => 
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
    if (!newInvoice.propertyId || !newInvoice.amount || !newInvoice.fileUrl || !db) return;
    
    const prop = properties.find(p => p.id === newInvoice.propertyId);
    const docId = Math.random().toString(36).substr(2, 9);
    const adminId = "W1b1I6DKA7fEluL5gugUyKBuSvD3";
    const docRef = doc(db, 'artifacts', APP_ID, 'users', adminId, 'facturas', docId);

    const invoiceData: Partial<Invoice> = {
      id: docId,
      contractId: 'pending',
      tenantName: 'Administrador Procesará',
      propertyName: prop?.name || 'Unidad',
      period: newInvoice.period || 'Actual',
      totalAmount: newInvoice.amount,
      currency: 'ARS',
      status: 'Pendiente',
      dueDate: new Date().toLocaleDateString('es-AR'),
      paymentReceiptUrl: newInvoice.fileUrl,
      paymentReceiptName: newInvoice.fileName,
      isFromOwner: true,
      ownerId: user?.uid,
      charges: [{
        id: 'c1',
        type: newInvoice.type,
        amount: newInvoice.amount,
        imputedTo: 'Inquilino'
      }]
    };

    setDocumentNonBlocking(docRef, invoiceData, { merge: true });
    toast({ title: "Factura Cargada", description: "El administrador la imputará al inquilino pronto." });
    setIsInvoiceDialogOpen(false);
    setNewInvoice({ propertyId: '', type: 'Luz/Gas', amount: 0, period: '', fileName: '', fileUrl: '' });
  };

  const viewDocument = (doc: DocumentInfo) => {
    if (doc.url) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<html><body style="margin:0; background: #333; display: flex; align-items: center; justify-content: center;"><img src="${doc.url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" /></body></html>`);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-600">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Total Cobrado (Neto)</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ {totalNetRecieved.toLocaleString('es-AR')}</h3>
              <div className="p-2 bg-green-50 rounded-full"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Morosidad Actual</p>
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
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Unidades Ocupadas</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">
                {myProperties.filter(p => p.status === 'Alquilada').length} / {myProperties.length}
              </h3>
              <div className="p-2 bg-blue-50 rounded-full"><Building className="h-4 w-4 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary/5 border-primary/20 border">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-black text-primary mb-1">Cargas Rápidas</p>
            <Button size="sm" className="w-full gap-2 font-bold h-9 bg-primary text-white" onClick={() => setIsInvoiceDialogOpen(true)}>
              <FileUp className="h-4 w-4" /> Cargar Factura de Servicio
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Historial de Liquidaciones</CardTitle>
              <CardDescription>Detalle de transferencias recibidas de la administración.</CardDescription>
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
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{l.period}</span>
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
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="bg-blue-50/50">
              <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5 text-blue-600" /> Mis Unidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {myProperties.map((p) => (
                <div key={p.id} className="p-4 bg-white rounded-xl border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-black truncate max-w-[150px]">{p.name}</p>
                    <Badge className={cn("text-[9px] font-black uppercase px-2 py-0 h-4", p.status === 'Alquilada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mb-4">{p.address}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogo: Cargar Factura Propietario */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargar Factura de Servicio</DialogTitle>
            <DialogDescription>Sube una factura recibida para que la administración la traslade al inquilino.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Propiedad</Label>
              <Select value={newInvoice.propertyId} onValueChange={(v) => setNewInvoice({ ...newInvoice, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>{myProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Servicio</Label>
                <Select value={newInvoice.type} onValueChange={(v: any) => setNewInvoice({ ...newInvoice, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Luz/Gas">Luz/Gas</SelectItem>
                    <SelectItem value="Aguas">Aguas</SelectItem>
                    <SelectItem value="TGI/ABL">TGI/ABL</SelectItem>
                    <SelectItem value="Otros">Otros (Reparaciones, etc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto Total</Label>
                <Input type="number" placeholder="ARS" onChange={e => setNewInvoice({ ...newInvoice, amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mes / Período</Label>
              <Input placeholder="Ej: Mayo 2024" value={newInvoice.period} onChange={e => setNewInvoice({ ...newInvoice, period: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Archivo de la Factura</Label>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 border-primary/20">
                {isUploading ? <Loader2 className="animate-spin mx-auto text-primary" /> : newInvoice.fileName ? <p className="text-xs font-bold text-primary">{newInvoice.fileName}</p> : <><Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" /><p className="text-[10px]">Click para subir PDF/JPG</p></>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInvoiceDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white font-black" disabled={!newInvoice.fileUrl || isUploading} onClick={handleSubmitInvoice}>Informar a Administración</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Expediente de {selectedApp.applicantName}</DialogTitle>
                <DialogDescription>Resumen de evaluación para su aprobación final.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                <div className="space-y-6">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <h4 className="text-xs font-black uppercase text-primary mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Informe del Analista IA</h4>
                    <p className="text-sm font-bold text-green-700 mb-2">{selectedApp.aiAnalysis?.recommendation}</p>
                    <p className="text-xs leading-relaxed text-foreground/80 italic">"{selectedApp.aiAnalysis?.reasoning}"</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
