
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
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MOCK_TENANTS: Person[] = [
  {
    id: '1',
    type: 'Inquilino',
    fullName: 'Carlos Sosa',
    taxId: '20-34567890-9',
    email: 'carlos.sosa@email.com',
    phone: '11 4455-6677',
    address: 'Av. Corrientes 1500, CABA',
    documents: [
      { name: 'DNI_Frente.jpg', url: '#', type: 'DNI' },
      { name: 'DNI_Dorso.jpg', url: '#', type: 'DNI' },
      { name: 'Recibo_Sueldo_Feb.pdf', url: '#', type: 'Ingresos' }
    ],
    ownerId: 'user1'
  },
  {
    id: '2',
    type: 'Inquilino',
    fullName: 'Marta Rodriguez',
    taxId: '27-11223344-5',
    email: 'marta.rod@email.com',
    phone: '11 2233-4455',
    documents: [],
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
    status: 'Active',
    ownerId: 'user1'
  }
];

export function TenantsView() {
  const [contracts] = useState<Contract[]>(MOCK_CONTRACTS);
  const [tenants] = useState<Person[]>(MOCK_TENANTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Person | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredContracts = contracts.filter(c => 
    c.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.propertyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar inquilino o contrato..." 
            className="pl-9 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo Contrato
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Inquilino / Contrato</TableHead>
              <TableHead>Propiedad</TableHead>
              <TableHead className="text-right">Alquiler Actual</TableHead>
              <TableHead>Ajuste</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button 
                    onClick={() => {
                      const tenant = tenants.find(t => t.id === c.tenantId);
                      if (tenant) {
                        setSelectedTenant(tenant);
                        setIsDetailOpen(true);
                      }
                    }}
                    className="flex flex-col items-start hover:text-primary transition-colors"
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
                    <span className="text-[10px] text-muted-foreground">Base: {c.currency} {c.baseRentAmount.toLocaleString('es-AR')}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit bg-primary/5 text-primary border-primary/20">
                    <TrendingUp className="h-3 w-3" /> {c.adjustmentMechanism} ({c.adjustmentFrequencyMonths}m)
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

      {/* DIALOGO DE FICHA DEL INQUILINO */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-8 w-8" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{selectedTenant?.fullName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{selectedTenant?.taxId}</Badge>
                  <span className="text-muted-foreground">• {selectedTenant?.type}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="financial">Financiero</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" /> Contacto
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Teléfono:</strong> {selectedTenant?.phone}</p>
                      <p className="text-sm"><strong>Email:</strong> {selectedTenant?.email}</p>
                      <p className="text-sm"><strong>Dirección:</strong> {selectedTenant?.address || 'No informada'}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3" /> Garantías Asociadas
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Garante Propietario: Roberto Gomez</p>
                      <p className="text-xs text-muted-foreground">Inmueble: Ituzaingo 456, Lanús</p>
                      <Badge variant="secondary" className="text-[10px]">Verificada</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-3 w-3" /> Datos Bancarios
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Banco:</strong> {selectedTenant?.bankDetails?.bank || 'Galicia'}</p>
                      <p className="text-sm"><strong>CBU:</strong> {selectedTenant?.bankDetails?.cbu || '0070123...456'}</p>
                      <p className="text-sm"><strong>Alias:</strong> {selectedTenant?.bankDetails?.alias || 'CARLOS.SOSA.PAGO'}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-3 w-3" /> Estado de Cuenta
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Saldo Actual:</span>
                        <span className="font-bold text-green-600">$ 0 (Al día)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Próximo Vencimiento:</span>
                        <span className="text-sm font-medium">10/05/2024</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedTenant?.documents.map((doc, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-white flex flex-col items-center justify-center text-center group relative hover:border-primary transition-all">
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    <span className="text-[10px] font-bold truncate w-full">{doc.name}</span>
                    <span className="text-[8px] text-muted-foreground uppercase">{doc.type}</span>
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="outline" size="sm" className="h-7 text-[10px]">Ver</Button>
                    </div>
                  </div>
                ))}
                <button className="p-3 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 mb-1" />
                  <span className="text-[10px]">Subir Doc</span>
                </button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg border-l-4 border-l-blue-500">
                  <History className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">Renovación de Contrato</p>
                    <p className="text-[10px] text-muted-foreground">15 de Mayo, 2023 • Contrato C1 iniciado</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg border-l-4 border-l-green-500">
                  <CreditCard className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">Pago de Alquiler Recibido</p>
                    <p className="text-[10px] text-muted-foreground">10 de Abril, 2024 • Monto: $185.000</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
            <Button className="gap-2"><Edit2 className="h-4 w-4" /> Editar Ficha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
