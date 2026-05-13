'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Brain, Zap, Sparkles, CheckCircle2, XCircle, BarChart2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIUsage } from '@/hooks/use-ai-usage';
import { FEATURE_LABELS, type AIFeature } from '@/lib/ai-usage-logger';

function formatDate(ts: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function ModelBadge({ model, isPro }: { model: string; isPro: boolean }) {
  if (isPro) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-violet-100 text-violet-700">
        <Sparkles className="h-2.5 w-2.5" /> Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
      <Zap className="h-2.5 w-2.5" /> Flash
    </span>
  );
}

export function AIUsagePanel() {
  const [days, setDays] = useState(30);
  const stats = useAIUsage(days);

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando estadísticas...</span>
      </div>
    );
  }

  const errorRate = stats.totalCalls > 0
    ? Math.round((stats.totalFailed / stats.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Período:</span>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
              days === d
                ? 'bg-foreground text-background border-foreground'
                : 'bg-white text-muted-foreground border-border hover:border-foreground/40'
            )}
          >
            {d === 7 ? 'Últimos 7 días' : d === 30 ? 'Últimos 30 días' : 'Últimos 90 días'}
          </button>
        ))}
      </div>

      {stats.totalCalls === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-12 text-center space-y-2">
            <Brain className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
            <p className="text-sm text-muted-foreground">
              No hay llamadas a la IA registradas en este período.
            </p>
            <p className="text-xs text-muted-foreground">
              El registro se activa a partir de ahora en cada uso de las funciones IA.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="pt-4 pb-3 space-y-0.5">
                <p className="text-2xl font-black tabular-nums">{stats.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Llamadas totales</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-violet-50 border border-violet-100">
              <CardContent className="pt-4 pb-3 space-y-0.5">
                <p className="text-2xl font-black tabular-nums text-violet-700">{stats.proCalls}</p>
                <p className="text-xs text-violet-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Con modelo Pro
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-blue-50 border border-blue-100">
              <CardContent className="pt-4 pb-3 space-y-0.5">
                <p className="text-2xl font-black tabular-nums text-blue-700">{stats.flashCalls}</p>
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Con modelo Flash
                </p>
              </CardContent>
            </Card>
            <Card className={cn('border-none shadow-sm', errorRate > 10 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100')}>
              <CardContent className="pt-4 pb-3 space-y-0.5">
                <p className={cn('text-2xl font-black tabular-nums', errorRate > 10 ? 'text-red-700' : 'text-green-700')}>
                  {errorRate}%
                </p>
                <p className={cn('text-xs flex items-center gap-1', errorRate > 10 ? 'text-red-600' : 'text-green-600')}>
                  {errorRate > 10 ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  Tasa de error
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="features">
            <TabsList className="h-8">
              <TabsTrigger value="features" className="text-xs gap-1">
                <BarChart2 className="h-3.5 w-3.5" /> Por feature
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs gap-1">
                <Clock className="h-3.5 w-3.5" /> Últimas llamadas
              </TabsTrigger>
            </TabsList>

            {/* Tab: por feature */}
            <TabsContent value="features" className="mt-4 space-y-2">
              {stats.byFeature.map(f => {
                const pct = Math.round((f.count / stats.totalCalls) * 100);
                return (
                  <div key={f.feature} className="bg-white rounded-lg border px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800">{f.label}</span>
                      <div className="flex items-center gap-2">
                        {f.proCalls > 0 && (
                          <span className="text-xs text-violet-600 font-medium">
                            {f.proCalls} Pro
                          </span>
                        )}
                        <span className="text-sm font-bold tabular-nums">{f.count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct}% del total</p>
                  </div>
                );
              })}
            </TabsContent>

            {/* Tab: últimas llamadas */}
            <TabsContent value="recent" className="mt-4">
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-0 divide-y">
                  {stats.recent.map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {FEATURE_LABELS[e.feature] ?? e.feature}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(e.ts)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <ModelBadge model={e.model} isPro={e.isPro} />
                        {e.ok
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          : <XCircle className="h-3.5 w-3.5 text-red-500" />
                        }
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
