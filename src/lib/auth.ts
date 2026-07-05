import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { APP_ID } from "@/lib/constants";

// Resolved lazily so a missing JWT_SECRET only fails when a session is
// actually signed/verified at runtime — not at module import time (which
// would break `next build` while collecting page data).
let encodedKey: Uint8Array | null = null;

function getEncodedKey(): Uint8Array {
  if (encodedKey) return encodedKey;

  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is required in production. Set it in your environment (Vercel → Settings → Environment Variables).",
      );
    }
    console.warn("[auth] JWT_SECRET not set — using ephemeral secret. Sessions will not persist between server restarts.");
  }

  // In dev without JWT_SECRET: random per process start (no known fallback value)
  const secretKey = rawSecret ?? randomBytes(32).toString("hex");
  encodedKey = new TextEncoder().encode(secretKey);
  return encodedKey;
}

export type SessionPayload = {
  userId: string;
  role: string;
  agencyId?: string;
  expiresAt: Date | string;
};

export type FirebaseSessionPayload = {
  userId: string;       // Firebase UID
  email?: string;       // Email del token verificado
  emailVerified?: boolean;
  superAdmin: boolean;  // Custom claim `superAdmin` del token — única fuente de verdad
};

export async function encrypt(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey());
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function createSession(userId: string, role: string, agencyId?: string) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas
  const session = await encrypt({ userId, role, agencyId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "strict",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

/**
 * Verifica el ID token de Firebase enviado en el header `Authorization: Bearer <token>`.
 * Devuelve el payload con uid/email o un NextResponse con 401.
 *
 * Uso desde un Route Handler:
 *   const auth = await requireFirebaseAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { userId, email } = auth;
 */
export async function requireFirebaseAuth(
  req: NextRequest,
): Promise<FirebaseSessionPayload | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    return {
      userId: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      superAdmin: decoded.superAdmin === true,
    };
  } catch (err) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}

/**
 * Combina verificación de Firebase con check de adminId: el caller debe ser
 * el propio admin (o superadmin). Bloquea ataques tipo "POST /api/X { adminId: <otro> }".
 */
export async function requireSessionForAdmin(
  req: NextRequest,
  adminId: string | undefined | null,
): Promise<FirebaseSessionPayload | NextResponse> {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminId) {
    return NextResponse.json({ error: "Falta adminId" }, { status: 400 });
  }
  if (auth.userId !== adminId && !auth.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}

/**
 * Como requireSessionForAdmin, pero también deja pasar a un propietario cuyo
 * email figura en el ownerRegistry de ese adminId (ej: para que un propietario
 * pueda pagar un servicio publicado por su administración).
 */
export async function requireSessionForAdminOrOwner(
  req: NextRequest,
  adminId: string | undefined | null,
): Promise<FirebaseSessionPayload | NextResponse> {
  const auth = await requireFirebaseAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!adminId) {
    return NextResponse.json({ error: "Falta adminId" }, { status: 400 });
  }
  if (auth.userId === adminId || auth.superAdmin) {
    return auth;
  }
  if (auth.email) {
    const docId = auth.email.toLowerCase().replace(/[@.+]/g, "_");
    const ownerDoc = await getAdminDb()
      .collection("artifacts").doc(APP_ID)
      .collection("ownerRegistry").doc(docId)
      .get();
    if (ownerDoc.exists && ownerDoc.data()?.adminId === adminId) {
      return auth;
    }
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Único mecanismo de superadmin: el custom claim `superAdmin` seteado vía /api/superadmin/set-custom-claims. */
export function isSuperAdmin(session: Pick<FirebaseSessionPayload, "superAdmin">): boolean {
  return session.superAdmin === true;
}
