import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const q = encodeURIComponent(`${address}, Argentina`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=ar`,
      {
        headers: {
          'User-Agent': 'AlquilaGestionPro/1.0 (contact@alquilagestionpro.com)',
          'Accept-Language': 'es',
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ lat: null, lng: null });
    }

    const data = await res.json();
    if (!data.length) {
      return NextResponse.json({ lat: null, lng: null });
    }

    return NextResponse.json({
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    });
  } catch {
    return NextResponse.json({ lat: null, lng: null });
  }
}
