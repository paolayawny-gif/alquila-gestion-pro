
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard, FileText, Wrench, Download, AlertCircle, Clock,
  CheckCircle2, MessageSquare, Bell, FileCheck, Plus, Upload,
  Loader2, Image as ImageIcon,
  // Onboarding icons
  KeyRound, Play, RotateCw, PenLine, ChevronDown, ChevronUp,
  BookOpen, Home, ListChecks
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Contract, Property, Invoice, MaintenanceTask } from '@/lib/types';
import { cn } from '@/lib/utils';
import { doc, collection, query } from 'firebase/firestore';
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

// ─────────────────────────────────────────────
//  Sección de Onboarding (componente interno)
// ─────────────────────────────────────────────
interface OnboardingProps {
  contract: Contract;
  property?: Property;
  db: ReturnType<typeof useFirestore>;
  toast: ReturnType<typeof useToast>['toast'];
}

function OnboardingSection({ contract, property, db, toast }: OnboardingProps) {
  const [collapsed, setCollapsed]             = useState(false);
  const [showInventory, setShowInventory]     = useState(false);
  const [inventoryNotes, setInventoryNotes]   = useState('');

  // Leer estado del onboarding desde Firestore (colección bajo el admin)
  const onboardingQ = useMemoFirebase(() => {
    if (!db || !contract.ownerId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', contract.ownerId, 'onboarding'));
  }, [db, contract.ownerId]);
  const { data: onboardingRaw } = useCollection(onboardingQ);
  const ob = (onboardingRaw?.find((o: any) => o.id === contract.id) as any) ?? {};

  const steps = {
    servicios:  !!ob.servicios,
    llaves:     !!ob.llaves,
    inventario: !!ob.inventario,
  };
  const completedCount = Object.values(steps).filter(Boolean).length;

  const updateStep = (step: string, value: boolean) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', contract.ownerId, 'onboarding', contract.id);
    setDocumentNonBlocking(ref, { contractId: contract.id, [step]: value }, { merge: true });
  };

  const handleSignInventory = () => {
    updateStep('inventario', true);
    setDocumentNonBlocking(
      doc(db!, 'artifacts', APP_ID, 'users', contract.ownerId, 'onboarding', contract.id),
      { inventarioNotes: inventoryNotes, inventarioDate: new Date().toLocaleDateString('es-AR') },
      { merge: true }
    );
    toast({ title: '✅ Inventario firmado', description: 'El estado de la propiedad fue registrado correctamente.' });
    setShowInventory(false);
  };

  const manuals = property?.manuals || [];

  // ── Collapsed pill ──
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/5 border border-primary/10 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
      >
        <ChevronDown className="h-4 w-4" />
        Ver bienvenida y onboarding
        {completedCount < 3 && (
          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-bold ml-1">
            {3 - completedCount} pendiente{3 - completedCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <>
      <div className="space-y-5">

        {/* ─── Banner de bienvenida ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-[#16a34a] px-7 py-8 text-white">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black leading-tight">
              ¡Bienvenido a tu nuevo hogar!
            </h2>
            <p className="text-white/80 mt-2 text-sm leading-relaxed">
              Completá tu onboarding digital para activar todos los servicios
              y acceder a las llaves de la propiedad.
            </p>
          </div>
          {/* Decorativo */}
          <div className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none select-none">
            <KeyRound className="h-36 w-36" />
          </div>
          {/* Progreso en badge */}
          {completedCount === 3 && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 font-bold text-xs gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Onboarding completado
              </Badge>
            </div>
          )}
        </div>

        {/* ─── Grid: Tour + Checklist ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Tour Virtual 360° */}
          <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black">Tour Virtual 360°</CardTitle>
                <Badge className="bg-primary/10 text-primary border-none gap-1 text-[10px] font-bold">
                  <RotateCw className="h-3 w-3" /> Interactivo
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Explorá cada rincón de tu departamento antes de mudarte.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
                {property?.virtualTourUrl ? (
                  /* URL de tour configurada — embed iframe */
                  <iframe
                    src={property.virtualTourUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    title="Tour Virtual 360°"
                  />
                ) : (property?.photos || []).length > 0 ? (
                  /* Primera foto de la propiedad */
                  <>
                    <img
                      src={property!.photos[0]}
                      alt={property!.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <button className="h-16 w-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
                        <Play className="h-6 w-6 text-primary ml-1" />
                      </button>
                    </div>
                  </>
                ) : (
                  /* Sin foto */
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                    <Home className="h-14 w-14" />
                    <p className="text-sm font-semibold">Sin foto disponible</p>
                    <p className="text-xs text-center max-w-[200px]">
                      El administrador puede agregar fotos o una URL de tour en la configuración de la propiedad.
                    </p>
                  </div>
                )}
              </div>
              {/* Datos de la propiedad */}
              <div className="flex items-center justify-between mt-3 px-1">
                <div>
                  <p className="text-sm font-black">{property?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{property?.address}</p>
                </div>
                {property?.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Ver en Google Maps →
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checklist Mudanza Exitosa */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black">Mudanza Exitosa</CardTitle>
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              <CardDescription className="text-xs">
                Progreso:{' '}
                <strong className="text-foreground font-black">{completedCount} de 3</strong> completados.
              </CardDescription>
              {/* Barra de progreso */}
              <Progress value={(completedCount / 3) * 100} className="h-1.5 mt-1" />
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">

              {/* Paso 1: Servicios */}
              <OnboardingStep
                done={steps.servicios}
                title="Servicios Contratados"
                description="Luz, agua e internet configurados a tu nombre."
              />

              {/* Paso 2: Llaves */}
              <OnboardingStep
                done={steps.llaves}
                title="Llaves Digitales Activas"
                description="Acceso autorizado en la app de la comunidad."
              />

              {/* Paso 3: Firma de inventario */}
              <OnboardingStep
                done={steps.inventario}
                title="Firma de Inventario"
                description="Revisá el estado de la propiedad y firmá digitalmente."
                actionLabel="INICIAR"
                onAction={() => setShowInventory(true)}
              />
            </CardContent>
          </Card>
        </div>

        {/* ─── Manuales ─── */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Manuales
              </CardTitle>
              {manuals.length > 3 && (
                <button className="text-xs font-bold text-primary hover:underline">
                  Ver todos ({manuals.length})
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {manuals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {manuals.slice(0, 4).map((m, i) => (
                  <button
                    key={i}
                    onClick={() => m.url ? window.open(m.url, '_blank') : toast({ title: 'Sin archivo', description: 'Este manual no tiene archivo adjunto aún.' })}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group text-left border border-transparent hover:border-border"
                  >
                    <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.sizeLabel}</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                No hay manuales cargados para esta propiedad.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Botón ocultar */}
        <div className="flex justify-center">
          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Ocultar sección de bienvenida
          </button>
        </div>
      </div>

      {/* ─── Dialog: Firma de Inventario ─── */}
      <Dialog open={showInventory} onOpenChange={setShowInventory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-primary" /> Firma de Inventario
            </DialogTitle>
            <DialogDescription>
              Revisá el estado de <strong>{property?.name}</strong> y confirmá tu conformidad al momento de la entrega de llaves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase font-black text-muted-foreground">Propiedad</p>
              <p className="font-black text-base">{property?.name}</p>
              <p className="text-xs text-muted-foreground">{property?.address}</p>
              <p className="text-[10px] text-muted-foreground">
                Contrato: <span className="font-bold text-foreground">{contract.startDate} → {contract.endDate}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                placeholder="Indicá si notás algún daño preexistente, faltante o condición especial a registrar..."
                className="min-h-[100px]"
                value={inventoryNotes}
                onChange={e => setInventoryNotes(e.target.value)}
              />
            </div>
            <div className="bg-primary/5 rounded-xl p-3 text-[11px] text-muted-foreground leading-relaxed">
              Al confirmar, registrás digitalmente que revisaste el estado de la propiedad y lo encontraste conforme al momento de la entrega de llaves. Fecha: <strong className="text-foreground">{new Date().toLocaleDateString('es-AR')}</strong>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInventory(false)}>Cancelar</Button>
            <Button className="bg-primary font-bold gap-2 px-8" onClick={handleSignInventory}>
              <PenLine className="h-4 w-4" /> Firmar y Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Sub-componente: paso del checklist
function OnboardingStep({
  done, title, description, actionLabel, onAction,
}: {
  done: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border transition-all',
      done ? 'bg-primary/5 border-primary/15' : 'bg-white border-muted-foreground/10'
    )}>
      {/* Círculo indicador */}
      <div className={cn(
        'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
        done ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'
      )}>
        {done && <CheckCircle2 className="h-3.5 w-3.5" />}
      </div>
      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold leading-tight', done ? 'text-foreground' : 'text-muted-foreground')}>
          {title}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      {/* Botón acción */}
      {!done && actionLabel && onAction && (
        <Button
          size="sm"
          className="text-[10px] font-black bg-primary h-7 px-2.5 shrink-0"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
//  Portal del Inquilino (componente principal)
// ─────────────────────────────────────────────
export function TenantPortalView({ contracts, properties, invoices, tasks }: TenantPortalViewProps) {
  const { user }  = useUser();
  const db        = useFirestore();
  const { toast } = useToast();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isClaimDialogOpen,   setIsClaimDialogOpen]   = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice,     setSelectedInvoice]     = useState<Invoice | null>(null);
  const [newClaim,             setNewClaim]            = useState({ concept: '', description: '' });
  const [isUploading,          setIsUploading]         = useState(false);
  const [receiptFile,          setReceiptFile]         = useState<{name: string; url: string} | null>(null);

  const myContract = contracts.find(c =>
    c.tenantEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    c.tenantName?.toLowerCase().includes(user?.email?.split('@')[0].toLowerCase() || '---')
  );
  const myProperty    = properties.find(p => p.id === myContract?.propertyId);
  const myInvoices    = invoices.filter(i => i.contractId === myContract?.id && !i.isFromOwner);
  const myTasks       = tasks.filter(t => t.propertyId === myProperty?.id);
  const pendingInvoices = myInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
  const totalDue        = pendingInvoices.reduce((acc, i) => acc + i.totalAmount, 0);

  const handleCreateClaim = () => {
    if (!myProperty || !db || !user || !newClaim.concept) return;
    const claimId = Math.random().toString(36).substr(2, 9);
    const adminId = myContract?.ownerId || 'W1b1I6DKA7fEluL5gugUyKBuSvD3';
    const docRef  = doc(db, 'artifacts', APP_ID, 'users', adminId, 'mantenimiento', claimId);
    const task: MaintenanceTask = {
      id: claimId,
      propertyId:   myProperty.id,
      propertyName: myProperty.name,
      concept:      newClaim.concept,
      description:  newClaim.description,
      priority:     'Media',
      status:       'Pendiente',
      createdAt:    new Date().toLocaleDateString('es-AR'),
      updatedAt:    new Date().toLocaleDateString('es-AR'),
      estimatedCost: 0,
      actualCost:    0,
    };
    setDocumentNonBlocking(docRef, task, { merge: true });
    setIsClaimDialogOpen(false);
    setNewClaim({ concept: '', description: '' });
    toast({ title: 'Reclamo Enviado', description: 'La administración ha sido notificada.' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptFile({ name: file.name, url: event.target?.result as string });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleInformPayment = () => {
    if (!selectedInvoice || !receiptFile || !db) return;
    const adminId = myContract?.ownerId || 'W1b1I6DKA7fEluL5gugUyKBuSvD3';
    const docRef  = doc(db, 'artifacts', APP_ID, 'users', adminId, 'facturas', selectedInvoice.id);
    setDocumentNonBlocking(docRef, {
      status:             'Pago Informado',
      paymentReceiptUrl:  receiptFile.url,
      paymentReceiptName: receiptFile.name,
      paymentDate:        new Date().toLocaleDateString('es-AR'),
    }, { merge: true });
    toast({ title: 'Pago Informado', description: 'El administrador verificará tu comprobante pronto.' });
    setIsPaymentDialogOpen(false);
    setReceiptFile(null);
    setSelectedInvoice(null);
  };

  const downloadFile = (file: { name?: string; url?: string }) => {
    if (!file.url || file.url === '#') {
      toast({ title: 'No disponible', description: 'El archivo no está cargado en el servidor.' });
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

      {/* ── Alerta saldo pendiente ── */}
      {totalDue > 0 && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-full animate-pulse shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">Saldo Pendiente de Pago</p>
              <p className="text-xs text-primary/80">
                Tenés {pendingInvoices.length} factura(s) por un total de $ {totalDue.toLocaleString('es-AR')}.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-primary text-white hover:bg-primary/90 whitespace-nowrap font-bold"
            onClick={() => { setSelectedInvoice(pendingInvoices[0]); setIsPaymentDialogOpen(true); }}
          >
            Informar Pago Ahora
          </Button>
        </div>
      )}

      {/* ── Sin contrato ── */}
      {!myContract && (
        <Card className="bg-muted/30 border-dashed border-2 flex flex-col items-center justify-center p-12 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="max-w-md">
            <h3 className="text-lg font-bold">Sin contrato vinculado</h3>
            <p className="text-sm text-muted-foreground">
              No encontramos un contrato activo vinculado a {user?.email}.
            </p>
          </div>
        </Card>
      )}

      {/* ── Con contrato ── */}
      {myContract && (
        <>
          {/* ══ ONBOARDING ══ */}
          <OnboardingSection
            contract={myContract}
            property={myProperty}
            db={db}
            toast={toast}
          />

          <Separator />

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Estado de Cuenta</CardDescription>
                <CardTitle className={cn('text-3xl font-black', totalDue > 0 ? 'text-red-600' : 'text-green-600')}>
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
                  {pendingInvoices.length === 0 && (
                    <p className="text-green-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Sin deudas pendientes
                    </p>
                  )}
                </div>
                <Button
                  disabled={pendingInvoices.length === 0}
                  className="w-full bg-primary/10 text-primary hover:bg-primary/20 gap-2 border-none font-bold"
                  onClick={() => { setSelectedInvoice(pendingInvoices[0]); setIsPaymentDialogOpen(true); }}
                >
                  <CreditCard className="h-4 w-4" /> Informar Pago
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">
                  Próximo Ajuste ({myContract.adjustmentMechanism})
                </CardDescription>
                <CardTitle className="text-3xl font-black">2026-09-15</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground font-medium uppercase">
                      Ciclo: {myContract.adjustmentFrequencyMonths} meses
                    </span>
                    <span className="font-black text-primary">60% transcurrido</span>
                  </div>
                  <Progress value={60} className="h-2 bg-muted" />
                  <p className="text-[10px] text-muted-foreground italic mt-2">
                    Alquiler actual: {myContract.currency} {myContract.currentRentAmount.toLocaleString('es-AR')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] uppercase font-black text-muted-foreground">Servicio Técnico</CardDescription>
                <CardTitle className="text-3xl font-black">
                  {myTasks.filter(t => t.status !== 'Cerrado').length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  {myTasks.length > 0 ? 'Reclamos en seguimiento' : 'Sin incidencias reportadas'}
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4 gap-2 border-primary text-primary font-bold"
                  onClick={() => setIsClaimDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Nuevo Reclamo
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Historial de pagos + Contrato ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Historial de Pagos y Facturas</CardTitle>
                  <CardDescription>Consultá tus cuotas de alquiler, expensas y servicios.</CardDescription>
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
                      {myInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{inv.period}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {inv.charges.map((c, idx) => (
                                  <Badge key={idx} variant="outline" className="text-[8px] py-0 px-1 border-primary/20">
                                    {c.type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-black text-primary">
                            $ {inv.totalAmount.toLocaleString('es-AR')}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              'border-none font-bold',
                              inv.status === 'Pagado'          ? 'bg-green-100 text-green-700'  :
                              inv.status === 'Pago Informado'  ? 'bg-blue-100 text-blue-700'    :
                              inv.status === 'Vencido'         ? 'bg-red-100 text-red-700'      :
                                                                 'bg-orange-100 text-orange-700'
                            )}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {inv.paymentReceiptUrl && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"
                                  onClick={() => downloadFile({ name: inv.paymentReceiptName, url: inv.paymentReceiptUrl })}>
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"
                                onClick={() => downloadFile({ name: `Recibo_${inv.period}.pdf`, url: '#' })}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {myInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                            Sin facturas registradas aún.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 pb-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Mi Contrato
                  </CardTitle>
                  <CardDescription>Unidad: {myProperty?.name || 'Cargando...'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="p-4 bg-muted/20 rounded-lg flex flex-col gap-3">
                    <div className="flex justify-between text-xs border-b border-dashed pb-2">
                      <span className="text-muted-foreground">Dirección:</span>
                      <span className="font-bold text-right">{myProperty?.address}</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-dashed pb-2">
                      <span className="text-muted-foreground">Vencimiento:</span>
                      <span className="font-bold">{myContract.endDate}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Documentos Digitales</p>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-10 border-primary/20 group hover:border-primary"
                      onClick={() => downloadFile({ name: 'Contrato.pdf', url: myContract.documents.mainContractUrl })}
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Contrato Locación
                      </span>
                      <Download className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ── Dialog: Informar Pago ── */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Informar Pago
            </DialogTitle>
            <DialogDescription>
              Subí una foto o PDF de tu transferencia para que la administración valide el pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Período</p>
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
                    <p className="text-[10px] text-muted-foreground">Click para cambiar</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Subir comprobante</p>
                    <p className="text-[10px] text-muted-foreground">JPG, PNG, PDF</p>
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

      {/* ── Dialog: Nuevo Reclamo ── */}
      <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar Incidencia / Reclamo</DialogTitle>
            <DialogDescription>Describí el problema para que mantenimiento tome acción.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input
                placeholder="Ej: Filtración en baño"
                value={newClaim.concept}
                onChange={e => setNewClaim({ ...newClaim, concept: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Indicá detalles relevantes..."
                className="min-h-[100px]"
                value={newClaim.description}
                onChange={e => setNewClaim({ ...newClaim, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsClaimDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-primary text-white font-bold"
              onClick={handleCreateClaim}
              disabled={!newClaim.concept}
            >
              Enviar Reclamo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
