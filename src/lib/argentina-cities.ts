export const ARGENTINA_CITIES: Record<string, string[]> = {
  'Ciudad Autónoma de Buenos Aires': ['Buenos Aires (CABA)'],
  'Buenos Aires': [
    'La Plata', 'Mar del Plata', 'Bahía Blanca', 'Quilmes', 'Lanús',
    'Lomas de Zamora', 'Morón', 'San Isidro', 'Tigre', 'Pilar',
    'Tandil', 'Necochea', 'Pergamino', 'Zárate', 'Campana',
    'San Nicolás de los Arroyos', 'Junín', 'Mercedes', 'Azul',
    'Olavarría', 'Mar del Plata', 'Tres Arroyos',
  ],
  'Córdoba': [
    'Córdoba', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María',
    'San Francisco', 'Alta Gracia', 'Jesús María', 'Bell Ville',
    'Cosquín', 'La Falda', 'Marcos Juárez',
  ],
  'Santa Fe': [
    'Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto',
    'Reconquista', 'Santo Tomé', 'Villa Gobernador Gálvez',
    'Esperanza', 'Casilda',
  ],
  'Mendoza': [
    'Mendoza', 'San Rafael', 'Godoy Cruz', 'Maipú',
    'Luján de Cuyo', 'Guaymallén', 'Las Heras', 'Rivadavia',
    'General Alvear',
  ],
  'Tucumán': [
    'San Miguel de Tucumán', 'Tafí Viejo', 'Concepción',
    'Yerba Buena', 'Banda del Río Salí', 'Aguilares',
  ],
  'Entre Ríos': [
    'Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay',
    'Villaguay', 'Colón',
  ],
  'Salta': [
    'Salta', 'Tartagal', 'Orán', 'Metán', 'General Güemes',
    'San Ramón de la Nueva Orán',
  ],
  'Chaco': [
    'Resistencia', 'Barranqueras', 'Presidencia Roque Sáenz Peña',
    'Villa Ángela', 'Charata',
  ],
  'Misiones': [
    'Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Apóstoles',
  ],
  'Corrientes': [
    'Corrientes', 'Goya', 'Curuzú Cuatiá', 'Mercedes',
    'Paso de los Libres',
  ],
  'Jujuy': [
    'San Salvador de Jujuy', 'Palpalá', 'San Pedro de Jujuy',
    'Libertador General San Martín', 'Humahuaca',
  ],
  'Santiago del Estero': [
    'Santiago del Estero', 'La Banda', 'Termas de Río Hondo',
    'Añatuya', 'Frías',
  ],
  'Río Negro': [
    'Bariloche', 'General Roca', 'Cipolletti', 'Viedma',
    'Allen', 'Neuquén (conurbano)',
  ],
  'Neuquén': [
    'Neuquén', 'San Martín de los Andes', 'Villa La Angostura',
    'Zapala', 'Cutral Có',
  ],
  'Chubut': [
    'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Rawson',
    'Esquel',
  ],
  'San Juan': [
    'San Juan', 'Rivadavia', 'Santa Lucía', 'Pocito',
    'Caucete',
  ],
  'Formosa': ['Formosa', 'Clorinda', 'Pirané'],
  'La Pampa': ['Santa Rosa', 'General Pico', 'Realicó'],
  'San Luis': ['San Luis', 'Villa Mercedes', 'Merlo'],
  'Catamarca': [
    'San Fernando del Valle de Catamarca', 'Tinogasta',
    'Andalgalá', 'Belén',
  ],
  'La Rioja': ['La Rioja', 'Chilecito', 'Aimogasta'],
  'Tierra del Fuego': ['Ushuaia', 'Río Grande', 'Tolhuin'],
  'Santa Cruz': ['Río Gallegos', 'El Calafate', 'Caleta Olivia', 'Pico Truncado'],
};

export const ARGENTINA_PROVINCES = Object.keys(ARGENTINA_CITIES).sort();
