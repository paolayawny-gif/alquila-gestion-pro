'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldCheck, DollarSign, TrendingUp, TrendingDown, Plus, Building2,
  ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, CheckCircle2,
  Clock, Info, Download, PiggyBank
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, Person, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useOrgPermissions } from '@/contexts/org-permissions-context';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';

interface DepositsViewProps {
  contracts: Contract[];
  people: Person[];
  properties: Property[];
  userId?: string;
}

interface DepositMovement {
  id: string;
  contractId: string;
  tenantName: string;
  propertyName: string;
  type: 'Recibido' | 'Devuelto' | 'Ajuste' | 'Retención parcial';
  amount: number;
  currency: string;
  exchangeRate: number;
  usdEquivalent: number;
  date: string;
  notes?: string;
  ownerId: string;
}

export function DepositsView({ contracts, people, properties, userId }: DepositsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { canWrite } = useOrgPermissions();

  const [exchangeRate, setExchangeRate] = useState(1200); // ARS/USD
  const [showMovDialog, setShowMovDialog] = useState(false);
  const [movContractId, setMovContractId] = useState('');
  const [movType, setMovType] = useState<'Recibido' | 'Devuelto' | 'Ajuste' | 'Retención parcial'>('Recibido');
  const [movAmount, setMovAmount] = useState('');
  const [movNotes, setMovNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load movements from Firestore
  const movQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'depositos'));
  }, [db, user]);
  const { data: movData } = useCollection<DepositMovement>(movQuery);
  const movements: DepositMovement[] = movData || [];

  // Deposits summary from contracts
  const depositContracts = useMemo(() =>
    contracts.filter(c => c.depositAmount > 0 && (c.status === 'Vigente' || c.status === 'Próximo a Vencer')),
    [contracts]
  );

  const totals = useMemo(() => {
    const byId: Record<string, number> = {};
    movements.forEach(m => {
      if (!byId[m.contractId]) byId[m.contractId] = 0;
      if (m.type === 'Recibido' || m.type === 'Ajuste') byId[m.contractId] += m.amount;
      else if (m.type === 'Devuelto' || m.type === 'Retención parcial') byId[m.contractId] -= m.amount;
    });

    let totalArs = 0;
    let totalUsd = 0;
    depositContracts.forEach(c => {
      const effectiveAmount = byId[c.id] !== undefined ? byId[c.id] : c.depositAmount;
      const amountInArs = c.depositCurrency === 'USD'
        ? effectiveAmount * exchangeRate
        : effectiveAmount;
      totalArs += amountInArs;
      totalUsd += amountInArs / exchangeRate;
    });

    return { totalArs, totalUsd };
  }, [depositContracts, movements, exchangeRate]);

  const handleSaveMovement = async () => {
    if (!db || !user || !movContractId || !movAmount) {
      toast({ title: 'Completá todos los campos', variant: 'destructive' }); return;
    }
    setIsSaving(true);
    const contract = contracts.find(c => c.id === movContractId);
    const amount = parseFloat(movAmount.replace(/\./g, '').replace(',', '.'));
    const id = `dep_${Date.now()}`;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'depositos'), id);
    setDocumentNonBlocking(ref, {
      id,
      contractId: movContractId,
      tenantName: contract?.tenantName ?? '',
      propertyName: contract?.propertyName ?? '',
      type: movType,
      amount,
      currency: contract?.depositCurrency ?? 'ARS',
      exchangeRate,
      usdEquivalent: amount / exchangeRate,
      date: new Date().toISOString(),
      notes: movNotes,
      ownerId: user.uid,
    } as DepositMovement, {});
    toast({ title: 'Movimiento registrado ✓', description: `${movType} de ${contract?.depositCurrency ?? 'ARS'} ${amount.toLocaleString('es-AR')} registrado correctamente.` });
    setMovContractId(''); setMovAmount(''); setMovNotes(''); setMovType('Recibido');
    setShowMovDialog(false); setIsSaving(false);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Contrato', 'Inquilino', 'Tipo', 'Monto', 'Moneda', 'T/C', 'USD Equiv.', 'Fecha', 'Notas'],
      ...movements.map(m => [
        m.propertyName, m.tenantName, m.type,
        m.amount.toLocaleString('es-AR'), m.currency,
        m.exchangeRate.toString(),
        m.usdEquivalent.toFixed(2),
        new Date(m.date).toLocaleDateString('es-AR'), m.notes ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `depositos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: 'Exportado', description: 'Movimientos de depósitos descargados.' });
  };

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <PiggyBank className="h-16 w-16 text-muted-foreground opacity-20" />
        <h3 className="text-lg font-bold text-foreground">Sin contratos cargados</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Los depósitos de garantía de tus contratos aparecerán acá.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" /> Garantías y Depósitos
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registrá y seguí los depósitos de garantía de cada contrato, con resguardo de valor en USD.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 font-bold h-9" onClick={handleExportCSV}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          {canWrite && (
            <Button className="gap-2 font-bold h-9 bg-primary" onClick={() => setShowMovDialog(true)}>
              <Plus className="h-4 w-4" /> Registrar movimiento
            </Button>
          )}
        </div>
      </div>

      {/* Tipo de cambio + KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* T/C input */}
        <Card className="border-none shadow-sm bg-white sm:col-span-1">
          <CardContent className="p-4 space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Tipo de cambio</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-muted-foreground">ARS/USD</span>
              <Input
                type="number"
                className="h-8 text-sm font-black flex-1"
                value={exchangeRate}
                onChange={e => setExchangeRate(Number(e.target.value))}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Ingresá el tipo de cambio actual para ver el equivalente en USD.</p>
          </CardContent>
        </Card>

        {/* Total en ARS */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase font-black text-white/70">Total Depósitos (ARS)</p>
            <p className="text-2xl font-black mt-1">$ {Math.round(totals.totalArs).toLocaleString('es-AR')}</p>
            <p className="text-[10px] text-white/70 mt-1">{depositContracts.length} contrato(s) con depósito</p>
          </CardContent>
        </Card>

        {/* Equivalente USD */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase font-black text-muted-foreground">Equivalente en USD</p>
            <p className="text-2xl font-black mt-1 text-green-600">
              U$D {totals.totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Al T/C: ${exchangeRate.toLocaleString('es-AR')}</p>
          </CardContent>
        </Card>

        {/* Movimientos */}
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase font-black text-muted-foreground">Movimientos</p>
            <p className="text-2xl font-black mt-1">{movements.length}</p>
            <div className="flex gap-2 mt-1">
              <p className="text-[10px] text-green-600 font-bold">
                ↑ {movements.filter(m => m.type === 'Recibido').length} recibidos
              </p>
              <p className="text-[10px] text-red-500 font-bold">
                ↓ {movements.filter(m => m.type === 'Devuelto').length} devueltos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Depósitos por contrato */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Depósitos por Contrato
            </CardTitle>
            <CardDescription className="text-xs">Valor registrado de cada depósito de garantía.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {depositContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 italic">
                Ningún contrato activo tiene depósito registrado.
              </p>
            ) : depositContracts.map(c => {
              const movForContract = movements.filter(m => m.contractId === c.id);
              const receivedAmt = movForContract
                .filter(m => m.type === 'Recibido' || m.type === 'Ajuste')
                .reduce((s, m) => s + m.amount, 0);
              const returnedAmt = movForContract
                .filter(m => m.type === 'Devuelto' || m.type === 'Retención parcial')
                .reduce((s, m) => s + m.amount, 0);
              const currentAmt = movForContract.length > 0 ? receivedAmt - returnedAmt : c.depositAmount;
              const inUsd = (c.depositCurrency === 'USD' ? currentAmt : currentAmt / exchangeRate);
              const contractDeposit = c.depositAmount;
              const pctChange = contractDeposit > 0
                ? ((currentAmt - contractDeposit) / contractDeposit) * 100
                : 0;

              return (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{c.propertyName || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">{c.tenantName || '—'}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Depósito registrado</p>
                        <p className="text-xs font-black">{c.depositCurrency} {currentAmt.toLocaleString('es-AR')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">≈ USD</p>
                        <p className="text-xs font-black text-green-600">{inUsd.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                      {movForContract.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          {pctChange >= 0
                            ? <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                            : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                          <p className={cn("text-[10px] font-black", pctChange >= 0 ? "text-green-600" : "text-red-500")}>
                            {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] font-bold shrink-0",
                    c.status === 'Vigente' ? "text-green-700 border-green-200" : "text-amber-700 border-amber-200"
                  )}>{c.status}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> Actividad Reciente
            </CardTitle>
            <CardDescription className="text-xs">Últimos movimientos registrados de depósitos.</CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
                <p className="text-xs text-muted-foreground">Usá el botón "Registrar movimiento" para cargar depósitos recibidos, devueltos o ajustados.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...movements]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 8)
                  .map(m => {
                    const isPositive = m.type === 'Recibido' || m.type === 'Ajuste';
                    return (
                      <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          isPositive ? "bg-green-100" : "bg-red-50"
                        )}>
                          {isPositive
                            ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                            : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{m.type}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{m.propertyName} · {m.tenantName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-xs font-black", isPositive ? "text-green-600" : "text-red-500")}>
                            {isPositive ? '+' : '-'}{m.currency} {m.amount.toLocaleString('es-AR')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            ≈ U$D {m.usdEquivalent.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info sobre resguardo de valor */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">¿Cómo funciona el resguardo de valor?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ingresás el tipo de cambio actual para ver el equivalente en dólares de cada depósito.
            Esto te permite monitorear si los depósitos en pesos mantienen su poder adquisitivo.
            Cuando recibís o devolvés un depósito, registrá el movimiento con el T/C del momento
            para tener un historial preciso. La información se guarda en tu cuenta y puede exportarse como CSV.
          </p>
        </div>
      </div>

      {/* Dialog: Registrar movimiento */}
      <Dialog open={showMovDialog} onOpenChange={setShowMovDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Registrar movimiento de depósito
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registrá el ingreso, devolución o ajuste de un depósito de garantía.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Contrato</Label>
              <Select value={movContractId} onValueChange={setMovContractId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccioná un contrato…" /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-sm">
                      {c.propertyName || '—'} · {c.tenantName || '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tipo</Label>
                <Select value={movType} onValueChange={v => setMovType(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recibido">↑ Recibido</SelectItem>
                    <SelectItem value="Devuelto">↓ Devuelto</SelectItem>
                    <SelectItem value="Ajuste">↑ Ajuste</SelectItem>
                    <SelectItem value="Retención parcial">↓ Retención parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Monto</Label>
                <Input className="h-9 text-sm font-bold" placeholder="Ej: 150000" value={movAmount} onChange={e => setMovAmount(e.target.value)} />
              </div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between text-xs">
              <span className="text-muted-foreground">T/C aplicado:</span>
              <span className="font-black">ARS {exchangeRate.toLocaleString('es-AR')} = U$D 1</span>
              <span className="font-black text-green-600">
                ≈ U$D {movAmount ? (parseFloat(movAmount.replace(/\./g, '').replace(',', '.') || '0') / exchangeRate).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 0}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notas (opcional)</Label>
              <Textarea className="text-sm h-16 resize-none" placeholder="Ej: Depósito de dos meses al inicio del contrato…" value={movNotes} onChange={e => setMovNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMovDialog(false)} disabled={isSaving}>Cancelar</Button>
            <Button className="gap-2 font-bold bg-primary" onClick={handleSaveMovement} disabled={isSaving || !movContractId || !movAmount || !canWrite}>
              <CheckCircle2 className="h-4 w-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
