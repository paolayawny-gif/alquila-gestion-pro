"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Shared chrome wrapper
// ─────────────────────────────────────────────────────────────────────────────
function AppChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0a1120] border-b border-white/5 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-red-500/60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
        <div className="w-2 h-2 rounded-full bg-green-500/60" />
        <div className="ml-2 flex-1 h-4 max-w-[160px] rounded bg-white/8 text-[8px] text-white/35 flex items-center px-2 truncate">{url}</div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG mini charts
// ─────────────────────────────────────────────────────────────────────────────

function AreaChart({ data, color = '#38bdf8', h = 48 }: { data: number[]; color?: string; h?: number }) {
  const w = 220;
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.85;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * (h - 6) - 3;
    return `${x},${y}`;
  });
  const linePath = `M ${pts.join(' L ')}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} aria-hidden="true">
      <defs>
        <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#g${color.replace('#','')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBarChart({ data }: { data: { label: string; ing: number; eg: number }[] }) {
  const max = Math.max(...data.map(d => d.ing));
  return (
    <div className="flex items-end gap-1 h-14" aria-hidden="true">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col-reverse gap-0.5">
            <div className="w-full rounded-t-sm bg-sky-500/70" style={{ height: Math.max(2, (d.ing / max) * 40) }} />
            <div className="w-full rounded-t-sm bg-rose-400/40" style={{ height: Math.max(2, (d.eg / max) * 14) }} />
          </div>
          <span className="text-white/25 text-[7px]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function IclLineChart() {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago'];
  const base = 380000;
  const values = [1, 1.082, 1.17, 1.265, 1.37, 1.485, 1.61, 1.745].map(v => v * base);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-white/40 text-[8px]">Evolución de alquiler con ajuste ICL</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[7px] font-bold border border-amber-500/30">ICL BCRA</span>
      </div>
      <AreaChart data={values} color="#f59e0b" h={52} />
      <div className="flex justify-between">
        {months.map(m => <span key={m} className="text-white/25 text-[7px]">{m}</span>)}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div>
          <div className="text-white/40 text-[7px]">Alquiler inicial</div>
          <div className="text-white text-[10px] font-bold">$380.000</div>
        </div>
        <div className="text-white/30 text-[10px]">→</div>
        <div className="text-right">
          <div className="text-white/40 text-[7px]">Alquiler actual (Ago)</div>
          <div className="text-emerald-400 text-[11px] font-bold">$662.900</div>
        </div>
        <div className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[7px] font-semibold border border-emerald-500/30">+74.5%</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene visual components
// ─────────────────────────────────────────────────────────────────────────────

function VisualBienvenida() {
  return (
    <AppChrome url="alquilagestion.pro">
      <div className="p-4 flex flex-col gap-3 h-full">
        <div className="text-center pt-2">
          <div className="w-10 h-10 rounded-xl bg-sky-600 mx-auto mb-2 flex items-center justify-center">
            <span className="text-white text-lg">🏠</span>
          </div>
          <div className="text-white font-bold text-sm">AlquilaGestión Pro</div>
          <div className="text-white/40 text-[8px] mt-0.5">Plataforma completa de administración</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: '📋', label: 'Contratos' },
            { icon: '💰', label: 'Cobranzas' },
            { icon: '📊', label: 'Reportes' },
            { icon: '🏛️', label: 'AFIP' },
            { icon: '🤖', label: 'Asistente IA' },
            { icon: '✍️', label: 'Firma digital' },
            { icon: '🌐', label: 'Portal' },
            { icon: '📱', label: 'MercadoPago' },
            { icon: '⚖️', label: 'Legal' },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-white/5 border border-white/5 p-2 flex flex-col items-center gap-1">
              <span className="text-base">{m.icon}</span>
              <span className="text-white/50 text-[7px] font-medium">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2 text-center">
          <div className="text-sky-300 text-[8px] font-semibold">Probá 7 días gratis · Sin tarjeta</div>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualDashboard() {
  const barData = [
    { label: 'Ene', ing: 58, eg: 12 },
    { label: 'Feb', ing: 65, eg: 14 },
    { label: 'Mar', ing: 62, eg: 13 },
    { label: 'Abr', ing: 74, eg: 15 },
    { label: 'May', ing: 85, eg: 16 },
    { label: 'Jun', ing: 100, eg: 18 },
  ];
  return (
    <AppChrome url="app.alquilagestion.pro/panel">
      <div className="p-3 flex flex-col gap-2.5 h-full">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Propiedades', value: '42', sub: '35 alquiladas', icon: '🏠', c: 'from-sky-500/20' },
            { label: 'Recaudado', value: '$6.1M', sub: '+12.5%', icon: '💰', c: 'from-emerald-500/20' },
            { label: 'En mora', value: '3', sub: '+1 este mes', icon: '⚠️', c: 'from-amber-500/20' },
          ].map(k => (
            <div key={k.label} className={cn('rounded-lg p-2 bg-gradient-to-br border border-white/5', k.c)}>
              <div className="text-sm">{k.icon}</div>
              <div className="text-white font-bold text-xs mt-1">{k.value}</div>
              <div className="text-white/45 text-[7px] mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/45 text-[8px]">Ingresos vs Egresos</span>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[7px] text-sky-400"><span className="w-2 h-1.5 rounded-sm bg-sky-500/70 inline-block"/>Ing.</span>
              <span className="flex items-center gap-1 text-[7px] text-rose-400"><span className="w-2 h-1.5 rounded-sm bg-rose-400/40 inline-block"/>Eg.</span>
            </div>
          </div>
          <MiniBarChart data={barData} />
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 flex items-center gap-2">
          <span className="text-amber-400 text-xs">⏰</span>
          <div>
            <div className="text-amber-300 text-[8px] font-semibold">2 ajustes esta semana</div>
            <div className="text-white/35 text-[7px]">Av. Libertador — ICL · San Martín — IPC</div>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualPropiedades() {
  return (
    <AppChrome url="app.alquilagestion.pro/propiedades">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Propiedades</span>
          <div className="flex gap-1.5">
            <div className="h-5 px-2 rounded bg-white/8 text-white/45 text-[8px] flex items-center">Filtrar</div>
            <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">+ Nueva</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 flex-1">
          {[
            { addr: 'Av. Libertador 1234', type: 'Departamento', status: 'Alquilado', tenant: 'Juan Pérez', rent: '$380.000', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            { addr: 'San Martín 432', type: 'Casa', status: 'Disponible', tenant: 'Sin asignar', rent: '—', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
            { addr: 'Belgrano 98, 3°B', type: 'Depto', status: 'Alquilado', tenant: 'M. García', rent: '$290.000', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            { addr: 'Local Centro 5', type: 'Comercial', status: 'Alquilado', tenant: 'Kiosko El Sol', rent: '$520.000', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
          ].map((p, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2 flex flex-col gap-1">
              <span className={cn('self-start px-1 py-0.5 rounded text-[7px] font-semibold border', p.color)}>{p.status}</span>
              <div className="h-7 rounded bg-white/5 flex items-center justify-center"><span className="text-white/20 text-base">🏠</span></div>
              <div className="text-white text-[8px] font-semibold leading-tight truncate">{p.addr}</div>
              <div className="text-white/35 text-[7px]">{p.type} · {p.tenant}</div>
              {p.rent !== '—' && <div className="text-sky-400 text-[8px] font-bold">{p.rent}</div>}
            </div>
          ))}
        </div>
      </div>
    </AppChrome>
  );
}

function VisualContratos() {
  return (
    <AppChrome url="app.alquilagestion.pro/contratos">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Contratos</span>
          <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">+ Nuevo</div>
        </div>
        {[
          { prop: 'Av. Libertador 1234', tenant: 'Juan Pérez', rent: '$380.000', idx: 'ICL', next: '01/03/2025', dur: '24 meses' },
          { prop: 'Belgrano 98, 3°B', tenant: 'María García', rent: '$290.000', idx: 'IPC', next: '15/12/2024', dur: '24 meses' },
          { prop: 'Local Comercial Centro', tenant: 'Kiosko El Sol', rent: '$520.000', idx: 'CER', next: '01/07/2025', dur: '36 meses' },
        ].map((c, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-white text-[9px] font-semibold truncate flex-1">{c.prop}</span>
              <span className="px-1 py-0.5 rounded text-[7px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ml-1">Vigente</span>
            </div>
            <div className="text-white/40 text-[7px]">Inquilino: {c.tenant} · {c.dur}</div>
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sky-400 text-[9px] font-bold">{c.rent}</span>
                <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[7px] font-bold border border-amber-500/30">{c.idx}</span>
              </div>
              <span className="text-white/30 text-[7px]">Próx. ajuste: {c.next}</span>
            </div>
          </div>
        ))}
        <div className="flex gap-1.5 mt-auto">
          <div className="flex-1 h-6 rounded bg-white/5 border border-white/5 text-white/40 text-[7px] flex items-center justify-center">Ver PDF</div>
          <div className="flex-1 h-6 rounded bg-sky-600/40 border border-sky-500/30 text-sky-300 text-[7px] flex items-center justify-center">Aplicar ajuste</div>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualAjusteICL() {
  return (
    <AppChrome url="app.alquilagestion.pro/contratos/ajuste">
      <div className="p-3 flex flex-col gap-2.5 h-full">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">📊</span>
            <div>
              <div className="text-amber-300 text-[9px] font-bold">Ajuste automático listo — ICL BCRA</div>
              <div className="text-white/40 text-[7px]">Av. Libertador 1234 · Contrato #CON-2024-001</div>
            </div>
          </div>
        </div>
        <IclLineChart />
        <div className="grid grid-cols-2 gap-1.5 mt-auto">
          <div className="rounded-lg bg-white/5 border border-white/5 p-2">
            <div className="text-white/40 text-[7px]">Variación ICL</div>
            <div className="text-emerald-400 text-[11px] font-bold mt-0.5">+74.5%</div>
            <div className="text-white/30 text-[7px]">Ene → Ago 2024</div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/5 p-2">
            <div className="text-white/40 text-[7px]">Nuevo monto</div>
            <div className="text-sky-400 text-[11px] font-bold mt-0.5">$662.900</div>
            <div className="text-white/30 text-[7px]">Desde 01/08/2024</div>
          </div>
        </div>
        <div className="h-6 rounded bg-sky-600 text-white text-[8px] font-semibold flex items-center justify-center">
          Confirmar y notificar al inquilino →
        </div>
      </div>
    </AppChrome>
  );
}

function VisualPagos() {
  return (
    <AppChrome url="app.alquilagestion.pro/pagos">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Cobranzas — Octubre 2024</span>
          <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">+ Registrar</div>
        </div>
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
          <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-1.5 text-center">
            <div className="text-emerald-400 text-[10px] font-bold">28</div>
            <div className="text-white/35 text-[7px]">Cobrados</div>
          </div>
          <div className="rounded bg-amber-500/10 border border-amber-500/20 p-1.5 text-center">
            <div className="text-amber-400 text-[10px] font-bold">8</div>
            <div className="text-white/35 text-[7px]">Pendientes</div>
          </div>
          <div className="rounded bg-rose-500/10 border border-rose-500/20 p-1.5 text-center">
            <div className="text-rose-400 text-[10px] font-bold">3</div>
            <div className="text-white/35 text-[7px]">Vencidos</div>
          </div>
        </div>
        {[
          { prop: 'Av. Libertador 1234', tenant: 'J. Pérez', amount: '$380.000', status: 'PAGADO', sc: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', action: null },
          { prop: 'San Martín 432', tenant: 'M. López', amount: '$450.000', status: 'PENDIENTE', sc: 'bg-amber-500/15 text-amber-300 border-amber-500/25', action: 'Generar link MP' },
          { prop: 'Belgrano 98 3°B', tenant: 'M. García', amount: '$290.000', status: 'VENCIDO', sc: 'bg-rose-500/15 text-rose-300 border-rose-500/25', action: 'Enviar aviso' },
        ].map((p, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2 flex items-center gap-2">
            <span className={cn('px-1 py-0.5 rounded text-[6px] font-bold border flex-shrink-0', p.sc)}>{p.status}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[8px] font-semibold truncate">{p.prop}</div>
              <div className="text-white/35 text-[7px]">{p.tenant}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sky-400 text-[8px] font-bold">{p.amount}</span>
              {p.action && (
                <span className="px-1.5 py-0.5 rounded bg-[#009ee3]/20 text-[#7dd3fc] text-[6px] font-semibold border border-[#009ee3]/25 whitespace-nowrap">{p.action}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppChrome>
  );
}

function VisualLiquidaciones() {
  return (
    <AppChrome url="app.alquilagestion.pro/liquidaciones">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Liquidaciones — Oct 2024</span>
          <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">Generar</div>
        </div>
        {[
          { owner: 'Carlos Fernández', props: 3, collected: '$1.140.000', commission: '$114.000 (10%)', net: '$1.026.000' },
          { owner: 'Ana Rodríguez', props: 2, collected: '$670.000', commission: '$53.600 (8%)', net: '$616.400' },
        ].map((l, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-white text-[9px] font-semibold">{l.owner}</span>
              <span className="px-1 py-0.5 rounded text-[7px] bg-sky-500/20 text-sky-300 border border-sky-500/30">{l.props} propiedades</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="rounded bg-white/5 p-1">
                <div className="text-white/35 text-[6px]">Recaudado</div>
                <div className="text-white text-[8px] font-semibold">{l.collected}</div>
              </div>
              <div className="rounded bg-white/5 p-1">
                <div className="text-white/35 text-[6px]">Comisión</div>
                <div className="text-amber-400 text-[8px] font-semibold">{l.commission}</div>
              </div>
              <div className="rounded bg-emerald-500/10 p-1">
                <div className="text-white/35 text-[6px]">Neto propietario</div>
                <div className="text-emerald-400 text-[8px] font-semibold">{l.net}</div>
              </div>
            </div>
            <div className="flex gap-1">
              <div className="flex-1 h-5 rounded bg-white/5 text-white/40 text-[7px] flex items-center justify-center">Ver detalle</div>
              <div className="flex-1 h-5 rounded bg-sky-600/40 text-sky-300 text-[7px] flex items-center justify-center">Descargar PDF</div>
            </div>
          </div>
        ))}
        <div className="rounded-lg bg-white/5 border border-white/5 p-2 text-center mt-auto">
          <span className="text-white/35 text-[7px]">Liquidación automática por propietario · reparto configurable</span>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualPersonas() {
  return (
    <AppChrome url="app.alquilagestion.pro/personas">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Personas</span>
          <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">+ Agregar</div>
        </div>
        <div className="h-6 rounded-lg bg-white/5 border border-white/5 flex items-center px-2.5 gap-1.5 flex-shrink-0">
          <span className="text-white/25 text-[8px]">🔍</span>
          <span className="text-white/25 text-[8px]">Buscar por nombre o DNI...</span>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {['Todos', 'Inquilinos', 'Propietarios', 'Garantes'].map((t, i) => (
            <span key={t} className={cn('px-2 py-0.5 rounded-full text-[7px] font-semibold', i === 0 ? 'bg-sky-600 text-white' : 'bg-white/5 text-white/40')}>{t}</span>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          {[
            { name: 'Juan Pérez', dni: 'DNI 28.456.789', phone: '+54 11 4567-8901', role: 'Inquilino', color: 'bg-sky-500/15 text-sky-300' },
            { name: 'Carlos Fernández', dni: 'CUIT 20-28456789-1', phone: '+54 11 9876-5432', role: 'Propietario', color: 'bg-purple-500/15 text-purple-300' },
            { name: 'Ana López', dni: 'DNI 25.678.901', phone: '+54 11 3456-7890', role: 'Garante', color: 'bg-amber-500/15 text-amber-300' },
            { name: 'María García', dni: 'DNI 31.234.567', phone: '+54 11 2345-6789', role: 'Inquilina', color: 'bg-sky-500/15 text-sky-300' },
          ].map((p, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/5 px-2.5 py-1.5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[10px]">👤</div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[9px] font-semibold">{p.name}</div>
                <div className="text-white/35 text-[7px]">{p.dni}</div>
              </div>
              <span className={cn('px-1.5 py-0.5 rounded text-[6px] font-semibold', p.color)}>{p.role}</span>
            </div>
          ))}
        </div>
      </div>
    </AppChrome>
  );
}

function VisualTickets() {
  return (
    <AppChrome url="app.alquilagestion.pro/reclamos">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Reclamos & Mantenimiento</span>
          <div className="h-5 px-2 rounded bg-sky-600 text-white text-[8px] flex items-center font-semibold">+ Nuevo</div>
        </div>
        {[
          { title: 'Filtración en baño principal', prop: 'San Martín 432', date: 'Hace 2 días', status: 'PENDIENTE', sc: 'bg-amber-500/15 text-amber-300 border-amber-500/25', icon: '🔧' },
          { title: 'Estufa rota — requiere cambio', prop: 'Belgrano 98, 3°B', date: 'Hace 5 días', status: 'COTIZANDO', sc: 'bg-sky-500/15 text-sky-300 border-sky-500/25', icon: '🔥' },
          { title: 'Cerradura puerta entrada', prop: 'Av. Libertador 1234', date: 'Hace 1 semana', status: 'RESUELTO', sc: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', icon: '🔒' },
        ].map((t, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[9px] font-semibold leading-tight">{t.title}</div>
                <div className="text-white/35 text-[7px] mt-0.5">{t.prop} · {t.date}</div>
              </div>
              <span className={cn('px-1 py-0.5 rounded text-[6px] font-bold border flex-shrink-0', t.sc)}>{t.status}</span>
            </div>
            <div className="flex gap-1">
              <div className="flex-1 h-5 rounded bg-white/5 text-white/35 text-[7px] flex items-center justify-center">Ver detalle</div>
              <div className="flex-1 h-5 rounded bg-white/5 text-white/35 text-[7px] flex items-center justify-center">Notificar propietario</div>
            </div>
          </div>
        ))}
      </div>
    </AppChrome>
  );
}

function VisualAFIP() {
  return (
    <AppChrome url="app.alquilagestion.pro/facturacion">
      <div className="p-3 flex flex-col gap-2.5 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="text-white text-xs font-bold">Facturación AFIP / ARCA</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[7px] font-semibold border border-emerald-500/25">Conectado</span>
        </div>
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 flex items-center gap-2.5">
          <span className="text-2xl">🏛️</span>
          <div>
            <div className="text-blue-300 text-[9px] font-bold">CUIT conectado</div>
            <div className="text-white/45 text-[7px]">20-28456789-1 · Administrador certificado</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          {[
            { month: 'Octubre 2024', count: '38 facturas', total: '$14.820.000', status: 'Emitidas' },
            { month: 'Septiembre 2024', count: '35 facturas', total: '$13.650.000', status: 'Emitidas' },
            { month: 'Agosto 2024', count: '37 facturas', total: '$13.200.000', status: 'Emitidas' },
          ].map((f, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="text-white text-[9px] font-semibold">{f.month}</div>
                <div className="text-white/35 text-[7px]">{f.count}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 text-[9px] font-bold">{f.total}</div>
                <span className="px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[6px]">{f.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white/5 border border-white/5 p-2 text-center">
          <span className="text-white/35 text-[7px]">Factura electrónica tipo B / C · Auto-generación al registrar cobro</span>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualAsistenteIA() {
  return (
    <AppChrome url="app.alquilagestion.pro/ayuda">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-lg bg-sky-600 flex items-center justify-center text-xs">🤖</div>
          <div>
            <div className="text-white text-[9px] font-bold">AGP Help — Asistente IA</div>
            <div className="text-white/35 text-[7px]">Siempre disponible</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
          <div className="self-start max-w-[85%] rounded-xl rounded-tl-sm bg-white/8 border border-white/5 p-2">
            <p className="text-white/70 text-[8px] leading-relaxed">¿Cuándo se aplica el próximo ajuste por ICL del contrato de Av. Libertador 1234?</p>
          </div>
          <div className="self-end max-w-[85%] rounded-xl rounded-tr-sm bg-sky-600/30 border border-sky-500/25 p-2">
            <p className="text-sky-100 text-[8px] leading-relaxed">El próximo ajuste es el <strong>1 de marzo de 2025</strong>. La variación ICL acumulada desde el inicio es de +74.5%. El nuevo monto estimado será de <strong>$662.900</strong>. ¿Querés que genere la notificación para el inquilino?</p>
          </div>
          <div className="self-start max-w-[85%] rounded-xl rounded-tl-sm bg-white/8 border border-white/5 p-2">
            <p className="text-white/70 text-[8px]">Sí, generala</p>
          </div>
          <div className="self-end max-w-[85%] rounded-xl rounded-tr-sm bg-sky-600/30 border border-sky-500/25 p-2">
            <p className="text-sky-100 text-[8px] leading-relaxed">✅ Notificación enviada a Juan Pérez (juan@email.com) con el detalle del ajuste.</p>
          </div>
        </div>
        <div className="h-7 rounded-lg bg-white/5 border border-white/8 flex items-center px-2.5 flex-shrink-0">
          <span className="text-white/20 text-[7px]">Preguntá cualquier cosa sobre tus contratos...</span>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualPortal() {
  return (
    <AppChrome url="tuinmobiliaria.alquilagestion.pro">
      <div className="p-3 flex flex-col gap-2 h-full">
        <div className="rounded-lg bg-sky-800/40 border border-sky-600/30 p-2.5 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-sky-200 text-[9px] font-bold">Portal — Tu Inmobiliaria</div>
            <div className="text-sky-400/60 text-[7px]">tuinmobiliaria.alquilagestion.pro</div>
          </div>
          <span className="h-5 px-2 rounded bg-emerald-500/20 text-emerald-300 text-[7px] font-semibold border border-emerald-500/30 flex items-center">🌐 Activo</span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          {[
            { addr: 'San Martín 432 — Rosario', type: '3 amb. · 75m²', price: '$450.000/mes', photos: 4 },
            { addr: 'Av. Corrientes 890 — CABA', type: '1 amb. · 38m²', price: '$320.000/mes', photos: 6 },
          ].map((p, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2 flex gap-2.5">
              <div className="w-14 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 relative">
                <span className="text-white/15 text-xl">🏠</span>
                <span className="absolute bottom-0.5 right-0.5 bg-black/50 text-white/60 text-[6px] px-0.5 rounded">{p.photos} fotos</span>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="text-white text-[8px] font-semibold leading-tight">{p.addr}</div>
                <div className="text-white/35 text-[7px]">{p.type}</div>
                <div className="text-sky-400 text-[9px] font-bold">{p.price}</div>
                <div className="h-5 rounded bg-sky-600/50 text-sky-200 text-[7px] font-semibold flex items-center justify-center">
                  Me interesa → Postularme
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-white/15 text-[7px]">Powered by AlquilaGestión Pro</div>
      </div>
    </AppChrome>
  );
}

function VisualPostulacion() {
  return (
    <AppChrome url="tuinmobiliaria.alquilagestion.pro/postulacion">
      <div className="p-3 flex flex-col gap-1.5 h-full">
        <div className="text-white text-[9px] font-bold flex-shrink-0">Postulación — San Martín 432</div>
        <div className="flex flex-col gap-1.5 flex-1">
          {[
            { label: 'Nombre', val: 'Juan Pérez', done: true },
            { label: 'Email', val: 'juan@email.com', done: true },
            { label: 'CUIT/CUIL', val: '20-28456789-1', done: true },
            { label: 'Ingreso mensual', val: '$ 900.000', done: true },
            { label: 'Tipo garantía', val: 'Propietario', done: true },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 text-[7px]', f.done ? 'bg-emerald-500/30 text-emerald-400' : 'bg-white/10 text-white/30')}>✓</div>
              <div className="flex-1 rounded bg-white/5 border border-white/5 px-2 py-1 flex justify-between">
                <span className="text-white/35 text-[7px]">{f.label}</span>
                <span className="text-white/65 text-[7px]">{f.val}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white/5 border border-white/5 p-2 flex-shrink-0">
          <div className="text-white/35 text-[7px] mb-1">Documentación adjunta</div>
          <div className="flex gap-1 flex-wrap">
            {['Recibo sueldo ✓', 'DNI frente ✓', 'DNI dorso ✓'].map(d => (
              <span key={d} className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[6px] border border-sky-500/25">{d}</span>
            ))}
          </div>
        </div>
        <div className="h-6 rounded-lg bg-sky-600 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
          Enviar postulación →
        </div>
      </div>
    </AppChrome>
  );
}

function VisualFirmaDigital() {
  return (
    <AppChrome url="app.alquilagestion.pro/contratos/firmar">
      <div className="p-3 flex flex-col gap-2.5 h-full">
        <div className="text-white text-[9px] font-bold flex-shrink-0">Firma Digital — Contrato #CON-2024-001</div>
        <div className="rounded-lg bg-white/5 border border-white/8 p-3 flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[8px]">Contrato de Locación</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[7px] border border-purple-500/25">Ley 27.551</span>
          </div>
          <div className="text-white/25 text-[7px] leading-relaxed line-clamp-3">
            Entre CARLOS FERNÁNDEZ (propietario) y JUAN PÉREZ (locatario), se acuerda el alquiler de Av. Libertador 1234, CABA, por $380.000 mensuales con ajuste anual ICL según resolución BCRA...
          </div>
          <div className="flex flex-col gap-1.5 mt-auto">
            {[
              { name: 'Carlos Fernández (Propietario)', status: 'Firmado', color: 'text-emerald-400', icon: '✅' },
              { name: 'Juan Pérez (Inquilino)', status: 'Firmado', color: 'text-emerald-400', icon: '✅' },
              { name: 'Ana López (Garante)', status: 'Pendiente', color: 'text-amber-400', icon: '⏳' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-white/55 text-[7px]">{s.icon} {s.name}</span>
                <span className={cn('text-[7px] font-semibold', s.color)}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <div className="flex-1 h-6 rounded bg-white/5 border border-white/5 text-white/40 text-[7px] flex items-center justify-center">Enviar recordatorio</div>
          <div className="flex-1 h-6 rounded bg-sky-600/40 text-sky-300 text-[7px] flex items-center justify-center">Descargar PDF firmado</div>
        </div>
      </div>
    </AppChrome>
  );
}

function VisualIntegraciones() {
  const ingresos = [4200000, 4800000, 4500000, 5600000, 6100000, 6800000];
  return (
    <AppChrome url="app.alquilagestion.pro">
      <div className="p-3 flex flex-col gap-2.5 h-full">
        <div className="text-center flex-shrink-0">
          <div className="text-white text-[10px] font-bold mb-0.5">Todo integrado desde el día 1</div>
          <div className="text-white/35 text-[7px]">Sin configuraciones complejas</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
          {[
            { name: 'AFIP / ARCA', desc: 'Facturación electrónica', icon: '🏛️', color: 'border-blue-500/25 bg-blue-500/8' },
            { name: 'BCRA — ICL', desc: 'Índices de ajuste en tiempo real', icon: '📊', color: 'border-sky-500/25 bg-sky-500/8' },
            { name: 'MercadoPago', desc: 'Links de cobro instantáneos', icon: '💳', color: 'border-[#009ee3]/25 bg-[#009ee3]/8' },
            { name: 'Firma Digital', desc: 'Contratos con validez legal', icon: '✍️', color: 'border-purple-500/25 bg-purple-500/8' },
          ].map((item) => (
            <div key={item.name} className={cn('rounded-xl border p-2 flex items-center gap-2', item.color)}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <div>
                <div className="text-white text-[8px] font-bold">{item.name}</div>
                <div className="text-white/35 text-[6px] leading-tight">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-lg bg-white/5 border border-white/5 p-2">
          <div className="text-white/35 text-[7px] mb-1.5">Ingresos anuales acumulados</div>
          <AreaChart data={ingresos} color="#38bdf8" h={44} />
          <div className="flex justify-between mt-1">
            {['Ene','Feb','Mar','Abr','May','Jun'].map(m => <span key={m} className="text-white/20 text-[6px]">{m}</span>)}
          </div>
        </div>
        <div className="rounded-lg bg-sky-600 p-2.5 text-center flex-shrink-0">
          <div className="text-white text-[9px] font-bold">7 días gratis · Sin tarjeta</div>
          <div className="text-sky-200 text-[7px] mt-0.5">Empezá ahora →</div>
        </div>
      </div>
    </AppChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene definitions
// ─────────────────────────────────────────────────────────────────────────────

const SCENES = [
  {
    id: 'bienvenida',
    title: 'Todo lo que necesitás para administrar alquileres',
    subtitle: 'Una plataforma, todas las herramientas',
    description: 'AlquilaGestión Pro integra contratos, cobranzas, ajustes de alquiler, AFIP, MercadoPago, firma digital y un asistente inteligente — todo en un solo lugar, sin hojas de cálculo ni papeles.',
    narration: 'AlquilaGestión Pro es la plataforma completa para administrar tu cartera de alquileres. Contratos, cobranzas, ajustes automáticos, AFIP, MercadoPago, firma digital y asistente inteligente, todo en un solo lugar.',
    tags: ['Visión general'],
    Visual: VisualBienvenida,
  },
  {
    id: 'dashboard',
    title: 'Panel central en tiempo real',
    subtitle: 'Tu cartera, de un vistazo',
    description: 'Al ingresar ves el estado completo de tu cartera: propiedades ocupadas, recaudación del mes, inquilinos en mora y alertas de ajustes. Con gráfico de ingresos vs egresos de los últimos 6 meses.',
    narration: 'El dashboard te muestra en tiempo real el estado de toda tu cartera. Cuánto recaudaste este mes, cuántas propiedades están ocupadas, quién está en mora, y los contratos que necesitan ajuste esta semana. Todo sin buscar en ninguna hoja de cálculo.',
    tags: ['Dashboard', 'KPIs', 'Gráficos'],
    Visual: VisualDashboard,
  },
  {
    id: 'propiedades',
    title: 'Catálogo de propiedades',
    subtitle: 'Todo tu inventario organizado',
    description: 'Registrá cada propiedad con dirección, tipo, fotos, monto y propietario. El sistema te indica en un vistazo qué está alquilado, disponible o en proceso.',
    narration: 'En el módulo de propiedades registrás cada unidad con su dirección, tipo, fotos, monto de alquiler y propietario asignado. De un vistazo sabés qué está alquilado, qué está disponible y cuándo vence cada contrato.',
    tags: ['Propiedades', 'Inventario'],
    Visual: VisualPropiedades,
  },
  {
    id: 'contratos',
    title: 'Generación de contratos legales',
    subtitle: 'Ley 27.551 lista para usar',
    description: 'Generás contratos completos con todas las cláusulas legales argentinas. Elegís el tipo de ajuste (ICL, IPC o CER), la duración, las partes, y el PDF queda listo para firmar.',
    narration: 'Generás contratos de locación completos con todas las cláusulas de la Ley 27.551. Elegís el tipo de ajuste, la duración, propietario e inquilino, y el PDF queda listo en segundos para enviar a firmar.',
    tags: ['Contratos', 'Ley 27.551', 'PDF'],
    Visual: VisualContratos,
  },
  {
    id: 'ajuste-icl',
    title: 'Ajuste automático con datos del BCRA',
    subtitle: 'ICL, IPC y CER sin cálculos manuales',
    description: 'El sistema toma los índices directamente del BCRA, calcula el nuevo monto automáticamente y te avisa antes de cada vencimiento. Podés ver la evolución del alquiler en el tiempo con el gráfico integrado.',
    narration: 'Esta es la función estrella. Los índices ICL, IPC y CER se actualizan automáticamente desde el BCRA. El sistema calcula el nuevo monto, te avisa antes del vencimiento, y podés ver en el gráfico cómo evolucionó el alquiler desde el inicio del contrato. Sin fórmulas manuales, sin errores.',
    tags: ['ICL / IPC / CER', 'BCRA', 'Ajuste automático'],
    Visual: VisualAjusteICL,
  },
  {
    id: 'pagos',
    title: 'Cobranzas con MercadoPago',
    subtitle: 'Del vencimiento al recibo en segundos',
    description: 'Generás links de pago MercadoPago con un clic. Al acreditarse, el sistema registra el cobro, actualiza el estado y genera el recibo. Siempre sabés quién pagó, quién está pendiente y quién tiene deuda.',
    narration: 'Con un clic generás el link de pago MercadoPago para el inquilino. Al acreditarse, el sistema registra el cobro, actualiza el estado automáticamente y genera el recibo descargable. Sabés en todo momento quién pagó, quién tiene deuda y cuánto se acumula.',
    tags: ['MercadoPago', 'Cobros', 'Recibos'],
    Visual: VisualPagos,
  },
  {
    id: 'liquidaciones',
    title: 'Centro de liquidaciones',
    subtitle: 'Reparto automático por propietario',
    description: 'Al cierre del mes, el sistema calcula automáticamente cuánto le corresponde a cada propietario descontando la comisión. Genera los PDF de liquidación listos para descargar y enviar.',
    narration: 'Al cierre del mes, el sistema calcula automáticamente la liquidación de cada propietario: lo recaudado, la comisión de la inmobiliaria y el neto a transferir. Genera los PDFs de liquidación en un clic, listos para enviar.',
    tags: ['Liquidaciones', 'Comisiones', 'Propietarios'],
    Visual: VisualLiquidaciones,
  },
  {
    id: 'personas',
    title: 'Directorio de personas',
    subtitle: 'Propietarios, inquilinos y garantes',
    description: 'Todos los actores de tus contratos en un solo directorio. Buscá por nombre, DNI o teléfono. Ves sus contratos activos, historial de pagos y datos actualizados sin papeles.',
    narration: 'Propietarios, inquilinos y garantes centralizados en un solo directorio. Buscás por nombre o DNI, ves sus contratos activos e historial de pagos. Sin carpetas, sin papeles.',
    tags: ['Personas', 'Directorio'],
    Visual: VisualPersonas,
  },
  {
    id: 'tickets',
    title: 'Reclamos y mantenimiento',
    subtitle: 'Seguimiento de cada solicitud',
    description: 'Los inquilinos reportan problemas desde su portal. Vos los gestionás desde el panel: asignás cotizaciones, notificás al propietario para aprobación y cerrás el ticket al resolverse.',
    narration: 'Los inquilinos reportan problemas desde su portal. Vos gestionás cada reclamo desde el panel: pedís cotizaciones, notificás al propietario para que apruebe, y cerrás el ticket al resolverse. Todo queda registrado.',
    tags: ['Reclamos', 'Mantenimiento', 'Tickets'],
    Visual: VisualTickets,
  },
  {
    id: 'afip',
    title: 'Facturación AFIP/ARCA integrada',
    subtitle: 'Facturas electrónicas automáticas',
    description: 'Al registrar un cobro, la factura electrónica se genera automáticamente y se envía a AFIP/ARCA. Sin doble entrada de datos, sin CAE manual, sin errores de facturación.',
    narration: 'Al registrar un cobro, la factura electrónica se genera y se envía a AFIP y ARCA automáticamente. Sin doble carga de datos, sin obtener el CAE a mano. Todo queda registrado para tus declaraciones mensuales.',
    tags: ['AFIP/ARCA', 'Facturación', 'Impuestos'],
    Visual: VisualAFIP,
  },
  {
    id: 'asistente-ia',
    title: 'Asistente IA — AGP Help',
    subtitle: 'Consultas instantáneas sobre tu cartera',
    description: 'El asistente IA conoce todos tus contratos, pagos y vencimientos. Preguntás en lenguaje natural: "¿cuándo vence el contrato de Juan Pérez?" o "¿qué pagos están pendientes este mes?" y recibís la respuesta al instante.',
    narration: 'El asistente inteligente AGP Help conoce toda tu cartera. Podés preguntarle cuándo vence un contrato, qué ajuste corresponde, quién está en mora, y hasta pedirle que genere una notificación para el inquilino. Todo en lenguaje natural.',
    tags: ['IA', 'AGP Help', 'Automatización'],
    Visual: VisualAsistenteIA,
  },
  {
    id: 'portal',
    title: 'Portal público de alquileres',
    subtitle: 'Tu vidriera online propia',
    description: 'Publicás tus propiedades disponibles en un portal con tu marca y URL propia. Los interesados ven fotos, precio y detalles, y completan la postulación online. Vos recibís las solicitudes ordenadas en el panel.',
    narration: 'Tu portal propio de alquileres con tu URL y tu marca. Publicás las propiedades disponibles, los interesados las ven con fotos y precio, y desde ahí completan la postulación sin llamarte.',
    tags: ['Portal público', 'Publicación'],
    Visual: VisualPortal,
  },
  {
    id: 'postulacion',
    title: 'Postulación 100% digital',
    subtitle: 'Sin papeles, sin traslados',
    description: 'Los interesados completan el formulario online con datos personales, ingresos, tipo de garantía y documentación adjunta. Vos revisás todo desde el panel y decidís al instante.',
    narration: 'El interesado completa el formulario desde su celular: datos personales, ingresos, garantía. Adjunta recibo de sueldo y DNI. Vos recibís todo organizado en el panel y aprobás o rechazás en segundos.',
    tags: ['Postulación digital', 'Documentación'],
    Visual: VisualPostulacion,
  },
  {
    id: 'firma-digital',
    title: 'Firma digital con validez legal',
    subtitle: 'Contratos firmados en minutos',
    description: 'El contrato se envía por email a todas las partes. Propietario, inquilino y garante firman digitalmente desde cualquier dispositivo. El PDF firmado tiene validez legal y queda guardado en el sistema.',
    narration: 'El contrato se envía por email a todas las partes. Cada uno firma digitalmente desde su celular o computadora. El PDF firmado tiene plena validez legal y queda archivado automáticamente. Sin presencia física, sin traslados.',
    tags: ['Firma digital', 'Legal', 'PDF'],
    Visual: VisualFirmaDigital,
  },
  {
    id: 'integraciones',
    title: 'Todo conectado desde el día 1',
    subtitle: 'AFIP, BCRA, MercadoPago, Firma Digital',
    description: 'Cuatro integraciones clave listas para usar desde el primer día. Sin configuraciones técnicas, sin APIs manuales. Empezás en minutos y operás con todas las herramientas que necesita una inmobiliaria moderna.',
    narration: 'AFIP, BCRA, MercadoPago y firma digital, todo conectado y listo para usar desde el primer día. Sin configuraciones técnicas ni integraciones manuales. Probá AlquilaGestión Pro 7 días gratis, sin tarjeta. Empezá ahora.',
    tags: ['AFIP', 'BCRA', 'MercadoPago', 'Firma digital'],
    Visual: VisualIntegraciones,
  },
];

const SCENE_DURATION = 9; // seconds per scene (~2:15 total)

// ─────────────────────────────────────────────────────────────────────────────
// TTS hook
// ─────────────────────────────────────────────────────────────────────────────

function useTTS() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported || !enabled) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-AR';
    u.rate = 0.92;
    u.pitch = 1;
    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) u.voice = esVoice;
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [supported, enabled]);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev) window.speechSynthesis?.cancel();
      return !prev;
    });
  }, [supported]);

  return { supported, enabled, speak, stop, toggle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const tts = useTTS();

  // goTo: reset progress ref + state, jump to scene
  const goTo = useCallback((idx: number) => {
    progressRef.current = 0;
    setProgress(0);
    setCurrent(idx);
  }, []);

  // next/prev: functional setCurrent so no stale closure on `current`
  const next = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setCurrent(c => {
      if (c < SCENES.length - 1) return c + 1;
      setPlaying(false);
      return c;
    });
  }, []);

  const prev = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setCurrent(c => Math.max(0, c - 1));
  }, []);

  // Speak on scene change when TTS enabled
  useEffect(() => {
    if (open && tts.enabled) {
      tts.speak(SCENES[current].narration);
    }
  }, [current, tts.enabled, open]);

  // Auto-advance — uses progressRef to avoid stale closure, never calls
  // state setters inside another state updater.
  useEffect(() => {
    if (!open || !playing) return;
    const TICK = 50;
    const INCREMENT = 100 / (SCENE_DURATION * (1000 / TICK));

    const id = setInterval(() => {
      progressRef.current += INCREMENT;
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setProgress(0);
        setCurrent(c => {
          if (c < SCENES.length - 1) return c + 1;
          setPlaying(false);
          return c;
        });
      } else {
        setProgress(progressRef.current);
      }
    }, TICK);

    return () => clearInterval(id);
  }, [open, playing]); // no depende de `next` ni de `current`

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { tts.stop(); onClose(); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose, next, prev, tts]);

  // Reset
  useEffect(() => {
    if (open) { setCurrent(0); setProgress(0); setPlaying(true); }
    else tts.stop();
  }, [open]);

  if (!open) return null;

  const scene = SCENES[current];
  const Visual = scene.Visual;
  const elapsed = current * SCENE_DURATION;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const totalMM = String(Math.floor((SCENES.length * SCENE_DURATION) / 60)).padStart(2, '0');
  const totalSS = String((SCENES.length * SCENE_DURATION) % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) { tts.stop(); onClose(); } }}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-4xl bg-[#080f1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-sky-600 flex items-center justify-center">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
            <span className="text-white/80 text-sm font-semibold">Demo — AlquilaGestión Pro</span>
            <span className="text-white/25 text-xs">·</span>
            <span className="text-white/40 text-xs tabular-nums">{mm}:{ss} / {totalMM}:{totalSS}</span>
          </div>
          <div className="flex items-center gap-2">
            {tts.supported && (
              <button
                onClick={() => {
                  tts.toggle();
                  if (!tts.enabled) setTimeout(() => tts.speak(scene.narration), 50);
                }}
                title={tts.enabled ? 'Desactivar narración' : 'Activar narración de voz'}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                  tts.enabled ? 'bg-sky-600 hover:bg-sky-500' : 'bg-white/10 hover:bg-white/20'
                )}
              >
                {tts.enabled
                  ? <Volume2 className="h-3.5 w-3.5 text-white" />
                  : <VolumeX className="h-3.5 w-3.5 text-white/50" />}
              </button>
            )}
            <button
              onClick={() => { tts.stop(); onClose(); }}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5 text-white/60" />
            </button>
          </div>
        </div>

        {/* Progress strips */}
        <div className="flex gap-0.5 px-5 py-2 bg-black/20 flex-shrink-0">
          {SCENES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden hover:bg-white/20 transition-colors"
            >
              <div
                className={cn('h-full rounded-full transition-[width] duration-100', i < current ? 'bg-sky-400 w-full' : i === current ? 'bg-sky-400' : 'w-0')}
                style={i === current ? { width: `${progress}%` } : undefined}
              />
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Visual */}
          <div className="w-full md:w-[52%] bg-[#050d1a] border-b md:border-b-0 md:border-r border-white/5 p-4 flex-shrink-0" style={{ height: 330 }}>
            <Visual />
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-white/30 text-xs tabular-nums font-mono">
                {String(current + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}
              </span>
              {scene.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-sky-500/12 text-sky-300 text-[10px] font-medium border border-sky-500/20">
                  {t}
                </span>
              ))}
            </div>

            <div className="text-white/45 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
              {scene.subtitle}
            </div>
            <h2 className="text-white text-[1.2rem] font-bold leading-tight mb-4">
              {scene.title}
            </h2>
            <p className="text-white/55 text-[13px] leading-relaxed flex-1">
              {scene.description}
            </p>

            {/* Narration text box */}
            <div className="mt-4 rounded-xl bg-white/4 border border-white/8 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-white/30 text-[9px] font-semibold uppercase tracking-wider">Guión narración</span>
                {tts.enabled && <span className="flex items-center gap-1 text-sky-400 text-[9px]"><Volume2 className="h-2.5 w-2.5" /> voz activa</span>}
              </div>
              <p className="text-white/40 text-[11px] leading-relaxed italic">
                "{scene.narration}"
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
              <button
                onClick={prev}
                disabled={current === 0}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 text-xs font-medium transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>

              <button
                onClick={() => setPlaying(p => !p)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title={playing ? 'Pausar' : 'Reproducir'}
              >
                {playing
                  ? <Pause className="h-3.5 w-3.5 text-white/70" />
                  : <Play className="h-3.5 w-3.5 text-white/70 fill-current" />}
              </button>

              {current < SCENES.length - 1 ? (
                <button
                  onClick={next}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <a
                  href="/login"
                  className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                >
                  Empezar gratis
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-white/5 flex-shrink-0">
          {SCENES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'rounded-full transition-all duration-200',
                i === current ? 'w-4 h-1.5 bg-sky-400' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
