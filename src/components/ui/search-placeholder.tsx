"use client";

import { useEffect, useState } from 'react';

const TIPS = [
  'Buscar propiedades, inquilinos...',
  'Ir a Facturas...',
  'Buscar contratos...',
  'Ir a Mantenimiento...',
  'Buscar inquilinos...',
  'Ir a Reportes...',
];

export function SearchPlaceholder() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % TIPS.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(cycle);
  }, []);

  return (
    <span
      className="text-sm text-muted-foreground flex-1 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {TIPS[index]}
    </span>
  );
}
