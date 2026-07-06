export type PropertyType = 'Departamento' | 'Casa' | 'Local' | 'Cochera' | 'Oficina' | 'Depósito' | 'Terreno';
export type PropertyUsage = 'Vivienda' | 'Comercial' | 'Profesional' | 'Industrial';
export type PropertyStatus = 'Disponible' | 'Reservada' | 'Alquilada' | 'En Mantenimiento';
export type AdjustmentMechanism = 'ICL' | 'IPC' | 'CasaPropia' | 'Fixed' | 'CER';
export type Currency = 'ARS' | 'USD' | 'UVA';
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Mercado Pago' | 'Depósito' | 'Cheque';
export type ChargeType = 'Alquiler' | 'Expensa Ordinaria' | 'Expensa Extraordinaria' | 'TGI/ABL' | 'Aguas' | 'Luz/Gas' | 'Reparaciones' | 'Mantenimiento' | 'Impuestos' | 'Otros';
export type ChargePayer = 'Inquilino' | 'Propietario';
export type ApplicationStatus = 'Nueva' | 'En análisis' | 'Aprobada' | 'Rechazada' | 'Pendiente de documentación';

export interface IndexRecord {
  id: string;
  month: string; // YYYY-MM for monthly indices, YYYY-MM-DD for CER daily
  type: AdjustmentMechanism;
  value: number;
}

export interface DocumentInfo {
  id: string;
  name: string;
  url: string;
  type: string;
  status: 'Pendiente' | 'Validado' | 'Rechazado';
  date: string;
  version?: number;
}

export interface BankDetails {
  bank: string;
  cbu: string;
  alias: string;
}

export interface AIConfig {
  /** Proveedor de IA elegido por el admin (Gemini, ChatGPT, Claude o DeepSeek). */
  provider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
  /** API key propia del admin para el proveedor elegido. */
  apiKey?: string;
  /** @deprecated campo viejo, solo Gemini — se sigue leyendo para no romper configuraciones ya guardadas. */
  geminiApiKey?: string;
  updatedAt?: string;
}
