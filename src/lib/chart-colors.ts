"use client";

import { useTheme } from 'next-themes';

export interface ChartPalette {
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  positive: string;
  positiveSoft: string;
  warning: string;
  pending: string;
  pendingSoft: string;
  projected: string;
  projectedSoft: string;
  neutral: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
  categorical: string[];
}

/**
 * Semantic chart palette shared by every recharts view in the dashboard.
 * Keeps the same concept (income, expense, projected, ...) mapped to the
 * same color across screens, with a dark-mode variant tuned for contrast
 * against the app's dark card backgrounds.
 */
export const CHART_PALETTE: { light: ChartPalette; dark: ChartPalette } = {
  light: {
    income: '#0369A1',
    incomeSoft: '#7DD3FC',
    expense: '#ef4444',
    expenseSoft: '#fca5a5',
    positive: '#16a34a',
    positiveSoft: '#dcfce7',
    warning: '#f59e0b',
    pending: '#fbbf24',
    pendingSoft: '#fecaca',
    projected: '#94a3b8',
    projectedSoft: '#e2e8f0',
    neutral: '#cbd5e1',
    grid: '#f1f5f9',
    axis: '#94a3b8',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipShadow: 'rgba(15, 23, 42, 0.1)',
    categorical: ['#0369A1', '#f97316', '#8b5cf6', '#16a34a', '#ef4444', '#eab308'],
  },
  dark: {
    income: '#38bdf8',
    incomeSoft: '#0c4a6e',
    expense: '#f87171',
    expenseSoft: '#7f1d1d',
    positive: '#4ade80',
    positiveSoft: '#14532d',
    warning: '#fbbf24',
    pending: '#fcd34d',
    pendingSoft: '#7f1d1d',
    projected: '#64748b',
    projectedSoft: '#334155',
    neutral: '#475569',
    grid: '#334155',
    axis: '#64748b',
    tooltipBg: '#1e293b',
    tooltipBorder: '#334155',
    tooltipShadow: 'rgba(0, 0, 0, 0.4)',
    categorical: ['#38bdf8', '#fb923c', '#a78bfa', '#4ade80', '#f87171', '#facc15'],
  },
};

/**
 * Returns the chart palette matching the active theme. Falls back to the
 * light palette during SSR/first paint (before next-themes resolves),
 * matching the app's default light appearance.
 */
export function useChartColors(): ChartPalette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? CHART_PALETTE.dark : CHART_PALETTE.light;
}
