
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  TrendingUp, 
  Calculator, 
  Download, 
  PieChart, 
  FileCheck, 
  CheckCircle2,
  Users2,
  Sparkles,
  Eye,
  FileText
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Property, Liquidation, RentalApplication, DocumentInfo } from '@/lib/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { query, collection } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';

interface OwnerPortalViewProps {
  properties: Property[];
  liquidations: Liquidation[];
}

const APP_ID = "alquilagestion-pro";

export function OwnerPortalView({ properties, liquidations }: OwnerPortalViewProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // El propietario necesita ver las solicitudes para sus propiedades
  // Nota: En un sistema real, el admin tiene el userId. Aquí buscamos todas las solicitudes vinculadas.
  // Pero para el prototipo, asumimos que el propietario ve las aprobadas para sus unidades.
  const solicitudesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Buscamos solicitudes en la colección global o vinculada al admin principal
    // Para simplificar el prototipo, filtramos de la colección cargada si estuviera disponible.
    return query(collection(db, 'artifacts', APP_ID, 'users', 'W1b1I6DKA7fEluL5gugUyKBuSvD3', 'solicitudes'));
  }, [db, user]);

  const { data: applicationsData } = useCollection(solicitudesQuery);
  const applications = applicationsData || [];

  // FILTRADO DINÁMICO
  const myProperties = properties.filter(p => 
    p.owners.some(o => o.email.toLowerCase() === user?.email?.toLowerCase())
  );

  const myLiquidations = liquidations.filter(l => 
    l.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() ||
    myProperties.some(p => p.id === l.propertyId)
  );

  // Solicitudes aprobadas para mis propiedades
  const myApprovedApps = applications.filter(app => 
    app.status === 'Aprobada' && 
    myProperties.some(p => p.id === app.propertyId)
  );

  const totalNetRecieved = myLiquidations
    .filter(l => l.status === 'Pagada')
    .reduce((acc, l) => acc + l.netAmount, 0);

  const viewDocument = (doc: DocumentInfo) => {
    if (doc.url) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<html><body style="margin:0; background: #333; display: flex; align-items: center; justify-content: center;"><img src="${doc.url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" /></body></html>`);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Liquidado este Año</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">$ {totalNetRecieved.toLocaleString('es-AR')}</h3>
              <div className="p-2 bg-green-50 rounded-full"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Unidades en Gestión</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black">{myProperties.length}</h3>
              <div className="p-2 bg-blue-50 rounded-full"><Building className="h-4 w-4 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Solicitudes Aprobadas</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-primary">{myApprovedApps.length}</h3>
              <div className="p-2 bg-primary/10 rounded-full"><Users2 className="h-4 w-4 text-primary" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Estado General</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-green-700">OK</h3>
              <div className="p-2 bg-green-50 rounded-full"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* SECCIÓN DE AUDITORÍA DE SOLICITUDES */}
          {myApprovedApps.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users2 className="h-5 w-5 text-primary" /> Nuevos Inquilinos Evaluados</CardTitle>
                <CardDescription>Candidatos aprobados por la administración para sus propiedades.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myApprovedApps.map((app) => (
                    <div key={app.id} className="p-4 border rounded-xl hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-lg">{app.applicantName}</p>
                          <p className="text-xs text-muted-foreground font-bold uppercase">{app.propertyName}</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setSelectedApp(app); setIsDetailOpen(true); }}>
                          <Eye className="h-4 w-4" /> Ver Evaluación
                        </Button>
                      </div>
                      <div className="mt-4 flex gap-4">
                        <Badge className="bg-green-100 text-green-700 font-bold">Puntaje IA: {app.aiAnalysis?.score}/100</Badge>
                        <Badge variant="outline" className="border-primary text-primary font-bold">Ingreso: $ {app.ingreso.toLocaleString('es-AR')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Liquidaciones</CardTitle>
                <CardDescription>Detalle de transferencias recibidas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Neto Liquidado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLiquidations.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-bold">{l.propertyName}</TableCell>
                      <TableCell className="text-xs">{l.period}</TableCell>
                      <TableCell className="text-right font-black text-green-700">$ {l.netAmount.toLocaleString('es-AR')}</TableCell>
                      <TableCell><Badge className={l.status === 'Pagada' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>{l.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-primary/5 border-t-4 border-t-primary">
            <CardHeader><CardTitle className="text-lg">Unidades en Gestión</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {myProperties.map((p) => (
                <div key={p.id} className="p-3 bg-white rounded-lg border flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Building className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.address}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Evaluación de {selectedApp.applicantName}</DialogTitle>
                <DialogDescription>Justificación profesional de la aprobación.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                <div className="space-y-6">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <h4 className="text-xs font-black uppercase text-primary mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Informe del Analista IA</h4>
                    <p className="text-sm font-bold text-green-700 mb-2">{selectedApp.aiAnalysis?.recommendation}</p>
                    <p className="text-xs leading-relaxed text-foreground/80 italic">"{selectedApp.aiAnalysis?.reasoning}"</p>
                  </div>
                  
                  {selectedApp.adminNotes && (
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2">Comentarios de Administración</h4>
                      <p className="text-xs leading-relaxed">{selectedApp.adminNotes}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Documentación Respaldatoria</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedApp.documents?.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border">
                        <span className="text-[10px] font-bold truncate max-w-[200px]">{doc.name}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7" onClick={() => viewDocument(doc)}><Eye className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
