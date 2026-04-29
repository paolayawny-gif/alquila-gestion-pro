const SIT_LABEL: Record<number, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Riesgo medio',
  4: 'Riesgo alto',
  5: 'Irrecuperable',
  6: 'Irrecuperable (disp. técnica)',
};

export function situacionLabel(s: number) {
  return SIT_LABEL[s] ?? `Situación ${s}`;
}

export function situacionColor(s: number): string {
  if (s <= 1) return 'green';
  if (s === 2) return 'lime';
  if (s === 3) return 'orange';
  return 'red';
}
