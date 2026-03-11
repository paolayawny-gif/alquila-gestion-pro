
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, LineChart, Save, Calendar, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndexRecord, AdjustmentMechanism } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';

interface IndexRecordsViewProps {
  records: IndexRecord[];
  userId?: string;
}

export function IndexRecordsView({ records, userId }: IndexRecordsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [formData, setFormData] = useState<Partial<IndexRecord>>({
    month: new Date().toISOString().slice(0, 7),
    type: 'ICL',
    value: 0
  });

  const handleSave = () => {
    if (!formData.month || !formData.value || !userId || !db) {
      toast({ title: "Error", description: "Complete todos los campos.", variant: "destructive" });
      return;
    }

    const docId = `${formData.type}_${formData.month}`;
    const docRef = doc(db, 'artifacts', 'alquilagestion-pro', 'users', userId, 'indices', docId);

    const recordData: IndexRecord = {
      id: docId,
      month: formData.month,
      type: formData.type as AdjustmentMechanism,
      value: formData.value
    };

    setDocumentNonBlocking(docRef, recordData, { merge: true });
    toast({ title: "Índice Guardado", description: `Registrado ${formData.type} para ${formData.month}.` });
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', 'alquilagestion-pro', 'users', userId, 'indices', id);
    deleteDocumentNonBlocking(docRef);
  };

  const sortedRecords = [...records].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Cargar Nuevo Dato
            </CardTitle>
            <CardDescription>Ingrese el valor oficial del índice para el mes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Índice</label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICL">ICL (Alquileres)</SelectItem>
                  <SelectItem value="IPC">IPC (Inflación)</SelectItem>
                  <SelectItem value="CasaPropia">Casa Propia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Mes / Año</label>
              <Input type="month" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase">Valor del Índice</label>
              <Input type="number" step="0.01" placeholder="Ej: 14.52" value={formData.value || ''} onChange={e => setFormData({...formData, value: parseFloat(e.target.value) || 0})} />
            </div>
            <Button className="w-full gap-2 font-bold" onClick={handleSave}>
              <Save className="h-4 w-4" /> Guardar Registro
            </Button>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="text-[10px] text-blue-800 leading-tight">
                <strong>Consejo:</strong> Use el valor del índice al primer día del mes para mayor precisión en el cálculo de variación.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Historial de Índices Cargados
            </CardTitle>
            <CardDescription>Estos datos se usarán para calcular los aumentos automáticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Mes</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {r.month}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary text-primary">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{r.value.toFixed(4)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                      No hay registros cargados. Cargue los datos de la web del BCRA o INDEC.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
