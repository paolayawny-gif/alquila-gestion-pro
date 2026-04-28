
"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, Save, CheckCircle2, Mail, Home, Building2, Clock,
  TrendingUp, Undo2, Redo2, Sparkles, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Person, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { sendEmail } from '@/services/email-service';

const APP_ID = 'alquilagestion-pro';

interface ContractGeneratorViewProps {
  properties: Property[];
  people: Person[];
  contracts: Contract[];
  userId?: string;
}

const TEMPLATES = [
  { id: 'vivienda', label: 'Vivienda Habitual', sub: 'LAU vigente', icon: Home },
  { id: 'comercial', label: 'Local Comercial', sub: 'Uso distinto de vivienda', icon: Building2 },
  { id: 'temporal', label: 'Alquiler Temporal', sub: 'Por meses / Temporada', icon: Clock },
];

const IPC_BASE = 'Oct \'23';
const IPC_NEXT = 'Oct \'24';

interface FieldSnapshot {
  landlordName: string; landlordDni: string; landlordAddress: string;
  tenantName: string; tenantDni: string; propertyAddress: string;
}

function HighlightedField({ value, status }: { value: string; status?: 'filled' | 'pending' | 'warning' }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold mx-0.5",
      status === 'filled' ? "bg-green-100 text-green-800" :
      status === 'warning' ? "bg-orange-100 text-orange-800" :
      "bg-yellow-100 text-yellow-800 border border-yellow-300 border-dashed"
    )}>
      {value}
    </span>
  );
}

export function ContractGeneratorView({ properties, people, contracts, userId }: ContractGeneratorViewProps) {
  const { toast } = useToast();
  const db = useFirestore();

  const [selectedTemplate, setSelectedTemplate] = useState('vivienda');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSignature, setIsSendingSignature] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [tenantEmail, setTenantEmail] = useState('');

  const [landlordName, setLandlordName] = useState('');
  const [landlordDni, setLandlordDni] = useState('');
  const [landlordAddress, setLandlordAddress] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantDni, setTenantDni] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [contractDate] = useState(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));

  const [landlordSigned] = useState(true);
  const [tenantSigned] = useState(false);

  // Undo/Redo history
  const history = useRef<FieldSnapshot[]>([{ landlordName: '', landlordDni: '', landlordAddress: '', tenantName: '', tenantDni: '', propertyAddress: '' }]);
  const historyIndex = useRef(0);

  const pushHistory = useCallback((snap: FieldSnapshot) => {
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(snap);
    historyIndex.current = history.current.length - 1;
  }, []);

  const currentSnap = (): FieldSnapshot => ({ landlordName, landlordDni, landlordAddress, tenantName, tenantDni, propertyAddress });

  const handleUndo = () => {
    if (historyIndex.current <= 0) return;
    historyIndex.current--;
    const snap = history.current[historyIndex.current];
    setLandlordName(snap.landlordName); setLandlordDni(snap.landlordDni);
    setLandlordAddress(snap.landlordAddress); setTenantName(snap.tenantName);
    setTenantDni(snap.tenantDni); setPropertyAddress(snap.propertyAddress);
  };

  const handleRedo = () => {
    if (historyIndex.current >= history.current.length - 1) return;
    historyIndex.current++;
    const snap = history.current[historyIndex.current];
    setLandlordName(snap.landlordName); setLandlordDni(snap.landlordDni);
    setLandlordAddress(snap.landlordAddress); setTenantName(snap.tenantName);
    setTenantDni(snap.tenantDni); setPropertyAddress(snap.propertyAddress);
  };

  const handleFieldChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    pushHistory({ ...currentSnap() });
  };

  const handleAutoFill = () => {
    if (people.length > 0) {
      const tenant = people.find(p => p.role === 'Inquilino') || people[0];
      setTenantName(tenant.fullName);
      setTenantDni(tenant.taxId || '—');
    }
    if (properties.length > 0) {
      setPropertyAddress(properties[0].address);
    }
    pushHistory({ ...currentSnap() });
  };

  const handleSaveDraft = async () => {
    if (!db || !userId) {
      toast({ title: "Error", description: "Debés iniciar sesión para guardar.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const id = `borrador_${Date.now()}`;
      const docRef = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'contratos_borradores'), id);
      setDocumentNonBlocking(docRef, {
        id, template: selectedTemplate, landlordName, landlordDni, landlordAddress,
        tenantName, tenantDni, propertyAddress, contractDate,
        status: 'borrador', createdAt: new Date().toISOString(),
      }, { merge: false });
      toast({ title: "Borrador guardado", description: "El contrato fue guardado correctamente." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!tenantEmail) {
      toast({ title: "Falta el email", description: "Ingresá el email del arrendatario.", variant: "destructive" });
      return;
    }
    setIsSendingSignature(true);
    try {
      const templateTitle = selectedTemplate === 'vivienda' ? 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA HABITUAL' :
        selectedTemplate === 'comercial' ? 'CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL' :
        'CONTRATO DE ALQUILER TEMPORAL';

      const html = `
        <div style="font-family:Georgia,serif;max-width:700px;margin:auto;padding:32px;line-height:1.8;">
          <p style="font-weight:900;text-align:center;text-transform:uppercase;font-size:13px;letter-spacing:2px;">${templateTitle}</p>
          <p>En la ciudad de <strong>${propertyAddress || 'N/A'}</strong>, a <strong>${contractDate}</strong>.</p>
          <p><strong>REUNIDOS</strong></p>
          <p>De una parte, <strong>${landlordName || '[Arrendador]'}</strong>, mayor de edad, con DNI/NIF <strong>${landlordDni || 'N/A'}</strong>, y domicilio en <strong>${landlordAddress || 'N/A'}</strong>. En adelante, "LA PARTE ARRENDADORA".</p>
          <p>Y de otra, <strong>${tenantName || '[Arrendatario]'}</strong>, mayor de edad, con DNI/NIF <strong>${tenantDni || 'N/A'}</strong>. En adelante, "LA PARTE ARRENDATARIA".</p>
          <hr style="margin:24px 0;" />
          <p style="font-size:12px;color:#666;">Este documento fue generado por <strong>AlquilaGestión Pro</strong>. Por favor, revisá el contrato y respondé este email para confirmar tu conformidad.</p>
        </div>
      `;

      const res = await sendEmail({
        to: tenantEmail,
        subject: `Solicitud de Firma — ${templateTitle}`,
        html,
      });

      if (res.success) {
        toast({ title: "Enviado para firma", description: `Contrato enviado a ${tenantEmail}.` });
        setShowSignatureDialog(false);
        setTenantEmail('');
      } else {
        toast({ title: "Error al enviar", description: "No se pudo enviar el email.", variant: "destructive" });
      }
    } finally {
      setIsSendingSignature(false);
    }
  };

  const contractPreview = useMemo(() => ({
    city: propertyAddress || 'Madrid',
    date: contractDate,
    landlord: landlordName || '[Nombre del Arrendador]',
    landlordDni: landlordDni || null,
    landlordAddress: landlordAddress || null,
    tenant: tenantName || '[Nombre del Arrendatario]',
    tenantDni: tenantDni || '[DNI]',
  }), [propertyAddress, contractDate, landlordName, landlordDni, landlordAddress, tenantName, tenantDni]);

  const canUndo = historyIndex.current > 0;
  const canRedo = historyIndex.current < history.current.length - 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Generador de Contratos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Configuración y redacción automática de documentos legales.</p>
        </div>
        <Button className="bg-primary text-white gap-2 font-bold" onClick={handleSaveDraft} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar Borrador
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Editor Inteligente
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={cn("p-1.5 rounded hover:bg-muted transition-colors", canUndo ? "text-foreground" : "text-muted-foreground/30 cursor-not-allowed")}>
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={cn("p-1.5 rounded hover:bg-muted transition-colors", canRedo ? "text-foreground" : "text-muted-foreground/30 cursor-not-allowed")}>
                  <Redo2 className="h-4 w-4" />
                </button>
                {people.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 font-bold" onClick={handleAutoFill}>
                    <Sparkles className="h-3 w-3" /> Auto-rellenar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/20 rounded-xl p-6 text-sm leading-loose font-serif min-h-[320px] border border-border/50">
                <p className="font-black text-center uppercase tracking-wide text-xs mb-6 text-foreground">
                  {selectedTemplate === 'vivienda' ? 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA HABITUAL' :
                   selectedTemplate === 'comercial' ? 'CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL' :
                   'CONTRATO DE ALQUILER TEMPORAL'}
                </p>
                <p className="text-foreground/80 mb-4">
                  En la ciudad de{' '}
                  <HighlightedField value={contractPreview.city} status="filled" />
                  , a{' '}
                  <HighlightedField value={contractPreview.date} status="filled" />
                  .
                </p>
                <p className="font-black text-foreground mb-2">REUNIDOS</p>
                <p className="text-foreground/80 mb-4">
                  De una parte,{' '}
                  <HighlightedField value={contractPreview.landlord} status={landlordName ? 'filled' : 'pending'} />
                  , mayor de edad, con DNI/NIF{' '}
                  <HighlightedField value={contractPreview.landlordDni || 'Pendiente de rellenar'} status={landlordDni ? 'filled' : 'warning'} />
                  {contractPreview.landlordAddress ? (
                    <>, y domicilio a efectos de notificaciones en{' '}
                      <HighlightedField value={contractPreview.landlordAddress} status="filled" />
                    </>
                  ) : (
                    <>, y domicilio a efectos de notificaciones en{' '}
                      <HighlightedField value="[Dirección Arrendador]" status="pending" />
                    </>
                  )}
                  . En adelante, "LA PARTE ARRENDADORA".
                </p>
                <p className="text-foreground/80 mb-6">
                  Y de otra,{' '}
                  <HighlightedField value={contractPreview.tenant} status={tenantName ? 'filled' : 'pending'} />
                  , mayor de edad, con DNI/NIF{' '}
                  <HighlightedField value={contractPreview.tenantDni} status={tenantDni ? 'filled' : 'pending'} />
                  . En adelante, "LA PARTE ARRENDATARIA".
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Ambas partes se reconocen mutuamente la capacidad legal necesaria para el otorgamiento del presente contrato, y a tal efecto...
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nombre Arrendador</Label>
                  <Input value={landlordName} onChange={e => handleFieldChange(setLandlordName, e.target.value)} placeholder="Tu nombre completo" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">DNI / CUIT</Label>
                  <Input value={landlordDni} onChange={e => handleFieldChange(setLandlordDni, e.target.value)} placeholder="XX.XXX.XXX-X" className="h-8 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Dirección Arrendador</Label>
                  <Input value={landlordAddress} onChange={e => handleFieldChange(setLandlordAddress, e.target.value)} placeholder="Calle, número, ciudad..." className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nombre Arrendatario</Label>
                  <Input value={tenantName} onChange={e => handleFieldChange(setTenantName, e.target.value)} placeholder="Nombre del inquilino" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">DNI / CUIT Arrendatario</Label>
                  <Input value={tenantDni} onChange={e => handleFieldChange(setTenantDni, e.target.value)} placeholder="XX.XXX.XXX-X" className="h-8 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Ciudad / Dirección del Inmueble</Label>
                  <Input value={propertyAddress} onChange={e => handleFieldChange(setPropertyAddress, e.target.value)} placeholder="Ciudad o dirección del inmueble" className="h-8 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm">Actualización por IPC</p>
                <p className="text-xs text-muted-foreground">Cláusula automática activada para revisión anual.</p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-[9px] uppercase font-black text-muted-foreground">ÍNDICE BASE</p>
                  <p className="text-lg font-black text-foreground">{IPC_BASE}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-black text-muted-foreground">PRÓXIMA REVISIÓN</p>
                  <p className="text-lg font-black text-primary">{IPC_NEXT}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black">Selector de Plantillas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/20"
                  )}
                >
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", selectedTemplate === t.id ? "bg-primary/10" : "bg-muted/50")}>
                    <t.icon className={cn("h-4 w-4", selectedTemplate === t.id ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold", selectedTemplate === t.id ? "text-primary" : "text-foreground")}>{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.sub}</p>
                  </div>
                  {selectedTemplate === t.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">Estado de Firmas</CardTitle>
              <Badge className={cn("font-bold border-none text-xs", tenantSigned && landlordSigned ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600")}>
                {tenantSigned && landlordSigned ? 'Firmado' : 'Pendiente'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-black text-primary">AR</div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Arrendador</p>
                  <p className="text-[10px] text-muted-foreground">{landlordSigned ? 'Firmado hoy 10:24' : 'Pendiente de firma'}</p>
                </div>
                {landlordSigned ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <Mail className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              <div className={cn("flex items-center gap-3 p-3 rounded-xl border", tenantSigned ? "bg-green-50 border-green-100" : "bg-muted/10 border-border border-dashed")}>
                <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0 text-xs font-black text-muted-foreground">
                  {(tenantName || 'AR').split(' ').slice(0, 2).map(w => w[0]).join('')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{tenantName || 'Arrendatario'}</p>
                  <p className="text-[10px] text-muted-foreground">{tenantSigned ? 'Firmado' : 'Pendiente de firma'}</p>
                </div>
                {tenantSigned ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <Mail className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {!tenantSigned && (
                <Button className="w-full bg-primary text-white font-bold h-9 text-xs gap-2" onClick={() => setShowSignatureDialog(true)}>
                  <Mail className="h-3.5 w-3.5" /> Enviar para Firma
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Enviar Contrato para Firma
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">El contrato será enviado por email al arrendatario para su revisión y confirmación.</p>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-muted-foreground">Email del Arrendatario</Label>
              <Input
                type="email"
                placeholder="inquilino@ejemplo.com"
                value={tenantEmail}
                onChange={e => setTenantEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>Cancelar</Button>
            <Button className="bg-primary text-white gap-2 font-bold" onClick={handleSendForSignature} disabled={isSendingSignature}>
              {isSendingSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
