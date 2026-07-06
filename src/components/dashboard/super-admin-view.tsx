import { APP_ID } from '@/lib/constants';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Crown, Building2, Users, Plus, CheckCircle2, Clock, XCircle,
  Trash2, RefreshCw, UserPlus, ShieldCheck, Eye, Pencil, ChevronRight,
  BarChart3, Home, DollarSign, TrendingUp, Activity, FileText, Wrench,
  LogOut, AlertTriangle, Target, Settings, CreditCard, EyeOff,
  Megaphone, Zap, Lightbulb, Send, Globe, TrendingDown, Banknote,
} from 'lucide-react';
import { tierForUnits } from '@/lib/billing/tiers';
import { CaptacionView } from '@/components/dashboard/captacion-view';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Anuncio, AnuncioType } from '@/lib/types';
import { createAnuncio, publishAnuncio, unpublishAnuncio, deleteAnuncio } from '@/lib/anuncios';
import { authedFetch } from '@/lib/authed-fetch';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  phone?: string;
  plan: 'Básico' | 'Profesional' | 'Enterprise';
  status: 'Activa' | 'Suspendida' | 'Pendiente';
  createdAt: string;
  notes?: string;
  maxProperties?: number;
  maxUsers?: number;
}

type OrgUserRole = 'Administrador' | 'Agente' | 'Solo lectura';

interface OrgUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: OrgUserRole;
  status: 'Activo' | 'Invitado' | 'Suspendido';
  addedAt: string;
}

interface CancelRequest {
  id: string;
  adminId: string;
  adminEmail: string;
  reason: string;
  notes?: string;
  requestedAt: string;
  status: 'pendiente' | 'procesada' | 'cancelada_por_usuario';
  processedAt?: string;
}

interface PortalPlusRequest {
  id: string; // = adminId
  adminId: string;
  adminEmail: string;
  adminName?: string;
  requestedAt: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  processedAt?: string;
}

const CANCEL_REASONS: Record<string, string> = {
  cambio_plataforma:  'Cambio de plataforma',
  sin_uso:            'Ya no necesita el servicio',
  precio:             'Precio no adecuado',
  problemas_tecnicos: 'Problemas técnicos',
  funcionalidades:    'Faltan funcionalidades',
  otro:               'Otro motivo',
};

interface SuperAdminViewProps {
  userId?: string;
  userEmail: string;
}

interface AdminStats {
  adminEmail: string;
  adminUid: string;
  lastSyncAt: string;
  propiedadesTotal: number;
  contratosVigentes: number;
  contratosProximos: number;
  facturasMes: number;
  liquidacionesMes: number;
  tareasAbiertas: number;
  tiposPropiedades: Record<string, number>;
  usoPropiedades: Record<string, number>;
  precioPromedioARS: number;
  precioPromedioUSD: number;
  superficiePromedio: number;
  ambientesPromedio: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLAN_CONFIG = {
  'Básico':       { color: 'bg-slate-100 text-slate-700',  maxProps: 10,  maxUsers: 1 },
  'Profesional':  { color: 'bg-blue-100 text-blue-700',    maxProps: 50,  maxUsers: 5 },
  'Enterprise':   { color: 'bg-amber-100 text-amber-700',  maxProps: 999, maxUsers: 999 },
};

const STATUS_CONFIG = {
  'Activa':      { color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  'Suspendida':  { color: 'bg-red-100 text-red-700',       icon: XCircle },
  'Pendiente':   { color: 'bg-orange-100 text-orange-700', icon: Clock },
};

const ROLE_CONFIG: Record<OrgUserRole, { color: string; desc: string }> = {
  'Administrador': { color: 'bg-primary/10 text-primary', desc: 'Acceso total: crear, editar, eliminar todo' },
  'Agente':        { color: 'bg-blue-100 text-blue-700',  desc: 'Puede gestionar propiedades, contratos y facturas. No puede eliminar.' },
  'Solo lectura':  { color: 'bg-slate-100 text-slate-600', desc: 'Solo puede ver los datos, sin modificaciones.' },
};

// ─── Portal Moderation Card ─────────────────────────────────────────────────

interface PortalListing {
  adminId: string;
  adminName: string;
  propertyId: string;
  name: string;
  address: string;
  status: string;
  portalBlocked: boolean;
  hasActiveContract: boolean;
  visible: boolean;
}

function PortalModerationCard() {
  const { toast } = useToast();
  const [listings, setListings] = useState<PortalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/portal/moderate');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings ?? []);
      }
    } catch { /* sin conexión */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moderate = async (l: PortalListing, action: 'block' | 'unblock' | 'unpublish') => {
    setBusy(`${l.adminId}/${l.propertyId}`);
    try {
      const res = await authedFetch('/api/portal/moderate', {
        method: 'POST',
        body: JSON.stringify({ adminId: l.adminId, propertyId: l.propertyId, action }),
      });
      if (res.ok) {
        toast({
          title: action === 'block' ? 'Publicación suspendida'
            : action === 'unblock' ? 'Publicación reactivada'
            : 'Publicación quitada del portal',
        });
        await load();
      } else {
        toast({ title: 'Error', description: 'No se pudo aplicar la acción.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo aplicar la acción.', variant: 'destructive' });
    }
    setBusy(null);
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100">
              <Globe className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-black">Moderación del Portal</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Todas las publicaciones de la vidriera pública — suspendé o quitá las que correspondan.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Cargando publicaciones...</p>
        ) : listings.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No hay publicaciones activas en el portal.</p>
        ) : (
          listings.map(l => {
            const key = `${l.adminId}/${l.propertyId}`;
            const isBusy = busy === key;
            return (
              <div key={key} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate">{l.name}</p>
                    {l.portalBlocked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Suspendida</span>
                    ) : l.visible ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Visible</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                        {l.hasActiveContract ? 'Con contrato' : `Estado: ${l.status}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {l.address} · {l.adminName}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {l.portalBlocked ? (
                    <Button size="sm" className="text-xs h-7 font-bold bg-emerald-600 hover:bg-emerald-700"
                      disabled={isBusy} onClick={() => moderate(l, 'unblock')}>
                      Reactivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-7 font-bold text-amber-700"
                      disabled={isBusy} onClick={() => moderate(l, 'block')}>
                      Suspender
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7 font-bold text-destructive"
                    disabled={isBusy} onClick={() => moderate(l, 'unpublish')}>
                    Quitar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminView({ userId, userEmail }: SuperAdminViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isSuperAdmin } = useUser();

  // — Vista principal —
  const [mainView, setMainView] = useState<'orgs' | 'captacion' | 'config' | 'novedades'>('orgs');

  // — Anuncios state —
  const [anuncioForm, setAnuncioForm] = useState({ title: '', body: '', type: 'novedad' as AnuncioType });
  const [isSavingAnuncio, setIsSavingAnuncio] = useState(false);

  // — Org state —
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: '', ownerEmail: '', ownerName: '', phone: '',
    plan: 'Profesional' as Organization['plan'], notes: '',
  });

  // — User state —
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '', name: '', role: 'Agente' as OrgUserRole,
  });

  // — Email config state —
  const [emailForm, setEmailForm] = useState({ emailUser: '', emailPass: '' });
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // — MP platform config state —
  const [mpConfigForm, setMpConfigForm] = useState({ mpAccessToken: '', mpWebhookSecret: '' });
  const [isSavingMpConfig, setIsSavingMpConfig] = useState(false);
  const [showMpToken, setShowMpToken] = useState(false);
  const [showMpSecret, setShowMpSecret] = useState(false);

  // — Custom claims state —
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsResult, setClaimsResult] = useState('');

  // — Load organizations —
  const orgsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'));
  }, [db, user]);
  const { data: orgsData } = useCollection<Organization>(orgsQuery);
  const organizations: Organization[] = orgsData || [];

  // — Load users for selected org —
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedOrg) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'));
  }, [db, user, selectedOrg]);
  const { data: allUsersData } = useCollection<OrgUser>(usersQuery);
  const orgUsers = (allUsersData || []).filter(u => u.orgId === selectedOrg?.id);

  // — Load admin stats —
  const statsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'adminStats'));
  }, [db, user]);
  const { data: allStatsData } = useCollection<AdminStats>(statsQuery);
  const allStats: AdminStats[] = allStatsData || [];

  // — Load cancel requests —
  const cancelQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'cancelRequests'));
  }, [db, user]);
  const { data: cancelData } = useCollection<CancelRequest>(cancelQuery);
  const cancelRequests: CancelRequest[] = cancelData || [];
  const pendingCancelCount = cancelRequests.filter(r => r.status === 'pendiente').length;

  // — Load Portal Plus requests —
  const portalPlusQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'portalPlusRequests'));
  }, [db, user]);
  const { data: portalPlusData } = useCollection<PortalPlusRequest>(portalPlusQuery);
  const portalPlusRequests: PortalPlusRequest[] = portalPlusData || [];
  const pendingPortalPlusCount = portalPlusRequests.filter(r => r.status === 'pendiente').length;

  // — Load anuncios —
  const anunciosQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'artifacts', APP_ID, 'anuncios'),
      orderBy('createdAt', 'desc'),
    );
  }, [db, user]);
  const { data: anunciosData } = useCollection<Anuncio>(anunciosQuery);
  const anuncios: Anuncio[] = anunciosData || [];

  // Recordatorio: días desde el último anuncio publicado
  const diasDesdeUltimoAnuncio = useMemo(() => {
    const published = anuncios.filter(a => a.isPublished);
    if (!published.length) return null;
    const last = new Date(published[0].publishedAt);
    return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [anuncios]);

  // Cargar credenciales MP existentes desde Firestore
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'artifacts', APP_ID, 'superadmin', 'platformConfig'))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setMpConfigForm({
            mpAccessToken: d.mpAccessToken || '',
            mpWebhookSecret: d.mpWebhookSecret || '',
          });
        }
      })
      .catch(() => {});
  }, [db]);

  // Stats del org seleccionado
  const selectedOrgStats = useMemo(() => {
    if (!selectedOrg) return null;
    return allStats.find(s => s.adminEmail === selectedOrg.ownerEmail) ?? null;
  }, [allStats, selectedOrg]);

  // Stats por org y agregados globales — deben estar ANTES de cualquier return condicional
  const stats = useMemo(() => ({
    total:      organizations.length,
    active:     organizations.filter(o => o.status === 'Activa').length,
    pending:    organizations.filter(o => o.status === 'Pendiente').length,
    enterprise: organizations.filter(o => o.plan === 'Enterprise').length,
  }), [organizations]);

  // Agregados globales de plataforma
  const platformStats = useMemo(() => {
    const totalProps   = allStats.reduce((s, a) => s + (a.propiedadesTotal  || 0), 0);
    const totalContratos = allStats.reduce((s, a) => s + (a.contratosVigentes || 0), 0);
    const totalTareas  = allStats.reduce((s, a) => s + (a.tareasAbiertas    || 0), 0);

    // Tipos de propiedades globales
    const tipos: Record<string, number> = {};
    allStats.forEach(a => {
      Object.entries(a.tiposPropiedades || {}).forEach(([k, v]) => {
        tipos[k] = (tipos[k] || 0) + v;
      });
    });

    // Precio promedio ponderado global
    const arsAdmins = allStats.filter(a => a.precioPromedioARS > 0);
    const usdAdmins = allStats.filter(a => a.precioPromedioUSD > 0);
    const promedioARS = arsAdmins.length
      ? Math.round(arsAdmins.reduce((s, a) => s + a.precioPromedioARS, 0) / arsAdmins.length) : 0;
    const promedioUSD = usdAdmins.length
      ? Math.round(usdAdmins.reduce((s, a) => s + a.precioPromedioUSD, 0) / usdAdmins.length) : 0;

    return { totalProps, totalContratos, totalTareas, tipos, promedioARS, promedioUSD };
  }, [allStats]);

  // ── Métricas SaaS (MRR, churn, nuevas orgs) ───────────────────────────────
  const saasMetrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // MRR: por cada org activa, tomamos sus contratos vigentes y calculamos el tier
    const mrr = organizations
      .filter(o => o.status === 'Activa')
      .reduce((sum, org) => {
        const stat = allStats.find(s => s.adminEmail === org.ownerEmail);
        const units = stat?.contratosVigentes ?? 0;
        return sum + tierForUnits(units).priceARS;
      }, 0);

    // Orgs nuevas este mes
    const nuevasEsteMes = organizations.filter(o => o.createdAt >= startOfMonth).length;

    // Bajas procesadas este mes (proxy de churn)
    const bajasEsteMes = cancelRequests.filter(
      r => r.status === 'procesada' && (r.processedAt ?? '') >= startOfMonth,
    ).length;

    // Churn rate aproximado: bajas / orgs activas al inicio del mes
    // (simplificado: bajas / total activas actuales)
    const activeCount = organizations.filter(o => o.status === 'Activa').length;
    const churnRate = activeCount > 0 ? Math.round((bajasEsteMes / activeCount) * 100) : 0;

    // Orgs sin actividad registrada (posible riesgo de churn)
    const orgsInactivas = organizations
      .filter(o => o.status === 'Activa')
      .filter(o => !allStats.find(s => s.adminEmail === o.ownerEmail)).length;

    return { mrr, nuevasEsteMes, bajasEsteMes, churnRate, orgsInactivas };
  }, [organizations, allStats, cancelRequests]);

  // Access guard
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 rounded-full"><XCircle className="h-12 w-12 text-red-500" /></div>
        <h2 className="text-xl font-black">Acceso Restringido</h2>
        <p className="text-muted-foreground text-sm">Esta sección es exclusiva del Super Administrador.</p>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateAnuncio = async () => {
    if (!anuncioForm.title.trim() || !anuncioForm.body.trim()) {
      toast({ title: 'Faltan datos', description: 'El título y el contenido son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!db) return;
    setIsSavingAnuncio(true);
    try {
      createAnuncio(db, { title: anuncioForm.title.trim(), body: anuncioForm.body.trim(), type: anuncioForm.type });
      setAnuncioForm({ title: '', body: '', type: 'novedad' });
      toast({ title: 'Anuncio guardado', description: 'Publicalo cuando esté listo.' });
    } finally {
      setIsSavingAnuncio(false);
    }
  };

  const handlePublishAnuncio = (anuncio: Anuncio) => {
    if (!db) return;
    publishAnuncio(db, anuncio.id);
    toast({ title: '✅ Publicado', description: `"${anuncio.title}" ya es visible para todos los usuarios.` });
  };

  const handleUnpublishAnuncio = (anuncio: Anuncio) => {
    if (!db) return;
    unpublishAnuncio(db, anuncio.id);
    toast({ title: 'Despublicado', description: `"${anuncio.title}" dejó de ser visible.` });
  };

  const handleDeleteAnuncio = (anuncio: Anuncio) => {
    if (!db) return;
    deleteAnuncio(db, anuncio.id);
    toast({ title: 'Eliminado', description: `"${anuncio.title}" fue eliminado.` });
  };

  const handleCreateAnuncioAndPublish = async () => {
    if (!anuncioForm.title.trim() || !anuncioForm.body.trim()) {
      toast({ title: 'Faltan datos', description: 'El título y el contenido son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!db) return;
    setIsSavingAnuncio(true);
    try {
      const a = createAnuncio(db, { title: anuncioForm.title.trim(), body: anuncioForm.body.trim(), type: anuncioForm.type });
      publishAnuncio(db, a.id);
      setAnuncioForm({ title: '', body: '', type: 'novedad' });
      toast({ title: '🚀 Publicado', description: 'El anuncio ya es visible para todos los usuarios.' });
    } finally {
      setIsSavingAnuncio(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!orgForm.name || !orgForm.ownerEmail) {
      toast({ title: 'Faltan datos', description: 'Nombre e email del responsable son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!db) {
      toast({ title: 'Error de conexión', description: 'Recargá la página e intentá de nuevo.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const id = `org_${Date.now()}`;
      const planCfg = PLAN_CONFIG[orgForm.plan];
      const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), id);
      setDocumentNonBlocking(ref, {
        id,
        name: orgForm.name,
        ownerEmail: orgForm.ownerEmail.toLowerCase().trim(),
        ownerName: orgForm.ownerName,
        phone: orgForm.phone || undefined,
        plan: orgForm.plan,
        status: 'Pendiente',
        createdAt: new Date().toISOString(),
        notes: orgForm.notes || undefined,
        maxProperties: planCfg.maxProps,
        maxUsers: planCfg.maxUsers,
      } as Organization, {});
      toast({ title: '✅ Organización creada', description: `${orgForm.name} — Plan ${orgForm.plan} — Estado: Pendiente` });
      setOrgForm({ name: '', ownerEmail: '', ownerName: '', phone: '', plan: 'Profesional', notes: '' });
      setShowNewOrgDialog(false);
    } catch (err: any) {
      toast({ title: 'Error al crear', description: err?.message ?? 'Algo salió mal.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeOrgStatus = (org: Organization, status: Organization['status']) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    setDocumentNonBlocking(ref, { status }, { merge: true });
    if (selectedOrg?.id === org.id) setSelectedOrg({ ...org, status });
    toast({ title: `Estado actualizado`, description: `${org.name} → ${status}` });

    // Enviar email de bienvenida la primera vez que se activa la org
    if (status === 'Activa' && org.status !== 'Activa' && !(org as any).welcomeEmailSentAt) {
      fetch('/api/superadmin/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, callerEmail: userEmail }),
      })
        .then(r => r.json())
        .then(r => {
          if (r.ok && !r.skipped) {
            toast({ title: '📧 Email de bienvenida enviado', description: `Se notificó a ${org.ownerEmail}` });
          }
        })
        .catch(() => {});
    }
  };

  const handleDeleteOrg = (org: Organization) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    deleteDocumentNonBlocking(ref);
    setSelectedOrg(null);
    toast({ title: 'Organización eliminada', description: org.name });
  };

  const handleAddUser = async () => {
    if (!userForm.email || !selectedOrg) {
      toast({ title: 'Email requerido', variant: 'destructive' }); return;
    }
    if (!db) {
      toast({ title: 'Error de conexión', variant: 'destructive' }); return;
    }
    // Check max users
    const currentCount = orgUsers.filter(u => u.status !== 'Suspendido').length;
    const maxUsers = PLAN_CONFIG[selectedOrg.plan].maxUsers;
    if (currentCount >= maxUsers) {
      toast({ title: `Límite de usuarios alcanzado`, description: `El plan ${selectedOrg.plan} permite hasta ${maxUsers} usuario(s). Actualizá el plan.`, variant: 'destructive' });
      return;
    }
    setIsSavingUser(true);
    try {
      const id = `orguser_${Date.now()}`;
      const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), id);
      setDocumentNonBlocking(ref, {
        id,
        orgId: selectedOrg.id,
        email: userForm.email.toLowerCase().trim(),
        name: userForm.name,
        role: userForm.role,
        status: 'Invitado',
        addedAt: new Date().toISOString(),
      } as OrgUser, {});
      toast({ title: '✅ Usuario agregado', description: `${userForm.email} — Rol: ${userForm.role}` });
      setUserForm({ email: '', name: '', role: 'Agente' });
      setShowAddUserDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo agregar el usuario.', variant: 'destructive' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleChangeUserRole = (orgUser: OrgUser, role: OrgUserRole) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    setDocumentNonBlocking(ref, { role }, { merge: true });
    toast({ title: 'Rol actualizado', description: `${orgUser.email} → ${role}` });
  };

  const handleToggleUserStatus = (orgUser: OrgUser) => {
    if (!db) return;
    const newStatus = orgUser.status === 'Suspendido' ? 'Activo' : 'Suspendido';
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    setDocumentNonBlocking(ref, { status: newStatus }, { merge: true });
    toast({ title: `Usuario ${newStatus}`, description: orgUser.email });
  };

  const handleSetClaims = async () => {
    setClaimsLoading(true);
    setClaimsResult('');
    try {
      const res = await authedFetch('/api/superadmin/set-custom-claims', { method: 'POST' });
      const data = await res.json();
      setClaimsResult(data.ok ? '✅ Claim activado. Cerrá sesión y volvé a entrar para que tome efecto.' : (data.error || 'Error desconocido'));
    } catch {
      setClaimsResult('❌ Error al activar el claim');
    } finally {
      setClaimsLoading(false);
    }
  };

  const handleSaveMpConfig = () => {
    if (!db) return;
    setIsSavingMpConfig(true);
    const ref = doc(db, 'artifacts', APP_ID, 'superadmin', 'platformConfig');
    setDocumentNonBlocking(ref, {
      mpAccessToken: mpConfigForm.mpAccessToken.trim(),
      mpWebhookSecret: mpConfigForm.mpWebhookSecret.trim() || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    toast({
      title: '✅ Credenciales guardadas',
      description: 'Las claves de MercadoPago se actualizaron. El servidor las recarga en hasta 5 minutos.',
    });
    setIsSavingMpConfig(false);
  };

  const handleSaveEmailConfig = () => {
    if (!db || !selectedOrg) return;
    setIsSavingEmail(true);
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), selectedOrg.id);
    setDocumentNonBlocking(ref, {
      emailUser: emailForm.emailUser.trim() || null,
      emailPass: emailForm.emailPass.trim() || null,
    }, { merge: true });
    toast({ title: '✅ Email configurado', description: emailForm.emailUser ? `Correos saldrán desde ${emailForm.emailUser}` : 'Se usará el email de la plataforma.' });
    setIsSavingEmail(false);
  };

  const handleDeleteUser = (orgUser: OrgUser) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    deleteDocumentNonBlocking(ref);
    toast({ title: 'Usuario eliminado', description: orgUser.email });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl"><Crown className="h-6 w-6 text-amber-600" /></div>
          <div>
            <h2 className="text-2xl font-black">Panel Super Admin</h2>
            <p className="text-sm text-muted-foreground">Gestión de organizaciones — AlquilaGestión Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-0.5 gap-0.5">
            <button
              onClick={() => setMainView('orgs')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5',
                mainView === 'orgs' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Building2 className="h-3.5 w-3.5" /> Organizaciones
            </button>
            <button
              onClick={() => setMainView('captacion')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5',
                mainView === 'captacion' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Target className="h-3.5 w-3.5" /> Captación de Clientes
            </button>
            <button
              onClick={() => setMainView('config')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5',
                mainView === 'config' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Settings className="h-3.5 w-3.5" /> Configuración
            </button>
            <button
              onClick={() => setMainView('novedades')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 relative',
                mainView === 'novedades' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <Megaphone className="h-3.5 w-3.5" /> Novedades
              {diasDesdeUltimoAnuncio !== null && diasDesdeUltimoAnuncio >= 30 && mainView !== 'novedades' && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border border-white" />
              )}
              {diasDesdeUltimoAnuncio === null && anuncios.length === 0 && mainView !== 'novedades' && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border border-white" />
              )}
            </button>
          </div>
          {mainView === 'orgs' && (
            <Button onClick={() => setShowNewOrgDialog(true)} className="bg-primary text-white gap-2 font-bold">
              <Plus className="h-4 w-4" /> Nueva Organización
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Building2, color: 'text-primary' },
          { label: 'Activas', value: stats.active, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-orange-500' },
          { label: 'Enterprise', value: stats.enterprise, icon: Crown, color: 'text-amber-600' },
          { label: 'Bajas pendientes', value: pendingCancelCount, icon: LogOut, color: pendingCancelCount > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map(k => (
          <Card key={k.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted/30 rounded-lg"><k.icon className={cn('h-5 w-5', k.color)} /></div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{k.label}</p>
                <p className="text-2xl font-black">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vista Captación de Clientes */}
      {mainView === 'captacion' && (
        <CaptacionView userId={userId} />
      )}

      {/* ── Vista Configuración ── */}
      {mainView === 'config' && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Cobro por suscripción — MercadoPago
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Credenciales de tu cuenta de MercadoPago para cobrar la suscripción mensual a los admins.
              Si configurás credenciales acá tienen prioridad sobre las variables de entorno de Vercel.
              El servidor las recarga automáticamente en hasta 5 minutos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="mp-access-token" className="text-xs font-bold uppercase">Access Token</Label>
              <div className="relative">
                <input
                  id="mp-access-token"
                  type={showMpToken ? 'text' : 'password'}
                  placeholder="APP_USR-... o TEST-..."
                  value={mpConfigForm.mpAccessToken}
                  onChange={e => setMpConfigForm({ ...mpConfigForm, mpAccessToken: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowMpToken(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showMpToken ? 'Ocultar Access Token' : 'Mostrar Access Token'}
                >
                  {showMpToken ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Obtené tu Access Token en <strong>mercadopago.com.ar/developers → Tus integraciones → [tu app]</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-webhook-secret" className="text-xs font-bold uppercase">Webhook Secret <span className="font-normal normal-case text-muted-foreground">(opcional)</span></Label>
              <div className="relative">
                <input
                  id="mp-webhook-secret"
                  type={showMpSecret ? 'text' : 'password'}
                  placeholder="Clave secreta para validar firma de webhooks"
                  value={mpConfigForm.mpWebhookSecret}
                  onChange={e => setMpConfigForm({ ...mpConfigForm, mpWebhookSecret: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-xs font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowMpSecret(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showMpSecret ? 'Ocultar Webhook Secret' : 'Mostrar Webhook Secret'}
                >
                  {showMpSecret ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Generalo en Dashboard MP → Webhooks → Clave secreta
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5" /> URL del webhook para configurar en MercadoPago
              </p>
              <p className="font-mono break-all text-[11px]">https://alquilagestion.pro/api/billing/webhook</p>
              <p className="text-[11px] opacity-75">
                Dashboard MP → Tus integraciones → [tu app] → Webhooks → Agregar URL
              </p>
            </div>

            <Button
              onClick={handleSaveMpConfig}
              disabled={isSavingMpConfig || !mpConfigForm.mpAccessToken.trim()}
              className="bg-primary text-white gap-2 font-bold"
            >
              {isSavingMpConfig
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />}
              Guardar credenciales
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Seguridad — Custom Claims ── */}
      {mainView === 'config' && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Seguridad — Custom Claim Superadmin
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Establece el claim <code className="font-mono bg-muted px-1 rounded">superAdmin: true</code> en tu cuenta Firebase.
              Solo necesita hacerse una vez. Después las reglas de Firestore dejarán de depender del UID hardcodeado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSetClaims}
              disabled={claimsLoading}
              variant="outline"
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {claimsLoading
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <ShieldCheck className="h-4 w-4" />}
              Activar Custom Claim
            </Button>
            {claimsResult && (
              <p className="text-xs mt-3 text-muted-foreground">{claimsResult}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Vista Organizaciones ── */}
      {mainView === 'orgs' && <>

      {/* ── Métricas SaaS ── */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" /> Métricas del negocio
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">Este mes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: 'MRR estimado',
                value: `$${Math.round(saasMetrics.mrr / 1000)}K`,
                sub: 'ARS / mes',
                icon: DollarSign,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Orgs nuevas',
                value: saasMetrics.nuevasEsteMes,
                sub: 'altas este mes',
                icon: TrendingUp,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                label: 'Bajas procesadas',
                value: saasMetrics.bajasEsteMes,
                sub: 'este mes',
                icon: TrendingDown,
                color: saasMetrics.bajasEsteMes > 0 ? 'text-red-600' : 'text-muted-foreground',
                bg: saasMetrics.bajasEsteMes > 0 ? 'bg-red-50' : 'bg-muted/30',
              },
              {
                label: 'Churn rate',
                value: `${saasMetrics.churnRate}%`,
                sub: 'sobre activas',
                icon: Activity,
                color: saasMetrics.churnRate > 5 ? 'text-red-600' : saasMetrics.churnRate > 0 ? 'text-amber-600' : 'text-green-600',
                bg: saasMetrics.churnRate > 5 ? 'bg-red-50' : saasMetrics.churnRate > 0 ? 'bg-amber-50' : 'bg-green-50',
              },
              {
                label: 'Sin actividad',
                value: saasMetrics.orgsInactivas,
                sub: 'riesgo churn',
                icon: AlertTriangle,
                color: saasMetrics.orgsInactivas > 0 ? 'text-amber-600' : 'text-muted-foreground',
                bg: saasMetrics.orgsInactivas > 0 ? 'bg-amber-50' : 'bg-muted/30',
              },
            ].map(k => (
              <div key={k.label} className={cn('rounded-xl p-3 flex items-center gap-2.5', k.bg)}>
                <div className="p-1.5 bg-white rounded-lg shrink-0">
                  <k.icon className={cn('h-4 w-4', k.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase text-muted-foreground leading-none">{k.label}</p>
                  <p className={cn('text-sm font-black mt-0.5 truncate', k.color)}>{k.value}</p>
                  <p className="text-[9px] text-muted-foreground">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Métricas globales de plataforma */}
      {allStats.length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Métricas globales de la plataforma
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                {allStats.length} admin{allStats.length !== 1 ? 's' : ''} con datos
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {[
                { label: 'Props. totales',    value: platformStats.totalProps,     icon: Home,       color: 'text-blue-600' },
                { label: 'Contratos vigentes',value: platformStats.totalContratos, icon: FileText,   color: 'text-green-600' },
                { label: 'Tareas abiertas',   value: platformStats.totalTareas,    icon: Wrench,     color: 'text-orange-500' },
                { label: 'Promedio ARS',      value: formatCurrency(platformStats.promedioARS), icon: DollarSign, color: 'text-emerald-600', isText: true },
                { label: 'Promedio USD',      value: platformStats.promedioUSD > 0 ? `US$ ${platformStats.promedioUSD.toLocaleString('es-AR')}` : '—', icon: TrendingUp, color: 'text-cyan-600', isText: true },
                { label: 'Admins activos',    value: allStats.length,              icon: Activity,   color: 'text-purple-600' },
              ].map(k => (
                <div key={k.label} className="bg-muted/30 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="p-1.5 bg-white rounded-lg shrink-0">
                    <k.icon className={cn('h-4 w-4', k.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase text-muted-foreground leading-none">{k.label}</p>
                    <p className="text-sm font-black mt-0.5 truncate">{k.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Distribución por tipo de propiedad */}
            {Object.keys(platformStats.tipos).length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Distribución por tipo</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(platformStats.tipos)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tipo, count]) => (
                      <div key={tipo} className="flex items-center gap-1.5 bg-muted/40 rounded-full px-3 py-1">
                        <span className="text-xs font-bold">{tipo}</span>
                        <span className="text-[11px] font-black text-primary">{count}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({Math.round((count / platformStats.totalProps) * 100)}%)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main content: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: org list */}
        <Card className="border-none shadow-sm bg-white lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Organizaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {organizations.length === 0 ? (
              <div className="py-12 text-center space-y-3 px-4">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Sin organizaciones aún</p>
                <Button size="sm" variant="outline" onClick={() => setShowNewOrgDialog(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Crear primera
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {organizations.map(org => {
                  const StatusIcon = STATUS_CONFIG[org.status].icon;
                  return (
                    <button key={org.id} onClick={() => setSelectedOrg(org)}
                      className={cn('w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3',
                        selectedOrg?.id === org.id && 'bg-primary/5 border-l-2 border-primary')}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{org.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className={cn('text-[9px] px-1.5 py-0 border-0 font-bold', STATUS_CONFIG[org.status].color)}>
                            {org.status}
                          </Badge>
                          <Badge className={cn('text-[9px] px-1.5 py-0 border-0 font-bold', PLAN_CONFIG[org.plan].color)}>
                            {org.plan}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: org detail */}
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          {!selectedOrg ? (
            <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Seleccioná una organización para ver sus detalles y usuarios</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedOrg.name}</CardTitle>
                    <CardDescription>{selectedOrg.ownerEmail}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={cn('font-bold border-0', STATUS_CONFIG[selectedOrg.status].color)}>{selectedOrg.status}</Badge>
                    <Badge className={cn('font-bold border-0', PLAN_CONFIG[selectedOrg.plan].color)}>{selectedOrg.plan}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="info">
                  <TabsList className="bg-muted/40 mb-4">
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="metricas" className="gap-1">
                      <BarChart3 className="h-3 w-3" /> Métricas
                    </TabsTrigger>
                    <TabsTrigger value="users">
                      Usuarios ({orgUsers.length}/{PLAN_CONFIG[selectedOrg.plan].maxUsers === 999 ? '∞' : PLAN_CONFIG[selectedOrg.plan].maxUsers})
                    </TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                  </TabsList>

                  {/* Info tab */}
                  <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: 'Responsable', value: selectedOrg.ownerName || '—' },
                        { label: 'Email', value: selectedOrg.ownerEmail },
                        { label: 'Teléfono', value: selectedOrg.phone || '—' },
                        { label: 'Alta', value: new Date(selectedOrg.createdAt).toLocaleDateString('es-AR') },
                        { label: 'Props. máx', value: String(selectedOrg.maxProperties) },
                        { label: 'Usuarios máx', value: selectedOrg.maxUsers === 999 ? 'Ilimitado' : String(selectedOrg.maxUsers) },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">{item.label}</p>
                          <p className="font-semibold truncate">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedOrg.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">{selectedOrg.notes}</div>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase text-muted-foreground">Cambiar estado</p>
                      <div className="flex gap-2 flex-wrap">
                        {(['Activa', 'Pendiente', 'Suspendida'] as Organization['status'][]).map(s => (
                          <Button key={s} size="sm" variant={selectedOrg.status === s ? 'default' : 'outline'}
                            className={cn('text-xs font-bold', selectedOrg.status === s && 'bg-primary text-white')}
                            onClick={() => handleChangeOrgStatus(selectedOrg, s)}>
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <Button variant="ghost" size="sm" className="text-red-600 gap-2 w-full justify-start"
                      onClick={() => handleDeleteOrg(selectedOrg)}>
                      <Trash2 className="h-4 w-4" /> Eliminar organización permanentemente
                    </Button>
                  </TabsContent>

                  {/* Métricas tab */}
                  <TabsContent value="metricas" className="space-y-4">
                    {!selectedOrgStats ? (
                      <div className="py-10 text-center space-y-2 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto opacity-30" />
                        <p className="text-sm">Sin datos todavía.</p>
                        <p className="text-[11px]">Las métricas se publican automáticamente la próxima vez que el administrador inicie sesión.</p>
                      </div>
                    ) : (
                      <>
                        {/* Última actividad */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                          <span className="font-bold">Última actividad</span>
                          <span>{new Date(selectedOrgStats.lastSyncAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>

                        {/* KPIs de uso */}
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Actividad operativa</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Propiedades', value: selectedOrgStats.propiedadesTotal, icon: Home, color: 'text-blue-600' },
                              { label: 'Contratos vigentes', value: selectedOrgStats.contratosVigentes, icon: FileText, color: 'text-green-600' },
                              { label: 'Próx. a vencer', value: selectedOrgStats.contratosProximos, icon: Clock, color: 'text-orange-500' },
                              { label: 'Facturas/mes', value: selectedOrgStats.facturasMes, icon: DollarSign, color: 'text-emerald-600' },
                              { label: 'Liquidac./mes', value: selectedOrgStats.liquidacionesMes, icon: TrendingUp, color: 'text-cyan-600' },
                              { label: 'Tareas abiertas', value: selectedOrgStats.tareasAbiertas, icon: Wrench, color: 'text-red-500' },
                            ].map(k => (
                              <div key={k.label} className="bg-muted/30 rounded-xl p-2.5 text-center">
                                <k.icon className={cn('h-4 w-4 mx-auto mb-1', k.color)} />
                                <p className="text-lg font-black leading-none">{k.value}</p>
                                <p className="text-[9px] font-bold text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Tipos de propiedad */}
                        {Object.keys(selectedOrgStats.tiposPropiedades || {}).length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Composición de cartera</p>
                            <div className="space-y-1.5">
                              {Object.entries(selectedOrgStats.tiposPropiedades)
                                .sort((a, b) => b[1] - a[1])
                                .map(([tipo, count]) => {
                                  const pct = selectedOrgStats.propiedadesTotal > 0
                                    ? Math.round((count / selectedOrgStats.propiedadesTotal) * 100) : 0;
                                  return (
                                    <div key={tipo} className="flex items-center gap-2">
                                      <span className="text-xs font-bold w-28 shrink-0">{tipo}</span>
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-xs font-black w-6 text-right">{count}</span>
                                      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        <Separator />

                        {/* Precios promedio */}
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Precios promedio (contratos vigentes)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Alquiler ARS</p>
                              <p className="text-base font-black text-emerald-800">
                                {selectedOrgStats.precioPromedioARS > 0 ? formatCurrency(selectedOrgStats.precioPromedioARS) : '—'}
                              </p>
                            </div>
                            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-bold text-cyan-700 uppercase mb-1">Alquiler USD</p>
                              <p className="text-base font-black text-cyan-800">
                                {selectedOrgStats.precioPromedioUSD > 0 ? `US$ ${selectedOrgStats.precioPromedioUSD.toLocaleString('es-AR')}` : '—'}
                              </p>
                            </div>
                          </div>
                          {(selectedOrgStats.superficiePromedio > 0 || selectedOrgStats.ambientesPromedio > 0) && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="bg-muted/40 rounded-xl p-3 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Superficie prom.</p>
                                <p className="text-base font-black">
                                  {selectedOrgStats.superficiePromedio > 0 ? `${selectedOrgStats.superficiePromedio} m²` : '—'}
                                </p>
                              </div>
                              <div className="bg-muted/40 rounded-xl p-3 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Ambientes prom.</p>
                                <p className="text-base font-black">
                                  {selectedOrgStats.ambientesPromedio > 0 ? selectedOrgStats.ambientesPromedio : '—'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Email tab */}
                  <TabsContent value="email" className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
                      <strong>Por defecto</strong>: los correos salen desde <code>alquilaGestionpro@gmail.com</code> con el nombre de tu organización,
                      y el cliente responde directamente a <strong>{selectedOrg.ownerEmail}</strong>.
                      <br /><br />
                      Si preferís que los correos salgan desde tu propio Gmail, cargá tus credenciales aquí.
                      Necesitás activar <strong>Contraseña de aplicación</strong> en tu cuenta Google.
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase">Gmail de la organización (opcional)</Label>
                        <Input type="email" placeholder="miinmobiliaria@gmail.com"
                          defaultValue={(selectedOrg as any).emailUser ?? ''}
                          onChange={e => setEmailForm(f => ({ ...f, emailUser: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase">Contraseña de aplicación Google</Label>
                        <Input type="password" placeholder="xxxx xxxx xxxx xxxx"
                          defaultValue={(selectedOrg as any).emailPass ?? ''}
                          onChange={e => setEmailForm(f => ({ ...f, emailPass: e.target.value }))} />
                        <p className="text-[10px] text-muted-foreground">
                          Generala en: Cuenta Google → Seguridad → Contraseñas de aplicaciones
                        </p>
                      </div>
                      <Button onClick={handleSaveEmailConfig} disabled={isSavingEmail} size="sm" className="gap-2 bg-primary text-white font-bold w-full">
                        {isSavingEmail ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Guardar configuración de email
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Users tab */}
                  <TabsContent value="users" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Controlá quién accede y qué puede hacer dentro de esta organización.
                      </p>
                      <Button size="sm" onClick={() => setShowAddUserDialog(true)} className="gap-1.5 bg-primary text-white font-bold shrink-0">
                        <UserPlus className="h-3.5 w-3.5" /> Agregar
                      </Button>
                    </div>

                    {/* Role legend */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {(Object.entries(ROLE_CONFIG) as [OrgUserRole, { color: string; desc: string }][]).map(([role, cfg]) => (
                        <div key={role} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                          <Badge className={cn('text-[10px] px-2 py-0 border-0 font-bold shrink-0', cfg.color)}>{role}</Badge>
                          <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {orgUsers.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No hay usuarios en esta organización todavía.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orgUsers.map(u => (
                          <div key={u.id} className={cn('flex items-center gap-3 p-3 rounded-xl border', u.status === 'Suspendido' ? 'opacity-50 bg-muted/20' : 'bg-white')}>
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm shrink-0">
                              {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{u.name || u.email}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <Select value={u.role} onValueChange={v => handleChangeUserRole(u, v as OrgUserRole)}>
                              <SelectTrigger className="h-7 w-36 text-xs border-0 bg-muted/40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Agente">Agente</SelectItem>
                                <SelectItem value="Solo lectura">Solo lectura</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                title={u.status === 'Suspendido' ? 'Activar' : 'Suspender'}
                                onClick={() => handleToggleUserStatus(u)}>
                                {u.status === 'Suspendido'
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                  : <XCircle className="h-3.5 w-3.5 text-orange-500" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                title="Eliminar usuario"
                                onClick={() => handleDeleteUser(u)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* ── Solicitudes de baja ── */}
      {cancelRequests.length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${pendingCancelCount > 0 ? 'bg-destructive/10' : 'bg-muted/30'}`}>
                  <LogOut className={`h-5 w-5 ${pendingCancelCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Solicitudes de baja</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Pedidos de cancelación de servicio — Ley 24.240 Art. 34
                  </CardDescription>
                </div>
              </div>
              {pendingCancelCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {pendingCancelCount} pendiente{pendingCancelCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {cancelRequests
              .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
              .map(r => (
                <div
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    r.status === 'pendiente'
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border/50 bg-muted/20'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{r.adminEmail}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'pendiente'
                          ? 'bg-amber-100 text-amber-700'
                          : r.status === 'procesada'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status === 'pendiente' ? 'Pendiente' : r.status === 'procesada' ? 'Procesada' : 'Revocada'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">{CANCEL_REASONS[r.reason] ?? r.reason}</span>
                      {' · '}{new Date(r.requestedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{r.notes}"</p>
                    )}
                    {r.processedAt && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Procesada: {new Date(r.processedAt).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  {r.status === 'pendiente' && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="text-xs h-7 font-bold bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          if (!db) return;
                          const now = new Date().toISOString();
                          await updateDoc(
                            doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'cancelRequests', r.id),
                            { status: 'procesada', processedAt: now },
                          );
                          toast({ title: 'Baja procesada', description: `Se registró la baja de ${r.adminEmail}.` });
                        }}
                      >
                        Marcar procesada
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 font-bold text-muted-foreground"
                        onClick={async () => {
                          if (!db) return;
                          await updateDoc(
                            doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'cancelRequests', r.id),
                            { status: 'cancelada_por_usuario' },
                          );
                          toast({ title: 'Solicitud archivada' });
                        }}
                      >
                        Archivar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* ── Solicitudes de Portal Plus ── */}
      {portalPlusRequests.length > 0 && (
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${pendingPortalPlusCount > 0 ? 'bg-emerald-100' : 'bg-muted/30'}`}>
                  <Globe className={`h-5 w-5 ${pendingPortalPlusCount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Solicitudes de Portal Plus</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Pedidos de activación de la vidriera pública de propiedades (+5 USD/mes)
                  </CardDescription>
                </div>
              </div>
              {pendingPortalPlusCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                  <Clock className="h-3 w-3" />
                  {pendingPortalPlusCount} pendiente{pendingPortalPlusCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {portalPlusRequests
              .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
              .map(r => (
                <div
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    r.status === 'pendiente'
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-border/50 bg-muted/20'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{r.adminName || r.adminEmail}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'pendiente'
                          ? 'bg-amber-100 text-amber-700'
                          : r.status === 'aprobada'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status === 'pendiente' ? 'Pendiente' : r.status === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.adminName ? `${r.adminEmail} · ` : ''}
                      Solicitado: {new Date(r.requestedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {r.processedAt && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Procesada: {new Date(r.processedAt).toLocaleDateString('es-AR')}
                      </p>
                    )}
                  </div>
                  {r.status === 'pendiente' && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="text-xs h-7 font-bold bg-emerald-600 hover:bg-emerald-700"
                        onClick={async () => {
                          if (!db) return;
                          await updateDoc(
                            doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'portalPlusRequests', r.id),
                            { status: 'aprobada', processedAt: new Date().toISOString() },
                          );
                          toast({ title: 'Portal Plus activado', description: `${r.adminEmail} ya puede publicar en el portal.` });
                        }}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 font-bold text-muted-foreground"
                        onClick={async () => {
                          if (!db) return;
                          await updateDoc(
                            doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'portalPlusRequests', r.id),
                            { status: 'rechazada', processedAt: new Date().toISOString() },
                          );
                          toast({ title: 'Solicitud rechazada' });
                        }}
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* ── Moderación del Portal ── */}
      <PortalModerationCard />

      {/* New Org Dialog */}
      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Nueva Organización
            </DialogTitle>
            <DialogDescription>Registrá una nueva inmobiliaria o gestor de alquileres.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre de la organización *</Label>
              <Input placeholder="Ej: Inmobiliaria García & Asociados" value={orgForm.name}
                onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre del responsable</Label>
              <Input placeholder="Carlos García" value={orgForm.ownerName}
                onChange={e => setOrgForm({ ...orgForm, ownerName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Email del responsable *</Label>
              <Input type="email" placeholder="carlos@inmobiliaria.com" value={orgForm.ownerEmail}
                onChange={e => setOrgForm({ ...orgForm, ownerEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Teléfono</Label>
              <Input placeholder="+54 11 ..." value={orgForm.phone}
                onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Plan</Label>
              <Select value={orgForm.plan} onValueChange={v => setOrgForm({ ...orgForm, plan: v as Organization['plan'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico — hasta 10 propiedades, 1 usuario</SelectItem>
                  <SelectItem value="Profesional">Profesional — hasta 50 propiedades, 5 usuarios</SelectItem>
                  <SelectItem value="Enterprise">Enterprise — ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase">Notas internas</Label>
              <Input placeholder="Ej: cliente referido, descuento acordado..." value={orgForm.notes}
                onChange={e => setOrgForm({ ...orgForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewOrgDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrg} disabled={isSaving} className="bg-primary text-white gap-2">
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear organización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Agregar Usuario
            </DialogTitle>
            <DialogDescription>
              Agregá un usuario a <strong>{selectedOrg?.name}</strong> con el rol correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Email del usuario *</Label>
              <Input type="email" placeholder="usuario@ejemplo.com" value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre</Label>
              <Input placeholder="Juan García" value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Rol</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v as OrgUserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador — acceso total</SelectItem>
                  <SelectItem value="Agente">Agente — gestión sin eliminar</SelectItem>
                  <SelectItem value="Solo lectura">Solo lectura — no puede modificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn('p-3 rounded-lg text-xs border', ROLE_CONFIG[userForm.role].color)}>
              {ROLE_CONFIG[userForm.role].desc}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={isSavingUser} className="bg-primary text-white gap-2">
              {isSavingUser ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Agregar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cierre del bloque mainView === 'orgs' */}
      </>}

      {/* ── Vista Novedades ── */}
      {mainView === 'novedades' && (
        <div className="space-y-6">
          {/* Recordatorio */}
          {(diasDesdeUltimoAnuncio === null || diasDesdeUltimoAnuncio >= 30) && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
              <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {diasDesdeUltimoAnuncio === null
                    ? 'Todavía no publicaste ninguna novedad'
                    : `Hace ${diasDesdeUltimoAnuncio} días que no publicás novedades`}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Mantené a tus usuarios informados — contales sobre nuevas funciones, tips o negocios que pueden hacer con la app.
                </p>
              </div>
            </div>
          )}

          {/* Formulario nuevo anuncio */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Nuevo anuncio
              </CardTitle>
              <CardDescription className="text-xs">
                Se mostrará en la campanita de todos los usuarios bajo la pestaña &quot;Novedades&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-bold">Tipo</Label>
                  <Select
                    value={anuncioForm.type}
                    onValueChange={v => setAnuncioForm(f => ({ ...f, type: v as AnuncioType }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novedad"><span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Novedad</span></SelectItem>
                      <SelectItem value="funcion"><span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Nueva función</span></SelectItem>
                      <SelectItem value="tip"><span className="flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Tip</span></SelectItem>
                      <SelectItem value="negocio"><span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Oportunidad de negocio</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-bold">Título</Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="Ej: Ahora podés exportar informes en PDF"
                    value={anuncioForm.title}
                    onChange={e => setAnuncioForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-bold">Contenido</Label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] resize-none"
                    placeholder="Contá la novedad con detalle..."
                    value={anuncioForm.body}
                    onChange={e => setAnuncioForm(f => ({ ...f, body: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleCreateAnuncio}
                  disabled={isSavingAnuncio}
                >
                  {isSavingAnuncio ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Guardar borrador
                </Button>
                <Button
                  size="sm"
                  className="text-xs gap-1.5 bg-primary text-white"
                  onClick={handleCreateAnuncioAndPublish}
                  disabled={isSavingAnuncio}
                >
                  {isSavingAnuncio ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Publicar ahora
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de anuncios */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Anuncios enviados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {anuncios.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  Todavía no hay anuncios.
                </div>
              ) : (
                <ul className="divide-y">
                  {anuncios.map(a => {
                    const typeLabels: Record<AnuncioType, string> = {
                      novedad: 'Novedad', funcion: 'Nueva función', tip: 'Tip', negocio: 'Oportunidad',
                    };
                    const typeColors: Record<AnuncioType, string> = {
                      novedad: 'bg-blue-100 text-blue-700',
                      funcion: 'bg-violet-100 text-violet-700',
                      tip: 'bg-amber-100 text-amber-700',
                      negocio: 'bg-green-100 text-green-700',
                    };
                    return (
                      <li key={a.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', typeColors[a.type])}>
                              {typeLabels[a.type]}
                            </span>
                            {a.isPublished ? (
                              <span className="text-[10px] font-bold text-green-600 flex items-center gap-0.5">
                                <Globe className="h-3 w-3" /> Publicado
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">Borrador</span>
                            )}
                          </div>
                          <p className="text-xs font-bold">{a.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.body}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {new Date(a.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {a.isPublished ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Despublicar"
                              onClick={() => handleUnpublishAnuncio(a)}
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700"
                              title="Publicar"
                              onClick={() => handlePublishAnuncio(a)}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Eliminar"
                            onClick={() => handleDeleteAnuncio(a)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
