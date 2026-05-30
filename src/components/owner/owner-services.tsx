import { APP_ID } from '@/lib/constants';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, query, where,
} from 'firebase/firestore';
import {
  Briefcase, Scale, Wrench, Shield, FileText, Landmark, Settings, ChevronsUpDown,
  CheckCircle2, Clock, AlertCircle, Loader2, Send, Upload, ExternalLink,
  ArrowRight, Info,
} from 'lucide-react';
import type {
  AdminService, AdminPaymentConfig, ServiceRequest, ServiceCategory,
} from '@/lib/types';
import type { OwnerRegistryEntry } from './owner-portal';


const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  legal: 'Legal',
  administracion: 'Administración',
  documentacion: 'Documentación',
  mantenimiento: 'Mantenimiento',
  seguros: 'Seguros',
  impuestos: 'Impuestos / AFIP',
  contratos: 'Contratos',
  concierge: 'Concierge',
  otro: 'Otro',
};

const CATEGORY_ICONS: Record<ServiceCategory, React.ElementType> = {
  legal: Scale,
  administracion: Briefcase,
  documentacion: FileText,
  mantenimiento: Wrench,
  seguros: Shield,
  impuestos: Landmark,
  contratos: FileText,
  concierge: ChevronsUpDown,
  otro: Settings,
};

const STATUS_CONFIG: Record<
  ServiceRequest['estado'],
  { label: string; icon: React.ElementType; cls: string }
> = {
  solicitado:     { label: 'Solicitado',      icon: Clock,         cls: 'bg-blue-100 text-blue-700' },
  en_proceso:     { label: 'En proceso',      icon: Loader2,       cls: 'bg-yellow-100 text-yellow-700' },
  entregado:      { label: 'Entregado',       icon: CheckCircle2,  cls: 'bg-purple-100 text-purple-700' },
  pago_pendiente: { label: 'Pago pendiente',  icon: AlertCircle,   cls: 'bg-amber-100 text-amber-700' },
  pagado:         { label: 'Pagado',          icon: CheckCircle2,  cls: 'bg-green-100 text-green-700' },
  cancelado:      { label: 'Cancelado',       icon: AlertCircle,   cls: 'bg-gray-100 text-gray-500' },
};

interface OwnerServicesProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerServices({ ownerEntry }: OwnerServicesProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [services, setServices] = useState<AdminService[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<AdminPaymentConfig | null>(null);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Request dialog
  const [requestService, setRequestService] = useState<AdminService | null>(null);
  const [requestDesc, setRequestDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Payment dialog
  const [payingRequest, setPayingRequest] = useState<ServiceRequest | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadingComp, setUploadingComp] = useState(false);

  const adminId = ownerEntry.adminId;
  const clientEmail = ownerEntry.ownerEmail;
  const clientName = ownerEntry.ownerName;

  const load = useCallback(async () => {
    if (!db || !adminId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [svcSnap, cfgSnap, reqSnap] = await Promise.all([
        getDocs(collection(db, 'artifacts', APP_ID, 'users', adminId, 'adminServiceCatalog')),
        getDoc(doc(db, 'artifacts', APP_ID, 'users', adminId, 'config', 'paymentConfig')),
        getDocs(
          query(
            collection(db, 'artifacts', APP_ID, 'users', adminId, 'serviceRequests'),
            where('clientEmail', '==', clientEmail),
          ),
        ),
      ]);

      const allServices = svcSnap.docs.map(d => ({ id: d.id, ...d.data() } as AdminService));
      setServices(allServices.filter(s => s.activo && s.visible));
      setPaymentConfig(cfgSnap.exists() ? (cfgSnap.data() as AdminPaymentConfig) : null);
      setMyRequests(reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRequest)));
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los servicios.', variant: 'destructive' });
    }
    setLoading(false);
  }, [db, adminId, clientEmail, toast]);

  useEffect(() => { load(); }, [load]);

  const formatPrice = (s: AdminService) => {
    if (s.tipoPrecio === 'cotizacion') return 'A convenir';
    if (s.tipoPrecio === 'porcentaje') return `${s.porcentaje ?? 0}%`;
    if (s.precio === 0) return 'Consultar precio';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: s.moneda === 'USD' ? 'USD' : 'ARS',
      maximumFractionDigits: 0,
    }).format(s.precio);
  };

  const submitRequest = async () => {
    if (!db || !requestService || !adminId) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    const payload: Omit<ServiceRequest, 'id'> = {
      adminId,
      clientId: ownerEntry.ownerUid ?? clientEmail,
      clientType: 'owner',
      clientName,
      clientEmail,
      serviceId: requestService.id,
      serviceSnapshot: {
        nombre: requestService.nombre,
        precio: requestService.precio,
        moneda: requestService.moneda,
        entregable: requestService.entregable,
      },
      estado: 'solicitado',
      descripcion: requestDesc.trim(),
      archivos: {},
      createdAt: now,
      updatedAt: now,
    };
    try {
      const ref = await addDoc(
        collection(db, 'artifacts', APP_ID, 'users', adminId, 'serviceRequests'),
        payload,
      );
      setMyRequests(prev => [...prev, { ...payload, id: ref.id }]);
      toast({ title: 'Solicitud enviada', description: 'La administración procesará tu pedido.' });
      setRequestService(null);
      setRequestDesc('');
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar la solicitud.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleComprobanteUpload = async () => {
    if (!db || !payingRequest || !comprobanteFile || !adminId) return;
    setUploadingComp(true);
    try {
      // Store file name as reference (actual upload via Firebase Storage would go here)
      const now = new Date().toISOString();
      const update = {
        'archivos.comprobanteName': comprobanteFile.name,
        'pago.metodo': 'transferencia',
        'pago.comprobanteName': comprobanteFile.name,
        estado: 'en_proceso' as const,
        updatedAt: now,
      };
      await updateDoc(
        doc(db, 'artifacts', APP_ID, 'users', adminId, 'serviceRequests', payingRequest.id),
        update,
      );
      setMyRequests(prev =>
        prev.map(r =>
          r.id === payingRequest.id
            ? { ...r, estado: 'en_proceso', archivos: { ...r.archivos, comprobanteName: comprobanteFile.name }, updatedAt: now }
            : r,
        ),
      );
      toast({ title: 'Comprobante enviado', description: 'La administración verificará el pago y procesará el servicio.' });
      setPayingRequest(null);
      setComprobanteFile(null);
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar el comprobante.', variant: 'destructive' });
    }
    setUploadingComp(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-5 w-5 animate-spin" />Cargando servicios...
      </div>
    );
  }

  const pendingRequests = myRequests.filter(r => r.estado !== 'cancelado' && r.estado !== 'pagado');
  const completedRequests = myRequests.filter(r => r.estado === 'pagado' || r.estado === 'entregado');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-foreground">Servicios</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Solicitá servicios de asesoramiento, documentación y gestión a tu administrador.
        </p>
      </div>

      {/* ── Active requests ──────────────────────────────────────────────────── */}
      {pendingRequests.length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black">Mis solicitudes activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map(r => {
              const cfg = STATUS_CONFIG[r.estado];
              const Icon = cfg.icon;
              const needsPayment = r.estado === 'pago_pendiente';
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.serviceSnapshot.nombre}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('es-AR')}
                      {r.descripcion && ` · ${r.descripcion.slice(0, 60)}${r.descripcion.length > 60 ? '...' : ''}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ${cfg.cls}`}>
                    <Icon className="h-3 w-3" />{cfg.label}
                  </span>
                  {needsPayment && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 shrink-0 font-bold border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => { setPayingRequest(r); setComprobanteFile(null); }}
                    >
                      Pagar
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Services catalog ─────────────────────────────────────────────────── */}
      {services.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Tu administrador aún no publicó servicios disponibles.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(s => {
            const Icon = CATEGORY_ICONS[s.categoria] ?? Briefcase;
            const alreadyRequested = myRequests.some(
              r => r.serviceId === s.id && r.estado !== 'cancelado',
            );
            return (
              <Card key={s.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-black leading-tight">{s.nombre}</CardTitle>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
                        {CATEGORY_LABELS[s.categoria]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.descripcion}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-black tabular-nums text-primary">{formatPrice(s)}</p>
                      {s.tipoPrecio === 'fijo' && s.precio > 0 && (
                        <p className="text-[10px] text-muted-foreground">{s.moneda}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {s.entregable !== 'ninguno' ? `Entregable: ${s.entregable}` : 'Sin entregable'}
                      </p>
                      {s.requierePago && (
                        <p className="text-[10px] text-amber-600 font-semibold">Requiere pago</p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full gap-2 font-bold text-xs h-8"
                    disabled={alreadyRequested}
                    variant={alreadyRequested ? 'outline' : 'default'}
                    onClick={() => { setRequestService(s); setRequestDesc(''); }}
                  >
                    {alreadyRequested ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" />Ya solicitado</>
                    ) : (
                      <><Send className="h-3.5 w-3.5" />Solicitar</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Completed ────────────────────────────────────────────────────────── */}
      {completedRequests.length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black text-muted-foreground">Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedRequests.map(r => {
              const cfg = STATUS_CONFIG[r.estado];
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-muted-foreground">{r.serviceSnapshot.nombre}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold shrink-0 ${cfg.cls}`}>
                    <Icon className="h-3 w-3" />{cfg.label}
                  </span>
                  {r.archivos?.informeUrl && (
                    <a
                      href={r.archivos.informeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      <FileText className="h-3.5 w-3.5" />Ver
                    </a>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Request dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!requestService} onOpenChange={open => !open && setRequestService(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black">{requestService?.nombre}</DialogTitle>
            <DialogDescription className="text-xs">
              {requestService?.descripcion}
            </DialogDescription>
          </DialogHeader>
          {requestService && (
            <div className="space-y-4 py-2">
              {/* Price info */}
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Precio</span>
                  <span className="text-sm font-black tabular-nums">{formatPrice(requestService)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Entregable</span>
                  <span className="text-xs font-bold capitalize">{requestService.entregable}</span>
                </div>
                {requestService.requierePago && (
                  <div className="flex items-start gap-1.5 pt-1">
                    <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      Este servicio requiere acreditación de pago antes de recibir el entregable.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Descripción de tu consulta / necesidad</Label>
                <Textarea
                  placeholder="Explicá brevemente qué necesitás..."
                  value={requestDesc}
                  onChange={e => setRequestDesc(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {paymentConfig && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">Métodos de pago disponibles</p>
                  <div className="space-y-1.5">
                    {paymentConfig.mercadopago?.active && (
                      <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-[#00BCFF10] border border-[#00BCFF40]">
                        <div className="w-4 h-4 rounded-full bg-[#00BCFF] flex items-center justify-center shrink-0">
                          <span className="text-white text-[8px] font-black">MP</span>
                        </div>
                        <span>MercadoPago — pago automático al solicitar</span>
                      </div>
                    )}
                    {paymentConfig.transferencia?.active && (
                      <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border border-border">
                        <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          Transferencia a {paymentConfig.transferencia.banco} —{' '}
                          <strong>{paymentConfig.transferencia.alias || paymentConfig.transferencia.cbu}</strong>
                        </span>
                      </div>
                    )}
                    {paymentConfig.linkExterno?.active && paymentConfig.linkExterno?.url && (
                      <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border border-border">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a
                          href={paymentConfig.linkExterno.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {paymentConfig.linkExterno.label || 'Pagar en línea'} ↗
                        </a>
                      </div>
                    )}
                    {!paymentConfig.mercadopago?.active && !paymentConfig.transferencia?.active && !paymentConfig.linkExterno?.active && (
                      <p className="text-xs text-muted-foreground">La administración te indicará la forma de pago al contactarte.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestService(null)} className="font-bold">
              Cancelar
            </Button>
            <Button
              onClick={submitRequest}
              disabled={submitting}
              className="font-bold gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" />Enviar solicitud</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment / comprobante dialog ─────────────────────────────────────── */}
      <Dialog open={!!payingRequest} onOpenChange={open => !open && setPayingRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black">Acreditar pago</DialogTitle>
            <DialogDescription className="text-xs">
              {payingRequest?.serviceSnapshot.nombre}
            </DialogDescription>
          </DialogHeader>
          {payingRequest && paymentConfig && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <p className="text-xs font-bold text-amber-800">
                  Monto a pagar:{' '}
                  {payingRequest.serviceSnapshot.precio > 0
                    ? new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: payingRequest.serviceSnapshot.moneda === 'USD' ? 'USD' : 'ARS',
                        maximumFractionDigits: 0,
                      }).format(payingRequest.serviceSnapshot.precio)
                    : 'Según lo acordado'}
                </p>
              </div>

              {paymentConfig.transferencia?.active && (
                <div className="space-y-2">
                  <p className="text-xs font-bold">Datos para transferencia</p>
                  <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Titular</span>
                      <span className="font-bold">{paymentConfig.transferencia.titular}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Banco</span>
                      <span className="font-bold">{paymentConfig.transferencia.banco}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CBU</span>
                      <span className="font-mono font-bold">{paymentConfig.transferencia.cbu}</span>
                    </div>
                    {paymentConfig.transferencia.alias && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alias</span>
                        <span className="font-bold">{paymentConfig.transferencia.alias}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {paymentConfig.mercadopago?.active && (
                <div className="space-y-1">
                  <p className="text-xs font-bold">O pagá con MercadoPago</p>
                  <Button variant="outline" className="w-full gap-2 font-bold text-xs border-[#00BCFF] text-[#009ECC]">
                    <div className="w-4 h-4 rounded-full bg-[#00BCFF] flex items-center justify-center">
                      <span className="text-white text-[8px] font-black">MP</span>
                    </div>
                    Pagar con MercadoPago
                  </Button>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs font-bold">Subir comprobante de transferencia</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setComprobanteFile(e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                </div>
                {comprobanteFile && (
                  <p className="text-[11px] text-muted-foreground">{comprobanteFile.name}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingRequest(null)} className="font-bold">
              Cancelar
            </Button>
            <Button
              onClick={handleComprobanteUpload}
              disabled={!comprobanteFile || uploadingComp}
              className="font-bold gap-2"
            >
              {uploadingComp ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" />Enviar comprobante</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
