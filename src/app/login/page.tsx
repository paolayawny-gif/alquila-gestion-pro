"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Bienvenido",
        description: "Sesión iniciada correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error de acceso",
        description: "Credenciales inválidas. Por favor, reintente.",
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
            Ingrese sus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@alquilagestion.com" 
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
                <Button variant="link" className="p-0 h-auto text-xs text-primary">¿Olvidó su contraseña?</Button>
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Iniciar Sesión"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Al ingresar, usted acepta nuestros Términos de Servicio y Política de Privacidad.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
