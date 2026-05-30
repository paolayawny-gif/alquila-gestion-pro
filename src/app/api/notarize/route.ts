import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { notarizeOnPolygon } from '@/lib/polygon-notarize';
import { requireSessionForAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/** Same inputs as ContractSignModal so the hash is consistent. */
function computeDocumentHash(contract: any): string {
  const input = [
    contract.id,
    contract.tenantEmail ?? '',
    contract.propertyId,
    contract.startDate,
    contract.endDate,
    contract.baseRentAmount,
    contract.currency,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { adminId, contractId } = (await req.json()) as { adminId: string; contractId: string };

    const auth = await requireSessionForAdmin(req, adminId);
    if (auth instanceof NextResponse) return auth;

    if (!contractId) {
      return NextResponse.json({ error: 'Falta contractId' }, { status: 400 });
    }

    const db = getAdminDb();
    const contractRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('users').doc(adminId)
      .collection('contratos').doc(contractId);

    const snap = await contractRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const contract = { id: contractId, ...snap.data() };

    // Already notarized → return existing proof
    if ((contract as any).blockchainTxHash) {
      const txHash = (contract as any).blockchainTxHash as string;
      return NextResponse.json({
        ok: true,
        txHash,
        scanUrl: `https://polygonscan.com/tx/${txHash}`,
        alreadyNotarized: true,
      });
    }

    const documentHash = computeDocumentHash(contract);
    const { txHash, scanUrl } = await notarizeOnPolygon(documentHash);
    const notarizedAt = new Date().toISOString();

    // Persist TX hash on the contract
    await contractRef.update({ blockchainTxHash: txHash, notarizedAt });

    // Create a public lookup record (txHash → adminId + contractId)
    await db
      .collection('artifacts').doc(APP_ID)
      .collection('notarizations').doc(txHash)
      .set({ adminId, contractId, documentHash, notarizedAt });

    return NextResponse.json({ ok: true, txHash, scanUrl });
  } catch (err: any) {
    console.error('[notarize]', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
