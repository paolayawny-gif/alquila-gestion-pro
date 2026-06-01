import { APP_ID } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { SUGGESTION_TEMPLATES } from '@/lib/monetization-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTHS_BETWEEN_SUGGESTIONS = 3;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const usersRef = db.collection('artifacts').doc(APP_ID).collection('users');
  const adminDocs = await usersRef.listDocuments();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - MONTHS_BETWEEN_SUGGESTIONS);

  let sent = 0;
  let skipped = 0;

  for (const adminDoc of adminDocs) {
    const adminId = adminDoc.id;

    // Get all properties to find owner emails
    const propsSnap = await adminDoc.collection('propiedades').get();
    const ownerMap = new Map<string, { name: string; propertyId: string; propertyName: string }>();

    for (const propDoc of propsSnap.docs) {
      const prop = propDoc.data();
      for (const owner of prop.owners ?? []) {
        if (!owner.email) continue;
        const email = owner.email.toLowerCase();
        if (!ownerMap.has(email)) {
          ownerMap.set(email, {
            name: owner.name ?? email,
            propertyId: propDoc.id,
            propertyName: prop.name ?? '',
          });
        }
      }
    }

    if (ownerMap.size === 0) continue;

    // Get existing suggestions for this admin
    const sugSnap = await adminDoc.collection('monetizationSuggestions').get();
    const recentByOwner = new Map<string, Date>();

    for (const s of sugSnap.docs) {
      const d = s.data();
      if (!d.ownerEmail || !d.sentAt) continue;
      const sentAt = new Date(d.sentAt);
      const prev = recentByOwner.get(d.ownerEmail);
      if (!prev || sentAt > prev) recentByOwner.set(d.ownerEmail, sentAt);
    }

    // For each owner, send a suggestion if they haven't received one recently
    for (const [ownerEmail, ownerData] of ownerMap) {
      const lastSent = recentByOwner.get(ownerEmail);
      if (lastSent && lastSent > cutoff) {
        skipped++;
        continue;
      }

      // Pick next template in rotation (based on how many have been sent)
      const sentCount = [...sugSnap.docs].filter(s => s.data().ownerEmail === ownerEmail).length;
      const template = SUGGESTION_TEMPLATES[sentCount % SUGGESTION_TEMPLATES.length];

      await adminDoc.collection('monetizationSuggestions').add({
        ownerEmail,
        ownerName: ownerData.name,
        propertyId: ownerData.propertyId,
        propertyName: ownerData.propertyName,
        templateId: template.id,
        templateTitle: template.title,
        templateDescription: template.description,
        customMessage: null,
        sentAt: now.toISOString(),
        seenAt: null,
        repliedAt: null,
        status: 'enviada',
        isAutomatic: true,
      });
      sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    runAt: now.toISOString(),
    nextRunIn: `${MONTHS_BETWEEN_SUGGESTIONS} months`,
  });
}
