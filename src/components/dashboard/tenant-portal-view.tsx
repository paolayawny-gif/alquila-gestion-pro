
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  FileText, 
  Wrench, 
  Download, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  MessageSquare,
  Bell,
  Eye,
  FileCheck,
  Plus,
  Upload,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore } from '@/firebase';
import { Contract, Property, Invoice, MaintenanceTask, DocumentInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface TenantPortalViewProps {
  contracts: Contract[];
  properties: Property[];
  invoices: Invoice[];
  tasks: MaintenanceTask[];
}

const APP_ID = "alquilagestion-pro";

export function TenantPortalView({ contracts, properties, invoices, tasks }: TenantPortalViewProps) {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newClaim, setNewClaim] = useState({ concept: '', description: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<{name: string, url: string} | null>(null);

  const myContract = contracts.find(c => 
    c.tenantEmail?.toLowerCase() === user?.email?.toLowerCase() || 
    c.tenantName?.toLowerCase().includes(user?.email?.split('@')[0].toLowerCase() || '---')
  );
  
  const myProperty = properties.find(p => p.id === myContract?.propertyId);
  const myInvoices = invoices.filter(i => i.contractId === myContract?.id && !i.isFromOwner);
  const myTasks = tasks.filter(t => t.propertyId === myProperty?.id);

  const pendingInvoices = myInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
  const totalDue = pendingInvoices.reduce((acc, i) => acc + i.totalAmount, 0);

  const handleCreateClaim = () => {
    if (!myProperty || !db || !user || !newClaim.concept) return;
    const claimId = Math.random().toString(36).substr(2, 9);
    const adminId = myContract?.ownerId || "W1b1I6DKA7fEluL5gugUyKBuSvD3"; 
    const docRef = doc(db, 'artifacts', APP_ID, 'users', adminId, 'mantenimiento', claimId);
    const task: MaintenanceTask = {
      id: claimId,
      propertyId: myProperty.id,
      propertyName: myProperty.name,
      concept: newClaim.concept,
      description: newClaim.description,
      priority: 'Media',
      status: 'Pendiente',
      createdAt: new Date().toLocaleDateString('es-AR'),
      updatedAt: new Date().toLocaleDateString('es-AR'),
    };
    setDocumentNonBlocking(docRef, task, { merge: true });
    setIsClaimDialogOpen(false);
    setNewClaim({ concept: '', description: '' });
    toast({ title: "Reclamo Enviado", description: "La administración ha sido notificada." });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptFile({
        name: file.name,
        url: event.target?.result as string
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleInformPayment = () => {
    if (!selectedInvoice || !receiptFile || !db) return;
    const adminId = myContract?.ownerId || "W1b1I6DKA7fEluL5gugUyKBuSvD3";
    const docRef = doc(db, 'artifacts', APP_ID, 'users', adminId, 'facturas', selectedInvoice.id);
    
    setDocumentNonBlocking(docRef, {
      status: 'Pago Informado',
      paymentReceiptUrl: receiptFile.url,
      paymentReceiptName: receiptFile.name,
      paymentDate: new Date().toLocaleDateString('es-AR')
    }, { merge: true });

    toast({ title: "Pago Informado", description: "El administrador verificará tu comprobante pronto." });
    setIsPaymentDialogOpen(false);
    setReceiptFile(null);
    setSelectedInvoice(null);
  };

  const downloadFile = (file: { name?: string, url?: string }) => {
    if (!file.url || file.url === '#') {
      toast({ title: "No disponible", description: "El archivo no está cargado en el servidor." });
      return;
    }
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name || 'documento.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {totalDue > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-full animate-pulse flex-shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-primary">Saldo Pendiente de Pago</p>
              <p className="text-xs text-primary/80">
                Tienes {pendingInvoices.length} factura(s) por un total de $ {totalDue.toLocaleString('es-AR')}.
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            className="bg-primary text-white hover:bg-primary/90 whitespace-nowrap font-bold"
            onClick={() => {
              setSelectedInvoice(pendingInvoices[0]);
              setIsPaymentDialogOpen(true);
            }}
          >
            Informar Pago Ahora
          </Button>
        </div>
      )}

      {!myContract && (
        <Card className="bg-muted/30 border-dashed border-2 flex flex-col items-center justify-center p-12 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="max-w-md">
            <h3 className="text-lg font-bold">Sin contrato vinculado</h3>
            <p className="text-sm text-muted-foreground">
              No hemos encontrado un contrato activo vinculado a {user?.email}.
            </p>
          </div>
        </Card>
      )}

      {myContract && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Estado de Cuenta</CardDescription>
                <CardTitle className={cn("text-3xl font-black", totalDue > 0 ? "text-red-600" : "text-green-600")}>
                  $ {totalDue.toLocaleString('es-AR')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-[10px] text-muted-foreground space-y-1">
                  {pendingInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between border-b border-dashed pb-1">
                      <span>{inv.period}</span>
                      <span className="font-bold">$ {inv.totalAmount.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                  {pendingInvoices.length === 0 && <p className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> No tienes deudas pendientes</p>}
                </div>
                <Button 
                  disabled={pendingInvoices.length === 0}
                  className="w-full bg-primary/10 text-primary hover:bg-primary/20 gap-2 border-none font-bold"
                  onClick={() => {
                    setSelectedInvoice(pendingInvoices[0]);
                    setIsPaymentDialogOpen(true);
                  }}
                >
                  <CreditCard className="h-4 w-4" /> Informar Pago
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Próximo Ajuste ({myContract.adjustmentMechanism})</CardDescription>
                <CardTitle className="text-3xl font-black">2026-09-15</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground font-medium uppercase">Ciclo: {myContract.adjustmentFrequencyMonths} meses</span>
                    <span className="font-black text-primary">60% transcurrido</span>
                  </div>
                  <Progress value={60} className="h-2 bg-muted" />
                  <p className="text-[10px] text-muted-foreground italic mt-2">Su alquiler actual es de {myContract.currency} {myContract.currentRentAmount.toLocaleString('es-AR')}.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Servicio Técnico</CardDescription>
                <CardTitle className="text-3xl font-black">{myTasks.filter(t => t.status !== 'Cerrado').length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> {myTasks.length > 0 ? "Tienes reclamos en seguimiento" : "Sin incidencias reportadas"}
                </p>
                <Button variant="outline" className="w-full mt-4 gap-2 border-primary text-primary font-bold" onClick={() => setIsClaimDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Nuevo Reclamo
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Historial de Pagos y Facturas</CardTitle>
                  <CardDescription>Consulta tus cuotas de alquiler, expensas y servicios.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Periodo / Concepto</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{inv.period}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {inv.charges.map((c, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[8px] py-0 px-1 border-primary/20">{c.type}</Badge>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-black text-primary">$ {inv.totalAmount.toLocaleString('es-AR')}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "border-none font-bold",
                              inv.status === 'Pagado' ? "bg-green-100 text-green-700" : 
                              inv.status === 'Pago Informado' ? "bg-blue-100 text-blue-700" :
                              inv.status === 'Vencido' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                            )}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {inv.paymentReceiptUrl && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" title="Ver Comprobante Enviado" onClick={() => downloadFile({name: inv.paymentReceiptName, url: inv.paymentReceiptUrl})}>
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => downloadFile({ name: `Recibo_${inv.period}.pdf`, url: '#' })}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 pb-6">
                  <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Mi Contrato</CardTitle>
                  <CardDescription>Unidad: {myProperty?.name || 'Cargando...'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-3">
                    <div className="flex justify-between text-xs border-b border-dashed pb-2"><span className="text-muted-foreground">Dirección:</span><span className="font-bold text-right">{myProperty?.address}</span></div>
                    <div className="flex justify-between text-xs border-b border-dashed pb-2"><span className="text-muted-foreground">Vencimiento:</span><span className="font-bold">{myContract.endDate}</span></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Documentos Digitales</p>
                    <Button variant="outline" className="w-full justify-between h-10 border-primary/20 group hover:border-primary" onClick={() => downloadFile({ name: 'Contrato.pdf', url: myContract.documents.mainContractUrl })}>
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Contrato Locación</span>
                      <Download className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Dialogo: Informar Pago */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Informar Pago</DialogTitle>
            <DialogDescription>Sube una foto o PDF de tu transferencia para que la administración valide el pago.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Período Seleccionado</p>
              <p className="font-bold">{selectedInvoice?.period}</p>
              <p className="text-2xl font-black text-primary">$ {selectedInvoice?.totalAmount.toLocaleString('es-AR')}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Comprobante de Pago (PDF o Imagen)</Label>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-all border-primary/20"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : receiptFile ? (
                  <div className="text-center">
                    <FileCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-green-700">{receiptFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">Click para cambiar archivo</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Subir comprobante</p>
                    <p className="text-[10px] text-muted-foreground">Formatos aceptados: JPG, PNG, PDF</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-primary text-white font-black px-8" 
              disabled={!receiptFile || isUploading}
              onClick={handleInformPayment}
            >
              Enviar a Administración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo: Nuevo Reclamo */}
      <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar Incidencia / Reclamo</DialogTitle>
            <DialogDescription>Describe el problema para mantenimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input placeholder="Ej: Filtración en baño" value={newClaim.concept} onChange={e => setNewClaim({...newClaim, concept: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea placeholder="Indica detalles relevantes..." className="min-h-[100px]" value={newClaim.description} onChange={e => setNewClaim({...newClaim, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsClaimDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white font-bold" onClick={handleCreateClaim} disabled={!newClaim.concept}>Enviar Reclamo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
