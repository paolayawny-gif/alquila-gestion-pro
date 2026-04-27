
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, DollarSign, Calculator, Download, Save, ChevronDown,
  ChevronUp, Home, Building2, Repeat, PieChart as PieChartIcon
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell
} from 'recharts';
import { cn } from '@/lib/utils';

const SCENARIOS = [
  { id: 'tradicional', label: 'Alquiler Tradicional', icon: Home },
  { id: 'temporal', label: 'Alquiler Temporal', icon: Building2 },
  { id: 'flipping', label: 'Flipping (Venta)', icon: Repeat },
];

const PIE_COLORS = ['#16a34a', '#f97316', '#94a3b8'];

export function ROISimulatorView() {
  const [purchasePrice, setPurchasePrice] = useState(150000);
  const [renovation, setRenovation] = useState(25000);
  const [monthlyRent, setMonthlyRent] = useState(1200);
  const [scenario, setScenario] = useState('tradicional');
  const [showExtras, setShowExtras] = useState(false);
  const [itp, setItp] = useState(10);
  const [notaria, setNotaria] = useState(1500);
  const [agency, setAgency] = useState(3000);

  const metrics = useMemo(() => {
    const extraCosts = showExtras ? (purchasePrice * itp / 100) + notaria + agency : purchasePrice * 0.1;
    const totalInvestment = purchasePrice + renovation + extraCosts;
    const annualRent = monthlyRent * 12;
    const annualExpenses = annualRent * 0.2;
    const netAnnualIncome = annualRent - annualExpenses;
    const grossYield = ((annualRent / totalInvestment) * 100);
    const netYield = ((netAnnualIncome / totalInvestment) * 100);
    const monthlyCashFlow = netAnnualIncome / 12;
    const breakevenYear = totalInvestment / netAnnualIncome;

    return { totalInvestment, grossYield, netYield, monthlyCashFlow, breakevenYear, netAnnualIncome, extraCosts };
  }, [purchasePrice, renovation, monthlyRent, itp, notaria, agency, showExtras]);

  const breakevenData = useMemo(() => {
    return Array.from({ length: 17 }, (_, i) => ({
      year: i,
      acumulado: i === 0 ? -metrics.totalInvestment : -metrics.totalInvestment + (metrics.netAnnualIncome * i),
    }));
  }, [metrics]);

  const pieData = [
    { name: 'Compra', value: purchasePrice },
    { name: 'Reforma', value: renovation },
    { name: 'Gastos', value: Math.round(metrics.extraCosts) },
  ];

  const yieldColor = metrics.grossYield >= 7 ? 'text-green-600' : metrics.grossYield >= 4 ? 'text-orange-500' : 'text-red-500';
  const yieldBg = metrics.grossYield >= 7 ? 'bg-primary' : metrics.grossYield >= 4 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Simulador de Rentabilidad</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Evalúa escenarios de inversión inmobiliaria con precisión.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 font-bold"><Download className="h-4 w-4" /> Exportar PDF</Button>
          <Button className="bg-primary text-white gap-2 font-bold"><Save className="h-4 w-4" /> Guardar Simulación</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Parameters */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" /> Parámetros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">PRECIO DE COMPRA ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" className="pl-9 font-bold" value={purchasePrice}
                  onChange={e => setPurchasePrice(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">REFORMA ESTIMADA ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground text-sm">🔧</span>
                <Input type="number" className="pl-9 font-bold" value={renovation}
                  onChange={e => setRenovation(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">RENTA MENSUAL PROYECTADA ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">💰</span>
                <Input type="number" className="pl-9 font-bold" value={monthlyRent}
                  onChange={e => setMonthlyRent(Number(e.target.value))} />
              </div>
            </div>

            <button
              onClick={() => setShowExtras(!showExtras)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-bold text-primary"
            >
              <span>Gastos Adicionales (ITP, Notaría...)</span>
              {showExtras ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showExtras && (
              <div className="space-y-3 p-3 bg-muted/20 rounded-xl">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">ITP (%)</Label>
                  <Input type="number" className="h-8 text-sm" value={itp} onChange={e => setItp(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Notaría ($)</Label>
                  <Input type="number" className="h-8 text-sm" value={notaria} onChange={e => setNotaria(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Agencia ($)</Label>
                  <Input type="number" className="h-8 text-sm" value={agency} onChange={e => setAgency(Number(e.target.value))} />
                </div>
              </div>
            )}

            <div className="pt-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground mb-2 block">Escenarios</Label>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                      scenario === s.id
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    <s.icon className="h-3 w-3" /> {s.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI + Charts */}
        <div className="xl:col-span-2 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            <Card className={cn("border-none shadow-sm text-white overflow-hidden", yieldBg)}>
              <CardContent className="p-4">
                <p className="text-[9px] uppercase font-black text-white/70 mb-1">RENTABILIDAD ANUAL BRUTA</p>
                <p className="text-3xl font-black">{metrics.grossYield.toFixed(1)}%</p>
                <p className="text-[10px] text-white/70 mt-1">+1.5% vs año anterior</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[9px] uppercase font-black text-muted-foreground mb-1">FLUJO DE CAJA MENSUAL</p>
                <p className="text-3xl font-black">${Math.round(metrics.monthlyCashFlow).toLocaleString('es-AR')}</p>
                <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(metrics.grossYield * 10, 100)}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[9px] uppercase font-black text-muted-foreground mb-1">INVERSIÓN TOTAL REQUERIDA</p>
                <p className="text-2xl font-black">${(metrics.totalInvestment / 1000).toFixed(1)}k</p>
                <p className="text-[10px] text-muted-foreground mt-1">Incluye impuestos y reforma</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black">Punto de Equilibrio</CardTitle>
                <p className="text-xs text-muted-foreground">Recuperación de la inversión inicial</p>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={breakevenData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} fontSize={10}
                        tick={{ fill: '#94a3b8' }} label={{ value: 'Año', position: 'insideBottomRight', fontSize: 10, fill: '#94a3b8', offset: -5 }} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }}
                        tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '11px' }}
                        formatter={(v: any) => [`$${Number(v).toLocaleString('es-AR')}`, 'Acumulado']}
                        labelFormatter={l => `Año ${l}`}
                      />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2"
                        label={{ value: 'Equilibrio', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                      <Line type="monotone" dataKey="acumulado" stroke="#16a34a" strokeWidth={2.5}
                        dot={false} activeDot={{ r: 4, fill: '#16a34a' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-1">
                  Punto de equilibrio: <strong className="text-primary">Año {Math.ceil(metrics.breakevenYear)}</strong>
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" /> Composición del Gasto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                        paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString('es-AR')}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center -mt-2 mb-3">
                  <p className="text-lg font-black">${Math.round(metrics.totalInvestment / 1000)}k</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="flex justify-center gap-4">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
