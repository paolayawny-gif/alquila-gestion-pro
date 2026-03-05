
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
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RentalApplication, ApplicationStatus } from '@/lib/types';
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

const MOCK_APPLICATIONS: RentalApplication[] = [
  {
    id: 'app1',
    propertyId: 'p1',
    propertyName: 'Las Heras 4B',
    applicantName: 'Mariano Grondona',
    applicantEmail: 'm.grondona@email.com',
    applicantPhone: '11 2233-4455',
    income: 850000,
    references: 'Anterior locador: Juan Gomez (Tel: 11 9988-7766)',
    documents: [],
    status: 'Nueva',
    submittedAt: '2024-04-01',
    ownerId: 'user1'
  },
  {
    id: 'app2',
    propertyId: 'p2',
    propertyName: 'Quinta del Sol',
    applicantName: 'Lucía Galán',
    applicantEmail: 'lucia.g@email.com',
    applicantPhone: '11 5566-7788',
    income: 1200000,
    references: 'Recibos de sueldo de OSDE, 10 años de antigüedad.',
    documents: [],
    status: 'En análisis',
    submittedAt: '2024-03-28',
    ownerId: 'user1'
  }
];

export function OnboardingView() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<RentalApplication[]>(MOCK_APPLICATIONS);
  const [selectedApp, setSelectedApp] = useState<RentalApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const handleApprove = (app: RentalApplication) => {
    toast({
      title: "Solicitud Aprobada",
      description: `Se ha generado un borrador de contrato para ${app.applicantName}.`,
    });
    // Aquí se dispararía la lógica de creación de contrato precargado
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por candidato o unidad..." className="pl-9 bg-white shadow-sm" />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </Button>
        </div>
        
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <UserPlus className="h-4 w-4" /> Link de Solicitud Pública
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Nuevas Solicitudes</span>
          <span className="text-xl font-black">5</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-orange-600 block">En Análisis</span>
          <span className="text-xl font-black text-orange-700">12</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4">
          <span className="text-[10px] uppercase font-bold text-green-600 block">Aprobadas (Pend. Contrato)</span>
          <span className="text-xl font-black text-green-700">3</span>
        </Card>
        <Card className="bg-white border-none shadow-sm p-4 border-l-4 border-l-primary">
          <span className="text-[10px] uppercase font-bold text-primary block">Tasa de Conversión</span>
          <span className="text-xl font-black text-primary">68%</span>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Candidato / Fecha</TableHead>
              <TableHead>Propiedad Objetivo</TableHead>
              <TableHead>Ingresos Declarados</TableHead>
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
                    <span className="font-medium">{app.propertyName}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="font-black">$ {app.income.toLocaleString('es-AR')}</span>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* DIALOGO DE EVALUACIÓN DE CANDIDATO */}
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
                  <p className="text-sm"><strong>Ingresos:</strong> $ {selectedApp?.income.toLocaleString('es-AR')}</p>
                  <p className="text-xs text-muted-foreground">Relación cuota/ingreso est: 22% (Saludable)</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
                <h4 className="text-xs font-black uppercase text-blue-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Referencias y Notas
                </h4>
                <p className="text-sm italic text-foreground/80 leading-relaxed">
                  "{selectedApp?.references}"
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
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 gap-2">
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                <Button 
                  className="bg-primary text-white gap-2"
                  onClick={() => {
                    if (selectedApp) handleApprove(selectedApp);
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
