
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  User, 
  Phone, 
  Mail, 
  ShieldCheck,
  Upload,
  Plus,
  FileDown,
  Landmark,
  X,
  FileText,
  DollarSign,
  Calculator,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contract, Person, Property, PersonType, Currency, AdjustmentMechanism } from '@/lib/types';
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
import { extractContractData, ExtractContractDataOutput } from '@/ai/flows/extract-contract-data-flow';

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
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // AI State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractContractDataOutput | null>(null);

  // ESTADO PARA NUEVA PERSONA
  const [personFormData, setPersonFormData] = useState<Partial<Person>>({
    fullName: '',
    taxId: '',
    type: 'Inquilino',
    email: '',
    phone: '',
    bankDetails: { bank: '', cbu: '', alias: '' }
  });

  // ESTADO PARA NUEVO CONTRATO
  const [contractFormData, setContractFormData] = useState<Partial<Contract>>({
    tenantId: '',
    propertyId: '',
    startDate: '',
    endDate: '',
    baseRentAmount: 0,
    currentRentAmount: 0,
    currency: 'ARS',
    adjustmentType: 'Index',
    adjustmentMechanism: 'ICL',
    adjustmentFrequencyMonths: 4,
    depositAmount: 0,
    depositCurrency: 'ARS',
    commissionAmount: 0,
    lateFeeType: 'DailyPercentage',
    lateFeeValue: 0.5,
    status: 'Vigente',
    guarantorIds: [],
    ownerIds: [],
    documents: { mainContractUrl: '', versions: [], annexes: [] }
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

  const handleOpenContractDialog = (contract?: Contract) => {
    setAiResult(null);
    if (contract) {
      setEditingContract(contract);
      setContractFormData(contract);
    } else {
      setEditingContract(null);
      setContractFormData({
        tenantId: '',
        propertyId: '',
        startDate: '',
        endDate: '',
        baseRentAmount: 0,
        currentRentAmount: 0,
        currency: 'ARS',
        adjustmentType: 'Index',
        adjustmentMechanism: 'ICL',
        adjustmentFrequencyMonths: 4,
        depositAmount: 0,
        depositCurrency: 'ARS',
        commissionAmount: 0,
        lateFeeType: 'DailyPercentage',
        lateFeeValue: 0.5,
        status: 'Vigente',
        guarantorIds: [],
        ownerIds: [],
        documents: { mainContractUrl: '', versions: [], annexes: [] }
      });
    }
    setIsContractDialogOpen(true);
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

  const handleSaveContract = () => {
    if (!contractFormData.tenantId || !contractFormData.propertyId || !contractFormData.baseRentAmount) {
      toast({ title: "Error", description: "Complete inquilino, propiedad y monto.", variant: "destructive" });
      return;
    }

    if (editingContract) {
      setContracts(contracts.map(c => c.id === editingContract.id ? { ...contractFormData, id: c.id } as Contract : c));
      toast({ title: "Contrato Actualizado", description: "Los cambios se han guardado correctamente." });
    } else {
      const tenant = people.find(p => p.id === contractFormData.tenantId);
      const property = properties.find(p => p.id === contractFormData.propertyId);

      const newContract = {
        ...contractFormData,
        id: Math.random().toString(36).substr(2, 9),
        tenantName: tenant?.fullName,
        propertyName: property?.name,
        currentRentAmount: contractFormData.baseRentAmount,
        ownerId: 'user1',
        documents: contractFormData.documents || { mainContractUrl: '', versions: [], annexes: [] }
      } as Contract;

      setContracts([...contracts, newContract]);
      toast({ title: "Contrato Guardado", description: "Se ha generado el registro de locación exitosamente." });
    }
    setIsContractDialogOpen(false);
  };

  const simulateAiExtraction = async () => {
    setIsAiProcessing(true);
    try {
      // Simulation of a contract data URI (real one would come from a file upload)
      // For this prototype, we use a 1x1 pixel placeholder to trigger the AI logic
      const result = await extractContractData({ 
        documentDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' 
      });
      setAiResult(result);
      toast({ title: "Análisis Completo", description: "La IA ha extraído las cláusulas económicas." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo analizar el contrato.", variant: "destructive" });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const applyAiData = () => {
    if (aiResult) {
      setContractFormData({
        ...contractFormData,
        baseRentAmount: aiResult.baseRentAmount,
        currency: aiResult.currency,
        adjustmentFrequencyMonths: aiResult.adjustmentFrequencyMonths,
        adjustmentMechanism: aiResult.adjustmentMechanism,
        currentRentAmount: aiResult.baseRentAmount,
        documents: {
          ...contractFormData.documents!,
          mainContractUrl: 'simulated_uploaded_file_url'
        }
      });
      setAiResult(null);
      toast({ title: "Datos Aplicados", description: "La información ha sido copiada y el contrato marcado como cargado." });
    }
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
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={() => handleOpenContractDialog()}>
                  <Plus className="h-4 w-4" /> Nuevo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContract ? 'Editar Contrato' : 'Alta de Contrato'}</DialogTitle>
                  <DialogDescription>Configure los términos de la locación y adjunte documentos.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                    <TabsTrigger value="general">Datos Generales</TabsTrigger>
                    <TabsTrigger value="economic">Cláusulas Económicas</TabsTrigger>
                    <TabsTrigger value="documents">Documentos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Propiedad</Label>
                        <Select 
                          value={contractFormData.propertyId} 
                          onValueChange={(v) => setContractFormData({...contractFormData, propertyId: v})}
                        >
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
                        <Select 
                          value={contractFormData.tenantId} 
                          onValueChange={(v) => setContractFormData({...contractFormData, tenantId: v})}
                        >
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
                        <Input 
                          type="date" 
                          value={contractFormData.startDate} 
                          onChange={(e) => setContractFormData({...contractFormData, startDate: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha Fin</Label>
                        <Input 
                          type="date" 
                          value={contractFormData.endDate} 
                          onChange={(e) => setContractFormData({...contractFormData, endDate: e.target.value})}
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="economic" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Monto Alquiler Inicial</Label>
                        <Input 
                          type="number" 
                          value={contractFormData.baseRentAmount}
                          onChange={(e) => setContractFormData({...contractFormData, baseRentAmount: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select 
                          value={contractFormData.currency} 
                          onValueChange={(v: Currency) => setContractFormData({...contractFormData, currency: v})}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                            <SelectItem value="USD">Dólares (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frecuencia Ajuste (Meses)</Label>
                        <Input 
                          type="number" 
                          value={contractFormData.adjustmentFrequencyMonths}
                          onChange={(e) => setContractFormData({...contractFormData, adjustmentFrequencyMonths: parseInt(e.target.value) || 4})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Mecanismo de Ajuste</Label>
                        <Select 
                          value={contractFormData.adjustmentMechanism} 
                          onValueChange={(v: AdjustmentMechanism) => setContractFormData({...contractFormData, adjustmentMechanism: v})}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ICL">Índice ICL (BCRA)</SelectItem>
                            <SelectItem value="IPC">Inflación (IPC)</SelectItem>
                            <SelectItem value="CasaPropia">Casa Propia</SelectItem>
                            <SelectItem value="Fixed">Fijo / Escalonado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Punitorio diario (%)</Label>
                        <Input 
                          type="number" 
                          step="0.1" 
                          value={contractFormData.lateFeeValue}
                          onChange={(e) => setContractFormData({...contractFormData, lateFeeValue: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6 pt-4">
                    {!aiResult && !isAiProcessing && !contractFormData.documents?.mainContractUrl && (
                      <div 
                        onClick={simulateAiExtraction}
                        className="border-2 border-dashed rounded-lg p-8 text-center space-y-3 hover:bg-muted/50 cursor-pointer transition-colors border-muted-foreground/20"
                      >
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm font-bold">Subir Contrato Firmado (PDF)</p>
                          <p className="text-xs text-muted-foreground">Presione aquí o en el botón para analizar con IA</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); simulateAiExtraction(); }}>
                          <Sparkles className="h-4 w-4 mr-2 text-primary" />
                          Subir y Analizar con IA
                        </Button>
                      </div>
                    )}

                    {isAiProcessing && (
                      <div className="p-8 text-center space-y-4 animate-pulse">
                        <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                        <div className="space-y-2">
                          <p className="text-sm font-bold">Analizando cláusulas económicas...</p>
                          <p className="text-xs text-muted-foreground">La IA está extrayendo montos, plazos e índices.</p>
                        </div>
                      </div>
                    )}

                    {aiResult && !isAiProcessing && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="border-primary/20 bg-primary/5 shadow-none">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Revisión de Extracción IA
                              </CardTitle>
                              <Badge className="bg-green-100 text-green-700 border-green-200">95% Confianza</Badge>
                            </div>
                            <CardDescription className="text-xs">Valide los datos detectados antes de aplicarlos.</CardDescription>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-muted-foreground font-bold">Monto Detectado</span>
                              <p className="text-sm font-black text-foreground">{aiResult.currency} {aiResult.baseRentAmount.toLocaleString('es-AR')}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-muted-foreground font-bold">Frecuencia</span>
                              <p className="text-sm font-black text-foreground">Cada {aiResult.adjustmentFrequencyMonths} meses</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-muted-foreground font-bold">Modalidad</span>
                              <p className="text-sm font-black text-foreground">{aiResult.adjustmentMechanism}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-muted-foreground font-bold">Resumen</span>
                              <p className="text-[10px] text-muted-foreground italic leading-tight">{aiResult.summary}</p>
                            </div>
                          </CardContent>
                          <div className="p-4 bg-white/50 border-t border-primary/10 flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setAiResult(null)}>Descartar</Button>
                            <Button size="sm" className="bg-primary text-white gap-2" onClick={applyAiData}>
                              <CheckCircle2 className="h-4 w-4" /> Confirmar y Aplicar
                            </Button>
                          </div>
                        </Card>
                      </div>
                    )}

                    {contractFormData.documents?.mainContractUrl && !aiResult && !isAiProcessing && (
                       <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-1">
                         <div className="flex items-center gap-3">
                           <FileText className="h-6 w-6 text-green-600" />
                           <div className="flex flex-col">
                             <span className="text-sm font-bold text-green-800">Contrato_Firmado.pdf</span>
                             <span className="text-[10px] text-green-600 uppercase">Documento validado por IA</span>
                           </div>
                         </div>
                         <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:bg-red-50 h-8"
                          onClick={() => setContractFormData({...contractFormData, documents: {...contractFormData.documents!, mainContractUrl: ''}})}
                        >
                          Eliminar
                        </Button>
                       </div>
                    )}
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-8 border-t pt-4">
                  <Button variant="outline" onClick={() => setIsContractDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-primary text-white" onClick={handleSaveContract}>
                    {editingContract ? 'Actualizar Contrato' : 'Guardar Contrato'}
                  </Button>
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
            <Button className="bg-primary text-white" onClick={handleSavePerson}>Guardar</Button>
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
                        {c.documents?.mainContractUrl && <FileText className="h-3 w-3 text-green-600" />}
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
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenContractDialog(c)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                        setSelectedPerson(p);
                        setIsDetailOpen(true);
                      }}>
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenPersonDialog(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                        setPeople(people.filter(per => per.id !== p.id));
                        toast({ title: "Persona eliminada", description: "El registro ha sido removido." });
                      }}>
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

      {/* FICHA DETALLADA DE PERSONA */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl uppercase">
                {selectedPerson?.fullName.substring(0, 2)}
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
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="financial">Datos Financieros</TabsTrigger>
              <TabsTrigger value="docs">Documentos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" /> Datos de Localización
                    </h4>
                    <div className="space-y-1">
                      <p className="text-sm"><strong>Email:</strong> {selectedPerson?.email}</p>
                      <p className="text-sm"><strong>Teléfono:</strong> {selectedPerson?.phone}</p>
                      <p className="text-sm"><strong>Dirección:</strong> {selectedPerson?.address || 'No informada'}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-3 w-3" /> Resumen Histórico
                    </h4>
                    <div className="space-y-1">
                      <p className="text-sm"><strong>Contratos:</strong> 0 registrados</p>
                      <p className="text-sm"><strong>Pagos:</strong> Sin historial</p>
                      <p className="text-sm"><strong>Reclamos:</strong> Ninguno activo</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="pt-4">
              <Card className="border-none bg-primary/5 border border-primary/10">
                <CardHeader>
                  <CardTitle className="text-sm text-primary flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Configuración Bancaria para Liquidaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[10px] uppercase">Banco</Label>
                    <p className="font-bold">{selectedPerson?.bankDetails?.bank || 'No informado'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px] uppercase">CBU / CVU</Label>
                    <p className="font-mono text-sm break-all">{selectedPerson?.bankDetails?.cbu || 'No informado'}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase">Alias</Label>
                    <p className="font-bold">{selectedPerson?.bankDetails?.alias || 'No informado'}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(selectedPerson?.documents || []).length > 0 ? (selectedPerson?.documents || []).map((doc) => (
                  <div key={doc.id} className="p-3 border rounded-lg flex items-center justify-between bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{doc.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{doc.date}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{doc.status}</Badge>
                  </div>
                )) : (
                  <div className="md:col-span-2 py-8 text-center bg-muted/20 rounded-lg border-2 border-dashed">
                    <p className="text-sm text-muted-foreground">No hay documentos cargados para esta persona.</p>
                    <Button variant="ghost" size="sm" className="mt-2 text-primary">
                      <Upload className="h-4 w-4 mr-2" /> Subir Primer Documento
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar Ficha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
