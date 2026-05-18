
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus,
  Edit2,
  Trash2,
  Search,
  Mail,
  Upload,
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
  UserCheck,
  TrendingUp,
  Landmark,
  Calculator,
  Calendar,
  FileText,
  Download,
  FileSearch,
  MessageCircleQuestion,
  ArrowRight,
  RefreshCw,
  Eye,
  Percent,
  MessageSquare,
  Scale,
  Phone,
  User,
  History,
  Clock,
  CalendarClock,
  FolderOpen,
  Layers,
  ChevronRight,
  Home,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, IndexRecord, Invoice, Liquidation, MaintenanceTask, LegalCase, RentalApplication } from '@/lib/types';
import { ContractDetailPanel } from '@/components/dashboard/contract-detail-panel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithOther } from '@/components/ui/select-with-other';
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, collection, query, where } from 'firebase/firestore';
import { ShieldOff, ShieldCheck, UserX, ShieldAlert, Globe } from 'lucide-react';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant-flow';
import { fetchIpc } from '@/ai/flows/fetch-ipc-indec-action';
import { fetchIcl } from '@/ai/flows/fetch-icl-bcra-action';
import { queryContract } from '@/ai/flows/query-contract-flow';
import { extractContractData } from '@/ai/flows/extract-contract-data-flow';
import { extractTextFromPdfDataUri, isPdfDataUri } from '@/lib/pdf-extract';
import { sendEmail } from '@/services/email-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyInput } from '@/components/ui/currency-input';
import { EmptyState } from '@/components/ui/empty-state';
import { getRulesForProvince, type ProvinceRule } from '@/lib/province-rules';

interface TenantsViewProps {
  people: Person[];
  userId?: string;
  contracts: Contract[];
  properties: Property[];
  indexRecords: IndexRecord[];
  invoices?: Invoice[];
  liquidations?: Liquidation[];
  tasks?: MaintenanceTask[];
  legalCases?: LegalCase[];
  applications?: RentalApplication[];
  onOpenProperty?: (propertyId: string) => void;
}

const APP_ID = "alquilagestion-pro";

function contractRiskBadge(c: Contract): React.ReactNode {
  if (c.status === 'Finalizado' || c.status === 'Rescindido' || c.status === 'Borrador') return null;
  const end = new Date(c.endDate);
  const days = (end.getTime() - Date.now()) / 86_400_000;
  if (days < 0) {
    return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Vencido</span>;
  }
  if (days <= 30) {
    return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">🔴 {Math.round(days)}d</span>;
  }
  if (days <= 60) {
    return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🟡 {Math.round(days)}d</span>;
  }
  return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">🟢 OK</span>;
}

/** Converts YYYY-MM-DD → DD/MM/YYYY for display */
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

/** Adds months to a YYYY-MM-DD date string, returns YYYY-MM-DD */
function addMonthsToDate(dateStr: string, months: number): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function TenantsView({ people, userId, contracts, properties, indexRecords, invoices = [], liquidations = [], tasks = [], legalCases = [], applications = [], onOpenProperty }: TenantsViewProps) {
  const { canWrite, canDelete } = useOrgPermissions();
  const { toast } = useToast();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<'contracts' | 'people' | 'portal' | 'owners'>('owners');
  const [selectedDetailContract, setSelectedDetailContract] = useState<Contract | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleTypeFilter, setPeopleTypeFilter] = useState<'Todos' | 'Propietario' | 'Inquilino' | 'Garante' | 'Proveedor'>('Todos');

  // ── Tenant Registry (portal access management) ──────────────────────────
  const registryQ = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'artifacts', APP_ID, 'tenantRegistry'), where('adminId', '==', userId));
  }, [db, userId]);
  const { data: registryRaw } = useCollection<any>(registryQ);
  const registryEntries = registryRaw ?? [];

  const handleSuspendTenant = (docId: string, name: string) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'tenantRegistry', docId);
    setDocumentNonBlocking(ref, { status: 'suspendido' }, { merge: true });
    toast({ title: `⏸ ${name} suspendido/a`, description: 'El inquilino no puede acceder al portal hasta que lo reactives.' });
  };

  const handleDeactivateTenant = (docId: string, name: string) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'tenantRegistry', docId);
    setDocumentNonBlocking(ref, { status: 'inactivo' }, { merge: true });
    toast({ title: `🚫 ${name} dado de baja`, description: 'El inquilino perdió el acceso al portal.' });
  };

  const handleReactivateTenant = (docId: string, name: string) => {
    if (!db) return;
    const ref = doc(db, 'artifacts', APP_ID, 'tenantRegistry', docId);
    setDocumentNonBlocking(ref, { status: 'activo' }, { merge: true });
    toast({ title: `✅ ${name} reactivado/a`, description: 'El inquilino tiene acceso al portal nuevamente.' });
  };
  const contractFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [isAdjNotifOpen, setIsAdjNotifOpen] = useState(false);
  const [isRenewalNotifOpen, setIsRenewalNotifOpen] = useState(false);
  const [isQAOpen, setIsQAOpen] = useState(false);
  const [viewDocContract, setViewDocContract] = useState<Contract | null>(null);

  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  
  const [selectedAdjContract, setSelectedAdjContract] = useState<Contract | null>(null);
  const [selectedRenewalContract, setSelectedRenewalContract] = useState<Contract | null>(null);
  const [selectedQAContract, setSelectedQAContract] = useState<Contract | null>(null);
  
  const [qaQuestion, setQAQuestion] = useState('');
  const [qaAnswer, setQAAnswer] = useState<{answer: string, sourceQuote?: string, fundamentoLegal?: string, alertaLegal?: string} | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [contractDialogTab, setContractDialogTab] = useState('general');
  const [aiExtractedData, setAiExtractedData] = useState<Record<string,string> | null>(null);
  const [isCalculatingIndex, setIsCalculatingIndex] = useState(false);
  const [adjDraft, setAdjDraft] = useState<any>(null);
  const [renewalDraft, setRenewalDraft] = useState<any>(null);
  const [newRentValueInput, setNewRentValueInput] = useState<number>(0);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [personErrors, setPersonErrors] = useState<{ fullName?: string; email?: string }>({});

  const handleOpenPersonDialog = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setPersonFormData(person);
    } else {
      setEditingPerson(null);
      setPersonFormData({
        fullName: '',
        taxId: '',
        email: '',
        phone: '',
        type: 'Inquilino',
        documents: []
      });
    }
    setPersonErrors({});
    setIsPersonDialogOpen(true);
  };

  const INITIAL_CONTRACT_FORM: Partial<Contract> = {
    tenantId: '',
    propertyId: '',
    startDate: '',
    endDate: '',
    baseRentAmount: 0,
    currentRentAmount: 0,
    currency: 'ARS',
    adjustmentType: 'Index',
    adjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    lateFeePercentage: 0.5,
    depositAmount: 0,
    status: 'Vigente',
    documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] }
  };
  const [contractFormData, setContractFormData] = useState<Partial<Contract>>(INITIAL_CONTRACT_FORM);
  const [provinceRules, setProvinceRules] = useState<ProvinceRule | null>(null);

  // Detectar provincia del inmueble y pre-llenar reglas cuando cambia la propiedad
  useEffect(() => {
    if (!contractFormData.propertyId) { setProvinceRules(null); return; }
    const prop = properties.find(p => p.id === contractFormData.propertyId);
    if (!prop?.address) { setProvinceRules(null); return; }
    // La dirección de Georef tiene formato "Calle 123, Ciudad, Provincia"
    const parts = prop.address.split(',').map(s => s.trim());
    const provincia = parts[parts.length - 1];
    const rules = getRulesForProvince(provincia);
    setProvinceRules(rules);
    // Auto-completar mecanismo y frecuencia si el campo todavía tiene el valor por defecto
    setContractFormData(prev => ({
      ...prev,
      adjustmentMechanism: prev.adjustmentMechanism ?? rules.defaultAdjustmentMechanism,
      adjustmentFrequencyMonths: prev.adjustmentFrequencyMonths ?? rules.adjustmentFrequencyMonths,
    }));
  }, [contractFormData.propertyId, properties]);

  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    email: '',
    phone: '',
    type: 'Inquilino',
    documents: []
  });

  const handleSavePerson = () => {
    const errors: { fullName?: string; email?: string } = {};
    if (!personFormData.fullName?.trim()) errors.fullName = 'El nombre es requerido.';
    if (personFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personFormData.email)) errors.email = 'Email inválido.';
    setPersonErrors(errors);
    if (Object.keys(errors).length > 0 || !userId || !db) return;

    const docId = editingPerson?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', docId);

    const personData: Person = {
      ...personFormData,
      id: docId,
      ownerId: userId,
      documents: personFormData.documents || []
    } as Person;

    setDocumentNonBlocking(docRef, personData, { merge: true });
    setIsPersonDialogOpen(false);
    toast({ 
      title: editingPerson ? "Persona actualizada" : "Persona creada", 
      description: `${personFormData.fullName} se ha guardado correctamente.` 
    });
  };

  const handleDeletePerson = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'inquilinos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
  };

  const handleDeleteContract = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Contrato eliminado", description: "El contrato ha sido removido del sistema." });
  };

  const handleAskContract = async () => {
    if (!selectedQAContract || !qaQuestion) return;
    if (!selectedQAContract.fullTranscription) {
      toast({
        title: "Sin transcripción",
        description: "Este contrato no tiene texto cargado. Subí el archivo y usá \"Analizar con IA\" en la pestaña Documentos, o pegá el texto manualmente.",
        variant: "destructive"
      });
      return;
    }
    setIsAsking(true);
    setQAAnswer(null);
    const result = await queryContract({
      contractTranscription: selectedQAContract.fullTranscription,
      question: qaQuestion,
      perspective: 'neutral',
      contractType: 'vivienda',
    });
    setIsAsking(false);
    if (!result.ok) {
      toast({ title: "Error del asistente", description: result.error, variant: "destructive" });
      return;
    }
    setQAAnswer(result.data);
  };

  const handleExtractContract = async () => {
    const url = (contractFormData.documents as any)?.mainContractUrl;
    if (!url) {
      toast({ title: "Sin archivo", description: "Primero cargá el archivo del contrato.", variant: "destructive" });
      return;
    }
    setIsExtracting(true);
    const result = await extractContractData({ documentDataUri: url });
    setIsExtracting(false);
    if (!result.ok) {
      toast({ title: "Error al analizar", description: result.error, variant: "destructive" });
      return;
    }
    const d = result.data;
    setContractFormData(prev => ({
      ...prev,
      fullTranscription: d.fullTranscription,
      baseRentAmount: d.baseRentAmount || prev.baseRentAmount,
      currentRentAmount: d.baseRentAmount || prev.currentRentAmount,
      currency: d.currency || prev.currency,
      adjustmentMechanism: d.adjustmentMechanism || prev.adjustmentMechanism,
      adjustmentFrequencyMonths: d.adjustmentFrequencyMonths || prev.adjustmentFrequencyMonths,
      startDate: d.startDate || prev.startDate,
      endDate: d.endDate || prev.endDate,
    }));

    // Store what was extracted so we can show it in the banner
    setAiExtractedData({
      tenantName: d.tenantName ?? '',
      address: d.propertyAddress ?? '',
      rent: d.baseRentAmount ? `${d.currency} ${d.baseRentAmount.toLocaleString('es-AR')}` : '',
      confidence: `${Math.round((d.confidenceScore ?? 0) * 100)}%`,
    });

    // Jump to "Datos Generales" so the user sees the filled fields and can select Inquilino/Propiedad
    setContractDialogTab('general');

    toast({
      title: `✓ Análisis completado (${Math.round((d.confidenceScore ?? 0) * 100)}% confianza)`,
      description: 'Datos cargados. Revisá Datos Generales, seleccioná Inquilino y Propiedad, y guardá.',
    });
  };

  // Auto-calculate rent adjustment when the notification dialog opens
  useEffect(() => {
    if (isAdjNotifOpen && selectedAdjContract?.adjustmentMechanism && newRentValueInput === 0) {
      handleAutoCalculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdjNotifOpen, selectedAdjContract]);

  const handleAutoCalculate = async () => {
    if (!selectedAdjContract || !selectedAdjContract.adjustmentMechanism) return;
    setIsCalculatingIndex(true);
    const mechanism = selectedAdjContract.adjustmentMechanism;

    if (mechanism === 'CER') {
      // CER: ratio between daily index at adjustment date and at contract start date
      const startDate = selectedAdjContract.startDate.slice(0, 10);
      const cerRecords = [...indexRecords]
        .filter(r => r.type === 'CER')
        .sort((a, b) => b.month.localeCompare(a.month));

      const cerLatest = cerRecords[0];
      const cerStart = indexRecords
        .filter(r => r.type === 'CER' && r.month >= startDate)
        .sort((a, b) => a.month.localeCompare(b.month))[0]
        ?? indexRecords.filter(r => r.type === 'CER').sort((a, b) => b.month.localeCompare(a.month))[0];

      if (cerLatest && cerStart && cerStart.value > 0) {
        const coef = cerLatest.value / cerStart.value;
        const calculated = Math.round(selectedAdjContract.baseRentAmount * coef);
        setNewRentValueInput(calculated);
        toast({ title: "Cálculo CER", description: `CER inicio: ${cerStart.value.toFixed(4)} (${cerStart.month}) → CER actual: ${cerLatest.value.toFixed(4)} (${cerLatest.month}) · Coef: ${coef.toFixed(4)}` });
      } else {
        toast({ title: "Datos CER faltantes", description: "No hay suficientes registros CER. Importalos desde BCRA en la sección Índices Oficiales.", variant: "destructive" });
      }
    } else {
      // ICL / IPC / CasaPropia: monthly absolute index records
      const currentMonth = new Date().toISOString().slice(0, 7);
      const startMonth = selectedAdjContract.startDate.slice(0, 7);

      let indexActual = indexRecords.find(r => r.month === currentMonth && r.type === mechanism);
      let indexInicial = indexRecords.find(r => r.month === startMonth && r.type === mechanism);

      // Si falta algún dato, intentar traerlo de la API antes de rendirse
      if (!indexActual || !indexInicial) {
        try {
          let fetchedPoints: { month: string; value: number }[] = [];

          if (mechanism === 'IPC') {
            const res = await fetchIpc();
            if (res.ok && res.data.source === 'indec_api' && res.data.latestValue > 0) {
              fetchedPoints = [
                { month: res.data.latestDate.slice(0, 7), value: res.data.latestValue },
                { month: res.data.previousDate.slice(0, 7), value: res.data.previousValue },
              ];
            }
          } else if (mechanism === 'ICL') {
            const res = await fetchIcl();
            if (res.ok && res.data.source === 'bcra_api' && res.data.latestValue > 0) {
              fetchedPoints = [
                { month: res.data.latestDate.slice(0, 7), value: res.data.latestValue },
                { month: res.data.previousDate.slice(0, 7), value: res.data.previousValue },
              ];
            }
          }

          // Guardar en Firestore los nuevos registros obtenidos
          if (fetchedPoints.length > 0 && db && userId) {
            for (const point of fetchedPoints) {
              if (point.value > 0) {
                const docId = `${mechanism}_${point.month}`;
                const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'indices', docId);
                setDocumentNonBlocking(docRef, { id: docId, month: point.month, type: mechanism, value: point.value }, { merge: true });
              }
            }
          }

          // Combinar registros locales con los recién traídos
          const combined = [
            ...indexRecords,
            ...fetchedPoints.map(p => ({ id: `${mechanism}_${p.month}`, month: p.month, type: mechanism as typeof mechanism, value: p.value })),
          ];
          if (!indexActual) indexActual = combined.find(r => r.month === currentMonth && r.type === mechanism);
          if (!indexInicial) indexInicial = combined.find(r => r.month === startMonth && r.type === mechanism);
        } catch {
          // La API falló; se maneja abajo con el mensaje de error
        }
      }

      if (indexActual && indexInicial && indexInicial.value > 0) {
        const coef = indexActual.value / indexInicial.value;
        const calculated = Math.round(selectedAdjContract.currentRentAmount * coef);
        setNewRentValueInput(calculated);
        toast({ title: "Cálculo Realizado", description: `Coeficiente ${mechanism} aplicado: ${coef.toFixed(4)}.` });
      } else {
        const missing: string[] = [];
        if (!indexActual) missing.push(`mes actual (${currentMonth})`);
        if (!indexInicial) missing.push(`inicio del contrato (${startMonth})`);
        toast({
          title: `Índice ${mechanism} no disponible`,
          description: `No se encontró el dato para: ${missing.join(' y ')}. La API tampoco devolvió ese período. Actualizalo manualmente en "Índices Oficiales".`,
          variant: "destructive",
        });
      }
    }
    setIsCalculatingIndex(false);
  };

  const handleGenerateAdjDraft = async () => {
    if (!selectedAdjContract || !newRentValueInput) return;
    try {
      const cur = selectedAdjContract.currentRentAmount;
      const pct = cur > 0 ? ((newRentValueInput / cur - 1) * 100).toFixed(1) : '0';
      const sym = selectedAdjContract.currency;
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseAdjustment',
        tenantName: selectedAdjContract.tenantName,
        propertyName: selectedAdjContract.propertyName,
        currentRentAmount: `${sym} ${cur.toLocaleString('es-AR')}`,
        newRentAmount: `${sym} ${newRentValueInput.toLocaleString('es-AR')}`,
        adjustmentIndex: selectedAdjContract.adjustmentMechanism || 'Fijo',
        currentLeaseStartDate: selectedAdjContract.startDate,
        currentLeaseEndDate: selectedAdjContract.endDate,
        additionalContext: `El alquiler pasa de ${sym} ${cur.toLocaleString('es-AR')} a ${sym} ${newRentValueInput.toLocaleString('es-AR')} (incremento del ${pct}%) según el índice ${selectedAdjContract.adjustmentMechanism || 'contractual'}. Vigencia a partir del próximo período.`,
      });
      setAdjDraft(draft);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el borrador de aumento.", variant: "destructive" });
    }
  };

  const handleGenerateRenewalDraft = async () => {
    if (!selectedRenewalContract) return;
    try {
      const draft = await aiCommunicationAssistant({
        communicationType: 'leaseRenewal',
        tenantName: selectedRenewalContract.tenantName,
        propertyName: selectedRenewalContract.propertyName,
        currentLeaseEndDate: selectedRenewalContract.endDate,
        additionalContext: "Informar que el contrato vence pronto y debemos coordinar la renovación o la entrega de llaves."
      });
      setRenewalDraft(draft);
    } catch (e) {
      toast({ title: "Error IA", description: "No se pudo redactar el borrador de renovación.", variant: "destructive" });
    }
  };

  const handleSendAdjEmail = async () => {
    if (!selectedAdjContract || !adjDraft) return;
    const tenant = people.find(p => p.id === selectedAdjContract.tenantId);
    if (!tenant?.email) {
      toast({ title: "Email Faltante", description: "El inquilino no tiene correo registrado.", variant: "destructive" });
      return;
    }
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: adjDraft.subjectLine,
        html: `<div style="text-align: justify;">${adjDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Aviso de Aumento Enviado", description: "El inquilino ha sido notificado formalmente del nuevo valor." });
      setIsAdjNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Fallo el envío de email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendRenewalEmail = async () => {
    if (!selectedRenewalContract || !renewalDraft) return;
    const tenant = people.find(p => p.id === selectedRenewalContract.tenantId);
    if (!tenant?.email) return;
    setIsSendingEmail(true);
    try {
      await sendEmail({
        to: tenant.email,
        subject: renewalDraft.subjectLine,
        html: `<div style="text-align: justify;">${renewalDraft.draftedMessage.replace(/\n/g, '<br/>')}</div>`
      });
      toast({ title: "Aviso de Vencimiento Enviado", description: "El inquilino ha sido notificado formalmente." });
      setIsRenewalNotifOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Fallo el envío de email.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingContract(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      setContractFormData(prev => ({
        ...prev,
        documents: {
          ...((prev.documents as any) || {}),
          mainContractUrl: dataUri,
          mainContractName: file.name,
        }
      }));

      // Auto-extraer texto si es PDF (sin necesitar IA)
      if (isPdfDataUri(dataUri)) {
        toast({ title: "Extrayendo texto del PDF…", description: "Procesando el documento, un momento." });
        try {
          const text = await extractTextFromPdfDataUri(dataUri);
          if (text.trim().length > 50) {
            setContractFormData(prev => ({ ...prev, fullTranscription: text }));
            setAiExtractedData({ tenantName: '', address: '', rent: '', confidence: 'texto directo' });
            setContractDialogTab('general');
            toast({ title: "Texto extraído del PDF ✓", description: `${text.length.toLocaleString('es-AR')} caracteres cargados. Completá Inquilino y Propiedad y guardá.` });
          } else {
            toast({
              title: "PDF sin texto seleccionable",
              description: "El PDF parece ser una imagen escaneada. Usá 'Analizar con IA' para hacer OCR.",
              variant: "destructive"
            });
          }
        } catch {
          toast({ title: "No se pudo extraer el texto", description: "Usá 'Analizar con IA' como alternativa.", variant: "destructive" });
        }
      } else {
        toast({ title: "Imagen cargada", description: `"${file.name}" listo. Usá 'Analizar con IA' para extraer el texto.` });
      }
      setIsUploadingContract(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveContract = () => {
    if (!userId || !db) return;

    // Validate required fields with clear error messages
    if (!contractFormData.tenantId) {
      toast({ title: "Falta seleccionar el Inquilino", description: "Andá a la pestaña 'Datos Generales' y elegí el inquilino (Locatario) del contrato.", variant: "destructive" });
      return;
    }
    if (!contractFormData.propertyId) {
      toast({ title: "Falta seleccionar la Propiedad", description: "Andá a la pestaña 'Datos Generales' y elegí la propiedad.", variant: "destructive" });
      return;
    }
    if (!contractFormData.startDate) {
      toast({ title: "Falta la fecha de inicio", description: "Completá la fecha de inicio del contrato antes de guardar.", variant: "destructive" });
      return;
    }
    if (!contractFormData.endDate) {
      toast({ title: "Falta la fecha de fin", description: "Completá la fecha de finalización del contrato antes de guardar.", variant: "destructive" });
      return;
    }
    if (new Date(contractFormData.endDate) <= new Date(contractFormData.startDate)) {
      toast({ title: "Fechas inválidas", description: "La fecha de fin debe ser posterior a la fecha de inicio.", variant: "destructive" });
      return;
    }
    if (!contractFormData.baseRentAmount || contractFormData.baseRentAmount <= 0) {
      toast({ title: "Falta el monto de alquiler", description: "Ingresá el monto base de alquiler antes de guardar.", variant: "destructive" });
      return;
    }

    const tenant = people.find(p => p.id === contractFormData.tenantId);
    const property = properties.find(p => p.id === contractFormData.propertyId);
    const docId = editingContract?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', docId);

    // Strip the base64 PDF from documents before saving to Firestore
    // (base64 PDFs are megabytes — Firestore has a 1MB document limit)
    const docsRaw = contractFormData.documents as any;
    const documentsSafe = {
      mainContractUrl: '',           // don't store base64 in Firestore
      mainContractName: docsRaw?.mainContractName ?? '',
      versions: docsRaw?.versions ?? [],
      annexes: docsRaw?.annexes ?? [],
    };

    // Truncate fullTranscription to 80,000 chars max (Firestore 1MB guard)
    const MAX_TRANSCRIPTION = 80_000;
    const fullTranscription = contractFormData.fullTranscription
      ? contractFormData.fullTranscription.slice(0, MAX_TRANSCRIPTION)
      : undefined;

    const newContract: Contract = {
      ...contractFormData,
      id: docId,
      tenantName: tenant?.fullName,
      tenantEmail: tenant?.email ?? '',
      propertyName: property?.name,
      currentRentAmount: contractFormData.currentRentAmount || contractFormData.baseRentAmount || 0,
      documents: documentsSafe,
      fullTranscription,
      ownerId: userId,
      ...(editingContract ? { updatedBy: userId } : { createdBy: userId }),
    } as Contract;

    setDocumentNonBlocking(docRef, newContract, { merge: true });
    setIsContractDialogOpen(false);
    toast({ title: "Contrato Guardado ✓", description: `${tenant?.fullName} — ${property?.name}` });
  };

  const handleCreateRenewalDraft = (contract: Contract) => {
    if (!userId || !db) return;
    // Calcula la nueva fecha de inicio = día siguiente al vencimiento actual
    const prevEnd = new Date(contract.endDate);
    const newStart = new Date(prevEnd.getTime() + 86_400_000);
    const newStartStr = newStart.toISOString().slice(0, 10);
    // Duración por defecto: misma que el contrato original
    const prevDuration = Math.round(
      (prevEnd.getTime() - new Date(contract.startDate).getTime()) / (30.44 * 86_400_000)
    );
    const duration = prevDuration > 0 ? prevDuration : 24;
    const newEnd = new Date(newStart);
    newEnd.setMonth(newEnd.getMonth() + duration);
    const newEndStr = newEnd.toISOString().slice(0, 10);

    const docId = Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'contratos', docId);
    const draft: Contract = {
      ...contract,
      id: docId,
      startDate: newStartStr,
      endDate: newEndStr,
      status: 'Borrador',
      baseRentAmount: contract.currentRentAmount,
      currentRentAmount: contract.currentRentAmount,
      createdBy: userId,
      documents: { mainContractUrl: '', mainContractName: '', versions: [], annexes: [] },
    };
    setDocumentNonBlocking(docRef, draft, { merge: true });
    toast({
      title: 'Borrador de renovación creado',
      description: `${contract.tenantName} — ${contract.propertyName} · ${newStartStr} → ${newEndStr}. Revisalo en Contratos.`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="bg-white border shadow-sm p-1 rounded-lg">
          <TabsList className="bg-transparent">
            <TabsTrigger value="contracts" className="data-[state=active]:bg-primary data-[state=active]:text-white">Contratos</TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-primary data-[state=active]:text-white">Personas</TabsTrigger>
            <TabsTrigger value="owners" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Por Propietario
            </TabsTrigger>
            <TabsTrigger value="portal" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Accesos Portal
              {registryEntries.filter((e: any) => e.status === 'suspendido').length > 0 && (
                <span className="h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                  {registryEntries.filter((e: any) => e.status === 'suspendido').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 w-full sm:w-auto">
          {canWrite && activeTab === 'contracts' && (
            <Button className="bg-primary text-white gap-2 font-bold" onClick={() => { setEditingContract(null); setContractFormData(INITIAL_CONTRACT_FORM); setContractDialogTab('general'); setAiExtractedData(null); setIsContractDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Contrato
            </Button>
          )}
          {canWrite && activeTab === 'people' && (
            <Button className="bg-primary text-white gap-2 font-bold" onClick={() => handleOpenPersonDialog()}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      {/* DIÁLOGO DE CONTRATO */}
      <Dialog open={isContractDialogOpen} onOpenChange={(open) => { setIsContractDialogOpen(open); if (!open) setAiExtractedData(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ficha Técnica del Contrato</DialogTitle></DialogHeader>

          {/* Banner post-extracción IA */}
          {aiExtractedData && (
            <div className="flex gap-3 items-start p-3 bg-green-50 border border-green-200 rounded-xl mt-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-black text-green-800">IA extrajo los datos del contrato (confianza {aiExtractedData.confidence})</p>
                <p className="text-xs text-green-700">
                  {aiExtractedData.tenantName && <span>Inquilino detectado: <strong>{aiExtractedData.tenantName}</strong> · </span>}
                  {aiExtractedData.rent && <span>Monto: <strong>{aiExtractedData.rent}</strong></span>}
                </p>
                <p className="text-xs font-bold text-amber-700 mt-1">
                  ⚠️ Seleccioná el Inquilino y la Propiedad en los desplegables de abajo, luego hacé clic en "Guardar Contrato".
                </p>
              </div>
            </div>
          )}

          <Tabs value={contractDialogTab} onValueChange={setContractDialogTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="general">Datos Generales</TabsTrigger>
              <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
              <TabsTrigger value="documents">Transcripción Legal</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidad / Propiedad</Label>
                  <Select value={contractFormData.propertyId} onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}>
                    <SelectTrigger><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                    <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {provinceRules && (
                    <div className="mt-1 p-2 rounded-lg bg-blue-50 border border-blue-100 text-[10px] text-blue-700 space-y-0.5">
                      <p className="font-black flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {provinceRules.provincia || 'Régimen general'} — Ley 27.551
                      </p>
                      <p>Preaviso: <strong>{provinceRules.noticePeriodDays} días</strong> · Depósito máx: <strong>{provinceRules.maxDepositMonths} mes</strong> · IIBB vivienda: <strong>{provinceRules.iibb.Vivienda}%</strong></p>
                      <p className="text-blue-600 italic">{provinceRules.note}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Inquilino (Locatario)</Label>
                  <Select value={contractFormData.tenantId} onValueChange={(v) => setContractFormData({...contractFormData, tenantId: v})}>
                    <SelectTrigger><SelectValue placeholder="Persona..." /></SelectTrigger>
                    <SelectContent>{people.filter(p => p.type === 'Inquilino').map(p => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Inicio</Label>
                  <Input type="date" value={contractFormData.startDate} onChange={e => setContractFormData({...contractFormData, startDate: e.target.value})} />

                </div>
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Select
                    value=""
                    onValueChange={(months) => {
                      if (contractFormData.startDate) {
                        setContractFormData({...contractFormData, endDate: addMonthsToDate(contractFormData.startDate as string, parseInt(months))});
                      } else {
                        toast({ title: 'Primero ingresá la fecha de inicio', variant: 'destructive' });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Calcular…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 meses (1 año)</SelectItem>
                      <SelectItem value="24">24 meses (2 años)</SelectItem>
                      <SelectItem value="36">36 meses (3 años)</SelectItem>
                      <SelectItem value="48">48 meses (4 años)</SelectItem>
                      <SelectItem value="6">6 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Finalización</Label>
                  <Input type="date" value={contractFormData.endDate} onChange={e => setContractFormData({...contractFormData, endDate: e.target.value})} />
                  {contractFormData.endDate && (
                    <p className="text-[10px] text-muted-foreground font-bold">{formatDateDisplay(contractFormData.endDate as string)}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado del contrato</Label>
                <Select value={contractFormData.status} onValueChange={(v: any) => setContractFormData({...contractFormData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Borrador">Borrador (sin ejecutar)</SelectItem>
                    <SelectItem value="Vigente">Vigente</SelectItem>
                    <SelectItem value="Próximo a Vencer">Próximo a Vencer</SelectItem>
                    <SelectItem value="Finalizado">Finalizado</SelectItem>
                    <SelectItem value="Rescindido">Rescindido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="economic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Monto Base Alquiler</Label><CurrencyInput value={contractFormData.baseRentAmount || 0} onChange={v => setContractFormData({...contractFormData, baseRentAmount: v, currentRentAmount: v})} placeholder="Ej: 150.000" /></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={contractFormData.currency} onValueChange={(v: any) => setContractFormData({...contractFormData, currency: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS — Pesos</SelectItem><SelectItem value="USD">USD — Dólares</SelectItem><SelectItem value="UVA">UVA — Unidad de Valor Adquisitivo</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Mecanismo de Ajuste</Label><Select value={contractFormData.adjustmentMechanism} onValueChange={(v: any) => setContractFormData({...contractFormData, adjustmentMechanism: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CER">CER (BCRA - Diario)</SelectItem><SelectItem value="ICL">ICL (Alquileres)</SelectItem><SelectItem value="IPC">IPC (Inflación)</SelectItem><SelectItem value="Fixed">Monto Fijo</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Mora Diaria (%)</Label><Input type="number" step="0.1" value={contractFormData.lateFeePercentage} onChange={e => setContractFormData({...contractFormData, lateFeePercentage: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Frecuencia (Meses)</Label><Input type="number" value={contractFormData.adjustmentFrequencyMonths} onChange={e => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})} /></div>
              </div>
            </TabsContent>
            <TabsContent value="documents" className="pt-4 space-y-4">
              {/* File upload */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3 hover:border-primary/50 transition-colors">
                {(contractFormData.documents as any)?.mainContractName ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-700">{(contractFormData.documents as any).mainContractName}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                      onClick={() => setContractFormData(prev => ({ ...prev, documents: { ...(prev.documents as any), mainContractUrl: '', mainContractName: '' } }))}>
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                    <p className="text-sm font-bold text-foreground">Cargar archivo del contrato</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG — máx. 5MB</p>
                  </>
                )}
                <Button variant="outline" size="sm" className="gap-2 font-bold"
                  onClick={() => contractFileInputRef.current?.click()}
                  disabled={isUploadingContract}>
                  {isUploadingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {(contractFormData.documents as any)?.mainContractName ? 'Reemplazar archivo' : 'Seleccionar archivo'}
                </Button>
                <input ref={contractFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleContractFileChange} />
              </div>

              {/* Botón de análisis con IA (para imágenes o PDFs escaneados) */}
              {(contractFormData.documents as any)?.mainContractUrl && (
                <Button
                  variant="outline"
                  className="w-full gap-2 font-bold border-primary/30 text-primary hover:bg-primary/5"
                  onClick={handleExtractContract}
                  disabled={isExtracting}
                >
                  {isExtracting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando con IA (OCR)...</>
                    : <><Sparkles className="h-4 w-4" /> Analizar con IA (para imágenes / PDF escaneado)</>}
                </Button>
              )}

              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground italic font-bold uppercase">
                  Transcripción del contrato (necesaria para el Asistente Legal)
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Se completa automáticamente al usar "Analizar con IA", o podés pegar el texto manualmente.
                </p>
              </div>
              <Textarea
                placeholder="El texto del contrato aparecerá aquí después de usar 'Analizar con IA', o podés pegarlo manualmente..."
                className="h-[200px] font-mono text-[10px] bg-muted/10"
                value={contractFormData.fullTranscription ?? ''}
                onChange={e => setContractFormData({...contractFormData, fullTranscription: e.target.value})}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6 pt-4 border-t"><Button onClick={handleSaveContract} className="font-black px-12">Guardar Contrato</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO PERSONA */}
      <Dialog open={isPersonDialogOpen} onOpenChange={setIsPersonDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Editar Persona' : 'Alta de Persona'}</DialogTitle>
            <DialogDescription>Complete los datos de contacto y fiscales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Nombre Completo *</Label>
              <Input
                placeholder="Ej: Juan Pérez"
                value={personFormData.fullName}
                onChange={e => { setPersonFormData({...personFormData, fullName: e.target.value}); if (personErrors.fullName) setPersonErrors(p => ({ ...p, fullName: undefined })); }}
                className={personErrors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {personErrors.fullName && <p className="text-xs text-destructive">{personErrors.fullName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CUIT / DNI</Label>
                <Input 
                  placeholder="20-XXXXXXXX-0" 
                  value={personFormData.taxId} 
                  onChange={e => setPersonFormData({...personFormData, taxId: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <SelectWithOther
                  value={personFormData.type ?? ''}
                  onValueChange={(v: any) => setPersonFormData({...personFormData, type: v})}
                  options={['Inquilino','Propietario','Garante','Proveedor']}
                  otherPlaceholder="Ej: Avalista, Empresa, Representante..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={personFormData.email}
                onChange={e => { setPersonFormData({...personFormData, email: e.target.value}); if (personErrors.email) setPersonErrors(p => ({ ...p, email: undefined })); }}
                className={personErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {personErrors.email && <p className="text-xs text-destructive">{personErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input 
                placeholder="+54 9 ..." 
                value={personFormData.phone} 
                onChange={e => setPersonFormData({...personFormData, phone: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPersonDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary font-bold px-8" onClick={handleSavePerson}>Guardar Persona</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO Q&A LEGAL */}
      <Dialog open={isQAOpen} onOpenChange={setIsQAOpen}>
        <DialogContent className="max-w-2xl bg-white border-none shadow-2xl">
          <DialogHeader>
            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-2">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-black">Asistente Legal de Cláusulas</DialogTitle>
            <DialogDescription>Consulte cualquier duda sobre los términos del contrato de {selectedQAContract?.tenantName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Warning si no hay transcripción */}
            {!selectedQAContract?.fullTranscription && (
              <div className="flex gap-3 items-start p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-800">Este contrato no tiene texto cargado</p>
                  <p className="text-xs text-amber-700">
                    Para usar el Asistente Legal, necesitás cargar el texto del contrato. Hay dos formas:
                  </p>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                    <li>Editá el contrato → pestaña <strong>Documentos</strong> → subí el PDF/imagen → botón <strong>"Analizar con IA"</strong></li>
                    <li>O pegá el texto del contrato manualmente en el campo de transcripción</li>
                  </ul>
                </div>
              </div>
            )}

            {selectedQAContract?.fullTranscription && (
              <div className="flex gap-2 items-center p-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  Contrato con transcripción cargada — {selectedQAContract.fullTranscription.length.toLocaleString('es-AR')} caracteres
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Tu pregunta al contrato</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: ¿Quién paga el impuesto inmobiliario? ¿Cuál es la multa por rescisión?"
                  value={qaQuestion}
                  onChange={e => setQAQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAskContract()}
                  className="h-12"
                  disabled={!selectedQAContract?.fullTranscription}
                />
                <Button
                  onClick={handleAskContract}
                  disabled={isAsking || !qaQuestion || !selectedQAContract?.fullTranscription}
                  className="bg-primary h-12 px-6"
                >
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {qaAnswer && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                  <p className="text-sm leading-relaxed text-foreground font-medium">{qaAnswer.answer}</p>
                  {qaAnswer.fundamentoLegal && (
                    <div className="flex items-start gap-1.5 text-[11px] text-blue-700">
                      <span className="font-bold flex-shrink-0">⚖️</span>{qaAnswer.fundamentoLegal}
                    </div>
                  )}
                  {qaAnswer.alertaLegal && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                      ⚠️ {qaAnswer.alertaLegal}
                    </div>
                  )}
                  {qaAnswer.sourceQuote && (
                    <div className="p-3 bg-white/50 border-l-4 border-primary rounded text-[11px] italic text-muted-foreground">
                      "{qaAnswer.sourceQuote}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO NOTIFICACIÓN AUMENTO (Aviso de suba de alquiler) */}
      <Dialog open={isAdjNotifOpen} onOpenChange={setIsAdjNotifOpen}>
        <DialogContent className={cn("transition-colors duration-500", adjDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" /> Aviso de Aumento de Alquiler
            </DialogTitle>
            <DialogDescription>Notificar formalmente al inquilino sobre la suba del valor mensual.</DialogDescription>
          </DialogHeader>
          {selectedAdjContract && !adjDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted/30 rounded-xl space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Monto Mensual Actual</p>
                <p className="text-2xl font-black text-primary">{selectedAdjContract.currency} {selectedAdjContract.currentRentAmount.toLocaleString('es-AR')}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label className="text-[10px] font-black uppercase text-orange-600">Nuevo Valor a Notificar</Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-black flex gap-1 text-primary" onClick={handleAutoCalculate} disabled={isCalculatingIndex}>
                    {isCalculatingIndex ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Autocalcular con {selectedAdjContract.adjustmentMechanism}
                  </Button>
                </div>
                <CurrencyInput className="h-12 text-lg font-black border-orange-200 focus:border-orange-500" value={newRentValueInput} onChange={setNewRentValueInput} placeholder="0" />
              </div>
              <Button className="w-full h-11 font-black bg-orange-600 hover:bg-orange-700 text-white" onClick={handleGenerateAdjDraft} disabled={!newRentValueInput}>
                Generar Notificación de Aumento
              </Button>
            </div>
          )}
          {adjDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <Label className="text-[10px] font-black block mb-1 uppercase text-orange-700">Asunto de Notificación</Label>
                <p className="font-bold text-sm text-orange-900">{adjDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap">
                {adjDraft.draftedMessage}
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAdjDraft(null)}>Atrás</Button>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white font-black gap-2 h-11 px-8" onClick={handleSendAdjEmail} disabled={isSendingEmail}>
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar Aviso de Aumento Real
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO NOTIFICACIÓN VENCIMIENTO (Renovación) */}
      <Dialog open={isRenewalNotifOpen} onOpenChange={setIsRenewalNotifOpen}>
        <DialogContent className={cn("transition-colors duration-500", renewalDraft ? "max-w-3xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-accent" /> Aviso de Vencimiento de Contrato
            </DialogTitle>
            <DialogDescription>Informar sobre el fin del contrato y próximos pasos.</DialogDescription>
          </DialogHeader>
          {selectedRenewalContract && !renewalDraft && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl space-y-2">
                <p className="text-xs font-bold text-accent uppercase">Fecha de Finalización</p>
                <p className="text-2xl font-black text-accent">{formatDateDisplay(selectedRenewalContract.endDate)}</p>
                <p className="text-[10px] text-muted-foreground italic">Se redactará un mensaje profesional para coordinar renovación o entrega de llaves.</p>
              </div>
              <Button className="w-full h-11 font-black bg-accent hover:bg-accent/90 text-white" onClick={handleGenerateRenewalDraft}>
                Generar Borrador de Vencimiento
              </Button>
            </div>
          )}
          {renewalDraft && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-[10px] font-black block mb-1 uppercase">Asunto de Vencimiento</Label>
                <p className="font-bold text-sm">{renewalDraft.subjectLine}</p>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-6 bg-white shadow-inner text-sm leading-relaxed text-justify whitespace-pre-wrap italic">
                {renewalDraft.draftedMessage}
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRenewalDraft(null)}>Atrás</Button>
                <Button className="bg-accent font-black gap-2 h-11 px-8 text-white" onClick={handleSendRenewalEmail} disabled={isSendingEmail}>
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar Aviso de Vencimiento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        {activeTab === 'contracts' ? (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Inquilino / Unidad</TableHead><TableHead>Fin Contrato</TableHead><TableHead>Ajuste</TableHead><TableHead className="text-right">Alquiler Actual</TableHead><TableHead className="text-right">Notificaciones e IA</TableHead></TableRow></TableHeader>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{c.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{c.propertyName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold">{formatDateDisplay(c.endDate)}</span>
                      <Badge variant="ghost" className="text-[8px] p-0 h-auto font-black uppercase text-muted-foreground">Estado: {c.status}</Badge>
                      {contractRiskBadge(c)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase"><Calendar className="h-3 w-3" /> {c.adjustmentMechanism}</div>
                      <span className="text-[9px] text-muted-foreground">Ciclo: {c.adjustmentFrequencyMonths} meses</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary text-base">{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.generatedDocumentHtml && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 hover:bg-blue-50"
                          title="Ver documento redactado"
                          onClick={() => setViewDocContract(c)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary hover:bg-primary/10"
                        title="Asistente Legal (Preguntar al Contrato)"
                        onClick={() => { setSelectedQAContract(c); setQAAnswer(null); setQAQuestion(''); setIsQAOpen(true); }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-orange-600 hover:bg-orange-50" 
                        title="Notificar Aumento de Alquiler (Próxima Suba)"
                        onClick={() => { setSelectedAdjContract(c); setAdjDraft(null); setNewRentValueInput(0); setIsAdjNotifOpen(true); }}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-accent hover:bg-accent/5"
                        title="Notificar Vencimiento / Renovación"
                        onClick={() => { setSelectedRenewalContract(c); setRenewalDraft(null); setIsRenewalNotifOpen(true); }}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>

                      {canWrite && (c.status === 'Próximo a Vencer' || c.status === 'Finalizado') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-600 hover:bg-green-50"
                          title="Preparar borrador de renovación"
                          onClick={() => handleCreateRenewalDraft(c)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}

                      {canWrite && (
                        <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => { setEditingContract(c); setContractFormData(c); setContractDialogTab('general'); setAiExtractedData(null); setIsContractDialogOpen(true); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          title="Eliminar contrato"
                          onClick={() => {
                            if (confirm(`¿Eliminár el contrato de ${c.tenantName}? Esta acción no se puede deshacer.`)) {
                              handleDeleteContract(c.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Ver Detalle del Contrato */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-indigo-600 hover:bg-indigo-50"
                        title="Ver detalle completo del contrato"
                        onClick={() => setSelectedDetailContract(c)}
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay contratos activos.</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        ) : activeTab === 'owners' ? (
          /* ── Vista Por Propietario ── */
          <OwnersView
            contracts={contracts}
            people={people}
            properties={properties}
            invoices={invoices}
            liquidations={liquidations}
            tasks={tasks}
            legalCases={legalCases}
            applications={applications}
            onSelectContract={(c) => setSelectedDetailContract(c)}
            onOpenProperty={onOpenProperty}
          />
        ) : activeTab === 'people' ? (
          <div className="space-y-4">
            {/* Búsqueda + filtro por tipo */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o CUIT..."
                  className="pl-9 bg-white"
                  value={peopleSearch}
                  onChange={e => setPeopleSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {(['Todos', 'Propietario', 'Inquilino', 'Garante', 'Proveedor'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setPeopleTypeFilter(t)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                      peopleTypeFilter === t
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Nombre Completo</TableHead><TableHead>CUIT / DNI</TableHead><TableHead>Tipo</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {people
                  .filter(p => peopleTypeFilter === 'Todos' || p.type === peopleTypeFilter)
                  .filter(p => {
                    const q = peopleSearch.toLowerCase();
                    return !q || p.fullName?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.taxId?.includes(q);
                  })
                  .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'es'))
                  .map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{p.fullName}</TableCell>
                      <TableCell className="text-xs">{p.taxId || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="border-primary/30 text-primary text-[10px]">{p.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.email || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => handleOpenPersonDialog(p)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeletePerson(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {people.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={UserPlus}
                        title="Sin personas registradas"
                        description="Agregá inquilinos y propietarios para asociarlos a contratos y propiedades."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        ) : (
          /* ── Accesos Portal ── */
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-black text-sm">Gestión de Accesos al Portal Inquilino</p>
                <p className="text-xs text-muted-foreground">Controlá quién puede ingresar al portal desde su email. Los cambios son inmediatos.</p>
              </div>
            </div>

            {registryEntries.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">Sin inquilinos registrados en el portal</p>
                <p className="text-xs mt-1">Los accesos se generan automáticamente cuando creás contratos con email del inquilino.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {registryEntries.map((entry: any) => {
                  const status    = entry.status ?? 'activo';
                  const docId     = entry.tenantEmail?.toLowerCase().replace(/[@.+]/g, '_') ?? entry.id;
                  const isActive  = status === 'activo';
                  const isSusp    = status === 'suspendido';
                  const isInact   = status === 'inactivo';

                  const statusBadge = isActive
                    ? { label: 'Activo',     color: 'bg-green-50 text-green-700 border-green-200', icon: ShieldCheck }
                    : isSusp
                    ? { label: 'Suspendido', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ShieldAlert }
                    : { label: 'Inactivo',   color: 'bg-slate-50 text-slate-500 border-slate-200', icon: ShieldOff  };

                  const StatusIcon = statusBadge.icon;

                  return (
                    <div key={entry.id ?? docId} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/10 transition-colors">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-black text-sm shrink-0">
                        {(entry.tenantName ?? '?').charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-foreground truncate">{entry.tenantName ?? '—'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{entry.tenantEmail}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.propertyName}</p>
                      </div>

                      {/* Status badge */}
                      <Badge className={cn('border text-[10px] font-bold gap-1 shrink-0', statusBadge.color)}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {statusBadge.label}
                      </Badge>

                      {/* Actions */}
                      {canWrite && (
                        <div className="flex gap-1.5 shrink-0">
                          {!isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-bold gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                              onClick={() => handleReactivateTenant(docId, entry.tenantName ?? '')}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Reactivar
                            </Button>
                          )}
                          {isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-bold gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => handleSuspendTenant(docId, entry.tenantName ?? '')}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> Suspender
                            </Button>
                          )}
                          {!isInact && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-bold gap-1.5 border-red-200 text-destructive hover:bg-red-50"
                              onClick={() => handleDeactivateTenant(docId, entry.tenantName ?? '')}
                            >
                              <UserX className="h-3.5 w-3.5" /> Dar de baja
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <p><strong className="text-foreground">Activo:</strong> puede ingresar al portal normalmente.</p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p><strong className="text-foreground">Suspendido:</strong> ve un aviso de suspensión, no puede operar.</p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldOff className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p><strong className="text-foreground">Dado de baja:</strong> acceso bloqueado completamente.</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Sheet: Detalle del Contrato ── */}
      <Sheet open={!!selectedDetailContract} onOpenChange={(open) => { if (!open) setSelectedDetailContract(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          {selectedDetailContract && (
            <ContractDetailPanel
              contract={selectedDetailContract}
              people={people}
              properties={properties}
              invoices={invoices}
              liquidations={liquidations}
              tasks={tasks}
              legalCases={legalCases}
              onClose={() => setSelectedDetailContract(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Modal: Ver Documento Redactado ── */}
      {viewDocContract && (
        <Dialog open={!!viewDocContract} onOpenChange={() => setViewDocContract(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black">
                <FileText className="h-4 w-4 text-blue-600" />
                Documento — {viewDocContract.tenantName} / {viewDocContract.propertyName}
              </DialogTitle>
            </DialogHeader>
            <div
              className="prose prose-sm max-w-none border rounded-lg p-6 bg-white text-foreground font-serif text-justify leading-relaxed"
              dangerouslySetInnerHTML={{ __html: viewDocContract.generatedDocumentHtml! }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => {
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`<html><head><title>${viewDocContract.tenantName}</title><style>body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.8;margin:2.5cm;text-align:justify}h2{font-size:12pt;font-weight:bold;text-align:center;text-transform:uppercase;margin:1.5em 0 0.5em}p{margin:0.4em 0}mark{background:none;font-weight:bold}</style></head><body>${viewDocContract.generatedDocumentHtml}</body></html>`);
                win.document.close();
                win.print();
              }}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Imprimir / PDF
              </Button>
              <Button onClick={() => setViewDocContract(null)}>Cerrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Vista "Por Propietario" ────────────────────────────────────────────────────

interface OwnersViewProps {
  contracts: Contract[];
  people: Person[];
  properties: Property[];
  invoices: Invoice[];
  liquidations: Liquidation[];
  tasks: MaintenanceTask[];
  legalCases: LegalCase[];
  applications: RentalApplication[];
  onSelectContract: (c: Contract) => void;
  onOpenProperty?: (propertyId: string) => void;
}

function OwnersView({ contracts, people, properties, invoices, liquidations, tasks, legalCases, applications, onSelectContract, onOpenProperty }: OwnersViewProps) {
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);
  const [ownerSearch, setOwnerSearch] = useState('');

  const formatPropStreet = (prop: Property) => {
    const streetOnly = prop.address.replace(/,?\s*\d{2,5}(?=\s|,|$)/g, '').replace(/\s+/g, ' ').trim();
    return prop.unit ? `${streetOnly} · ${prop.unit}` : streetOnly;
  };

  // Agrupar contratos por propietario. Empezamos sembrando TODAS las personas de
  // tipo Propietario (o vinculadas a alguna propiedad por email) para que también
  // aparezcan los propietarios sin contratos.
  const ownerMap = new Map<string, { person: Person; contracts: Contract[] }>();

  // 1) Sembrar con todas las personas tipo Propietario
  people
    .filter(p => p.type === 'Propietario')
    .forEach(p => {
      ownerMap.set(p.id, { person: p, contracts: [] });
    });

  // 2) Sembrar también personas que figuran como dueños de alguna propiedad
  //    por coincidencia de email, aunque el type no sea "Propietario"
  const ownerEmails = new Set<string>();
  properties.forEach(prop => {
    prop.owners?.forEach(o => {
      if (o.email) ownerEmails.add(o.email.toLowerCase());
    });
  });
  people.forEach(p => {
    if (ownerMap.has(p.id)) return;
    if (p.email && ownerEmails.has(p.email.toLowerCase())) {
      ownerMap.set(p.id, { person: p, contracts: [] });
    }
  });

  // 3) Asignar contratos a sus propietarios
  contracts.forEach(c => {
    const ids = c.ownerIds ?? [];
    if (ids.length === 0) {
      const key = '__sin_propietario__';
      if (!ownerMap.has(key)) {
        ownerMap.set(key, {
          person: { id: key, fullName: 'Sin Propietario', type: 'Propietario', taxId: '', email: '', phone: '', documents: [], ownerId: '' },
          contracts: [],
        });
      }
      ownerMap.get(key)!.contracts.push(c);
    } else {
      ids.forEach(oid => {
        const person = people.find(p => p.id === oid);
        if (!person) return;
        if (!ownerMap.has(oid)) ownerMap.set(oid, { person, contracts: [] });
        ownerMap.get(oid)!.contracts.push(c);
      });
    }
  });

  const ownerGroups = Array.from(ownerMap.values()).sort((a, b) =>
    (a.person.fullName ?? '').localeCompare(b.person.fullName ?? '')
  );

  const filteredGroups = ownerGroups.filter(({ person }) => {
    const q = ownerSearch.toLowerCase();
    return !q || person.fullName?.toLowerCase().includes(q) || person.email?.toLowerCase().includes(q);
  });

  if (ownerGroups.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground p-6">
        <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="font-semibold">Sin propietarios registrados</p>
        <p className="text-xs mt-1">Asigná propietarios a los contratos o a las propiedades para verlos aquí.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar propietario..."
          className="pl-9 bg-white"
          value={ownerSearch}
          onChange={e => setOwnerSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
      {filteredGroups.map(({ person, contracts: ownerContracts }) => {
        const isExpanded = expandedOwnerId === person.id;
        const vigentes = ownerContracts.filter(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer');
        const totalRent = vigentes.reduce((s, c) => s + c.currentRentAmount, 0);
        const ownerInvoices = invoices.filter(i => ownerContracts.some(c => c.id === i.contractId));
        const pendingInvoices = ownerInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');

        return (
          <div key={person.id} className="border rounded-xl overflow-hidden">
            {/* Header de propietario */}
            <button
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/10 transition-colors text-left"
              onClick={() => setExpandedOwnerId(isExpanded ? null : person.id)}
            >
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 font-black text-primary">
                {(person.fullName ?? person.email ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm">{person.fullName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{person.email || 'Sin email'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-primary">
                    {vigentes.length > 0 ? `ARS ${totalRent.toLocaleString('es-AR')}` : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{ownerContracts.length} contrato{ownerContracts.length !== 1 ? 's' : ''}</p>
                </div>
                {pendingInvoices.length > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center">
                    {pendingInvoices.length} pend.
                  </span>
                )}
                <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
              </div>
            </button>

            {/* Propiedades del propietario */}
            {isExpanded && (() => {
              const ownerProperties = properties.filter(prop =>
                prop.owners?.some(o => o.email?.toLowerCase() === person.email?.toLowerCase())
              );
              const orphanContracts = ownerContracts.filter(c =>
                !ownerProperties.some(p => p.id === c.propertyId)
              );
              return (
                <div className="border-t bg-muted/5 divide-y">
                  {ownerProperties.map(prop => {
                    const propContracts = contracts.filter(c => c.propertyId === prop.id);
                    const activeContract = propContracts.find(c => c.status === 'Vigente' || c.status === 'Próximo a Vencer');
                    const propInvoices = invoices.filter(i => propContracts.some(c => c.id === i.contractId));
                    const pendingInv = propInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
                    const openTasks = tasks.filter(t => t.propertyId === prop.id && t.status !== 'Completado');
                    const newApps = applications.filter(a => a.propertyId === prop.id && a.status === 'Nueva');
                    const daysLeft = activeContract
                      ? Math.round((new Date(activeContract.endDate).getTime() - Date.now()) / 86_400_000)
                      : null;
                    return (
                      <div
                        key={prop.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 cursor-pointer"
                        onClick={() => onOpenProperty?.(prop.id)}
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Home className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{formatPropStreet(prop)}</span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase">{prop.type}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                            {activeContract ? (
                              <>
                                <span>{activeContract.currency} {activeContract.currentRentAmount.toLocaleString('es-AR')}/mes</span>
                                <span>·</span>
                                <span>Vence: {new Date(activeContract.endDate).toLocaleDateString('es-AR')}</span>
                                {daysLeft !== null && daysLeft <= 60 && (
                                  <span className={cn('font-black', daysLeft <= 30 ? 'text-red-600' : 'text-amber-600')}>
                                    ({daysLeft}d)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="italic">Sin contrato activo</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {newApps.length > 0 && (
                            <span className="h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black flex items-center border border-blue-200">
                              {newApps.length} sol.
                            </span>
                          )}
                          {pendingInv.length > 0 && (
                            <span className="h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black flex items-center border border-amber-200">
                              {pendingInv.length} pend.
                            </span>
                          )}
                          {openTasks.length > 0 && (
                            <span className="h-5 px-1.5 rounded-full bg-red-100 text-red-700 text-[9px] font-black flex items-center border border-red-200">
                              {openTasks.length} mant.
                            </span>
                          )}
                          {activeContract && (
                            <Badge
                              className={cn(
                                'border text-[9px] font-bold',
                                activeContract.status === 'Vigente' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              )}
                            >
                              {activeContract.status}
                            </Badge>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                  {orphanContracts.map(c => {
                    const contInvoices = invoices.filter(i => i.contractId === c.id);
                    const contPending = contInvoices.filter(i => i.status === 'Pendiente' || i.status === 'Vencido');
                    const daysLeft = Math.round((new Date(c.endDate).getTime() - Date.now()) / 86_400_000);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 cursor-pointer opacity-70"
                        onClick={() => onSelectContract(c)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{c.tenantName ?? '—'}</span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase">{c.propertyName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{c.currency} {c.currentRentAmount.toLocaleString('es-AR')}/mes</span>
                            <span>·</span>
                            <span>Vence: {new Date(c.endDate).toLocaleDateString('es-AR')}</span>
                            {daysLeft >= 0 && daysLeft <= 60 && (
                              <span className={cn('font-black', daysLeft <= 30 ? 'text-red-600' : 'text-amber-600')}>
                                ({daysLeft}d)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {contPending.length > 0 && (
                            <span className="h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black flex items-center border border-amber-200">
                              {contPending.length} pend.
                            </span>
                          )}
                          <Badge
                            className={cn(
                              'border text-[9px] font-bold',
                              c.status === 'Vigente' ? 'bg-green-50 text-green-700 border-green-200' :
                              c.status === 'Próximo a Vencer' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              c.status === 'Finalizado' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                              'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {c.status}
                          </Badge>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                  {ownerProperties.length === 0 && ownerContracts.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic">Sin propiedades ni contratos vinculados.</div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
      </div>
    </div>
  );
}
