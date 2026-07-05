import Link from 'next/link';
import { FileText, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Términos y Condiciones · AlquilaGestión Pro',
  description: 'Condiciones de uso del servicio AlquilaGestión Pro.',
};

const CONTACT_EMAIL = 'legales@alquilagestion.pro';
const LAST_UPDATED = '4 de julio de 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="text-[14.5px] leading-[1.7] text-gray-600 space-y-3">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/landing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Términos y Condiciones</h1>
              <p className="text-sm text-gray-400 mt-1">Última actualización: {LAST_UPDATED}</p>
            </div>
          </div>

          <p className="text-[14.5px] leading-[1.7] text-gray-600">
            Estos Términos y Condiciones ("Términos") regulan el uso de <strong>AlquilaGestión Pro</strong> ("el
            servicio", "la plataforma") por parte de administradores de inmobiliarias, propietarios, inquilinos y
            postulantes ("usuarios"). Al crear una cuenta o utilizar cualquier funcionalidad del servicio, aceptás
            estos Términos.
          </p>

          <Section title="1. Descripción del servicio">
            <p>
              AlquilaGestión Pro es una plataforma de gestión de alquileres que permite administrar propiedades,
              contratos, cobros, mantenimiento y comunicación con inquilinos y propietarios, con herramientas
              asistidas por inteligencia artificial. El servicio se ofrece bajo un modelo de suscripción con planes
              pagos y un período de prueba gratuito inicial, según se detalla en la página de precios.
            </p>
          </Section>

          <Section title="2. Cuenta y responsabilidad del usuario">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Sos responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Sos responsable de la exactitud de los datos que cargás en la plataforma (propiedades, contratos,
                datos de inquilinos y propietarios), incluyendo su obtención con consentimiento válido cuando
                corresponda.</li>
              <li>No está permitido usar el servicio para fines ilícitos, ni cargar datos de terceros sin base legal
                para hacerlo.</li>
            </ul>
          </Section>

          <Section title="3. Planes, pagos y facturación">
            <p>
              Los pagos de suscripción se procesan a través de MercadoPago. El período de prueba gratuito no requiere
              tarjeta de crédito. Vencido el período de prueba o cancelada la suscripción, el acceso a determinadas
              funcionalidades puede restringirse conforme al plan vigente. Los precios y planes disponibles se
              detallan en la página de precios de la plataforma y pueden actualizarse con aviso previo razonable.
            </p>
          </Section>

          <Section title="4. Derecho de arrepentimiento (Ley 24.240)">
            <p>
              Si contrataste el servicio por medios electrónicos, tenés derecho a revocar la contratación sin costo
              ni responsabilidad dentro de los <strong>10 (diez) días corridos</strong> desde la suscripción, conforme
              al Artículo 34 de la Ley 24.240 de Defensa del Consumidor. Podés ejercer este derecho escribiendo a{' '}
              <a href="mailto:arrepentimiento@alquilagestion.pro" className="text-primary font-medium hover:underline">
                arrepentimiento@alquilagestion.pro
              </a>.
            </p>
          </Section>

          <Section title="5. Contenido generado con inteligencia artificial">
            <p>
              Algunas funcionalidades (análisis de postulaciones, redacción de contratos, generación de contenido)
              utilizan modelos de inteligencia artificial de terceros. Estas herramientas son un apoyo a la decisión
              del administrador y no reemplazan el asesoramiento legal, contable o inmobiliario profesional. El
              administrador es responsable de revisar y validar cualquier documento o análisis generado antes de
              utilizarlo.
            </p>
          </Section>

          <Section title="6. Propiedad intelectual">
            <p>
              La plataforma, su código, diseño y marca son propiedad de AlquilaGestión Pro. Los usuarios conservan la
              titularidad de los datos y documentos que cargan.
            </p>
          </Section>

          <Section title="7. Disponibilidad y limitación de responsabilidad">
            <p>
              Hacemos esfuerzos razonables para mantener el servicio disponible y funcionando correctamente, pero no
              garantizamos disponibilidad ininterrumpida. En la medida permitida por la ley aplicable, no somos
              responsables por daños indirectos derivados del uso del servicio, incluyendo decisiones comerciales
              tomadas en base a análisis asistidos por IA.
            </p>
          </Section>

          <Section title="8. Protección de datos personales">
            <p>
              El tratamiento de datos personales dentro de la plataforma se rige por nuestra{' '}
              <Link href="/privacidad" className="text-primary font-medium hover:underline">Política de Privacidad</Link>.
            </p>
          </Section>

          <Section title="9. Modificaciones y contacto">
            <p>
              Podemos actualizar estos Términos para reflejar cambios legales o del servicio, publicando la nueva
              versión en esta página. Para consultas, escribinos a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <p className="text-xs text-gray-400 border-t pt-6">
            Este documento tiene fines informativos y no reemplaza el asesoramiento legal profesional.
          </p>
        </div>
      </div>
    </div>
  );
}
