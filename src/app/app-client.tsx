
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
  UserPlus
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
import { ApplicationsView } from '@/components/dashboard/onboarding-view';
import { TenantPortalView } from '@/components/dashboard/tenant-portal-view';
import { OwnerPortalView } from '@/components/dashboard/owner-portal-view';
import { ReportsView } from '@/components/dashboard/reports-view';
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

type Role = 'Administrador' | 'Inquilino' | 'Propietario';
type Tab = 'Resumen' | 'Propiedades' | 'Personas' | 'Solicitudes' | 'Facturas' | 'Mantenimiento' | 'Legales' | 'Liquidaciones' | 'Reportes' | 'Asistente IA' | 'Mi Portal';

const ADMIN_MENU = [
  { id: 'Resumen', icon: LayoutDashboard, label: 'Resumen' },
  { id: 'Propiedades', icon: Building, label: 'Propiedades' },
  { id: 'Personas', icon: Users, label: 'Personas y Contratos' },
  { id: 'Solicitudes', icon: UserPlus, label: 'Gestión de Solicitudes' },
  { id: 'Facturas', icon: FileSpreadsheet, label: 'Facturas y Servicios' },
  { id: 'Mantenimiento', icon: Wrench, label: 'Mantenimiento / Reclamos' },
  { id: 'Legales', icon: Scale, label: 'Legales y Mediaciones' },
  { id: 'Liquidaciones', icon: Calculator, label: 'Liquidaciones' },
  { id: 'Reportes', icon: BarChart3, label: 'Reportes y Analítica' },
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Queries para colecciones en Firestore
  const propiedadesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'propiedades'));
  }, [db, user]);

  const inquilinosQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'inquilinos'));
  }, [db, user]);

  const facturasQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'facturas'));
  }, [db, user]);

  const mantenimientoQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'mantenimiento'));
  }, [db, user]);

  const legalQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'legalCases'));
  }, [db, user]);

  const liquidacionesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'liquidaciones'));
  }, [db, user]);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'solicitudes'));
  }, [db, user]);

  // Suscripción a los datos de Firestore
  const { data: propertiesData } = useCollection(propiedadesQuery);
  const { data: peopleData } = useCollection(inquilinosQuery);
  const { data: invoicesData } = useCollection(facturasQuery);
  const { data: tasksData } = useCollection(mantenimientoQuery);
  const { data: legalCasesData } = useCollection(legalQuery);
  const { data: liquidationsData } = useCollection(liquidacionesQuery);
  const { data: applicationsData } = useCollection(solicitudesQuery);

  // Asegurar arreglos para evitar errores de null
  const properties = propertiesData || [];
  const people = peopleData || [];
  const invoices = invoicesData || [];
  const tasks = tasksData || [];
  const legalCases = legalCasesData || [];
  const liquidations = liquidationsData || [];
  const applications = applicationsData || [];

  const [contracts, setContracts] = useState<any[]>([]);

  if (!isMounted) return null;

  const renderContent = () => {
    if (activeRole === 'Inquilino') {
      return (
        <TenantPortalView 
          contracts={contracts} 
          properties={properties} 
          invoices={invoices}
          tasks={tasks}
        />
      );
    }
    
    if (activeRole === 'Propietario') {
      return <OwnerPortalView properties={properties} liquidations={liquidations} />;
    }

    switch (activeTab) {
      case 'Resumen': return (
        <SummaryView 
          onNavigate={(tab) => setActiveTab(tab as Tab)} 
          properties={properties} 
          contracts={contracts} 
          invoices={invoices} 
          tasks={tasks} 
          applications={applications}
        />
      );
      case 'Propiedades': return <PropertiesView properties={properties} userId={user?.uid} />;
      case 'Personas': return (
        <TenantsView 
          people={people} 
          userId={user?.uid}
          contracts={contracts} 
          setContracts={setContracts} 
          properties={properties} 
        />
      );
      case 'Solicitudes': return (
        <ApplicationsView 
          applications={applications} 
          userId={user?.uid} 
          properties={properties} 
        />
      );
      case 'Facturas': return <InvoicesView invoices={invoices} userId={user?.uid} contracts={contracts} />;
      case 'Mantenimiento': return <MaintenanceView tasks={tasks} userId={user?.uid} properties={properties} people={people} />;
      case 'Legales': return <LegalView legalCases={legalCases} userId={user?.uid} properties={properties} />;
      case 'Liquidaciones': return <LiquidationsView liquidations={liquidations} userId={user?.uid} properties={properties} people={people} />;
      case 'Reportes': return <ReportsView />;
      case 'Asistente IA': return <AIAssistantView />;
      default: return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} applications={applications} />;
    }
  };

  const menuItems = activeRole === 'Administrador' ? ADMIN_MENU : [{ id: 'Mi Portal', icon: User, label: 'Mi Portal' }];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside 
        className={cn(
          "bg-white border-r flex flex-col transition-all duration-300 relative z-20",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
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
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                activeTab === item.id 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className={cn("h-5 w-5", activeTab === item.id ? "text-primary" : "text-muted-foreground")} />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors",
                  isSidebarCollapsed && "justify-center"
                )}
              >
                <ArrowLeftRight className="h-5 w-5" />
                {!isSidebarCollapsed && <span className="truncate">Cambiar Rol: {activeRole}</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Seleccionar Vista</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setActiveRole('Administrador'); setActiveTab('Resumen'); }}>
                Vista Administrador
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveRole('Inquilino'); setActiveTab('Mi Portal'); }}>
                Vista Inquilino
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveRole('Propietario'); setActiveTab('Mi Portal'); }}>
                Vista Propietario
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

           <button 
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors mt-2",
              isSidebarCollapsed && "justify-center"
            )}
           >
            <LogOut className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
           </button>
        </div>

        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 h-6 w-6 bg-white border rounded-full flex items-center justify-center shadow-sm text-muted-foreground hover:text-primary z-50"
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        <header className="h-20 border-b flex items-center justify-between px-8 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-2xl font-bold text-foreground">
            {activeRole === 'Administrador' ? activeTab : `Portal de ${activeRole}`}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold text-foreground">
                {user?.email}
              </span>
              <span className="text-xs text-muted-foreground">
                Rol: {activeRole}
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
              {activeRole[0]}{activeRole[1]}
            </div>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-5rem)]">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
