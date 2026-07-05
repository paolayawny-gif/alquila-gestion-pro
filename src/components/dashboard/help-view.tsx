"use client";

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Search, Sparkles, Send, Loader2, ChevronDown, ChevronRight,
  LayoutDashboard, Building, Users, FilePen, Zap, PiggyBank, UserPlus,
  FileSpreadsheet, ClipboardList, Wrench, ShieldPlus, HardHat, MessagesSquare,
  CalendarRange, Vote, ConciergeBell, Store, ShoppingBag,
  ShieldCheck, Scale, Calculator, LineChart, BookOpen,
  Megaphone, Share2, TrendingUp,
  BarChart3, BrainCircuit, MessageSquareCode,
  Settings, BookMarked, HelpCircle, ExternalLink, ArrowRight, Lightbulb,
  Home, FileText, CreditCard, Bell, Building2, Receipt, MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { askHelpAssistant, HelpAssistantOutput } from '@/ai/flows/help-assistant-flow';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAIConfig } from '@/hooks/use-ai-config';
import { AIKeyRequiredNotice } from '@/components/ui/ai-key-required-notice';

// ────────────────────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────────────────────

type PortalRole = 'admin' | 'inquilino' | 'propietario';

type HelpSection = {
  id: string;
  group: string;
  label: string;
  icon: React.ElementType;
  short: string;
  what: string;
  when: string;
  steps: string[];
  tips?: string[];
  related?: string[];
};

type FaqItem = { q: string; a: string };

// ────────────────────────────────────────────────────────────────────────────
// CONTENIDO ADMINISTRADOR (30 módulos)
// ────────────────────────────────────────────────────────────────────────────

const ADMIN_SECTIONS: HelpSection[] = [
  {
    id: 'Resumen', group: 'Panel', label: 'Panel de Control', icon: LayoutDashboard,
    short: 'Vista global con KPIs, ingresos, alertas y accesos rápidos.',
    what: 'Pantalla de inicio. Muestra los indicadores clave en tiempo real: propiedades alquiladas vs disponibles, recaudación del mes, inquilinos en mora, estado de la caja y próximos ajustes.',
    when: 'Revisarlo cada día al entrar a la app.',
    steps: ['Revisá las 4 tarjetas KPI superiores.', 'Mirá el gráfico anual de ingresos.', 'Usá los Accesos Rápidos para saltar a cualquier módulo.', 'Atendé próximos ajustes y reclamos al pie.'],
  },
  {
    id: 'Propiedades', group: 'Cartera', label: 'Propiedades', icon: Building,
    short: 'Alta y gestión de inmuebles, fotos, propietarios y estado.',
    what: 'Registrás cada inmueble: dirección, características, propietarios con porcentajes, fotos y estado (disponible/alquilada/en reforma).',
    when: 'Al incorporar un inmueble nuevo o actualizar sus datos.',
    steps: ['Clic en "+ Nueva Propiedad".', 'Completá dirección con autocompletado.', 'Agregá propietarios con porcentaje (deben sumar 100%).', 'Subí fotos y guardá.'],
    tips: ['Los porcentajes de propietarios deben sumar exactamente 100%.'],
    related: ['Personas', 'Generador Contratos', 'Seguros'],
  },
  {
    id: 'Personas', group: 'Cartera', label: 'Personas y Contratos', icon: Users,
    short: 'Inquilinos, propietarios, garantes y sus contratos vigentes.',
    what: 'Padrón único de personas y sus contratos. Desde acá ves el historial de cada persona, sus pagos y podés iniciar ajustes de índice.',
    when: 'Para dar de alta un inquilino, ver contratos o aplicar un ajuste.',
    steps: ['Buscá la persona por nombre o DNI.', 'Abrí su ficha para ver contratos vinculados.', 'Desde el contrato iniciá un ajuste de índice o revisá pagos.'],
    related: ['Generador Contratos', 'Índices', 'Liquidaciones'],
  },
  {
    id: 'Generador Contratos', group: 'Cartera', label: 'Generador de Contratos', icon: FilePen,
    short: 'Crea contratos de locación con plantillas y datos cargados.',
    what: 'Genera contratos (vivienda o comercial) con plantillas legales. Toma los datos de propiedad, inquilinos y garantes ya cargados.',
    when: 'Al cerrar un nuevo alquiler o renovar un contrato.',
    steps: ['Elegí la plantilla (vivienda/comercial).', 'Seleccioná propiedad, inquilino y garante.', 'Configurá monto, índice (ICL/IPC/CER) y duración.', 'Previsualizá y exportá a PDF.'],
    tips: ['El sistema completa cláusulas según DNU 70/2023 y CCyCN.'],
    related: ['Personas', 'Contratos Smart', 'Análisis IA'],
  },
  {
    id: 'Contratos Smart', group: 'Cartera', label: 'Contratos Smart', icon: Zap,
    short: 'Firma digital y notarización en blockchain (Polygon).',
    what: 'Permite firmar contratos digitalmente y notarizar el hash en Polygon, generando un legajo judicial irrefutable.',
    when: 'Cuando querés validez legal extra o evitar disputas.',
    steps: ['Generá el contrato en "Generador de Contratos".', 'Enviá la solicitud de firma a propietario e inquilino.', 'Al firmar ambos, el sistema notariza en Polygon automáticamente.', 'Descargá el legajo judicial con PDF, hash y comprobante.'],
    related: ['Generador Contratos', 'Legales'],
  },
  {
    id: 'Garantías', group: 'Cartera', label: 'Garantías y Depósitos', icon: PiggyBank,
    short: 'Registro y devolución de depósitos en garantía.',
    what: 'Lleva el control de depósitos recibidos al inicio del contrato y su devolución al cierre (con descuentos por reparaciones).',
    when: 'Al inicio del contrato (alta) y al cierre (devolución).',
    steps: ['Asociá el depósito al contrato e inquilino.', 'Registrá fecha y monto.', 'Al cierre, indicá descuentos y monto a devolver.'],
    related: ['Personas', 'Liquidaciones'],
  },
  {
    id: 'Solicitudes', group: 'Cartera', label: 'Solicitudes', icon: UserPlus,
    short: 'Postulaciones de candidatos a inquilinos.',
    what: 'Bandeja de aplicaciones con datos del candidato, ingresos declarados y referencias. Incluye análisis de riesgo con IA.',
    when: 'Cuando empezás a recibir interesados para una propiedad.',
    steps: ['Revisá la solicitud entrante.', 'Tocá "Analizar con IA" para obtener un score de riesgo.', 'Aprobá, rechazá o pedí más documentación.', 'Si la aprobás, convertila en contrato directamente.'],
    related: ['Personas', 'Generador Contratos'],
  },
  {
    id: 'Facturas', group: 'Operaciones', label: 'Facturas y Servicios', icon: FileSpreadsheet,
    short: 'Carga y seguimiento de facturas de servicios.',
    what: 'Registra facturas de servicios (luz, gas, ABL, expensas) por propiedad. La IA extrae datos desde foto/PDF.',
    when: 'Cuando llega una boleta y querés imputarla al inmueble correcto.',
    steps: ['Clic en "+ Nueva Factura".', 'Subí la foto/PDF de la boleta.', 'La IA extrae proveedor, monto, vencimiento y período.', 'Confirmá y asignala a la propiedad.'],
    related: ['Centro Liquidaciones', 'Libro Mayor'],
  },
  {
    id: 'Centro Liquidaciones', group: 'Operaciones', label: 'Centro de Liquidaciones', icon: ClipboardList,
    short: 'Hub para liquidaciones masivas mensuales a propietarios.',
    what: 'Ejecuta el cálculo de liquidaciones de todas las propiedades de un mes: ingresos, deducciones, comisión y neto al propietario.',
    when: 'Al cierre del período de liquidación mensual.',
    steps: ['Elegí el período (mes/año).', 'Revisá propiedades incluidas y montos.', 'Generá las liquidaciones masivamente.', 'Enviá reportes a cada propietario por email o WhatsApp.'],
    related: ['Liquidaciones', 'Libro Mayor'],
  },
  {
    id: 'Mantenimiento', group: 'Operaciones', label: 'Mantenimiento', icon: Wrench,
    short: 'Tickets de reparaciones y reclamos de inquilinos.',
    what: 'Sistema de tickets: prioridad, proveedor asignado, costo, estado y resolución.',
    when: 'Cuando un inquilino reporta una falla o detectás algo que reparar.',
    steps: ['Creá el ticket o recibilo desde el portal del inquilino.', 'Asigná prioridad y proveedor.', 'Cargá el presupuesto y aprobalo.', 'Marcá como cerrado y subí comprobantes.'],
    related: ['Proveedores', 'Mantenimiento Predictivo'],
  },
  {
    id: 'Mantenimiento Predictivo', group: 'Operaciones', label: 'Mantenimiento Predictivo', icon: ShieldPlus,
    short: 'IA que anticipa reparaciones según historial del inmueble.',
    what: 'Analiza el historial de tickets y predice qué reparaciones probablemente surjan (caldera, AA, humedades).',
    when: 'Para planificar mantenimiento preventivo y reducir urgencias.',
    steps: ['Elegí una propiedad.', 'Ejecutá el análisis predictivo.', 'Revisá recomendaciones y agendá inspecciones.'],
    related: ['Mantenimiento', 'Análisis IA'],
  },
  {
    id: 'Proveedores', group: 'Operaciones', label: 'Proveedores', icon: HardHat,
    short: 'Directorio de plomeros, electricistas, gasistas, etc.',
    what: 'Catálogo de proveedores con calificación, especialidad y contacto. Se vincula directamente desde tickets.',
    when: 'Para asignar un técnico a una reparación o evaluar quién contratar.',
    steps: ['Agregá un proveedor con nombre, rubro y contacto.', 'Calificalo después de cada trabajo.', 'Filtralo por especialidad al crear un ticket.'],
    related: ['Mantenimiento'],
  },
  {
    id: 'Mensajes', group: 'Operaciones', label: 'Mensajes', icon: MessagesSquare,
    short: 'Comunicaciones unificadas por email y WhatsApp.',
    what: 'Bandeja unificada para enviar mensajes a inquilinos, propietarios y garantes por email y WhatsApp.',
    when: 'Para recordatorios, intimaciones, avisos de ajuste o respuestas.',
    steps: ['Elegí el destinatario.', 'Seleccioná plantilla o redactá libremente (podés usar el Asistente IA).', 'Elegí canal: Email o WhatsApp.', 'Enviá y registrá en el historial.'],
    related: ['Asistente IA'],
  },
  {
    id: 'Rentas Híbridas', group: 'Comunidad', label: 'Rentas Híbridas', icon: CalendarRange,
    short: 'Combina alquiler tradicional con temporario en una misma unidad.',
    what: 'Gestiona propiedades con esquemas mixtos: vacancias temporarias entre contratos o alquiler por días/semanas.',
    when: 'Cuando una propiedad tiene períodos sin contrato largo y querés monetizarla por días.',
    steps: ['Habilitá la propiedad como "renta híbrida".', 'Definí calendario de disponibilidad.', 'Cargá tarifa por noche/semana.', 'Gestioná las reservas entrantes.'],
  },
  {
    id: 'Votaciones', group: 'Comunidad', label: 'Votaciones', icon: Vote,
    short: 'Sistema de votaciones para edificios en comunidad.',
    what: 'Votaciones digitales entre inquilinos/propietarios de una misma comunidad: cambios de proveedor, reformas, reglamento.',
    when: 'En decisiones colectivas de un edificio o complejo.',
    steps: ['Creá la votación con título y opciones.', 'Definí quién puede votar.', 'Compartí el enlace.', 'Mirá resultados en tiempo real.'],
  },
  {
    id: 'Concierge', group: 'Comunidad', label: 'Concierge', icon: ConciergeBell,
    short: 'Servicios extras para inquilinos premium.',
    what: 'Catálogo de servicios opcionales (mudanza, limpieza, electricista, internet) que el inquilino puede contratar desde la app.',
    when: 'Para diferenciar el servicio y generar ingresos por comisión.',
    steps: ['Habilitá los servicios disponibles.', 'El inquilino los solicita desde su portal.', 'Coordinás con el proveedor y cobrás la comisión.'],
  },
  {
    id: 'Comunidad', group: 'Comunidad', label: 'Comunidad', icon: Store,
    short: 'Muro social entre inquilinos del mismo edificio.',
    what: 'Espacio tipo muro donde inquilinos comparten avisos, recomendaciones y alertas.',
    when: 'En carteras grandes o edificios donde se busca generar comunidad.',
    steps: ['Habilitá la comunidad por edificio.', 'Moderá publicaciones desde la vista admin.'],
  },
  {
    id: 'Marketplace', group: 'Comunidad', label: 'Marketplace', icon: ShoppingBag,
    short: 'Compra-venta de artículos entre miembros.',
    what: 'Tablón tipo Marketplace para que inquilinos publiquen artículos para vender o regalar.',
    when: 'Suma comunidad sin costo para la administradora.',
    steps: ['Activá el Marketplace.', 'Los miembros publican y contactan entre sí.'],
  },
  {
    id: 'Seguros', group: 'Finanzas', label: 'Seguros y Coberturas', icon: ShieldCheck,
    short: 'Pólizas de caución, hogar e integral por contrato.',
    what: 'Registro de pólizas vigentes, vencimientos y aseguradora. Alertas previas al vencimiento.',
    when: 'Al cerrar contrato (caución) o asegurar el inmueble.',
    steps: ['Cargá la póliza con número, monto y vencimiento.', 'Asociala a la propiedad y/o contrato.', 'El sistema te avisa antes del vencimiento.'],
  },
  {
    id: 'Legales', group: 'Finanzas', label: 'Casos Legales', icon: Scale,
    short: 'Carpeta de juicios e intimaciones por incumplimientos.',
    what: 'Gestiona casos judiciales: desalojos, cobros, daños. Carga escritos, audiencias y estado procesal.',
    when: 'Cuando un caso de mora escala a la vía judicial.',
    steps: ['Creá el caso vinculado al contrato.', 'Cargá las etapas: intimación → mediación → demanda → sentencia.', 'Adjuntá escritos.', 'Generá el legajo judicial completo.'],
    related: ['Contratos Smart', 'Asistente IA'],
  },
  {
    id: 'Liquidaciones', group: 'Finanzas', label: 'Liquidaciones', icon: Calculator,
    short: 'Detalle individual de cada liquidación a propietario.',
    what: 'Vista detallada por propietario: ingresos, deducciones, neto a transferir.',
    when: 'Para auditar o reenviar una liquidación específica.',
    steps: ['Buscá por propietario y período.', 'Revisá los conceptos línea por línea.', 'Reenvía o exportá a PDF.'],
    related: ['Centro Liquidaciones'],
  },
  {
    id: 'Índices', group: 'Finanzas', label: 'Índices Oficiales', icon: LineChart,
    short: 'Histórico oficial de ICL, IPC, CER (BCRA / INDEC).',
    what: 'Tabla y serie histórica de índices oficiales para ajustes automáticos de alquiler.',
    when: 'Para verificar el porcentaje de ajuste antes de aplicarlo.',
    steps: ['Filtrá por índice (ICL/IPC/CER) y rango de fechas.', 'Exportá la serie si la necesitás.'],
    related: ['Personas', 'Generador Contratos'],
  },
  {
    id: 'Libro Mayor', group: 'Finanzas', label: 'Libro Mayor', icon: BookOpen,
    short: 'Contabilidad consolidada de toda la cartera.',
    what: 'Asientos contables: ingresos, egresos, comisiones y saldos por propiedad y propietario.',
    when: 'Para el cierre contable mensual/anual o compartir con el contador.',
    steps: ['Filtrá por período y propiedad.', 'Exportá a Excel/PDF.'],
  },
  {
    id: 'Monetización', group: 'Crecimiento', label: 'Publicidad y Monetización', icon: Megaphone,
    short: 'Espacios publicitarios y monetización de la cartera.',
    what: 'Habilita espacios publicitarios (medianeras, halls, bauleras) como activos monetizables.',
    when: 'Cuando querés sumar ingresos extra a las propiedades.',
    steps: ['Identificá el espacio.', 'Cargá tarifa y disponibilidad.', 'Recibí solicitudes de anunciantes.'],
  },
  {
    id: 'Redes Sociales', group: 'Crecimiento', label: 'Redes Sociales', icon: Share2,
    short: 'Generador de posts para redes sociales con IA.',
    what: 'Genera contenido para promocionar propiedades disponibles con copy y selección de fotos.',
    when: 'Al publicar una propiedad nueva o reforzar la disponibilidad.',
    steps: ['Elegí la propiedad.', 'Generá el post con IA.', 'Editá el copy y exportá la imagen.'],
  },
  {
    id: 'Simulador ROI', group: 'Crecimiento', label: 'Simulador de Rentabilidad', icon: TrendingUp,
    short: 'Calcula la rentabilidad esperada de una propiedad.',
    what: 'Simulador que proyecta ROI considerando precio, alquiler, vacancia, gastos e impuestos.',
    when: 'Para evaluar incorporar un inmueble o asesorar a un propietario.',
    steps: ['Cargá precio, alquiler estimado y plazo.', 'Configurá vacancia y gastos.', 'Visualizá la rentabilidad anual.'],
  },
  {
    id: 'Reportes', group: 'Analítica', label: 'Panel Analítico', icon: BarChart3,
    short: 'Reportes y gráficos de toda la operación.',
    what: 'Dashboards con métricas: ocupación, mora, vencimientos, ingresos, egresos y comparativos.',
    when: 'Para analizar tendencias o presentar resultados.',
    steps: ['Elegí el reporte.', 'Filtrá por período/propiedad.', 'Exportá si necesitás compartirlo.'],
  },
  {
    id: 'Análisis IA', group: 'Analítica', label: 'Análisis IA', icon: BrainCircuit,
    short: 'Análisis automático con IA de toda la cartera.',
    what: 'Pasa la cartera por IA y devuelve insights: bajo rendimiento, riesgos legales, oportunidades de ajuste.',
    when: 'Mensualmente como revisión estratégica.',
    steps: ['Ejecutá el análisis.', 'Revisá las recomendaciones por categoría.'],
  },
  {
    id: 'Asistente IA', group: 'Analítica', label: 'Asistente IA', icon: MessageSquareCode,
    short: 'IA que redacta comunicaciones legales y comerciales.',
    what: 'Genera borradores de mensajes: recordatorios, intimaciones (CCyCN art. 1222), cartas documento, ajustes de alquiler, liquidaciones.',
    when: 'Cada vez que debas redactar una comunicación formal.',
    steps: ['Elegí el tipo de comunicación.', 'Cargá los datos clave (nombre, propiedad, monto, fecha).', 'La IA redacta. Revisalo, copialo o enviá por email.'],
    related: ['Mensajes'],
  },
  {
    id: 'Configuración', group: 'Sistema', label: 'Configuración', icon: Settings,
    short: 'Datos de la administradora, preferencias y permisos.',
    what: 'Datos generales, comisiones, notificaciones, equipos y permisos por rol.',
    when: 'Al iniciar el uso de la app o cuando cambian las reglas de negocio.',
    steps: ['Ingresá tus datos generales.', 'Configurá comisiones y plantillas.', 'Invitá a tu equipo y asigná roles.'],
  },
];

const ADMIN_FAQ: FaqItem[] = [
  { q: '¿Cómo cargo una propiedad nueva?', a: 'Sidebar → Cartera → Propiedades → "+ Nueva Propiedad". Completá dirección, propietarios (con %) y fotos.' },
  { q: '¿Cómo aplico un ajuste de alquiler por ICL?', a: 'Personas y Contratos → abrí el contrato → "Ajustar". El sistema toma el ICL desde Índices Oficiales y calcula el nuevo monto. Luego notificás al inquilino con el Asistente IA.' },
  { q: '¿Qué hago si un inquilino entra en mora?', a: 'Asistente IA → "Intimación de Pago" (CCyCN art. 1222). Si no responde, abrís un caso en Casos Legales.' },
  { q: '¿Cómo notarizo un contrato en blockchain?', a: 'Generador de Contratos → emitís → enviás solicitud de firma. Cuando ambas partes firmaron, el sistema notariza automáticamente en Polygon.' },
  { q: '¿Cómo corro la liquidación mensual?', a: 'Centro de Liquidaciones → elegí el período → revisá → "Generar masivamente". Luego enviás por email o WhatsApp.' },
  { q: '¿Dónde veo los próximos vencimientos?', a: 'En el Panel de Control aparecen los "Próximos Ajustes" del mes. Para vencimientos de pólizas, mirá Seguros y Coberturas.' },
];

// ────────────────────────────────────────────────────────────────────────────
// CONTENIDO INQUILINO
// ────────────────────────────────────────────────────────────────────────────

const TENANT_SECTIONS: HelpSection[] = [
  {
    id: 'Inicio', group: 'Mi Portal', label: 'Inicio', icon: Home,
    short: 'Resumen de tu contrato, próximos vencimientos y actividad reciente.',
    what: 'Es la pantalla principal de tu portal. Muestra el estado de tu contrato, el próximo pago de alquiler, alertas de vencimiento y los tickets de mantenimiento abiertos.',
    when: 'Al entrar al portal para tener un panorama rápido de tu situación.',
    steps: ['Verificá la fecha y el monto de tu próximo pago.', 'Revisá si tenés tickets de mantenimiento pendientes.', 'Mirá los mensajes recientes de la administradora.'],
  },
  {
    id: 'Recibos', group: 'Mi Portal', label: 'Mis Recibos', icon: FileText,
    short: 'Historial de pagos y descarga de recibos de alquiler.',
    what: 'Ves todos los pagos registrados de tu alquiler y servicios: monto, fecha, período y estado (pagado/pendiente). Podés descargar el comprobante de cada uno.',
    when: 'Cuando necesitás verificar un pago o descargar un recibo para presentarlo.',
    steps: ['Entrá a "Mis Recibos".', 'Buscá el período que te interesa.', 'Tocá el recibo para ver el detalle.', 'Descargá el PDF del comprobante si lo necesitás.'],
    tips: ['Los recibos en rojo indican pagos pendientes o en mora.'],
  },
  {
    id: 'Pagos', group: 'Mi Portal', label: 'Planes de Pago', icon: CreditCard,
    short: 'Realizá pagos anticipados o consultá tus cuotas pendientes.',
    what: 'Permite abonar anticipadamente el alquiler (uno o varios meses por adelantado) y ver el plan de cuotas pendientes. Los pagos anticipados suelen contar con un descuento.',
    when: 'Cuando querés adelantar un pago o consultar cuánto debés.',
    steps: ['Entrá a "Planes de Pago".', 'Seleccioná cuántos meses querés adelantar.', 'Verificá el monto con el descuento aplicado.', 'Confirmá el pago con tu administradora.'],
    tips: ['Consultale a tu administradora si hay descuento por pago anticipado.'],
  },
  {
    id: 'Mensajes', group: 'Mi Portal', label: 'Mensajes', icon: MessageSquare,
    short: 'Comunicate con tu administradora directamente desde el portal.',
    what: 'Bandeja de mensajes para intercambiar comunicaciones con tu administradora. Podés escribir, recibir respuestas y ver el historial completo.',
    when: 'Ante cualquier consulta, solicitud o novedad que quieras comunicar.',
    steps: ['Entrá a "Mensajes".', 'Tocá "+ Nuevo Mensaje".', 'Escribí tu consulta y enviá.', 'Te llegará una notificación cuando te respondan.'],
    tips: ['Para reparaciones urgentes, usá la sección Mantenimiento en lugar de Mensajes para que quede registrado como ticket.'],
    related: ['Mantenimiento'],
  },
  {
    id: 'Mantenimiento', group: 'Mi Portal', label: 'Mantenimiento', icon: Wrench,
    short: 'Reportá una reparación y seguí el estado de tus tickets.',
    what: 'Permite reportar problemas en el inmueble (pérdidas, roturas, fallas eléctricas) y hacer seguimiento hasta que se resuelvan.',
    when: 'Ante cualquier falla o deterioro en el inmueble que requiera reparación.',
    steps: ['Tocá "+ Nuevo Reclamo".', 'Describí el problema y su ubicación en la unidad.', 'Subí una foto si podés (ayuda mucho al diagnóstico).', 'Indicá la urgencia. El sistema notifica a la administradora.', 'Seguí el estado desde el mismo ticket: Pendiente → Cotizando → En proceso → Resuelto.'],
    tips: ['Cuanto más detallada sea la descripción, más rápido se puede resolver.', 'Para emergencias (gas, inundación), llamá directamente a la administradora.'],
    related: ['Mensajes'],
  },
  {
    id: 'Espacios', group: 'Servicios', label: 'Espacios', icon: Lightbulb,
    short: 'Servicios adicionales disponibles para tu unidad.',
    what: 'Catálogo de servicios opcionales que podés solicitar: limpieza, mudanza, electricista, gasista, acceso a internet y más. La administradora coordina con proveedores de confianza.',
    when: 'Cuando necesitás un servicio puntual y querés que la administradora lo gestione.',
    steps: ['Entrá a "Espacios".', 'Elegí el servicio que necesitás.', 'Completá la solicitud con fecha y detalles.', 'La administradora te contacta para confirmar y darte el costo.'],
  },
  {
    id: 'Comunidad', group: 'Comunidad', label: 'Mi Edificio', icon: Users,
    short: 'Publicaciones y comunicados del edificio o complejo.',
    what: 'Muro compartido donde la administradora y los inquilinos del edificio publican avisos, recomendaciones, alertas y novedades.',
    when: 'Para estar al tanto de novedades del edificio o compartir algo con tus vecinos.',
    steps: ['Entrá a "Mi Edificio".', 'Leé las publicaciones recientes.', 'Podés reaccionar o comentar en las publicaciones.', 'Si querés publicar algo, tocá "+ Nueva Publicación".'],
    tips: ['La administradora puede moderar y eliminar contenido inapropiado.'],
  },
  {
    id: 'Marketplace', group: 'Comunidad', label: 'Marketplace', icon: ShoppingBag,
    short: 'Compra y venta de artículos entre vecinos del edificio.',
    what: 'Espacio para publicar artículos en venta o donación entre los miembros de la comunidad del edificio.',
    when: 'Cuando querés vender algo o encontrar artículos de tus vecinos.',
    steps: ['Entrá a "Marketplace".', 'Para publicar: tocá "+ Publicar" y cargá foto, título y precio.', 'Para comprar: contactá directamente al vendedor desde la publicación.'],
  },
  {
    id: 'Seguros', group: 'Servicios', label: 'Seguros', icon: ShieldCheck,
    short: 'Tu cobertura de seguro vinculada al inmueble.',
    what: 'Información sobre la póliza de seguro asociada a tu contrato: tipo de cobertura, aseguradora, vigencia y cómo contactarlos en caso de siniestro.',
    when: 'Para consultar qué cubre tu seguro o reportar un siniestro.',
    steps: ['Entrá a "Seguros".', 'Verificá la aseguradora y número de póliza.', 'En caso de siniestro, usá el contacto de la aseguradora que aparece en la ficha.'],
    tips: ['Ante un siniestro, notificá también a la administradora por "Mensajes" o "Mantenimiento".'],
    related: ['Mensajes'],
  },
];

const TENANT_FAQ: FaqItem[] = [
  { q: '¿Cómo reporto una reparación?', a: 'Entrá a "Mantenimiento" → "+ Nuevo Reclamo". Describí el problema, subí una foto y marcá la urgencia. La administradora recibe la notificación automáticamente.' },
  { q: '¿Dónde veo mis recibos de pago?', a: '"Mis Recibos" → buscá el período → descargá el PDF. Los pagos en rojo están pendientes.' },
  { q: '¿Puedo pagar por adelantado?', a: 'Sí, en "Planes de Pago" podés seleccionar cuántos meses adelantar. Consultá con tu administradora si hay descuento.' },
  { q: '¿Cómo le mando un mensaje a la administradora?', a: '"Mensajes" → "+ Nuevo Mensaje". Para reparaciones, usá "Mantenimiento" en cambio, así queda registrado como ticket.' },
  { q: '¿Qué cubre mi seguro?', a: 'En "Seguros" encontrás la cobertura, aseguradora y contacto. Ante un siniestro, avisá también por Mantenimiento o Mensajes.' },
  { q: '¿Cómo solicito un servicio de limpieza o mudanza?', a: '"Espacios" → elegí el servicio → completá la solicitud. La administradora coordina y te contacta con el costo.' },
];

// ────────────────────────────────────────────────────────────────────────────
// CONTENIDO PROPIETARIO
// ────────────────────────────────────────────────────────────────────────────

const OWNER_SECTIONS: HelpSection[] = [
  {
    id: 'Inicio', group: 'Mi Portal', label: 'Inicio', icon: Home,
    short: 'Resumen de tus propiedades, ingresos del mes y últimas liquidaciones.',
    what: 'Pantalla principal con un resumen de tus inmuebles: ocupación, ingresos recientes, próximas liquidaciones y alertas (mantenimientos pendientes, vencimientos de contrato).',
    when: 'Al entrar al portal para tener el panorama general de tu cartera.',
    steps: ['Revisá los KPIs de tus propiedades (ocupadas/disponibles).', 'Verificá el ingreso estimado del mes.', 'Atendé las alertas de mantenimiento o vencimientos.'],
  },
  {
    id: 'Propiedades', group: 'Mi Cartera', label: 'Mis Propiedades', icon: Building2,
    short: 'Detalle de cada inmueble tuyo: inquilino, contrato y estado.',
    what: 'Vista de cada propiedad de tu titularidad: datos del inmueble, inquilino actual, monto de alquiler, próximo vencimiento y estado de pagos.',
    when: 'Para consultar el estado de una propiedad específica.',
    steps: ['Entrá a "Mis Propiedades".', 'Seleccioná la propiedad para ver el detalle.', 'Revisá inquilino, contrato vigente y estado de pago.'],
  },
  {
    id: 'Liquidaciones', group: 'Finanzas', label: 'Liquidaciones', icon: Calculator,
    short: 'Tus liquidaciones mensuales: ingresos, deducciones y neto.',
    what: 'Detalle de cada liquidación mensual que te envía la administradora: alquileres cobrados, deducciones (servicios, mantenimiento, comisión) y el monto neto que te transfieren.',
    when: 'Al recibir tu liquidación mensual o para revisar períodos anteriores.',
    steps: ['Entrá a "Liquidaciones".', 'Seleccioná el período (mes/año).', 'Revisá los conceptos línea por línea.', 'Descargá el PDF si lo necesitás para tus registros.'],
    tips: ['Si ves algo que no reconocés, escribile a la administradora desde "Mensajes".'],
    related: ['Mensajes'],
  },
  {
    id: 'Facturas', group: 'Finanzas', label: 'Facturas', icon: FileText,
    short: 'Facturas de servicios de tus propiedades.',
    what: 'Lista de facturas de servicios (luz, gas, ABL, expensas) asociadas a tus propiedades, con monto, vencimiento y estado de pago.',
    when: 'Para verificar qué gastos se descontaron de tu liquidación.',
    steps: ['Entrá a "Facturas".', 'Filtrá por propiedad o período.', 'Revisá el detalle de cada factura.'],
  },
  {
    id: 'Facturación AFIP', group: 'Finanzas', label: 'Facturación AFIP', icon: Receipt,
    short: 'Facturá electrónicamente tus alquileres desde el portal.',
    what: 'Módulo de facturación electrónica para emitir facturas de alquiler según normativa AFIP, directamente desde tu portal de propietario.',
    when: 'Si estás obligado a facturar o querés emitir comprobantes fiscales de tus alquileres.',
    steps: ['Entrá a "Facturación AFIP".', 'Seleccioná la propiedad y período a facturar.', 'Verificá los datos del receptor y el monto.', 'Emitís la factura electrónica. Se envía automáticamente a AFIP.'],
    tips: ['Consultá con tu contador qué tipo de factura emitir según tu situación impositiva.'],
  },
  {
    id: 'Oportunidades', group: 'Mi Cartera', label: 'Oportunidades', icon: Lightbulb,
    short: 'Propuestas de mejoras o inversión en tus propiedades.',
    what: 'La administradora puede publicar acá propuestas de mejora (refacciones, nuevos servicios) u oportunidades de inversión relacionadas con tus inmuebles.',
    when: 'Para evaluar propuestas que podrían mejorar el rendimiento de tus propiedades.',
    steps: ['Revisá las oportunidades disponibles.', 'Leé el detalle y el retorno estimado.', 'Respondé desde la sección o escribí a la administradora.'],
  },
  {
    id: 'Aprobaciones', group: 'Operaciones', label: 'Aprobaciones', icon: Wrench,
    short: 'Aprobá o rechazá presupuestos de mantenimiento de tus propiedades.',
    what: 'Cuando un inquilino reporta una reparación, la administradora solicita presupuestos y te los envía acá para que los apruebes antes de ejecutar el trabajo.',
    when: 'Cuando recibís una notificación de presupuesto pendiente de aprobación.',
    steps: ['Entrá a "Aprobaciones".', 'Revisá el detalle del reclamo y el presupuesto del proveedor.', 'Aprobá para que se ejecute el trabajo, o rechazá con un comentario.', 'El costo aprobado se descuenta de tu próxima liquidación.'],
    tips: ['Los trabajos de urgencia pueden realizarse sin tu aprobación previa si el contrato así lo establece.'],
  },
  {
    id: 'Reclamos', group: 'Operaciones', label: 'Reclamos', icon: Bell,
    short: 'Tickets de mantenimiento que reportaron tus inquilinos.',
    what: 'Historial de todos los reclamos de mantenimiento de tus propiedades: descripción, estado, proveedor asignado y resolución.',
    when: 'Para ver el estado de las reparaciones en curso en tus inmuebles.',
    steps: ['Entrá a "Reclamos".', 'Filtrá por propiedad.', 'Revisá el estado de cada ticket.', 'Si necesitás más info, contactá a la administradora.'],
    related: ['Mensajes'],
  },
  {
    id: 'Comunidad', group: 'Comunidad', label: 'Comunidad', icon: Users,
    short: 'Publicaciones y novedades del edificio.',
    what: 'Muro compartido con publicaciones de la administradora y miembros del edificio.',
    when: 'Para estar al tanto de novedades del edificio.',
    steps: ['Entrá a "Comunidad".', 'Leé las publicaciones.', 'Podés interactuar con las publicaciones de la administradora.'],
  },
  {
    id: 'Marketplace', group: 'Comunidad', label: 'Marketplace', icon: ShoppingBag,
    short: 'Compra y venta de artículos entre miembros de la comunidad.',
    what: 'Tablón para que los miembros del edificio publiquen artículos en venta o donación.',
    when: 'Para vender algo o encontrar artículos dentro de la comunidad.',
    steps: ['Entrá a "Marketplace".', 'Publicá o explorá los artículos disponibles.', 'Contactá al vendedor directamente.'],
  },
  {
    id: 'Mensajes', group: 'Comunicación', label: 'Mensajes', icon: MessageSquare,
    short: 'Comunicaciones directas con tu administradora.',
    what: 'Bandeja de mensajes para intercambiar comunicaciones con la administradora sobre tus propiedades.',
    when: 'Para cualquier consulta, observación o instrucción que quieras dar.',
    steps: ['Entrá a "Mensajes".', 'Tocá "+ Nuevo Mensaje".', 'Escribí tu consulta y enviá.'],
    tips: ['Para consultas sobre liquidaciones, mencioná el período específico.'],
    related: ['Liquidaciones'],
  },
];

const OWNER_FAQ: FaqItem[] = [
  { q: '¿Cómo veo mis liquidaciones?', a: '"Liquidaciones" → seleccioná el período. Podés descargar el PDF o escribirle a la administradora si algo no es claro.' },
  { q: '¿Dónde apruebo un presupuesto de mantenimiento?', a: '"Aprobaciones" → revisá el reclamo y el presupuesto → aprobá o rechazá. El costo aprobado se descuenta de tu próxima liquidación.' },
  { q: '¿Cómo facturo con AFIP?', a: '"Facturación AFIP" → seleccioná propiedad y período → verificá datos → emitís. Consultá con tu contador qué tipo de factura corresponde.' },
  { q: '¿Dónde veo los pagos de mis inquilinos?', a: '"Mis Propiedades" → seleccioná el inmueble → verás el estado de pago del contrato vigente. El detalle completo está en "Liquidaciones".' },
  { q: '¿Cómo contacto a la administradora?', a: '"Mensajes" → "+ Nuevo Mensaje". Para consultas de liquidación, mencioná el período exacto.' },
  { q: '¿Puedo ver los reclamos que hicieron mis inquilinos?', a: 'Sí, en "Reclamos" ves el historial de todos los tickets de tus propiedades con estado y resolución.' },
];

// ────────────────────────────────────────────────────────────────────────────
// HELPER: genera manual en texto plano para alimentar a la IA
// ────────────────────────────────────────────────────────────────────────────

function buildManual(sections: HelpSection[], faq: FaqItem[]): string {
  const body = sections.map(s => `
## ${s.label} (sección: ${s.group} → ${s.label})
- Resumen: ${s.short}
- Qué hace: ${s.what}
- Cuándo usar: ${s.when}
- Pasos: ${s.steps.map((p, i) => `${i + 1}) ${p}`).join(' ')}
${s.tips?.length ? `- Tips: ${s.tips.join(' / ')}` : ''}
${s.related?.length ? `- Relacionado: ${s.related.join(', ')}` : ''}
`).join('\n');

  const faqText = faq.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n\n');
  return `${body}\n\n=== PREGUNTAS FRECUENTES ===\n${faqText}`;
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ────────────────────────────────────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string; meta?: HelpAssistantOutput };

interface HelpViewProps {
  onNavigate?: (tab: string) => void;
  currentSection?: string;
  portalRole?: PortalRole;
  userId?: string;
}

export function HelpView({ onNavigate, currentSection, portalRole = 'admin', userId }: HelpViewProps) {
  const { toast } = useToast();
  const { apiKey: aiApiKey, loading: aiConfigLoading } = useAIConfig(userId);

  const sections = portalRole === 'inquilino' ? TENANT_SECTIONS
                 : portalRole === 'propietario' ? OWNER_SECTIONS
                 : ADMIN_SECTIONS;

  const faq = portalRole === 'inquilino' ? TENANT_FAQ
            : portalRole === 'propietario' ? OWNER_FAQ
            : ADMIN_FAQ;

  const navigableIds = useMemo(() => new Set(sections.map(s => s.id)), [sections]);
  const manualText = useMemo(() => buildManual(sections, faq), [sections, faq]);

  const portalLabel = portalRole === 'inquilino' ? 'Inquilino'
                    : portalRole === 'propietario' ? 'Propietario'
                    : 'Administrador';

  const [searchTerm, setSearchTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, asking]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter(s =>
      s.label.toLowerCase().includes(term) ||
      s.group.toLowerCase().includes(term) ||
      s.short.toLowerCase().includes(term) ||
      s.what.toLowerCase().includes(term) ||
      s.when.toLowerCase().includes(term) ||
      s.steps.some(p => p.toLowerCase().includes(term))
    );
  }, [searchTerm, sections]);

  const filteredFaq = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return faq;
    return faq.filter(f => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term));
  }, [searchTerm, faq]);

  const byGroup = useMemo(() => {
    const map = new Map<string, HelpSection[]>();
    filtered.forEach(s => {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const handleNavigate = (id: string) => {
    if (onNavigate && navigableIds.has(id)) onNavigate(id);
  };

  const handleAsk = async (questionOverride?: string) => {
    const q = (questionOverride ?? chatInput).trim();
    if (!q || asking || !aiApiKey) return;
    setChatInput('');
    setChat(prev => [...prev, { role: 'user', content: q }]);
    setAsking(true);
    try {
      const context = `Portal: ${portalLabel}${currentSection ? ` | Sección actual: ${currentSection}` : ''}`;
      const res = await askHelpAssistant({ question: q, manual: manualText, currentSection: context }, { apiKey: aiApiKey });
      if (res.ok) {
        setChat(prev => [...prev, { role: 'assistant', content: res.data.answer, meta: res.data }]);
      } else {
        setChat(prev => [...prev, { role: 'assistant', content: `⚠ ${res.error}` }]);
        toast({ title: 'No se pudo obtener respuesta', description: res.error, variant: 'destructive' });
      }
    } catch {
      setChat(prev => [...prev, { role: 'assistant', content: '⚠ Error inesperado al contactar la IA.' }]);
    } finally {
      setAsking(false);
    }
  };

  const suggestedQuestions = portalRole === 'inquilino'
    ? ['¿Cómo reporto una reparación?', '¿Dónde veo mis recibos?', '¿Puedo pagar por adelantado?', '¿Cómo le escribo a la administradora?']
    : portalRole === 'propietario'
    ? ['¿Cómo veo mis liquidaciones?', '¿Dónde apruebo un presupuesto?', '¿Cómo facturo con AFIP?', '¿Dónde veo los pagos de mis inquilinos?']
    : ['¿Cómo aplico un ajuste por ICL?', '¿Cómo gestiono un caso de mora?', '¿Cómo notarizo un contrato?', '¿Cómo corro la liquidación mensual?'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BookMarked className="h-8 w-8 text-primary" />
            Centro de Ayuda
          </h1>
          <p className="text-muted-foreground mt-1">
            Guía completa de tu portal + asistente IA para resolver dudas.
          </p>
        </div>
        <Badge variant="outline" className="self-start md:self-auto bg-primary/5 border-primary/20 text-primary font-semibold">
          {sections.length} secciones · Portal {portalLabel}
        </Badge>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscá una función o palabra clave…"
          className="pl-12 h-14 text-base shadow-sm border-2 focus-visible:border-primary/40"
        />
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-6">

          {byGroup.length === 0 && filteredFaq.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sin resultados para "{searchTerm}"</p>
                <p className="text-sm mt-1">Probá con otra palabra o pregúntale al asistente IA →</p>
              </CardContent>
            </Card>
          )}

          {byGroup.map(([group, items]) => (
            <Card key={group} className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  {group}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map(section => {
                  const isOpen = openId === section.id;
                  const Icon = section.icon;
                  return (
                    <div
                      key={section.id}
                      className={cn(
                        'border rounded-xl transition-colors overflow-hidden',
                        isOpen ? 'border-primary/30 bg-primary/[0.02] shadow-sm' : 'border-border/60 hover:border-border'
                      )}
                    >
                      <button
                        onClick={() => setOpenId(isOpen ? null : section.id)}
                        className="w-full flex items-center gap-3 p-4 text-left"
                      >
                        <div className={cn(
                          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                          isOpen ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{section.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{section.short}</p>
                        </div>
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-0 space-y-4 text-sm border-t border-border/40 mt-1">
                          <div className="pt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">¿Qué hace?</p>
                            <p className="text-foreground/90 leading-relaxed">{section.what}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">¿Cuándo usarlo?</p>
                            <p className="text-foreground/90 leading-relaxed">{section.when}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Pasos</p>
                            <ol className="space-y-1.5">
                              {section.steps.map((s, i) => (
                                <li key={i} className="flex gap-2.5">
                                  <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="text-foreground/90 leading-relaxed">{s}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          {section.tips && section.tips.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1">
                                <Lightbulb className="h-3.5 w-3.5" /> Tips
                              </p>
                              <ul className="text-amber-900 text-sm space-y-1">
                                {section.tips.map((t, i) => <li key={i}>• {t}</li>)}
                              </ul>
                            </div>
                          )}
                          {section.related && section.related.filter(r => navigableIds.has(r)).length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Relacionado</p>
                              <div className="flex flex-wrap gap-2">
                                {section.related.filter(r => navigableIds.has(r)).map(r => (
                                  <button
                                    key={r}
                                    onClick={() => handleNavigate(r)}
                                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1"
                                  >
                                    {r}
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="pt-2 flex justify-end">
                            <Button size="sm" variant="default" onClick={() => handleNavigate(section.id)} className="gap-2">
                              Ir a {section.label} <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* FAQ */}
          {filteredFaq.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" /> Preguntas frecuentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredFaq.map((f, i) => (
                  <details key={i} className="group border rounded-lg p-3 hover:border-primary/30 transition-colors">
                    <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between gap-3">
                      <span>{f.q}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
                    </summary>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat IA */}
        <div className="lg:col-span-1">
          <Card className="border-none shadow-sm sticky top-20 flex flex-col h-[calc(100vh-7rem)]">
            <CardHeader className="border-b shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                Preguntale a la IA
              </CardTitle>
              <CardDescription className="text-xs">
                Resuelve dudas sobre tu portal. Solo conoce las funciones de tu sección.
              </CardDescription>
            </CardHeader>

            {!aiConfigLoading && !aiApiKey ? (
              <CardContent className="flex-1 flex items-center pt-4">
                <AIKeyRequiredNotice feature="el asistente de ayuda con IA" className="w-full" />
              </CardContent>
            ) : (
            <>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {chat.length === 0 && (
                  <div className="text-sm text-muted-foreground space-y-3">
                    <p>Hola 👋 Soy tu asistente de ayuda. Probá preguntando:</p>
                    <div className="space-y-1.5">
                      {suggestedQuestions.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => handleAsk(p)}
                          className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chat.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}>
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {m.role === 'assistant' && m.meta?.suggestedSections && m.meta.suggestedSections.filter(s => navigableIds.has(s)).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Ir a</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.meta.suggestedSections.filter(s => navigableIds.has(s)).map(s => (
                              <button
                                key={s}
                                onClick={() => handleNavigate(s)}
                                className="text-[11px] font-medium px-2 py-1 rounded-full bg-background hover:bg-primary/10 hover:text-primary border transition-colors"
                              >
                                {s} →
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {m.role === 'assistant' && m.meta?.followUpQuestions && m.meta.followUpQuestions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.meta.followUpQuestions.map((q, qi) => (
                            <button key={qi} onClick={() => handleAsk(q)} className="block w-full text-left text-[11px] text-primary hover:underline">
                              ↪ {q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {asking && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Pensando…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <CardContent className="border-t pt-3 shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                  placeholder="Escribí tu pregunta… (Enter para enviar)"
                  className="min-h-[44px] max-h-[120px] resize-none text-sm"
                />
                <Button onClick={() => handleAsk()} disabled={asking || !chatInput.trim()} size="icon" aria-label="Enviar pregunta" className="h-11 w-11 shrink-0">
                  {asking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Las respuestas se basan en las funciones de tu portal.
              </p>
            </CardContent>
            </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
