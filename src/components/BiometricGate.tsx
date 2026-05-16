"use client";

import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

const SESSION_KEY = 'agp_biometric_unlocked';

interface Props {
  userEmail: string | null | undefined;
  children: React.ReactNode;
}

type GateState = 'checking' | 'locked' | 'unlocked' | 'no_passkey';

export function BiometricGate({ userEmail, children }: Props) {
  const [state, setState] = useState<GateState>('checking');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (!userEmail) {
      setState('no_passkey');
      return;
    }

    // Already unlocked in this browser session
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      setState('unlocked');
      return;
    }

    // Check if this user has passkeys registered
    fetch(`/api/auth/passkey/authenticate?email=${encodeURIComponent(userEmail)}`)
      .then((res) => {
        if (res.status === 404) {
          // No passkeys — skip the gate
          setState('no_passkey');
        } else {
          setState('locked');
        }
      })
      .catch(() => setState('no_passkey')); // On error, don't block the user
  }, [userEmail]);

  const handleBiometric = async () => {
    if (!userEmail) return;
    setIsVerifying(true);
    setError(null);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');

      const optRes = await fetch(`/api/auth/passkey/authenticate?email=${encodeURIComponent(userEmail)}`);
      const { options, stateToken } = await optRes.json();

      const authResponse = await startAuthentication(options);

      const verRes = await fetch('/api/auth/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, stateToken }),
      });

      if (!verRes.ok) {
        const { error: e } = await verRes.json();
        throw new Error(e ?? 'Verificación fallida');
      }

      sessionStorage.setItem(SESSION_KEY, '1');
      setState('unlocked');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Verificación cancelada. Intentá de nuevo.');
      } else {
        setError(err.message ?? 'Error al verificar. Intentá de nuevo.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
    } catch { /* best-effort */ }
    sessionStorage.removeItem('agp_session_id');
    sessionStorage.removeItem(SESSION_KEY);
    signOut(auth);
  };

  if (state === 'checking') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'locked') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-6 p-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-foreground">Verificá tu identidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Usá tu huella, Face ID o Windows Hello para acceder
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center px-4">{error}</p>
        )}

        <Button
          onClick={handleBiometric}
          disabled={isVerifying}
          size="lg"
          className="h-14 px-8 text-base font-bold rounded-2xl gap-3"
        >
          {isVerifying ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Fingerprint className="h-6 w-6" />
          )}
          {isVerifying ? 'Verificando...' : 'Verificar identidad'}
        </Button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mt-4"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    );
  }

  // 'unlocked' or 'no_passkey' — show the app normally
  return <>{children}</>;
}
