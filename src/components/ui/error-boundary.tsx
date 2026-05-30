"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  /** Nombre del módulo — aparece en el mensaje y en el reporte de errores */
  module?: string;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

async function captureError(error: Error, extra: Record<string, unknown>): Promise<string | null> {
  try {
    // Importación dinámica — si Sentry no está instalado o sin DSN, falla silenciosamente
    const { captureException } = await import('@sentry/nextjs');
    return captureException(error, { extra }) ?? null;
  } catch {
    console.error('[ErrorBoundary]', extra.module, error);
    return null;
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, {
      componentStack: info.componentStack,
      module: this.props.module ?? 'unknown',
    }).then(id => this.setState({ eventId: id }));
  }

  handleReset = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Algo salió mal
          {this.props.module ? ` en ${this.props.module}` : ''}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Este error fue registrado automáticamente. Podés intentar recargar
          esta sección sin perder el resto de la aplicación.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        </div>
        {this.state.eventId && (
          <p className="text-[10px] text-muted-foreground/50 mt-4 font-mono">
            ID: {this.state.eventId}
          </p>
        )}
      </div>
    );
  }
}
