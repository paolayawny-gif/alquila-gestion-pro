import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/landing',
  '/api/auth/session',
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
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Dev without JWT_SECRET configured — skip server-side check, Firebase handles client auth
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
