import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(request: NextRequest) {
  const size = parseInt(request.nextUrl.searchParams.get('size') ?? '192');
  const r = Math.round(size * 0.25);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: '#1D9E75',
          borderRadius: r,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: size * 0.04,
        }}
      >
        {/* House roof */}
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 36 36"
          fill="none"
        >
          <polyline
            points="4,22 18,9 32,22"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect x="8" y="22" width="5" height="8" rx="1.5" fill="white" fill-opacity="0.5" />
          <rect x="15.5" y="17" width="5" height="13" rx="1.5" fill="white" fill-opacity="0.75" />
          <rect x="23" y="13" width="5" height="17" rx="1.5" fill="white" />
          <polyline
            points="8,22 15.5,16 23,12 31,7"
            stroke="#9FE1CB"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="15.5" cy="16" r="2.2" fill="#9FE1CB" />
          <circle cx="23" cy="12" r="2.2" fill="#9FE1CB" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
