
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Search, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Phone, 
  Mail, 
  Building2, 
  TrendingUp, 
  DollarSign,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  Eye,
  FileCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RentalApplication, ApplicationStatus, Property, DocumentInfo } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { analyzeApplication, AnalyzeApplicationOutput } from '@/ai/flows/analyze-application-flow';

interface ApplicationsViewProps {
  applications: RentalApplication[];
  userId?: string;
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

export function ApplicationsView({ applications, userId, properties }: ApplicationsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AnalyzeApplicationOutput | null>(null);

  const getStatusBadge = (status: ApplicationStatus) => {
    const styles = {
      'Nueva': 'bg-blue-100 text-blue-700 border-blue-200',
      'En análisis': 'bg-orange-100 text-orange-700 border-orange-200',
      'Aprobada': 'bg-green-100 text-green-700 border-green-200',
      'Rechazada': 'bg-red-100 text-red-700 border-red-200',
      'Pendiente de documentación': 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleUpdateStatus = (appId: string, newStatus: ApplicationStatus) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', appId);
    setDocumentNonBlocking(docRef, { status: newStatus }, { merge: true });
    toast({ title: `Solicitud ${newStatus}`, description: `Estado actualizado correctamente.` });
  };

  const handleAnalyzeWithAI = async (app: RentalApplication) => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const property = properties.find(p => p.id === app.propertyId);
      const rentAmount = 250000; // Valor por defecto
      
      const result = await analyzeApplication({
        applicantName: app.applicantName,
        applicantIncome: app.ingreso,
        rentAmount: rentAmount,
        currency: 'ARS',
        references: app.references
      });
      setAiAnalysis(result);
    } catch (e) {
      toast({ title: "Error de Análisis", description: "No se pudo conectar con el analista de IA.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyPublicLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/apply?adminId=${userId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Enlace Copiado", description: "Link de postulaciones listo para enviar." });
  };

  const viewDocument = (doc: DocumentInfo) => {
    if (doc.url) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar candidatos..." className="pl-9 bg-white" />
          </div>
        </div>
        
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white gap-2">
              <ExternalLink className="h-4 w-4" /> Enlace de Postulación Pública
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recibir Postulaciones</DialogTitle>
              <DialogDescription>Comparte este link con interesados para recibir sus datos directamente aquí sin que ellos tengan que registrarse.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <code className="text-[10px] flex-1 truncate">/apply?adminId={userId}</code>
              <Button size="icon" variant="ghost" onClick={copyPublicLink}><Copy className="h-4 w-4" /></Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Candidato / Fecha</TableHead>
              <TableHead>Ingreso Declarado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">{app.applicantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {app.submittedAt}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-black text-green-700">
                  $ {app.ingreso.toLocaleString('es-AR')}
                </TableCell>
                <TableCell>{getStatusBadge(app.status)}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-primary hover:bg-primary/5 h-8 gap-2"
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailOpen(true);
                      setAiAnalysis(null);
                    }}
                  >
                    <ClipboardCheck className="h-4 w-4" /> Evaluar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                  No hay solicitudes recibidas aún.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluación: {selectedApp?.applicantName}</DialogTitle>
            <DialogDescription>Postulación ingresada el {selectedApp?.submittedAt}</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg space-y-2">
                <h4 className="text-[10px] font-black uppercase text-muted-foreground">Datos de Contacto e Ingreso</h4>
                <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                  <p><strong>Email:</strong> {selectedApp?.applicantEmail}</p>
                  <p><strong>Teléfono:</strong> {selectedApp?.applicantPhone}</p>
                  <p className="col-span-2"><strong>Ingreso Mensual:</strong> $ {selectedApp?.ingreso.toLocaleString('es-AR')}</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                <h4 className="text-[10px] font-black uppercase text-blue-700 mb-2">Análisis Financiero IA</h4>
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" /> Procesando con analista experto...
                  </div>
                ) : aiAnalysis ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Viabilidad:</span>
                      <Badge className={aiAnalysis.score > 70 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                        {aiAnalysis.score}/100
                      </Badge>
                    </div>
                    <div className="p-2 bg-white rounded border text-[11px] leading-relaxed">
                      <strong>Dictamen: {aiAnalysis.recommendation}</strong><br/>
                      {aiAnalysis.reasoning}
                    </div>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    className="w-full bg-blue-600 text-white gap-2 h-8 text-[11px]"
                    onClick={() => selectedApp && handleAnalyzeWithAI(selectedApp)}
                  >
                    <Sparkles className="h-3 w-3" /> Iniciar Evaluación con IA
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/10 rounded-lg space-y-3">
                <h4 className="text-[10px] font-black uppercase text-muted-foreground">Documentación Presentada</h4>
                <div className="space-y-2">
                  {selectedApp?.documents && selectedApp.documents.length > 0 ? (
                    selectedApp.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded border border-muted-foreground/10">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCheck className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold truncate">{doc.name}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">{doc.type}</span>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => viewDocument(doc)}>
                          <Eye className="h-3 w-3 text-primary" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                      <AlertTriangle className="h-3 w-3" /> No se adjuntaron archivos.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-muted/10 rounded-lg space-y-3">
                <h4 className="text-[10px] font-black uppercase text-muted-foreground">Referencias y Notas</h4>
                <p className="text-sm italic text-muted-foreground">"{selectedApp?.references || 'Sin notas adicionales.'}"</p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
             <div className="flex gap-2 w-full justify-between">
              <Button variant="ghost" className="text-red-600" onClick={() => {
                if (selectedApp) handleUpdateStatus(selectedApp.id, 'Rechazada');
                setIsDetailOpen(false);
              }}>
                <XCircle className="h-4 w-4 mr-2" /> Rechazar
              </Button>
              <Button className="bg-primary text-white" onClick={() => {
                if (selectedApp) handleUpdateStatus(selectedApp.id, 'Aprobada');
                setIsDetailOpen(false);
              }}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar Candidato
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
