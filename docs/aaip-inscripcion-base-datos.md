# Inscripción de la base de datos ante la AAIP — memo de trabajo

> Borrador de trabajo para el abogado responsable. No es un formulario oficial ni reemplaza la carga
> en el sistema de la Agencia de Acceso a la Información Pública (AAIP). Reúne, con base en lo que
> existe hoy en el código de AlquilaGestión Pro, los datos que la Ley 25.326 (art. 21) y su reglamentación
> exigen para inscribir un archivo/base de datos de carácter privado. Los campos marcados `[COMPLETAR]`
> requieren un dato societario/operativo que no surge del repositorio y que hay que definir con el cliente.

## 1. Dónde se inscribe

La AAIP administra el **Registro Nacional de Bases de Datos (RENABASE)**. Actualmente la inscripción se
realiza mediante trámite a distancia (TAD) o el formulario web publicado por la AAIP
(ver [www.argentina.gob.ar/aaip](https://www.argentina.gob.ar/aaip) — verificar el procedimiento vigente
al momento de presentar, puede haber cambiado desde la fecha de este memo).

## 2. Identificación del responsable de la base de datos

| Campo | Valor |
|---|---|
| Razón social / nombre | `[COMPLETAR]` — la persona jurídica que opera AlquilaGestión Pro |
| CUIT | `[COMPLETAR]` |
| Domicilio legal | `[COMPLETAR]` |
| Email de contacto para la AAIP | `privacidad@alquilagestion.pro` (ya usado en la Política de Privacidad) |
| Responsable de la base de datos ante terceros | El **administrador/agencia** que crea cada cuenta es responsable respecto de los datos de sus propios inquilinos/propietarios; AlquilaGestión Pro es responsable respecto de la infraestructura y de los datos de la cuenta del administrador. Ver [Política de Privacidad, sección 1](../src/app/privacidad/page.tsx). |

**Nota**: dado el modelo multi-tenant (cada agencia/administrador es, en los hechos, responsable de los
datos de sus propios inquilinos y propietarios), conviene evaluar con el cliente si corresponde una
inscripción única de la plataforma como encargada de tratamiento, o si además cada agencia debería
evaluar su propia situación como responsable. Esto excede lo que se puede resolver por código y requiere
una decisión de estructura legal.

## 3. Denominación y finalidad de la base de datos

- **Denominación sugerida**: "Base de datos de usuarios, propietarios, inquilinos y postulantes —
  AlquilaGestión Pro".
- **Finalidad**: gestión integral de alquileres (administración de propiedades, contratos, cobranzas,
  mantenimiento, evaluación crediticia de postulantes, facturación) para agencias inmobiliarias y
  administradores en Argentina.

## 4. Categorías de datos personales tratados

(Consolidado de lo relevado en el código — ver [Política de Privacidad, sección 2](../src/app/privacidad/page.tsx))

- Datos identificatorios: nombre, apellido, DNI, CUIT/CUIL, email, teléfono, domicilio.
- Datos económico-financieros: ingresos declarados, CBU/alias bancario, historial de pagos.
- **Datos crediticios** (categoría sensible a efectos prácticos, aunque la Ley 25.326 no los define como
  "datos sensibles" en sentido estricto — sí requieren especial cuidado): situación informada por el
  BCRA (Central de Deudores), cheques rechazados.
- Documentación respaldatoria: DNI, recibos de sueldo, comprobantes, pólizas de seguro.
- Datos biométricos de firma: imagen de firma manuscrita electrónica, hash del documento, IP y
  user-agent del firmante (fines probatorios, Ley 25.506).
- Datos de uso técnico: logs de error de la aplicación (con scrubbing de PII aplicado antes de salir a
  Sentry, ver `sentry.server.config.ts`).

**No se relevaron** categorías de datos sensibles en el sentido estricto del art. 2 de la Ley 25.326
(origen racial/étnico, opiniones políticas, convicciones religiosas/filosóficas, afiliación sindical,
datos de salud o vida sexual). Confirmar con el cliente que ningún módulo adicional (ej. seguros,
mantenimiento) recolecte datos de salud incidentalmente (ej. certificados médicos adjuntos como
justificativo).

## 5. Categorías de titulares de los datos

- Administradores/usuarios de cuenta de la agencia.
- Propietarios de inmuebles.
- Inquilinos (contrato vigente).
- Garantes.
- Postulantes a alquiler (no siempre llegan a ser inquilinos).

## 6. Origen de los datos

Datos suministrados directamente por el titular (formularios de postulación, alta de contrato) y datos
obtenidos de fuentes públicas/autorizadas por el titular al momento de postular (consulta BCRA por
CUIT/CUIL, con el consentimiento explícito capturado en el formulario de postulación, ver
`src/app/apply/page.tsx`).

## 7. Cesión / comunicación de datos a terceros

Ver tabla completa en la [Política de Privacidad, sección 4](../src/app/privacidad/page.tsx). Resumen
para el formulario de inscripción:

| Tercero | Rol | País de procesamiento |
|---|---|---|
| Google Cloud / Firebase | Encargado — hosting de datos, auth, storage | EE.UU. / infraestructura global de Google (verificar región específica del proyecto de Firebase con el equipo técnico) |
| MercadoPago | Encargado — procesamiento de pagos | Argentina |
| Google Gemini (Google LLC) | Encargado — análisis asistido por IA | EE.UU. / global |
| Meta (WhatsApp Business Platform) | Encargado — notificaciones | EE.UU. / global |
| AFIP / BCRA | Organismos públicos — facturación / consulta crediticia | Argentina |
| Sentry | Encargado — monitoreo de errores técnicos | Verificar región de la cuenta de Sentry contratada |
| Vercel | Encargado — hosting de la aplicación web | Verificar región del deployment |

**Transferencia internacional de datos**: dado que Google Cloud/Firebase, Google Gemini, Meta y
potencialmente Sentry/Vercel procesan datos fuera de Argentina, corresponde evaluar si aplica el
régimen de transferencia internacional de datos personales (art. 12 Ley 25.326 y Disposición AAIP
vigente sobre el tema) y si estos proveedores ofrecen garantías adecuadas (cláusulas contractuales
estándar, adhesión a marcos de transferencia reconocidos, etc.). **Esto requiere revisión legal
específica** — no es algo que se resuelva con un cambio de código.

## 8. Medidas de seguridad implementadas (para la sección correspondiente del formulario)

- Contraseñas con hash (`bcryptjs`).
- Sesión con JWT firmado (HS256) y expiración de 8 horas (`src/lib/auth.ts`).
- Autenticación biométrica opcional vía passkeys/WebAuthn.
- Cifrado en tránsito (HTTPS) en toda la aplicación.
- Certificados AFIP de cada agencia cifrados con AES-256-GCM antes de guardarse (`src/lib/afip-crypto.ts`).
- Validación HMAC-SHA256 de notificaciones de pago de MercadoPago.
- Aislamiento de datos por agencia/administrador mediante reglas de acceso de Firestore
  (`firestore.rules`).
- Scrubbing de datos personales antes de reportar errores a Sentry.
- Redacción de contacto del propietario en toda vista pública (portal, formulario de postulación) —
  ver `src/lib/redact-public-property.ts`.

## 9. Plazo de conservación declarado

Igual al informado en la Política de Privacidad: mientras dure la relación contractual, más los plazos
legales de conservación fiscal/contable (hasta 10 años); postulaciones no aceptadas, hasta 12 meses.

## 10. Checklist antes de presentar

- [ ] Confirmar razón social, CUIT y domicilio legal exacto de la entidad que presenta la inscripción.
- [ ] Definir si se inscribe una única base de datos "plataforma" o si además cada agencia/administrador
      cliente debe evaluar su propia inscripción (ver nota en sección 2).
- [ ] Confirmar región de procesamiento real de Firebase/Google Cloud, Sentry y Vercel con el equipo
      técnico, para completar correctamente la sección de transferencia internacional.
- [ ] Revisar si algún módulo (seguros, mantenimiento) recolecta datos de salud incidentalmente.
- [ ] Verificar el procedimiento de inscripción vigente en el sitio de la AAIP al momento de presentar
      (puede haber cambiado el formulario o la plataforma de trámite).

---
*Generado a partir del relevamiento técnico del código de AlquilaGestión Pro. No constituye asesoramiento
legal definitivo; los campos `[COMPLETAR]` y las notas de "revisión legal específica" requieren la
decisión del abogado responsable antes de presentar el trámite.*
