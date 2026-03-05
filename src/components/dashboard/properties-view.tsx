"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Building, Search, Home, MapPin, Users, Info, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, PropertyStatus, PropertyType, PropertyUsage } from '@/lib/types';
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
    owners: [{ name: 'Juan Pérez', percentage: 100 }],
    monthlyRent: 120000,
    currency: 'ARS',
    photos: [],
  },
  { 
    id: '2', 
    name: 'Quinta del Sol', 
    address: 'Ruta 2 Km 50', 
    type: 'Casa',
    usage: 'Vivienda',
    status: 'Disponible',
    squareMeters: 250,
    rooms: 5,
    amenities: ['Piscina', 'Parrilla', 'Cochera'],
    owners: [
      { name: 'Maria Garcia', percentage: 50 },
      { name: 'Sucesión Garcia', percentage: 50 }
    ],
    monthlyRent: 250000,
    currency: 'ARS',
    photos: [],
  },
];

export function PropertiesView() {
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

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

  const handleSaveProperty = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Logic for saving (mocked for now)
    setIsDialogOpen(false);
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
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => setEditingProperty(null)}>
              <Plus className="h-4 w-4" />
              Nueva Propiedad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveProperty}>
              <DialogHeader>
                <DialogTitle>{editingProperty ? 'Editar Propiedad' : 'Alta de Propiedad'}</DialogTitle>
                <DialogDescription>
                  Complete los datos técnicos, legales y de uso de la unidad.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Sección Básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre / Referencia</Label>
                    <Input placeholder="Ej: Edificio Central 4B" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input placeholder="Calle y número" required />
                  </div>
                </div>

                {/* Tipo y Uso */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select defaultValue="Departamento">
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
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
                    <Label>Uso</Label>
                    <Select defaultValue="Vivienda">
                      <SelectTrigger>
                        <SelectValue placeholder="Uso" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vivienda">Vivienda</SelectItem>
                        <SelectItem value="Comercial">Comercial</SelectItem>
                        <SelectItem value="Profesional">Profesional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select defaultValue="Disponible">
                      <SelectTrigger>
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Disponible">Disponible</SelectItem>
                        <SelectItem value="Reservada">Reservada</SelectItem>
                        <SelectItem value="Alquilada">Alquilada</SelectItem>
                        <SelectItem value="En Mantenimiento">En Mantenimiento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Medidas y Ambientes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metros Cuadrados (m²)</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ambientes</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                </div>

                {/* Propietarios */}
                <div className="space-y-2 border p-3 rounded-lg bg-muted/20">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Propietarios y Participación</Label>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-primary">+ Añadir Dueño</Button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <Input className="col-span-3 h-8" placeholder="Nombre completo del propietario" defaultValue="Juan Pérez" />
                      <div className="flex items-center gap-1">
                        <Input className="h-8" type="number" defaultValue="100" />
                        <span className="text-xs font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amenities / Características</Label>
                  <Input placeholder="Ej: Piscina, Parrilla, Seguridad 24hs (separado por comas)" />
                </div>

                <div className="space-y-2">
                  <Label>Notas Internas</Label>
                  <Textarea placeholder="Información relevante para la administración..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-primary text-white">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">Propiedad</TableHead>
              <TableHead>Ubicación / Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Propietario(s)</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {p.type === 'Casa' ? <Home className="h-4 w-4 text-primary" /> : <Building className="h-4 w-4 text-primary" />}
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{p.usage}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.address}</span>
                    <span className="text-[10px] text-muted-foreground">{p.type} {p.squareMeters ? `- ${p.squareMeters}m²` : ''}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(p.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {p.owners.map((o, idx) => (
                      <span key={idx} className="text-[11px] bg-muted px-1.5 py-0.5 rounded flex justify-between items-center max-w-[150px]">
                        <span className="truncate">{o.name}</span>
                        <span className="font-bold">{o.percentage}%</span>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                   <div className="flex justify-end gap-1">
                    {p.rooms && <Badge variant="outline" className="text-[9px] h-5">{p.rooms} AMB</Badge>}
                    {p.amenities.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-5">
                        +{p.amenities.length} AMENITIES
                      </Badge>
                    )}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-muted/30 border-none shadow-none flex items-center gap-3">
          <div className="p-2 bg-white rounded-full"><Home className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Total Unidades</p>
            <p className="text-lg font-bold">{properties.length}</p>
          </div>
        </Card>
        <Card className="p-4 bg-muted/30 border-none shadow-none flex items-center gap-3">
          <div className="p-2 bg-white rounded-full"><Settings2 className="h-5 w-5 text-orange-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">En Mantenimiento</p>
            <p className="text-lg font-bold">{properties.filter(p => p.status === 'En Mantenimiento').length}</p>
          </div>
        </Card>
        <Card className="p-4 bg-muted/30 border-none shadow-none flex items-center gap-3">
          <div className="p-2 bg-white rounded-full"><Info className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Disponibles</p>
            <p className="text-lg font-bold">{properties.filter(p => p.status === 'Disponible').length}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
