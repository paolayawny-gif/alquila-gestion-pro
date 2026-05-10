"use client";

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const OPTIONS = [
  { value: 'light',  icon: Sun,     label: 'Claro'   },
  { value: 'system', icon: Monitor, label: 'Sistema' },
  { value: 'dark',   icon: Moon,    label: 'Oscuro'  },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-8 w-[88px] rounded-full bg-muted/50" />;

  return (
    <div className="flex items-center gap-0.5 bg-muted/50 border border-border/60 rounded-full p-0.5 h-8">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            title={label}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center transition-colors duration-200',
              active
                ? 'bg-white dark:bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
