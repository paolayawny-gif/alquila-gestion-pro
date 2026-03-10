
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Search, Landmark, X, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, PropertyStatus, PropertyOwner, PropertyType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface PropertiesViewProps {
  properties: Property[];
  userId?: string;
}

const APP_ID = "alquilagestion-pro";

export function PropertiesView({ properties, userId }: PropertiesViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  
  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    address: '',
    type: 'Departamento',
    usage: 'Vivienda',
    status: 'Disponible',
    squareMeters: 0,
    rooms: 0,
    amenities: [],
    internalNotes: '',
    owners: [{ ownerId: '', name: '', percentage: 100 }]
  });

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

  const handleOpenDialog = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData(property);
    } else {
      setEditingProperty(null);
      setFormData({
        name: '',
        address: '',
        type: 'Departamento',
        usage: 'Vivienda',
        status: 'Disponible',
        squareMeters: 0,
        rooms: 0,
        amenities: [],
        internalNotes: '',
        owners: [{ ownerId: '', name: '', percentage: 100 }]
      });
    }
    setIsDialogOpen(true);
  };

  const addOwner = () => {
    const newOwners = [...(formData.owners || []), { ownerId: '', name: '', percentage: 0 }];
    setFormData({ ...formData, owners: newOwners });
  };

  const removeOwner = (index: number) => {
    const newOwners = (formData.owners || []).filter((_, i) => i !== index);
    setFormData({ ...formData, owners: newOwners });
  };

  const updateOwner = (index: number, field: keyof PropertyOwner, value: string | number) => {
    const newOwners = [...(formData.owners || [])];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setFormData({ ...formData, owners: newOwners });
  };

  const handleSave = () => {
    if (!formData.name || !formData.address || !userId || !db) {
      toast({
        title: "Error",
        description: "Complete todos los campos requeridos.",
        variant: "destructive"
      });
      return;
    }

    const docId = editingProperty?.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', docId);

    const propertyData: Property = {
      ...formData,
      id: docId,
      ownerId: userId,
      photos: formData.photos || [],
      amenities: formData.amenities || [],
      owners: formData.owners || []
    } as Property;

    setDocumentNonBlocking(docRef, propertyData, { merge: true });
    
    toast({ 
      title: editingProperty ? "Propiedad actualizada" : "Propiedad creada", 
      description: `${formData.name} se ha guardado en la nube.` 
    });
    
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!userId || !db) return;
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'propiedades', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Propiedad eliminada", description: "La unidad ha sido removida." });
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

        <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Nueva Propiedad
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Editar Propiedad' : 'Alta de Propiedad'}</DialogTitle>
            <DialogDescription>Gestión técnica y legal de la unidad.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="specs" className="mt-4">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
              <TabsTrigger value="specs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Datos Técnicos</TabsTrigger>
              <TabsTrigger value="owners" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Propietarios</TabsTrigger>
              <TabsTrigger value="extra" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Referencia</Label>
                  <Input 
                    placeholder="Ej: Las Heras 4B" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input 
                    placeholder="Calle y número" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Superficie m²</Label>
                  <Input 
                    type="number" 
                    value={formData.squareMeters}
                    onChange={(e) => setFormData({...formData, squareMeters: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ambientes</Label>
                  <Input 
                    type="number" 
                    value={formData.rooms}
                    onChange={(e) => setFormData({...formData, rooms: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v: PropertyType) => setFormData({...formData, type: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Departamento">Departamento</SelectItem>
                      <SelectItem value="Casa">Casa</SelectItem>
                      <SelectItem value="Local">Local</SelectItem>
                      <SelectItem value="Cochera">Cochera</SelectItem>
                      <SelectItem value="Oficina">Oficina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v: PropertyStatus) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponible">Disponible</SelectItem>
                      <SelectItem value="Reservada">Reservada</SelectItem>
                      <SelectItem value="Alquilada">Alquilada</SelectItem>
                      <SelectItem value="En Mantenimiento">En Mantenimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="owners" className="space-y-6 pt-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold flex items-center gap-2"><Landmark className="h-4 w-4" /> Propietarios</h4>
                <Button type="button" variant="outline" size="sm" onClick={addOwner}><PlusCircle className="h-3 w-3 mr-1" /> Añadir</Button>
              </div>
              {(formData.owners || []).map((owner, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-muted/20 rounded-lg">
                  <div className="md:col-span-6 space-y-1">
                    <Label className="text-[10px]">Dueño</Label>
                    <Input 
                      value={owner.name} 
                      onChange={(e) => updateOwner(index, 'name', e.target.value)} 
                      placeholder="Nombre" 
                      className="h-8" 
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <Label className="text-[10px]">% Part.</Label>
                    <Input 
                      type="number" 
                      value={owner.percentage} 
                      onChange={(e) => updateOwner(index, 'percentage', parseInt(e.target.value) || 0)} 
                      className="h-8" 
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-1">
                     <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOwner(index)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="extra" className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Notas Internas</Label>
                <Textarea 
                  className="min-h-[100px]" 
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-8 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Propiedad</TableHead>
              <TableHead>Tipo / Uso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Propietarios</TableHead>
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
                    {(p.owners || []).map((o, idx) => (
                      <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full w-fit">
                        {o.name} ({o.percentage}%)
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(p)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProperties.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay propiedades cargadas.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
