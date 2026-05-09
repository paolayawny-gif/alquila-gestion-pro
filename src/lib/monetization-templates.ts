export interface SuggestionTemplate {
  id: string;
  title: string;
  description: string;
  potentialNote: string;
  emoji: string;
}

export const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  {
    id: 'publicidad_exterior',
    title: 'Publicidad exterior',
    description: 'Las medianeras y frentes generan ingresos pasivos con cartelería o pantallas digitales. Ideal para propiedades en zonas de alto tránsito peatonal o vehicular.',
    potentialNote: 'Una medianera bien ubicada puede generar entre $80.000 y $400.000/mes.',
    emoji: '📢',
  },
  {
    id: 'cochera',
    title: 'Cochera / Estacionamiento',
    description: 'Si hay cocheras libres o sectores sin uso, pueden alquilarse por mes, semana, día o por hora. La demanda de estacionamiento es constante en zonas urbanas.',
    potentialNote: 'Una cochera puede generar entre $60.000 y $200.000/mes.',
    emoji: '🚗',
  },
  {
    id: 'baulera',
    title: 'Baulera / Depósito',
    description: 'Los espacios de almacenamiento tienen alta demanda entre inquilinos y comercios cercanos. Mínima inversión para ponerlos en valor.',
    potentialNote: 'Una baulera puede generar entre $30.000 y $80.000/mes.',
    emoji: '📦',
  },
  {
    id: 'local_comercial',
    title: 'Local comercial en planta baja',
    description: 'Los locales en planta baja con acceso a la calle son uno de los activos más rentables. Gastronómicos, comercios y servicios generan flujo permanente.',
    potentialNote: 'Un local bien ubicado puede multiplicar el retorno del inmueble.',
    emoji: '🏪',
  },
  {
    id: 'terraza',
    title: 'Terraza (antenas / paneles solares)',
    description: 'Las empresas de telecomunicaciones pagan por instalar antenas en terrazas. Los paneles solares también pueden instalarse en régimen de alquiler.',
    potentialNote: 'Un contrato de antena puede durar 5-10 años con renta mensual asegurada.',
    emoji: '📡',
  },
  {
    id: 'vending',
    title: 'Vending machines',
    description: 'Máquinas expendedoras de snacks, bebidas o artículos de primera necesidad instaladas en el hall o áreas comunes. Sin inversión del propietario.',
    potentialNote: 'Ingreso pasivo del 15-25% sobre ventas o canon fijo mensual.',
    emoji: '🥤',
  },
  {
    id: 'sum',
    title: 'SUM / Salón de eventos',
    description: 'Si la propiedad tiene un salón de usos múltiples, puede alquilarse por horas para reuniones, cumpleaños, capacitaciones o eventos corporativos.',
    potentialNote: 'Un SUM activo puede generar entre $80.000 y $300.000/mes.',
    emoji: '🎉',
  },
  {
    id: 'coworking',
    title: 'Espacio de coworking',
    description: 'Escritorios o salas disponibles durante el día pueden convertirse en espacios de trabajo por hora o mes para profesionales y freelancers.',
    potentialNote: 'Alta demanda post-pandemia; retorno rápido con baja inversión.',
    emoji: '💼',
  },
  {
    id: 'medianera_mural',
    title: 'Mural artístico / Intervención urbana',
    description: 'Marcas y artistas pagan por intervenir medianeras con murales. Revaloriza la propiedad y genera ingreso al mismo tiempo.',
    potentialNote: 'Acuerdos de 1-3 años con marcas de consumo masivo.',
    emoji: '🎨',
  },
  {
    id: 'locker',
    title: 'Lockers de entrega (eCommerce)',
    description: 'Las plataformas de eCommerce y mensajería buscan instalar lockers en edificios con alta circulación. Sin inversión del propietario.',
    potentialNote: 'Canon mensual fijo por parte de la empresa operadora.',
    emoji: '📬',
  },
];
