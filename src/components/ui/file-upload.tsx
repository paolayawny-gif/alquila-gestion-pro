'use client';

import React, { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Paperclip, X, Loader2, AlertCircle, FileCheck2 } from 'lucide-react';

interface FileUploadProps {
  /** URL ya guardada, si existe */
  value?: string;
  /** Nombre a mostrar junto al archivo ya subido (opcional, cosmetico) */
  valueName?: string;
  onChange: (url: string) => void;
  /** Prefijo de carpeta en Storage, ej: "comprobantes/abc123" */
  storagePath: string;
  accept?: string;
  maxSizeMb?: number;
  disabled?: boolean;
  label?: string;
}

/**
 * Subida de un único archivo (comprobante, foto de reclamo, etc.) a Firebase Storage.
 * Reemplaza el patrón de "pegá un link de Drive/Fotos" por una carga real con progreso.
 */
export function FileUpload({
  value,
  valueName,
  onChange,
  storagePath,
  accept = 'image/*,application/pdf',
  maxSizeMb = 8,
  disabled,
  label = 'Adjuntar archivo',
}: FileUploadProps) {
  const storage = useStorage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || disabled) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`El archivo supera los ${maxSizeMb}MB.`);
      return;
    }

    setError(null);
    setProgress(0);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const storageRef = ref(storage, `${storagePath}/${id}.${ext}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => {
        console.error('[Storage] Error:', err);
        setError('No se pudo subir el archivo. Intentá de nuevo.');
        setProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onChange(url);
        setProgress(null);
      }
    );

    if (inputRef.current) inputRef.current.value = '';
  };

  const isUploading = progress !== null;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFile(e.target.files)}
      />

      {value && !isUploading ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-emerald-50 border-emerald-200 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-800 truncate hover:underline">
              {valueName || 'Archivo adjuntado'}
            </a>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="h-5 w-5 rounded-full flex items-center justify-center text-emerald-700 hover:bg-emerald-100 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : isUploading ? (
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{progress}%</span>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn('w-full justify-start gap-2 text-muted-foreground font-normal')}
        >
          <Paperclip className="h-4 w-4" /> {label}
        </Button>
      )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
