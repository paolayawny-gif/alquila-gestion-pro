'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Crown, Building2, Users, Plus, CheckCircle2, Clock, XCircle,
  BarChart3, Mail, Phone, Globe, Calendar, Settings, Trash2, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

interface Organization {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  phone?: string;
  website?: string;
  plan: 'Básico' | 'Profesional' | 'Enterprise';
  status: 'Activa' | 'Suspendida' | 'Pendiente';
  createdAt: string;
  notes?: string;
  maxProperties?: number;
  maxUsers?: number;
}

interface SuperAdminViewProps {
  userId?: string;
  userEmail: string;
}

const PLAN_CONFIG = {
  'Básico': { color: 'bg-slate-100 text-slate-700', maxProps: 10, maxUsers: 1 },
  'Profesional': { color: 'bg-blue-100 text-blue-700', maxProps: 50, maxUsers: 5 },
  'Enterprise': { color: 'bg-amber-100 text-amber-700', maxProps: 999, maxUsers: 999 },
};

const STATUS_CONFIG = {
  'Activa': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Suspendida': { color: 'bg-red-100 text-red-700', icon: XCircle },
  'Pendiente': { color: 'bg-orange-100 text-orange-700', icon: Clock },
};

export function SuperAdminView({ userId, userEmail }: SuperAdminViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const [form, setForm] = useState({
    name: '',
    ownerEmail: '',
    ownerName: '',
    phone: '',
    website: '',
    plan: 'Profesional' as Organization['plan'],
    notes: '',
  });

  // Load organizations from Firestore
  const orgsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'));
  }, [db, user]);
  const { data: orgsData } = useCollection<Organization>(orgsQuery);
  const organizations: Organization[] = orgsData || [];

  // Only allow access for super admin
  if (userEmail !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <XCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-foreground">Acceso Restringido</h2>
        <p className="text-muted-foreground text-sm">Esta sección es exclusiva del Super Administrador.</p>
      </div>
    );
  }

  const stats = useMemo(() => {
    const active = organizations.filter(o => o.status === 'Activa').length;
    const pending = organizations.filter(o => o.status === 'Pendiente').length;
    const enterprise = organizations.filter(o => o.plan === 'Enterprise').length;
    return { total: organizations.length, active, pending, enterprise };
  }, [organizations]);

  const handleCreateOrg = async () => {
    if (!form.name || !form.ownerEmail) {
      toast({ title: 'Faltan datos obligatorios', description: 'Nombre de la inmobiliaria y email del responsable son requeridos.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const id = `org_${Date.now()}`;
    const planCfg = PLAN_CONFIG[form.plan];
    const ref = doc(collection(db!, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), id);
    setDocumentNonBlocking(ref, {
      id,
      name: form.name,
      ownerEmail: form.ownerEmail.toLowerCase().trim(),
      ownerName: form.ownerName,
      phone: form.phone || undefined,
      website: form.website || undefined,
      plan: form.plan,
      status: 'Pendiente',
      createdAt: new Date().toISOString(),
      notes: form.notes || undefined,
      maxProperties: planCfg.maxProps,
      maxUsers: planCfg.maxUsers,
    } as Organization, {});
    toast({ title: '✅ Organización creada', description: `${form.name} agregada con plan ${form.plan}. Estado: Pendiente de activación.` });
    setForm({ name: '', ownerEmail: '', ownerName: '', phone: '', website: '', plan: 'Profesional', notes: '' });
    setShowNewOrgDialog(false);
    setIsSaving(false);
  };

  const handleChangeStatus = (org: Organization, status: Organization['status']) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    setDocumentNonBlocking(ref, { status }, { merge: true });
    toast({ title: `Estado actualizado`, description: `${org.name} → ${status}` });
  };

  const handleDeleteOrg = (org: Organization) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    deleteDocumentNonBlocking(ref);
    setSelectedOrg(null);
    toast({ title: 'Organización eliminada', description: org.name });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <Crown className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Panel Super Admin</h2>
            <p className="text-sm text-muted-foreground">Gestión de organizaciones y planes — AlquilaGestión Pro</p>
          </div>
        </div>
        <Button onClick={() => setShowNewOrgDialog(true)} className="bg-primary text-white gap-2 font-bold">
          <Plus className="h-4 w-4" /> Nueva Organización
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orgs', value: stats.total, icon: Building2, color: 'text-primary' },
          { label: 'Activas', value: stats.active, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-orange-500' },
          { label: 'Enterprise', value: stats.enterprise, icon: Crown, color: 'text-amber-600' },
        ].map(kpi => (
          <Card key={kpi.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted/30 rounded-lg">
                <kpi.icon className={cn('h-5 w-5', kpi.color)} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{kpi.label}</p>
                <p className="text-2xl font-black">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Organizations list */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Organizaciones registradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {organizations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="p-4 bg-muted/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground">No hay organizaciones registradas</p>
              <p className="text-sm text-muted-foreground">Creá la primera inmobiliaria o gestor de alquileres</p>
              <Button variant="outline" className="mt-2 gap-2" onClick={() => setShowNewOrgDialog(true)}>
                <Plus className="h-4 w-4" /> Crear organización
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {organizations.map(org => {
                const StatusIcon = STATUS_CONFIG[org.status].icon;
                return (
                  <div key={org.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedOrg(org)}>
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate">{org.name}</p>
                        <Badge className={cn('text-[10px] px-2 py-0 font-bold border-0', STATUS_CONFIG[org.status].color)}>
                          <StatusIcon className="h-2.5 w-2.5 mr-1" />{org.status}
                        </Badge>
                        <Badge className={cn('text-[10px] px-2 py-0 font-bold border-0', PLAN_CONFIG[org.plan].color)}>
                          {org.plan}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{org.ownerName} · {org.ownerEmail}</p>
                    </div>
                    <div className="text-right shrink-0 hidden md:block">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Organization Dialog */}
      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Nueva Organización
            </DialogTitle>
            <DialogDescription>
              Registrá una nueva inmobiliaria o gestor de alquileres en la plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase">Nombre de la organización *</Label>
                <Input placeholder="Ej: Inmobiliaria García & Asociados" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Nombre del responsable</Label>
                <Input placeholder="Ej: Carlos García" value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Email del responsable *</Label>
                <Input type="email" placeholder="carlos@inmobiliaria.com" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Teléfono</Label>
                <Input placeholder="+54 11 ..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Plan</Label>
                <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v as Organization['plan'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Básico">Básico (hasta 10 propiedades)</SelectItem>
                    <SelectItem value="Profesional">Profesional (hasta 50 propiedades)</SelectItem>
                    <SelectItem value="Enterprise">Enterprise (ilimitado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase">Notas internas</Label>
                <Input placeholder="Ej: cliente referido por Juan, descuento 20%" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewOrgDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrg} disabled={isSaving} className="bg-primary text-white gap-2">
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear organización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organization detail dialog */}
      {selectedOrg && (
        <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> {selectedOrg.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2 flex-wrap">
                <Badge className={cn('font-bold border-0', STATUS_CONFIG[selectedOrg.status].color)}>{selectedOrg.status}</Badge>
                <Badge className={cn('font-bold border-0', PLAN_CONFIG[selectedOrg.plan].color)}>{selectedOrg.plan}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Responsable</p><p className="font-semibold">{selectedOrg.ownerName || '—'}</p></div>
                <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Email</p><p className="font-semibold truncate">{selectedOrg.ownerEmail}</p></div>
                {selectedOrg.phone && <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Teléfono</p><p className="font-semibold">{selectedOrg.phone}</p></div>}
                <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Alta</p><p className="font-semibold">{new Date(selectedOrg.createdAt).toLocaleDateString('es-AR')}</p></div>
                <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Propiedades max</p><p className="font-semibold">{selectedOrg.maxProperties}</p></div>
                <div><p className="text-[10px] font-bold text-muted-foreground uppercase">Usuarios max</p><p className="font-semibold">{selectedOrg.maxUsers}</p></div>
              </div>
              {selectedOrg.notes && (
                <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800">{selectedOrg.notes}</div>
              )}
              <Separator />
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Cambiar estado</p>
                <div className="flex gap-2 flex-wrap">
                  {(['Activa', 'Pendiente', 'Suspendida'] as Organization['status'][]).map(s => (
                    <Button key={s} size="sm" variant={selectedOrg.status === s ? 'default' : 'outline'}
                      className={cn('text-xs font-bold', selectedOrg.status === s && 'bg-primary text-white')}
                      onClick={() => { handleChangeStatus(selectedOrg, s); setSelectedOrg({ ...selectedOrg, status: s }); }}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" className="text-red-600 gap-2" onClick={() => handleDeleteOrg(selectedOrg)}>
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
              <Button variant="outline" onClick={() => setSelectedOrg(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
