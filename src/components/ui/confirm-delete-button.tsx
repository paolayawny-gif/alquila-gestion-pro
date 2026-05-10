'use client';

import React, { ReactNode, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

export type DeleteBlocker = { reason: string };

interface ConfirmDeleteButtonProps {
  /** Botón/elemento que dispara el dialog (ej: ícono de Trash). */
  trigger: ReactNode;
  /** Título del dialog. Por defecto: "Eliminar registro". */
  title?: string;
  /** Descripción / mensaje principal. */
  description?: ReactNode;
  /** Nombre del item (se usa para el confirm bold). */
  itemName?: string;
  /**
   * Si está presente, bloquea la eliminación y muestra el motivo.
   * Ej: "Esta propiedad tiene 2 contratos vigentes."
   */
  blockedReason?: string | null;
  /** Texto del botón de confirmación. Default: "Eliminar". */
  confirmLabel?: string;
  /** Acción a ejecutar al confirmar. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Wrapper para acciones destructivas. Muestra un AlertDialog con confirmación.
 * Si `blockedReason` viene seteado, deshabilita el botón de confirmar y explica
 * por qué no se puede eliminar (cascada de dependencias).
 */
export function ConfirmDeleteButton({
  trigger,
  title = 'Eliminar registro',
  description,
  itemName,
  blockedReason,
  confirmLabel = 'Eliminar',
  onConfirm,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (blockedReason) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className={blockedReason ? 'h-5 w-5 text-orange-500' : 'h-5 w-5 text-destructive'} />
            {blockedReason ? 'No se puede eliminar' : title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {blockedReason ? (
                <div className="rounded border border-orange-200 bg-orange-50 p-3 text-orange-900">
                  {blockedReason}
                </div>
              ) : (
                <>
                  {description ?? <p>Esta acción no se puede deshacer.</p>}
                  {itemName && (
                    <p className="font-medium text-foreground">
                      Se eliminará: <span className="font-bold">{itemName}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!!blockedReason || busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? 'Eliminando…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
