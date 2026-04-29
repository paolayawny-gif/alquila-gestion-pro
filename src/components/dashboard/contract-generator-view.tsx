"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import {
  FileText, Download, Sparkles, Loader2, ChevronRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Property, Person, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { CONTRACT_TEMPLATES, ContractTemplate } from '@/lib/contract-templates-meta';
import { fillAndDownloadDocx, numberToWords, formatDateParts, monthsToLabel } from '@/lib/docx-fill';

const APP_ID = 'alquilagestion-pro';

interface ContractGeneratorViewProps {
  properties: Property[];
  people: Person[];
  contracts: Contract[];
  userId?: string;
}

export function ContractGeneratorView({ properties, people, contracts, userId }: ContractGeneratorViewProps) {
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('vivienda');
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const template = CONTRACT_TEMPLATES.find(t => t.id === selectedTemplateId)!;
  const selectedContract = contracts.find(c => c.id === selectedContractId);

  const contratos = CONTRACT_TEMPLATES.filter(t => t.category === 'contrato');
  const anexos = CONTRACT_TEMPLATES.filter(t => t.category === 'anexo');

  // ─── Auto-fill from contract data ───────────────────────────────────────────
  const handleAutoFill = () => {
    const today = new Date();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const filled: Record<string, string> = {};

    // Date fields — always auto-fill with today
    filled['today_day'] = String(today.getDate());
    filled['today_month'] = meses[today.getMonth()];
    filled['today_year'] = String(today.getFullYear());

    if (selectedContract) {
      const tenant = people.find(p => p.id === selectedContract.tenantId);
      const property = properties.find(p => p.id === selectedContract.propertyId);
      const guarantor = people.find(p => p.type === 'Garante');
      const owner = people.find(p => p.type === 'Propietario');

      if (tenant)    filled['tenant_name'] = tenant.fullName;
      if (guarantor) filled['guarantor_name'] = guarantor.fullName;
      if (owner)     filled['owner_name'] = owner.fullName;
      if (property)  filled['property_address'] = `${property.address}${property.unit ? ', ' + property.unit : ''}`;

      // Contract dates
      if (selectedContract.startDate) {
        const { dia, mes, anio } = formatDateParts(selectedContract.startDate);
        filled['start_date'] = `${dia} de ${mes} de ${anio}`;
      }
      if (selectedContract.endDate) {
        const { dia, mes, anio } = formatDateParts(selectedContract.endDate);
        filled['end_date'] = `${dia} de ${mes} de ${anio}`;
      }

      // Rent
      const rent = selectedContract.baseRentAmount || 0;
      filled['rent_number'] = rent.toLocaleString('es-AR');
      filled['rent_words'] = numberToWords(rent);

      // Deposit
      const deposit = selectedContract.depositAmount || 0;
      filled['deposit_number'] = deposit.toLocaleString('es-AR');
      filled['deposit_words'] = numberToWords(deposit);

      // Duration
      if (selectedContract.startDate && selectedContract.endDate) {
        const start = new Date(selectedContract.startDate);
        const end = new Date(selectedContract.endDate);
        const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        filled['duration_label'] = monthsToLabel(months);
      }

      // Adjustment mechanism
      const mech = selectedContract.adjustmentMechanism;
      if (mech === 'IPC') filled['adjustment_label'] = 'Índice de Precios al Consumidor (IPC) publicado por el INDEC';
      else if (mech === 'ICL') filled['adjustment_label'] = 'Índice para Contratos de Locación (ICL) publicado por el BCRA';
      else if (mech) filled['adjustment_label'] = mech;
    }

    // Apply auto-fills to fieldValues for current template
    const newValues: Record<string, string> = { ...fieldValues };
    for (const variable of template.variables) {
      if (variable.autoFill && filled[variable.autoFill]) {
        newValues[variable.key] = filled[variable.autoFill];
      }
    }
    setFieldValues(newValues);
    setAutoFilled(true);
    toast({ title: 'Campos completados', description: 'Revisá los datos antes de descargar.' });
  };

  // ─── Generate & download ────────────────────────────────────────────────────
  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Build the variables map: placeholder text → value
      const vars: Record<string, string> = {};
      for (const variable of template.variables) {
        const val = fieldValues[variable.key] ?? '';
        vars[variable.key] = val;
      }

      const today = new Date();
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      // Always replace date markers with today if not already set
      if (!vars['Día']) vars['Día'] = String(today.getDate());
      if (!vars['Mes']) vars['Mes'] = meses[today.getMonth()];
      if (!vars['Año']) vars['Año'] = String(today.getFullYear());

      const tenantSlug = fieldValues['NOMBRE COMPLETO DEL LOCATARIO']?.split(' ')[0] ?? 'Contrato';
      const outputName = `${template.label} - ${tenantSlug} ${today.getFullYear()}.docx`;

      await fillAndDownloadDocx(template.filename, vars, outputName);
      toast({ title: 'Descarga iniciada', description: `${outputName} está listo para abrir en Word.` });
    } catch (err: any) {
      toast({ title: 'Error al generar', description: err?.message ?? 'No se pudo generar el documento.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const filledCount = template.variables.filter(v => fieldValues[v.key]?.trim()).length;
  const totalCount = template.variables.length;
  const allFilled = filledCount === totalCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Generador de Contratos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Completá los datos y descargá el contrato en Word listo para imprimir y firmar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: Template selector + data ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Template selector */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase text-muted-foreground tracking-wide">Tipo de documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Tabs defaultValue="contratos">
                <TabsList className="w-full bg-muted/40">
                  <TabsTrigger value="contratos" className="flex-1 text-xs font-bold">Contratos</TabsTrigger>
                  <TabsTrigger value="anexos" className="flex-1 text-xs font-bold">Anexos</TabsTrigger>
                </TabsList>
                <TabsContent value="contratos" className="space-y-2 mt-3">
                  {contratos.map(t => {
                    const Icon = t.icon;
                    const selected = selectedTemplateId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplateId(t.id); setFieldValues({}); setAutoFilled(false); }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("p-1.5 rounded-lg mt-0.5", selected ? "bg-primary/10" : "bg-muted")}>
                            <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-black leading-tight", selected ? "text-primary" : "text-foreground")}>{t.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                          </div>
                          {selected && <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </TabsContent>
                <TabsContent value="anexos" className="space-y-2 mt-3">
                  {anexos.map(t => {
                    const Icon = t.icon;
                    const selected = selectedTemplateId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplateId(t.id); setFieldValues({}); setAutoFilled(false); }}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all",
                          selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("p-1.5 rounded-lg mt-0.5", selected ? "bg-primary/10" : "bg-muted")}>
                            <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-black leading-tight", selected ? "text-primary" : "text-foreground")}>{t.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                          </div>
                          {selected && <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Link to existing contract */}
          {contracts.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase text-muted-foreground tracking-wide">Auto-completar desde contrato</CardTitle>
                <CardDescription className="text-[11px]">Seleccioná un contrato y los campos se llenan automáticamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Seleccionar contrato…" /></SelectTrigger>
                  <SelectContent>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.tenantName} — {c.propertyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full gap-2 font-bold bg-primary/90 hover:bg-primary"
                  onClick={handleAutoFill}
                  size="sm"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Auto-completar campos
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Form + Download ── */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {template.label}
                </CardTitle>
                <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
              </div>
              {/* Progress badge */}
              <Badge variant={allFilled ? 'default' : 'secondary'} className={cn("text-xs shrink-0", allFilled ? "bg-green-600" : "")}>
                {filledCount}/{totalCount} campos
              </Badge>
            </CardHeader>
            <CardContent>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-1.5 mb-5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {template.variables.map((variable) => {
                  const val = fieldValues[variable.key] ?? '';
                  const filled = val.trim().length > 0;
                  return (
                    <div key={variable.key} className="space-y-1.5">
                      <Label className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                        {filled
                          ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                          : <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                        }
                        {variable.label}
                      </Label>
                      {variable.type === 'select' ? (
                        <Select value={val} onValueChange={v => setFieldValues(prev => ({ ...prev, [variable.key]: v }))}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Seleccioná…" />
                          </SelectTrigger>
                          <SelectContent>
                            {variable.options?.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-9 text-xs"
                          placeholder={variable.hint ?? `Ej: ${variable.label}…`}
                          value={val}
                          onChange={e => setFieldValues(prev => ({ ...prev, [variable.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <Separator className="my-6" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Descargar como Word (.docx)</p>
                  <p className="text-[11px] text-muted-foreground">El archivo se abre con Microsoft Word o Google Docs. Podés imprimirlo o enviarlo para firma.</p>
                </div>
                <Button
                  className="gap-2 font-black bg-primary hover:bg-primary/90 shrink-0 px-6"
                  onClick={handleDownload}
                  disabled={isGenerating || filledCount === 0}
                >
                  {isGenerating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                    : <><Download className="h-4 w-4" /> Descargar Contrato</>}
                </Button>
              </div>

              {!allFilled && filledCount > 0 && (
                <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Quedan {totalCount - filledCount} campo(s) sin completar. El documento se generará con espacios en blanco en esos lugares.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
