import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a number as Argentine currency: 1234567 → "1.234.567" */
export function formatAmount(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return Math.round(num).toLocaleString('es-AR').replace(',', '');
}

/** Parses a formatted amount string back to number: "1.234.567" → 1234567 */
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}
