/**
 * Sanitiza errores de API antes de enviarlos al cliente.
 *
 * En producción, los mensajes de error internos (stack traces, paths de Firestore,
 * detalles de infraestructura) no deben llegar al cliente.
 *
 * Uso:
 *   return NextResponse.json({ error: apiError(err) }, { status: 500 });
 */

// Mensajes de error que son seguros para mostrar al cliente (errores de negocio intencionales)
const SAFE_MESSAGE_PREFIXES = [
  'Configuración',
  'Factura no encontrada',
  'Contrato no encontrado',
  'Passkey no encontrada',
  'Verificación fallida',
  'Token inválido',
  'Falta',
  'Faltan',
  'No autorizado',
  'Error de Gemini',
  'MercadoPago',
  'AFIP',
  'CAE',
  'WSAA',
];

function isSafeMessage(message: string): boolean {
  return SAFE_MESSAGE_PREFIXES.some(prefix =>
    message.startsWith(prefix),
  );
}

/**
 * Devuelve el mensaje de error apropiado para el cliente.
 * - En development: siempre el mensaje real (facilita debugging)
 * - En production: solo mensajes de negocio conocidos; el resto → "Error interno del servidor"
 */
export function apiError(err: unknown, fallback = 'Error interno del servidor'): string {
  const message =
    err instanceof Error ? err.message : String(err ?? fallback);

  if (process.env.NODE_ENV !== 'production') return message;
  if (isSafeMessage(message)) return message;
  return fallback;
}
