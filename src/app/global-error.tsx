"use client";

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Error crítico de la aplicación
          </h1>
          <p className="text-muted-foreground mb-8 max-w-sm">
            Ocurrió un error inesperado. El equipo fue notificado automáticamente.
          </p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Reintentar
          </button>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/40 mt-6 font-mono">
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
