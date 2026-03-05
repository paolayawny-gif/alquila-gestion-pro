
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Building, Search, Home, MapPin, Users, Info, Settings2, Image as ImageIcon, PlusCircle, X, CreditCard, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, PropertyStatus, PropertyOwner } from '@/lib/types';
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const INITIAL_PROPERTIES: Property[] = [
  { 
    id: '1', 
    name: 'Edificio Las Heras 4B', 
    address: 'Las Heras 1234', 
    unit: '4B', 
    type: 'Departamento',
    usage: 'Vivienda',
    status: 'Alquilada',
    squareMeters: 55,
    rooms: 2,
    amenities: ['Seguridad 24hs', 'SUM'],
    owners: [{ ownerId: 'p1', name: 'Juan Pérez', percentage: 100 }],
    photos: [],
    ownerId: 'user1'
  },
];

export function PropertiesView() {
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formOwners, setFormOwners] = useState<PropertyOwner[]>([{ ownerId: '', name: '', percentage: 100 }]);

  const filteredProperties = properties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: PropertyStatus) => {
    const styles = {
      'Disponible': 'bg-green-100 text-green-700 hover:bg-green-100',
      'Reservada': 'bg-blue-100 text-blue-700 hover:bg-blue-100',
      'Alquilada': 'bg-gray-100 text-gray-700 hover:bg-gray-100',
      'En Mantenimiento': 'bg-orange-100 text-orange-700 hover:bg-orange-100'
    };
    return <Badge className={cn("border-none", styles[status])}>{status}</Badge>;
  };

  const addOwner = () => setFormOwners([...formOwners, { ownerId: '', name: '', percentage: 0 }]);
  const removeOwner = (index: number) => setFormOwners(formOwners.filter((_, i) => i !== index));
  const updateOwner = (index: number, field: keyof PropertyOwner, value: string | number) => {
    const newOwners = [...formOwners];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setFormOwners(newOwners);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar propiedad..." 
            className="pl-9 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => {
              setEditingProperty(null);
              setFormOwners([{ ownerId: '', name: '', percentage: 100 }]);
            }}>
              <Plus className="h-4 w-4" />
              Nueva Propiedad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProperty ? 'Editar Propiedad' : 'Alta de Propiedad'}</DialogTitle>
              <DialogDescription>Gestión integral técnica y legal de la unidad.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="specs" className="mt-4">
              <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
                <TabsTrigger value="specs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Datos Técnicos</TabsTrigger>
                <TabsTrigger value="owners" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Propietarios</TabsTrigger>
                <TabsTrigger value="extra" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Notas y Docs</TabsTrigger>
              </TabsList>

              <TabsContent value="specs" className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre Referencia</Label>
                    <Input placeholder="Ej: Las Heras 4B" defaultValue={editingProperty?.name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input placeholder="Calle y número" defaultValue={editingProperty?.address} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Superficie m²</Label>
                    <Input type="number" defaultValue={editingProperty?.squareMeters} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ambientes</Label>
                    <Input type="number" defaultValue={editingProperty?.rooms} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select defaultValue={editingProperty?.type || 'Departamento'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Departamento">Departamento</SelectItem>
                        <SelectItem value="Casa">Casa</SelectItem>
                        <SelectItem value="Local">Local</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select defaultValue={editingProperty?.status || 'Disponible'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Disponible">Disponible</SelectItem>
                        <SelectItem value="Alquilada">Alquilada</SelectItem>
                        <SelectItem value="En Mantenimiento">Mantenimiento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="owners" className="space-y-6 pt-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold flex items-center gap-2"><Landmark className="h-4 w-4" /> Propietarios Registrados</h4>
                  <Button type="button" variant="outline" size="sm" onClick={addOwner}><PlusCircle className="h-3 w-3 mr-1" /> Añadir Dueño</Button>
                </div>
                {formOwners.map((owner, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-muted/20 rounded-lg">
                    <div className="md:col-span-6 space-y-1">
                      <Label className="text-[10px]">Dueño (Persona)</Label>
                      <Input value={owner.name} onChange={(e) => updateOwner(index, 'name', e.target.value)} placeholder="Nombre o Razón Social" className="h-8" />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-[10px]">% Part.</Label>
                      <Input type="number" value={owner.percentage} onChange={(e) => updateOwner(index, 'percentage', parseInt(e.target.value))} className="h-8" />
                    </div>
                    <div className="md:col-span-2 flex gap-1">
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-primary"><CreditCard className="h-4 w-4" /></Button>
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOwner(index)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="extra" className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label>Notas Internas (Llaves, Portería, etc.)</Label>
                  <Textarea className="min-h-[100px]" defaultValue={editingProperty?.internalNotes} />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-8 border-t pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button>Guardar Propiedad</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propiedad</TableHead>
              <TableHead>Tipo / Uso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Copropietarios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-bold">{p.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs">{p.type}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{p.usage}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(p.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {p.owners.map((o, idx) => (
                      <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full w-fit">
                        {o.name} ({o.percentage}%)
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setEditingProperty(p);
                        setFormOwners(p.owners);
                        setIsDialogOpen(true);
                      }}
                    >
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
    </div>
  );
}
