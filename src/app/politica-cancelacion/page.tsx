import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Política de Cancelación · AlquilaGestión Pro',
  description: 'Cómo cancelar tu suscripción a AlquilaGestión Pro y ejercer tu derecho de arrepentimiento.',
};

export default function CancellationPolicyPage() {
  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/landing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Política de Cancelación</h1>
          </div>

          <div className="space-y-3 text-[14.5px] leading-[1.7] text-gray-600">
            <h2 className="text-lg font-bold text-gray-900">Cancelación de la suscripción</h2>
            <p>
              Podés cancelar tu suscripción a AlquilaGestión Pro en cualquier momento desde el Panel de Administración
              → Configuración → Facturación, o pidiéndonos que lo hagamos por vos. La cancelación detiene la
              renovación automática; conservás el acceso a las funcionalidades pagas hasta el final del período ya
              abonado. No se realizan reintegros proporcionales por el tiempo no utilizado dentro de un período ya
              facturado, salvo que corresponda ejercer el derecho de arrepentimiento descripto abajo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border border-[hsl(var(--status-pending-bg))] bg-[hsl(var(--status-pending-bg))]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-pending-fg))] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13.5px] font-bold text-[hsl(var(--status-pending-fg))] leading-snug">
                  Derecho de arrepentimiento — Ley 24.240 Art. 34
                </p>
                <p className="text-[12.5px] text-[hsl(var(--status-pending-fg))]/80 leading-snug mt-0.5">
                  Si contrataste por medios electrónicos, podés revocar sin costo dentro de los <strong>10 días
                  corridos</strong> desde la suscripción, sin necesidad de justificar el motivo.
                </p>
              </div>
            </div>
            <a
              href="mailto:arrepentimiento@alquilagestion.pro?subject=Solicitud%20de%20arrepentimiento%20—%20Ley%2024.240&body=Nombre%3A%0AEmail%20de%20la%20cuenta%3A%0AFecha%20de%20contrataci%C3%B3n%3A"
              className="flex-shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[hsl(var(--status-pending-fg))]/30 text-[13px] font-semibold text-[hsl(var(--status-pending-fg))] hover:bg-[hsl(var(--status-pending-fg))]/10 transition-colors whitespace-nowrap"
            >
              Ejercer arrepentimiento
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="space-y-3 text-[14.5px] leading-[1.7] text-gray-600">
            <h2 className="text-lg font-bold text-gray-900">Qué pasa con tus datos al cancelar</h2>
            <p>
              Al cancelar tu cuenta, tus datos se conservan durante los plazos legales aplicables a documentación
              contractual, contable e impositiva (ver nuestra{' '}
              <Link href="/privacidad" className="text-primary font-medium hover:underline">Política de Privacidad</Link>).
              Podés solicitar la exportación o eliminación anticipada de tus datos escribiendo a{' '}
              <a href="mailto:privacidad@alquilagestion.pro" className="text-primary font-medium hover:underline">privacidad@alquilagestion.pro</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
