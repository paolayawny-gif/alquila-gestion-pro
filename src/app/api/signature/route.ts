import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ContractSignature, SignerRole } from '@/lib/types';
import { requireFirebaseAuth, isSuperAdminUid } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    const auth = await requireFirebaseAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const {
      adminId,
      contractId,
      signerEmail,
      signerName,
      signerRole,
      signatureImage,
      documentHash,
      userAgent,
    } = body as {
      adminId: string;
      contractId: string;
      signerEmail: string;
      signerName: string;
      signerRole: SignerRole;
      signatureImage: string;
      documentHash: string;
      userAgent?: string;
    };

    if (!adminId || !contractId || !signerEmail || !signatureImage || !documentHash) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // El firmante debe ser quien dice ser: el admin del contrato, o un usuario cuyo email
    // (verificado por Firebase) matchee con signerEmail. Bloquea forjar firmas ajenas.
    const isAdminOfContract = auth.userId === adminId;
    const isSuper = isSuperAdminUid(auth.userId);
    const isOwnSignature =
      !!auth.email && auth.email.toLowerCase() === signerEmail.toLowerCase();
    if (!isAdminOfContract && !isOwnSignature && !isSuper) {
      return NextResponse.json({ error: 'No autorizado a firmar como ese usuario' }, { status: 403 });
    }

    // Capture IP server-side
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    const signature: ContractSignature = {
      signerEmail: signerEmail.toLowerCase(),
      signerName,
      signerRole,
      signedAt: new Date().toISOString(),
      signatureImage,
      documentHash,
      ipAddress: ip,
      userAgent: userAgent ?? '',
    };

    const db = getAdminDb();
    const contractRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('contratos').doc(contractId);

    const snap = await contractRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const existing = (snap.data()?.signatures ?? []) as ContractSignature[];

    // Replace if same signer already signed (re-sign allowed)
    const updated = [
      ...existing.filter(s => s.signerEmail !== signature.signerEmail),
      signature,
    ];

    await contractRef.update({ signatures: updated });

    return NextResponse.json({ ok: true, signedAt: signature.signedAt });
  } catch (err: any) {
    console.error('[signature]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
