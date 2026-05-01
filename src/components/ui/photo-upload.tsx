'use client';

import React, { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, ImagePlus, Loader2, AlertCircle } from 'lucide-react';

interface PhotoUploadProps {
  /** URLs ya guardadas */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Prefijo de carpeta en Storage, ej: "properties/abc123" */
  storagePath: string;
  maxPhotos?: number;
  disabled?: boolean;
}

interface UploadingItem {
  id: string;
  name: string;
  preview: string;   // objectURL para mostrar antes de que termine
  progress: number;  // 0–100
  error?: string;
}

export function PhotoUpload({
  value = [],
  onChange,
  storagePath,
  maxPhotos = 10,
  disabled,
}: PhotoUploadProps) {
  const storage = useStorage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (accepted.length === 0) return;
    const remaining = maxPhotos - value.length - uploading.filter(u => !u.error).length;
    const toUpload = accepted.slice(0, remaining);

    toUpload.forEach(file => {
      const id = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const preview = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fullPath = `${storagePath}/${id}.${ext}`;

      // Agrego item en estado "subiendo"
      setUploading(prev => [...prev, { id, name: file.name, preview, progress: 0 }]);

      const storageRef = ref(storage, fullPath);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        'state_changed',
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploading(prev => prev.map(u => u.id === id ? { ...u, progress: pct } : u));
        },
        err => {
          console.error('[Storage] Error:', err);
          setUploading(prev => prev.map(u => u.id === id ? { ...u, error: 'Error al subir. Revisá las reglas de Storage.' } : u));
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          URL.revokeObjectURL(preview);
          onChange([...value, url]);
          setUploading(prev => prev.filter(u => u.id !== id));
        }
      );
    });

    // Reset input para poder subir el mismo archivo de nuevo
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeUploaded = (url: string) => {
    // Borra de Firestore (la URL) — el archivo en Storage se puede limpiar luego
    onChange(value.filter(u => u !== url));
  };

  const cancelUploading = (id: string) => {
    setUploading(prev => prev.filter(u => u.id !== id));
  };

  const total = value.length + uploading.filter(u => !u.error).length;
  const canAdd = total < maxPhotos && !disabled;

  return (
    <div className="space-y-3">
      {/* Grid de fotos */}
      {(value.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">

          {/* Fotos ya subidas */}
          {value.map((url, i) => (
            <div key={url} className="relative group aspect-square">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="w-full h-full object-cover rounded-xl border"
              />
              {/* Badge principal */}
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[8px] font-black bg-primary text-white px-1.5 py-0.5 rounded-full shadow">
                  Principal
                </span>
              )}
              {/* Botón eliminar */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeUploaded(url)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Fotos subiendo */}
          {uploading.map(item => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border">
              <img src={item.preview} alt="" className="w-full h-full object-cover opacity-50" />

              {item.error ? (
                /* Error */
                <div className="absolute inset-0 bg-destructive/10 flex flex-col items-center justify-center p-1">
                  <AlertCircle className="h-4 w-4 text-destructive mb-1" />
                  <p className="text-[8px] text-destructive text-center leading-tight">{item.error}</p>
                  <button
                    type="button"
                    onClick={() => cancelUploading(item.id)}
                    className="mt-1 text-[8px] font-bold text-destructive underline"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                /* Progreso */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="h-5 w-5 text-white animate-spin drop-shadow" />
                  <span className="text-[10px] font-black text-white drop-shadow">{item.progress}%</span>
                  {/* Barra */}
                  <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zona de carga */}
      {canAdd && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl',
              'border-2 border-dashed border-primary/25 hover:border-primary/50',
              'bg-primary/3 hover:bg-primary/5 transition-colors cursor-pointer',
              'text-muted-foreground hover:text-primary'
            )}
          >
            <ImagePlus className="h-7 w-7" />
            <div className="text-center">
              <p className="text-sm font-semibold">Subir fotos</p>
              <p className="text-[10px] mt-0.5">
                JPG, PNG, WEBP · máx. {maxPhotos} fotos · {maxPhotos - total} restante{maxPhotos - total !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
        </>
      )}

      {!canAdd && !disabled && (
        <p className="text-[10px] text-muted-foreground text-center">
          Límite de {maxPhotos} fotos alcanzado. Eliminá alguna para agregar más.
        </p>
      )}
    </div>
  );
}
