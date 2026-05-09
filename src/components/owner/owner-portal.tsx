'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, MessageSquare, Building2, Calculator,
  LogOut, ChevronLeft, ChevronRight, Home, Menu,
  ShieldOff, ShieldAlert, Bell, ShoppingBag, Wrench, FileText, Users, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { OwnerHome } from './owner-home';
import { OwnerProperties } from './owner-properties';
import { OwnerLiquidations } from './owner-liquidations';
import { OwnerMessages } from './owner-messages';
import { OwnerClaims } from './owner-claims';
import { OwnerMarketplace } from './owner-marketplace';
import { OwnerMaintenanceApprovals } from './owner-maintenance-approvals';
import { OwnerInvoices } from './owner-invoices';
import { OwnerCommunity } from './owner-community';
import { OwnerAfipPanel } from './owner-afip-panel';

export interface OwnerRegistryEntry {
  ownerEmail: string;
  ownerName: string;
  adminId: string;
  propertyIds: string[];
  propertyNames: string[];
  status?: 'activo' | 'suspendido' | 'inactivo';
}

type OwnerTab =
  | 'Inicio'
  | 'Propiedades'
  | 'Liquidaciones'
  | 'Facturas'
  | 'Facturación AFIP'
  | 'Aprobaciones'
  | 'Reclamos'
  | 'Comunidad'
  | 'Marketplace'
  | 'Mensajes';

const OWNER_MENU: { id: OwnerTab; icon: React.ElementType; label: string }[] = [
  { id: 'Inicio',        icon: LayoutDashboard, label: 'Inicio'          },
  { id: 'Propiedades',   icon: Building2,       label: 'Mis Propiedades' },
  { id: 'Liquidaciones', icon: Calculator,      label: 'Liquidaciones'   },
  { id: 'Facturas',         icon: FileText,  label: 'Facturas'         },
  { id: 'Facturación AFIP', icon: Receipt,   label: 'Facturación AFIP' },
  { id: 'Aprobaciones',     icon: Wrench,    label: 'Aprobaciones'     },
  { id: 'Reclamos',      icon: Bell,            label: 'Reclamos'        },
  { id: 'Comunidad',     icon: Users,           label: 'Comunidad'       },
  { id: 'Marketplace',   icon: ShoppingBag,     label: 'Marketplace'     },
  { id: 'Mensajes',      icon: MessageSquare,   label: 'Mensajes'        },
];

interface OwnerPortalProps {
  ownerEntry: OwnerRegistryEntry;
  onSwitchToAdmin?: () => void;
}

export function OwnerPortal({ ownerEntry, onSwitchToAdmin }: OwnerPortalProps) {
  const [activeTab, setActiveTab] = useState<OwnerTab>('Inicio');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const auth = useAuth();

  // ── Blocked screens ──────────────────────────────────────────────────────
  const status = ownerEntry.status ?? 'activo';

  if (status === 'suspendido') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50/40 p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-10 w-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-black text-amber-800">Acceso suspendido</h1>
          <p className="text-amber-700 text-sm">
            Tu acceso al portal fue suspendido temporalmente por la administración.
            Contactate con la administración para más información.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-amber-600 underline mt-4 block mx-auto"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (status === 'inactivo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
            <ShieldOff className="h-10 w-10 text-slate-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-700">Acceso desactivado</h1>
          <p className="text-slate-500 text-sm">
            Tu cuenta en este portal ya no está activa. Contactate directamente con la administración.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-slate-500 underline mt-4 block mx-auto"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Inicio':        return <OwnerHome                 ownerEntry={ownerEntry} onNavigate={setActiveTab} />;
      case 'Propiedades':   return <OwnerProperties           ownerEntry={ownerEntry} />;
      case 'Liquidaciones': return <OwnerLiquidations         ownerEntry={ownerEntry} />;
      case 'Facturas':           return <OwnerInvoices             ownerEntry={ownerEntry} />;
      case 'Facturación AFIP':   return <OwnerAfipPanel            ownerEntry={ownerEntry} />;
      case 'Aprobaciones':       return <OwnerMaintenanceApprovals ownerEntry={ownerEntry} />;
      case 'Reclamos':      return <OwnerClaims               ownerEntry={ownerEntry} />;
      case 'Comunidad':     return <OwnerCommunity            ownerEntry={ownerEntry} />;
      case 'Marketplace':   return <OwnerMarketplace          ownerEntry={ownerEntry} />;
      case 'Mensajes':      return <OwnerMessages             ownerEntry={ownerEntry} />;
      default:              return <OwnerHome                 ownerEntry={ownerEntry} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">

      {/* ── Sidebar ── */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={cn(
        'bg-white border-r flex flex-col transition-all duration-300 z-40 shrink-0',
        'fixed inset-y-0 left-0 md:static md:z-20',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-20 w-64' : 'w-64',
      )}>
        {/* Logo */}
        <div className="px-4 h-16 flex items-center border-b gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Home className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-[11px] font-black text-emerald-700 leading-none">Portal Propietario</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {ownerEntry.propertyNames[0] ?? 'Mis propiedades'}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
          {OWNER_MENU.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setMobileOpen(false); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                activeTab === item.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', activeTab === item.id ? 'text-emerald-600' : 'text-muted-foreground')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t space-y-1">
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors',
                collapsed && 'justify-center',
              )}
            >
              <Menu className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Vista Administrador</span>}
            </button>
          )}
          <button
            onClick={() => signOut(auth)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-20 h-6 w-6 bg-white border rounded-full items-center justify-center shadow-sm text-muted-foreground hover:text-emerald-600 z-50"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto bg-background/50">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10 gap-3">
          <button className="md:hidden h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <p className="font-black text-foreground">
            {OWNER_MENU.find(m => m.id === activeTab)?.label ?? 'Inicio'}
          </p>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-foreground">{ownerEntry.ownerName}</p>
              <p className="text-[10px] text-muted-foreground">{ownerEntry.ownerEmail}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm uppercase">
              {ownerEntry.ownerName.charAt(0)}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
