
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

type AuthMode = 'login' | 'register';

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
        toast({
          title: "Bienvenido",
          description: "Sesión iniciada correctamente.",
        });
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({
          title: "Cuenta creada",
          description: "Su cuenta ha sido registrada exitosamente.",
        });
      }
    } catch (error: any) {
      let message = "Ocurrió un error inesperado.";
      if (error.code === 'auth/wrong-password') message = "Contraseña incorrecta.";
      if (error.code === 'auth/user-not-found') message = "Usuario no encontrado.";
      if (error.code === 'auth/email-already-in-use') message = "Este correo ya está registrado.";
      if (error.code === 'auth/weak-password') message = "La contraseña debe tener al menos 6 caracteres.";

      toast({
        title: mode === 'login' ? "Error de acceso" : "Error de registro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2000')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-none">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black text-primary">AlquilaGestión Pro</CardTitle>
          <CardDescription>
            {mode === 'login' 
              ? 'Ingrese sus credenciales para acceder' 
              : 'Complete los datos para crear su cuenta de administrador'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="ejemplo@alquilagestion.com" 
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {mode === 'login' && (
                  <Button variant="link" className="p-0 h-auto text-xs text-primary">¿Olvidó su contraseña?</Button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full h-12 text-lg font-bold" type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : mode === 'login' ? (
                <><LogIn className="h-5 w-5 mr-2" /> Iniciar Sesión</>
              ) : (
                <><UserPlus className="h-5 w-5 mr-2" /> Crear Cuenta</>
              )}
            </Button>
            
            <div className="text-sm text-center">
              {mode === 'login' ? (
                <p>
                  ¿No tiene cuenta?{' '}
                  <button 
                    type="button" 
                    onClick={() => setMode('register')} 
                    className="text-primary font-bold hover:underline"
                  >
                    Regístrese aquí
                  </button>
                </p>
              ) : (
                <p>
                  ¿Ya tiene una cuenta?{' '}
                  <button 
                    type="button" 
                    onClick={() => setMode('login')} 
                    className="text-primary font-bold hover:underline"
                  >
                    Inicie sesión
                  </button>
                </p>
              )}
            </div>

            <p className="text-[10px] text-center text-muted-foreground px-6 leading-tight">
              Al ingresar o registrarse, usted acepta nuestros Términos de Servicio y la Política de Privacidad de AlquilaGestión Pro.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
