import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    const { userId, score, comment } = await req.json() as { userId?: string; score: number; comment?: string };
    if (!userId || score === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = getAdminDb();
    const ref = db
      .collection('artifacts').doc(APP_ID)
      .collection('superadmin').doc('data')
      .collection('npsResponses').doc(userId);

    await ref.set({
      userId,
      score,
      comment: comment ?? '',
      submittedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
