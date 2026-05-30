import type {Metadata} from 'next';
import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { DataAssistantChat } from '@/components/ai/DataAssistantChat';

export const metadata: Metadata = {
  title: 'AlquilaGestión Pro - Administración de Alquileres',
  description: 'Sistema profesional de control y administración de alquileres.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0369A1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AlquilaPro" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/api/icon?size=180" />
      </head>
      <body className={`${plusJakartaSans.variable} font-body antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <FirebaseClientProvider>
            {children}
            <DataAssistantChat />
            <Toaster />
          </FirebaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
