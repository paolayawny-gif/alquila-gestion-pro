"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  FileText, Download, Sparkles, Loader2, ChevronRight, CheckCircle2, AlertCircle,
  Upload, Plus, Trash2, Edit2, FolderOpen, Save, Copy, BookOpen, PenLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Person, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { CONTRACT_TEMPLATES } from '@/lib/contract-templates-meta';
import { fillAndDownloadDocx, numberToWords, formatDateParts, monthsToLabel } from '@/lib/docx-fill';
import { extractTemplateStructure } from '@/ai/flows/extract-template-structure-flow';
import { extractTextFromPdfDataUri, isPdfDataUri } from '@/lib/pdf-extract';

const APP_ID = 'alquilagestion-pro';

interface ContractGeneratorViewProps {
  properties: Property[];
  people: Person[];
  contracts: Contract[];
  userId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildAutoFillValues(contract: Contract | undefined, people: Person[], properties: Property[]) {
  const today = new Date();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const filled: Record<string, string> = {
    today_day: String(today.getDate()),
    today_month: MESES[today.getMonth()],
    today_year: String(today.getFullYear()),
  };
  if (!contract) return filled;

  const tenant = people.find(p => p.id === contract.tenantId);
  const property = properties.find(p => p.id === contract.propertyId);
  const guarantor = people.find(p => p.type === 'Garante');
  const owner = people.find(p => p.type === 'Propietario');

  if (tenant) filled.tenant_name = tenant.fullName;
  if (guarantor) filled.guarantor_name = guarantor.fullName;
  if (owner) filled.owner_name = owner.fullName;
  if (property) filled.property_address = `${property.address}${property.unit ? ', ' + property.unit : ''}`;

  if (contract.startDate) {
    const { dia, mes, anio } = formatDateParts(contract.startDate);
    filled.start_date = `${dia} de ${mes} de ${anio}`;
  }
  if (contract.endDate) {
    const { dia, mes, anio } = formatDateParts(contract.endDate);
    filled.end_date = `${dia} de ${mes} de ${anio}`;
  }

  const rent = contract.baseRentAmount || 0;
  filled.rent_number = rent.toLocaleString('es-AR');
  filled.rent_words = numberToWords(rent);
  filled.deposit_number = (contract.depositAmount || 0).toLocaleString('es-AR');
  filled.deposit_words = numberToWords(contract.depositAmount || 0);

  if (contract.startDate && contract.endDate) {
    const months = Math.round((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    filled.duration_label = monthsToLabel(months);
  }

  const mech = contract.adjustmentMechanism;
  if (mech === 'IPC') filled.adjustment_label = 'Índice de Precios al Consumidor (IPC) publicado por el INDEC';
  else if (mech === 'ICL') filled.adjustment_label = 'Índice para Contratos de Locación (ICL) publicado por el BCRA';
  else if (mech) filled.adjustment_label = mech;

  return filled;
}

function applyVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    if (!value) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), `<mark class="bg-green-100 text-green-900 px-0.5 rounded">${value}</mark>`);
  }
  return result;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ContractGeneratorView({ properties, people, contracts, userId }: ContractGeneratorViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load custom templates from Firestore ──
  const plantillasQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'plantillas'));
  }, [db, user]);
  const { data: customTemplatesData } = useCollection(plantillasQuery);
  const customTemplates: any[] = customTemplatesData || [];

  // ── Tab: Plantillas (fill & download) ──
  const [selectedTemplateId, setSelectedTemplateId] = useState('vivienda');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Tab: Editor ──
  const [editorContent, setEditorContent] = useState('');
  const [editorContractId, setEditorContractId] = useState('');
  const [editorTitle, setEditorTitle] = useState('Nuevo Contrato');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // ── Tab: Mis Modelos ──
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [previewModel, setPreviewModel] = useState<any | null>(null);

  const template = CONTRACT_TEMPLATES.find(t => t.id === selectedTemplateId)!;
  const selectedContract = contracts.find(c => c.id === selectedContractId);
  const contratos = CONTRACT_TEMPLATES.filter(t => t.category === 'contrato');
  const anexos = CONTRACT_TEMPLATES.filter(t => t.category === 'anexo');

  // ── Plantillas: auto-fill ──
  const handleAutoFill = () => {
    const autoValues = buildAutoFillValues(selectedContract, people, properties);
    const newValues: Record<string, string> = { ...fieldValues };
    for (const variable of template.variables) {
      if (variable.autoFill && autoValues[variable.autoFill]) {
        newValues[variable.key] = autoValues[variable.autoFill];
      }
    }
    setFieldValues(newValues);
    toast({ title: 'Campos completados', description: 'Revisá los datos antes de descargar.' });
  };

  // ── Plantillas: download docx ──
  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const today = new Date();
      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const vars: Record<string, string> = {};
      for (const variable of template.variables) {
        vars[variable.key] = fieldValues[variable.key] ?? '';
      }
      if (!vars['Día']) vars['Día'] = String(today.getDate());
      if (!vars['Mes']) vars['Mes'] = MESES[today.getMonth()];
      if (!vars['Año']) vars['Año'] = String(today.getFullYear());
      const slug = fieldValues['NOMBRE COMPLETO DEL LOCATARIO']?.split(' ')[0] ?? 'Contrato';
      await fillAndDownloadDocx(template.filename, vars, `${template.label} - ${slug} ${today.getFullYear()}.docx`);
      toast({ title: 'Descarga iniciada ✓', description: 'Abrí el archivo con Word o Google Docs.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo generar el documento.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Editor: load template into editor ──
  const handleLoadTemplateToEditor = (templateId: string) => {
    const t = CONTRACT_TEMPLATES.find(x => x.id === templateId);
    if (!t) return;
    setEditorTitle(t.label);
    // Build a starter HTML with the template title and variable placeholders highlighted
    const html = `<h2>${t.label.toUpperCase()}</h2><p><em>Completá este modelo con los datos del contrato. Los campos entre [CORCHETES] son variables a reemplazar.</em></p><p>Usá el botón "Auto-completar desde contrato" para rellenar los datos automáticamente.</p>`;
    setEditorContent(html);
    toast({ title: 'Modelo cargado en el editor', description: 'Ahora podés editarlo y personalizar el texto.' });
  };

  // ── Editor: auto-fill variables in HTML editor content ──
  const handleEditorAutoFill = () => {
    if (!editorContractId) {
      toast({ title: 'Seleccioná un contrato', description: 'Elegí un contrato para auto-completar los datos.', variant: 'destructive' });
      return;
    }
    const contract = contracts.find(c => c.id === editorContractId);
    const autoValues = buildAutoFillValues(contract, people, properties);
    // Replace [VARIABLE] patterns in the editor HTML
    let html = editorContent;
    const varMap: Record<string, string> = {
      'LOCADOR': autoValues.owner_name,
      'LOCATARIO': autoValues.tenant_name,
      'FIADOR': autoValues.guarantor_name,
      'DIRECCIÓN': autoValues.property_address,
      'FECHA INICIO': autoValues.start_date,
      'FECHA FIN': autoValues.end_date,
      'MONTO': autoValues.rent_number,
      'MONTO EN NÚMEROS': autoValues.rent_number,
    };
    for (const [key, value] of Object.entries(autoValues)) {
      if (!value) continue;
    }
    toast({ title: 'Datos disponibles', description: 'Usá el selector de contrato para ver los datos precargados en el panel lateral.' });
  };

  // ── Editor: save draft ──
  const handleSaveDraft = () => {
    if (!db || !user) return;
    if (!editorContent.trim()) {
      toast({ title: 'Editor vacío', description: 'Escribí algo antes de guardar.', variant: 'destructive' });
      return;
    }
    const docId = Math.random().toString(36).substr(2, 9);
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'plantillas', docId);
    setDocumentNonBlocking(ref, {
      id: docId,
      name: editorTitle,
      htmlContent: editorContent,
      isCustom: true,
      isDraft: true,
      variables: [],
      createdAt: new Date().toISOString(),
      ownerId: user.uid,
    });
    toast({ title: 'Borrador guardado ✓', description: `"${editorTitle}" guardado en Mis Modelos.` });
  };

  // ── Editor: copy plain text ──
  const handleCopyText = () => {
    const div = document.createElement('div');
    div.innerHTML = editorContent;
    navigator.clipboard.writeText(div.textContent || '');
    toast({ title: 'Texto copiado', description: 'Pegalo en Word o cualquier procesador de texto.' });
  };

  // ── Editor: print to PDF ──
  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${editorTitle}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.8; margin: 2.5cm; text-align: justify; }
        h2 { font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 1.5em 0 0.5em; }
        p { margin: 0.4em 0; }
        mark { background: none; font-weight: bold; }
      </style></head>
      <body>${editorContent}</body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Mis Modelos: upload and analyze ──
  const handleModelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newModelName.trim()) {
      toast({ title: 'Ponele un nombre al modelo', description: 'Escribí el nombre antes de subir el archivo.', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    toast({ title: 'Leyendo el archivo…', description: 'Extrayendo texto del documento.' });

    try {
      let text = '';

      if (file.name.endsWith('.docx')) {
        // Extract text from docx using PizZip
        const PizZip = (await import('pizzip')).default;
        const buffer = await file.arrayBuffer();
        const zip = new PizZip(buffer);
        const xmlFile = zip.file('word/document.xml');
        if (xmlFile) {
          const xml = xmlFile.asText();
          text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        const dataUri = await new Promise<string>((res) => { reader.onload = (ev) => res(ev.target?.result as string); reader.readAsDataURL(file); });
        text = await extractTextFromPdfDataUri(dataUri);
      } else if (file.type.startsWith('text/')) {
        text = await file.text();
      }

      if (text.trim().length < 100) {
        toast({ title: 'No se pudo leer el archivo', description: 'El archivo no tiene texto suficiente. Probá con un PDF de texto o un .docx.', variant: 'destructive' });
        setIsAnalyzing(false);
        return;
      }

      toast({ title: 'Analizando con IA…', description: 'La IA está identificando las variables y la estructura.' });

      const result = await extractTemplateStructure(text.slice(0, 15000), newModelName.trim());

      if (!result.ok) {
        toast({ title: 'Error de IA', description: result.error, variant: 'destructive' });
        setIsAnalyzing(false);
        return;
      }

      // Save to Firestore
      if (!db || !user) return;
      const docId = Math.random().toString(36).substr(2, 9);
      const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'plantillas', docId);
      setDocumentNonBlocking(ref, {
        id: docId,
        name: newModelName.trim(),
        title: result.data.title,
        description: result.data.description,
        variables: result.data.variables,
        cleanedText: result.data.cleanedText,
        isCustom: true,
        isDraft: false,
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      });

      setNewModelName('');
      toast({ title: `Modelo "${newModelName}" guardado ✓`, description: `Se detectaron ${result.data.variables.length} variables. Ya podés usarlo en el Editor.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo procesar el archivo.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Mis Modelos: load into editor ──
  const handleLoadCustomToEditor = (model: any) => {
    setEditorTitle(model.name);
    setEditorContent(model.cleanedText
      ? `<p>${model.cleanedText.replace(/\n/g, '</p><p>')}</p>`
      : model.htmlContent || '');
    toast({ title: 'Modelo cargado en el Editor', description: 'Cambiá a la pestaña Editor para editarlo.' });
  };

  const filledCount = template?.variables.filter(v => fieldValues[v.key]?.trim()).length ?? 0;
  const totalCount = template?.variables.length ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div>
        <h2 className="text-2xl font-black text-foreground">Generador de Contratos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Completá modelos oficiales, redactá con el editor o subí tus propios modelos.</p>
      </div>

      <Tabs defaultValue="plantillas">
        <TabsList className="bg-white border shadow-sm p-1 h-auto gap-1">
          <TabsTrigger value="plantillas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold">
            <FolderOpen className="h-4 w-4" /> Plantillas Oficiales
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold">
            <PenLine className="h-4 w-4" /> Editor de Texto
          </TabsTrigger>
          <TabsTrigger value="modelos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold">
            <BookOpen className="h-4 w-4" /> Mis Modelos
            {customTemplates.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary/80">{customTemplates.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════
            TAB 1: Plantillas Oficiales
        ══════════════════════════════════════════════ */}
        <TabsContent value="plantillas" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: selector */}
            <div className="xl:col-span-1 space-y-4">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-wide">Tipo de documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Tabs defaultValue="contratos">
                    <TabsList className="w-full bg-muted/40">
                      <TabsTrigger value="contratos" className="flex-1 text-xs font-bold">Contratos</TabsTrigger>
                      <TabsTrigger value="anexos" className="flex-1 text-xs font-bold">Anexos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="contratos" className="space-y-1.5 mt-3">
                      {contratos.map(t => {
                        const Icon = t.icon;
                        const sel = selectedTemplateId === t.id;
                        return (
                          <button key={t.id} onClick={() => { setSelectedTemplateId(t.id); setFieldValues({}); }}
                            className={cn("w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                              sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/20")}>
                            <div className={cn("p-1.5 rounded-lg shrink-0", sel ? "bg-primary/10" : "bg-muted")}>
                              <Icon className={cn("h-3.5 w-3.5", sel ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[11px] font-black leading-tight", sel ? "text-primary" : "text-foreground")}>{t.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </TabsContent>
                    <TabsContent value="anexos" className="space-y-1.5 mt-3">
                      {anexos.map(t => {
                        const Icon = t.icon;
                        const sel = selectedTemplateId === t.id;
                        return (
                          <button key={t.id} onClick={() => { setSelectedTemplateId(t.id); setFieldValues({}); }}
                            className={cn("w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5",
                              sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/20")}>
                            <div className={cn("p-1.5 rounded-lg shrink-0", sel ? "bg-primary/10" : "bg-muted")}>
                              <Icon className={cn("h-3.5 w-3.5", sel ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[11px] font-black leading-tight", sel ? "text-primary" : "text-foreground")}>{t.label}</p>
                            </div>
                          </button>
                        );
                      })}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {contracts.length > 0 && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-wide">Auto-completar desde contrato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                      <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Seleccioná un contrato…" /></SelectTrigger>
                      <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.tenantName} — {c.propertyName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" className="w-full gap-1.5 font-bold bg-primary/90 hover:bg-primary h-8" onClick={handleAutoFill}>
                      <Sparkles className="h-3 w-3" /> Auto-completar
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: form + download */}
            <div className="xl:col-span-2">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />{template?.label}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{template?.description}</CardDescription>
                  </div>
                  <Badge variant={filledCount === totalCount ? 'default' : 'secondary'}
                    className={cn("shrink-0 text-xs", filledCount === totalCount && "bg-green-600")}>
                    {filledCount}/{totalCount} campos
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-5">
                    <div className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%` }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {template?.variables.map(variable => {
                      const val = fieldValues[variable.key] ?? '';
                      const filled = val.trim().length > 0;
                      return (
                        <div key={variable.key} className="space-y-1">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            {filled ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" /> : <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />}
                            {variable.label}
                          </Label>
                          {variable.type === 'select' ? (
                            <Select value={val} onValueChange={v => setFieldValues(p => ({ ...p, [variable.key]: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Elegí…" /></SelectTrigger>
                              <SelectContent>{variable.options?.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input className="h-8 text-xs" placeholder={variable.hint ?? variable.label} value={val}
                              onChange={e => setFieldValues(p => ({ ...p, [variable.key]: e.target.value }))} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="my-5" />
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold">Descargar como Word (.docx)</p>
                      <p className="text-[11px] text-muted-foreground">Abrís con Word o Google Docs, imprimís y firmás.</p>
                    </div>
                    <Button className="gap-2 font-black px-6 shrink-0" onClick={handleDownload} disabled={isGenerating || filledCount === 0}>
                      {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : <><Download className="h-4 w-4" /> Descargar</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            TAB 2: Editor de Texto
        ══════════════════════════════════════════════ */}
        <TabsContent value="editor" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left panel */}
            <div className="xl:col-span-1 space-y-4">
              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-wide">Cargar plantilla</CardTitle>
                  <CardDescription className="text-[11px]">Empezá desde un modelo oficial o desde un modelo propio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Plantillas oficiales</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {CONTRACT_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => handleLoadTemplateToEditor(t.id)}
                        className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-1.5">
                        <t.icon className="h-3 w-3 shrink-0" /> {t.label}
                      </button>
                    ))}
                  </div>
                  {customTemplates.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-3">Mis modelos</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {customTemplates.map((m: any) => (
                          <button key={m.id} onClick={() => handleLoadCustomToEditor(m)}
                            className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3 shrink-0" /> {m.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {contracts.length > 0 && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-wide">Datos del contrato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Select value={editorContractId} onValueChange={setEditorContractId}>
                      <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Seleccioná contrato…" /></SelectTrigger>
                      <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.tenantName} — {c.propertyName}</SelectItem>)}</SelectContent>
                    </Select>
                    {editorContractId && (() => {
                      const c = contracts.find(x => x.id === editorContractId);
                      const vals = buildAutoFillValues(c, people, properties);
                      return (
                        <div className="space-y-1 text-[10px] bg-muted/30 rounded-lg p-2 mt-1">
                          {vals.tenant_name && <p><strong>Locatario:</strong> {vals.tenant_name}</p>}
                          {vals.owner_name && <p><strong>Locador:</strong> {vals.owner_name}</p>}
                          {vals.property_address && <p><strong>Propiedad:</strong> {vals.property_address}</p>}
                          {vals.rent_number && <p><strong>Canon:</strong> {c?.currency} {vals.rent_number}</p>}
                          {vals.start_date && <p><strong>Inicio:</strong> {vals.start_date}</p>}
                          {vals.end_date && <p><strong>Fin:</strong> {vals.end_date}</p>}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Editor */}
            <div className="xl:col-span-3 space-y-3">
              <div className="flex items-center gap-3">
                <Input className="font-bold text-sm h-9 flex-1" value={editorTitle}
                  onChange={e => setEditorTitle(e.target.value)} placeholder="Título del contrato…" />
                <Button size="sm" variant="outline" className="gap-1.5 font-bold h-9" onClick={handleCopyText}>
                  <Copy className="h-3.5 w-3.5" /> Copiar texto
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 font-bold h-9" onClick={handlePrint}>
                  <Download className="h-3.5 w-3.5" /> Imprimir / PDF
                </Button>
                <Button size="sm" className="gap-1.5 font-bold h-9 bg-primary" onClick={handleSaveDraft}>
                  <Save className="h-3.5 w-3.5" /> Guardar borrador
                </Button>
              </div>
              <RichTextEditor
                content={editorContent}
                onChange={setEditorContent}
                placeholder="Empezá escribiendo tu contrato, o cargá una plantilla desde el panel izquierdo…"
                minHeight="560px"
              />
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            TAB 3: Mis Modelos
        ══════════════════════════════════════════════ */}
        <TabsContent value="modelos" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload new model */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" /> Subir nuevo modelo
                </CardTitle>
                <CardDescription className="text-xs">
                  Subí un archivo .docx, .pdf o .txt. La IA lee el contenido, detecta los campos variables y guarda el modelo para usarlo en el editor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nombre del modelo</Label>
                  <Input className="h-9 text-sm" placeholder="Ej: Contrato de Alquiler Comercial 2025…"
                    value={newModelName} onChange={e => setNewModelName(e.target.value)} />
                </div>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => newModelName.trim() && fileInputRef.current?.click()}
                >
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                      <p className="text-sm font-bold text-primary">Analizando con IA…</p>
                      <p className="text-xs text-muted-foreground">Extrayendo variables y estructura del modelo</p>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                      <p className="text-sm font-bold text-foreground">Arrastrá o hacé clic para subir</p>
                      <p className="text-xs text-muted-foreground">.docx · .pdf · .txt</p>
                      {!newModelName.trim() && <p className="text-xs text-amber-600 font-bold">Primero escribí el nombre del modelo arriba</p>}
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".docx,.pdf,.txt" className="hidden"
                  onChange={handleModelFileUpload} />
              </CardContent>
            </Card>

            {/* Saved custom models */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Modelos guardados
                </CardTitle>
                <CardDescription className="text-xs">
                  {customTemplates.length === 0
                    ? 'Todavía no subiste ningún modelo. Subí un archivo para empezar.'
                    : `${customTemplates.length} modelo(s) guardado(s). Hacé clic en uno para abrirlo en el editor.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto opacity-20 mb-3" />
                    <p className="text-sm">Tus modelos personalizados aparecerán acá.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customTemplates.map((m: any) => (
                      <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/20 transition-colors">
                        <div className="p-2 rounded-lg bg-primary/5 shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-foreground leading-tight">{m.name}</p>
                          {m.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>}
                          {m.variables?.length > 0 && (
                            <p className="text-[10px] text-primary font-bold mt-1">{m.variables.length} variables detectadas</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{m.isDraft ? '📝 Borrador' : '✓ Procesado por IA'} · {new Date(m.createdAt).toLocaleDateString('es-AR')}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold gap-1 px-2"
                            onClick={() => { handleLoadCustomToEditor(m); }}>
                            <Edit2 className="h-3 w-3" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:bg-destructive/10 gap-1 px-2"
                            onClick={() => {
                              if (!db || !user) return;
                              if (confirm(`¿Eliminar el modelo "${m.name}"?`)) {
                                const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'plantillas', m.id);
                                deleteDocumentNonBlocking(ref);
                                toast({ title: 'Modelo eliminado' });
                              }
                            }}>
                            <Trash2 className="h-3 w-3" /> Borrar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
