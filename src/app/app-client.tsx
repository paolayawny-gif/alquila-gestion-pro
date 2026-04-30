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
  Bot,
  TrendingUp,
  BookOpen,
  FilePen,
  ShieldPlus,
  Trash2,
  AlertTriangle
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
import { collection, query, writeBatch, doc } from 'firebase/firestore';
import { Contract } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Role = 'Administrador' | 'Inquilino' | 'Propietario';
type Tab = 'Resumen' | 'Propiedades' | 'Personas' | 'Solicitudes' | 'Facturas' | 'Mantenimiento' | 'Mantenimiento Predictivo' | 'Legales' | 'Liquidaciones' | 'Reportes' | 'Asistente IA' | 'Análisis IA' | 'Simulador ROI' | 'Libro Mayor' | 'Generador Contratos' | 'Mi Portal' | 'Índices';

const ADMIN_MENU = [
  { id: 'Resumen', icon: LayoutDashboard, label: 'Panel de Control' },
  { id: 'Propiedades', icon: Building, label: 'Propiedades' },
  { id: 'Personas', icon: Users, label: 'Personas y Contratos' },
  { id: 'Generador Contratos', icon: FilePen, label: 'Generador de Contratos' },
  { id: 'Solicitudes', icon: UserPlus, label: 'Gestión de Solicitudes' },
  { id: 'Facturas', icon: FileSpreadsheet, label: 'Facturas y Servicios' },
  { id: 'Mantenimiento', icon: Wrench, label: 'Mantenimiento' },
  { id: 'Mantenimiento Predictivo', icon: ShieldPlus, label: 'Mantenimiento Predictivo' },
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
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleClearAllData = async () => {
    if (!db || !user) return;
    setIsResetting(true);
    const COLLECTIONS = ['propiedades','inquilinos','contratos','facturas','mantenimiento','liquidaciones','solicitudes','indices','legales'];
    const allItems = [
      ...properties, ...people, ...contracts, ...invoices,
      ...tasks, ...liquidations, ...applications, ...indexRecords, ...legalCases
    ];
    const collectionMap: Record<string, string> = {
      propiedades: 'propiedades', inquilinos: 'inquilinos', contratos: 'contratos',
      facturas: 'facturas', mantenimiento: 'mantenimiento', liquidaciones: 'liquidaciones',
      solicitudes: 'solicitudes', indices: 'indices', legales: 'legales',
    };
    try {
      // Delete each collection in batches of 400
      for (const colName of COLLECTIONS) {
        let colItems: any[] = [];
        if (colName === 'propiedades') colItems = properties;
        else if (colName === 'inquilinos') colItems = people;
        else if (colName === 'contratos') colItems = contracts;
        else if (colName === 'facturas') colItems = invoices;
        else if (colName === 'mantenimiento') colItems = tasks;
        else if (colName === 'liquidaciones') colItems = liquidations;
        else if (colName === 'solicitudes') colItems = applications;
        else if (colName === 'indices') colItems = indexRecords;
        else if (colName === 'legales') colItems = legalCases;

        for (let i = 0; i < colItems.length; i += 400) {
          const batch = writeBatch(db);
          colItems.slice(i, i + 400).forEach((item: any) => {
            const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, colName, item.id);
            batch.delete(ref);
          });
          await batch.commit();
        }
      }
      setShowResetDialog(false);
      toast({ title: 'Datos eliminados ✓', description: 'El sistema está limpio y listo para usar con datos reales.' });
    } catch (err: any) {
      toast({ title: 'Error al limpiar', description: err?.message ?? 'No se pudieron eliminar todos los datos.', variant: 'destructive' });
    } finally {
      setIsResetting(false);
    }
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
      case 'Generador Contratos': return <ContractGeneratorView properties={properties} people={people} contracts={contracts} userId={user?.uid} />;
      case 'Simulador ROI': return <ROISimulatorView userId={user?.uid} />;
      case 'Libro Mayor': return <FinancialLedgerView properties={properties} invoices={invoices} contracts={contracts} userId={user?.uid} />;
      case 'Legales': return <LegalView legalCases={legalCases as any} userId={user?.uid} properties={properties} />;
      case 'Liquidaciones': return <LiquidationsView liquidations={liquidations} userId={user?.uid} properties={properties} people={people} />;
      case 'Índices': return <IndexRecordsView records={indexRecords} userId={user?.uid} />;
      case 'Reportes': return <ReportsView />;
      case 'Análisis IA': return <AIAnalyticsView properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} />;
      case 'Asistente IA': return <AIAssistantView />;
      default: return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
    }
  };

  const menuItems = activeRole === 'Administrador' ? ADMIN_MENU : [{ id: 'Mi Portal', icon: User, label: 'Mi Portal' }];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className={cn("bg-white border-r flex flex-col transition-all duration-300 relative z-20", isSidebarCollapsed ? "w-20" : "w-64")}>
        <div className="p-6 h-20 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <ShieldCheck className="text-primary h-6 w-6 flex-shrink-0" />
              <span className="font-bold text-lg text-primary truncate">AlquilaGestión Pro</span>
            </div>
          )}
          {isSidebarCollapsed && <ShieldCheck className="text-primary h-8 w-8 mx-auto" />}
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
          {activeRole === 'Administrador' && (
            <button onClick={() => setShowResetDialog(true)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors", isSidebarCollapsed && "justify-center")}>
              <Trash2 className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>Limpiar datos de prueba</span>}
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
      {/* Diálogo de limpieza de datos */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-lg font-black text-destructive">Limpiar todos los datos</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              Esta acción eliminará <strong>permanentemente</strong> todos los datos de tu cuenta:
              propiedades, personas, contratos, facturas, mantenimiento, liquidaciones, solicitudes e índices.
              <br /><br />
              <span className="font-bold text-foreground">No se puede deshacer.</span> Hacé esto solo si querés empezar desde cero con datos reales.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-2">
            <p className="text-xs text-amber-800 font-medium">
              Se eliminarán: {properties.length} propiedades · {people.length} personas · {contracts.length} contratos · {invoices.length} facturas · {tasks.length} tareas · {applications.length} solicitudes · {indexRecords.length} índices
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetDialog(false)} disabled={isResetting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClearAllData} disabled={isResetting} className="gap-2">
              {isResetting ? <><span className="animate-spin">⟳</span> Eliminando…</> : <><Trash2 className="h-4 w-4" /> Sí, eliminar todo</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <button className="relative h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {(tasks.filter(t => t.priority === 'Urgente' && t.status !== 'Cerrado').length > 0) && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-foreground">{user?.email}</span>
              <span className="text-[10px] text-muted-foreground">Rol: {activeRole}</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm uppercase">{activeRole[0]}{activeRole[1]}</div>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-5rem)]">{renderContent()}</div>
      </main>
    </div>
  );
}
