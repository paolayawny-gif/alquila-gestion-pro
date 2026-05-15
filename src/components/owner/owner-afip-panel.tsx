'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  KeyRound, Upload, CheckCircle2, Loader2, AlertTriangle,
  Wifi, WifiOff, FileText, Send, RefreshCw, Building2, User2,
  ShieldCheck, HelpCircle, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authed-fetch';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { OwnerRegistryEntry } from './owner-portal';
import { Invoice } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';
const fmt = (n: number, cur = 'ARS') =>
  `${cur === 'USD' ? 'U$D' : '$'}${n.toLocaleString('es-AR')}`;

interface AfipStoredConfig {
  cuit:            string;
  puntoVenta:      number;
  tipoComprobante: number;
  environment:     'testing' | 'production';
  lastTestAt?:     string;
  lastTestStatus?: 'ok' | 'error';
  savedAt:         string;
}

interface OwnerAfipPanelProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerAfipPanel({ ownerEntry }: OwnerAfipPanelProps) {
  const db      = useFirestore();
  const { toast } = useToast();

  // ── Form state ────────────────────────────────────────────────────────────
  const [cuit,            setCuit]            = useState('');
  const [puntoVenta,      setPuntoVenta]      = useState('1');
  const [tipoComprobante, setTipoComprobante] = useState('6');  // 6=B, 11=C
  const [environment,     setEnvironment]     = useState<'testing' | 'production'>('testing');
  const [pfxFile,         setPfxFile]         = useState<File | null>(null);
  const [pfxPassword,     setPfxPassword]     = useState('');
  const [saving,          setSaving]          = useState(false);
  const [testing,         setTesting]         = useState(false);
  const [emittingId,      setEmittingId]      = useState<string | null>(null);
  const [storedConfig,    setStoredConfig]    = useState<AfipStoredConfig | null>(null);
  const [loadingConfig,   setLoadingConfig]   = useState(true);
  const [guideOpen,       setGuideOpen]       = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load stored config (non-sensitive fields from Firestore client) ───────
  const cfgQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'afip_configs');
  }, [db, ownerEntry.adminId]);

  // We read the doc directly via a one-shot getDocs approach via the query
  useEffect(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) { setLoadingConfig(false); return; }
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'afip_configs', ownerEntry.ownerEmail))
        .then(snap => {
          if (snap.exists()) {
            const d = snap.data() as AfipStoredConfig;
            setStoredConfig(d);
            setCuit(d.cuit);
            setPuntoVenta(String(d.puntoVenta));
            setTipoComprobante(String(d.tipoComprobante));
            setEnvironment(d.environment);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingConfig(false));
    });
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);

  // ── Invoices ──────────────────────────────────────────────────────────────
  const invQ = useMemoFirebase(() => {
    if (!db || !ownerEntry.adminId || !ownerEntry.ownerEmail) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'users', ownerEntry.adminId, 'facturas'),
      where('ownerEmail', '==', ownerEntry.ownerEmail),
    );
  }, [db, ownerEntry.adminId, ownerEntry.ownerEmail]);
  const { data: invRaw } = useCollection<Invoice>(invQ);
  const invoices = [...(invRaw ?? [])].sort((a, b) => b.dueDate?.localeCompare(a.dueDate ?? '') ?? 0);

  const pendingEmission = invoices.filter(
    i => !i.afipCae && (i.status === 'Pendiente' || i.status === 'Vencido' || i.status === 'Pagado' || i.status === 'Pago Informado'),
  );
  const emitted = invoices.filter(i => !!i.afipCae);

  // ── Save config ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!cuit || !puntoVenta) {
      toast({ title: 'Completá CUIT y Punto de Venta', variant: 'destructive' });
      return;
    }
    if (!storedConfig && !pfxFile) {
      toast({ title: 'Seleccioná el archivo .pfx', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let pfxBase64 = '';
      if (pfxFile) {
        const buf   = await pfxFile.arrayBuffer();
        pfxBase64   = btoa(String.fromCharCode(...new Uint8Array(buf)));
      }

      const res = await authedFetch('/api/afip/save-config', {
        method:  'POST',
        body:    JSON.stringify({
          adminId:         ownerEntry.adminId,
          ownerEmail:      ownerEntry.ownerEmail,
          cuit:            cuit.replace(/[^0-9]/g, ''),
          puntoVenta:      Number(puntoVenta),
          tipoComprobante: Number(tipoComprobante),
          pfxBase64,
          pfxPassword,
          environment,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStoredConfig(prev => ({
        ...(prev ?? {} as AfipStoredConfig),
        cuit: cuit.replace(/[^0-9]/g, ''),
        puntoVenta:      Number(puntoVenta),
        tipoComprobante: Number(tipoComprobante),
        environment,
        savedAt: new Date().toISOString(),
      }));
      setPfxFile(null);
      setPfxPassword('');
      toast({ title: '✅ Credenciales guardadas', description: 'Podés probar la conexión antes de emitir.' });
    } catch (e: any) {
      toast({ title: 'Error guardando', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Test connection ───────────────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    try {
      const res  = await authedFetch('/api/afip/test', {
        method:  'POST',
        body:    JSON.stringify({ adminId: ownerEntry.adminId, ownerEmail: ownerEntry.ownerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStoredConfig(prev => prev ? { ...prev, lastTestStatus: 'ok', lastTestAt: new Date().toISOString() } : prev);
      toast({ title: '✅ Conexión exitosa', description: `Webservice AFIP (${storedConfig?.environment}) respondió correctamente.` });
    } catch (e: any) {
      setStoredConfig(prev => prev ? { ...prev, lastTestStatus: 'error', lastTestAt: new Date().toISOString() } : prev);
      toast({ title: 'Error de conexión', description: e.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  // ── Emit invoice ──────────────────────────────────────────────────────────
  const handleEmit = async (inv: Invoice) => {
    if (!storedConfig) {
      toast({ title: 'Configurá AFIP primero', variant: 'destructive' });
      return;
    }
    setEmittingId(inv.id);
    try {
      const res  = await authedFetch('/api/afip/emit', {
        method:  'POST',
        body:    JSON.stringify({
          adminId:   ownerEntry.adminId,
          ownerEmail: ownerEntry.ownerEmail,
          invoiceId: inv.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title:       '✅ Factura emitida',
        description: `CAE ${data.cae} — N° ${data.nroComprobante}. Vence: ${data.caeFechaVto}`,
      });
    } catch (e: any) {
      toast({ title: 'Error emitiendo', description: e.message, variant: 'destructive' });
    }
    setEmittingId(null);
  };

  if (loadingConfig) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const tipoLabel = (t: number) => t === 11 ? 'Factura C (Monotributo)' : 'Factura B (Responsable Inscripto)';

  const GUIDE_STEPS = [
    {
      num: '1',
      title: 'Obtené tu certificado digital en AFIP',
      color: 'bg-blue-100 text-blue-700',
      items: [
        'Ingresá a arca.afip.gob.ar con tu CUIT y clave fiscal (nivel 3 o superior).',
        'En el menú, buscá "Administrador de Relaciones de Clave Fiscal".',
        'Hacé clic en "Adherir servicio", buscá wsfe (Web Service de Facturación Electrónica) y confirmá.',
        'Luego entrá a "Administración de Certificados Digitales" → "Nuevo certificado".',
        'Descargá el archivo resultante (.pfx o .p12) y guardá la contraseña que elegiste.',
      ],
      note: 'Este trámite es gratuito y tarda unos 10 minutos. Si ya facturás electrónicamente, probablemente ya tenés este archivo.',
    },
    {
      num: '2',
      title: 'Conocé tu Punto de Venta',
      color: 'bg-amber-100 text-amber-700',
      items: [
        'En el portal ARCA, entrá a "Comprobantes en línea" → "ABM Puntos de Venta".',
        'Si ya tenés uno creado para facturación electrónica, anotá su número (ej: 1, 2, 3).',
        'Si no tenés, creá uno nuevo de tipo "Web Services" (RECE).',
      ],
      note: 'El punto de venta es un número de 4 dígitos que identifica desde dónde emitís. Lo más común es el 0001.',
    },
    {
      num: '3',
      title: 'Elegí tu tipo de comprobante',
      color: 'bg-purple-100 text-purple-700',
      items: [
        'Factura B: si sos Responsable Inscripto ante el IVA.',
        'Factura C: si sos Monotributista.',
      ],
      note: 'Si no sabés cuál sos, podés verificarlo en tu constancia de inscripción de AFIP o consultando a tu contador.',
    },
    {
      num: '4',
      title: 'Configurá y probá la conexión',
      color: 'bg-emerald-100 text-emerald-700',
      items: [
        'Completá el formulario de esta pantalla con tu CUIT, punto de venta y tipo de comprobante.',
        'Subí el archivo .pfx y escribí su contraseña.',
        'Primero usá el ambiente "Homologación (pruebas)" para verificar que todo funcione.',
        'Hacé clic en "Guardar credenciales" y luego en "Probar conexión".',
        'Cuando veas "Webservice Conectado", cambiá a "Producción" y volvé a guardar.',
      ],
      note: 'Tus datos quedan cifrados en nuestros servidores. Nunca los compartimos ni los vemos.',
    },
    {
      num: '5',
      title: 'Emití tu primera factura',
      color: 'bg-teal-100 text-teal-700',
      items: [
        'Cuando la administración genere la liquidación mensual, aparecerá en "Facturas pendientes de emisión".',
        'Todos los datos (inquilino, inmueble, período, monto) vienen precargados.',
        'Hacé clic en "Emitir factura" — en segundos obtenés el CAE y queda registrado automáticamente.',
      ],
      note: 'El CAE (Código de Autorización Electrónico) es el comprobante de que AFIP autorizó tu factura.',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Portal Propietario</p>
        <h1 className="text-2xl font-black">Facturación AFIP</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Emití tus facturas electrónicas directamente desde la plataforma con los datos precargados.
        </p>
      </div>

      {/* ── Step-by-step guide ───────────────────────────────────────────── */}
      <Card className="border-none shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          onClick={() => setGuideOpen(v => !v)}
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-sm font-black">
              {storedConfig ? '¿Cómo funciona? Guía paso a paso' : '¿Es tu primera vez? Seguí estos pasos'}
            </span>
            {!storedConfig && (
              <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Recomendado</span>
            )}
          </div>
          {guideOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {guideOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground pt-4">
              Para emitir facturas electrónicas desde esta plataforma necesitás un certificado digital de AFIP.
              El proceso es gratuito y se hace una sola vez.
            </p>

            <div className="space-y-3">
              {GUIDE_STEPS.map(step => (
                <div key={step.num} className="flex gap-3">
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5', step.color)}>
                    {step.num}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-black">{step.title}</p>
                    <ul className="space-y-1">
                      {step.items.map((item, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <span className="shrink-0 mt-0.5 text-muted-foreground/40">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-muted/40 rounded-lg px-3 py-2 mt-1">
                      <p className="text-[10px] text-muted-foreground italic">{step.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://arca.afip.gob.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline mt-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ir al portal ARCA / AFIP
            </a>
          </div>
        )}
      </Card>

      {/* ── Config + Status grid ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Config card */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-black">Configuración API AFIP</p>
                <p className="text-[10px] text-muted-foreground">Una sola vez — tus datos quedan cifrados</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">CUIT del Propietario</Label>
                <Input
                  placeholder="20-XXXXXXXX-X"
                  value={cuit}
                  onChange={e => setCuit(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Punto de Venta</Label>
                <Input
                  placeholder="0001"
                  value={puntoVenta}
                  onChange={e => setPuntoVenta(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de comprobante</Label>
              <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Factura B — Responsable Inscripto</SelectItem>
                  <SelectItem value="11">Factura C — Monotributista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ambiente</Label>
              <Select value={environment} onValueChange={v => setEnvironment(v as 'testing' | 'production')}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="testing">Homologación (pruebas)</SelectItem>
                  <SelectItem value="production">Producción (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PFX upload */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Certificado Digital (.pfx)
                {storedConfig && <span className="ml-2 text-emerald-600 font-bold">· ya cargado</span>}
              </Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={e => setPfxFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'w-full border-2 border-dashed rounded-xl p-4 text-center text-xs transition-colors',
                  pfxFile
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600',
                )}
              >
                <Upload className="h-5 w-5 mx-auto mb-1.5 opacity-60" />
                {pfxFile ? pfxFile.name : (storedConfig ? 'Reemplazar certificado' : 'Arrastrá tu archivo o hacé clic')}
              </button>
            </div>

            {pfxFile && (
              <div className="space-y-1.5">
                <Label className="text-xs">Contraseña del certificado</Label>
                <Input
                  type="password"
                  placeholder="Contraseña del .pfx"
                  value={pfxPassword}
                  onChange={e => setPfxPassword(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 font-black gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Guardar credenciales
              </Button>
              {storedConfig && (
                <Button variant="outline" className="gap-2 font-bold" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Probar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status card */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Wifi className="h-4 w-4 text-blue-700" />
              </div>
              <p className="text-sm font-black">Estado del servicio</p>
            </div>

            {!storedConfig ? (
              <div className="py-8 text-center text-muted-foreground">
                <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Configurá tus credenciales para activar el servicio.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={cn(
                  'flex items-center gap-2 p-3 rounded-xl',
                  storedConfig.lastTestStatus === 'ok'
                    ? 'bg-emerald-50'
                    : storedConfig.lastTestStatus === 'error'
                      ? 'bg-red-50'
                      : 'bg-gray-50',
                )}>
                  {storedConfig.lastTestStatus === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : storedConfig.lastTestStatus === 'error' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <Wifi className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <div>
                    <p className={cn('text-xs font-black',
                      storedConfig.lastTestStatus === 'ok' ? 'text-emerald-700'
                      : storedConfig.lastTestStatus === 'error' ? 'text-red-700'
                      : 'text-gray-500'
                    )}>
                      {storedConfig.lastTestStatus === 'ok'
                        ? 'Webservice Conectado'
                        : storedConfig.lastTestStatus === 'error'
                          ? 'Error de conexión'
                          : 'Sin probar aún'}
                    </p>
                    {storedConfig.lastTestAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Último ping: {new Date(storedConfig.lastTestAt).toLocaleString('es-AR')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    { label: 'CUIT', value: storedConfig.cuit },
                    { label: 'Punto de Venta', value: String(storedConfig.puntoVenta).padStart(4, '0') },
                    { label: 'Tipo comprobante', value: tipoLabel(storedConfig.tipoComprobante) },
                    { label: 'Ambiente', value: storedConfig.environment === 'production' ? '🟢 Producción' : '🔵 Homologación' },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-bold">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pending emission ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">Facturas pendientes de emisión</h2>
          {pendingEmission.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-0">{pendingEmission.length} pendiente{pendingEmission.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>

        {!storedConfig && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 text-center">
            Configurá tus credenciales AFIP para poder emitir facturas desde aquí.
          </div>
        )}

        {storedConfig && pendingEmission.length === 0 && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-medium">Sin facturas pendientes de emisión</p>
              <p className="text-xs mt-1">Todas las facturas fueron emitidas.</p>
            </CardContent>
          </Card>
        )}

        {storedConfig && pendingEmission.map(inv => {
          const rentCharge = inv.charges?.find(c => c.type === 'Alquiler');
          const isEmitting = emittingId === inv.id;

          return (
            <Card key={inv.id} className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black capitalize">{inv.period}</p>
                    <p className="text-[11px] text-muted-foreground">{inv.propertyName}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User2 className="h-3 w-3" />{inv.tenantName}</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{tipoLabel(storedConfig.tipoComprobante)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <p className="text-sm font-black">{fmt(inv.totalAmount, inv.currency)}</p>
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 font-black gap-1.5 h-7 text-xs"
                      onClick={() => handleEmit(inv)}
                      disabled={isEmitting}
                    >
                      {isEmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      {isEmitting ? 'Emitiendo...' : 'Emitir factura'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Emission history ────────────────────────────────────────────────── */}
      {emitted.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black">Historial de emisiones</h2>
          <Card className="border-none shadow-sm overflow-hidden">
            <div className="divide-y divide-border/40">
              {emitted.map(inv => (
                <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black capitalize">{inv.period} — {inv.propertyName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">CAE: {inv.afipCae}</p>
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground shrink-0">
                    <p className="font-bold text-xs">{fmt(inv.totalAmount, inv.currency)}</p>
                    <p>Vto. CAE: {inv.afipCaeVto?.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
