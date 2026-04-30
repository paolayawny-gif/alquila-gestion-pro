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
  HardHat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SummaryView } from '@/components/dashboard/summary-view';
import { PropertiesView } from '@/components/dashboard/properties-view';
import { TenantsView } from '@/components/dashboard/tenants-view';
import { InvoicesView } from '@/components/dashboard/invoices-view';
import { MaintenanceView } from '@/components/dashboard/maintenance-view';
import { LegalView } from '@/components/dashboard/legal-view';
import { LiquidationsView } from '@/components/dashboard/liquidations-view';
import { AIAssistantView } from '@/components/dashboard/ai-assistant-view';
import { AIAnalyticsView } from '@/components/dashboard/ai-analytics-view';
import { PredictiveMaintenanceView } from '@/components/dashboard/predictive-maintenance-view';
import { ROISimulatorView } from '@/components/dashboard/roi-simulator-view';
import { FinancialLedgerView } from '@/components/dashboard/financial-ledger-view';
import { ContractGeneratorView } from '@/components/dashboard/contract-generator-view';
import { ApplicationsView } from '@/components/dashboard/onboarding-view';
import { TenantPortalView } from '@/components/dashboard/tenant-portal-view';
import { OwnerPortalView } from '@/components/dashboard/owner-portal-view';
import { ReportsView } from '@/components/dashboard/reports-view';
import { IndexRecordsView } from '@/components/dashboard/index-records-view';
import { SmartContractsView } from '@/components/dashboard/smart-contracts-view';
import { DepositsView } from '@/components/dashboard/deposits-view';
import { ProvidersView } from '@/components/dashboard/providers-view';
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
import { collection, query } from 'firebase/firestore';
import { Contract } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SuperAdminView } from '@/components/dashboard/super-admin-view';
import { useOrgContext } from '@/hooks/use-org-context';
import { OrgPermissionsProvider } from '@/contexts/org-permissions-context';

type Role = 'Administrador' | 'Inquilino' | 'Propietario';
type Tab = 'Resumen' | 'Propiedades' | 'Personas' | 'Solicitudes' | 'Facturas' | 'Mantenimiento' | 'Mantenimiento Predictivo' | 'Legales' | 'Liquidaciones' | 'Reportes' | 'Asistente IA' | 'Análisis IA' | 'Simulador ROI' | 'Libro Mayor' | 'Generador Contratos' | 'Mi Portal' | 'Índices' | 'Contratos Smart' | 'Garantías' | 'Proveedores' | 'Super Admin';

const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

const ADMIN_MENU = [
  { id: 'Resumen', icon: LayoutDashboard, label: 'Panel de Control' },
  { id: 'Propiedades', icon: Building, label: 'Propiedades' },
  { id: 'Personas', icon: Users, label: 'Personas y Contratos' },
  { id: 'Generador Contratos', icon: FilePen, label: 'Generador de Contratos' },
  { id: 'Contratos Smart', icon: Zap, label: 'Contratos Smart' },
  { id: 'Garantías', icon: PiggyBank, label: 'Garantías y Depósitos' },
  { id: 'Solicitudes', icon: UserPlus, label: 'Gestión de Solicitudes' },
  { id: 'Facturas', icon: FileSpreadsheet, label: 'Facturas y Servicios' },
  { id: 'Mantenimiento', icon: Wrench, label: 'Mantenimiento' },
  { id: 'Mantenimiento Predictivo', icon: ShieldPlus, label: 'Mantenimiento Predictivo' },
  { id: 'Proveedores', icon: HardHat, label: 'Directorio de Proveedores' },
  { id: 'Legales', icon: Scale, label: 'Casos Legales' },
  { id: 'Liquidaciones', icon: Calculator, label: 'Liquidaciones' },
  { id: 'Índices', icon: LineChart, label: 'Índices Oficiales' },
  { id: 'Libro Mayor', icon: BookOpen, label: 'Libro Mayor' },
  { id: 'Simulador ROI', icon: TrendingUp, label: 'Simulador de Rentabilidad' },
  { id: 'Reportes', icon: BarChart3, label: 'Reportes y Analítica' },
  { id: 'Análisis IA', icon: BrainCircuit, label: 'Análisis IA' },
  { id: 'Asistente IA', icon: MessageSquareCode, label: 'Asistente IA' },
];

const APP_ID = "alquilagestion-pro";

export default function AppClient() {
  const [activeRole, setActiveRole] = useState<Role>('Administrador');
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const orgCtx = useOrgContext();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
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

  const { data: propertiesData } = useCollection(propiedadesQuery);
  const { data: peopleData } = useCollection(inquilinosQuery);
  const { data: contractsData } = useCollection<Contract>(contratosQuery);
  const { data: invoicesData } = useCollection(facturasQuery);
  const { data: tasksData } = useCollection(mantenimientoQuery);
  const { data: liquidationsData } = useCollection(liquidacionesQuery);
  const { data: applicationsData } = useCollection(solicitudesQuery);
  const { data: indicesData } = useCollection(indicesQuery);
  const { data: legalesData } = useCollection(legalesQuery);

  const properties = propertiesData || [];
  const people = peopleData || [];
  const contracts = contractsData || [];
  const invoices = invoicesData || [];
  const tasks = tasksData || [];
  const liquidations = liquidationsData || [];
  const applications = applicationsData || [];
  const indexRecords = indicesData || [];
  const legalCases = legalesData || [];

  if (!isMounted) return null;

  const renderContent = () => {
    if (activeRole === 'Inquilino') {
      return <TenantPortalView contracts={contracts} properties={properties} invoices={invoices} tasks={tasks} />;
    }
    if (activeRole === 'Propietario') {
      return <OwnerPortalView properties={properties} liquidations={liquidations} />;
    }

    switch (activeTab) {
      case 'Resumen': return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
      case 'Propiedades': return <PropertiesView properties={properties} userId={user?.uid} />;
      case 'Personas': return <TenantsView people={people} userId={user?.uid} contracts={contracts} properties={properties} indexRecords={indexRecords} />;
      case 'Solicitudes': return <ApplicationsView applications={applications} userId={user?.uid} properties={properties} />;
      case 'Facturas': return <InvoicesView invoices={invoices} userId={user?.uid} contracts={contracts} />;
      case 'Mantenimiento': return <MaintenanceView tasks={tasks} userId={user?.uid} properties={properties} people={people} />;
      case 'Mantenimiento Predictivo': return <PredictiveMaintenanceView properties={properties} tasks={tasks} userId={user?.uid} />;
      case 'Proveedores': return <ProvidersView tasks={tasks} properties={properties} userId={user?.uid} />;
      case 'Generador Contratos': return <ContractGeneratorView properties={properties} people={people} contracts={contracts} userId={user?.uid} />;
      case 'Contratos Smart': return <SmartContractsView contracts={contracts} invoices={invoices} people={people} properties={properties} userId={user?.uid} />;
      case 'Garantías': return <DepositsView contracts={contracts} people={people} properties={properties} userId={user?.uid} />;
      case 'Simulador ROI': return <ROISimulatorView userId={user?.uid} />;
      case 'Libro Mayor': return <FinancialLedgerView properties={properties} invoices={invoices} contracts={contracts} userId={user?.uid} />;
      case 'Legales': return <LegalView legalCases={legalCases as any} userId={user?.uid} properties={properties} />;
      case 'Liquidaciones': return <LiquidationsView liquidations={liquidations} userId={user?.uid} properties={properties} people={people} />;
      case 'Índices': return <IndexRecordsView records={indexRecords} userId={user?.uid} />;
      case 'Reportes': return <ReportsView />;
      case 'Análisis IA': return <AIAnalyticsView properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} />;
      case 'Asistente IA': return <AIAssistantView />;
      case 'Super Admin': return <SuperAdminView userId={user?.uid} userEmail={user?.email ?? ''} />;
      default: return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
    }
  };

  const menuItems = activeRole === 'Administrador' ? ADMIN_MENU : [{ id: 'Mi Portal', icon: User, label: 'Mi Portal' }];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className={cn("bg-white border-r flex flex-col transition-all duration-300 relative z-20", isSidebarCollapsed ? "w-20" : "w-64")}>
        {/* Logo */}
        <div className="px-4 h-16 flex items-center border-b">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Ícono cuadrado: casa + barras + tendencia */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
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
                <span className="block text-[9px] font-medium tracking-[0.22em] text-[#888780] uppercase mb-0.5">ALQUILA</span>
                <div className="flex items-baseline gap-0">
                  <span className="text-[17px] font-semibold text-[#1D9E75] leading-none">Gestión</span>
                  <span className="text-[17px] font-semibold text-[#444441] leading-none">Pro</span>
                </div>
                <div className="flex mt-1 gap-[2px]">
                  <div className="h-[2.5px] w-[52px] rounded-full bg-[#1D9E75]"/>
                  <div className="h-[2.5px] w-[20px] rounded-full bg-[#444441]"/>
                </div>
              </div>
            </div>
          ) : (
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
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
        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors", activeTab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
            >
              <item.icon className={cn("h-5 w-5", activeTab === item.id ? "text-primary" : "text-muted-foreground")} />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
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
            <button onClick={() => setActiveTab('Super Admin')} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors", isSidebarCollapsed && "justify-center", activeTab === 'Super Admin' && "bg-amber-50")}>
              <Crown className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>Super Admin</span>}
            </button>
          )}
           <button onClick={handleLogout} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors mt-1", isSidebarCollapsed && "justify-center")}>
            <LogOut className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
           </button>
        </div>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-20 h-6 w-6 bg-white border rounded-full flex items-center justify-center shadow-sm text-muted-foreground hover:text-primary z-50">
          {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10 gap-4">
          <div className="relative hidden md:flex items-center w-72">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar propiedades, inquilinos..."
              className="w-full pl-9 pr-4 h-9 rounded-lg bg-muted/50 border border-transparent focus:border-primary/30 focus:bg-white text-sm outline-none transition-all"
            />
          </div>
          <h1 className="text-xl font-bold text-foreground md:hidden">{activeRole === 'Administrador' ? activeTab : `Portal de ${activeRole}`}</h1>
          <div className="flex items-center gap-3 ml-auto">
            {/* Org membership badge */}
            {orgCtx.isOrgUser && orgCtx.orgName && (
              <div className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                orgCtx.role === 'Solo lectura'
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : orgCtx.role === 'Agente'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              )}>
                <ShieldCheck className="h-3 w-3" />
                <span>{orgCtx.orgName}</span>
                <span className="opacity-60">·</span>
                <span>{orgCtx.role}</span>
              </div>
            )}
            <button className="relative h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {(tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado').length > 0) && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-foreground">{user?.email}</span>
              <span className="text-[10px] text-muted-foreground">
                {orgCtx.isOrgUser ? orgCtx.role ?? activeRole : `Rol: ${activeRole}`}
              </span>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm uppercase">{activeRole[0]}{activeRole[1]}</div>
          </div>
        </header>
        {/* Banner de solo lectura */}
        {orgCtx.isOrgUser && orgCtx.role === 'Solo lectura' && (
          <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center gap-2 text-xs text-slate-600 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Modo <strong>solo lectura</strong> — podés consultar toda la información pero no realizar cambios.
          </div>
        )}
        <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-5rem)]">
          <OrgPermissionsProvider value={{ canWrite: orgCtx.canWrite, canDelete: orgCtx.canDelete }}>
            {renderContent()}
          </OrgPermissionsProvider>
        </div>
      </main>
    </div>
  );
}
