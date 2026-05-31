"use client";

import { useId } from 'react';

interface HouseMascotProps {
  size?: number;
  className?: string;
  animate?: boolean;
  mood?: 'happy' | 'thinking' | 'waving';
}

export function HouseMascot({ size = 64, className = '', animate = false, mood = 'happy' }: HouseMascotProps) {
  const rawId = useId();
  const id = `mascot-${rawId.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.32)}
      viewBox="0 0 100 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}-roof`} x1="50" y1="16" x2="50" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#034f7a" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id={`${id}-body`} x1="50" y1="58" x2="50" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0369A1" floodOpacity="0.18" />
        </filter>
        {animate && (
          <style>{`
            @keyframes ${id}-bounce {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-4px); }
            }
            @keyframes ${id}-wave {
              0%, 100% { transform: rotate(-15deg); transform-origin: 19px 78px; }
              50%       { transform: rotate(15deg);  transform-origin: 19px 78px; }
            }
            @keyframes ${id}-blink {
              0%, 90%, 100% { transform: scaleY(1); }
              95%           { transform: scaleY(0.1); }
            }
            .${id}-body  { animation: ${id}-bounce 2.4s ease-in-out infinite; }
            .${id}-larm  { animation: ${id}-wave 1.2s ease-in-out infinite; transform-origin: 19px 78px; }
            .${id}-eyes  { animation: ${id}-blink 4s ease-in-out infinite; transform-origin: 50px 76px; }
          `}</style>
        )}
      </defs>

      {/* ── Chimney ── */}
      <rect x="64" y="16" width="10" height="27" rx="2" fill="#023d6b" />
      <rect x="62" y="14" width="14" height="6" rx="2" fill="#012d47" />
      {/* smoke puffs */}
      {animate && <>
        <circle cx="69" cy="10" r="2.5" fill="#dbeafe" opacity="0.6">
          <animate attributeName="cy" values="10;4;-2" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.3;0" dur="2s" repeatCount="indefinite" />
          <animate attributeName="r" values="2.5;3.5;4.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="66" cy="7" r="2" fill="#dbeafe" opacity="0.4">
          <animate attributeName="cy" values="7;1;-5" dur="2.5s" begin="0.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.2;0" dur="2.5s" begin="0.5s" repeatCount="indefinite" />
        </circle>
      </>}

      {/* ── Everything below animates as one unit ── */}
      <g className={animate ? `${id}-body` : ''} filter={`url(#${id}-shadow)`}>

        {/* Roof */}
        <polygon points="6,64 94,64 50,16" fill={`url(#${id}-roof)`} />
        {/* Roof shine */}
        <polygon points="50,16 94,64 72,64 50,30" fill="white" opacity="0.06" />
        {/* Roof outline */}
        <polygon points="6,64 94,64 50,16" stroke="#023d6b" strokeWidth="1.5" strokeLinejoin="round" fill="none" />

        {/* Window on roof (attic vent) */}
        <rect x="43" y="40" width="14" height="11" rx="2" fill="white" opacity="0.5" />
        <line x1="50" y1="40" x2="50" y2="51" stroke="#023d6b" strokeWidth="0.8" opacity="0.4" />

        {/* Body */}
        <rect x="18" y="61" width="64" height="50" rx="6" fill={`url(#${id}-body)`} stroke="#0369A1" strokeWidth="1.8" />

        {/* Eyes group — blinks */}
        <g className={animate ? `${id}-eyes` : ''}>
          {/* Left eye white */}
          <circle cx="37" cy="76" r="7.5" fill="white" stroke="#0369A1" strokeWidth="1" />
          {/* Right eye white */}
          <circle cx="63" cy="76" r="7.5" fill="white" stroke="#0369A1" strokeWidth="1" />
          {/* Pupils */}
          <circle cx={mood === 'thinking' ? 38.5 : 37.5} cy={mood === 'thinking' ? 74.5 : 77} r="3.5" fill="#0c2340" />
          <circle cx={mood === 'thinking' ? 64.5 : 63.5} cy={mood === 'thinking' ? 74.5 : 77} r="3.5" fill="#0c2340" />
          {/* Highlights */}
          <circle cx={mood === 'thinking' ? 40 : 39} cy={mood === 'thinking' ? 73 : 75.5} r="1.3" fill="white" />
          <circle cx={mood === 'thinking' ? 66 : 65} cy={mood === 'thinking' ? 73 : 75.5} r="1.3" fill="white" />
        </g>

        {/* Cheeks */}
        <ellipse cx="29" cy="84" rx="5" ry="3.5" fill="#38bdf8" opacity="0.25" />
        <ellipse cx="71" cy="84" rx="5" ry="3.5" fill="#38bdf8" opacity="0.25" />

        {/* Mouth */}
        {mood === 'thinking'
          ? <path d="M 38 88 Q 50 87 62 88" stroke="#0c2340" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M 38 87 Q 50 97 62 87" stroke="#0c2340" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        }
        {/* Teeth hint on happy */}
        {mood === 'happy' && (
          <path d="M 42 89 Q 50 95 58 89" fill="white" opacity="0.6" />
        )}

        {/* Door */}
        <path d="M 42 111 L 42 93 Q 42 88 50 88 Q 58 88 58 93 L 58 111 Z"
          fill="#0369A1" opacity="0.2" stroke="#0369A1" strokeWidth="1.5" />
        {/* Door knob */}
        <circle cx="55.5" cy="100" r="1.8" fill="#0369A1" opacity="0.7" />
        {/* Door frame line */}
        <line x1="50" y1="88" x2="50" y2="111" stroke="#0369A1" strokeWidth="0.8" opacity="0.3" />

        {/* ── Left arm ── */}
        <g className={animate && mood === 'waving' ? `${id}-larm` : ''}>
          <rect x="4" y="74" width="16" height="9" rx="4.5" fill="#0369A1" transform="rotate(-12, 12, 78.5)" />
          {/* Left hand */}
          <circle cx="5" cy="76" r="5.5" fill="#0369A1" />
          <circle cx="3.5" cy="74" r="2" fill="#0259a0" />
          <circle cx="6.5" cy="72.5" r="2" fill="#0259a0" />
          <circle cx="5" cy="78.5" r="2" fill="#0259a0" />
        </g>

        {/* ── Right arm ── */}
        <rect x="80" y="74" width="16" height="9" rx="4.5" fill="#0369A1" transform="rotate(12, 88, 78.5)" />
        {/* Right hand */}
        <circle cx="95" cy="76" r="5.5" fill="#0369A1" />
        <circle cx="96.5" cy="74" r="2" fill="#0259a0" />
        <circle cx="93.5" cy="72.5" r="2" fill="#0259a0" />
        <circle cx="95" cy="78.5" r="2" fill="#0259a0" />

        {/* ── Legs ── */}
        <rect x="29" y="109" width="14" height="18" rx="7" fill="#0259a0" />
        <rect x="57" y="109" width="14" height="18" rx="7" fill="#0259a0" />

        {/* ── Feet ── */}
        <ellipse cx="36" cy="128" rx="10" ry="5" fill="#023d6b" />
        <ellipse cx="64" cy="128" rx="10" ry="5" fill="#023d6b" />
        {/* Shoe shine */}
        <ellipse cx="33" cy="126" rx="4" ry="2" fill="#0369A1" opacity="0.3" />
        <ellipse cx="61" cy="126" rx="4" ry="2" fill="#0369A1" opacity="0.3" />

      </g>
    </svg>
  );
}
