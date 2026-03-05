
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  TrendingUp, 
  User, 
  Phone, 
  Mail, 
  ShieldCheck,
  Upload,
  CreditCard,
  Plus,
  FileDown,
  AlertCircle,
  Landmark,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, PersonType } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';

interface TenantsViewProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  properties: Property[];
}

export function TenantsView({ people, setPeople, contracts, setContracts, properties }: TenantsViewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'contracts' | 'people'>('contracts');
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isPersonDialogOpen, setIsPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    type: 'Inquilino',
    email: '',
    phone: '',
    bankDetails: { bank: '', cbu: '', alias: '' }
  });

  const getStatusBadge = (status: Contract['status']) => {
    const styles = {
      'Vigente': 'bg-green-100 text-green-700 border-green-200',
      'Próximo a Vencer': 'bg-orange-100 text-orange-700 border-orange-200',
      'Finalizado': 'bg-gray-100 text-gray-700 border-gray-200',
      'Rescindido': 'bg-red-100 text-red-700 border-red-200'
    };
    return <Badge variant="outline" className={cn("border font-bold", styles[status])}>{status}</Badge>;
  };

  const handleOpenPersonDialog = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setPersonFormData(person);
    } else {
      setEditingPerson(null);
      setPersonFormData({
        fullName: '',
        taxId: '',
        type: 'Inquilino',
        email: '',
        phone: '',
        bankDetails: { bank: '', cbu: '', alias: '' }
      });
    }
    setIsPersonDialogOpen(true);
  };

  const handleSavePerson = () => {
    if (!personFormData.fullName || !personFormData.taxId) {
      toast({ title: "Error", description: "Nombre y CUIT/DNI son obligatorios", variant: "destructive" });
      return;
    }

    if (editingPerson) {
      setPeople(people.map(p => p.id === editingPerson.id ? { ...personFormData, id: p.id } as Person : p));
      toast({ title: "Persona actualizada", description: `${personFormData.fullName} ha sido modificado.` });
    } else {
      const newPerson = {
        ...personFormData,
        id: Math.random().toString(36).substr(2, 9),
        ownerId: 'user1',
        documents: []
      } as Person;
      setPeople([...people, newPerson]);
      toast({ title: "Persona creada", description: `${personFormData.fullName} ha sido dada de alta.` });
    }
    setIsPersonDialogOpen(false);
  };

  const handleDeletePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
    toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
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
                  <DialogTitle>Alta de Contrato</DialogTitle>
                  <DialogDescription>Configure los términos de la locación.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="economic">Económico</TabsTrigger>
                    <TabsTrigger value="guarantors">Garantías</TabsTrigger>
                    <TabsTrigger value="docs">Docs</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Propiedad</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Seleccione unidad..." /></SelectTrigger>
                          <SelectContent>
                            {properties.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.address})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Inquilino Principal</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Seleccione persona..." /></SelectTrigger>
                          <SelectContent>
                            {people.filter(p => p.type === 'Inquilino').map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  
                  {/* Resto de Tabs de contrato... */}
                  <TabsContent value="economic" className="pt-4"><p className="text-sm text-muted-foreground">Configuración económica en desarrollo...</p></TabsContent>
                  <TabsContent value="guarantors" className="pt-4"><p className="text-sm text-muted-foreground">Gestión de garantes en desarrollo...</p></TabsContent>
                  <TabsContent value="docs" className="pt-4"><p className="text-sm text-muted-foreground">Carga documental en desarrollo...</p></TabsContent>
                </Tabs>

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-primary">Guardar Contrato</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenPersonDialog()}>
              <UserPlus className="h-4 w-4" /> Nueva Persona
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isPersonDialogOpen} onOpenChange={setIsPersonDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Editar Persona' : 'Alta de Persona'}</DialogTitle>
            <DialogDescription>Inquilinos, Propietarios, Garantes o Proveedores.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Nombre Completo / Razón Social</Label>
              <Input 
                value={personFormData.fullName} 
                onChange={e => setPersonFormData({...personFormData, fullName: e.target.value})} 
                placeholder="Ej: Juan Perez"
              />
            </div>
            <div className="space-y-2">
              <Label>CUIT / CUIL / DNI</Label>
              <Input 
                value={personFormData.taxId} 
                onChange={e => setPersonFormData({...personFormData, taxId: e.target.value})} 
                placeholder="20-XXXXXXXX-X"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Rol</Label>
              <Select 
                value={personFormData.type} 
                onValueChange={(v: PersonType) => setPersonFormData({...personFormData, type: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inquilino">Inquilino</SelectItem>
                  <SelectItem value="Propietario">Propietario</SelectItem>
                  <SelectItem value="Garante">Garante</SelectItem>
                  <SelectItem value="Proveedor">Proveedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={personFormData.email} 
                onChange={e => setPersonFormData({...personFormData, email: e.target.value})} 
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input 
                value={personFormData.phone} 
                onChange={e => setPersonFormData({...personFormData, phone: e.target.value})} 
                placeholder="+54 11 ..."
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2"><Landmark className="h-4 w-4" /> Datos Bancarios</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input 
                  value={personFormData.bankDetails?.bank} 
                  onChange={e => setPersonFormData({...personFormData, bankDetails: {...personFormData.bankDetails!, bank: e.target.value}})}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CBU</Label>
                <Input 
                  value={personFormData.bankDetails?.cbu} 
                  onChange={e => setPersonFormData({...personFormData, bankDetails: {...personFormData.bankDetails!, cbu: e.target.value}})}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alias</Label>
                <Input 
                  value={personFormData.bankDetails?.alias} 
                  onChange={e => setPersonFormData({...personFormData, bankDetails: {...personFormData.bankDetails!, alias: e.target.value}})}
                  className="h-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsPersonDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary" onClick={handleSavePerson}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeTab === 'contracts' ? (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Contrato e Inquilino</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Alquiler Actual</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length > 0 ? contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{c.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Con Garantía
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{c.propertyName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>Desde: {c.startDate}</span>
                      <span>Hasta: {c.endDate}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(c.status)}</TableCell>
                  <TableCell className="text-right font-black text-primary">
                    {c.currency} {c.currentRentAmount.toLocaleString('es-AR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay contratos registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nombre y CUIT</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Contacto</TableHead>
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
                      p.type === 'Propietario' ? "bg-orange-100 text-orange-700" :
                      p.type === 'Garante' ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                    )}>{p.type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{p.phone}</span>
                      <span>{p.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenPersonDialog(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePerson(p.id)}>
                        <Trash2 className="h-4 w-4" />
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
                <DialogDescription>
                  {selectedPerson?.type} • {selectedPerson?.taxId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="general">Contacto</TabsTrigger>
              <TabsTrigger value="financial">Banco</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="pt-4">
              <Card className="border-none bg-muted/10">
                <CardHeader>
                  <CardTitle className="text-sm">Datos de contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm"><strong>Email:</strong> {selectedPerson?.email}</p>
                  <p className="text-sm"><strong>Teléfono:</strong> {selectedPerson?.phone}</p>
                  <p className="text-sm"><strong>Dirección:</strong> {selectedPerson?.address || 'No informada'}</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="financial" className="pt-4">
              <Card className="border-none bg-muted/10">
                <CardHeader>
                  <CardTitle className="text-sm text-primary">Información Bancaria</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div><Label className="text-[10px]">Banco</Label><p className="font-bold">{selectedPerson?.bankDetails?.bank || '-'}</p></div>
                  <div><Label className="text-[10px]">CBU</Label><p className="font-xs font-mono">{selectedPerson?.bankDetails?.cbu || '-'}</p></div>
                  <div><Label className="text-[10px]">Alias</Label><p className="font-bold">{selectedPerson?.bankDetails?.alias || '-'}</p></div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="docs" className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {(selectedPerson?.documents || []).map((doc) => (
                  <div key={doc.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <span className="text-xs font-bold">{doc.name}</span>
                    <Badge variant="outline" className="text-[10px]">{doc.status}</Badge>
                  </div>
                ))}
                <Button variant="outline" className="border-dashed border-2 h-20 flex flex-col gap-1">
                  <Upload className="h-4 w-4" />
                  <span className="text-[10px]">Subir Documento</span>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
