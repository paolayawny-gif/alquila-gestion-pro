import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Captura el 100% de los errores, pero solo el 10% de las transacciones de performance.
  // Con 1000 admins, esto mantiene el costo bajo mientras captura todos los errores.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Ignora errores de red que no son bugs del código
  ignoreErrors: [
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    'ResizeObserver loop limit exceeded',
  ],

  // En producción no mostramos el overlay de error de Sentry
  debug: false,
});
