"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (value === 0 || value === undefined) {
      setDisplay('');
    } else {
      setDisplay(Math.round(value).toLocaleString('es-AR').replace(/,/g, ''));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    const formatted = num > 0 ? num.toLocaleString('es-AR').replace(/,/g, '') : '';
    setDisplay(formatted);
    onChange(num);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      className={cn(className)}
    />
  );
}
