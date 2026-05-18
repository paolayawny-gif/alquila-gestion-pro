import type { ReactNode } from 'react';
import { Fraunces, Manrope } from 'next/font/google';

// Tipografía editorial: serif con carácter para titulares + grotesca moderna para texto.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-portal-display',
  display: 'swap',
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-portal-body',
  display: 'swap',
});

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
