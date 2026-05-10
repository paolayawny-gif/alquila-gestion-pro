
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Mail, Lock, UserPlus, LogIn, Info,
  Building2, FileText, BrainCircuit, BarChart3, ShieldCheck, Play, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BILLING_TIERS } from '@/lib/billing/tiers';

type AuthMode = 'login' | 'register';

const FEATURES = [
  {
    icon: Building2,
    title: 'Gestión de propiedades',
    desc: 'Controlá todo tu portfolio: departamentos, locales, cocheras y más.',
  },
  {
    icon: FileText,
    title: 'Contratos y ajustes automáticos',
    desc: 'ICL, IPC y CER calculados al instante con índices oficiales del BCRA.',
  },
  {
    icon: BrainCircuit,
    title: 'Inteligencia Artificial integrada',
    desc: 'Análisis de solicitudes, asistente legal y predicción de mantenimiento.',
  },
  {
    icon: BarChart3,
    title: 'Panel analítico avanzado',
    desc: 'Plusvalía, flujo de caja, cumplimiento normativo y más en un solo lugar.',
  },
];

const TRUST_ITEMS = ['AFIP / ARCA', 'BCRA — ICL', 'MercadoPago', 'Firma Digital'];

function fmtARS(n: number) {
  return '$' + n.toLocaleString('es-AR');
}

// ── Logo ─────────────────────────────────────────────────────────────────────
function AppLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="9" fill="#1D9E75"/>
      <polyline points="6,22 18,11 30,22" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="9" y="22" width="5" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="16" y="18" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.75"/>
      <rect x="23" y="14" width="5" height="15" rx="1.5" fill="white"/>
      <polyline points="9,22 16,17 23,13 30,8" fill="none" stroke="#9FE1CB" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="17" r="2" fill="#9FE1CB"/>
      <circle cx="23" cy="13" r="2" fill="#9FE1CB"/>
    </svg>
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────────
function AppWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="leading-none">
      <span className={cn(
        'block text-[10px] font-medium tracking-[0.28em] uppercase mb-0.5',
        dark ? 'text-muted-foreground' : 'text-white/60',
      )}>ALQUILA</span>
      <div className="flex items-baseline gap-0">
        <span className={cn('text-[22px] font-semibold leading-none', dark ? 'text-[#1D9E75]' : 'text-white')}>Gestión</span>
        <span className={cn('text-[22px] font-semibold leading-none', dark ? 'text-foreground' : 'text-white/80')}>Pro</span>
      </div>
      <div className="flex mt-1 gap-[3px]">
        <div className={cn('h-[2.5px] w-[56px] rounded-full', dark ? 'bg-[#1D9E75]' : 'bg-white/60')}/>
        <div className={cn('h-[2.5px] w-[22px] rounded-full', dark ? 'bg-border' : 'bg-white/30')}/>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isUserLoading) router.push('/');
  }, [user, isUserLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: 'Bienvenido', description: 'Sesión iniciada correctamente.' });
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({ title: 'Cuenta creada', description: 'Tu cuenta fue registrada correctamente.' });
      }
    } catch (error: any) {
      let message = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/wrong-password')        message = 'Contraseña incorrecta.';
      if (error.code === 'auth/user-not-found')        message = 'Usuario no encontrado.';
      if (error.code === 'auth/email-already-in-use')  message = 'Este correo ya está registrado.';
      if (error.code === 'auth/weak-password')         message = 'La contraseña debe tener al menos 6 caracteres.';
      if (error.code === 'auth/invalid-credential')    message = 'Credenciales inválidas. Verificá tu email y contraseña.';
      toast({
        title: mode === 'login' ? 'Error de acceso' : 'Error de registro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0d1f17]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]" />
      </div>
    );
  }

  // Tiers representativos para la tira de precios
  const pricingTiers = [BILLING_TIERS[0], BILLING_TIERS[2], BILLING_TIERS[4]];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">

      {/* ── Panel izquierdo — branding ───────────────────────────────────── */}
      <div
        className="relative lg:w-[58%] flex flex-col justify-between p-10 lg:p-14 bg-[#0d1f17] overflow-hidden"
        style={{ minHeight: '280px' }}
      >
        {/* Foto arquitectónica con opacidad baja */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2000')",
            opacity: 0.1,
          }}
        />

        {/* Burbujas radiales (del handoff) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(700px 320px at 12% 8%,  hsl(142 60% 38% / 0.28), transparent 70%)',
              'radial-gradient(480px 260px at 88% 12%, hsl(155 55% 60% / 0.12), transparent 70%)',
              'radial-gradient(560px 380px at 18% 92%, hsl(142 55% 28% / 0.18), transparent 70%)',
              'radial-gradient(300px 200px at 75% 80%, hsl(155 50% 40% / 0.08), transparent 70%)',
            ].join(', '),
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
          <AppLogo size={52} />
          <AppWordmark dark={false} />
        </div>

        {/* Contenido principal (sólo desktop) */}
        <div className="relative z-10 hidden lg:flex flex-col gap-6 mt-8 flex-1 justify-center">

          {/* Eyebrow */}
          <div className="flex items-center gap-2">
            <div className="h-px w-5 bg-[#9FE1CB]" />
            <span className="text-[11px] font-black tracking-[0.22em] uppercase text-[#9FE1CB]">
              Gestión inmobiliaria argentina
            </span>
          </div>

          {/* Headline */}
          <div>
            <h2
              className="text-[28px] lg:text-[32px] font-extrabold text-white leading-[1.08] tracking-[-0.022em]"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              La plataforma completa<br />para gestionar tu cartera
            </h2>
            <p className="text-sm text-white/45 mt-2 leading-relaxed">
              Desde el contrato hasta la liquidación — todo en un solo lugar.
            </p>
          </div>

          {/* Botón demo */}
          <a
            href="#"
            className="inline-flex items-center gap-3 group w-fit"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/15 group-hover:bg-[#1D9E75]/35 transition-colors duration-150">
              <Play className="h-4 w-4 text-white fill-white ml-0.5" aria-hidden="true" />
            </span>
            <span className="text-[13.5px] font-semibold text-white/70 group-hover:text-white transition-colors duration-150">
              Ver demo · 2 min
            </span>
          </a>

          {/* Features */}
          <div className="grid grid-cols-1 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div
                  className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-xl border border-white/10 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  <f.icon style={{ width: 15, height: 15, color: '#9FE1CB' }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-tight">{f.title}</p>
                  <p className="text-[11.5px] text-white/42 leading-snug mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust row */}
          <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/25">
              Integrado con
            </span>
            {TRUST_ITEMS.map(item => (
              <span key={item} className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/50">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
                {item}
              </span>
            ))}
          </div>

          {/* Pricing strip */}
          <div className="pt-4 border-t border-white/[0.08]">
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/25 block mb-2.5">
              Planes disponibles
            </span>
            <div className="flex flex-wrap gap-2">
              {pricingTiers.map((tier, i) => (
                <span
                  key={tier.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold tabular-nums',
                    i === 1
                      ? 'bg-[#1D9E75]/20 border-[#1D9E75]/35 text-[#9FE1CB]'
                      : 'bg-white/[0.05] border-white/[0.08] text-white/45',
                  )}
                >
                  {tier.label}
                  <span className="opacity-30">·</span>
                  {fmtARS(tier.priceARS)}/mes
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white/[0.05] border-white/[0.08] text-white/45 text-[11px] font-semibold">
                +200 unidades · A medida
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 hidden lg:flex items-center justify-between gap-2 mt-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#9FE1CB]/60" />
            <span className="text-[11px] text-white/30">
              Datos encriptados · Acceso por roles · Ley 25.326
            </span>
          </div>
          <Link
            href="/landing"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-white/40 hover:text-[#9FE1CB] transition-colors duration-150 group"
          >
            Conocé más
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform duration-150" />
          </Link>
        </div>
      </div>

      {/* ── Panel derecho — formulario ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-card">
        <div className="w-full max-w-[400px]">

          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <AppLogo size={36} />
            <AppWordmark dark />
          </div>

          {/* Encabezado del form */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-foreground">
              {mode === 'login' ? 'Bienvenido de nuevo' : 'Crear cuenta'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login'
                ? 'Ingresá tus credenciales para acceder al panel'
                : 'Completá los datos para registrarte como administrador'}
            </p>
          </div>

          {/* Alerta de registro */}
          {mode === 'register' && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-[hsl(var(--status-info-bg))] border border-[hsl(var(--status-info-fg)_/_0.15)]">
              <Info className="h-4 w-4 text-[hsl(var(--status-info-fg))] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-[hsl(var(--status-info-fg))]">
                  Primera vez en la plataforma
                </p>
                <p className="text-[11px] text-[hsl(var(--status-info-fg))] opacity-75 leading-snug mt-0.5">
                  Vas a ser el <strong>Administrador</strong> de tu cuenta. Después podrás
                  cargar propiedades e invitar a inquilinos y propietarios.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="pl-10 h-11 focus-visible:ring-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contraseña
                </Label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-primary hover:underline font-medium">
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 focus-visible:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base font-bold rounded-xl shadow-primary transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === 'login' ? (
                <><LogIn className="h-5 w-5 mr-2" /> Iniciar Sesión</>
              ) : (
                <><UserPlus className="h-5 w-5 mr-2" /> Crear Cuenta</>
              )}
            </Button>
          </form>

          {/* Switch mode */}
          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === 'login' ? (
              <>¿No tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-primary font-bold hover:underline"
                >
                  Registrate aquí
                </button>
              </>
            ) : (
              <>¿Ya tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary font-bold hover:underline"
                >
                  Iniciá sesión
                </button>
              </>
            )}
          </p>

          {/* Features mobile */}
          <div className="mt-10 pt-8 border-t border-border grid grid-cols-2 gap-3 lg:hidden">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="text-primary" style={{ width: 14, height: 14 }} />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{f.title}</p>
              </div>
            ))}
          </div>

          {/* Legal */}
          <p className="mt-6 text-[10px] text-center text-muted-foreground/60 leading-tight">
            Al continuar aceptás los Términos de Servicio y la Política de Privacidad de AlquilaGestión Pro.
          </p>
        </div>
      </div>
    </div>
  );
}
