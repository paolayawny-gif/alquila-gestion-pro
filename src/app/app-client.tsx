"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building,
  Users,
  FileSpreadsheet,
  Wrench,
  Scale,
  Calculator,
  MessageSquareCode,
  MessagesSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  ArrowLeftRight,
  BarChart3,
  UserPlus,
  LineChart,
  BrainCircuit,
  Search,
  Bell,
  TrendingUp,
  BookOpen,
  FilePen,
  ShieldPlus,
  Zap,
  PiggyBank,
  Crown,
  HardHat,
  CalendarRange,
  Vote,
  ConciergeBell,
  Store,
  Megaphone,
  Share2,
  ShoppingBag,
  ClipboardList,
  Menu,
  Settings,
  HelpCircle,
  Fingerprint,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BottomNav } from '@/components/ui/bottom-nav';
import { PropertiesView } from '@/components/dashboard/properties-view';
import { TenantsView } from '@/components/dashboard/tenants-view';
import { InvoicesView } from '@/components/dashboard/invoices-view';
import { MaintenanceView } from '@/components/dashboard/maintenance-view';
import { LegalView } from '@/components/dashboard/legal-view';
import { LiquidationsView } from '@/components/dashboard/liquidations-view';
import { AIAssistantView } from '@/components/dashboard/ai-assistant-view';
import { ContractGeneratorView } from '@/components/dashboard/contract-generator-view';
import { ApplicationsView } from '@/components/dashboard/onboarding-view';
import { TenantPortalView } from '@/components/dashboard/tenant-portal-view';
import { IndexRecordsView } from '@/components/dashboard/index-records-view';
import { SmartContractsView } from '@/components/dashboard/smart-contracts-view';
import { DepositsView } from '@/components/dashboard/deposits-view';
import { ProvidersView } from '@/components/dashboard/providers-view';
import { MessagesView } from '@/components/dashboard/messages-view';
import { HybridRentalsView } from '@/components/dashboard/hybrid-rentals-view';
import { CommunityVotingView } from '@/components/dashboard/community-voting-view';
import { ConciergeView } from '@/components/dashboard/concierge-view';
import { InsuranceView } from '@/components/dashboard/insurance-view';
import { MonetizationView } from '@/components/dashboard/monetization-view';
import { SocialMediaView } from '@/components/dashboard/social-media-view';
import { CommunityWallView } from '@/components/dashboard/community-wall-view';
import { MarketplaceView } from '@/components/dashboard/marketplace-view';
import { CentroLiquidacionesView } from '@/components/dashboard/centro-liquidaciones-view';
import { AdminSettingsView } from '@/components/dashboard/admin-settings-view';
import { HelpView } from '@/components/dashboard/help-view';
import { NotificationBell } from '@/components/ui/notification-bell';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  useAuth,
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase
} from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, doc, getDoc, updateDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { createNotification } from '@/lib/notifications';
import { BiometricGate } from '@/components/BiometricGate';
import { Contract, LegalCase, MonetizableAsset, SocialPost, SocialNetworkLink, PendingRentAdjustment, IndexRecord } from '@/lib/types';
import { isAdjustmentDue, calculateProposedAmount, buildPendingAdjustment } from '@/lib/rent-adjustment';
import { TenantPortal, TenantRegistryEntry } from '@/components/tenant/tenant-portal';
import { OwnerPortal, OwnerRegistryEntry } from '@/components/owner/owner-portal';
import { usePlan } from '@/hooks/use-plan';
import { BillingBlockedScreen } from '@/components/billing/billing-blocked-screen';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SuperAdminView } from '@/components/dashboard/super-admin-view';
import { TimelineView } from '@/components/dashboard/timeline-view';
import { useOrgContext } from '@/hooks/use-org-context';
import { OrgPermissionsProvider } from '@/contexts/org-permissions-context';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { CommandPalette, CommandItem } from '@/components/ui/command-palette';
import { OnboardingWizard } from '@/components/ui/onboarding-wizard';
import { PendingAdjustmentsView } from '@/components/dashboard/pending-adjustments-view';
import { NpsSurvey } from '@/components/ui/nps-survey';
import dynamic from 'next/dynamic';

// Vistas con gráficos (recharts) — se cargan de forma diferida para no incluir
// la librería de gráficos en el bundle inicial. Solo se descarga al abrir la pestaña.
const chartViewLoading = () => (
  <div className="p-8 text-sm text-muted-foreground">Cargando…</div>
);
const SummaryView = dynamic(
  () => import('@/components/dashboard/summary-view').then(m => m.SummaryView),
  { loading: chartViewLoading },
);
const AIAnalyticsView = dynamic(
  () => import('@/components/dashboard/ai-analytics-view').then(m => m.AIAnalyticsView),
  { loading: chartViewLoading },
);
const PredictiveMaintenanceView = dynamic(
  () => import('@/components/dashboard/predictive-maintenance-view').then(m => m.PredictiveMaintenanceView),
  { loading: chartViewLoading },
);
const ROISimulatorView = dynamic(
  () => import('@/components/dashboard/roi-simulator-view').then(m => m.ROISimulatorView),
  { loading: chartViewLoading },
);
const FinancialLedgerView = dynamic(
  () => import('@/components/dashboard/financial-ledger-view').then(m => m.FinancialLedgerView),
  { loading: chartViewLoading },
);
const AnalyticsPanelView = dynamic(
  () => import('@/components/dashboard/analytics-panel-view').then(m => m.AnalyticsPanelView),
  { loading: chartViewLoading },
);

type Role = 'Administrador' | 'Inquilino' | 'Propietario';
type Tab = 'Resumen' | 'Cronograma' | 'Propiedades' | 'Personas' | 'Solicitudes' | 'Facturas' | 'Centro Liquidaciones' | 'Mantenimiento' | 'Mantenimiento Predictivo' | 'Legales' | 'Liquidaciones' | 'Reportes' | 'Asistente IA' | 'Análisis IA' | 'Simulador ROI' | 'Libro Mayor' | 'Generador Contratos' | 'Mi Portal' | 'Índices' | 'Contratos Smart' | 'Garantías' | 'Proveedores' | 'Mensajes' | 'Rentas Híbridas' | 'Votaciones' | 'Concierge' | 'Comunidad' | 'Marketplace' | 'Seguros' | 'Monetización' | 'Redes Sociales' | 'Super Admin' | 'Configuración' | 'Ayuda' | 'Ajustes Alquiler';

const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

const ADMIN_MENU_GROUPS = [
  {
    section: null, // no label — solo el dashboard
    items: [
      { id: 'Resumen',    icon: LayoutDashboard, label: 'Panel de Control' },
      { id: 'Cronograma', icon: CalendarRange,   label: 'Cronograma'       },
    ],
  },
  {
    section: 'Cartera',
    items: [
      { id: 'Propiedades',        icon: Building,      label: 'Propiedades'           },
      { id: 'Personas',           icon: Users,         label: 'Personas y Contratos'  },
      { id: 'Generador Contratos',icon: FilePen,       label: 'Generador de Contratos'},
      { id: 'Contratos Smart',    icon: Zap,           label: 'Contratos Smart'       },
      { id: 'Garantías',          icon: PiggyBank,     label: 'Garantías y Depósitos' },
      { id: 'Rentas Híbridas',    icon: ArrowLeftRight,label: 'Rentas Híbridas'       },
      { id: 'Solicitudes',        icon: UserPlus,      label: 'Solicitudes'           },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { id: 'Facturas',                icon: FileSpreadsheet, label: 'Facturas y Servicios'    },
      { id: 'Mantenimiento',           icon: Wrench,          label: 'Mantenimiento'           },
      { id: 'Mantenimiento Predictivo',icon: ShieldPlus,      label: 'Mantenimiento Predictivo'},
      { id: 'Proveedores',             icon: HardHat,         label: 'Proveedores'             },
      { id: 'Mensajes',                icon: MessagesSquare,  label: 'Mensajes'                },
    ],
  },
  {
    section: 'Comunidad',
    items: [
      { id: 'Votaciones',  icon: Vote,          label: 'Votaciones' },
      { id: 'Concierge',   icon: ConciergeBell, label: 'Concierge'  },
      { id: 'Comunidad',   icon: Store,         label: 'Comunidad'  },
      { id: 'Marketplace', icon: ShoppingBag,   label: 'Marketplace'},
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { id: 'Ajustes Alquiler',      icon: TrendingUp,   label: 'Ajustes de Alquiler'    },
      { id: 'Seguros',              icon: ShieldCheck,  label: 'Seguros y Coberturas'   },
      { id: 'Legales',              icon: Scale,        label: 'Casos Legales'          },
      { id: 'Centro Liquidaciones', icon: ClipboardList,label: 'Centro de Liquidaciones'},
      { id: 'Liquidaciones',        icon: Calculator,   label: 'Liquidaciones'          },
      { id: 'Índices',              icon: LineChart,    label: 'Índices Oficiales'      },
      { id: 'Libro Mayor',          icon: BookOpen,     label: 'Libro Mayor'            },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { id: 'Monetización',  icon: Megaphone, label: 'Publicidad y Monetización' },
      { id: 'Redes Sociales',icon: Share2,    label: 'Redes Sociales'            },
    ],
  },
  {
    section: 'Analítica',
    items: [
      { id: 'Reportes',     icon: BarChart3,        label: 'Panel Analítico'          },
      { id: 'Análisis IA',  icon: BrainCircuit,     label: 'Análisis IA'              },
      { id: 'Asistente IA', icon: MessageSquareCode,label: 'Asistente IA'             },
      { id: 'Simulador ROI',icon: TrendingUp,       label: 'Simulador de Rentabilidad'},
    ],
  },
  {
    section: 'Sistema',
    items: [
      { id: 'Ayuda',         icon: HelpCircle, label: 'Centro de Ayuda' },
      { id: 'Configuración', icon: Settings,   label: 'Configuración'   },
    ],
  },
];

// Flat list kept for compatibility (role switcher, etc.)
const ADMIN_MENU = ADMIN_MENU_GROUPS.flatMap(g => g.items)
  .filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);

const APP_ID = "alquilagestion-pro";

export default function AppClient() {
  const [activeRole, setActiveRole] = useState<Role>('Administrador');
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const orgCtx = useOrgContext();
  const plan = usePlan(user?.uid);

  // ── Tenant role detection ──────────────────────────────────────────────────
  // undefined = loading; null = not a tenant; TenantRegistryEntry = is tenant
  const [tenantEntry, setTenantEntry] = useState<TenantRegistryEntry | null | undefined>(undefined);
  const [ownerEntry,  setOwnerEntry]  = useState<OwnerRegistryEntry  | null | undefined>(undefined);
  const [forceAdmin, setForceAdmin]   = useState(false); // switching back to admin view

  useEffect(() => {
    if (!db || !user?.email || isSuperAdmin) {
      setTenantEntry(null);
      setOwnerEntry(null);
      return;
    }
    const docId = user.email.toLowerCase().replace(/[@.+]/g, '_');
    // Check tenant registry first
    getDoc(doc(db, 'artifacts', APP_ID, 'tenantRegistry', docId))
      .then(snap => {
        if (snap.exists()) {
          setTenantEntry(snap.data() as TenantRegistryEntry);
          setOwnerEntry(null);
        } else {
          setTenantEntry(null);
          // Check owner registry
          return getDoc(doc(db, 'artifacts', APP_ID, 'ownerRegistry', docId))
            .then(ownerSnap => {
              if (ownerSnap.exists()) {
                const entry = ownerSnap.data() as OwnerRegistryEntry;
                setOwnerEntry(entry);
                // Persist UID so admin side can send targeted notifications
                if (user?.uid && entry.ownerUid !== user.uid) {
                  setDocumentNonBlocking(
                    doc(db, 'artifacts', APP_ID, 'ownerRegistry', docId),
                    { ownerUid: user.uid },
                    { merge: true },
                  );
                }
              } else setOwnerEntry(null);
            });
        }
      })
      .catch(() => { setTenantEntry(null); setOwnerEntry(null); });
  }, [db, user?.email, isSuperAdmin]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Detect built-in biometric support (Touch ID / Face ID / Windows Hello)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setBiometricSupported)
        .catch(() => setBiometricSupported(false));
    }
  }, []);

  // Hard auth guard: the dashboard must never render for an unauthenticated
  // visitor. If Firebase has no signed-in user, send them to /login.
  useEffect(() => {
    if (isMounted && !isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isMounted, isUserLoading, user, router]);

  // Ctrl+K / Cmd+K → open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Show onboarding wizard on first load when no data yet — declared after data arrays

  // Register a passkey so future logins can use biometrics
  const handleEnableBiometric = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('No autenticado');

      const optRes = await fetch('/api/auth/passkey/register', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const { options, stateToken } = await optRes.json();

      // Already enrolled: re-registering errors out in the OS credential
      // manager, so just confirm it's active instead of attempting again.
      if ((options?.excludeCredentials?.length ?? 0) > 0) {
        toast({ title: 'Biometría ya activada', description: 'Ya podés ingresar con huella o Face ID.' });
        return;
      }

      const { startRegistration } = await import('@simplewebauthn/browser');
      const regResponse = await startRegistration(options);

      const verRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ response: regResponse, stateToken }),
      });
      if (!verRes.ok) throw new Error('No se pudo registrar la biometría');

      toast({ title: 'Biometría activada', description: 'La próxima vez podés ingresar con huella o Face ID.' });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') return; // user cancelled the prompt
      if (err.name === 'InvalidStateError') {
        toast({ title: 'Biometría ya activada', description: 'Este dispositivo ya está registrado.' });
        return;
      }
      toast({ title: 'No se pudo activar', description: err.message ?? 'Intentá de nuevo.', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
    } catch {
      // best-effort: always sign out regardless
    }
    sessionStorage.removeItem('agp_session_id');
    sessionStorage.removeItem('agp_biometric_unlocked');
    await signOut(auth);
  };

  const propiedadesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'propiedades'));
  }, [db, user]);

  const inquilinosQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'inquilinos'));
  }, [db, user]);

  const contratosQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'contratos'));
  }, [db, user]);

  const facturasQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'facturas'));
  }, [db, user]);

  const mantenimientoQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'mantenimiento'));
  }, [db, user]);

  const liquidacionesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'liquidaciones'));
  }, [db, user]);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'solicitudes'));
  }, [db, user]);

  const indicesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'indices'));
  }, [db, user]);

  const legalesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'legales'));
  }, [db, user]);

  const monetizacionQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'monetizacion'));
  }, [db, user]);

  const socialPostsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'socialPosts'));
  }, [db, user]);

  const socialLinksQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'socialLinks'));
  }, [db, user]);

  const adjustmentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'rentAdjustments'));
  }, [db, user]);

  const { data: propertiesData } = useCollection(propiedadesQuery);
  const { data: peopleData } = useCollection(inquilinosQuery);
  const { data: contractsData } = useCollection<Contract>(contratosQuery);
  const { data: invoicesData } = useCollection(facturasQuery);
  const { data: tasksData } = useCollection(mantenimientoQuery);
  const { data: liquidationsData } = useCollection(liquidacionesQuery);
  const { data: applicationsData } = useCollection(solicitudesQuery);
  const { data: indicesData } = useCollection(indicesQuery);
  const { data: legalesData } = useCollection<LegalCase>(legalesQuery);
  const { data: monetizacionData } = useCollection<MonetizableAsset>(monetizacionQuery);
  const { data: socialPostsData } = useCollection<SocialPost>(socialPostsQuery);
  const { data: socialLinksData } = useCollection<SocialNetworkLink>(socialLinksQuery);
  const { data: adjustmentsData } = useCollection<PendingRentAdjustment>(adjustmentsQuery);

  const properties = propertiesData || [];
  const people = peopleData || [];
  const contracts = contractsData || [];
  const invoices = invoicesData || [];
  const tasks = tasksData || [];
  const liquidations = liquidationsData || [];
  const applications = applicationsData || [];
  const indexRecords = indicesData || [];
  const legalCases = legalesData || [];
  const monetizableAssets = monetizacionData || [];
  const socialPosts = socialPostsData || [];
  const socialLinks = socialLinksData || [];
  const rentAdjustments = adjustmentsData || [];
  const pendingAdjustmentsCount = rentAdjustments.filter(a => a.status === 'pendiente').length;
  const newApplicationsCount = applications.filter(a => a.status === 'Nueva').length;
  const [deepLinkPropertyId, setDeepLinkPropertyId] = useState<string | null>(null);

  // Show onboarding wizard on first load when no data yet
  useEffect(() => {
    if (!isMounted) return;
    if (tenantEntry || ownerEntry || isSuperAdmin) return;
    if (properties.length === 0 && contracts.length === 0) {
      const seen = localStorage.getItem('onboarding_seen_v1');
      if (!seen) setShowOnboarding(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, properties.length, contracts.length]);

  // ── Sync tenant emails to registry whenever contracts change ──────────────
  useEffect(() => {
    if (!db || !user?.uid || !contracts.length) return;
    contracts.forEach(contract => {
      if (!contract.tenantEmail) return;
      const docId = contract.tenantEmail.toLowerCase().replace(/[@.+]/g, '_');
      const ref   = doc(db, 'artifacts', APP_ID, 'tenantRegistry', docId);
      const entry: TenantRegistryEntry = {
        tenantEmail:  contract.tenantEmail.toLowerCase(),
        tenantName:   contract.tenantName  ?? '',
        adminId:      user.uid,
        propertyId:   contract.propertyId,
        propertyName: contract.propertyName ?? '',
        contractId:   contract.id,
      };
      setDocumentNonBlocking(ref, entry, { merge: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.length, db, user?.uid]);

  // ── Auto-actualizar status de contratos según fecha de vencimiento ────────
  useEffect(() => {
    if (!db || !user?.uid || !contracts.length) return;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    contracts.forEach(contract => {
      if (!contract.endDate) return;
      if (contract.status === 'Finalizado' || contract.status === 'Rescindido' || contract.status === 'Borrador') return;
      const end = new Date(contract.endDate);
      if (isNaN(end.getTime())) return;
      let nextStatus: Contract['status'] | null = null;
      let notifInput: { type: 'contract_expiring' | 'contract_expired'; title: string; message: string } | null = null;
      if (end < now) {
        nextStatus = 'Finalizado';
        notifInput = {
          type: 'contract_expired',
          title: 'Contrato vencido',
          message: `El contrato de ${contract.tenantName ?? 'inquilino'} en ${contract.propertyName ?? 'la propiedad'} venció el ${end.toLocaleDateString('es-AR')}.`,
        };
      } else if (end <= in30Days && contract.status === 'Vigente') {
        nextStatus = 'Próximo a Vencer';
        notifInput = {
          type: 'contract_expiring',
          title: 'Contrato próximo a vencer',
          message: `El contrato de ${contract.tenantName ?? 'inquilino'} en ${contract.propertyName ?? 'la propiedad'} vence el ${end.toLocaleDateString('es-AR')}.`,
        };
      }
      if (nextStatus && nextStatus !== contract.status) {
        const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'contratos', contract.id);
        setDocumentNonBlocking(ref, { status: nextStatus }, { merge: true });
        if (notifInput) {
          createNotification(db, user.uid, {
            ...notifInput,
            refId: contract.id,
            link: 'Contratos',
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.length, db, user?.uid]);

  // ── Auto-generate rent adjustment proposals when due ──────────────────────
  useEffect(() => {
    if (!db || !user?.uid || !contracts.length) return;
    const existingContractIds = new Set(rentAdjustments.map(a => a.contractId));
    contracts.forEach(contract => {
      if (!isAdjustmentDue(contract)) return;
      // Skip if there's already a pending adjustment for this contract
      if (rentAdjustments.some(a => a.contractId === contract.id && a.status === 'pendiente')) return;
      const calc = calculateProposedAmount(contract, indexRecords as IndexRecord[]);
      if (!calc) return;
      const newAdj = buildPendingAdjustment(contract, calc, user.uid);
      const id = `${contract.id}_${Date.now()}`;
      const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'rentAdjustments', id);
      setDocumentNonBlocking(ref, { ...newAdj, id, createdAt: new Date().toISOString() }, { merge: false });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.length, indexRecords.length, db, user?.uid]);

  // ── Sync property owners to ownerRegistry whenever properties change ──────
  useEffect(() => {
    if (!db || !user?.uid || !properties.length) return;
    // Build a map: email → { propertyIds[], propertyNames[], ownerName }
    const ownerMap = new Map<string, { name: string; ids: string[]; names: string[] }>();
    properties.forEach(prop => {
      (prop.owners ?? []).forEach((o: { email: string; name: string; percentage: number }) => {
        if (!o.email) return;
        const email = o.email.toLowerCase();
        if (!ownerMap.has(email)) ownerMap.set(email, { name: o.name, ids: [], names: [] });
        const entry = ownerMap.get(email)!;
        if (!entry.ids.includes(prop.id)) {
          entry.ids.push(prop.id);
          entry.names.push(prop.name);
        }
      });
    });
    ownerMap.forEach((data, email) => {
      const docId = email.replace(/[@.+]/g, '_');
      const ref   = doc(db, 'artifacts', APP_ID, 'ownerRegistry', docId);
      const entry: OwnerRegistryEntry = {
        ownerEmail:   email,
        ownerName:    data.name,
        adminId:      user.uid,
        propertyIds:  data.ids,
        propertyNames: data.names,
      };
      setDocumentNonBlocking(ref, entry, { merge: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.length, db, user?.uid]);

  // ── Publicar métricas agregadas al superadmin (sin datos personales) ──────
  useEffect(() => {
    if (!db || !user?.uid || !user?.email) return;
    if (isSuperAdmin || tenantEntry || ownerEntry) return;
    // Solo admins registrados (que ya cargaron datos reales)
    if (!properties.length && !contracts.length) return;

    const now = new Date();
    const currentPeriod = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const vigentes  = contracts.filter(c => c.status === 'Vigente');
    const proximos  = contracts.filter(c => c.status === 'Próximo a Vencer');

    // Conteos por tipo y uso de propiedad
    const tiposPropiedades: Record<string, number> = {};
    const usoPropiedades:   Record<string, number> = {};
    properties.forEach(p => {
      tiposPropiedades[p.type]  = (tiposPropiedades[p.type]  || 0) + 1;
      usoPropiedades[p.usage]   = (usoPropiedades[p.usage]   || 0) + 1;
    });

    // Precio promedio por moneda (sólo contratos vigentes con monto > 0)
    const arsV = vigentes.filter(c => c.currency === 'ARS' && c.currentRentAmount > 0);
    const usdV = vigentes.filter(c => c.currency === 'USD' && c.currentRentAmount > 0);
    const precioPromedioARS = arsV.length
      ? Math.round(arsV.reduce((s, c) => s + c.currentRentAmount, 0) / arsV.length) : 0;
    const precioPromedioUSD = usdV.length
      ? Math.round(usdV.reduce((s, c) => s + c.currentRentAmount, 0) / usdV.length) : 0;

    // Superficie y ambientes promedio
    const conSuperficie = properties.filter(p => p.squareMeters && p.squareMeters > 0);
    const conAmbientes  = properties.filter(p => p.rooms && p.rooms > 0);
    const superficiePromedio = conSuperficie.length
      ? Math.round(conSuperficie.reduce((s, p) => s + (p.squareMeters || 0), 0) / conSuperficie.length) : 0;
    const ambientesPromedio = conAmbientes.length
      ? Math.round(conAmbientes.reduce((s, p) => s + (p.rooms || 0), 0) / conAmbientes.length * 10) / 10 : 0;

    const emailDocId = user.email.toLowerCase().replace(/[@.+]/g, '_');
    const statsRef = doc(db, 'artifacts', APP_ID, 'superadmin', 'data', 'adminStats', emailDocId);
    setDocumentNonBlocking(statsRef, {
      adminEmail:         user.email,
      adminUid:           user.uid,
      lastSyncAt:         new Date().toISOString(),
      propiedadesTotal:   properties.length,
      contratosVigentes:  vigentes.length,
      contratosProximos:  proximos.length,
      facturasMes:        invoices.filter(i => i.period === currentPeriod).length,
      liquidacionesMes:   liquidations.filter(l => l.period === currentPeriod).length,
      tareasAbiertas:     tasks.filter(t => t.status !== 'Cerrado').length,
      tiposPropiedades,
      usoPropiedades,
      precioPromedioARS,
      precioPromedioUSD,
      superficiePromedio,
      ambientesPromedio,
    }, { merge: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.length, contracts.length, invoices.length, tasks.length, db, user?.uid]);

  if (!isMounted || isUserLoading) return null;
  // Not authenticated → render nothing while the guard effect redirects to /login.
  if (!user) return null;

  // ── Show tenant portal if user is a tenant ──────────────────────────────
  if (tenantEntry && !forceAdmin && !isSuperAdmin) {
    return (
      <TenantPortal
        tenantEntry={tenantEntry}
        onSwitchToAdmin={() => setForceAdmin(true)}
      />
    );
  }

  // ── Show owner portal if user is a property owner ─────────────────────
  if (ownerEntry && !forceAdmin && !isSuperAdmin) {
    return (
      <OwnerPortal
        ownerEntry={ownerEntry}
        onSwitchToAdmin={() => setForceAdmin(true)}
      />
    );
  }

  // Still loading role check → show nothing
  if (tenantEntry === undefined || ownerEntry === undefined) return null;

  // ── Bloqueo por suscripción impaga ──────────────────────────────────────────
  // El superadmin nunca se bloquea. No bloqueamos mientras carga el plan, para
  // no mostrar la pantalla de bloqueo en falso durante la carga inicial.
  if (!isSuperAdmin && !plan.loading && plan.blocked) {
    const st = plan.state?.status;
    const reason =
      plan.trialExpired   ? 'Tu período de prueba terminó.'
      : st === 'pending'  ? 'Tu suscripción quedó pendiente de pago por más de 48 horas.'
      : st === 'past_due' ? 'No pudimos procesar el último cobro y venció el período de gracia.'
      : st === 'paused'   ? 'Tu suscripción está pausada por falta de pago.'
      : st === 'cancelled'? 'Tu suscripción fue cancelada.'
      :                     'Tu suscripción no está activa.';
    return (
      <BillingBlockedScreen
        adminId={user?.uid ?? ''}
        adminEmail={user?.email ?? ''}
        reason={reason}
        onLogout={handleLogout}
      />
    );
  }

  // ── Rent adjustment handlers ───────────────────────────────────────────────
  const approveAdjustment = async (id: string) => {
    if (!db || !user?.uid) return;
    const adj = rentAdjustments.find(a => a.id === id);
    if (!adj) return;
    const now = new Date().toISOString();
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'rentAdjustments', id);
    await updateDoc(ref, { status: 'aprobado', approvedAt: now, approvedBy: user.email ?? user.uid });
    // Update contract currentRentAmount + lastAdjustmentDate
    const contractRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'contratos', adj.contractId);
    setDocumentNonBlocking(contractRef, {
      currentRentAmount: adj.proposedAmount,
      lastAdjustmentDate: now,
    }, { merge: true });
    toast({ title: 'Ajuste aprobado', description: `Nuevo alquiler: ${adj.proposedAmount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}` });
  };

  const rejectAdjustment = async (id: string, reason: string) => {
    if (!db || !user?.uid) return;
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'rentAdjustments', id);
    await updateDoc(ref, { status: 'rechazado', rejectedAt: new Date().toISOString(), rejectionReason: reason });
    toast({ title: 'Ajuste rechazado' });
  };

  const notifyAdjustment = async (id: string) => {
    if (!db || !user?.uid) return;
    const adj = rentAdjustments.find(a => a.id === id);
    if (!adj) return;
    // Mark as notified — actual email/WhatsApp would be triggered server-side via webhook
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'rentAdjustments', id);
    const now = new Date().toISOString();
    await updateDoc(ref, { notifiedTenantAt: now, notifiedOwnerAt: now });
    // Queue notification record for server-side sending
    const notifRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'pendingNotifications', `adj_${id}`);
    setDocumentNonBlocking(notifRef, {
      type: 'rent_adjustment',
      adjustmentId: id,
      contractId: adj.contractId,
      tenantEmail: adj.tenantEmail ?? '',
      ownerEmail: adj.ownerEmail ?? '',
      currentAmount: adj.currentAmount,
      proposedAmount: adj.proposedAmount,
      variationPct: adj.variationPct,
      propertyName: adj.propertyName,
      tenantName: adj.tenantName,
      createdAt: now,
      sent: false,
    }, { merge: false });
    toast({ title: 'Notificación enviada', description: 'Se notificó al propietario e inquilino del nuevo valor.' });
  };

  const renderContent = () => {
    if (activeRole === 'Inquilino') {
      return <TenantPortalView contracts={contracts} properties={properties} invoices={invoices} tasks={tasks} />;
    }
    if (activeRole === 'Propietario') {
      // Demo: build a synthetic owner entry from the logged-in admin's own data.
      // This uses adminId === user.uid so all Firestore reads go against their own
      // collections — no hardcoded IDs, no permissions error.
      const demoOwnerEntry: OwnerRegistryEntry = {
        ownerEmail:    user?.email    ?? '',
        ownerName:     user?.displayName ?? user?.email ?? 'Propietario Demo',
        adminId:       user?.uid      ?? '',
        propertyIds:   properties.map(p => p.id),
        propertyNames: properties.map(p => p.name),
        status: 'activo',
      };
      return (
        <OwnerPortal
          ownerEntry={demoOwnerEntry}
          onSwitchToAdmin={() => setActiveRole('Administrador')}
        />
      );
    }

    switch (activeTab) {
      case 'Resumen': return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
      case 'Propiedades': return <PropertiesView properties={properties} userId={user?.uid} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} liquidations={liquidations} legalCases={legalCases} deepLinkPropertyId={deepLinkPropertyId} onDeepLinkConsumed={() => setDeepLinkPropertyId(null)} onOpenContract={() => setActiveTab('Personas' as Tab)} />;
      case 'Personas': return <TenantsView people={people} userId={user?.uid} contracts={contracts} properties={properties} indexRecords={indexRecords} invoices={invoices} liquidations={liquidations} tasks={tasks} legalCases={legalCases} applications={applications} onOpenProperty={(id) => { setDeepLinkPropertyId(id); setActiveTab('Propiedades' as Tab); }} />;
      case 'Solicitudes': return <ApplicationsView applications={applications} userId={user?.uid} properties={properties} />;
      case 'Facturas': return <InvoicesView invoices={invoices} userId={user?.uid} contracts={contracts} properties={properties} people={people} />;
      case 'Centro Liquidaciones': return <CentroLiquidacionesView invoices={invoices} contracts={contracts} properties={properties} people={people} userId={user?.uid} />;
      case 'Mantenimiento': return <MaintenanceView tasks={tasks} userId={user?.uid} properties={properties} people={people} contracts={contracts} />;
      case 'Mantenimiento Predictivo': return <PredictiveMaintenanceView properties={properties} tasks={tasks} userId={user?.uid} />;
      case 'Proveedores': return <ProvidersView tasks={tasks} properties={properties} userId={user?.uid} />;
      case 'Mensajes': return <MessagesView contracts={contracts} properties={properties} people={people} userId={user?.uid} />;
      case 'Rentas Híbridas': return <HybridRentalsView properties={properties} contracts={contracts} userId={user?.uid} />;
      case 'Votaciones': return <CommunityVotingView properties={properties} contracts={contracts} people={people} userId={user?.uid} />;
      case 'Concierge': return <ConciergeView properties={properties} contracts={contracts} people={people} userId={user?.uid} />;
      case 'Comunidad': return <CommunityWallView userId={user?.uid} userEmail={user?.email ?? ''} userName={user?.displayName ?? ''} />;
      case 'Marketplace': return <MarketplaceView userId={user?.uid} userEmail={user?.email ?? ''} userName={user?.displayName ?? ''} />;
      case 'Seguros': return <InsuranceView properties={properties} userId={user?.uid} />;
      case 'Monetización': return <MonetizationView assets={monetizableAssets} properties={properties} userId={user?.uid} userEmail={user?.email ?? ''} />;
      case 'Redes Sociales': return <SocialMediaView posts={socialPosts} networkLinks={socialLinks} userId={user?.uid} />;
      case 'Generador Contratos': return <ContractGeneratorView properties={properties} people={people} contracts={contracts} userId={user?.uid} />;
      case 'Contratos Smart': return <SmartContractsView contracts={contracts} invoices={invoices} people={people} properties={properties} userId={user?.uid} />;
      case 'Garantías': return <DepositsView contracts={contracts} people={people} properties={properties} userId={user?.uid} />;
      case 'Simulador ROI': return <ROISimulatorView userId={user?.uid} />;
      case 'Libro Mayor': return <FinancialLedgerView properties={properties} invoices={invoices} contracts={contracts} userId={user?.uid} />;
      case 'Legales': return <LegalView legalCases={legalCases} userId={user?.uid} properties={properties} />;
      case 'Liquidaciones': return <LiquidationsView liquidations={liquidations} userId={user?.uid} properties={properties} people={people} contracts={contracts} invoices={invoices} tasks={tasks} />;
      case 'Cronograma': return <TimelineView contracts={contracts} invoices={invoices} tasks={tasks} liquidations={liquidations} adjustments={rentAdjustments} onNavigate={(tab) => setActiveTab(tab as Tab)} />;
      case 'Índices': return <IndexRecordsView records={indexRecords} userId={user?.uid} />;
      case 'Reportes': return <AnalyticsPanelView properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} legalCases={legalCases} assets={monetizableAssets} userId={user?.uid} />;
      case 'Análisis IA': return <AIAnalyticsView properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} />;
      case 'Asistente IA': return <AIAssistantView />;
      case 'Super Admin': return <SuperAdminView userId={user?.uid} userEmail={user?.email ?? ''} />;
      case 'Configuración': return <AdminSettingsView userId={user?.uid} />;
      case 'Ayuda': return <HelpView onNavigate={(tab) => setActiveTab(tab as Tab)} currentSection={activeTab} />;
      case 'Ajustes Alquiler': return <PendingAdjustmentsView adjustments={rentAdjustments} onApprove={approveAdjustment} onReject={rejectAdjustment} onNotify={notifyAdjustment} />;
      default: return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
    }
  };

  const menuItems = activeRole === 'Administrador' ? ADMIN_MENU : [{ id: 'Mi Portal', icon: User, label: 'Mi Portal' }];

  const cmdItems: CommandItem[] = [
    ...ADMIN_MENU.map(item => ({
      id: `nav-${item.id}`,
      label: item.label,
      category: 'nav' as const,
      onSelect: () => setActiveTab(item.id as Tab),
    })),
    ...(isSuperAdmin ? [{
      id: 'nav-superadmin',
      label: 'Super Admin',
      category: 'nav' as const,
      onSelect: () => setActiveTab('Super Admin' as Tab),
    }] : []),
    ...properties.map(p => ({
      id: `prop-${p.id}`,
      label: p.name ?? p.address ?? '—',
      sublabel: p.address ?? '',
      category: 'property' as const,
      onSelect: () => setActiveTab('Propiedades'),
    })),
    ...people.map((p: any) => ({
      id: `tenant-${p.id}`,
      label: p.fullName ?? '—',
      sublabel: p.email ?? '',
      category: 'tenant' as const,
      onSelect: () => setActiveTab('Personas'),
    })),
    ...contracts.map(c => ({
      id: `contract-${c.id}`,
      label: `${c.tenantName ?? '—'} — ${c.propertyName ?? '—'}`,
      sublabel: c.status,
      category: 'contract' as const,
      onSelect: () => setActiveTab('Personas'),
    })),
  ];

  return (
    <BiometricGate userEmail={user?.email}>
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={cn(
        "bg-card border-r flex flex-col transition-all duration-300 z-40 shrink-0",
        "fixed inset-y-0 left-0 md:static md:z-20",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isSidebarCollapsed ? "md:w-20 w-64" : "w-64",
      )}>
        {/* Logo */}
        <div className="px-4 h-16 flex items-center border-b">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Ícono cuadrado: casa + barras + tendencia */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0" aria-hidden="true">
                <rect width="36" height="36" rx="9" fill="#1D9E75"/>
                {/* Techo */}
                <polyline points="6,22 18,11 30,22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Barras de crecimiento */}
                <rect x="9" y="22" width="5" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                <rect x="16" y="18" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.75"/>
                <rect x="23" y="14" width="5" height="15" rx="1.5" fill="white"/>
                {/* Línea de tendencia */}
                <polyline points="9,22 16,17 23,13 30,8" fill="none" stroke="#9FE1CB" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="16" cy="17" r="2" fill="#9FE1CB"/>
                <circle cx="23" cy="13" r="2" fill="#9FE1CB"/>
              </svg>
              {/* Wordmark */}
              <div className="leading-none overflow-hidden flex-1 min-w-0">
                <span className="block text-[9px] font-medium tracking-[0.22em] text-muted-foreground uppercase mb-0.5">ALQUILA</span>
                <div className="flex items-baseline gap-0">
                  <span className="text-[17px] font-semibold text-primary leading-none">Gestión</span>
                  <span className="text-[17px] font-semibold text-foreground leading-none">Pro</span>
                </div>
                <div className="flex mt-1 gap-[2px]">
                  <div className="h-[2.5px] w-[52px] rounded-full bg-primary"/>
                  <div className="h-[2.5px] w-[20px] rounded-full bg-foreground/40"/>
                </div>
              </div>
            </div>
          ) : (
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto" aria-hidden="true">
              <rect width="36" height="36" rx="9" fill="#1D9E75"/>
              <polyline points="6,22 18,11 30,22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="9" y="22" width="5" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
              <rect x="16" y="18" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.75"/>
              <rect x="23" y="14" width="5" height="15" rx="1.5" fill="white"/>
              <polyline points="9,22 16,17 23,13 30,8" fill="none" stroke="#9FE1CB" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="16" cy="17" r="2" fill="#9FE1CB"/>
              <circle cx="23" cy="13" r="2" fill="#9FE1CB"/>
            </svg>
          )}
        </div>
        <nav className="flex-1 px-4 mt-4 overflow-y-auto space-y-0.5 pb-4">
          {activeRole === 'Administrador'
            ? ADMIN_MENU_GROUPS.map((group, gi) => (
                <div key={gi}>
                  {group.section && !isSidebarCollapsed && (
                    <p className="px-3 pt-4 pb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 select-none">
                      {group.section}
                    </p>
                  )}
                  {group.section && isSidebarCollapsed && gi > 0 && (
                    <div className="my-2 border-t border-border/40" />
                  )}
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as Tab); setMobileMenuOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        activeTab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                        isSidebarCollapsed && "justify-center",
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", activeTab === item.id ? "text-primary" : "text-muted-foreground")} />
                      {!isSidebarCollapsed && <span className="truncate flex-1">{item.label}</span>}
                      {!isSidebarCollapsed && item.id === 'Ajustes Alquiler' && pendingAdjustmentsCount > 0 && (
                        <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                          {pendingAdjustmentsCount}
                        </span>
                      )}
                      {!isSidebarCollapsed && item.id === 'Solicitudes' && newApplicationsCount > 0 && (
                        <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold px-1">
                          {newApplicationsCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            : menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as Tab); setMobileMenuOpen(false); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", activeTab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
                >
                  <item.icon className={cn("h-5 w-5", activeTab === item.id ? "text-primary" : "text-muted-foreground")} />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))
          }
        </nav>
        <div className="p-4 border-t space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors", isSidebarCollapsed && "justify-center")}>
                <ArrowLeftRight className="h-5 w-5" />
                {!isSidebarCollapsed && <span className="truncate">Cambiar Rol: {activeRole}</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Seleccionar Vista</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setActiveRole('Administrador'); setActiveTab('Resumen'); }}>Vista Administrador</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveRole('Inquilino'); setActiveTab('Mi Portal'); }}>Vista Inquilino</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveRole('Propietario'); setActiveTab('Mi Portal'); }}>Vista Propietario</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isSuperAdmin && (
            <button onClick={() => setActiveTab('Super Admin')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 transition-colors", isSidebarCollapsed && "justify-center", activeTab === 'Super Admin' && "bg-amber-500/10")}>
              <Crown className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>Super Admin</span>}
            </button>
          )}
           <button onClick={handleLogout} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1", isSidebarCollapsed && "justify-center")}>
            <LogOut className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
           </button>
        </div>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex absolute -right-3 top-20 h-6 w-6 bg-card border rounded-full items-center justify-center shadow-sm text-muted-foreground hover:text-primary z-50">
          {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-card/80 backdrop-blur-md sticky top-0 z-10 gap-3">
          <button className="md:hidden h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setCmdOpen(true)}
            className="relative hidden md:flex items-center w-72 h-9 rounded-lg bg-muted/50 border border-transparent hover:border-primary/30 hover:bg-card transition-colors text-left px-3 gap-2 group"
            aria-label="Abrir búsqueda global"
          >
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" aria-hidden="true" />
            <span className="text-sm text-muted-foreground flex-1">Buscar propiedades, inquilinos...</span>
            <kbd className="hidden lg:flex h-5 items-center gap-0.5 rounded border bg-background/60 px-1.5 text-[10px] font-medium text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
          <h1 className="text-xl font-bold text-foreground md:hidden">{activeRole === 'Administrador' ? activeTab : `Portal de ${activeRole}`}</h1>
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            {/* Org membership badge */}
            {orgCtx.isOrgUser && orgCtx.orgName && (
              <div className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                orgCtx.role === 'Solo lectura'
                  ? 'bg-muted text-muted-foreground border-border'
                  : orgCtx.role === 'Agente'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/25'
                  : 'bg-primary/10 text-primary border-primary/25'
              )}>
                <ShieldCheck className="h-3 w-3" />
                <span>{orgCtx.orgName}</span>
                <span className="opacity-60">·</span>
                <span>{orgCtx.role}</span>
              </div>
            )}
            <NotificationBell
              userId={user?.uid}
              onNavigate={(link) => {
                if (link) setActiveTab(link as Tab);
              }}
            />

            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-foreground">{user?.email}</span>
              <span className="text-[10px] text-muted-foreground">
                {orgCtx.isOrgUser ? orgCtx.role ?? activeRole : `Rol: ${activeRole}`}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm uppercase hover:bg-primary/30 transition-colors">
                  {activeRole[0]}{activeRole[1]}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 sm:hidden">
                  <p className="text-xs font-bold text-foreground truncate">{user?.email}</p>
                  <p className="text-[10px] text-muted-foreground">{activeRole}</p>
                </div>
                <DropdownMenuSeparator className="sm:hidden" />
                {biometricSupported && (
                  <DropdownMenuItem onClick={handleEnableBiometric} className="gap-2">
                    <Fingerprint className="h-4 w-4" />
                    Activar biometría
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive gap-2">
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* Banner de solo lectura */}
        {orgCtx.isOrgUser && orgCtx.role === 'Solo lectura' && (
          <div className="bg-muted border-b px-6 py-2 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Modo <strong>solo lectura</strong> — podés consultar toda la información pero no realizar cambios.
          </div>
        )}
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-5rem)] pb-20 md:pb-8">
          <OrgPermissionsProvider value={{ canWrite: orgCtx.canWrite, canDelete: orgCtx.canDelete }}>
            {renderContent()}
          </OrgPermissionsProvider>
        </div>
      </main>
      {activeRole === 'Administrador' && (
        <BottomNav
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as Tab)}
          items={[
            { id: 'Resumen',      icon: LayoutDashboard,  label: 'Panel'      },
            { id: 'Facturas',     icon: FileSpreadsheet,  label: 'Facturas'   },
            { id: 'Personas',     icon: Users,            label: 'Personas'   },
            { id: 'Mensajes',     icon: MessagesSquare,   label: 'Mensajes'   },
            { id: 'Mantenimiento',icon: Wrench,           label: 'Mantenim.'  },
          ]}
        />
      )}

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={cmdItems}
      />

      <OnboardingWizard
        open={showOnboarding}
        onFinish={(goTo) => {
          localStorage.setItem('onboarding_seen_v1', '1');
          setShowOnboarding(false);
          if (goTo) setActiveTab(goTo);
        }}
      />

      {!isSuperAdmin && !tenantEntry && !ownerEntry && (
        <NpsSurvey userId={user?.uid} contractCount={contracts.length} />
      )}
    </div>
    </BiometricGate>
  );
}
