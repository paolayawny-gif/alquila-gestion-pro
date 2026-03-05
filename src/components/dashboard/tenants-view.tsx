
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertCircle
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
      { id: 'd1', name: 'DNI_Frente.jpg', url: '#', type: 'DNI', status: 'Validado', date: '10/01/2024' },
      { id: 'd2', name: 'Recibo_Sueldo.pdf', url: '#', type: 'Ingresos', status: 'Pendiente', date: '05/03/2024' }
    ],
    bankDetails: { bank: 'Galicia', cbu: '0070123...456', alias: 'CARLOS.SOSA.PAGO' },
    ownerId: 'user1'
  },
  {
    id: 'p1',
    type: 'Propietario',
    fullName: 'Admin Inmobiliaria S.A.',
    taxId: '30-71234567-8',
    email: 'contacto@admininmo.com',
    phone: '11 5566-7788',
    documents: [],
    bankDetails: { bank: 'Santander', cbu: '0720555...999', alias: 'ADMIN.PROPIEDADES' },
    ownerId: 'user1'
  },
  {
    id: 'g1',
    type: 'Garante',
    fullName: 'Roberto Gomez',
    taxId: '20-11222333-4',
    email: 'roberto@email.com',
    phone: '11 2233-1122',
    documents: [
      { id: 'd3', name: 'Escritura_Ituzaingo.pdf', url: '#', type: 'Propiedad', status: 'Validado', date: '15/01/2024' }
    ],
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
    startDate: '2023-05-15',
    endDate: '2025-05-15',
    baseRentAmount: 120000,
    currentRentAmount: 185000,
    currency: 'ARS',
    adjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    nextAdjustmentDate: '2024-05-15',
    lateFeePercentage: 0.5, // 0.5% diario por mora
    status: 'Active',
    ownerId: 'user1'
  }
];

export function TenantsView() {
  const [contracts] = useState<Contract[]>(MOCK_CONTRACTS);
  const [people] = useState<Person[]>(MOCK_PEOPLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRole, setActiveRole] = useState<'All' | PersonType>('All');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredPeople = people.filter(p => 
    (activeRole === 'All' || p.type === activeRole) &&
    (p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || p.taxId.includes(searchTerm))
  );

  const filteredContracts = contracts.filter(c => 
    c.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.propertyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Tabs defaultValue="contracts" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList className="bg-white border shadow-sm h-11">
            <TabsTrigger value="contracts" className="px-6">Contratos</TabsTrigger>
            <TabsTrigger value="people" className="px-6">Personas (Roles)</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-9 bg-white" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo
            </Button>
          </div>
        </div>

        <TabsContent value="contracts">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Inquilino / Contrato</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead className="text-right">Alquiler Actual</TableHead>
                  <TableHead>Ajuste e Interés</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button 
                        onClick={() => {
                          const person = people.find(t => t.id === c.tenantId);
                          if (person) {
                            setSelectedPerson(person);
                            setIsDetailOpen(true);
                          }
                        }}
                        className="flex flex-col items-start hover:text-primary transition-colors text-left"
                      >
                        <span className="font-bold text-foreground flex items-center gap-1">
                          {c.tenantName} <ExternalLink className="h-3 w-3 opacity-50" />
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {c.startDate} al {c.endDate}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.propertyName}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-primary">
                          {c.currency} {c.currentRentAmount.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Punitorio: {c.lateFeePercentage}%/día</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex flex-col items-start gap-0.5 w-fit bg-primary/5 text-primary border-primary/20 px-2 py-1 h-auto">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> {c.adjustmentMechanism} ({c.adjustmentFrequencyMonths}m)
                        </div>
                        <span className="text-[9px] opacity-70">Próx: {c.nextAdjustmentDate}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Edit2 className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="people">
          <div className="flex gap-2 mb-4">
            <Button 
              variant={activeRole === 'All' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveRole('All')}
            >Todos</Button>
            <Button 
              variant={activeRole === 'Inquilino' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveRole('Inquilino')}
            >Inquilinos</Button>
            <Button 
              variant={activeRole === 'Propietario' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveRole('Propietario')}
            >Propietarios</Button>
            <Button 
              variant={activeRole === 'Garante' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveRole('Garante')}
            >Garantes</Button>
          </div>
          
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nombre y CUIT</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Documentación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeople.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button 
                        onClick={() => {
                          setSelectedPerson(p);
                          setIsDetailOpen(true);
                        }}
                        className="text-left"
                      >
                        <p className="font-bold">{p.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{p.taxId}</p>
                      </button>
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
                      <div className="flex gap-1">
                        {p.documents.length > 0 ? (
                           <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                             {p.documents.length} Archivos
                           </Badge>
                        ) : (
                          <span className="text-[9px] text-muted-foreground italic">Sin archivos</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Edit2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* DIALOGO DE FICHA UNIFICADA */}
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
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3" /> Garantías y Vinculaciones
                    </h4>
                    <div className="space-y-2">
                      {selectedPerson?.type === 'Inquilino' ? (
                        <div className="p-2 bg-white rounded border">
                          <p className="text-xs font-bold">Roberto Gomez (Garante)</p>
                          <p className="text-[10px] text-muted-foreground">Inmueble: Lanús 123 • Verificado</p>
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">No hay vinculaciones directas para este rol.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-muted/20 border-l-4 border-l-primary">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2">
                      <CreditCard className="h-3 w-3" /> Datos Bancarios para Liquidación
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Banco:</strong> {selectedPerson?.bankDetails?.bank || 'No definido'}</p>
                      <p className="text-[11px] font-mono break-all"><strong>CBU:</strong> {selectedPerson?.bankDetails?.cbu || '-'}</p>
                      <p className="text-sm"><strong>Alias:</strong> {selectedPerson?.bankDetails?.alias || '-'}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20 border-l-4 border-l-green-600">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-green-700 flex items-center gap-2">
                      <DollarSign className="h-3 w-3" /> Estado de Cuenta Corriente
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Saldo Actual:</span>
                        <span className="font-black text-green-700">$ 0</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>Último Cobro:</span>
                        <span>10/04/2024</span>
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-xs h-8">Ver Detalle Facturación</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedPerson?.documents.map((doc) => (
                  <div key={doc.id} className="p-3 border rounded-lg bg-white flex flex-col items-center justify-center text-center group relative hover:border-primary transition-all">
                    <FileText className={cn(
                      "h-8 w-8 mb-2",
                      doc.status === 'Validado' ? "text-green-600" : "text-primary"
                    )} />
                    <span className="text-[10px] font-bold truncate w-full">{doc.name}</span>
                    <span className="text-[8px] text-muted-foreground uppercase">{doc.type}</span>
                    {doc.status === 'Validado' && <CheckCircle2 className="h-3 w-3 text-green-600 absolute top-2 right-2" />}
                  </div>
                ))}
                <button className="p-3 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors h-full">
                  <Upload className="h-6 w-6 mb-1" />
                  <span className="text-[10px]">Cargar Doc.</span>
                </button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border-l-4 border-l-blue-500">
                  <History className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">Documento Validado: DNI Frente</p>
                    <p className="text-[10px] text-muted-foreground">Procesado por sistema automático • 10/01/2024</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50/50 rounded-lg border-l-4 border-l-orange-500">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">Notificación de Ajuste Enviada</p>
                    <p className="text-[10px] text-muted-foreground">Mecanismo ICL cuatrimestral aplicado • 01/04/2024</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
            <Button className="gap-2"><Edit2 className="h-4 w-4" /> Editar Ficha Completa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
