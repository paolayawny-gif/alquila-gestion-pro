'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, Flame, Building2, Mail, Send, DollarSign, Info, ShieldAlert, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { TenantRegistryEntry } from './tenant-portal';
import { Property } from '@/lib/types';

const APP_ID = 'alquilagestion-pro';

type PolicyType = 'Incendio' | 'Responsabilidad Civil' | 'Integral Hogar' | 'Robo y Hurto';

const POLICY_OPTIONS: { id: PolicyType; label: string; icon: React.ElementType; description: string; color: string }[] = [
  {
    id: 'Incendio',
    label: 'Incendio (Ley 13.512)',
    icon: Flame,
    description: 'Obligatorio en PH. Cubre daños por incendio, explosión y rayo.',
    color: 'border-red-200 bg-red-50 text-red-700',
  },
  {
    id: 'Responsabilidad Civil',
    label: 'Responsabilidad Civil',
    icon: ShieldCheck,
    description: 'Cubre daños a terceros causados desde tu unidad.',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    id: 'Integral Hogar',
    label: 'Integral Hogar',
    icon: Building2,
    description: 'Multirriesgo completo: incendio, robo, agua, RC y más.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    id: 'Robo y Hurto',
    label: 'Robo y Hurto',
    icon: ShieldAlert,
    description: 'Cubre bienes personales ante robo con fractura.',
    color: 'border-amber-200 bg-amber-50 text-amber-700',
  },
];

const INSURERS = [
  'San Cristóbal', 'Sancor Seguros', 'Zurich', 'Mapfre',
  'Federación Patronal', 'Allianz', 'La Segunda', 'Otro',
];

interface TenantInsuranceProps {
  tenantEntry: TenantRegistryEntry;
}

export function TenantInsurance({ tenantEntry }: TenantInsuranceProps) {
  const db = useFirestore();
  const { user } = useUser();
  const [property, setProperty] = useState<Property | null>(null);
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);
  const [insurer,    setInsurer]    = useState('San Cristóbal');
  const [coverage,   setCoverage]   = useState('');
  const [ownerName,  setOwnerName]  = useState(tenantEntry.tenantName);
  const [ownerCuit,  setOwnerCuit]  = useState('');
  const [phone,      setPhone]      = useState('');
  const [notes,      setNotes]      = useState('');
  const [sent,       setSent]       = useState(false);

  // Load property data from admin namespace
  useEffect(() => {
    if (!db || !tenantEntry.adminId || !tenantEntry.propertyId) return;
    getDoc(doc(db, 'artifacts', APP_ID, 'users', tenantEntry.adminId, 'propiedades', tenantEntry.propertyId))
      .then(snap => { if (snap.exists()) setProperty(snap.data() as Property); })
      .catch(() => {});
  }, [db, tenantEntry.adminId, tenantEntry.propertyId]);

  const handleRequest = () => {
    if (!selectedType) return;
    const coverageStr = coverage ? `$${parseInt(coverage).toLocaleString('es-AR')}` : 'A cotizar';
    const lines = [
      `Estimado equipo de ${insurer},`,
      '',
      'Solicito cotización de seguro para mi unidad:',
      '',
      `Tipo de cobertura: ${selectedType}`,
      `Propiedad:         ${tenantEntry.propertyName}`,
      `Dirección:         ${property?.address ?? 'Ver datos adjuntos'}`,
      `Superficie:        ${property?.squareMeters ? property.squareMeters + ' m²' : 'A confirmar'}`,
      `Suma a asegurar:   ${coverageStr}`,
      '',
      `Asegurado:  ${ownerName}`,
      `CUIT / DNI: ${ownerCuit || 'A confirmar'}`,
      `Teléfono:   ${phone || 'A confirmar'}`,
      `Email:      ${tenantEntry.tenantEmail}`,
    ];
    if (notes) lines.push('', `Observaciones: ${notes}`);
    lines.push('', `Plataforma: AlquilaGestion Pro`);

    const subject = encodeURIComponent(`Solicitud cotización ${selectedType} · ${tenantEntry.propertyName}`);
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(lines.join('\n'))}`, '_blank');
    setSent(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black">Seguros</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Solicitá cotizaciones para asegurar tu unidad. Los datos de tu propiedad se pre-completan automáticamente.
        </p>
      </div>

      {sent ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xl font-black text-foreground">¡Solicitud preparada!</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              Se abrió tu cliente de correo con el email pre-formateado.
              Completá el destinatario con el email del broker o la aseguradora.
            </p>
            <Button className="mt-6 gap-2 font-bold" onClick={() => { setSent(false); setSelectedType(null); }}>
              <Shield className="h-4 w-4" /> Nueva cotización
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Policy type selector */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black">¿Qué tipo de seguro necesitás?</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POLICY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const sel  = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedType(opt.id)}
                    className={cn(
                      'text-left p-4 rounded-xl border-2 transition-all',
                      sel ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', opt.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="font-black text-sm">{opt.label}</p>
                      {sel && <div className="ml-auto h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">✓</span>
                      </div>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {selectedType && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black">Datos para la cotización</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Property info (read-only) */}
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                  <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">{tenantEntry.propertyName}</p>
                    <p className="text-[11px] text-muted-foreground">{property?.address ?? 'Dirección cargando…'}</p>
                    {property?.squareMeters && (
                      <p className="text-[11px] text-muted-foreground">{property.squareMeters} m²</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Aseguradora</Label>
                    <Select value={insurer} onValueChange={setInsurer}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Suma a asegurar ($)</Label>
                    <Input type="number" placeholder="Ej: 5000000" value={coverage} onChange={e => setCoverage(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tu nombre completo</Label>
                    <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CUIT / DNI</Label>
                    <Input placeholder="20-12345678-0" value={ownerCuit} onChange={e => setOwnerCuit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Teléfono</Label>
                    <Input placeholder="+54 11 1234-5678" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observaciones (opcional)</Label>
                  <Textarea
                    placeholder="Detalles adicionales, urgencia, condiciones especiales…"
                    className="min-h-[60px]"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {selectedType === 'Incendio' && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Flame className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      <strong>Seguro obligatorio:</strong> La Ley 13.512 exige póliza de incendio en consorcios de PH.
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Se abre tu cliente de correo con el email pre-formateado. Completá el destinatario con el email de la aseguradora o tu broker.
                  </p>
                </div>

                <Button className="w-full gap-2 font-bold bg-primary" onClick={handleRequest}>
                  <Mail className="h-4 w-4" /> Generar solicitud de cotización
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
