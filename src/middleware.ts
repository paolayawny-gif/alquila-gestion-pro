import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/landing',
  '/privacidad',          // política de privacidad — debe ser pública
  '/terminos',            // términos y condiciones — debe ser pública
  '/politica-cancelacion', // política de cancelación — debe ser pública
  '/apply',               // formulario público de postulación de alquiler
  '/portal',              // vidriera pública de propiedades
  '/p/',                  // página pública por administrador
  '/api/public/',         // lookups públicos server-side (redactados) para /apply, etc.
  '/api/inquiries',       // formulario público de consulta de propiedad
  '/api/auth/session',
  '/api/auth/passkey',
  '/api/billing/webhook',
  '/api/portal/billing/webhook', // MercadoPago notifica sin sesión
  '/api/signature',       // firmantes externos no autenticados
  '/api/icon',            // iconos PWA generados dinámicamente
  '/_next',
  '/favicon.ico',
  '/manifest.json',       // PWA manifest — debe ser público o el browser recibe HTML
  '/sw.js',               // service worker — también debe ser público
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/landing', req.url));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Sin JWT_SECRET no podemos verificar sesiones — redirigir siempre a /login.
    // auth.ts genera un secret efímero aleatorio en dev, así que las cookies emitidas
    // en esa misma instancia siguen funcionando. Lo que no se permite es dejar pasar
    // cookies no verificables independientemente del entorno.
    const loginUrl = new URL('/login', req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('session');
    return res;
  }

  try {
    await jwtVerify(sessionCookie, new TextEncoder().encode(jwtSecret), {
      algorithms: ['HS256'],
    });
    return NextResponse.next();
  } catch {
    // Expired or invalid session cookie — clear it and redirect to login
    const loginUrl = new URL('/login', req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('session');
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
