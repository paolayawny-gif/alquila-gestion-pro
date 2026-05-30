import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/landing',
  '/api/auth/session',
  '/api/auth/passkey',
  '/api/billing/webhook',
  '/api/signature',       // firmantes externos no autenticados
  '/_next',
  '/favicon.ico',
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
    // Sin JWT_SECRET no podemos verificar sesiones.
    // En desarrollo: dejamos pasar (Firebase client auth actúa de segunda capa).
    // En producción: jamás debería ocurrir — forzamos logout para evitar acceso sin verificar.
    if (process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('/login', req.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('session');
      return res;
    }
    return NextResponse.next();
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
