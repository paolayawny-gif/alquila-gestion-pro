'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Building, Users, FileText, Search, ArrowRight, Wrench, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'property' | 'tenant' | 'contract' | 'invoice' | 'task' | 'nav';
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: CommandItem[];
}

const CATEGORY_ICONS: Record<CommandItem['category'], React.ElementType> = {
  property: Building,
  tenant: Users,
  contract: FileText,
  invoice: FileSpreadsheet,
  task: Wrench,
  nav: ArrowRight,
};

const CATEGORY_LABELS: Record<CommandItem['category'], string> = {
  property: 'Propiedades',
  tenant: 'Personas',
  contract: 'Contratos',
  invoice: 'Facturas',
  task: 'Mantenimiento',
  nav: 'Navegación',
};

export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const cat = CATEGORY_LABELS[item.category];
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const flat = Object.values(grouped).flat();

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleSelect = useCallback((item: CommandItem) => {
    item.onSelect();
    onOpenChange(false);
  }, [onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[activeIdx]) {
      handleSelect(flat[activeIdx]);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]') as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  let flatIdx = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg" aria-label="Búsqueda global">
        <div className="flex items-center gap-3 px-4 border-b h-14">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar propiedades, inquilinos, contratos..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          className="max-h-[380px] overflow-y-auto py-2"
          role="listbox"
          aria-label="Resultados de búsqueda"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          )}
          {Object.entries(grouped).map(([category, catItems]) => (
            <li key={category}>
              <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none">
                {category}
              </p>
              <ul>
                {catItems.map(item => {
                  const Icon = CATEGORY_ICONS[item.category];
                  const isActive = flatIdx === activeIdx;
                  const idx = flatIdx++;
                  return (
                    <li key={item.id}>
                      <button
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isActive ? 'bg-primary/8 text-primary' : 'hover:bg-muted/50',
                        )}
                      >
                        <div className={cn('h-7 w-7 rounded-md flex items-center justify-center shrink-0', isActive ? 'bg-primary/10' : 'bg-muted')}>
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          {item.sublabel && (
                            <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                          )}
                        </div>
                        {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1">Esc</kbd> cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
