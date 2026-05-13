'use client';
/**
 * Panel de análisis de riesgo legal de contratos.
 * Muestra hallazgos con severidad visual, score y recomendaciones
 * basados en Ley 27.551, DNU 70/2023 y CCyCN argentino.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Info,
  Scale, Loader2, RefreshCw, ChevronDown, ChevronRight,
  FileSearch, GitCompareArrows, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeContractRisks, type AnalyzeContractRisksOutput, type RiskFinding } from '@/ai/flows/analyze-contract-risks-flow';
import { verifyContractConsistency, type VerifyContractConsistencyOutput } from '@/ai/flows/verify-contract-consistency-flow';
import { compareMarketStandard, type CompareMarketStandardOutput } from '@/ai/flows/compare-market-standard-flow';
import { useToast } from '@/hooks/use-toast';
import { useAIConfig } from '@/hooks/use-ai-config';
import { Sparkles } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CACHE — evita re-llamar a Gemini si el mismo contrato ya fue analizado
// ─────────────────────────────────────────────────────────────────────────────

function contractKey(text: string, suffix = '') {
  return `${text.length}:${text.slice(0, 120)}${suffix}`;
}

const riskCache = new Map<string, AnalyzeContractRisksOutput>();
const consistencyCache = new Map<string, VerifyContractConsistencyOutput>();
const marketCache = new Map<string, CompareMarketStandardOutput>();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ContractRiskPanelProps {
  contractText: string;
  contractType?: 'vivienda' | 'comercial' | 'otro';
  extractedData?: {
    baseRentAmount?: number;
    currency?: string;
    adjustmentFrequencyMonths?: number;
    adjustmentMechanism?: string;
    tenantName?: string;
    propertyAddress?: string;
    startDate?: string;
    endDate?: string;
  };
  className?: string;
}

type Perspective = 'neutral' | 'locador' | 'locatario' | 'garante';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ severidad }: { severidad: RiskFinding['severidad'] }) {
  if (severidad === 'critico') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        <AlertTriangle className="h-3 w-3" /> Crítico
      </span>
    );
  }
  if (severidad === 'importante') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        <Info className="h-3 w-3" /> Importante
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
      <CheckCircle2 className="h-3 w-3" /> Aceptable
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-amber-500' : 'text-red-600';
  const label = score >= 75 ? 'Conforme' : score >= 50 ? 'Con observaciones' : 'Requiere revisión';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('text-4xl font-bold tabular-nums', color)}>{score}</div>
      <div className="text-xs text-muted-foreground">/100</div>
      <div className={cn('text-xs font-medium', color)}>{label}</div>
    </div>
  );
}

function FindingRow({ finding }: { finding: RiskFinding }) {
  const [open, setOpen] = useState(finding.severidad === 'critico');
  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2 transition-colors',
      finding.severidad === 'critico' ? 'border-red-200 bg-red-50' :
      finding.severidad === 'importante' ? 'border-amber-200 bg-amber-50' :
      'border-green-200 bg-green-50'
    )}>
      <button
        className="w-full flex items-start justify-between gap-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <SeverityBadge severidad={finding.severidad} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{finding.titulo}</p>
            <p className="text-xs text-muted-foreground">{finding.categoria}</p>
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" /> :
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="space-y-2 pt-1 pl-1">
          <p className="text-sm text-gray-700">{finding.descripcion}</p>
          {finding.fundamentoLegal && (
            <div className="flex items-start gap-1.5">
              <Scale className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">{finding.fundamentoLegal}</p>
            </div>
          )}
          {finding.recomendacion && (
            <div className="rounded bg-white/60 p-2 border border-current/10">
              <p className="text-xs font-medium text-gray-600 mb-0.5">Recomendación:</p>
              <p className="text-xs text-gray-800">{finding.recomendacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvalBadge({ eval: e }: { eval: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    favorable: { label: 'Favorable', cls: 'bg-green-100 text-green-700 border-green-200' },
    muy_favorable: { label: 'Muy favorable', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    neutro: { label: 'Neutro', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    desfavorable: { label: 'Desfavorable', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    muy_desfavorable: { label: 'Muy desfavorable', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[e] ?? map.neutro;
  return <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', cfg.cls)}>{cfg.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ContractRiskPanel({
  contractText,
  contractType = 'vivienda',
  extractedData,
  className,
}: ContractRiskPanelProps) {
  const { toast } = useToast();
  const { hasProKey, proKey } = useAIConfig();

  const [perspective, setPerspective] = useState<Perspective>('neutral');
  const [activeTab, setActiveTab] = useState('riesgo');
  const [proModeOn, setProModeOn] = useState(false);

  const effectiveApiKey = proModeOn && proKey ? proKey : undefined;

  const [riskLoading, setRiskLoading] = useState(false);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);

  const [riskData, setRiskData] = useState<AnalyzeContractRisksOutput | null>(null);
  const [consistencyData, setConsistencyData] = useState<VerifyContractConsistencyOutput | null>(null);
  const [marketData, setMarketData] = useState<CompareMarketStandardOutput | null>(null);

  async function runRiskAnalysis(force = false) {
    const key = contractKey(contractText, `:${perspective}:${proModeOn}`);
    if (!force && riskCache.has(key)) { setRiskData(riskCache.get(key)!); return; }
    setRiskLoading(true);
    const result = await analyzeContractRisks({ contractText, contractType, perspective }, effectiveApiKey);
    setRiskLoading(false);
    if (!result.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    riskCache.set(key, result.data);
    setRiskData(result.data);
  }

  async function runConsistencyCheck(force = false) {
    const key = contractKey(contractText, `:${proModeOn}`);
    if (!force && consistencyCache.has(key)) { setConsistencyData(consistencyCache.get(key)!); return; }
    setConsistencyLoading(true);
    const result = await verifyContractConsistency({ contractText, contractType, extractedData }, effectiveApiKey);
    setConsistencyLoading(false);
    if (!result.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    consistencyCache.set(key, result.data);
    setConsistencyData(result.data);
  }

  async function runMarketComparison(force = false) {
    const key = contractKey(contractText, `:${perspective}:${proModeOn}`);
    if (!force && marketCache.has(key)) { setMarketData(marketCache.get(key)!); return; }
    setMarketLoading(true);
    const result = await compareMarketStandard(
      {
        contractText,
        contractType,
        perspective: perspective === 'neutral' ? 'locatario' : (perspective as 'locador' | 'locatario' | 'garante'),
        currency: extractedData?.currency as 'ARS' | 'USD' | undefined,
        extractedRentAmount: extractedData?.baseRentAmount,
      },
      effectiveApiKey,
    );
    setMarketLoading(false);
    if (!result.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return; }
    marketCache.set(key, result.data);
    setMarketData(result.data);
  }

  const criticalCount = riskData?.hallazgos.filter(h => h.severidad === 'critico').length ?? 0;
  const importantCount = riskData?.hallazgos.filter(h => h.severidad === 'importante').length ?? 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Análisis Legal IA</CardTitle>
              <CardDescription className="text-xs">Ley 27.551 · DNU 70/2023 · CCyCN</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasProKey && (
              <button
                onClick={() => {
                  setProModeOn(v => !v);
                  setRiskData(null); setConsistencyData(null); setMarketData(null);
                }}
                title={proModeOn ? 'Usando gemini-2.5-pro (tu API key)' : 'Activar análisis Pro con gemini-2.5-pro'}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition-colors',
                  proModeOn
                    ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                    : 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50'
                )}
              >
                <Sparkles className="h-3 w-3" />
                Pro
              </button>
            )}
            <Select value={perspective} onValueChange={v => setPerspective(v as Perspective)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Perspectiva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="locador">Como Locador</SelectItem>
                <SelectItem value="locatario">Como Locatario</SelectItem>
                <SelectItem value="garante">Como Garante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="riesgo" className="text-xs gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Riesgo Legal
            </TabsTrigger>
            <TabsTrigger value="coherencia" className="text-xs gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" /> Coherencia
            </TabsTrigger>
            <TabsTrigger value="mercado" className="text-xs gap-1">
              <GitCompareArrows className="h-3.5 w-3.5" /> vs. Mercado
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: RIESGO LEGAL ── */}
          <TabsContent value="riesgo" className="space-y-4 mt-0">
            {!riskData ? (
              <div className="text-center py-8 space-y-3">
                <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">
                  Analizá el contrato para detectar cláusulas que violen la Ley 27.551, el DNU 70/2023 o el CCyCN.
                </p>
                <Button onClick={() => runRiskAnalysis()} disabled={riskLoading} size="sm">
                  {riskLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSearch className="h-4 w-4 mr-2" />}
                  Analizar riesgo legal
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score + resumen */}
                <div className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 border">
                  <ScoreRing score={riskData.puntajeLegal} />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-700 leading-relaxed">{riskData.resumenEjecutivo}</p>
                    <div className="flex gap-3 text-xs">
                      {criticalCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-3 w-3" /> {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {importantCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Info className="h-3 w-3" /> {importantCount} importante{importantCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Analizar riesgo" className="h-8 w-8 flex-shrink-0" onClick={() => runRiskAnalysis(true)} disabled={riskLoading}>
                    <RefreshCw className={cn('h-3.5 w-3.5', riskLoading && 'animate-spin')} />
                  </Button>
                </div>

                {/* Acciones urgentes */}
                {riskData.accionesUrgentes.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Acciones urgentes antes de firmar:
                    </p>
                    <ul className="space-y-1">
                      {riskData.accionesUrgentes.map((a, i) => (
                        <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                          <span className="mt-0.5">•</span>{a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cláusulas faltantes */}
                {riskData.clausulasAusentesCriticas.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-700">Cláusulas obligatorias ausentes:</p>
                    <ul className="space-y-0.5">
                      {riskData.clausulasAusentesCriticas.map((c, i) => (
                        <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                          <span>•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hallazgos */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Hallazgos ({riskData.hallazgos.length})
                  </p>
                  {riskData.hallazgos.map((h, i) => (
                    <FindingRow key={i} finding={h} />
                  ))}
                </div>

                {/* Cláusulas favorables */}
                {riskData.clausulasFavorables.length > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Cláusulas favorables detectadas:
                    </p>
                    <ul className="space-y-0.5">
                      {riskData.clausulasFavorables.map((c, i) => (
                        <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                          <span>•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: COHERENCIA ── */}
          <TabsContent value="coherencia" className="space-y-4 mt-0">
            {!consistencyData ? (
              <div className="text-center py-8 space-y-3">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">
                  Verificá que los montos, fechas, nombres y cláusulas sean coherentes en todo el documento.
                </p>
                <Button onClick={() => runConsistencyCheck()} disabled={consistencyLoading} size="sm">
                  {consistencyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                  Verificar coherencia
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumen */}
                <div className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  consistencyData.esCoherente ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                )}>
                  {consistencyData.esCoherente
                    ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {consistencyData.esCoherente ? 'Contrato coherente' : 'Se detectaron inconsistencias'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{consistencyData.resumen}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Verificar consistencia" className="h-8 w-8 flex-shrink-0" onClick={() => runConsistencyCheck(true)} disabled={consistencyLoading}>
                    <RefreshCw className={cn('h-3.5 w-3.5', consistencyLoading && 'animate-spin')} />
                  </Button>
                </div>

                {/* Verificaciones */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(consistencyData.datosVerificados).map(([key, ok]) => {
                    const labels: Record<string, string> = {
                      montosConsistentes: 'Montos consistentes',
                      fechasConsistentes: 'Fechas coherentes',
                      partesConsistentes: 'Partes correctas',
                      indiceConsistente: 'Índice consistente',
                    };
                    return (
                      <div key={key} className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border text-xs',
                        ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                      )}>
                        {ok ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />}
                        {labels[key] ?? key}
                      </div>
                    );
                  })}
                </div>

                {/* Recomendación firma */}
                <div className={cn(
                  'p-3 rounded-lg border text-sm font-medium flex items-center gap-2',
                  consistencyData.recomendacionFirma === 'apta_para_firma' ? 'bg-green-50 border-green-300 text-green-800' :
                  consistencyData.recomendacionFirma === 'revisar_antes_de_firmar' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                  'bg-red-50 border-red-300 text-red-800'
                )}>
                  {consistencyData.recomendacionFirma === 'apta_para_firma' && <ShieldCheck className="h-4 w-4" />}
                  {consistencyData.recomendacionFirma === 'revisar_antes_de_firmar' && <AlertTriangle className="h-4 w-4" />}
                  {consistencyData.recomendacionFirma === 'no_firmar' && <AlertTriangle className="h-4 w-4" />}
                  {{
                    apta_para_firma: 'Apta para firma',
                    revisar_antes_de_firmar: 'Revisar antes de firmar',
                    no_firmar: 'No firmar en este estado',
                  }[consistencyData.recomendacionFirma]}
                </div>

                {/* Inconsistencias */}
                {consistencyData.inconsistencias.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Inconsistencias ({consistencyData.inconsistencias.length})
                    </p>
                    {consistencyData.inconsistencias.map((inc, i) => (
                      <div key={i} className={cn(
                        'p-3 rounded-lg border space-y-1',
                        inc.gravedad === 'alta' ? 'border-red-200 bg-red-50' :
                        inc.gravedad === 'media' ? 'border-amber-200 bg-amber-50' :
                        'border-gray-200 bg-gray-50'
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-800">{inc.ubicacion}</p>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-xs font-medium',
                            inc.gravedad === 'alta' ? 'bg-red-200 text-red-800' :
                            inc.gravedad === 'media' ? 'bg-amber-200 text-amber-800' :
                            'bg-gray-200 text-gray-800'
                          )}>
                            {inc.gravedad}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700">{inc.descripcion}</p>
                        {inc.correccionSugerida && (
                          <p className="text-xs text-blue-700 italic">→ {inc.correccionSugerida}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: vs. MERCADO ── */}
          <TabsContent value="mercado" className="space-y-4 mt-0">
            {!marketData ? (
              <div className="text-center py-8 space-y-3">
                <GitCompareArrows className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">
                  Comparar las condiciones del contrato contra el estándar de mercado argentino 2024-2025.
                </p>
                <Button onClick={() => runMarketComparison()} disabled={marketLoading} size="sm">
                  {marketLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitCompareArrows className="h-4 w-4 mr-2" />}
                  Comparar con mercado
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dictamen + score */}
                <div className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 border">
                  <ScoreRing score={marketData.puntajeEquilibrio} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 leading-relaxed">{marketData.dictamenGeneral}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Comparar mercado" className="h-8 w-8 flex-shrink-0" onClick={() => runMarketComparison(true)} disabled={marketLoading}>
                    <RefreshCw className={cn('h-3.5 w-3.5', marketLoading && 'animate-spin')} />
                  </Button>
                </div>

                {/* Resumen por área */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(marketData.resumenPorArea).map(([area, eval_]) => (
                    <div key={area} className="flex items-center justify-between p-2 rounded border bg-white text-xs">
                      <span className="text-gray-600 capitalize">{area}</span>
                      <EvalBadge eval={eval_} />
                    </div>
                  ))}
                </div>

                {/* Alertas especiales */}
                {marketData.alertasEspeciales.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-700">Cláusulas inusuales en el mercado:</p>
                    {marketData.alertasEspeciales.map((a, i) => (
                      <p key={i} className="text-xs text-amber-800">• {a}</p>
                    ))}
                  </div>
                )}

                {/* Puntos de negociación */}
                {marketData.puntosNegociacion.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Puntos a negociar (prioridad):
                    </p>
                    {marketData.puntosNegociacion.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-blue-50 border border-blue-200 rounded p-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">{i + 1}.</span>{p}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabla de comparaciones */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comparación detallada</p>
                  {marketData.comparaciones.map((c, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-800">{c.campo}</p>
                        <EvalBadge eval={c.evaluacion} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5">En el contrato:</p>
                          <p className="text-gray-800 font-medium">{c.valorContrato}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">Estándar mercado:</p>
                          <p className="text-gray-800 font-medium">{c.estandarMercado}</p>
                        </div>
                      </div>
                      {c.brecha && <p className="text-xs text-gray-600 italic">{c.brecha}</p>}
                      {c.negociable && (
                        <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Negociable</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
