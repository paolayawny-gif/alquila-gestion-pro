import * as Sentry from '@sentry/nextjs';

// Campos de datos personales (DNI/CUIT/CUIL, ingresos, situación BCRA, tokens, etc.)
// que nunca deben viajar a la infraestructura de Sentry — Ley 25.326.
const PII_KEY_PATTERN = /(dni|cuit|cuil|taxid|password|token|secret|apikey|access_?token|authorization|cookie|bcra|ingreso|income|cbu|alias|signature|dataUri)/i;

function scrubPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubPii);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = PII_KEY_PATTERN.test(key) ? '[Filtered]' : scrubPii(val);
    }
    return out;
  }
  return value;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) delete event.request.headers['authorization'];
      if (event.request.data) event.request.data = scrubPii(event.request.data);
    }
    if (event.extra) event.extra = scrubPii(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = scrubPii(event.contexts) as typeof event.contexts;
    return event;
  },
});
