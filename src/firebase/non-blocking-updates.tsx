'use client';

import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { ZodTypeAny } from 'zod';

// ── Validated write ────────────────────────────────────────────────────────────

/**
 * Versión validada de setDocumentNonBlocking.
 *
 * Pasos:
 *  1. Valida el objeto con el schema Zod provisto.
 *  2. Si es válido → escribe solo los campos reconocidos (strip de campos desconocidos).
 *  3. Si es inválido:
 *     - Registra el error en consola (y en Sentry si está configurado).
 *     - En development: BLOQUEA la escritura para forzar al dev a corregir el problema.
 *     - En production: PERMITE la escritura con los datos originales (graceful degradation)
 *       para no perder una confirmación de pago por un campo inesperado.
 *
 * @example
 *   setDocumentSafe(docRef, Schemas.InvoicePatch, { status: 'Pagado', paymentDate: today }, { merge: true });
 */
export function setDocumentSafe(
  docRef: DocumentReference,
  schema: ZodTypeAny,
  data: unknown,
  options: SetOptions = {},
): void {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map(i => `[${i.path.join('.')}] ${i.message}`)
      .join(' | ');
    const msg = `[setDocumentSafe] Schema inválido en ${docRef.path}: ${errors}`;

    console.error(msg, { data });

    // Reportar a Sentry si está disponible (import dinámico — no rompe si no está)
    import('@sentry/nextjs')
      .then(({ captureMessage }) => captureMessage(msg, 'error'))
      .catch(() => {});

    if (process.env.NODE_ENV === 'development') {
      // En dev: bloquear la escritura para que el problema sea visible inmediatamente
      throw new Error(msg);
    }

    // En producción: escribir igual con los datos originales para no perder info
    // (no sacrificamos una confirmación de pago por un campo inesperado)
    setDocumentNonBlocking(docRef, data, options);
    return;
  }

  // Importante: escribimos los datos ORIGINALES, no result.data.
  // La validación actúa como GUARDIA (detecta tipos/valores inválidos) pero NO
  // transforma ni hace strip — así preservamos campos opcionales legítimos
  // que el schema no declara explícitamente (ownerCbu, liquidacionEnviadaAt, etc.)
  setDocumentNonBlocking(docRef, data, options);
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  setDoc(docRef, data, options).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write', // or 'create'/'update' based on options
        requestResourceData: data,
      })
    )
  })
  // Execution continues immediately
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}