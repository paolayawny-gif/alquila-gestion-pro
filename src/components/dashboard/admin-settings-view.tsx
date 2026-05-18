'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import {
  doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { buildWaLink } from '@/lib/whatsapp';
import { authedFetch } from '@/lib/authed-fetch';
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, Loader2, Plus, Trash2,
  Settings, Briefcase, Scale, Wrench, Shield, FileText, Landmark,
  ChevronsUpDown, Eye, EyeOff, ExternalLink, DollarSign, Pencil,
  LogOut, Info, Globe, Copy, Lock, Gift, Sparkles, Building2,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { BILLING_TIERS } from '@/lib/billing/tiers';
import type {
  AdminService, AdminPaymentConfig, ServiceCategory, ServiceClientTarget,
  ServicePriceType, ServiceDeliverable,
} from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

interface AdminSettingsViewProps {
  userId?: string;
}

export function useAdminWhatsApp(userId?: string): { whatsappNumber: string | null; loading: boolean } {
  const db = useFirestore();
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'))
      .then(snap => {
        if (snap.exists()) setWhatsappNumber(snap.data()?.whatsappNumber ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [db, userId]);

  return { whatsappNumber, loading };
}

export function AdminSettingsView({ userId }: AdminSettingsViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-foreground">Configuración</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Ajustes de tu cuenta, canales de comunicación y servicios.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="general" className="text-xs font-bold gap-1.5">
            <Settings className="h-3.5 w-3.5" />General
          </TabsTrigger>
          <TabsTrigger value="servicios" className="text-xs font-bold gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />Servicios y Cobros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="max-w-2xl space-y-6">
          <ReferralCard userId={userId} />
          <PublicPageCard userId={userId} />
          <PortalPlusCard userId={userId} />
          <WhatsAppCard userId={userId} />
          <WhatsAppApiCard userId={userId} />
          <BillingCard userId={userId} />
          <BajaCard userId={userId} />
        </TabsContent>

        <TabsContent value="servicios" className="space-y-6">
          <ServicesAndBillingTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Card
// ─────────────────────────────────────────────────────────────────────────────

function WhatsAppCard({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [whatsappInput, setWhatsappInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { whatsappNumber, loading } = useAdminWhatsApp(userId);

  useEffect(() => {
    if (!loading && whatsappNumber) setWhatsappInput(whatsappNumber);
  }, [loading, whatsappNumber]);

  const handleSave = async () => {
    if (!db || !userId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'),
        { whatsappNumber: whatsappInput.trim(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      toast({ title: 'Guardado', description: 'Número de WhatsApp actualizado correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el número.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const previewNumber = whatsappInput.trim();
  const previewLink = previewNumber
    ? buildWaLink(previewNumber, 'Hola, le escribo desde AlquilaGestión Pro.')
    : null;

  return (
    <>
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: '#25D36620' }}>
              <svg viewBox="0 0 24 24" fill="#25D366" className="h-5 w-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-base font-black">Configuración de WhatsApp</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Ingresá tu número de WhatsApp Business. Se usará para enviar notificaciones a inquilinos y propietarios.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Número de WhatsApp</Label>
            <Input
              type="text"
              placeholder="+54 9 11 xxxx xxxx"
              value={whatsappInput}
              onChange={e => setWhatsappInput(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Ingresá el número con código de país. Ej: +54 9 11 4567 8901 (Buenos Aires)
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || !whatsappInput.trim()} className="gap-2 font-bold">
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">Vista previa</CardTitle>
        </CardHeader>
        <CardContent>
          {previewLink ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Link generado:</p>
              <a
                href={previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-green-700 hover:underline break-all"
              >
                {previewLink}
              </a>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hacé clic para probar que el link abre WhatsApp correctamente.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Configurá tu número para ver la vista previa.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Baja / Arrepentimiento Card (Ley 24.240 Art. 34)
// ─────────────────────────────────────────────────────────────────────────────

function BajaCard({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  // Check if already requested
  useEffect(() => {
    if (!db || !userId) return;
    import('firebase/firestore').then(({ collection, query, where, getDocs: gd }) => {
      gd(query(
        collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'cancelRequests'),
        where('adminId', '==', userId),
        where('status', '==', 'pendiente'),
      )).then(snap => { if (!snap.empty) setAlreadyRequested(true); }).catch(() => {});
    });
  }, [db, userId]);

  const handleSubmit = async () => {
    if (!db || !userId || !reason) return;
    setSaving(true);
    const now = new Date().toISOString();
    try {
      const { collection: col, addDoc: add } = await import('firebase/firestore');
      await add(
        col(db, 'artifacts', APP_ID, 'superadmin', 'data', 'cancelRequests'),
        {
          adminId: userId,
          adminEmail: user?.email ?? '',
          reason,
          notes: notes.trim(),
          requestedAt: now,
          status: 'pendiente',
        },
      );
      setAlreadyRequested(true);
      setOpen(false);
      toast({
        title: 'Solicitud de baja registrada',
        description: 'Recibirás confirmación dentro de 10 días hábiles según Ley 24.240.',
      });
    } catch {
      toast({ title: 'Error', description: 'No se pudo registrar la solicitud.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <>
      <Card className="border border-destructive/20 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/8">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-destructive">Baja del servicio</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Derecho de arrepentimiento — Ley 24.240 Art. 34
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Podés solicitar la baja en cualquier momento. La solicitud será procesada dentro de los{' '}
              <strong>10 días hábiles</strong> siguientes. No se cobrarán períodos adicionales una vez
              confirmada la baja. Tus datos quedan disponibles para exportar hasta la fecha de cierre.
            </p>
          </div>
          {alreadyRequested ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Solicitud de baja registrada — en proceso de revisión.
            </div>
          ) : (
            <Button
              variant="outline"
              className="font-bold border-destructive/40 text-destructive hover:bg-destructive/5 gap-2"
              onClick={() => setOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Solicitar baja del servicio
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-destructive flex items-center gap-2">
              <LogOut className="h-5 w-5" />Solicitar baja
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completá el formulario. Procesaremos tu solicitud dentro de los 10 días hábiles (Ley 24.240 Art. 34).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <p className="font-bold mb-1">Antes de continuar, considerá:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Todos tus datos quedan disponibles para exportar hasta la fecha de cierre.</li>
                <li>Las suscripciones activas se cancelan a partir del próximo período.</li>
                <li>Esta acción no elimina tus datos de inmediato — podés reactivar dentro de los 30 días.</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Email de la cuenta *</Label>
              <Input
                value={user?.email ?? ''}
                readOnly
                className="text-xs bg-muted/30 text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Motivo de la baja *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Seleccioná un motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cambio_plataforma" className="text-xs">Me cambié a otra plataforma</SelectItem>
                  <SelectItem value="sin_uso" className="text-xs">Ya no necesito el servicio</SelectItem>
                  <SelectItem value="precio" className="text-xs">El precio no se ajusta a mi necesidad</SelectItem>
                  <SelectItem value="problemas_tecnicos" className="text-xs">Problemas técnicos no resueltos</SelectItem>
                  <SelectItem value="funcionalidades" className="text-xs">Faltan funcionalidades que necesito</SelectItem>
                  <SelectItem value="otro" className="text-xs">Otro motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Comentarios adicionales</Label>
              <Textarea
                placeholder="Contanos más sobre tu experiencia o qué podríamos mejorar..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="font-bold">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !reason}
              className="font-bold gap-2 bg-destructive hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Confirmar solicitud de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicios y Cobros Tab
// ─────────────────────────────────────────────────────────────────────────────

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

const DEFAULT_SERVICES: Omit<AdminService, 'id' | 'adminId' | 'createdAt' | 'updatedAt'>[] = [
  {
    nombre: 'Consulta Legal',
    descripcion: 'Asesoramiento jurídico especializado en materia inmobiliaria.',
    categoria: 'legal', clienteObjetivo: 'ambos', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'informe', requierePago: true, activo: true, visible: true,
  },
  {
    nombre: 'Preparación de Contrato',
    descripcion: 'Redacción y revisión de contratos de locación.',
    categoria: 'contratos', clienteObjetivo: 'propietario', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'documento', requierePago: true, activo: true, visible: true,
  },
  {
    nombre: 'Informe Veraz / BCRA',
    descripcion: 'Consulta de antecedentes crediticios del postulante.',
    categoria: 'documentacion', clienteObjetivo: 'propietario', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'informe', requierePago: true, activo: true, visible: true,
  },
  {
    nombre: 'Certificado Libre Deuda',
    descripcion: 'Tramitación de certificado de libre deuda del inmueble.',
    categoria: 'documentacion', clienteObjetivo: 'inquilino', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'documento', requierePago: true, activo: true, visible: false,
  },
  {
    nombre: 'Coordinación de Mantenimiento',
    descripcion: 'Gestión de proveedores y supervisión de reparaciones.',
    categoria: 'mantenimiento', clienteObjetivo: 'propietario', tipoPrecio: 'porcentaje',
    precio: 0, porcentaje: 15, moneda: 'ARS', entregable: 'gestion', requierePago: true, activo: true, visible: true,
  },
  {
    nombre: 'Gestión de Seguros',
    descripcion: 'Gestión y renovación de pólizas de seguro del inmueble.',
    categoria: 'seguros', clienteObjetivo: 'propietario', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'gestion', requierePago: true, activo: false, visible: false,
  },
  {
    nombre: 'Declaración AFIP / ARCA',
    descripcion: 'Asistencia en la declaración de ingresos por alquileres ante AFIP.',
    categoria: 'impuestos', clienteObjetivo: 'propietario', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'gestion', requierePago: true, activo: false, visible: false,
  },
  {
    nombre: 'Rescisión Anticipada',
    descripcion: 'Tramitación del proceso de rescisión anticipada del contrato.',
    categoria: 'contratos', clienteObjetivo: 'ambos', tipoPrecio: 'fijo',
    precio: 0, moneda: 'ARS', entregable: 'documento', requierePago: true, activo: true, visible: true,
  },
  {
    nombre: 'Concierge',
    descripcion: 'Servicio personalizado de gestión integral — precio a convenir con el cliente.',
    categoria: 'concierge', clienteObjetivo: 'ambos', tipoPrecio: 'cotizacion',
    precio: 0, moneda: 'ARS', entregable: 'gestion', requierePago: false, activo: false, visible: false,
  },
];

const BLANK_SERVICE: Omit<AdminService, 'id' | 'adminId' | 'createdAt' | 'updatedAt'> = {
  nombre: '', descripcion: '', categoria: 'administracion', clienteObjetivo: 'ambos',
  tipoPrecio: 'fijo', precio: 0, moneda: 'ARS', entregable: 'gestion',
  requierePago: true, activo: true, visible: true,
};

function ServicesAndBillingTab({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { toast } = useToast();

  // ── Service catalog state ───────────────────────────────────────────────────
  const [services, setServices] = useState<AdminService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [serviceForm, setServiceForm] = useState<Omit<AdminService, 'id' | 'adminId' | 'createdAt' | 'updatedAt'>>(BLANK_SERVICE);
  const [savingService, setSavingService] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Payment config state ────────────────────────────────────────────────────
  const [paymentConfig, setPaymentConfig] = useState<AdminPaymentConfig>({});
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);

  const servicesPath = (id?: string) =>
    id
      ? doc(db!, 'artifacts', APP_ID, 'users', userId!, 'adminServiceCatalog', id)
      : collection(db!, 'artifacts', APP_ID, 'users', userId!, 'adminServiceCatalog');

  const paymentConfigRef = () =>
    doc(db!, 'artifacts', APP_ID, 'users', userId!, 'config', 'paymentConfig');

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    if (!db || !userId) { setLoadingServices(false); return; }
    setLoadingServices(true);
    try {
      const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog'));
      if (snap.empty) {
        // First time: seed defaults
        const now = new Date().toISOString();
        const batch: AdminService[] = [];
        for (const svc of DEFAULT_SERVICES) {
          const ref = await addDoc(
            collection(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog'),
            { ...svc, adminId: userId, createdAt: now, updatedAt: now },
          );
          batch.push({ ...svc, id: ref.id, adminId: userId, createdAt: now, updatedAt: now });
        }
        setServices(batch);
      } else {
        setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminService)));
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los servicios.', variant: 'destructive' });
    }
    setLoadingServices(false);
  }, [db, userId, toast]);

  const loadPaymentConfig = useCallback(async () => {
    if (!db || !userId) { setLoadingPayment(false); return; }
    setLoadingPayment(true);
    try {
      const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'paymentConfig'));
      if (snap.exists()) setPaymentConfig(snap.data() as AdminPaymentConfig);
    } catch { /* silent */ }
    setLoadingPayment(false);
  }, [db, userId]);

  useEffect(() => {
    loadServices();
    loadPaymentConfig();
  }, [loadServices, loadPaymentConfig]);

  // ── Service CRUD ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingService(null);
    setServiceForm(BLANK_SERVICE);
    setShowServiceForm(true);
  };

  const openEdit = (s: AdminService) => {
    setEditingService(s);
    const { id, adminId, createdAt, updatedAt, ...rest } = s;
    setServiceForm(rest);
    setShowServiceForm(true);
  };

  const saveService = async () => {
    if (!db || !userId || !serviceForm.nombre.trim()) return;
    setSavingService(true);
    const now = new Date().toISOString();
    try {
      if (editingService) {
        await updateDoc(
          doc(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog', editingService.id),
          { ...serviceForm, updatedAt: now },
        );
        setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...serviceForm, updatedAt: now } : s));
        toast({ title: 'Servicio actualizado' });
      } else {
        const ref = await addDoc(
          collection(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog'),
          { ...serviceForm, adminId: userId, createdAt: now, updatedAt: now },
        );
        setServices(prev => [...prev, { ...serviceForm, id: ref.id, adminId: userId, createdAt: now, updatedAt: now }]);
        toast({ title: 'Servicio agregado' });
      }
      setShowServiceForm(false);
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el servicio.', variant: 'destructive' });
    }
    setSavingService(false);
  };

  const deleteService = async (id: string) => {
    if (!db || !userId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog', id));
      setServices(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Servicio eliminado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    }
    setDeletingId(null);
  };

  const toggleField = async (s: AdminService, field: 'activo' | 'visible') => {
    if (!db || !userId) return;
    const updated = { ...s, [field]: !s[field], updatedAt: new Date().toISOString() };
    setServices(prev => prev.map(x => x.id === s.id ? updated : x));
    await updateDoc(
      doc(db, 'artifacts', APP_ID, 'users', userId, 'adminServiceCatalog', s.id),
      { [field]: !s[field], updatedAt: updated.updatedAt },
    ).catch(() => {});
  };

  // ── Payment config save ─────────────────────────────────────────────────────
  const savePaymentConfig = async () => {
    if (!db || !userId) return;
    setSavingPayment(true);
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'paymentConfig'),
        { ...paymentConfig, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      toast({ title: 'Configuración de cobros guardada' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración.', variant: 'destructive' });
    }
    setSavingPayment(false);
  };

  const patchPayment = (path: keyof AdminPaymentConfig, value: Record<string, unknown>) => {
    setPaymentConfig(prev => ({
      ...prev,
      [path]: { ...(prev[path] as Record<string, unknown> ?? {}), ...value },
    }));
  };

  const formatPrice = (s: AdminService) => {
    if (s.tipoPrecio === 'cotizacion') return 'A convenir';
    if (s.tipoPrecio === 'porcentaje') return `${s.porcentaje ?? 0}%`;
    if (s.precio === 0) return <span className="text-amber-600 font-semibold">Sin precio</span>;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: s.moneda === 'USD' ? 'USD' : 'ARS', maximumFractionDigits: 0,
    }).format(s.precio);
  };

  return (
    <div className="space-y-6">
      {/* ── Service Catalog ─────────────────────────────────────────────────── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-black">Catálogo de servicios</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configurá los servicios que ofrecés y su precio. Los propietarios e inquilinos los ven desde su portal.
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={openAdd} className="gap-1.5 font-bold text-xs h-8">
              <Plus className="h-3.5 w-3.5" />Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingServices ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando servicios...
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No hay servicios. Agregá el primero.</p>
          ) : (
            <div className="space-y-2">
              {services.map(s => {
                const Icon = CATEGORY_ICONS[s.categoria] ?? Briefcase;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      s.activo ? 'border-border bg-white' : 'border-border/40 bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-primary/8 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{s.nombre}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {CATEGORY_LABELS[s.categoria]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                          {s.clienteObjetivo}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{s.descripcion}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{formatPrice(s)}</p>
                      <p className="text-[10px] text-muted-foreground">{s.moneda}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        title={s.activo ? 'Activo — clic para desactivar' : 'Inactivo — clic para activar'}
                        onClick={() => toggleField(s, 'activo')}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          s.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {s.activo ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        title={s.visible ? 'Visible en portal — clic para ocultar' : 'Oculto — clic para mostrar'}
                        onClick={() => toggleField(s, 'visible')}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          s.visible ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {s.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        title="Editar"
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setDeletingId(s.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-600" /> Activo
                <span className="mx-1 text-border">·</span>
                <Eye className="h-3 w-3 text-blue-500" /> Visible en portal del cliente
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Methods ──────────────────────────────────────────────────── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-black">Métodos de cobro</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configurá cómo tus clientes pueden pagar los servicios. Podés activar más de uno.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPayment ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando configuración...
            </div>
          ) : (
            <>
              {/* MercadoPago */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#00BCFF] flex items-center justify-center">
                      <span className="text-white text-[9px] font-black">MP</span>
                    </div>
                    <span className="text-sm font-bold">MercadoPago Checkout Pro</span>
                    <Badge variant="outline" className="text-[10px]">Cobro automático</Badge>
                  </div>
                  <Switch
                    checked={paymentConfig.mercadopago?.active ?? false}
                    onCheckedChange={v => patchPayment('mercadopago', { active: v })}
                  />
                </div>
                {paymentConfig.mercadopago?.active && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Access Token (privado)</Label>
                      <Input
                        type="password"
                        placeholder="APP_USR-..."
                        value={paymentConfig.mercadopago?.accessToken ?? ''}
                        onChange={e => patchPayment('mercadopago', { accessToken: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Public Key</Label>
                      <Input
                        placeholder="APP_USR-..."
                        value={paymentConfig.mercadopago?.publicKey ?? ''}
                        onChange={e => patchPayment('mercadopago', { publicKey: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  El pago se confirma automáticamente vía webhook. Generá las credenciales en tu cuenta de MercadoPago.
                </p>
              </div>

              {/* Transferencia bancaria */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold">Transferencia bancaria</span>
                    <Badge variant="outline" className="text-[10px]">Comprobante manual</Badge>
                  </div>
                  <Switch
                    checked={paymentConfig.transferencia?.active ?? false}
                    onCheckedChange={v => patchPayment('transferencia', { active: v })}
                  />
                </div>
                {paymentConfig.transferencia?.active && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">CBU</Label>
                      <Input
                        placeholder="0000000000000000000000"
                        value={paymentConfig.transferencia?.cbu ?? ''}
                        onChange={e => patchPayment('transferencia', { cbu: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Alias</Label>
                      <Input
                        placeholder="MI.ALIAS.CBU"
                        value={paymentConfig.transferencia?.alias ?? ''}
                        onChange={e => patchPayment('transferencia', { alias: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Banco</Label>
                      <Input
                        placeholder="Ej: Santander, Galicia..."
                        value={paymentConfig.transferencia?.banco ?? ''}
                        onChange={e => patchPayment('transferencia', { banco: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Titular de la cuenta</Label>
                      <Input
                        placeholder="Nombre completo o razón social"
                        value={paymentConfig.transferencia?.titular ?? ''}
                        onChange={e => patchPayment('transferencia', { titular: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  El cliente sube el comprobante desde su portal y vos lo aprobás antes de entregar el servicio.
                </p>
              </div>

              {/* Link externo */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold">Link externo de pago</span>
                    <Badge variant="outline" className="text-[10px]">Getnet / Modo / Otro</Badge>
                  </div>
                  <Switch
                    checked={paymentConfig.linkExterno?.active ?? false}
                    onCheckedChange={v => patchPayment('linkExterno', { active: v })}
                  />
                </div>
                {paymentConfig.linkExterno?.active && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-bold">URL de pago</Label>
                      <Input
                        placeholder="https://..."
                        value={paymentConfig.linkExterno?.url ?? ''}
                        onChange={e => patchPayment('linkExterno', { url: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Texto del botón</Label>
                      <Input
                        placeholder="Ej: Pagar con Getnet"
                        value={paymentConfig.linkExterno?.label ?? ''}
                        onChange={e => patchPayment('linkExterno', { label: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Se muestra un botón que redirige al cliente a tu plataforma de cobros preferida.
                </p>
              </div>

              <Button onClick={savePaymentConfig} disabled={savingPayment} className="font-bold gap-2">
                {savingPayment ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : 'Guardar configuración de cobros'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Estudio Jurídico ─────────────────────────────────────────────────── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-black">Estudio jurídico</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Indicá qué estudio gestiona las consultas legales de tus clientes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPayment ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(['app', 'propio'] as const).map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => patchPayment('estudioJuridico', { tipo })}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      (paymentConfig.estudioJuridico?.tipo ?? 'app') === tipo
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/30'
                    }`}
                  >
                    <p className="text-sm font-bold">
                      {tipo === 'app' ? 'Estudio AlquilaGestión Pro' : 'Mi propio estudio'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tipo === 'app'
                        ? 'Derivamos la consulta al estudio de la plataforma.'
                        : 'Las consultas llegan a vos y las derivás a tu estudio.'}
                    </p>
                  </button>
                ))}
              </div>
              {(paymentConfig.estudioJuridico?.tipo === 'propio') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Nombre del estudio</Label>
                    <Input
                      placeholder="Estudio Jurídico..."
                      value={paymentConfig.estudioJuridico?.nombre ?? ''}
                      onChange={e => patchPayment('estudioJuridico', { nombre: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Email de contacto</Label>
                    <Input
                      type="email"
                      placeholder="estudio@..."
                      value={paymentConfig.estudioJuridico?.email ?? ''}
                      onChange={e => patchPayment('estudioJuridico', { email: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Teléfono / WhatsApp</Label>
                    <Input
                      placeholder="+54 9 11..."
                      value={paymentConfig.estudioJuridico?.telefono ?? ''}
                      onChange={e => patchPayment('estudioJuridico', { telefono: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
              <Button onClick={savePaymentConfig} disabled={savingPayment} variant="outline" className="font-bold gap-2">
                {savingPayment ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : 'Guardar estudio jurídico'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Service Form Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showServiceForm} onOpenChange={setShowServiceForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black">
              {editingService ? 'Editar servicio' : 'Agregar servicio'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Completá los datos del servicio que ofrecés a tus clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Nombre del servicio *</Label>
              <Input
                placeholder="Ej: Consulta Legal"
                value={serviceForm.nombre}
                onChange={e => setServiceForm(p => ({ ...p, nombre: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">Descripción</Label>
              <Textarea
                placeholder="Breve descripción del servicio..."
                value={serviceForm.descripcion}
                onChange={e => setServiceForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Categoría</Label>
                <Select
                  value={serviceForm.categoria}
                  onValueChange={v => setServiceForm(p => ({ ...p, categoria: v as ServiceCategory }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold">Cliente objetivo</Label>
                <Select
                  value={serviceForm.clienteObjetivo}
                  onValueChange={v => setServiceForm(p => ({ ...p, clienteObjetivo: v as ServiceClientTarget }))}
                >
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propietario" className="text-xs">Propietario</SelectItem>
                    <SelectItem value="inquilino" className="text-xs">Inquilino</SelectItem>
                    <SelectItem value="ambos" className="text-xs">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Tipo de precio</Label>
                <Select
                  value={serviceForm.tipoPrecio}
                  onValueChange={v => setServiceForm(p => ({ ...p, tipoPrecio: v as ServicePriceType }))}
                >
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo" className="text-xs">Precio fijo</SelectItem>
                    <SelectItem value="porcentaje" className="text-xs">Porcentaje</SelectItem>
                    <SelectItem value="cotizacion" className="text-xs">A convenir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {serviceForm.tipoPrecio === 'fijo' && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Precio</Label>
                  <div className="flex gap-1.5">
                    <Select
                      value={serviceForm.moneda}
                      onValueChange={v => setServiceForm(p => ({ ...p, moneda: v as 'ARS' | 'USD' }))}
                    >
                      <SelectTrigger className="text-xs h-9 w-20 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS" className="text-xs">ARS</SelectItem>
                        <SelectItem value="USD" className="text-xs">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={serviceForm.precio || ''}
                      onChange={e => setServiceForm(p => ({ ...p, precio: Number(e.target.value) }))}
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              )}
              {serviceForm.tipoPrecio === 'porcentaje' && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Porcentaje (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="15"
                    value={serviceForm.porcentaje ?? ''}
                    onChange={e => setServiceForm(p => ({ ...p, porcentaje: Number(e.target.value) }))}
                    className="text-xs h-9"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Entregable</Label>
                <Select
                  value={serviceForm.entregable}
                  onValueChange={v => setServiceForm(p => ({ ...p, entregable: v as ServiceDeliverable }))}
                >
                  <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="documento" className="text-xs">Documento</SelectItem>
                    <SelectItem value="informe" className="text-xs">Informe</SelectItem>
                    <SelectItem value="gestion" className="text-xs">Gestión</SelectItem>
                    <SelectItem value="ninguno" className="text-xs">Sin entregable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">Requiere pago previo</p>
                <p className="text-[11px] text-muted-foreground">El cliente debe acreditar el pago para recibir el entregable.</p>
              </div>
              <Switch
                checked={serviceForm.requierePago}
                onCheckedChange={v => setServiceForm(p => ({ ...p, requierePago: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">Visible en portal</p>
                <p className="text-[11px] text-muted-foreground">Los clientes pueden solicitarlo directamente.</p>
              </div>
              <Switch
                checked={serviceForm.visible}
                onCheckedChange={v => setServiceForm(p => ({ ...p, visible: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceForm(false)} className="font-bold">
              Cancelar
            </Button>
            <Button
              onClick={saveService}
              disabled={savingService || !serviceForm.nombre.trim()}
              className="font-bold"
            >
              {savingService ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingService ? 'Guardar cambios' : 'Agregar servicio')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El servicio dejará de estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="font-bold bg-destructive hover:bg-destructive/90"
              onClick={() => deletingId && deleteService(deletingId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral Card
// ─────────────────────────────────────────────────────────────────────────────

function ReferralCard({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<number>(0);

  const code = userId ? userId.slice(0, 8).toUpperCase() : '';
  const referralUrl = userId && typeof window !== 'undefined'
    ? `${window.location.origin}/signup?ref=${code}`
    : '';

  useEffect(() => {
    if (!db || !userId) return;
    import('firebase/firestore').then(({ collection: col, query: q, where, getDocs: gd }) => {
      gd(q(
        col(db, 'artifacts', APP_ID, 'superadmin', 'data', 'referrals'),
        where('referredBy', '==', userId),
        where('status', '==', 'activo'),
      )).then(snap => setReferrals(snap.size)).catch(() => {});
    });
  }, [db, userId]);

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      toast({ title: 'Link copiado', description: 'Compartilo con otros administradores.' });
    });
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50">
            <Gift className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base font-black">Programa de referidos</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Recomendá AlquilaGestión Pro a otros administradores y obtenés beneficios cuando se suscriben.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{referrals}</p>
            <p className="text-[11px] text-amber-600 font-bold">Referidos activos</p>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
            <p className="text-2xl font-black text-green-700">{code || '—'}</p>
            <p className="text-[11px] text-green-600 font-bold">Tu código</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">Link de referido</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={referralUrl} className="text-xs font-mono bg-muted/50" />
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy} disabled={!referralUrl}>
              <Copy className="h-3.5 w-3.5" />Copiar
            </Button>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Cada administrador que se suscribe usando tu código queda registrado como referido. Contactate con nosotros para conocer los beneficios disponibles para tu plan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Page Card
// ─────────────────────────────────────────────────────────────────────────────

function PublicPageCard({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const publicUrl = userId
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://alquilagestionpro.com'}/p/${userId}`
    : '';

  const handleCopy = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({ title: 'URL copiada', description: 'Compartila con tus clientes.' });
    });
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base font-black">Página pública de propiedades</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Compartí este link con tus clientes para que vean tus propiedades disponibles.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={publicUrl}
            className="text-xs font-mono bg-muted/50"
          />
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          {publicUrl && (
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver
              </a>
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          La página muestra todas las propiedades con estado "Disponible". Se actualiza automáticamente cuando cambiás el estado de una propiedad.
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Plus Card — vidriera pública general (zonaprop-style)
// ─────────────────────────────────────────────────────────────────────────────

function PortalPlusCard({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [status, setStatus] = useState<'none' | 'pendiente' | 'aprobada' | 'rechazada'>('none');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    getDoc(doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'portalPlusRequests', userId))
      .then(snap => {
        if (snap.exists()) setStatus(((snap.data()?.status as string) ?? 'none') as typeof status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [db, userId]);

  const handleCheckout = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/portal/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          adminId: userId,
          adminEmail: user?.email ?? '',
          adminName: user?.displayName ?? '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.initUrl) {
        window.location.href = data.initUrl as string;
        return;
      }
      toast({ title: 'Error', description: data.error ?? 'No se pudo iniciar el pago.', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo iniciar el pago.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const portalUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://alquilagestionpro.com'}/portal`;

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              Portal de Propiedades
              <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold gap-1">
                <Sparkles className="h-3 w-3" /> Plus · +5 USD/mes
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Publicá tus propiedades disponibles en la vidriera pública general, indexada en Google.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado...
          </p>
        ) : status === 'aprobada' ? (
          <div className="space-y-3">
            <p className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Portal Plus activo
            </p>
            <p className="text-[11px] text-muted-foreground">
              Todas tus propiedades con estado "Disponible" aparecen automáticamente en el portal público. Se actualiza cada 5 minutos.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver el portal
              </a>
            </Button>
          </div>
        ) : status === 'pendiente' ? (
          <div className="space-y-3">
            <p className="text-xs text-amber-700 font-bold flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Pago pendiente
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tu suscripción se activa apenas se confirme el pago en MercadoPago. Si no lo completaste, podés retomarlo.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCheckout} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Completar pago
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {status === 'rechazada' && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Tu suscripción anterior no está activa. Podés suscribirte de nuevo.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Con el Portal Plus, las propiedades que marques como publicables aparecen en la vidriera pública.
              El cobro es una suscripción mensual por MercadoPago — se activa automáticamente al confirmarse el pago.
            </p>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleCheckout} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Suscribirme — 5 USD/mes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API Card
// ─────────────────────────────────────────────────────────────────────────────

function WhatsAppApiCard({ userId }: { userId?: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [phoneId, setPhoneId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) { setLoading(false); return; }
    getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setPhoneId(d.waPhoneNumberId ?? '');
          setToken(d.waAccessToken ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [db, userId]);

  const handleSave = async () => {
    if (!db || !userId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'profile'),
        { waPhoneNumberId: phoneId.trim(), waAccessToken: token.trim(), updatedAt: new Date().toISOString() },
        { merge: true },
      );
      toast({ title: 'Guardado', description: 'Credenciales de WhatsApp Cloud API guardadas.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50">
            <Lock className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base font-black">WhatsApp Business Cloud API</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Opcional: configurá las credenciales de Meta para enviar mensajes automáticos (ajustes, recordatorios, vencimientos).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Obtenés el <strong>Phone Number ID</strong> y el <strong>Access Token</strong> en <em>Meta for Developers → WhatsApp → API Setup</em>. Sin esto, los recordatorios se envían solo por email.</span>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold">Phone Number ID</Label>
          <Input
            placeholder="ej: 123456789012345"
            value={phoneId}
            onChange={e => setPhoneId(e.target.value)}
            className="text-sm font-mono"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold">Access Token</Label>
          <div className="flex gap-2">
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="EAAxxxxx…"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="text-sm font-mono flex-1"
              disabled={loading}
            />
            <Button variant="outline" size="sm" onClick={() => setShowToken(v => !v)} className="shrink-0">
              {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || loading || (!phoneId && !token)} className="gap-2 font-bold">
          {saving ? 'Guardando…' : 'Guardar credenciales'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Card
// ─────────────────────────────────────────────────────────────────────────────

function BillingCard({ userId }: { userId?: string }) {
  const { user } = useUser();
  const { toast } = useToast();
  const plan = usePlan(userId);
  const [busy, setBusy] = useState<'checkout' | 'cancel' | 'sync' | null>(null);

  const status = plan.state?.status ?? 'trial';

  const formatARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  const handleCheckout = async () => {
    if (!userId || !user?.email) return;
    setBusy('checkout');
    try {
      const res = await authedFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ adminId: userId, adminEmail: user.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      window.location.href = data.initUrl;
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo iniciar el cobro.', variant: 'destructive' });
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!userId) return;
    if (!confirm('¿Cancelar la suscripción? El servicio quedará disponible hasta el final del período pagado.')) return;
    setBusy('cancel');
    try {
      const res = await authedFetch('/api/billing/cancel', {
        method: 'POST',
        body: JSON.stringify({ adminId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      toast({ title: 'Suscripción cancelada', description: 'Ya no se realizarán cobros futuros.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo cancelar.', variant: 'destructive' });
    }
    setBusy(null);
  };

  const handleSync = async () => {
    if (!userId) return;
    setBusy('sync');
    try {
      const res = await authedFetch('/api/billing/sync-tier', {
        method: 'POST',
        body: JSON.stringify({ adminId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error');
      toast({
        title: data.changed ? 'Plan actualizado' : 'Plan al día',
        description: data.changed
          ? `Pasaste a ${data.newTierId}. El próximo cobro reflejará el nuevo monto.`
          : `Tu plan corresponde a tus ${data.activeUnits} unidades activas.`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo sincronizar.', variant: 'destructive' });
    }
    setBusy(null);
  };

  const StatusBadge = () => {
    const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
      trial:     { label: 'Período de prueba',      cls: 'bg-blue-100 text-blue-800',     icon: Clock },
      pending:   { label: 'Esperando autorización', cls: 'bg-yellow-100 text-yellow-800', icon: Clock },
      active:    { label: 'Activa',                 cls: 'bg-green-100 text-green-800',   icon: CheckCircle2 },
      past_due:  { label: 'Pago vencido',           cls: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      paused:    { label: 'Pausada',                cls: 'bg-orange-100 text-orange-800', icon: AlertCircle },
      cancelled: { label: 'Cancelada',              cls: 'bg-gray-200 text-gray-700',     icon: AlertCircle },
    };
    const m = map[status] ?? map.trial;
    const Icon = m.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${m.cls}`}>
        <Icon className="h-3 w-3" />{m.label}
      </span>
    );
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-black">Plan y suscripción</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Gestioná tu plan según las unidades activas. Cobro mensual via MercadoPago.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado del plan...
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Plan vigente</p>
                <p className="text-base font-black">{plan.tier?.label ?? 'Sin plan'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.state?.activeUnits ?? 0} unidades activas
                  {plan.tier && plan.tier.maxUnits ? ` / ${plan.tier.maxUnits}` : ''}
                </p>
              </div>
              <StatusBadge />
            </div>

            {plan.trialActive && plan.trialEndsAt && (
              <div className="text-xs p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                Estás en período de prueba hasta el{' '}
                <strong>{plan.trialEndsAt.toLocaleDateString('es-AR')}</strong>.
                Después necesitás activar la suscripción para seguir usando todas las funciones.
              </div>
            )}

            {plan.inGracePeriod && plan.gracePeriodEndsAt && (
              <div className="text-xs p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-900">
                El último cobro falló. Tenés tiempo hasta el{' '}
                <strong>{plan.gracePeriodEndsAt.toLocaleDateString('es-AR')}</strong>{' '}
                para regularizar antes que se suspenda el servicio.
              </div>
            )}

            {status === 'pending' && plan.pendingGraceActive && plan.pendingGraceEndsAt && (
              <div className="text-xs p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                Tu suscripción está pendiente de autorización. Tenés tiempo hasta el{' '}
                <strong>{plan.pendingGraceEndsAt.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</strong>{' '}
                para autorizar el pago en MercadoPago. Pasado ese plazo, el servicio se limita.
              </div>
            )}

            {status === 'pending' && !plan.pendingGraceActive && (
              <div className="text-xs p-3 rounded-lg bg-red-50 border border-red-200 text-red-900">
                Tu suscripción no fue autorizada dentro de las 48 hs. El servicio está limitado
                hasta que completes el pago — hacé click en <strong>"Activar suscripción"</strong> para regularizar.
              </div>
            )}

            {plan.overLimit && (
              <div className="text-xs p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900">
                Tenés más unidades activas que las que cubre tu plan. Hacé click en "Sincronizar plan" para
                pasar al tramo correcto en el próximo cobro.
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Escala de precios</p>
              <div className="space-y-1.5">
                {BILLING_TIERS.map(t => {
                  const isCurrent = plan.tier?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${
                        isCurrent ? 'border-primary bg-primary/5 font-bold' : 'border-border bg-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="font-mono">{formatARS(t.priceARS)} / mes</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Todas las funciones disponibles en todos los tramos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {(status === 'trial' || status === 'cancelled' || status === 'pending') && (
                <Button onClick={handleCheckout} disabled={busy === 'checkout'} className="font-bold">
                  {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activar suscripción'}
                </Button>
              )}
              {status === 'past_due' && (
                <Button onClick={handleCheckout} disabled={busy === 'checkout'} className="font-bold">
                  {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar tarjeta'}
                </Button>
              )}
              {status === 'active' && (
                <>
                  <Button variant="outline" onClick={handleSync} disabled={busy === 'sync'} className="font-bold">
                    {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sincronizar plan'}
                  </Button>
                  <Button variant="ghost" onClick={handleCancel} disabled={busy === 'cancel'} className="font-bold text-destructive">
                    {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancelar suscripción'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
