
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
  MoreHorizontal, 
  Phone, 
  Mail, 
  Building2, 
  TrendingUp, 
  DollarSign,
  ClipboardCheck,
  Filter,
  Copy,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RentalApplication, ApplicationStatus, Property } from '@/lib/types';
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
    
    toast({
      title: `Solicitud ${newStatus}`,
      description: `El estado se ha actualizado correctamente en la nube.`,
    });
  };

  const handleDelete = (appId: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'solicitudes', appId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Solicitud eliminada", description: "Se ha removido el registro." });
  };

  const copyPublicLink = () => {
    const link = `https://alquilagestion-pro.web.app/apply?adminId=${userId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Enlace Copiado", description: "El link público de solicitudes está en el portapapeles." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por candidato o unidad..." className="pl-9 bg-white shadow-sm" />
          </div>
        </div>
        
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <ExternalLink className="h-4 w-4" /> Link de Solicitud Pública
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recibir Solicitudes Online</DialogTitle>
              <DialogDescription>
                Envía este enlace a tus interesados para que carguen sus datos y documentos directamente en tu sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <code className="text-[10px] flex-1 truncate">https://alquilagestion-pro.web.app/apply?adminId={userId}</code>
              <Button size="icon" variant="ghost" onClick={copyPublicLink}><Copy className="h-4 w-4" /></Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Nuevas</span>
          <span className="text-xl font-black">{applications.filter(a => a.status === 'Nueva').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">En Análisis</span>
          <span className="text-xl font-black text-orange-700">{applications.filter(a => a.status === 'En análisis').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-green-600 block">Aprobadas</span>
          <span className="text-xl font-black text-green-700">{applications.filter(a => a.status === 'Aprobada').length}</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-primary">
          <span className="text-[10px] uppercase font-bold text-primary block">Total Recibidas</span>
          <span className="text-xl font-black text-primary">{applications.length}</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Candidato / Fecha</TableHead>
              <TableHead>Propiedad Objetivo</TableHead>
              <TableHead>Ingreso Declarado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{app.applicantName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {app.submittedAt}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{app.propertyName || 'Unidad No Asignada'}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="font-black">$ {app.ingreso?.toLocaleString('es-AR') || '0'}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(app.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-primary hover:bg-primary/5 h-8 gap-1"
                      onClick={() => {
                        setSelectedApp(app);
                        setIsDetailOpen(true);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4" /> Evaluar
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(app.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground space-y-2">
                  <UserPlus className="h-8 w-8 mx-auto opacity-20" />
                  <p>No hay solicitudes recibidas aún. Comparte tu link público para empezar.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evaluación de Perfil: {selectedApp?.applicantName}</DialogTitle>
            <DialogDescription>
              Solicitud para <strong>{selectedApp?.propertyName}</strong> • Ingresada el {selectedApp?.submittedAt}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg space-y-3">
                <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Información de Contacto
                </h4>
                <div className="space-y-1">
                  <p className="text-sm"><strong>Email:</strong> {selectedApp?.applicantEmail}</p>
                  <p className="text-sm"><strong>Teléfono:</strong> {selectedApp?.applicantPhone}</p>
                </div>
              </div>

              <div className="p-4 bg-green-50/50 border border-green-100 rounded-lg space-y-3">
                <h4 className="text-xs font-black uppercase text-green-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Capacidad Financiera
                </h4>
                <div className="space-y-1">
                  <p className="text-sm"><strong>Ingreso:</strong> $ {selectedApp?.ingreso?.toLocaleString('es-AR') || '0'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
                <h4 className="text-xs font-black uppercase text-blue-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Referencias y Notas
                </h4>
                <p className="text-sm italic text-foreground/80 leading-relaxed">
                  "{selectedApp?.references || 'Sin referencias adjuntas.'}"
                </p>
              </div>

              <div className="space-y-2">
                <Label>Documentación Adjunta</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="text-[10px] justify-start gap-2">
                    <FileText className="h-3 w-3" /> DNI Frente
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] justify-start gap-2">
                    <FileText className="h-3 w-3" /> Recibo Sueldo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-8 border-t pt-4">
            <div className="flex gap-2 w-full justify-between">
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 gap-2" onClick={() => {
                if (selectedApp) handleUpdateStatus(selectedApp.id, 'Rechazada');
                setIsDetailOpen(false);
              }}>
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                <Button 
                  className="bg-primary text-white gap-2"
                  onClick={() => {
                    if (selectedApp) handleUpdateStatus(selectedApp.id, 'Aprobada');
                    setIsDetailOpen(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Aprobar y Crear Borrador
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
