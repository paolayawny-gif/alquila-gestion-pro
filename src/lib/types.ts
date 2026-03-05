export interface Property {
  id: string;
  name: string;
  address: string;
  unit?: string;
  ownerName: string;
  monthlyRent: number;
}

export interface Tenant {
  id: string;
  name: string;
  propertyId: string;
  propertyName?: string;
  phone: string;
  leaseEndDate: string;
  status: 'Al día' | 'Atrasado' | 'En legales';
  hasContractFile: boolean;
}

export interface Invoice {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido';
  hasFile: boolean;
}

export interface MaintenanceTask {
  id: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: 'Pendiente' | 'En curso' | 'Completado';
  hasFile: boolean;
}

export interface LegalCase {
  id: string;
  type: string;
  propertyName: string;
  startDate: string;
  attorney: string;
  status: 'Pendiente' | 'En proceso' | 'Acuerdo firmado' | 'Finalizado';
  hasFile: boolean;
}

export interface Liquidation {
  id: string;
  propertyName: string;
  rentAmount: number;
  adminFee: number;
  maintenanceDeductions: number;
  netAmount: number;
  period: string;
}