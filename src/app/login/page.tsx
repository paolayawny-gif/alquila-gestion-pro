
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Mail, Lock, UserPlus, LogIn, Info,
  Building2, FileText, BrainCircuit, BarChart3, ShieldCheck, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

// ── Logo SVG (mismo que en el sidebar) ───────────────────────────────────────
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
      <span className={cn('block text-[10px] font-medium tracking-[0.28em] uppercase mb-0.5',
        dark ? 'text-[#888780]' : 'text-white/60'
      )}>ALQUILA</span>
      <div className="flex items-baseline gap-0">
        <span className={cn('text-[22px] font-semibold leading-none',
          dark ? 'text-[#1D9E75]' : 'text-white'
        )}>Gestión</span>
        <span className={cn('text-[22px] font-semibold leading-none',
          dark ? 'text-[#444441]' : 'text-white/80'
        )}>Pro</span>
      </div>
      <div className="flex mt-1 gap-[3px]">
        <div className={cn('h-[2.5px] w-[56px] rounded-full', dark ? 'bg-[#1D9E75]' : 'bg-white/60')}/>
        <div className={cn('h-[2.5px] w-[22px] rounded-full', dark ? 'bg-[#444441]' : 'bg-white/30')}/>
      </div>
    </div>
  );
}

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
    if (user && !isUserLoading) {
      router.push('/');
    }
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
        toast({ title: 'Cuenta creada', description: 'Su cuenta ha sido registrada exitosamente.' });
      }
    } catch (error: any) {
      let message = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta.';
      if (error.code === 'auth/user-not-found') message = 'Usuario no encontrado.';
      if (error.code === 'auth/email-already-in-use') message = 'Este correo ya está registrado.';
      if (error.code === 'auth/weak-password') message = 'La contraseña debe tener al menos 6 caracteres.';
      if (error.code === 'auth/invalid-credential') message = 'Credenciales inválidas. Verificá tu email y contraseña.';
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

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">

      {/* ── Panel izquierdo — branding ── */}
      <div
        className="relative lg:w-[55%] flex flex-col justify-between p-10 lg:p-14 bg-[#0d1f17] overflow-hidden"
        style={{ minHeight: '280px' }}
      >
        {/* Foto de fondo con overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2000')" }}
        />
        {/* Gradiente radial decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1D9E75]/30 via-transparent to-transparent pointer-events-none" />
        {/* Círculo decorativo */}
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#1D9E75]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[#9FE1CB]/5 blur-3xl pointer-events-none" />

        {/* Logo + wordmark */}
        <div className="relative z-10 flex items-center gap-4">
          <AppLogo size={52} />
          <AppWordmark dark={false} />
        </div>

        {/* Tagline + features (sólo en pantallas grandes) */}
        <div className="relative z-10 hidden lg:block">
          <p className="text-2xl lg:text-3xl font-bold text-white leading-snug mb-2">
            La plataforma completa<br />para gestionar tu cartera
          </p>
          <p className="text-sm text-white/50 mb-10">
            Desde el contrato hasta la liquidación — todo en un solo lugar.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="mt-0.5 flex-shrink-0 h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <f.icon className="h-4.5 w-4.5 text-[#9FE1CB]" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-white/50 leading-snug mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer izquierdo */}
        <div className="relative z-10 hidden lg:flex items-center gap-2 mt-10">
          <ShieldCheck className="h-4 w-4 text-[#9FE1CB]" />
          <span className="text-xs text-white/40">Datos encriptados · Acceso por roles · Firebase Auth</span>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-[400px]">

          {/* Logo chico en mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <AppLogo size={36} />
            <AppWordmark dark />
          </div>

          {/* Título del form */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#444441]">
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
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-800">Primera vez en la plataforma</p>
                <p className="text-[11px] text-blue-600 leading-snug mt-0.5">
                  Vas a ser el <strong>Administrador</strong> de tu cuenta. Después podrás
                  cargar propiedades e invitar a inquilinos y propietarios.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-[#888780]">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  className="pl-10 h-11 border-muted focus-visible:ring-[#1D9E75]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-[#888780]">
                  Contraseña
                </Label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-[#1D9E75] hover:underline font-medium">
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
                  className="pl-10 h-11 border-muted focus-visible:ring-[#1D9E75]"
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
              className="w-full h-12 text-base font-bold bg-[#1D9E75] hover:bg-[#18896A] text-white rounded-xl shadow-md shadow-[#1D9E75]/20 transition-all"
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
                  className="text-[#1D9E75] font-bold hover:underline"
                >
                  Registrate aquí
                </button>
              </>
            ) : (
              <>¿Ya tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#1D9E75] font-bold hover:underline"
                >
                  Iniciá sesión
                </button>
              </>
            )}
          </p>

          {/* Features en mobile */}
          <div className="mt-10 pt-8 border-t border-muted grid grid-cols-2 gap-3 lg:hidden">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center">
                  <f.icon className="text-[#1D9E75]" style={{ width: 14, height: 14 }} />
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{f.title}</p>
              </div>
            ))}
          </div>

          {/* Legal tiny */}
          <p className="mt-6 text-[10px] text-center text-muted-foreground/60 leading-tight">
            Al continuar aceptás los Términos de Servicio y la Política de Privacidad de AlquilaGestión Pro.
          </p>
        </div>
      </div>
    </div>
  );
}
