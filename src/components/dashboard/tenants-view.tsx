
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  User, 
  FileText, 
  Phone, 
  Mail, 
  History, 
  ShieldCheck,
  Upload,
  CreditCard,
  ExternalLink,
  Users,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  FileDown,
  Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, PersonType } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const MOCK_PEOPLE: Person[] = [
  {
    id: '1',
    type: 'Inquilino',
    fullName: 'Carlos Sosa',
    taxId: '20-34567890-9',
    email: 'carlos.sosa@email.com',
    phone: '11 4455-6677',
    address: 'Av. Corrientes 1500, CABA',
    documents: [
      { id: 'd1', name: 'DNI_Frente.jpg', url: '#', type: 'DNI', status: 'Validado', date: '10/01/2024' }
    ],
    bankDetails: { bank: 'Galicia', cbu: '0070123...456', alias: 'CARLOS.SOSA.PAGO' },
    ownerId: 'user1'
  }
];

const MOCK_CONTRACTS: Contract[] = [
  { 
    id: 'c1', 
    tenantId: '1', 
    tenantName: 'Carlos Sosa',
    propertyId: '1', 
    propertyName: 'Edificio Las Heras 4B',
    guarantorIds: ['g1'],
    ownerIds: ['p1'],
    startDate: '2023-05-15',
    endDate: '2025-05-15',
    paymentPeriodDays: 30,
    baseRentAmount: 120000,
    currentRentAmount: 185000,
    currency: 'ARS',
    adjustmentType: 'Index',
    adjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    depositAmount: 120000,
    depositCurrency: 'ARS',
    commissionAmount: 60000,
    lateFeeType: 'DailyPercentage',
    lateFeeValue: 0.5,
    lateFeeCapPercentage: 15,
    status: 'Vigente',
    documents: {
      mainContractUrl: '#',
      versions: [
        { id: 'v1', name: 'Contrato Original.pdf', url: '#', type: 'Contrato', status: 'Validado', date: '15/05/2023', version: 1 }
      ],
      annexes: []
    },
    ownerId: 'user1'
  }
];

export function TenantsView() {
  const [contracts] = useState<Contract[]>(MOCK_CONTRACTS);
  const [people] = useState<Person[]>(MOCK_PEOPLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'contracts' | 'people'>('contracts');
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const getStatusBadge = (status: Contract['status']) => {
    const styles = {
      'Vigente': 'bg-green-100 text-green-700 border-green-200',
      'Próximo a Vencer': 'bg-orange-100 text-orange-700 border-orange-200',
      'Finalizado': 'bg-gray-100 text-gray-700 border-gray-200',
      'Rescindido': 'bg-red-100 text-red-700 border-red-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="bg-white border shadow-sm p-1 rounded-lg">
          <TabsList className="bg-transparent">
            <TabsTrigger value="contracts" className="data-[state=active]:bg-primary data-[state=active]:text-white">Contratos</TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-primary data-[state=active]:text-white">Personas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 bg-white" />
          </div>
          
          {activeTab === 'contracts' ? (
            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Alta de Contrato de Locación</DialogTitle>
                  <DialogDescription>Configure las cláusulas económicas y legales de la locación.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="economic">Cláusulas Econ.</TabsTrigger>
                    <TabsTrigger value="guarantors">Garantías</TabsTrigger>
                    <TabsTrigger value="docs">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Propiedad</Label>
                        <Select><SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger><SelectContent><SelectItem value="1">Las Heras 4B</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Inquilino Principal</Label>
                        <Select><SelectTrigger><SelectValue placeholder="Seleccione persona..." /></SelectTrigger><SelectContent><SelectItem value="1">Carlos Sosa</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Inicio</Label>
                        <Input type="date" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Fin</Label>
                        <Input type="date" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="economic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Monto Inicial</Label>
                        <Input placeholder="150000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select defaultValue="ARS"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">Pesos (ARS)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Regla de Ajuste</Label>
                        <Select defaultValue="Index"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Index">Por Índice (ICL/IPC)</SelectItem><SelectItem value="Percentage">Porcentaje Fijo</SelectItem><SelectItem value="Scale">Escala Escalonada</SelectItem></SelectContent></Select>
                      </div>
                    </div>
                    <Separator />
                    <div className="p-4 bg-muted/20 rounded-lg space-y-4">
                      <h4 className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Configuración de Ajuste</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Frecuencia de Ajuste (Meses)</Label>
                          <Input type="number" defaultValue="4" />
                        </div>
                        <div className="space-y-2">
                          <Label>Índice de Referencia</Label>
                          <Select defaultValue="ICL"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ICL">ICL (Vivienda)</SelectItem><SelectItem value="IPC">IPC (Comercial)</SelectItem><SelectItem value="CasaPropia">Casa Propia</SelectItem></SelectContent></Select>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-red-50/50 rounded-lg space-y-4 border border-red-100">
                      <h4 className="text-sm font-bold text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Punitorios por Mora</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select defaultValue="DailyPercentage"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DailyPercentage">% Diario</SelectItem><SelectItem value="MonthlyPercentage">% Mensual</SelectItem><SelectItem value="Fixed">Monto Fijo</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Valor</Label>
                          <Input placeholder="0.5" />
                        </div>
                        <div className="space-y-2">
                          <Label>Tope (%)</Label>
                          <Input placeholder="15" />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="guarantors" className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Depósito de Garantía</Label>
                        <Input placeholder="Monto" />
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda Depósito</Label>
                        <Select defaultValue="USD"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select>
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Seguro de Caución / Garantes</Label>
                        <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground text-sm">
                          Seleccione garantes personales o cargue póliza de caución...
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-4 pt-4">
                    <div className="border rounded-lg p-6 text-center space-y-4">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-bold">Cargar Contrato Escaneado</p>
                        <p className="text-xs text-muted-foreground">PDF, DOCX o Imágenes hasta 10MB</p>
                      </div>
                      <Button variant="outline">Seleccionar Archivo</Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-primary">Guardar y Activar Contrato</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'contracts' ? (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Contrato e Inquilino</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Ajuste Económico</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Alquiler Actual</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{c.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Garante: Finaer S.A.
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{c.propertyName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span>Inicia: {c.startDate}</span>
                      <span className="text-muted-foreground">Vence: {c.endDate}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex flex-col items-start gap-1 p-2 h-auto bg-blue-50/50 border-blue-100">
                      <div className="flex items-center gap-1 text-[10px] font-black text-blue-700">
                        <TrendingUp className="h-3 w-3" /> {c.adjustmentMechanism} ({c.adjustmentFrequencyMonths}m)
                      </div>
                      <span className="text-[9px] text-blue-600">Ajuste cada {c.adjustmentFrequencyMonths} meses</span>
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-primary text-lg">
                        {c.currency} {c.currentRentAmount.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-red-600 font-bold">Punitorio: {c.lateFeeValue}%/día</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nombre y CUIT</TableHead>
                <TableHead>Rol Principal</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Finanzas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{p.fullName}</span>
                      <span className="text-[10px] text-muted-foreground">{p.taxId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "border-none",
                      p.type === 'Inquilino' ? "bg-blue-100 text-blue-700" :
                      p.type === 'Propietario' ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                    )}>{p.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      <span>{p.bankDetails?.bank || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setSelectedPerson(p);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-8 w-8" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{selectedPerson?.fullName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{selectedPerson?.taxId}</Badge>
                  <span className="text-muted-foreground text-sm">• {selectedPerson?.type}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="general">Contacto</TabsTrigger>
              <TabsTrigger value="financial">Bancario / Pagos</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" /> Datos de Localización
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Teléfono:</strong> {selectedPerson?.phone}</p>
                      <p className="text-sm"><strong>Email:</strong> {selectedPerson?.email}</p>
                      <p className="text-sm"><strong>Dirección:</strong> {selectedPerson?.address || 'No informada'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="pt-4">
              <Card className="border-none bg-muted/20">
                <CardContent className="p-4 space-y-4">
                  <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3 w-3" /> Datos para Conciliación / Liquidación
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Banco</Label>
                      <p className="text-sm font-bold">{selectedPerson?.bankDetails?.bank || 'Sin cargar'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">CBU</Label>
                      <p className="text-xs font-mono">{selectedPerson?.bankDetails?.cbu || 'Sin cargar'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Alias</Label>
                      <p className="text-sm font-bold uppercase">{selectedPerson?.bankDetails?.alias || 'Sin cargar'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
