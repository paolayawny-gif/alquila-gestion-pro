"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Building2, FileText, CreditCard, Users, Globe, BarChart3, Home, DollarSign, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Scene visuals ─────────────────────────────────────────────────────────

function SceneDashboard() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      {/* Topbar */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <div className="ml-2 h-5 w-40 rounded bg-white/10 text-[9px] text-white/40 flex items-center px-2">dashboard</div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Propiedades', value: '42', sub: '35 alquiladas', color: 'from-sky-500/20 to-sky-600/10', icon: '🏠' },
          { label: 'Recaudado', value: '$6.1M', sub: '+12.5% este mes', color: 'from-emerald-500/20 to-emerald-600/10', icon: '💰' },
          { label: 'En mora', value: '3', sub: '+1 este mes', color: 'from-amber-500/20 to-amber-600/10', icon: '⚠️' },
        ].map(k => (
          <div key={k.label} className={cn('rounded-lg p-2.5 bg-gradient-to-br border border-white/5', k.color)}>
            <div className="text-base">{k.icon}</div>
            <div className="text-white font-bold text-sm mt-1">{k.value}</div>
            <div className="text-white/50 text-[9px] leading-tight mt-0.5">{k.label}</div>
            <div className="text-white/30 text-[8px] mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>
      {/* Chart bars */}
      <div className="flex-1 rounded-lg bg-white/5 border border-white/5 p-2.5">
        <div className="text-white/50 text-[9px] mb-2">Ingresos vs Egresos — Ene a Jun</div>
        <div className="flex items-end gap-1 h-16">
          {[65, 72, 58, 80, 88, 100].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t-sm bg-sky-500/70" style={{ height: `${h * 0.58}%` }} />
              <div className="w-full rounded-t-sm bg-red-400/30" style={{ height: `${h * 0.18}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['Ene','Feb','Mar','Abr','May','Jun'].map(m => (
            <span key={m} className="text-white/30 text-[7px]">{m}</span>
          ))}
        </div>
      </div>
      {/* Alert strip */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 flex items-center gap-2">
        <span className="text-amber-400 text-xs">⏰</span>
        <div>
          <div className="text-amber-300 text-[9px] font-semibold">2 ajustes próximos</div>
          <div className="text-white/40 text-[8px]">Av. Libertador 1234 — ICL Anual</div>
        </div>
      </div>
    </div>
  );
}

function ScenePropiedades() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-bold text-sm">Propiedades</div>
        <div className="h-6 px-3 rounded-lg bg-sky-600 text-white text-[9px] font-semibold flex items-center gap-1">
          <span>+</span> Nueva
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {[
          { addr: 'Av. Libertador 1234', type: 'Departamento', status: 'Alquilado', tenant: 'Juan Pérez', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
          { addr: 'San Martín 432', type: 'Casa', status: 'Disponible', tenant: 'Sin inquilino', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
          { addr: 'Belgrano 98, 3°B', type: 'Departamento', status: 'Alquilado', tenant: 'María García', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
          { addr: 'Local Centro 5', type: 'Local Comercial', status: 'Alquilado', tenant: 'Kiosko El Sol', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        ].map((p, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex flex-col gap-1.5">
            <div className={cn('self-start px-1.5 py-0.5 rounded text-[7px] font-semibold border', p.color)}>{p.status}</div>
            <div className="h-8 rounded bg-white/5 flex items-center justify-center">
              <span className="text-white/20 text-base">🏠</span>
            </div>
            <div className="text-white text-[9px] font-semibold leading-tight">{p.addr}</div>
            <div className="text-white/40 text-[8px]">{p.type}</div>
            <div className="text-white/40 text-[8px]">{p.tenant}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneContratos() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-bold text-sm">Contratos</div>
        <div className="h-6 px-3 rounded-lg bg-sky-600 text-white text-[9px] font-semibold flex items-center gap-1">
          + Nuevo
        </div>
      </div>
      {[
        { prop: 'Av. Libertador 1234', tenant: 'Juan Pérez', rent: '$380.000', date: '01/03/2024', index: 'ICL', next: '01/03/2025' },
        { prop: 'Belgrano 98, 3°B', tenant: 'María García', rent: '$290.000', date: '15/06/2024', index: 'IPC', next: '15/12/2024' },
        { prop: 'Local Comercial Centro', tenant: 'Kiosko El Sol', rent: '$520.000', date: '01/01/2024', index: 'CER', next: '01/07/2024' },
      ].map((c, i) => (
        <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="text-white text-[10px] font-semibold">{c.prop}</div>
            <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Vigente</span>
          </div>
          <div className="text-white/50 text-[8px]">Inquilino: {c.tenant}</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sky-400 text-[10px] font-bold">{c.rent}</div>
              <div className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[7px] font-bold border border-amber-500/30">
                {c.index}
              </div>
            </div>
            <div className="text-white/30 text-[8px]">Próx. ajuste: {c.next}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenePagos() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-bold text-sm">Pagos</div>
        <div className="h-6 px-3 rounded-lg bg-sky-600 text-white text-[9px] font-semibold flex items-center">
          + Registrar
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {[
          { month: 'Octubre 2024', prop: 'Av. Libertador 1234', amount: '$380.000', status: 'PAGADO', statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
          { month: 'Octubre 2024', prop: 'Belgrano 98, 3°B', amount: '$290.000', status: 'PENDIENTE', statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
          { month: 'Octubre 2024', prop: 'San Martín 432', amount: '$450.000', status: 'VENCIDO', statusColor: 'bg-red-500/20 text-red-300 border-red-500/30' },
          { month: 'Octubre 2024', prop: 'Local Centro 5', amount: '$520.000', status: 'PAGADO', statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        ].map((p, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex flex-col gap-1.5">
            <span className={cn('self-start px-1.5 py-0.5 rounded text-[7px] font-semibold border', p.statusColor)}>{p.status}</span>
            <div className="text-white/80 text-[9px] font-semibold">{p.month}</div>
            <div className="text-white/40 text-[8px] leading-tight">{p.prop}</div>
            <div className="rounded bg-white/5 py-1 px-2 text-sky-400 text-[10px] font-bold">{p.amount}</div>
            {p.status === 'PENDIENTE' && (
              <div className="h-5 rounded bg-[#009ee3]/20 border border-[#009ee3]/30 text-[#009ee3] text-[7px] font-semibold flex items-center justify-center gap-1">
                <span>💳</span> Generar link MP
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenePersonas() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-bold text-sm">Personas</div>
        <div className="h-6 px-3 rounded-lg bg-sky-600 text-white text-[9px] font-semibold flex items-center">
          + Agregar
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {[
          { name: 'Juan Pérez', dni: 'DNI 28.456.789', phone: '+54 11 4567-8901', role: 'Inquilino', color: 'bg-sky-500/20 text-sky-300' },
          { name: 'María García', dni: 'DNI 31.234.567', phone: '+54 11 2345-6789', role: 'Inquilina', color: 'bg-sky-500/20 text-sky-300' },
          { name: 'Carlos Fernández', dni: 'CUIT 20-28456789-1', phone: '+54 11 9876-5432', role: 'Propietario', color: 'bg-purple-500/20 text-purple-300' },
          { name: 'Ana López', dni: 'DNI 25.678.901', phone: '+54 11 3456-7890', role: 'Garante', color: 'bg-amber-500/20 text-amber-300' },
        ].map((p, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 px-3 py-2 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-white/60 text-xs">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[10px] font-semibold">{p.name}</div>
              <div className="text-white/40 text-[8px]">{p.dni} · {p.phone}</div>
            </div>
            <span className={cn('px-1.5 py-0.5 rounded text-[7px] font-semibold', p.color)}>{p.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenePortal() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-3">
      {/* Portal header */}
      <div className="rounded-lg bg-sky-800/40 border border-sky-600/30 p-3 flex items-center justify-between">
        <div>
          <div className="text-sky-200 text-[10px] font-bold">Portal de Alquileres</div>
          <div className="text-sky-400/70 text-[8px]">tuinmobiliaria.alquilagestion.pro</div>
        </div>
        <div className="h-5 px-2 rounded bg-sky-600/50 text-sky-200 text-[7px] font-semibold flex items-center">
          🌐 Público
        </div>
      </div>
      {/* Property listing */}
      <div className="flex-1 flex flex-col gap-2">
        {[
          { addr: 'San Martín 432 - Rosario', type: '3 amb. · 75m²', price: '$450.000/mes', tag: 'Disponible' },
          { addr: 'Av. Corrientes 890 - CABA', type: '1 amb. · 38m²', price: '$320.000/mes', tag: 'Disponible' },
        ].map((p, i) => (
          <div key={i} className="rounded-lg bg-white/5 border border-white/5 p-2.5 flex gap-2.5">
            <div className="w-14 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
              <span className="text-white/20 text-xl">🏠</span>
            </div>
            <div className="flex-1">
              <div className="text-white text-[9px] font-semibold leading-tight">{p.addr}</div>
              <div className="text-white/40 text-[8px] mt-0.5">{p.type}</div>
              <div className="text-sky-400 text-[10px] font-bold mt-1">{p.price}</div>
              <div className="mt-1.5 h-5 rounded bg-sky-600/50 text-sky-200 text-[7px] font-semibold flex items-center justify-center">
                Me interesa →
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-white/20 text-[8px]">Powered by AlquilaGestión Pro</div>
    </div>
  );
}

function ScenePostulacion() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col p-4 gap-2.5">
      <div className="text-white font-bold text-sm">Postulación digital</div>
      <div className="text-white/40 text-[8px]">San Martín 432 — Rosario</div>
      <div className="flex flex-col gap-2 flex-1">
        {[
          { label: 'Nombre completo', val: 'Juan Pérez', done: true },
          { label: 'Email', val: 'juan@email.com', done: true },
          { label: 'CUIT/CUIL', val: '20-28456789-1', done: true },
          { label: 'Ingreso neto mensual', val: '$ 900.000', done: true },
          { label: 'Garante', val: 'Propietario — Ana López', done: true },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 text-[8px]',
              f.done ? 'bg-emerald-500/30 text-emerald-400' : 'bg-white/10 text-white/30'
            )}>✓</div>
            <div className="flex-1 rounded bg-white/5 border border-white/5 px-2 py-1 flex justify-between">
              <span className="text-white/40 text-[8px]">{f.label}</span>
              <span className="text-white/70 text-[8px]">{f.val}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Docs uploaded */}
      <div className="rounded-lg bg-white/5 border border-white/5 p-2">
        <div className="text-white/40 text-[8px] mb-1.5">Documentación adjunta</div>
        <div className="flex gap-1.5 flex-wrap">
          {['Recibo sueldo', 'DNI frente', 'DNI dorso'].map(d => (
            <span key={d} className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[7px] border border-sky-500/30">{d} ✓</span>
          ))}
        </div>
      </div>
      <div className="h-7 rounded-lg bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">
        Enviar Postulación →
      </div>
    </div>
  );
}

function SceneIntegraciones() {
  return (
    <div className="w-full h-full bg-[#0f172a] rounded-xl overflow-hidden flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-white font-bold text-base mb-1">Todo conectado desde el día 1</div>
        <div className="text-white/40 text-[9px]">Sin configuraciones complejas</div>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full">
        {[
          { name: 'AFIP / ARCA', desc: 'Facturación electrónica', icon: '🏛️', color: 'border-blue-500/30 bg-blue-500/10' },
          { name: 'BCRA — ICL', desc: 'Índice de ajuste en tiempo real', icon: '📊', color: 'border-sky-500/30 bg-sky-500/10' },
          { name: 'MercadoPago', desc: 'Links de cobro instantáneos', icon: '💳', color: 'border-[#009ee3]/30 bg-[#009ee3]/10' },
          { name: 'Firma Digital', desc: 'Contratos con validez legal', icon: '✍️', color: 'border-purple-500/30 bg-purple-500/10' },
        ].map((item) => (
          <div key={item.name} className={cn('rounded-xl border p-3 flex flex-col gap-1.5', item.color)}>
            <div className="text-xl">{item.icon}</div>
            <div className="text-white text-[10px] font-bold">{item.name}</div>
            <div className="text-white/40 text-[8px] leading-tight">{item.desc}</div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <div className="text-sky-400 text-[9px] font-semibold mb-1">7 días gratis · Sin tarjeta</div>
        <div className="h-7 px-5 rounded-lg bg-sky-600 text-white text-[9px] font-bold flex items-center gap-1.5">
          Empezar ahora <span>→</span>
        </div>
      </div>
    </div>
  );
}

// ── Scene definitions ─────────────────────────────────────────────────────

const SCENES = [
  {
    id: 'dashboard',
    title: 'Panel central en tiempo real',
    subtitle: 'Tu cartera, de un vistazo',
    description: 'Al ingresar, ves en tiempo real el estado completo de tu cartera: propiedades ocupadas, recaudación del mes, inquilinos en mora y alertas de ajustes. Sin hojas de cálculo, sin llamadas para saber cómo va el mes.',
    tags: ['Dashboard', 'KPIs', 'Alertas'],
    Visual: SceneDashboard,
  },
  {
    id: 'propiedades',
    title: 'Catálogo de propiedades',
    subtitle: 'Todo tu inventario organizado',
    description: 'Registrá cada propiedad con su dirección, tipo, fotos, monto de alquiler y propietario. El sistema te indica en un vistazo qué está alquilado, disponible o en proceso, y te avisa cuando vence un contrato.',
    tags: ['Propiedades', 'Inventario', 'Estado'],
    Visual: ScenePropiedades,
  },
  {
    id: 'contratos',
    title: 'Contratos con ajuste automático',
    subtitle: 'ICL, IPC y CER sin cálculos manuales',
    description: 'Generás contratos completos con todas las cláusulas legales (Ley 27.551). El ajuste por ICL, IPC o CER se calcula automáticamente con datos del BCRA y te avisa cuándo aplicarlo. Podés descargar el PDF con firma digital.',
    tags: ['Contratos', 'Ajuste ICL/IPC/CER', 'BCRA', 'Firma digital'],
    Visual: SceneContratos,
  },
  {
    id: 'pagos',
    title: 'Cobranzas con MercadoPago',
    subtitle: 'Del vencimiento al recibo en segundos',
    description: 'Generás un link de pago MercadoPago con un clic. El sistema registra el cobro, actualiza el estado y genera el recibo descargable. Ves en el acto quién pagó, quién está pendiente y quién tiene deuda.',
    tags: ['Pagos', 'MercadoPago', 'Recibos', 'Mora'],
    Visual: ScenePagos,
  },
  {
    id: 'personas',
    title: 'Directorio de personas',
    subtitle: 'Propietarios, inquilinos y garantes',
    description: 'Todos los actores de tus contratos en un solo lugar. Podés buscar por nombre, DNI o teléfono, ver su historial de pagos y contratos activos, y mantener sus datos actualizados sin papeles.',
    tags: ['Propietarios', 'Inquilinos', 'Garantes'],
    Visual: ScenePersonas,
  },
  {
    id: 'portal',
    title: 'Portal público de alquileres',
    subtitle: 'Tu vidriera online propia',
    description: 'Publicá tus propiedades disponibles en un portal con tu marca. Los interesados ven las fotos, el precio y los detalles, y completan la postulación online. Vos recibís las solicitudes ordenadas en tu panel.',
    tags: ['Portal público', 'Publicación', 'Branding'],
    Visual: ScenePortal,
  },
  {
    id: 'postulacion',
    title: 'Postulación 100% digital',
    subtitle: 'Sin papeles, sin traslados',
    description: 'Los interesados completan el formulario online con sus datos personales, ingresos y garantía. Pueden adjuntar recibo de sueldo, DNI y documentación del garante. Vos revisás todo desde el panel y decidís al instante.',
    tags: ['Postulación digital', 'Documentación', 'Garantía'],
    Visual: ScenePostulacion,
  },
  {
    id: 'integraciones',
    title: 'Integrado con todo lo que necesitás',
    subtitle: 'AFIP, BCRA, MercadoPago, Firma Digital',
    description: 'Facturación AFIP/ARCA, índices del BCRA, cobros MercadoPago y contratos con firma digital legal — todo conectado desde el primer día, sin configuraciones complejas. Empezá en minutos, no en semanas.',
    tags: ['AFIP/ARCA', 'BCRA', 'MercadoPago', 'Firma digital'],
    Visual: SceneIntegraciones,
  },
];

// ── Modal component ───────────────────────────────────────────────────────

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const SCENE_DURATION = 15; // seconds per scene

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setProgress(0);
  }, []);

  const next = useCallback(() => {
    if (current < SCENES.length - 1) {
      goTo(current + 1);
    } else {
      setPlaying(false);
    }
  }, [current, goTo]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  // Auto-advance timer
  useEffect(() => {
    if (!open || !playing) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          next();
          return 0;
        }
        return p + (100 / (SCENE_DURATION * 20));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [open, playing, next]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, next, prev]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrent(0);
      setProgress(0);
      setPlaying(true);
    }
  }, [open]);

  if (!open) return null;

  const scene = SCENES[current];
  const Visual = scene.Visual;
  const totalMinutes = Math.floor((current * SCENE_DURATION) / 60);
  const totalSeconds = (current * SCENE_DURATION) % 60;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-sky-600 flex items-center justify-center">
                <Play className="h-3 w-3 text-white fill-white" />
              </div>
              <span className="text-white/80 text-sm font-semibold">Demo — AlquilaGestión Pro</span>
            </div>
            <span className="text-white/30 text-xs">·</span>
            <span className="text-white/40 text-xs">
              {`${String(totalMinutes).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')} / 02:00`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>
        </div>

        {/* Progress bar — scene strips */}
        <div className="flex gap-0.5 px-5 py-2.5 bg-black/20">
          {SCENES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden transition-all hover:bg-white/20"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-100',
                  i < current ? 'bg-sky-400 w-full' :
                  i === current ? 'bg-sky-400' : 'w-0'
                )}
                style={i === current ? { width: `${progress}%` } : undefined}
              />
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Visual panel */}
          <div className="w-full md:w-[52%] bg-[#060f1e] border-b md:border-b-0 md:border-r border-white/5 p-5 flex-shrink-0" style={{ height: 320 }}>
            <Visual />
          </div>

          {/* Info panel */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            {/* Scene counter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/30 text-xs tabular-nums">
                {String(current + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {scene.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-[10px] font-medium border border-sky-500/20">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-1 text-white/50 text-xs font-medium uppercase tracking-wider">
              {scene.subtitle}
            </div>
            <h2 className="text-white text-xl font-bold leading-tight mb-4">
              {scene.title}
            </h2>

            {/* Description */}
            <p className="text-white/60 text-[13.5px] leading-relaxed flex-1">
              {scene.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
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
        <div className="flex items-center justify-center gap-1.5 py-3 border-t border-white/5">
          {SCENES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'rounded-full transition-all duration-200',
                i === current
                  ? 'w-4 h-1.5 bg-sky-400'
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
