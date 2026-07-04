"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DemoModal } from './DemoModal';
import {
  Building2, FileText, BrainCircuit, BarChart3,
  CreditCard, Wrench, Scale, Calendar, FileSpreadsheet,
  Home, User, ArrowRight, Play, Check, Plus,
  ShieldCheck, LayoutDashboard, TrendingUp,
  AlertTriangle, DollarSign, Globe,
} from 'lucide-react';
import { BILLING_TIERS, TRIAL_TIER } from '@/lib/billing/tiers';
import { cn } from '@/lib/utils';

function fmtARS(n: number) {
  return '$ ' + n.toLocaleString('es-AR');
}

// ── Logo ──────────────────────────────────────────────────────────────────
function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="9" fill="#0369A1"/>
      <polyline points="6,22 18,11 30,22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="9" y="22" width="5" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="16" y="18" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.75"/>
      <rect x="23" y="14" width="5" height="15" rx="1.5" fill="white"/>
      <polyline points="9,22 16,17 23,13 30,8" fill="none" stroke="#7DD3FC" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="17" r="2" fill="#7DD3FC"/>
      <circle cx="23" cy="13" r="2" fill="#7DD3FC"/>
    </svg>
  );
}

// ── Eyebrow ───────────────────────────────────────────────────────────────
function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 mb-3", center && "justify-center")}>
      <div className="h-px w-5 bg-primary flex-shrink-0" />
      <span className="eyebrow text-primary">{children}</span>
    </div>
  );
}

// ── Tick ──────────────────────────────────────────────────────────────────
function Tick() {
  return (
    <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))] flex items-center justify-center mt-0.5">
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────
function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <header className={cn(
      'sticky top-0 z-50 backdrop-blur-md transition-all duration-200',
      scrolled
        ? 'border-b border-border bg-background/88'
        : 'border-b border-transparent bg-transparent',
    )}>
      <div className="max-w-6xl mx-auto px-7 h-[68px] flex items-center justify-between gap-8">
        <Link href="/landing" className="flex items-center gap-2.5">
          <AppLogo size={30} />
          <div className="leading-none">
            <span className="block text-[9px] font-black tracking-[0.28em] uppercase text-muted-foreground">ALQUILA</span>
            <div className="flex items-baseline">
              <span className="text-[15px] font-bold text-primary leading-none">Gestión</span>
              <span className="text-[15px] font-bold text-foreground leading-none">Pro</span>
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: 'Producto', href: '#producto' },
            { label: 'Para quién', href: '#roles' },
            { label: 'Precios', href: '#precios' },
            { label: 'Preguntas', href: '#faq' },
          ].map(({ label, href }) => (
            <a key={href} href={href}
              className="px-3 py-2 rounded-lg text-[14.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login"
            className="hidden sm:inline-flex items-center px-4 h-9 rounded-lg text-[14px] font-medium text-foreground hover:bg-muted transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/login"
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-primary">
            Probá gratis
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Dashboard Mockup ──────────────────────────────────────────────────────
function DashboardPreview() {
  const kpis = [
    { label: 'Propiedades', Icon: Home, color: 'green' as const },
    { label: 'Cobrado', Icon: DollarSign, color: 'blue' as const },
    { label: 'Por ajustar', Icon: AlertTriangle, color: 'amber' as const },
  ];
  const rows = [
    { initials: 'JP', label: 'Av. Cabildo 2380 · 4° B', sub: 'Contrato vigente', status: 'paid', badge: 'Al día' },
    { initials: 'MF', label: 'Bulnes 1150 · PB', sub: 'Ajuste pendiente ICL', status: 'pending', badge: 'Pendiente' },
  ];

  return (
    <div className="bg-card border border-border rounded-[20px] overflow-hidden relative" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="absolute bottom-0 right-0 w-52 h-52 pointer-events-none rounded-full"
        style={{ background: 'radial-gradient(closest-side, hsl(155 55% 76% / 0.28), transparent 70%)', transform: 'translate(35%,35%)' }} />
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted">
        {[0,1,2].map(i => <span key={i} className="w-2.5 h-2.5 rounded-full bg-border" />)}
        <span className="ml-2 text-[10.5px] text-muted-foreground font-mono px-2 py-0.5 rounded bg-card border border-border">
          app.alquilagestion.pro/panel
        </span>
      </div>
      <div className="p-5 grid gap-3">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {kpis.map(({ label, Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-[13px] p-3 relative overflow-hidden">
              <span className={cn("absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center",
                color === 'green' && "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]",
                color === 'blue'  && "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))]",
                color === 'amber' && "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))]",
              )}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2">{label}</p>
              <p className="text-[18px] font-extrabold text-foreground tracking-tight tabular">—</p>
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="bg-card border border-border rounded-[13px] p-3.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12.5px] font-bold">Ingresos por mes</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]">ICL ajustado</span>
          </div>
          <div className="flex items-end gap-1.5 h-[64px]">
            {[32,44,38,56,52,68,78,92].map((h, i) => (
              <div key={i} className={cn("flex-1 rounded-t-[3px] transition-all",
                i === 7 ? "bg-primary" : "bg-[hsl(var(--status-paid-bg))]"
              )} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        {/* Rows */}
        {rows.map(({ initials, label, sub, status, badge }) => (
          <div key={label} className="bg-card border border-border rounded-[13px] px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={cn("w-8 h-8 rounded-[9px] flex items-center justify-center text-[11px] font-extrabold",
                status === 'paid'    && "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]",
                status === 'pending' && "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))]",
              )}>{initials}</span>
              <div>
                <p className="text-[12px] font-semibold leading-tight">{label}</p>
                <p className="text-[10.5px] text-muted-foreground">{sub}</p>
              </div>
            </div>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
              status === 'paid'    && "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]",
              status === 'pending' && "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))]",
            )}>{badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────
const TRUST = ['AFIP / ARCA', 'BCRA — ICL', 'MercadoPago', 'Firma Digital'];

function Hero({ onOpenDemo }: { onOpenDemo: () => void }) {
  return (
    <section className="relative overflow-hidden pt-12 pb-16">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: [
          'radial-gradient(900px 380px at 18% 12%, hsl(142 60% 88% / 0.45), transparent 70%)',
          'radial-gradient(700px 320px at 88% 28%, hsl(155 55% 86% / 0.35), transparent 70%)',
        ].join(', ')
      }} />
      <div className="relative max-w-6xl mx-auto px-7">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-[11.5px] font-semibold text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Registrá ajustes por ICL con seguimiento de vencimientos
            </span>
            <h1
              className="text-[clamp(2.1rem,1.4rem+2.4vw,3.5rem)] font-extrabold tracking-[-0.025em] leading-[1.06] text-foreground mb-5"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              La plataforma completa para gestionar tu cartera de alquileres
            </h1>
            <p className="text-[17px] leading-[1.6] text-muted-foreground mb-7 max-w-[52ch]">
              Desde el contrato hasta la liquidación — todo en un solo lugar. Registrá ajustes por ICL, IPC y CER, con recordatorios de vencimiento, facturación AFIP integrada, firma digital y un asistente que te ayuda con los cálculos.
            </p>
            <div className="flex flex-wrap gap-3 mb-7">
              <Link href="/login"
                className="inline-flex items-center gap-2 h-[52px] px-6 rounded-xl bg-primary text-primary-foreground text-[15.5px] font-bold shadow-primary hover:bg-primary/90 transition-colors">
                Empezar gratis 7 días
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={onOpenDemo}
                className="inline-flex items-center gap-2 h-[52px] px-6 rounded-xl border border-border bg-card text-foreground text-[15.5px] font-semibold hover:bg-muted transition-colors">
                <Play className="h-4 w-4 fill-current" />
                Ver demo 2 min
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 border-t border-border">
              <span className="eyebrow text-muted-foreground w-full sm:w-auto">Integrado con</span>
              {TRUST.map(item => (
                <span key={item} className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <DashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Roles ─────────────────────────────────────────────────────────────────
const ROLES = [
  {
    Icon: LayoutDashboard, color: 'green' as const,
    title: 'Inmobiliarias y administradores',
    desc: 'Un panel central para tu cartera completa: contratos, cobranzas, liquidaciones y reportes en un solo lugar.',
    items: [
      'Sidebar con módulos financieros, legales y de comunidad',
      'Generador de contratos con cláusulas locales (Ley 27.551)',
      'Centro de liquidaciones con reparto automático',
    ],
  },
  {
    Icon: Home, color: 'blue' as const,
    title: 'Propietarios',
    desc: 'Mirá tus propiedades en vivo: cuánto ingresó este mes, qué se aprobó en mantenimiento y cuándo se acredita.',
    items: [
      'Liquidaciones mensuales descargables',
      'Aprobá presupuestos de reparaciones desde el celular',
      'Historial de contratos e ingresos por propiedad',
    ],
  },
  {
    Icon: User, color: 'amber' as const,
    title: 'Inquilinos',
    desc: 'Una cuenta corriente clara, recordatorios antes del vencimiento y un canal directo para mantenimiento.',
    items: [
      'Pago online con MercadoPago',
      'Reclamos con foto y tracking del estado',
      'Próximo ajuste y cálculo paso a paso',
    ],
  },
];

function Roles() {
  const colorMap = {
    green: { ico: "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]" },
    blue:  { ico: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))]" },
    amber: { ico: "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))]" },
  };
  return (
    <section id="roles" className="py-20">
      <div className="max-w-6xl mx-auto px-7">
        <div className="mb-14">
          <Eyebrow>Para quién es</Eyebrow>
          <h2 className="text-[clamp(1.7rem,1.2rem+1.4vw,2.4rem)] font-extrabold tracking-[-0.02em] leading-[1.12] text-foreground mb-3"
            style={{ textWrap: 'balance' } as React.CSSProperties}>
            Una plataforma, tres roles que conviven en serio.
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-[1.6] max-w-[56ch]">
            Inmobiliarias, propietarios e inquilinos trabajan en la misma base de datos — cada uno ve lo que tiene que ver, con permisos y un portal hecho a su medida.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {ROLES.map(({ Icon, color, title, desc, items }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/20 transition-all duration-200">
              <span className={cn("inline-flex w-11 h-11 rounded-[12px] items-center justify-center mb-4", colorMap[color].ico)}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-[19px] font-extrabold tracking-[-0.015em] mb-2">{title}</h3>
              <p className="text-[14.5px] text-muted-foreground leading-[1.55] mb-4">{desc}</p>
              <ul className="grid gap-2">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                    <Tick />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: FileText,      title: 'Generador de contratos',    desc: 'Plantillas locales con cláusulas ICL/IPC/CER, garantías y ajustes. Genera el PDF listo para firmar.' },
  { Icon: TrendingUp,    title: 'Ajustes por índice',        desc: 'Registrá el ajuste ICL, IPC o CER de cada contrato y notificá a las partes el día exacto — con recordatorio de vencimiento.' },
  { Icon: CreditCard,    title: 'Cobranzas y MercadoPago',   desc: 'Link de pago automático con vencimiento, recordatorios y conciliación.' },
  { Icon: BarChart3,     title: 'Centro de liquidaciones',   desc: 'Reparto automático al propietario, descuentos de comisión, expensas e impuestos en un solo cierre.' },
  { Icon: Scale,         title: 'Casos legales',             desc: 'Cargá la mora, generá la intimación y seguí los pasos con tu mediador. Documentos versionados.' },
  { Icon: Wrench,        title: 'Mantenimiento',             desc: 'Tickets con foto, presupuesto, aprobación del propietario y red de proveedores propios.' },
  { Icon: BrainCircuit,  title: 'Asistente IA',             desc: 'Pregúntale a tu cartera. Resume morosos, sugiere ajustes y redacta intimaciones — siempre con cita.' },
  { Icon: Calendar,      title: 'Próximos vencimientos',    desc: 'Mirá de un vistazo qué contratos vencen, qué ajustes vienen y qué expensas se aprueban este mes.' },
  { Icon: FileSpreadsheet, title: 'Reportes y AFIP',        desc: 'Facturación electrónica AFIP y exportá tus liquidaciones e informes en PDF/Excel para tu contador.' },
];

function Features() {
  return (
    <section id="producto" className="py-20 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-7">
        <div className="mb-14">
          <Eyebrow>Todo lo que necesitás</Eyebrow>
          <h2 className="text-[clamp(1.7rem,1.2rem+1.4vw,2.4rem)] font-extrabold tracking-[-0.02em] leading-[1.12] text-foreground mb-3"
            style={{ textWrap: 'balance' } as React.CSSProperties}>
            Un módulo por cada cosa molesta que hoy resolvés a mano.
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-[1.6] max-w-[56ch]">
            Pensado para la Argentina, no por consultores. Cada función responde a una tarea concreta del día a día.{' '}
            <span className="text-foreground font-medium">También funciona en cualquier país de Latinoamérica</span> — configurás el país al crear tu cuenta y el sistema adapta índices, moneda e impuestos.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-background border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/20 transition-all duration-200">
              <span className="inline-flex w-9 h-9 rounded-[10px] items-center justify-center bg-secondary text-primary mb-4">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <h4 className="text-[16px] font-bold tracking-[-0.01em] mb-1.5">{title}</h4>
              <p className="text-[13.5px] text-muted-foreground leading-[1.55]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Contract Showcase ────────────────────────────────────────────────────
function ContractShowcase() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-7">
        <div className="bg-card border border-border rounded-3xl p-12 md:p-14 grid md:grid-cols-[1fr_1.1fr] gap-14 items-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <Eyebrow>Caso de uso · Contratos</Eyebrow>
            <h3 className="text-[clamp(1.45rem,1.1rem+0.9vw,2rem)] font-extrabold tracking-[-0.02em] leading-[1.15] mb-4"
              style={{ textWrap: 'balance' } as React.CSSProperties}>
              Del primer borrador a la firma digital en menos de una tarde.
            </h3>
            <p className="text-[15px] text-muted-foreground leading-[1.6] mb-6">
              Cargá los datos del locador, locatario y la propiedad. AlquilaGestión arma el contrato con la plantilla correcta — Ley 27.551 o esquemas previos —, calcula garantías y abre la firma electrónica al cliente.
            </p>
            <ul className="grid gap-3 mb-6">
              {[
                'Cláusulas pre-validadas con normativa argentina vigente.',
                'Firma electrónica integrada por token de mail.',
                'Calendario de ajustes generado automáticamente.',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-[14.5px] leading-snug">
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {['ICL · BCRA', 'IPC · INDEC', 'CER', 'Garantía propietaria', 'Seguro de caución'].map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background text-[12px] font-semibold text-foreground">
                  <span className="w-1 h-1 rounded-full bg-primary" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Contract preview card */}
          <div className="bg-background border border-border rounded-[18px] p-5 grid gap-4">
            <div className="flex justify-between items-start gap-3 pb-4 border-b border-border">
              <div>
                <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-muted-foreground mb-1">Contrato de locación</p>
                <p className="text-[17px] font-extrabold tracking-[-0.01em]">Av. Cabildo 2380 · 4° B</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Locador · Locatario · Garantía</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-fg))]">
                <span className="w-1 h-1 rounded-full bg-current" />Vigente
              </span>
            </div>
            <div className="grid gap-0">
              {[
                { k: 'Inicio', v: '01 jul 2024' },
                { k: 'Plazo', v: '36 meses' },
                { k: 'Índice de ajuste', v: 'ICL (BCRA)' },
                { k: 'Próximo ajuste', v: 'Con aviso', up: true },
                { k: 'Garantía', v: 'Seguro de caución' },
              ].map(({ k, v, up }) => (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-2 py-2 border-b border-dashed border-border last:border-0">
                  <span className="text-[12.5px] text-muted-foreground">{k}</span>
                  <span className={cn("text-[12.5px] font-bold tabular", up && "text-primary")}>{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted-foreground">Firma del locatario</span>
              <span className="font-['Caveat','Brush_Script_MT',cursive] text-[22px] text-primary font-semibold tracking-tight">
                Firma digital
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Importá tu cartera',
    desc: 'Subí planilla Excel o cargá tus propiedades manualmente. Mapeamos contratos, inquilinos y vencimientos en minutos.',
  },
  {
    num: '02',
    title: 'Conectá tus cuentas',
    desc: 'AFIP y MercadoPago. Las cobranzas se concilian solas y la facturación electrónica se emite cuando toca.',
  },
  {
    num: '03',
    title: 'Operá con calma',
    desc: 'Tu equipo entra al panel, los propietarios al portal y los inquilinos a su cuenta corriente. Mismo dato, vistas distintas.',
  },
];

function HowItWorks() {
  return (
    <section id="integraciones" className="py-20">
      <div className="max-w-6xl mx-auto px-7">
        <div className="text-center mb-14">
          <Eyebrow center>Cómo funciona</Eyebrow>
          <h2 className="text-[clamp(1.7rem,1.2rem+1.4vw,2.4rem)] font-extrabold tracking-[-0.02em] leading-[1.12] text-foreground mb-3"
            style={{ textWrap: 'balance' } as React.CSSProperties}>
            Migrar tu cartera lleva una mañana, no un trimestre.
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-[1.6] max-w-[52ch] mx-auto">
            Importás tus contratos, conectás MercadoPago y AFIP, y el primer cierre del mes corre solo.
          </p>
        </div>
        <div className="bg-card border border-border rounded-[20px] overflow-hidden">
          <div className="grid md:grid-cols-3">
            {STEPS.map(({ num, title, desc }, i) => (
              <div key={num} className={cn("p-8", i < STEPS.length - 1 && "md:border-r border-b md:border-b-0 border-border")}>
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground font-mono mb-4">
                  PASO {num}
                </p>
                <h4 className="text-[17px] font-bold tracking-[-0.01em] mb-2">{title}</h4>
                <p className="text-[14px] text-muted-foreground leading-[1.55]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  'Generador de contratos + plantillas',
  'Registro de ajustes ICL/IPC/CER',
  'Cobranzas con MercadoPago',
  'Portal propietario e inquilino',
  'Centro de liquidaciones',
  'Facturación AFIP / ARCA',
  'Mantenimiento con proveedores',
  'Casos legales y mediación',
  'Asistente IA con datos propios',
  'Panel analítico avanzado',
];

function Pricing() {
  const featured = BILLING_TIERS[2]; // Hasta 75 — punto medio

  return (
    <section id="precios" className="py-20 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-7">
        <div className="text-center mb-14">
          <Eyebrow center>Precios</Eyebrow>
          <h2 className="text-[clamp(1.7rem,1.2rem+1.4vw,2.4rem)] font-extrabold tracking-[-0.02em] leading-[1.12] text-foreground mb-3"
            style={{ textWrap: 'balance' } as React.CSSProperties}>
            Pagás por contrato vigente, no por usuario.
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-[1.6] max-w-[52ch] mx-auto">
            Sin costos de implementación ni de cancelación. Si bajás la cartera un mes, baja la factura.
          </p>
        </div>

        {/* Trial banner */}
        <div className="flex items-center gap-3 p-4 mb-8 rounded-xl bg-[hsl(var(--status-paid-bg))] border border-[hsl(var(--status-paid-fg)_/_0.2)]">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <p className="text-[14px] font-semibold text-[hsl(var(--status-paid-fg))]">
            <strong>Período de prueba gratuito:</strong> hasta {TRIAL_TIER.maxUnits} contratos durante 7 días, sin tarjeta requerida.
          </p>
        </div>

        {/* Tiers grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {BILLING_TIERS.map(tier => {
            const isF = tier.id === featured.id;
            return (
              <div key={tier.id} className={cn(
                "bg-background border rounded-[18px] p-7 flex flex-col gap-5 relative",
                isF ? "border-primary shadow-primary" : "border-border",
              )}>
                {isF && (
                  <span className="absolute -top-3 left-6 bg-primary text-primary-foreground text-[10.5px] font-bold tracking-[0.1em] uppercase px-3 py-1.5 rounded-full">
                    Más elegida
                  </span>
                )}
                <div>
                  <p className="text-[13px] font-bold text-muted-foreground mb-1">{tier.label}</p>
                  <p className={cn("text-[12px] font-semibold", isF ? "text-primary" : "text-muted-foreground/70")}>
                    Todas las funciones incluidas
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[2.4rem] font-extrabold tracking-[-0.03em] tabular leading-none">
                    {fmtARS(tier.priceARS)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">ARS / mes</span>
                </div>
                <hr className="border-border" />
                <ul className="grid gap-2.5">
                  {PLAN_FEATURES.slice(0, 5).map(f => (
                    <li key={f} className="flex items-start gap-2 text-[13px] leading-snug">
                      <Tick />
                      {f}
                    </li>
                  ))}
                  <li className="text-[12px] text-muted-foreground pl-6 italic">+ todos los módulos</li>
                </ul>
                <Link href="/login"
                  className={cn(
                    "mt-auto inline-flex items-center justify-center h-11 rounded-xl text-[14px] font-semibold transition-colors",
                    isF
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary"
                      : "border border-border bg-card hover:bg-muted",
                  )}>
                  {isF ? 'Probar 7 días gratis' : 'Empezar'}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Enterprise row */}
        <div className="bg-background border border-border rounded-[18px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-bold mb-1">Carteras sin límite — Empresa</p>
            <p className="text-[13.5px] text-muted-foreground">
              Más de 200 contratos · Multi-sucursal · SLA dedicado · Integraciones a medida (ERP, CRM)
            </p>
          </div>
          <Link href="/login"
            className="flex-shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-border bg-card hover:bg-muted text-[14px] font-semibold transition-colors whitespace-nowrap">
            Hablar con ventas
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-[12px] text-center text-muted-foreground mt-4">
          Los precios en ARS pueden ajustarse según inflación. Sin costos de setup ni cancelación anticipada.
        </p>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: '¿Cómo se aplica el ajuste por ICL?',
    a: 'El sistema calcula la fecha del próximo ajuste según el contrato (3, 6 o 12 meses) y te avisa cuando se acerca. Vos cargás el índice ICL/IPC/CER publicado por el BCRA o INDEC y el nuevo canon; nosotros generamos la notificación al locatario y dejamos el detalle registrado en el historial del contrato.',
  },
  {
    q: '¿Funciona si todavía no facturo electrónicamente?',
    a: 'Sí. Podés operar sin conectar AFIP durante el período de prueba; cuando estés listo, conectamos tu CUIT y empezamos a emitir comprobantes desde la plataforma. No es obligatorio para empezar.',
  },
  {
    q: '¿Mis datos quedan protegidos?',
    a: 'Toda la información de tu cartera se almacena con encriptación en tránsito y en reposo, con backup diario. Cumplimos con la Ley 25.326 de protección de datos personales.',
  },
  {
    q: '¿Qué pasa con los contratos que ya tengo firmados?',
    a: 'Los importás como están. Subís el PDF, completás los datos clave (canon, plazo, índice de ajuste) y el sistema toma todo desde ahí: vencimientos, cobranzas y ajustes corren con tu contrato vigente.',
  },
  {
    q: '¿Puede usarlo un solo propietario, sin inmobiliaria?',
    a: `Sí. Si administrás hasta ${BILLING_TIERS[0].maxUnits} propiedades por tu cuenta, el plan inicial (${fmtARS(BILLING_TIERS[0].priceARS)}/mes) te alcanza. Tenés el generador de contratos, las cobranzas y el portal del inquilino — sin necesidad de una inmobiliaria de por medio.`,
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20">
      <div className="max-w-6xl mx-auto px-7">
        <div className="text-center mb-14">
          <Eyebrow center>Preguntas frecuentes</Eyebrow>
          <h2 className="text-[clamp(1.7rem,1.2rem+1.4vw,2.4rem)] font-extrabold tracking-[-0.02em] leading-[1.12] text-foreground"
            style={{ textWrap: 'balance' } as React.CSSProperties}>
            Lo que nos preguntan antes de empezar.
          </h2>
        </div>
        <div className="max-w-[820px] mx-auto grid gap-2">
          {FAQS.map(({ q, a }, i) => (
            <div key={q}
              className={cn("bg-card border rounded-[14px] overflow-hidden transition-colors",
                open === i ? "border-primary/40" : "border-border"
              )}>
              <button
                className="w-full flex items-center justify-between gap-3 px-6 py-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-[15.5px] font-semibold tracking-[-0.005em]">{q}</span>
                <span className={cn(
                  "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                  open === i ? "bg-primary text-primary-foreground rotate-45" : "bg-muted text-foreground",
                )}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-5 pt-0 border-t border-border">
                  <p className="text-[14.5px] text-muted-foreground leading-[1.65] pt-4">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section id="cta" className="py-14">
      <div className="max-w-6xl mx-auto px-7">
        <div
          className="relative overflow-hidden rounded-3xl px-12 py-14 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center"
          style={{ background: 'linear-gradient(135deg, hsl(142 70% 22%), hsl(142 62% 30%))' }}
        >
          <div className="absolute right-0 top-0 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(closest-side, hsl(155 55% 76% / 0.2), transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px w-4 bg-[#7DD3FC]" />
              <span className="text-[11px] font-black tracking-[0.22em] uppercase text-[#7DD3FC]">Empezá hoy</span>
            </div>
            <h3
              className="text-[clamp(1.45rem,1.1rem+1.2vw,2rem)] font-extrabold tracking-[-0.02em] leading-[1.15] text-white mb-3"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              Probá AlquilaGestión Pro 7 días, sin tarjeta.
            </h3>
            <p className="text-[15px] text-white/75 leading-[1.55] max-w-[52ch]">
              Te ayudamos a importar tu cartera el mismo día. Si al final del trial no te suma, no pagás nada.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3 md:justify-end">
            <Link href="/login"
              className="inline-flex items-center gap-2 h-[52px] px-6 rounded-xl bg-white text-primary text-[15px] font-bold hover:bg-white/90 transition-colors" style={{ boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)' }}>
              Crear cuenta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center h-[52px] px-6 rounded-xl border border-white/30 text-white text-[15px] font-semibold hover:bg-white/10 transition-colors">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────
const FOOTER_LINKS = [
  {
    title: 'Producto',
    links: [
      { label: 'Funcionalidades', href: '#producto' },
      { label: 'Precios', href: '#precios' },
      { label: 'Para quién', href: '#roles' },
      { label: 'Preguntas frecuentes', href: '#faq' },
    ],
  },
  {
    title: 'Soluciones',
    links: [
      { label: 'Inmobiliarias', href: '#roles' },
      { label: 'Propietarios', href: '#roles' },
      { label: 'Inquilinos', href: '#roles' },
      { label: 'Latinoamérica', href: '#producto' },
    ],
  },
  {
    title: 'Acceso',
    links: [
      { label: 'Iniciar sesión', href: '/login' },
      { label: 'Registrarse', href: '/login' },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-border bg-card pt-14 pb-6">
      <div className="max-w-6xl mx-auto px-7">

        {/* Botón de arrepentimiento — Ley 24.240 Art. 34 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 mb-10 rounded-xl border border-[hsl(var(--status-pending-bg))] bg-[hsl(var(--status-pending-bg))]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-pending-fg))] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13.5px] font-bold text-[hsl(var(--status-pending-fg))] leading-snug">
                Derecho de arrepentimiento — Ley 24.240 Art. 34
              </p>
              <p className="text-[12.5px] text-[hsl(var(--status-pending-fg))]/80 leading-snug mt-0.5">
                Si contrataste por medios electrónicos, podés revocar sin costo dentro de los <strong>10 días corridos</strong> desde la suscripción.
              </p>
            </div>
          </div>
          <a
            href="mailto:arrepentimiento@alquilagestion.pro?subject=Solicitud%20de%20arrepentimiento%20—%20Ley%2024.240&body=Nombre%3A%0AEmail%20de%20la%20cuenta%3A%0AFecha%20de%20contrataci%C3%B3n%3A%0AMotivo%20(opcional)%3A"
            className="flex-shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[hsl(var(--status-pending-fg))]/30 text-[13px] font-semibold text-[hsl(var(--status-pending-fg))] hover:bg-[hsl(var(--status-pending-fg))]/10 transition-colors whitespace-nowrap"
          >
            Ejercer arrepentimiento
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid md:grid-cols-[1.4fr_repeat(3,1fr)_1fr] gap-8 mb-12">
          <div>
            <Link href="/landing" className="flex items-center gap-2.5 mb-4">
              <AppLogo size={30} />
              <div className="leading-none">
                <span className="block text-[9px] font-black tracking-[0.28em] uppercase text-muted-foreground">ALQUILA</span>
                <div className="flex items-baseline">
                  <span className="text-[15px] font-bold text-primary leading-none">Gestión</span>
                  <span className="text-[15px] font-bold text-foreground leading-none">Pro</span>
                </div>
              </div>
            </Link>
            <p className="text-[13.5px] text-muted-foreground leading-[1.55] max-w-[30ch]">
              Plataforma de gestión de alquileres para Argentina y Latinoamérica.
            </p>
            <div className="flex items-center gap-1.5 mt-3">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11.5px] text-muted-foreground">Ley 25.326 · Datos en Argentina</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11.5px] text-muted-foreground">Disponible en toda Latinoamérica</span>
            </div>
          </div>
          {FOOTER_LINKS.map(({ title, links }) => (
            <div key={title}>
              <h5 className="eyebrow text-muted-foreground mb-4">{title}</h5>
              <ul className="grid gap-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[13.5px] text-foreground hover:text-primary transition-colors">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h5 className="eyebrow text-muted-foreground mb-4">Legal</h5>
            <ul className="grid gap-2.5">
              <li><a href="#" className="text-[13.5px] text-foreground hover:text-primary transition-colors">Términos y condiciones</a></li>
              <li><a href="#" className="text-[13.5px] text-foreground hover:text-primary transition-colors">Política de privacidad</a></li>
              <li><a href="#" className="text-[13.5px] text-foreground hover:text-primary transition-colors">Política de cancelación</a></li>
              <li>
                <a
                  href="mailto:arrepentimiento@alquilagestion.pro?subject=Solicitud%20de%20arrepentimiento%20—%20Ley%2024.240&body=Nombre%3A%0AEmail%20de%20la%20cuenta%3A%0AFecha%20de%20contrataci%C3%B3n%3A"
                  className="text-[13.5px] text-[hsl(var(--status-pending-fg))] font-semibold hover:underline transition-colors"
                >
                  Botón de arrepentimiento
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border">
          <span className="text-[12.5px] text-muted-foreground">
            © 2026 AlquilaGestión Pro · Buenos Aires, Argentina
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>Ley 25.326</span>
            <span>·</span>
            <span>Ley 24.240</span>
            <span>·</span>
            <a href="#" className="hover:text-primary transition-colors">Términos</a>
            <span>·</span>
            <a href="#" className="hover:text-primary transition-colors">Privacidad</a>
            <span>·</span>
            <a
              href="mailto:arrepentimiento@alquilagestion.pro?subject=Solicitud%20de%20arrepentimiento%20—%20Ley%2024.240&body=Nombre%3A%0AEmail%20de%20la%20cuenta%3A%0AFecha%20de%20contrataci%C3%B3n%3A"
              className="hover:text-primary transition-colors font-medium"
            >
              Arrepentimiento
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <Nav scrolled={scrolled} />
      <Hero onOpenDemo={() => setDemoOpen(true)} />
      <Roles />
      <Features />
      <ContractShowcase />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
