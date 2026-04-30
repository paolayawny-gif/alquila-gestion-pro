
"use client";

import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, LineChart, Save, Calendar, Info, Upload,
  RefreshCw, Loader2, TrendingUp, FileSpreadsheet, Search,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndexRecord, AdjustmentMechanism } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';
import { fetchCerFromBcra } from '@/ai/flows/fetch-cer-bcra-action';
import * as XLSX from 'xlsx';

interface IndexRecordsViewProps {
  records: IndexRecord[];
  userId?: string;
}

const APP_ID = 'alquilagestion-pro';
const PAGE_SIZE = 50;

export function IndexRecordsView({ records, userId }: IndexRecordsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { canWrite, canDelete } = useOrgPermissions();
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  // ── Monthly form state ──
  const [formData, setFormData] = useState<Partial<IndexRecord>>({
    month: new Date().toISOString().slice(0, 7),
    type: 'ICL',
    value: 0,
  });

  // ── CER manual entry state ──
  const [cerDate, setCerDate] = useState(new Date().toISOString().slice(0, 10));
  const [cerValue, setCerValue] = useState('');

  // ── BCRA fetch state ──
  const [bcraDesde, setBcraDesde] = useState('');
  const [bcraHasta, setBcraHasta] = useState(new Date().toISOString().slice(0, 10));
  const [isFetchingBcra, setIsFetchingBcra] = useState(false);
  const [isImportingXlsx, setIsImportingXlsx] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; skipped: number } | null>(null);

  // ── CER table pagination / search ──
  const [cerSearch, setCerSearch] = useState('');
  const [cerPage, setCerPage] = useState(0);

  // ── Split records ──
  const monthlyRecords = useMemo(
    () => [...records].filter(r => r.type !== 'CER').sort((a, b) => b.month.localeCompare(a.month)),
    [records]
  );
  const cerRecords = useMemo(
    () => [...records].filter(r => r.type === 'CER').sort((a, b) => b.month.localeCompare(a.month)),
    [records]
  );
  const filteredCer = useMemo(() => {
    if (!cerSearch) return cerRecords;
    return cerRecords.filter(r => r.month.includes(cerSearch));
  }, [cerRecords, cerSearch]);
  const cerPageCount = Math.ceil(filteredCer.length / PAGE_SIZE);
  const cerPageItems = filteredCer.slice(cerPage * PAGE_SIZE, (cerPage + 1) * PAGE_SIZE);

  const latestCer = cerRecords[0];

  // ── Helpers ──
  async function batchSaveCer(points: { date: string; value: number }[]) {
    if (!db || !userId) throw new Error('Sin conexión');
    const CHUNK = 400; // Firestore writeBatch limit is 500
    let saved = 0;
    let skipped = 0;
    const existing = new Set(cerRecords.map(r => r.month));

    for (let i = 0; i < points.length; i += CHUNK) {
      const batch = writeBatch(db);
      const chunk = points.slice(i, i + CHUNK);
      for (const p of chunk) {
        if (!p.date || isNaN(p.value)) { skipped++; continue; }
        const id = `CER_${p.date}`;
        if (existing.has(p.date)) { skipped++; continue; }
        const ref = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'indices'), id);
        batch.set(ref, { id, month: p.date, type: 'CER', value: p.value });
        saved++;
      }
      await batch.commit();
    }
    return { ok: saved, skipped };
  }

  // ── Monthly handlers ──
  const handleSaveMonthly = () => {
    if (!formData.month || !formData.value || !userId || !db) {
      toast({ title: 'Error', description: 'Complete todos los campos.', variant: 'destructive' });
      return;
    }
    const docId = `${formData.type}_${formData.month}`;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'indices', docId);
    setDocumentNonBlocking(docRef, { id: docId, month: formData.month, type: formData.type, value: formData.value }, { merge: true });
    toast({ title: 'Índice Guardado', description: `${formData.type} para ${formData.month}.` });
  };

  // ── CER manual handler ──
  const handleSaveCerManual = () => {
    if (!cerDate || !cerValue || !userId || !db) {
      toast({ title: 'Error', description: 'Ingresá fecha y valor.', variant: 'destructive' });
      return;
    }
    const val = parseFloat(cerValue.replace(',', '.'));
    if (isNaN(val)) { toast({ title: 'Error', description: 'Valor inválido.', variant: 'destructive' }); return; }
    const id = `CER_${cerDate}`;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'indices', id);
    setDocumentNonBlocking(docRef, { id, month: cerDate, type: 'CER', value: val }, { merge: true });
    toast({ title: 'CER guardado', description: `${cerDate} → ${val}` });
    setCerValue('');
  };

  // ── BCRA API handler ──
  const handleFetchBcra = async () => {
    if (!bcraDesde || !bcraHasta) {
      toast({ title: 'Error', description: 'Seleccioná el rango de fechas.', variant: 'destructive' });
      return;
    }
    setIsFetchingBcra(true);
    setImportResult(null);
    try {
      const res = await fetchCerFromBcra(bcraDesde, bcraHasta);
      if (!res.ok) {
        toast({ title: 'Error BCRA', description: res.error, variant: 'destructive' });
        return;
      }
      const result = await batchSaveCer(res.data);
      setImportResult(result);
      toast({ title: 'Importación completa', description: `${result.ok} valores guardados, ${result.skipped} ya existentes.` });
    } catch (e: any) {
      toast({ title: 'Error inesperado', description: e.message ?? 'Error al importar desde BCRA.', variant: 'destructive' });
    } finally {
      setIsFetchingBcra(false);
    }
  };

  // ── Excel import handler ──
  const handleXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingXlsx(true);
    setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

      const points: { date: string; value: number }[] = [];
      for (const row of rows) {
        if (!row || row.length < 2) continue;
        const rawDate = String(row[0] ?? '').trim();
        const rawVal = String(row[1] ?? '').trim().replace(',', '.');
        // Accept DD/MM/YYYY, YYYY-MM-DD, or JS date serial
        let isoDate = '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          isoDate = rawDate;
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
          const [d, m, y] = rawDate.split('/');
          isoDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else {
          continue; // skip header or unrecognized
        }
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val > 0) points.push({ date: isoDate, value: val });
      }
      if (!points.length) {
        toast({ title: 'Sin datos', description: 'No se encontraron fechas/valores reconocibles en el archivo.', variant: 'destructive' });
        return;
      }
      const result = await batchSaveCer(points);
      setImportResult(result);
      toast({ title: 'Excel importado', description: `${result.ok} valores guardados, ${result.skipped} ya existentes.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message ?? 'No se pudo leer el archivo.', variant: 'destructive' });
    } finally {
      setIsImportingXlsx(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'indices', id);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-foreground">Índices Oficiales</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Cargá ICL, IPC y el CER diario del BCRA para calcular ajustes automáticamente.</p>
      </div>

      <Tabs defaultValue="cer">
        <TabsList className="mb-4">
          <TabsTrigger value="cer" className="gap-2">
            <TrendingUp className="h-4 w-4" /> CER Diario (BCRA)
            {cerRecords.length > 0 && <Badge className="ml-1 bg-primary text-white text-[9px] px-1.5 py-0">{cerRecords.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <LineChart className="h-4 w-4" /> Índices Mensuales (ICL / IPC)
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ CER TAB ═══════════════════ */}
        <TabsContent value="cer" className="space-y-4">

          {/* Status banner */}
          {latestCer ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-black text-green-800">CER actualizado — último valor: <span className="font-mono">{latestCer.value.toFixed(6)}</span></p>
                <p className="text-[11px] text-green-700">Fecha: {latestCer.month} · {cerRecords.length} registros en total</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">No hay datos CER cargados. Importá desde el BCRA o subí el Excel histórico.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── Import from BCRA ── */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" /> Importar desde BCRA
                </CardTitle>
                <CardDescription className="text-[11px]">Descarga directamente de la API oficial del BCRA (serie 3540).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black">Desde</Label>
                  <Input type="date" value={bcraDesde} onChange={e => setBcraDesde(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black">Hasta</Label>
                  <Input type="date" value={bcraHasta} onChange={e => setBcraHasta(e.target.value)} />
                </div>
                <Button className="w-full gap-2 font-bold" onClick={handleFetchBcra} disabled={isFetchingBcra || !canWrite}>
                  {isFetchingBcra ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Importar desde BCRA
                </Button>
                {importResult && (
                  <p className="text-[10px] text-green-700 font-bold text-center">
                    ✓ {importResult.ok} guardados · {importResult.skipped} ya existentes
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Import from Excel ── */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" /> Importar desde Excel
                </CardTitle>
                <CardDescription className="text-[11px]">Subí el archivo .xlsx descargado del BCRA. Columna A: fecha, Columna B: valor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleXlsxImport}
                />
                <div
                  onClick={() => !isImportingXlsx && xlsxInputRef.current?.click()}
                  className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
                >
                  {isImportingXlsx ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-primary mx-auto mb-2" />
                      <p className="text-xs font-bold text-primary">Clic para seleccionar Excel</p>
                      <p className="text-[10px] text-muted-foreground mt-1">.xlsx / .xls / .csv</p>
                    </>
                  )}
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-800 leading-tight">
                    <strong>Formato esperado:</strong> Columna A = fecha (DD/MM/AAAA o AAAA-MM-DD), Columna B = valor CER. Sin encabezado o con encabezado (se ignora automáticamente).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Manual single day entry ── */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Carga Manual
                </CardTitle>
                <CardDescription className="text-[11px]">Para agregar un valor puntual nuevo publicado por el BCRA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black">Fecha</Label>
                  <Input type="date" value={cerDate} onChange={e => setCerDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black">Valor CER</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 18.452341"
                    value={cerValue}
                    onChange={e => setCerValue(e.target.value)}
                  />
                </div>
                <Button className="w-full gap-2 font-bold" onClick={handleSaveCerManual} disabled={!canWrite}>
                  <Save className="h-4 w-4" /> Guardar Valor CER
                </Button>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-800 leading-tight">
                    El BCRA publica mensualmente los valores del día 16 al 15 del mes siguiente. Podés copiar el valor directamente desde <strong>bcra.gob.ar → Serie 3540</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── CER History Table ── */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Historial CER Cargado
                </CardTitle>
                <CardDescription className="text-[11px]">{cerRecords.length} registros · Los más recientes primero.</CardDescription>
              </div>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Filtrar por fecha..."
                  value={cerSearch}
                  onChange={e => { setCerSearch(e.target.value); setCerPage(0); }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-black text-[11px]">Fecha</TableHead>
                    <TableHead className="text-right font-black text-[11px]">Valor CER</TableHead>
                    <TableHead className="text-right font-black text-[11px] w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cerPageItems.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-bold">{r.month}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-primary font-bold">{r.value.toFixed(6)}</TableCell>
                      <TableCell className="text-right">
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cerPageItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic text-sm">
                        {cerSearch ? 'Sin resultados para ese filtro.' : 'No hay datos CER cargados aún.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {cerPageCount > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                  <span>Página {cerPage + 1} de {cerPageCount} · {filteredCer.length} registros</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={cerPage === 0} onClick={() => setCerPage(p => p - 1)}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={cerPage >= cerPageCount - 1} onClick={() => setCerPage(p => p + 1)}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ MONTHLY TAB ═══════════════════ */}
        <TabsContent value="monthly">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-black">
                  <Plus className="h-4 w-4 text-primary" /> Cargar Nuevo Dato
                </CardTitle>
                <CardDescription className="text-[11px]">Ingresá el valor oficial del índice para el mes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Índice</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ICL">ICL (Índice Contratos Locación)</SelectItem>
                      <SelectItem value="IPC">IPC (Índice Precios Consumidor)</SelectItem>
                      <SelectItem value="CasaPropia">Casa Propia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Mes / Año</Label>
                  <Input type="month" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase">Variación del período (%)</Label>
                  <Input type="number" step="0.01" placeholder="Ej: 14.52" value={formData.value || ''} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} />
                </div>
                <Button className="w-full gap-2 font-bold" onClick={handleSaveMonthly} disabled={!canWrite}>
                  <Save className="h-4 w-4" /> Guardar Registro
                </Button>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-800 leading-tight">
                    Para ICL: publicado mensualmente por el BCRA. Para IPC: publicado por INDEC. Usá el valor acumulado al inicio de cada mes.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-black">
                  <LineChart className="h-4 w-4 text-primary" /> Historial de Índices Mensuales
                </CardTitle>
                <CardDescription className="text-[11px]">Estos datos se usan para calcular aumentos de alquiler automáticamente.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-black text-[11px]">Mes</TableHead>
                      <TableHead className="font-black text-[11px]">Tipo</TableHead>
                      <TableHead className="text-right font-black text-[11px]">Variación (%)</TableHead>
                      <TableHead className="text-right font-black text-[11px] w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRecords.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-xs flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" /> {r.month}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-primary text-primary text-[10px]">{r.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-primary">{r.value.toFixed(4)}%</TableCell>
                        <TableCell className="text-right">
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {monthlyRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-sm">
                          No hay registros cargados. Ingresá los datos del BCRA o INDEC.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
