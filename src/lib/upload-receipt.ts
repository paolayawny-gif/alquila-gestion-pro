'use client';
/**
 * Sube un comprobante de pago a Firebase Storage.
 * Reemplaza el almacenamiento base64 en Firestore (límite 1MB) por una URL real.
 *
 * Ruta en Storage: comprobantes/{adminId}/{invoiceId}/{timestamp}_{fileName}
 * Devuelve la URL de descarga pública.
 */

import { FirebaseStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface UploadProgress {
  percent: number;   // 0–100
  state: 'running' | 'paused' | 'error' | 'success';
}

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

/**
 * Sube un archivo a Firebase Storage con reporte de progreso.
 *
 * @param storage  - instancia de FirebaseStorage (de useStorage())
 * @param file     - archivo del input
 * @param adminId  - ID del administrador (define la carpeta raíz)
 * @param invoiceId - ID de la factura asociada
 * @param onProgress - callback opcional de progreso (0–100)
 */
export function uploadReceiptToStorage(
  storage: FirebaseStorage,
  file: File,
  adminId: string,
  invoiceId: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path      = `comprobantes/${adminId}/${invoiceId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.({ percent, state: snapshot.state as UploadProgress['state'] });
      },
      (error) => {
        onProgress?.({ percent: 0, state: 'error' });
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress?.({ percent: 100, state: 'success' });
          resolve({ url, path, name: file.name });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}
