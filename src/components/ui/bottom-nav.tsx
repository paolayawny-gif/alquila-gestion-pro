'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface BottomNavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  activeColor?: string;
}

export function BottomNav({ items, activeId, onSelect, activeColor = 'text-primary' }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-popover dark:bg-card border-t z-50 bottom-nav-safe">
      <div className="flex items-stretch h-14">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
              activeId === item.id ? activeColor : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-semibold leading-none tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
