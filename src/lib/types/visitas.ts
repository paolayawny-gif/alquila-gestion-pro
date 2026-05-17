export type VisitStatus = 'Pendiente' | 'Confirmada' | 'Realizada' | 'Cancelada' | 'Reprogramada';

export interface EventType {
  id: string;
  name: string;
  color: string;
  duration: number; // minutes
  description?: string;
}

export interface WorkingHourSlot {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface VisitasConfig {
  eventTypes: EventType[];
  workingHours: Record<number, WorkingHourSlot>; // 0=Dom … 6=Sáb
  slotDuration: number;   // minutes between available slots (15|30|60)
  bufferTime: number;     // minutes buffer between visits
  autoConfirm: boolean;
  notifyVisitor: boolean;
  notifyAdmin: boolean;
  reminderHours: number;  // hours before visit to send reminder email
}

export interface Visit {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  eventTypeId: string;
  eventTypeName: string;
  eventTypeColor: string;
  scheduledDate: string;  // YYYY-MM-DD
  scheduledTime: string;  // HH:MM
  duration: number;       // minutes
  status: VisitStatus;
  notes?: string;
  agentName?: string;
  createdAt: number;
  updatedAt: number;
}
