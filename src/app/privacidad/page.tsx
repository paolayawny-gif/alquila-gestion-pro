import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidad · AlquilaGestión Pro',
  description: 'Cómo AlquilaGestión Pro recolecta, usa y protege tus datos personales, en cumplimiento de la Ley 25.326 de Protección de Datos Personales (Argentina).',
};

const CONTACT_EMAIL = 'privacidad@alquilagestion.pro';
const LAST_UPDATED = '4 de julio de 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="text-[14.5px] leading-[1.7] text-gray-600 space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/landing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl shrink-0">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Política de Privacidad</h1>
              <p className="text-sm text-gray-400 mt-1">Última actualización: {LAST_UPDATED}</p>
            </div>
          </div>

          <p className="text-[14.5px] leading-[1.7] text-gray-600">
            Esta Política de Privacidad describe cómo <strong>AlquilaGestión Pro</strong> ("nosotros", "la plataforma")
            recolecta, utiliza, almacena y protege los datos personales de administradores de inmobiliarias, propietarios,
            inquilinos, garantes y postulantes a alquiler ("usuarios", "titulares de los datos") que interactúan con
            nuestros servicios, en cumplimiento de la <strong>Ley 25.326 de Protección de Datos Personales</strong> de la
            República Argentina y su Decreto Reglamentario 1558/2001.
          </p>

          <Section title="1. Responsable del tratamiento">
            <p>
              El responsable de los datos personales tratados a través de AlquilaGestión Pro es la agencia inmobiliaria o
              administrador que crea la cuenta ("el administrador"), quien actúa como responsable del tratamiento respecto
              de los datos de sus propietarios, inquilinos y postulantes. AlquilaGestión Pro actúa como
              <strong> encargado del tratamiento</strong> (proveedor tecnológico) respecto de esos datos, y como
              responsable directo respecto de los datos de la cuenta del propio administrador (email, medios de pago,
              configuración de la agencia).
            </p>
            <p>Consultas sobre esta política: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">{CONTACT_EMAIL}</a></p>
          </Section>

          <Section title="2. Qué datos recolectamos">
            <p>Según el rol del usuario, podemos recolectar:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Datos identificatorios:</strong> nombre y apellido, DNI, CUIT/CUIL, email, teléfono, domicilio.</li>
              <li><strong>Datos de la propiedad y el contrato:</strong> dirección, montos de alquiler, moneda, índices de ajuste, depósitos.</li>
              <li><strong>Datos económico-financieros:</strong> ingresos declarados, datos bancarios (CBU/alias), historial de pagos.</li>
              <li><strong>Datos crediticios:</strong> para la evaluación de postulantes a alquiler, consultamos la situación
                crediticia informada por el <strong>BCRA</strong> (Central de Deudores) asociada al CUIT/CUIL ingresado por el
                propio postulante, con su consentimiento al enviar la postulación.</li>
              <li><strong>Documentación respaldatoria:</strong> DNI, recibos de sueldo, comprobantes de pago, pólizas de seguro.</li>
              <li><strong>Firma electrónica:</strong> imagen de la firma manuscrita, hash del documento firmado, dirección IP
                y user-agent del firmante, capturados al momento de firmar un contrato, con fines de prueba de integridad y
                no repudio (Ley 25.506).</li>
              <li><strong>Datos de uso:</strong> información técnica de la sesión (para seguridad y prevención de fraude) y
                eventos de error de la aplicación.</li>
            </ul>
          </Section>

          <Section title="3. Con qué finalidad usamos tus datos">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Gestionar el alta y administración de propiedades, contratos, pagos y reclamos de mantenimiento.</li>
              <li>Evaluar solicitudes de alquiler, incluyendo análisis de capacidad de pago y situación crediticia.</li>
              <li>Procesar cobros y suscripciones a través de MercadoPago.</li>
              <li>Emitir comprobantes y cumplir obligaciones fiscales ante AFIP/ARCA.</li>
              <li>Enviar notificaciones operativas por email y WhatsApp (vencimientos, recordatorios, avisos de mora).</li>
              <li>Generar contratos, resúmenes y contenido asistido por inteligencia artificial.</li>
              <li>Prevenir fraude, resolver incidentes técnicos y mejorar la seguridad de la plataforma.</li>
            </ul>
          </Section>

          <Section title="4. Con quién compartimos tus datos (encargados de tratamiento y terceros)">
            <p>
              No vendemos datos personales. Para operar la plataforma, compartimos datos con los siguientes proveedores,
              que actúan como encargados de tratamiento bajo sus propias políticas de seguridad:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Google Cloud / Firebase</strong> (Google LLC): alojamiento de la base de datos, autenticación y
                almacenamiento de archivos. Los datos pueden procesarse en infraestructura de Google fuera de Argentina.</li>
              <li><strong>MercadoPago</strong>: procesamiento de pagos y suscripciones. AlquilaGestión Pro nunca recibe ni
                almacena el número completo de tu tarjeta.</li>
              <li><strong>Google Gemini</strong> (Google LLC): para el análisis asistido por IA de postulaciones de
                alquiler, generación de contratos y contenido, se envían de forma acotada datos como nombre, ingresos
                declarados y situación crediticia del postulante, con la finalidad exclusiva de asistir al administrador
                en su evaluación. Estos datos no se usan por Google para entrenar modelos según los términos vigentes de
                la API.</li>
              <li><strong>WhatsApp Business Platform</strong> (Meta): envío de notificaciones y recordatorios a inquilinos
                y propietarios que hayan provisto su número de teléfono.</li>
              <li><strong>Proveedor de email (Gmail/SMTP)</strong>: envío de notificaciones, recordatorios y comprobantes
                por correo electrónico.</li>
              <li><strong>AFIP/ARCA</strong> (organismo público): emisión de comprobantes fiscales cuando el administrador
                configura su propia facturación electrónica.</li>
              <li><strong>BCRA</strong> (organismo público): consulta de situación crediticia de postulantes, a partir del
                CUIT/CUIL que el propio postulante ingresa voluntariamente.</li>
              <li><strong>Red Polygon (blockchain)</strong>: solo se publica el <em>hash</em> criptográfico (huella digital)
                de un contrato firmado, nunca su contenido ni datos personales, con fines de notarización pública verificable.</li>
              <li><strong>Sentry</strong>: monitoreo de errores técnicos de la aplicación, con el fin de detectar y corregir
                fallas.</li>
              <li><strong>Vercel</strong>: alojamiento de la aplicación web.</li>
            </ul>
            <p>
              Solo compartimos lo estrictamente necesario para cada finalidad, y exigimos a estos proveedores el
              cumplimiento de estándares de seguridad y confidencialidad razonables.
            </p>
          </Section>

          <Section title="5. Plazo de conservación">
            <p>
              Conservamos los datos personales mientras dure la relación contractual (contrato de alquiler o suscripción
              del administrador) y, luego de finalizada, durante los plazos legales de conservación aplicables a
              documentación contractual, contable e impositiva en Argentina (en general, hasta 10 años para
              documentación con relevancia fiscal). Las postulaciones de alquiler no aceptadas se conservan hasta 12
              meses desde su presentación, salvo que el postulante solicite su eliminación antes.
            </p>
          </Section>

          <Section title="6. Tus derechos (Ley 25.326)">
            <p>
              Como titular de tus datos, tenés derecho a <strong>acceder, rectificar, actualizar y solicitar la
              supresión</strong> de tus datos personales (derechos ARCO), así como a retirar tu consentimiento en
              cualquier momento cuando el tratamiento se base en él. También tenés derecho a presentar una reclamación
              ante la <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>, autoridad de control de la Ley
              25.326, en caso de considerar vulnerados tus derechos.
            </p>
            <p>
              Para ejercer estos derechos, escribinos a <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium hover:underline">{CONTACT_EMAIL}</a> indicando
              tu nombre, el email o CUIT/CUIL asociado a tu solicitud, y el derecho que querés ejercer. Responderemos en
              un plazo máximo de 10 días corridos.
            </p>
          </Section>

          <Section title="7. Seguridad de los datos">
            <p>
              Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: contraseñas hasheadas,
              sesiones con expiración, autenticación biométrica opcional (passkeys), cifrado en tránsito (HTTPS), reglas
              de acceso por usuario y por agencia, y validación criptográfica de notificaciones de pago. Ningún sistema
              es 100% infalible; ante cualquier incidente de seguridad que afecte tus datos, te notificaremos conforme
              a la normativa aplicable.
            </p>
          </Section>

          <Section title="8. Menores de edad">
            <p>
              Nuestros servicios están dirigidos a personas mayores de 18 años. No recolectamos intencionalmente datos
              de menores de edad.
            </p>
          </Section>

          <Section title="9. Cookies y tecnologías similares">
            <p>
              Utilizamos cookies estrictamente necesarias para mantener tu sesión iniciada de forma segura. No utilizamos
              cookies de publicidad ni de seguimiento de terceros con fines comerciales.
            </p>
          </Section>

          <Section title="10. Cambios a esta política">
            <p>
              Podemos actualizar esta política para reflejar cambios legales o en nuestros servicios. Publicaremos
              cualquier cambio relevante en esta misma página, indicando la fecha de la última actualización.
            </p>
          </Section>

          <p className="text-xs text-gray-400 border-t pt-6">
            Este documento tiene fines informativos y no reemplaza el asesoramiento legal profesional. Ante dudas
            específicas sobre tu situación, consultá con un abogado especializado en protección de datos personales.
          </p>
        </div>
      </div>
    </div>
  );
}
