"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Fingerprint, Loader2, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

const SESSION_KEY = 'agp_biometric_unlocked';
const DEVICE_PASSKEY_KEY = 'agp_device_has_passkey';

interface Props {
  userEmail: string | null | undefined;
  children: React.ReactNode;
}

type GateState = 'checking' | 'authenticating' | 'locked' | 'unlocked' | 'no_passkey';

export function BiometricGate({ userEmail, children }: Props) {
  const [state, setState] = useState<GateState>('checking');
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  // Mutex: prevents concurrent WebAuthn calls regardless of re-renders.
  // useRef because we don't want the flag change to trigger re-renders.
  const inFlightRef = useRef(false);

  const runAuth = useCallback(async (email: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState('authenticating');
    setError(null);

    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');

      const optRes = await fetch(`/api/auth/passkey/authenticate?email=${encodeURIComponent(email)}`);
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
      // Keep inFlightRef true — auth is done, no retry needed.
    } catch (err: any) {
      inFlightRef.current = false;
      // NotAllowedError: user dismissed the OS dialog.
      // AbortError: a second WebAuthn call cancelled this one (shouldn't happen
      // with the inFlightRef guard, but handled defensively).
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setState('locked');
        setError('Verificación cancelada. Tocá el botón para intentar de nuevo.');
      } else {
        setState('locked');
        setError(err.message ?? 'Error al verificar. Intentá de nuevo.');
      }
    }
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setState('no_passkey');
      return;
    }

    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      setState('unlocked');
      return;
    }

    if (localStorage.getItem(DEVICE_PASSKEY_KEY) === '1') {
      // Auto-trigger immediately — no button required. The inFlightRef guard
      // inside runAuth ensures this only runs once even if the effect fires twice
      // (React StrictMode) or userEmail flickers.
      runAuth(userEmail);
    } else {
      setState('no_passkey');
    }
  }, [userEmail, runAuth]);

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

  if (state === 'authenticating') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-6 p-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-foreground">Verificando identidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Confirmá con tu huella, Face ID o Windows Hello
          </p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          onClick={() => userEmail && runAuth(userEmail)}
          size="lg"
          className="h-14 px-8 text-base font-bold rounded-2xl gap-3"
        >
          <Fingerprint className="h-6 w-6" />
          Intentar de nuevo
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
