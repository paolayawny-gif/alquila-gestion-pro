/**
 * Quita campos de contacto/privados del propietario antes de que un documento de
 * propiedad se sirva a una vista pública (portal, vidriera, formulario de postulación).
 * Ver firestore.rules — el `get` público del documento no filtra campos, así que la
 * redacción tiene que pasar por acá antes de que el dato llegue al cliente.
 */
export function redactPropertyForPublic<T extends Record<string, unknown>>(
  property: T
): Omit<T, 'owners' | 'ownerEmail' | 'ownerName' | 'internalNotes' | 'bankDetails'> {
  const { owners, ownerEmail, ownerName, internalNotes, bankDetails, ...rest } = property as Record<string, unknown>;
  return rest as Omit<T, 'owners' | 'ownerEmail' | 'ownerName' | 'internalNotes' | 'bankDetails'>;
}
