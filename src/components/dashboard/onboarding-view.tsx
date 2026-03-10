
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
  FileCheck,
  ShieldCheck
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
import { Separator } from '@/components/ui/separator';

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
      const rentAmount = 350000; // Valor base para análisis
      const result = await analyzeApplication({
        applicantName: app.applicantName,
        applicantIncome: app.ingreso,
        rentAmount: rentAmount,
        currency: 'ARS',
        references: app.references
      });
      setAiAnalysis(result);
      
      if (userId && db) {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', app.id);
        setDocumentNonBlocking(docRef, { status: 'En análisis' }, { merge: true });
      }
    } catch (e) {
      toast({ title: "Error de Análisis", description: "No se pudo conectar con el analista de IA.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyPublicLink = () => {
    if (!userId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/apply?adminId=${userId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Enlace Copiado", description: "Link de postulaciones listo para enviar." });
  };

  const viewDocument = (doc: DocumentInfo) => {
    if (doc.url) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <body style="margin:0; background: #333; display: flex; align-items: center; justify-content: center;">
              <img src="${doc.url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />
            </body>
          </html>
        `);
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
            <Button className="bg-primary text-white gap-2 font-bold shadow-md hover:shadow-lg transition-all">
              <ExternalLink className="h-4 w-4" /> Enlace de Postulación Pública
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Recibir Postulaciones
              </DialogTitle>
              <DialogDescription className="pt-2">
                Usa este link para que los interesados carguen sus datos sin necesidad de tener un usuario.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-xl border border-dashed border-primary/20 overflow-hidden">
                <code className="text-[10px] flex-1 truncate font-mono text-primary font-bold">/apply?adminId={userId}</code>
                <Button size="icon" variant="ghost" onClick={copyPublicLink} className="hover:bg-primary/10 flex-shrink-0">
                  <Copy className="h-4 w-4 text-primary" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center italic">
                Copia este link y ábrelo en una pestaña de incógnito para probar cómo lo ve el interesado.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Candidato / Fecha</TableHead>
              <TableHead>Ingreso Mensual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Gestión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id} className="hover:bg-primary/5 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{app.applicantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3" /> Recibida: {app.submittedAt}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-black text-primary">
                  $ {app.ingreso.toLocaleString('es-AR')}
                </TableCell>
                <TableCell>{getStatusBadge(app.status)}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-primary text-primary hover:bg-primary hover:text-white h-8 gap-2 font-bold px-4"
                    onClick={() => {
                      setSelectedApp(app);
                      setIsDetailOpen(true);
                      setAiAnalysis(null);
                    }}
                  >
                    <ClipboardCheck className="h-4 w-4" /> Evaluar Candidato
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 opacity-50">
                    <UserPlus className="h-12 w-12" />
                    <p className="text-sm italic font-medium">No has recibido postulaciones por el momento.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl">
          {selectedApp && (
            <>
              <div className="bg-primary p-6 text-white rounded-t-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-white/20 text-white border-white/30 mb-2">Expediente Digital</Badge>
                    <DialogTitle className="text-2xl font-black">{selectedApp.applicantName}</DialogTitle>
                    <DialogDescription className="text-white/80 font-medium">
                      Solicitud ingresada el {selectedApp.submittedAt}
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-white/60 mb-1">Estado Actual</p>
                    <Badge className="bg-white text-primary font-black px-4">{selectedApp.status}</Badge>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="md:col-span-7 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-xl space-y-1">
                        <Label className="text-[10px] font-bold text-primary uppercase">Email</Label>
                        <p className="text-sm font-semibold truncate">{selectedApp.applicantEmail}</p>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-xl space-y-1">
                        <Label className="text-[10px] font-bold text-primary uppercase">Teléfono</Label>
                        <p className="text-sm font-semibold">{selectedApp.applicantPhone}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Análisis de IA
                        </h4>
                        {aiAnalysis && (
                          <Badge className={cn(
                            "font-black px-3",
                            aiAnalysis.score > 70 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          )}>
                            Score: {aiAnalysis.score}/100
                          </Badge>
                        )}
                      </div>
                      
                      {!aiAnalysis && !isAnalyzing ? (
                        <div className="text-center py-6 space-y-4">
                          <p className="text-xs text-muted-foreground italic">La IA analizará el perfil financiero y laboral automáticamente.</p>
                          <Button 
                            className="w-full bg-primary text-white font-bold h-12 gap-2 shadow-sm"
                            onClick={() => handleAnalyzeWithAI(selectedApp)}
                          >
                            <Sparkles className="h-4 w-4" /> Iniciar Evaluación con IA
                          </Button>
                        </div>
                      ) : isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-xs font-bold text-primary animate-pulse">Procesando perfil financiero...</p>
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="p-4 bg-white rounded-xl border border-primary/20 shadow-sm">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Dictamen IA</p>
                            <p className={cn(
                              "text-lg font-black",
                              aiAnalysis?.recommendation.includes('APROBADO') ? "text-green-600" : "text-orange-600"
                            )}>
                              {aiAnalysis?.recommendation}
                            </p>
                            <Separator className="my-3" />
                            <p className="text-sm leading-relaxed text-foreground/80 italic">
                              "{aiAnalysis?.reasoning}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-6">
                    <Card className="border-none bg-muted/10 shadow-none">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-primary" /> Archivos Adjuntos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedApp.documents && selectedApp.documents.length > 0 ? (
                          selectedApp.documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-muted-foreground/10 hover:border-primary/30 transition-all shadow-sm group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileCheck className="h-5 w-5 text-primary" />
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold truncate max-w-[150px]">{doc.name}</span>
                                  <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">{doc.type}</span>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 rounded-full hover:bg-primary/10"
                                onClick={() => viewDocument(doc)}
                              >
                                <Eye className="h-4 w-4 text-primary" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground/50 italic text-xs">Sin documentos.</div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center text-center space-y-2">
                      <div className="p-3 bg-green-100 rounded-full">
                        <DollarSign className="h-5 w-5 text-green-700" />
                      </div>
                      <p className="text-[10px] font-black uppercase text-green-700">Ingreso Declarado</p>
                      <p className="text-2xl font-black text-green-900">$ {selectedApp.ingreso.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 bg-muted/30 border-t rounded-b-lg">
                <div className="flex gap-4 w-full justify-end">
                  <Button 
                    variant="ghost" 
                    className="text-red-600 font-bold hover:bg-red-50"
                    onClick={() => {
                      handleUpdateStatus(selectedApp.id, 'Rechazada');
                      setIsDetailOpen(false);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Rechazar
                  </Button>
                  <Button 
                    className="bg-primary text-white font-black px-8 shadow-md hover:shadow-lg transition-all"
                    onClick={() => {
                      handleUpdateStatus(selectedApp.id, 'Aprobada');
                      setIsDetailOpen(false);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar Candidato
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
