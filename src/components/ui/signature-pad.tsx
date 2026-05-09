'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onChange?: (dataUrl: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export function SignaturePad({ onChange, className, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'clientX' in e ? e.clientX : (e as Touch).clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as Touch).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    drawing.current = true;
    const src = 'touches' in e ? e.touches[0] : e.nativeEvent as MouseEvent;
    const pos = getPos(src as MouseEvent | Touch, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }, [disabled]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const src = 'touches' in e ? e.touches[0] : e.nativeEvent as MouseEvent;
    const pos = getPos(src as MouseEvent | Touch, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    e.preventDefault();
  }, [disabled]);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL('image/png');
    setIsEmpty(false);
    onChange?.(dataUrl);
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange?.(null);
  }, [onChange]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className={cn(
        'relative border-2 rounded-xl overflow-hidden bg-white',
        disabled ? 'border-muted opacity-60' : 'border-primary/30 hover:border-primary/60',
      )}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 180 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && !disabled && (
          <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none select-none">
            Dibujá tu firma aquí
          </p>
        )}
      </div>
      {!disabled && !isEmpty && (
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive self-end transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Borrar y volver a firmar
        </button>
      )}
    </div>
  );
}
