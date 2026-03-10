
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Eye, 
  FileCheck, 
  ShieldCheck,
  Copy,
  ClipboardCheck,
  DollarSign,
  Upload,
  X,
  FileText
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
import { analyzeApplication } from '@/ai/flows/analyze-application-flow';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationsViewProps {
  applications: RentalApplication[];
  userId?: string;
  properties: Property[];
}

const APP_ID = "alquilagestion-pro";

export function ApplicationsView({ applications, userId, properties }: ApplicationsViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

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

  const handleUpdateStatus = (app: RentalApplication, newStatus: ApplicationStatus) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', app.id);
    setDocumentNonBlocking(docRef, { status: newStatus }, { merge: true });
    toast({ title: `Solicitud ${newStatus}`, description: `Estado actualizado correctamente.` });
  };

  const handleSaveNotes = (appId: string, notes: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', appId);
    setDocumentNonBlocking(docRef, { adminNotes: notes }, { merge: true });
    toast({ title: "Notas Guardadas", description: "El comentario se ha registrado." });
  };

  const handleDelete = (appId: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', appId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Solicitud Eliminada", description: "El registro ha sido removido." });
  };

  const handleAnalyzeWithAI = async (app: RentalApplication) => {
    setIsAnalyzing(true);
    try {
      const rentAmount = 350000; 
      const result = await analyzeApplication({
        applicantName: app.applicantName,
        applicantIncome: app.ingreso,
        rentAmount: rentAmount,
        currency: 'ARS',
        references: app.references
      });
      
      if (userId && db) {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', app.id);
        setDocumentNonBlocking(docRef, { 
          status: 'En análisis',
          aiAnalysis: result
        }, { merge: true });
      }
      toast({ title: "Análisis Completado", description: "La IA ha generado su veredicto." });
    } catch (e) {
      toast({ title: "Error de Análisis", description: "No se pudo conectar con el analista de IA.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedApp || !userId || !db) return;

    setUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const newDoc: DocumentInfo = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: event.target?.result as string,
        type: 'Adicional (Admin)',
        status: 'Validado',
        date: new Date().toLocaleDateString('es-AR')
      };

      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', selectedApp.id);
      const updatedDocs = [...(selectedApp.documents || []), newDoc];
      
      setDocumentNonBlocking(docRef, { documents: updatedDocs }, { merge: true });
      setSelectedApp({ ...selectedApp, documents: updatedDocs });
      setUploadingDoc(false);
      toast({ title: "Documento Subido", description: "Se ha agregado al expediente." });
    };
    reader.readAsDataURL(file);
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
        newWindow.document.write(`<html><body style="margin:0; background: #333; display: flex; align-items: center; justify-content: center;"><img src="${doc.url}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" /></body></html>`);
      }
    }
  };

  const filteredApps = applications.filter(app => 
    app.applicantName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingApps = filteredApps.filter(app => ['Nueva', 'En análisis', 'Pendiente de documentación'].includes(app.status));
  const historyApps = filteredApps.filter(app => ['Aprobada', 'Rechazada'].includes(app.status));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar candidatos..." 
            className="pl-9 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white gap-2 font-bold shadow-md">
              <ExternalLink className="h-4 w-4" /> Enlace Público
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Recibir Postulaciones
              </DialogTitle>
              <DialogDescription className="pt-2">Comparte este link para recibir carpetas digitales.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-xl border border-dashed border-primary/20">
                <code className="text-[10px] flex-1 truncate font-mono text-primary font-bold">/apply?adminId={userId}</code>
                <Button size="icon" variant="ghost" onClick={copyPublicLink}><Copy className="h-4 w-4 text-primary" /></Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-white">Pendientes ({pendingApps.length})</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-white">Historial ({historyApps.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <ApplicationsTable 
            apps={pendingApps} 
            onEval={(app) => { setSelectedApp(app); setIsDetailOpen(true); }} 
            onDelete={handleDelete}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ApplicationsTable 
            apps={historyApps} 
            onEval={(app) => { setSelectedApp(app); setIsDetailOpen(true); }} 
            onDelete={handleDelete}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl">
          {selectedApp && (
            <>
              <div className="bg-primary p-6 text-white rounded-t-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-white/20 text-white border-white/30 mb-2">Expediente Digital</Badge>
                    <DialogTitle className="text-2xl font-black">{selectedApp.applicantName}</DialogTitle>
                    <DialogDescription className="text-white/80 font-medium">Postulación para {selectedApp.propertyName}</DialogDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-white/60 mb-1">Estado</p>
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
                        <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" /> Evaluación IA</h4>
                        {selectedApp.aiAnalysis && (
                          <Badge className={cn("font-black px-3", selectedApp.aiAnalysis.score > 70 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                            Score: {selectedApp.aiAnalysis.score}/100
                          </Badge>
                        )}
                      </div>
                      
                      {!selectedApp.aiAnalysis && !isAnalyzing ? (
                        <div className="text-center py-6 space-y-4">
                          <p className="text-xs text-muted-foreground italic">Analiza la viabilidad financiera del candidato.</p>
                          <Button className="w-full bg-primary text-white font-bold h-12 gap-2 shadow-sm" onClick={() => handleAnalyzeWithAI(selectedApp)}>
                            <Sparkles className="h-4 w-4" /> Iniciar Evaluación con IA
                          </Button>
                        </div>
                      ) : isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-xs font-bold text-primary animate-pulse">Procesando perfil...</p>
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="p-4 bg-white rounded-xl border border-primary/20 shadow-sm">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Recomendación IA</p>
                            <p className={cn("text-lg font-black", selectedApp.aiAnalysis?.recommendation.includes('APROBADO') ? "text-green-600" : "text-orange-600")}>
                              {selectedApp.aiAnalysis?.recommendation}
                            </p>
                            <Separator className="my-3" />
                            <p className="text-sm leading-relaxed text-foreground/80 italic">"{selectedApp.aiAnalysis?.reasoning}"</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground">Comentarios y Justificación (Visible para Propietario)</Label>
                      <Textarea 
                        placeholder="Escribe aquí tu justificación de aprobación para que el dueño pueda verla..."
                        className="min-h-[100px]"
                        defaultValue={selectedApp.adminNotes}
                        onBlur={(e) => handleSaveNotes(selectedApp.id, e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-5 space-y-6">
                    <Card className="border-none bg-muted/10 shadow-none">
                      <CardHeader className="pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2"><FileCheck className="h-4 w-4 text-primary" /> Documentación</CardTitle>
                        <div className="relative">
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleAddDocument} />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => fileInputRef.current?.click()}>
                            {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedApp.documents?.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-muted-foreground/10 hover:border-primary/30 group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <FileCheck className="h-5 w-5 text-primary" />
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold truncate max-w-[150px]">{doc.name}</span>
                                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">{doc.type}</span>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => viewDocument(doc)}><Eye className="h-4 w-4 text-primary" /></Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center text-center space-y-2">
                      <div className="p-3 bg-green-100 rounded-full"><DollarSign className="h-5 w-5 text-green-700" /></div>
                      <p className="text-[10px] font-black uppercase text-green-700">Ingreso Neto</p>
                      <p className="text-2xl font-black text-green-900">$ {selectedApp.ingreso.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 bg-muted/30 border-t rounded-b-lg">
                <div className="flex gap-4 w-full justify-end">
                  <Button variant="ghost" className="text-red-600 font-bold" onClick={() => { handleUpdateStatus(selectedApp, 'Rechazada'); setIsDetailOpen(false); }}><XCircle className="h-4 w-4 mr-2" /> Rechazar</Button>
                  <Button className="bg-primary text-white font-black px-8" onClick={() => { handleUpdateStatus(selectedApp, 'Aprobada'); setIsDetailOpen(false); }}><CheckCircle2 className="h-4 w-4 mr-2" /> Aprobar Candidato</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationsTable({ apps, onEval, onDelete, getStatusBadge }: { apps: RentalApplication[], onEval: (app: RentalApplication) => void, onDelete: (id: string) => void, getStatusBadge: (status: ApplicationStatus) => React.ReactNode }) {
  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Candidato / Fecha</TableHead>
            <TableHead>Ingreso Mensual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((app) => (
            <TableRow key={app.id} className="hover:bg-primary/5">
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{app.applicantName}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {app.submittedAt}</span>
                </div>
              </TableCell>
              <TableCell className="font-black text-primary">$ {app.ingreso.toLocaleString('es-AR')}</TableCell>
              <TableCell>{getStatusBadge(app.status)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="border-primary text-primary h-8 gap-2 font-bold px-4" onClick={() => onEval(app)}><ClipboardCheck className="h-4 w-4" /> Evaluar</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(app.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {apps.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground">No hay solicitudes en esta categoría.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
