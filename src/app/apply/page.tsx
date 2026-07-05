
"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  User,
  Mail,
  Phone,
  TrendingUp,
  FileText,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Upload,
  FileCheck,
  X,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Property, RentalApplication, DocumentInfo } from '@/lib/types';


function ApplyPageContent() {
  const searchParams = useSearchParams();
  const adminId = searchParams.get('adminId');
  const propertyId = searchParams.get('propertyId');
  
  const { toast } = useToast();
  const db = useFirestore();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    income: '',
    guarantorName: '',
    guarantorType: 'Sin garante',
    guarantorIncome: '',
    references: '',
    consent: false
  });

  const formatTaxId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const isValidTaxId = (value: string) => /^\d{11}$/.test(value.replace(/\D/g, ''));

  // Muestra tipo + calle sin número + unidad, para no exponer la dirección exacta
  const formatPropertyLabel = (p: Property) => {
    const streetOnly = p.address
      .replace(/,?\s*\d{2,5}(?=\s|,|$)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const unit = p.unit ? ` · ${p.unit}` : '';
    return { type: p.type, street: `${streetOnly}${unit}` };
  };

  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    async function loadProperty() {
      if (!adminId || !propertyId) {
        setIsLoading(false);
        return;
      }
      try {
        // Vía API server-side (no lectura directa de Firestore desde el cliente):
        // el documento de propiedad puede traer contacto del propietario, que la
        // API redacta antes de responder. Ver src/lib/redact-public-property.ts.
        const res = await fetch(`/api/public/property?adminId=${encodeURIComponent(adminId)}&propertyId=${encodeURIComponent(propertyId)}`);
        if (res.ok) {
          const { property } = await res.json();
          setProperty(property as Property);
        }
      } catch (e) {
        console.error("Error loading property", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProperty();
  }, [adminId, propertyId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4194304) {
      toast({
        title: "Archivo demasiado grande",
        description: "Por favor suba archivos menores a 4 MB.",
        variant: "destructive"
      });
      return;
    }

    setUploadingFiles(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const newDoc: DocumentInfo = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: event.target?.result as string,
        type: type,
        status: 'Validado',
        date: new Date().toLocaleDateString('es-AR')
      };
      setDocuments(prev => [...prev, newDoc]);
      setUploadingFiles(false);
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !db) return;

    if (!isValidTaxId(formData.taxId)) {
      toast({
        title: "CUIT/CUIL inválido",
        description: "Ingresá un CUIT o CUIL de 11 dígitos.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.consent) {
      toast({
        title: "Falta tu autorización",
        description: "Necesitamos que autorices el tratamiento de tus datos para poder evaluar tu postulación.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const solicitudId = Math.random().toString(36).substr(2, 9);
      const solicitudesRef = collection(db, 'artifacts', APP_ID, 'users', adminId, 'solicitudes');
      
      const application: RentalApplication = {
        id: solicitudId,
        propertyId: propertyId || 'general',
        propertyName: property?.name || 'Consulta General',
        applicantName: formData.name,
        applicantEmail: formData.email,
        applicantPhone: formData.phone,
        applicantTaxId: formData.taxId.replace(/\D/g, ''),
        ingreso: parseFloat(formData.income) || 0,
        currency: 'ARS',
        rentAmount: undefined, // se asignará en el análisis IA del admin
        guarantorName: formData.guarantorName || undefined,
        guarantorType: formData.guarantorType !== 'Sin garante' ? formData.guarantorType : undefined,
        guarantorIncome: formData.guarantorIncome ? parseFloat(formData.guarantorIncome) : undefined,
        references: formData.references,
        documents: documents,
        status: 'Nueva',
        submittedAt: new Date().toLocaleDateString('es-AR'),
        ownerId: adminId,
        consentGiven: true,
        consentAt: new Date().toISOString()
      };

      await addDocumentNonBlocking(solicitudesRef, application);
      setIsSuccess(true);
      toast({ title: "Solicitud Enviada", description: "El administrador revisará tu perfil a la brevedad." });
    } catch (e) {
      toast({ title: "Error", description: "No se pudo enviar la solicitud.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 text-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Enlace Inválido</CardTitle>
            <CardDescription>Este link de postulación no es correcto o ha expirado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <div className="bg-green-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-green-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-black">¡Recibido!</CardTitle>
          <CardDescription>
            {property ? (() => {
              const { type, street } = formatPropertyLabel(property);
              return <>Tu solicitud para el <strong>{type}</strong> en <strong>{street}</strong> fue enviada con éxito.</>;
            })() : 'Tu solicitud fue enviada con éxito.'}
            {' '}El equipo de administración se pondrá en contacto contigo pronto.
          </CardDescription>
          <Button variant="outline" className="w-full" onClick={() => window.close()}>Cerrar ventana</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary/10 p-4 rounded-3xl mb-4">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground">Postulación de Alquiler</h1>
          <p className="text-muted-foreground">AlquilaGestión Pro • Portal de Interesados</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase font-black text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Propiedad
                </CardTitle>
              </CardHeader>
              <CardContent>
                {property ? (() => {
                  const { type, street } = formatPropertyLabel(property);
                  return (
                    <>
                      <p className="text-xs font-bold text-primary uppercase tracking-wide mb-0.5">{type}</p>
                      <p className="font-bold text-base leading-snug">{street}</p>
                    </>
                  );
                })() : (
                  <p className="font-bold text-lg text-muted-foreground">Consulta General</p>
                )}
              </CardContent>
            </Card>

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-xs font-bold text-primary mb-2 uppercase">Documentación (opcional)</p>
              <ul className="text-[10px] text-primary/70 space-y-1 list-disc pl-4">
                <li>Recibo de sueldo o Certificación Contable</li>
                <li>DNI (Frente y Dorso)</li>
                <li>Garantía (Recibo, Propiedad o Seguro de Caución)</li>
              </ul>
              <p className="text-[10px] text-primary/50 mt-2 italic">Podés adjuntar los docs ahora o enviarlos después por email a la administración.</p>
            </div>
          </div>

          <Card className="md:col-span-8 bg-white border-none shadow-xl">
            <CardHeader>
              <CardTitle>Tus Datos Personales</CardTitle>
              <CardDescription>Completa la información para que podamos evaluar tu perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="h-3 w-3" /> Nombre Completo</Label>
                  <Input 
                    required 
                    placeholder="Ej: Mariano López"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="h-3 w-3" /> Email de contacto</Label>
                  <Input 
                    required 
                    type="email" 
                    placeholder="mariano@ejemplo.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="h-3 w-3" /> Teléfono</Label>
                  <Input
                    required
                    placeholder="+54 9 11 ..."
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> CUIT / CUIL</Label>
                  <Input
                    required
                    placeholder="20-12345678-9"
                    value={formData.taxId}
                    onChange={e => setFormData({...formData, taxId: formatTaxId(e.target.value)})}
                    className={formData.taxId && !isValidTaxId(formData.taxId) ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {formData.taxId && !isValidTaxId(formData.taxId) && (
                    <p className="text-[10px] text-destructive">Debe tener 11 dígitos</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Ingresos Mensuales (Neto)</Label>
                  <Input
                    required
                    type="number"
                    placeholder="ARS"
                    value={formData.income}
                    onChange={e => setFormData({...formData, income: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" /> Documentación Respaldatoria <span className="text-xs font-normal text-muted-foreground">(opcional, máx. 4 MB por archivo)</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Recibo / Certif. (Inquilino)</Label>
                    <div className="relative">
                      <Input 
                        type="file" 
                        className="text-[10px] cursor-pointer" 
                        onChange={(e) => handleFileChange(e, 'Recibo Sueldo')} 
                        accept=".pdf,image/*"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">DNI (Inquilino)</Label>
                    <Input 
                      type="file" 
                      className="text-[10px] cursor-pointer" 
                      onChange={(e) => handleFileChange(e, 'DNI')} 
                      accept=".pdf,image/*"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Documentación del Garante (Opcional)</Label>
                    <Input 
                      type="file" 
                      className="text-[10px] cursor-pointer" 
                      onChange={(e) => handleFileChange(e, 'Garantía')} 
                      accept=".pdf,image/*"
                    />
                  </div>
                </div>

                {documents.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[10px] font-bold text-muted-foreground">Archivos cargados:</p>
                    <div className="flex flex-wrap gap-2">
                      {documents.map((doc) => (
                        <Badge key={doc.id} variant="secondary" className="gap-2 px-3 py-1">
                          <FileCheck className="h-3 w-3" />
                          <span className="max-w-[100px] truncate">{doc.name}</span>
                          <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeDoc(doc.id)} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {uploadingFiles && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Procesando archivo...
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Garantía
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Garantía</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.guarantorType}
                      onChange={e => setFormData({...formData, guarantorType: e.target.value})}
                    >
                      <option value="Sin garante">Sin garante</option>
                      <option value="Propietario">Propietario garante</option>
                      <option value="Recibo Sueldo">Garante con recibo de sueldo</option>
                      <option value="Seguro de Caución">Seguro de Caución</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre del Garante</Label>
                    <Input
                      placeholder="Ej: Roberto García"
                      value={formData.guarantorName}
                      onChange={e => setFormData({...formData, guarantorName: e.target.value})}
                    />
                  </div>
                  {formData.guarantorType === 'Recibo Sueldo' && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ingresos del Garante (neto)</Label>
                      <Input
                        type="number"
                        placeholder="ARS"
                        value={formData.guarantorIncome}
                        onChange={e => setFormData({...formData, guarantorIncome: e.target.value})}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2"><FileText className="h-3 w-3" /> Comentarios Adicionales</Label>
                <Textarea
                  placeholder="Contanos sobre tu actividad laboral, relación laboral, o cualquier dato relevante..."
                  className="min-h-[80px]"
                  value={formData.references}
                  onChange={e => setFormData({...formData, references: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-4">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={e => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  Autorizo a la administración a tratar mis datos personales (incluyendo situación crediticia ante el
                  BCRA e ingresos declarados) para evaluar esta postulación, conforme a la{' '}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Política de Privacidad
                  </a>.
                </span>
              </label>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-lg font-bold gap-2"
                disabled={isSubmitting || uploadingFiles || !formData.consent}
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Enviar Postulación
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <ApplyPageContent />
    </Suspense>
  );
}
