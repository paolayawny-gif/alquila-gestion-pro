'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeorefDireccion {
  nomenclatura: string;
  calle: { nombre: string };
  altura?: { valor: number | null };
  localidad_censal?: { nombre: string };
  localidad?: { nombre: string };
  departamento?: { nombre: string };
  provincia: { nombre: string };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function titleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|,)\S/g, c => c.toUpperCase());
}

function formatSuggestion(d: GeorefDireccion): string {
  const street = titleCase(d.calle?.nombre || '');
  const number = d.altura?.valor ? ` ${d.altura.valor}` : '';
  const city = titleCase(
    d.localidad?.nombre || d.localidad_censal?.nombre || d.departamento?.nombre || ''
  );
  const province = titleCase(d.provincia?.nombre || '');

  const parts = [`${street}${number}`, city, province].filter(Boolean);
  return parts.join(', ');
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Calle y número',
  className,
  disabled,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeorefDireccion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const url =
        `https://apis.datos.gob.ar/georef/api/direcciones` +
        `?direccion=${encodeURIComponent(query)}&max=7` +
        `&campos=nomenclatura,calle,altura,localidad_censal,localidad,departamento,provincia`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Georef no disponible');
      const data = await res.json();
      const items: GeorefDireccion[] = data.direcciones || [];
      setSuggestions(items);
      setIsOpen(items.length > 0);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 420);
  };

  const handleSelect = (d: GeorefDireccion) => {
    onChange(formatSuggestion(d));
    setSuggestions([]);
    setIsOpen(false);
  };

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          className={cn('pl-9 pr-8', className)}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="py-1">
            {suggestions.map((d, i) => {
              const street = titleCase(d.calle?.nombre || '');
              const number = d.altura?.valor ? ` ${d.altura.valor}` : '';
              const city = titleCase(
                d.localidad?.nombre || d.localidad_censal?.nombre || d.departamento?.nombre || ''
              );
              const province = titleCase(d.provincia?.nombre || '');
              return (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => handleSelect(d)}
                  className="w-full text-left px-3 py-2.5 hover:bg-primary/5 transition-colors flex items-start gap-2.5 border-b border-muted/60 last:border-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary/50 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {street}{number}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[city, province].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Footer Georef */}
          <div className="px-3 py-1.5 bg-muted/30 border-t flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground/70">
              Sugerencias vía{' '}
              <span className="font-semibold text-muted-foreground">Georef</span>
              {' '}· datos.gob.ar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
