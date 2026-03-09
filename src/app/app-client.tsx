
"use client";

import React, { useState } from 'react';
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
  UserPlus,
  ArrowLeftRight,
  BarChart3
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
import { Property, Person, Contract, RentalApplication, Invoice, MaintenanceTask, LegalCase, Liquidation } from '@/lib/types';

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

export default function AppClient() {
  const [activeRole, setActiveRole] = useState<Role>('Administrador');
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ESTADO GLOBAL CENTRALIZADO
  const [properties, setProperties] = useState<Property[]>([
    { 
      id: '1', 
      name: 'Edificio Las Heras 4B', 
      address: 'Las Heras 1234', 
      unit: '4B', 
      type: 'Departamento',
      usage: 'Vivienda',
      status: 'Alquilada',
      squareMeters: 55,
      rooms: 2,
      amenities: ['Seguridad 24hs', 'SUM'],
      owners: [{ ownerId: 'p1', name: 'Juan Pérez', percentage: 100 }],
      photos: [],
      ownerId: 'user1'
    }
  ]);

  const [people, setPeople] = useState<Person[]>([
    {
      id: '1',
      type: 'Inquilino',
      fullName: 'Carlos Sosa',
      taxId: '20-34567890-9',
      email: 'carlos.sosa@email.com',
      phone: '11 4455-6677',
      address: 'Av. Corrientes 1500, CABA',
      documents: [],
      bankDetails: { bank: 'Galicia', cbu: '0070123456', alias: 'CARLOS.SOSA.PAGO' },
      ownerId: 'user1'
    },
    {
      id: 'p1',
      type: 'Propietario',
      fullName: 'Juan Pérez',
      taxId: '20-12345678-9',
      email: 'juan.perez@email.com',
      phone: '11 9988-7766',
      documents: [],
      bankDetails: { bank: 'Santander', cbu: '0720123456', alias: 'JUAN.P.PROPIEDAD' },
      ownerId: 'user1'
    }
  ]);

  const [contracts, setContracts] = useState<Contract[]>([
    { 
      id: 'c1', 
      tenantId: '1', 
      tenantName: 'Carlos Sosa',
      propertyId: '1', 
      propertyName: 'Edificio Las Heras 4B',
      guarantorIds: [],
      ownerIds: ['p1'],
      startDate: '2026-05-15',
      endDate: '2028-05-15',
      paymentPeriodDays: 30,
      baseRentAmount: 120000,
      currentRentAmount: 185000,
      currency: 'ARS',
      adjustmentType: 'Index',
      adjustmentMechanism: 'ICL',
      adjustmentFrequencyMonths: 4,
      depositAmount: 120000,
      depositCurrency: 'ARS',
      commissionAmount: 60000,
      lateFeeType: 'DailyPercentage',
      lateFeeValue: 0.5,
      status: 'Vigente',
      documents: { mainContractUrl: '', versions: [], annexes: [] },
      ownerId: 'user1'
    }
  ]);

  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([
    { 
      id: '1', 
      contractId: 'c1',
      tenantName: 'Carlos Sosa',
      propertyName: 'Las Heras 4B',
      period: 'Marzo 2026',
      charges: [
        { id: 'ch1', type: 'Alquiler', description: 'Alquiler mensual', amount: 185000, imputedTo: 'Inquilino', isPaid: true },
        { id: 'ch2', type: 'Expensa Ordinaria', description: 'Expensas Marzo', amount: 45000, imputedTo: 'Inquilino', isPaid: true },
      ],
      lateFees: 0,
      totalAmount: 230000,
      currency: 'ARS',
      dueDate: '2026-03-10', 
      status: 'Pagado', 
      paymentDate: '2026-03-08',
      paymentMethod: 'Transferencia',
      hasFile: true 
    }
  ]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([
    { id: '1', type: 'Desalojo por Falta de Pago', propertyId: '1', propertyName: 'Las Heras 4B', startDate: '2026-01-10', attorney: 'Dr. Ricardo Darín', status: 'En proceso', hasFile: true, ownerId: 'user1' }
  ]);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([
    { 
      id: '1', 
      propertyId: '1',
      propertyName: 'Las Heras 4B', 
      ownerId: 'p1',
      ownerName: 'Juan Pérez',
      ingresoAlquiler: 185000, 
      adminFeeDeduction: 18500,
      maintenanceDeductions: 0, 
      expenseDeductions: 12000, 
      netAmount: 154500,
      period: 'Abril 2026',
      status: 'Pendiente',
      dateCreated: '2026-04-15'
    }
  ]);

  const renderContent = () => {
    if (activeRole === 'Inquilino') return <TenantPortalView />;
    if (activeRole === 'Propietario') return <OwnerPortalView />;

    switch (activeTab) {
      case 'Resumen': return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} />;
      case 'Propiedades': return <PropertiesView properties={properties} setProperties={setProperties} />;
      case 'Personas': return (
        <TenantsView 
          people={people} 
          setPeople={setPeople} 
          contracts={contracts} 
          setContracts={setContracts} 
          properties={properties} 
        />
      );
      case 'Solicitudes': return <ApplicationsView applications={applications} setApplications={setApplications} properties={properties} />;
      case 'Facturas': return <InvoicesView invoices={invoices} setInvoices={setInvoices} contracts={contracts} />;
      case 'Mantenimiento': return <MaintenanceView tasks={tasks} setTasks={setTasks} properties={properties} people={people} />;
      case 'Legales': return <LegalView legalCases={legalCases} setLegalCases={setLegalCases} properties={properties} />;
      case 'Liquidaciones': return <LiquidationsView liquidations={liquidations} setLiquidations={setLiquidations} properties={properties} people={people} />;
      case 'Reportes': return <ReportsView />;
      case 'Asistente IA': return <AIAssistantView />;
      default: return <SummaryView onNavigate={(tab) => setActiveTab(tab as Tab)} properties={properties} contracts={contracts} invoices={invoices} tasks={tasks} />;
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
            <span className="text-sm text-muted-foreground hidden sm:block">
              {activeRole === 'Inquilino' ? 'Inquilino: Carlos Sosa' : activeRole === 'Propietario' ? 'Propietario: Juan Pérez' : 'Admin: Inmobiliaria S.A.'}
            </span>
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
