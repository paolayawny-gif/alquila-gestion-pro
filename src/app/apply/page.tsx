"use client";

import React, { useState, useEffect, Suspense } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { doc, getDoc, collection } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Property, RentalApplication } from '@/lib/types';

const APP_ID = "alquilagestion-pro";

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
    income: '',
    references: ''
  });

  useEffect(() => {
    async function loadProperty() {
      if (!db || !adminId || !propertyId) {
        setIsLoading(false);
        return;
      }
      try {
        const propRef = doc(db, 'artifacts', APP_ID, 'users', adminId, 'propiedades', propertyId);
        const snap = await getDoc(propRef);
        if (snap.exists()) {
          setProperty(snap.data() as Property);
        }
      } catch (e) {
        console.error("Error loading property", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProperty();
  }, [db, adminId, propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !db) return;

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
        ingreso: parseFloat(formData.income) || 0,
        references: formData.references,
        documents: [],
        status: 'Nueva',
        submittedAt: new Date().toLocaleDateString('es-AR'),
        ownerId: adminId
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
            Tu solicitud para <strong>{property?.name || 'alquiler'}</strong> ha sido enviada con éxito. 
            El equipo de administración se pondrá en contacto contigo pronto.
          </CardDescription>
          <Button variant="outline" className="w-full" onClick={() => window.close()}>Cerrar ventana</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
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
                <p className="font-bold text-lg">{property?.name || 'Carga General'}</p>
                <p className="text-xs text-muted-foreground">{property?.address || 'Pendiente de asignación'}</p>
              </CardContent>
            </Card>

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-xs font-bold text-primary mb-2 uppercase">Proceso Seguro</p>
              <p className="text-[10px] text-primary/70 leading-relaxed">
                Tus datos están protegidos por encriptación de grado bancario. Solo el administrador verá tu perfil.
              </p>
            </div>
          </div>

          <Card className="md:col-span-8 bg-white border-none shadow-xl">
            <CardHeader>
              <CardTitle>Tus Datos Personales</CardTitle>
              <CardDescription>Completa la información para que podamos evaluar tu perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileText className="h-3 w-3" /> Referencias y Comentarios</Label>
                <Textarea 
                  placeholder="Contanos sobre tu actividad laboral, garantes o cualquier dato relevante..." 
                  className="min-h-[100px]"
                  value={formData.references}
                  onChange={e => setFormData({...formData, references: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-lg font-bold gap-2"
                disabled={isSubmitting}
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
