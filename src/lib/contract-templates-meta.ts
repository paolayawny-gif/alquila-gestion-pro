import { Home, Building2, Car, FileText, Users, ClipboardList, KeyRound, RotateCcw } from 'lucide-react';

export interface TemplateVariable {
  key: string;           // placeholder text inside [  ]  in the docx
  label: string;         // human-readable label for the form field
  type: 'text' | 'date' | 'number' | 'select';
  options?: string[];    // for select type
  autoFill?: string;     // which app field to auto-fill from
  hint?: string;
}

export interface ContractTemplate {
  id: string;
  label: string;
  description: string;
  filename: string;      // file inside /public/templates/
  icon: any;
  category: 'contrato' | 'anexo';
  variables: TemplateVariable[];
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'vivienda',
    label: 'Contrato de Locación de Vivienda',
    description: 'Modelo estándar para alquiler de vivienda habitual. DNU 70/2023 + CCyCN.',
    filename: 'Modelo Contrato Locación de Vivienda (1).docx',
    icon: Home,
    category: 'contrato',
    variables: [
      { key: 'Día',                                 label: 'Día de firma',          type: 'text',   autoFill: 'today_day' },
      { key: 'Mes',                                 label: 'Mes de firma',          type: 'text',   autoFill: 'today_month' },
      { key: 'Año',                                 label: 'Año de firma',          type: 'text',   autoFill: 'today_year' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',         label: 'Nombre completo del Locador',   type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',       label: 'Nombre completo del Locatario', type: 'text', autoFill: 'tenant_name' },
      { key: 'NOMBRE COMPLETO DEL FIADOR',          label: 'Nombre completo del Fiador',    type: 'text', autoFill: 'guarantor_name' },
      { key: 'Dirección completa, incluyendo piso, depto., etc.', label: 'Dirección del inmueble', type: 'text', autoFill: 'property_address' },
      { key: 'Duración, ej: VEINTICATRO (24) MESES', label: 'Duración del contrato', type: 'text', autoFill: 'duration_label', hint: 'Ej: VEINTICUATRO (24) MESES' },
      { key: 'Fecha de Inicio',                     label: 'Fecha de inicio',       type: 'text',   autoFill: 'start_date' },
      { key: 'Fecha de Fin',                        label: 'Fecha de fin',          type: 'text',   autoFill: 'end_date' },
      { key: 'MONTO EN LETRAS',                     label: 'Canon en letras',       type: 'text',   autoFill: 'rent_words' },
      { key: 'MONTO EN NÚMEROS',                    label: 'Canon en números',      type: 'text',   autoFill: 'rent_number' },
      { key: 'ELEGIR: Índice de Precios al Consumidor (IPC) publicado por el INDEC / Índice para Contratos de Locación (ICL) publicado por el BCRA', label: 'Mecanismo de ajuste', type: 'select', options: ['Índice de Precios al Consumidor (IPC) publicado por el INDEC', 'Índice para Contratos de Locación (ICL) publicado por el BCRA'], autoFill: 'adjustment_label' },
      { key: 'COMPLETAR MONTO EN LETRAS',           label: 'Depósito en letras',    type: 'text',   autoFill: 'deposit_words' },
      { key: 'COMPLETAR MONTO EN NÚMEROS',          label: 'Depósito en números',   type: 'text',   autoFill: 'deposit_number' },
    ],
  },
  {
    id: 'vivienda_cochera',
    label: 'Contrato de Locación de Vivienda con Cochera',
    description: 'Igual al modelo de vivienda pero incluye cláusula de cochera.',
    filename: 'CONTRATO DE LOCACIÓN DE VIVIENDA (CON COCHERA) (1).docx',
    icon: Car,
    category: 'contrato',
    variables: [
      { key: 'Día',                                 label: 'Día de firma',          type: 'text',   autoFill: 'today_day' },
      { key: 'Mes',                                 label: 'Mes de firma',          type: 'text',   autoFill: 'today_month' },
      { key: 'Año',                                 label: 'Año de firma',          type: 'text',   autoFill: 'today_year' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',         label: 'Nombre del Locador',    type: 'text',   autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',       label: 'Nombre del Locatario',  type: 'text',   autoFill: 'tenant_name' },
      { key: 'NOMBRE COMPLETO DEL FIADOR',          label: 'Nombre del Fiador',     type: 'text',   autoFill: 'guarantor_name' },
      { key: 'Dirección completa, incluyendo piso, depto., etc.', label: 'Dirección inmueble', type: 'text', autoFill: 'property_address' },
      { key: 'Duración, ej: VEINTICATRO (24) MESES', label: 'Duración', type: 'text', autoFill: 'duration_label' },
      { key: 'Fecha de Inicio',                     label: 'Fecha de inicio',       type: 'text',   autoFill: 'start_date' },
      { key: 'Fecha de Fin',                        label: 'Fecha de fin',          type: 'text',   autoFill: 'end_date' },
      { key: 'MONTO EN LETRAS',                     label: 'Canon en letras',       type: 'text',   autoFill: 'rent_words' },
      { key: 'MONTO EN NÚMEROS',                    label: 'Canon en números',      type: 'text',   autoFill: 'rent_number' },
      { key: 'ELEGIR: Índice de Precios al Consumidor (IPC) publicado por el INDEC / Índice para Contratos de Locación (ICL) publicado por el BCRA', label: 'Mecanismo de ajuste', type: 'select', options: ['Índice de Precios al Consumidor (IPC) publicado por el INDEC', 'Índice para Contratos de Locación (ICL) publicado por el BCRA'], autoFill: 'adjustment_label' },
      { key: 'COMPLETAR MONTO EN LETRAS',           label: 'Depósito en letras',    type: 'text',   autoFill: 'deposit_words' },
      { key: 'COMPLETAR MONTO EN NÚMEROS',          label: 'Depósito en números',   type: 'text',   autoFill: 'deposit_number' },
    ],
  },
  {
    id: 'comercial',
    label: 'Contrato de Locación Comercial',
    description: 'Para locales, oficinas y usos distintos de vivienda.',
    filename: 'Modelo Contrato de Locación Locales (1).docx',
    icon: Building2,
    category: 'contrato',
    variables: [
      { key: 'Día',                                 label: 'Día de firma',          type: 'text',   autoFill: 'today_day' },
      { key: 'Mes',                                 label: 'Mes de firma',          type: 'text',   autoFill: 'today_month' },
      { key: 'Año',                                 label: 'Año de firma',          type: 'text',   autoFill: 'today_year' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',         label: 'Nombre del Locador',    type: 'text',   autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',       label: 'Nombre del Locatario',  type: 'text',   autoFill: 'tenant_name' },
      { key: 'NOMBRE COMPLETO DEL FIADOR',          label: 'Nombre del Fiador',     type: 'text',   autoFill: 'guarantor_name' },
      { key: 'Fecha de Inicio',                     label: 'Fecha de inicio',       type: 'text',   autoFill: 'start_date' },
      { key: 'Fecha de Fin',                        label: 'Fecha de fin',          type: 'text',   autoFill: 'end_date' },
      { key: 'MONTO EN LETRAS',                     label: 'Canon en letras',       type: 'text',   autoFill: 'rent_words' },
      { key: 'MONTO EN NÚMEROS',                    label: 'Canon en números',      type: 'text',   autoFill: 'rent_number' },
    ],
  },
  {
    id: 'anexo1_deptos',
    label: 'Anexo I — Inventario y Estado (Departamentos)',
    description: 'Acta de constatación de estado del inmueble para departamentos.',
    filename: 'Anexo I Alquiler Deptos (1).docx',
    icon: ClipboardList,
    category: 'anexo',
    variables: [
      { key: 'Día',   label: 'Día',   type: 'text', autoFill: 'today_day' },
      { key: 'Mes',   label: 'Mes',   type: 'text', autoFill: 'today_month' },
      { key: 'Año',   label: 'Año',   type: 'text', autoFill: 'today_year' },
      { key: 'Dirección completa del inmueble', label: 'Dirección del inmueble', type: 'text', autoFill: 'property_address' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',     label: 'Nombre del Locador',    type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',   label: 'Nombre del Locatario',  type: 'text', autoFill: 'tenant_name' },
    ],
  },
  {
    id: 'anexo1_locales',
    label: 'Anexo I — Inventario y Estado (Locales Comerciales)',
    description: 'Acta de constatación de estado para locales y oficinas.',
    filename: 'Anexo I Locales Comerciales (1).docx',
    icon: ClipboardList,
    category: 'anexo',
    variables: [
      { key: 'Día',   label: 'Día',   type: 'text', autoFill: 'today_day' },
      { key: 'Mes',   label: 'Mes',   type: 'text', autoFill: 'today_month' },
      { key: 'Año',   label: 'Año',   type: 'text', autoFill: 'today_year' },
      { key: 'Dirección completa del inmueble', label: 'Dirección del inmueble', type: 'text', autoFill: 'property_address' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',     label: 'Nombre del Locador',    type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',   label: 'Nombre del Locatario',  type: 'text', autoFill: 'tenant_name' },
    ],
  },
  {
    id: 'anexo2_fiador',
    label: 'Anexo II — Constancia de Ingresos del Fiador',
    description: 'Declaración jurada de solvencia del garante.',
    filename: 'Anexo II  CONSTANCIA DE INGRESOS DEL FIADOR (1).docx',
    icon: Users,
    category: 'anexo',
    variables: [
      { key: 'Día',   label: 'Día',   type: 'text', autoFill: 'today_day' },
      { key: 'Mes',   label: 'Mes',   type: 'text', autoFill: 'today_month' },
      { key: 'Año',   label: 'Año',   type: 'text', autoFill: 'today_year' },
      { key: 'Dirección completa del inmueble', label: 'Dirección del inmueble', type: 'text', autoFill: 'property_address' },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',     label: 'Nombre del Locador',    type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',   label: 'Nombre del Locatario',  type: 'text', autoFill: 'tenant_name' },
      { key: 'NOMBRE COMPLETO DEL FIADOR',      label: 'Nombre del Fiador',     type: 'text', autoFill: 'guarantor_name' },
    ],
  },
  {
    id: 'anexo3_reglamento',
    label: 'Anexo III — Reglamento Interno de Uso y Convivencia',
    description: 'Reglamento interno del edificio o propiedad.',
    filename: 'Anexo III REGLAMENTO INTERNO DE USO Y CONVIVENCIA (1).docx',
    icon: FileText,
    category: 'anexo',
    variables: [
      { key: 'Nombre del Cliente/Propietario',  label: 'Nombre del propietario',  type: 'text', autoFill: 'owner_name' },
      { key: 'Dirección Completa del Edificio', label: 'Dirección del edificio',   type: 'text', autoFill: 'property_address' },
    ],
  },
  {
    id: 'anexo4_entrega',
    label: 'Anexo IV — Acta de Entrega de Llaves al Locatario',
    description: 'Acta de entrega de tenencia y llaves al inicio del contrato.',
    filename: 'ANEXO IV ACTA DE ENTREGA DE TENENCIA Y LLAVES AL LOCATARIO (1).docx',
    icon: KeyRound,
    category: 'anexo',
    variables: [
      { key: 'Día',   label: 'Día',   type: 'text', autoFill: 'today_day' },
      { key: 'Mes',   label: 'Mes',   type: 'text', autoFill: 'today_month' },
      { key: 'Año',   label: 'Año',   type: 'text', autoFill: 'today_year' },
      { key: 'Indicar: VIVIENDA / USO COMERCIAL', label: 'Tipo de contrato', type: 'select', options: ['VIVIENDA', 'USO COMERCIAL'] },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',        label: 'Nombre del Locador',   type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',      label: 'Nombre del Locatario', type: 'text', autoFill: 'tenant_name' },
    ],
  },
  {
    id: 'anexo5_restitucion',
    label: 'Anexo V — Acta de Restitución al Locador',
    description: 'Conformidad y devolución de tenencia al finalizar el contrato.',
    filename: 'ANEXO V - ACTA DE RESTITUCIÓN DE TENENCIA AL LOCADOR (RESERVA - CONFORMIDAD) (1).docx',
    icon: RotateCcw,
    category: 'anexo',
    variables: [
      { key: 'Día',   label: 'Día',   type: 'text', autoFill: 'today_day' },
      { key: 'Mes',   label: 'Mes',   type: 'text', autoFill: 'today_month' },
      { key: 'Año',   label: 'Año',   type: 'text', autoFill: 'today_year' },
      { key: 'Indicar: VIVIENDA / USO COMERCIAL', label: 'Tipo de contrato', type: 'select', options: ['VIVIENDA', 'USO COMERCIAL'] },
      { key: 'NOMBRE COMPLETO DEL LOCADOR',        label: 'Nombre del Locador',   type: 'text', autoFill: 'owner_name' },
      { key: 'NOMBRE COMPLETO DEL LOCATARIO',      label: 'Nombre del Locatario', type: 'text', autoFill: 'tenant_name' },
    ],
  },
];
