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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Crown, Building2, Users, Plus, CheckCircle2, Clock, XCircle,
  Trash2, RefreshCw, UserPlus, ShieldCheck, Eye, Pencil, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  phone?: string;
  plan: 'Básico' | 'Profesional' | 'Enterprise';
  status: 'Activa' | 'Suspendida' | 'Pendiente';
  createdAt: string;
  notes?: string;
  maxProperties?: number;
  maxUsers?: number;
}

type OrgUserRole = 'Administrador' | 'Agente' | 'Solo lectura';

interface OrgUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: OrgUserRole;
  status: 'Activo' | 'Invitado' | 'Suspendido';
  addedAt: string;
}

interface SuperAdminViewProps {
  userId?: string;
  userEmail: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLAN_CONFIG = {
  'Básico':       { color: 'bg-slate-100 text-slate-700',  maxProps: 10,  maxUsers: 1 },
  'Profesional':  { color: 'bg-blue-100 text-blue-700',    maxProps: 50,  maxUsers: 5 },
  'Enterprise':   { color: 'bg-amber-100 text-amber-700',  maxProps: 999, maxUsers: 999 },
};

const STATUS_CONFIG = {
  'Activa':      { color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  'Suspendida':  { color: 'bg-red-100 text-red-700',       icon: XCircle },
  'Pendiente':   { color: 'bg-orange-100 text-orange-700', icon: Clock },
};

const ROLE_CONFIG: Record<OrgUserRole, { color: string; desc: string }> = {
  'Administrador': { color: 'bg-primary/10 text-primary', desc: 'Acceso total: crear, editar, eliminar todo' },
  'Agente':        { color: 'bg-blue-100 text-blue-700',  desc: 'Puede gestionar propiedades, contratos y facturas. No puede eliminar.' },
  'Solo lectura':  { color: 'bg-slate-100 text-slate-600', desc: 'Solo puede ver los datos, sin modificaciones.' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminView({ userId, userEmail }: SuperAdminViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  // — Org state —
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: '', ownerEmail: '', ownerName: '', phone: '',
    plan: 'Profesional' as Organization['plan'], notes: '',
  });

  // — User state —
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '', name: '', role: 'Agente' as OrgUserRole,
  });

  // — Email config state —
  const [emailForm, setEmailForm] = useState({ emailUser: '', emailPass: '' });
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // — Load organizations —
  const orgsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'));
  }, [db, user]);
  const { data: orgsData } = useCollection<Organization>(orgsQuery);
  const organizations: Organization[] = orgsData || [];

  // — Load users for selected org —
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedOrg) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'));
  }, [db, user, selectedOrg]);
  const { data: allUsersData } = useCollection<OrgUser>(usersQuery);
  const orgUsers = (allUsersData || []).filter(u => u.orgId === selectedOrg?.id);

  // Access guard
  if (userEmail !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 rounded-full"><XCircle className="h-12 w-12 text-red-500" /></div>
        <h2 className="text-xl font-black">Acceso Restringido</h2>
        <p className="text-muted-foreground text-sm">Esta sección es exclusiva del Super Administrador.</p>
      </div>
    );
  }

  const stats = useMemo(() => ({
    total: organizations.length,
    active: organizations.filter(o => o.status === 'Activa').length,
    pending: organizations.filter(o => o.status === 'Pendiente').length,
    enterprise: organizations.filter(o => o.plan === 'Enterprise').length,
  }), [organizations]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (!orgForm.name || !orgForm.ownerEmail) {
      toast({ title: 'Faltan datos', description: 'Nombre e email del responsable son obligatorios.', variant: 'destructive' });
      return;
    }
    if (!db) {
      toast({ title: 'Error de conexión', description: 'Recargá la página e intentá de nuevo.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const id = `org_${Date.now()}`;
      const planCfg = PLAN_CONFIG[orgForm.plan];
      const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), id);
      setDocumentNonBlocking(ref, {
        id,
        name: orgForm.name,
        ownerEmail: orgForm.ownerEmail.toLowerCase().trim(),
        ownerName: orgForm.ownerName,
        phone: orgForm.phone || undefined,
        plan: orgForm.plan,
        status: 'Pendiente',
        createdAt: new Date().toISOString(),
        notes: orgForm.notes || undefined,
        maxProperties: planCfg.maxProps,
        maxUsers: planCfg.maxUsers,
      } as Organization, {});
      toast({ title: '✅ Organización creada', description: `${orgForm.name} — Plan ${orgForm.plan} — Estado: Pendiente` });
      setOrgForm({ name: '', ownerEmail: '', ownerName: '', phone: '', plan: 'Profesional', notes: '' });
      setShowNewOrgDialog(false);
    } catch (err: any) {
      toast({ title: 'Error al crear', description: err?.message ?? 'Algo salió mal.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeOrgStatus = (org: Organization, status: Organization['status']) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    setDocumentNonBlocking(ref, { status }, { merge: true });
    if (selectedOrg?.id === org.id) setSelectedOrg({ ...org, status });
    toast({ title: `Estado actualizado`, description: `${org.name} → ${status}` });
  };

  const handleDeleteOrg = (org: Organization) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), org.id);
    deleteDocumentNonBlocking(ref);
    setSelectedOrg(null);
    toast({ title: 'Organización eliminada', description: org.name });
  };

  const handleAddUser = async () => {
    if (!userForm.email || !selectedOrg) {
      toast({ title: 'Email requerido', variant: 'destructive' }); return;
    }
    if (!db) {
      toast({ title: 'Error de conexión', variant: 'destructive' }); return;
    }
    // Check max users
    const currentCount = orgUsers.filter(u => u.status !== 'Suspendido').length;
    const maxUsers = PLAN_CONFIG[selectedOrg.plan].maxUsers;
    if (currentCount >= maxUsers) {
      toast({ title: `Límite de usuarios alcanzado`, description: `El plan ${selectedOrg.plan} permite hasta ${maxUsers} usuario(s). Actualizá el plan.`, variant: 'destructive' });
      return;
    }
    setIsSavingUser(true);
    try {
      const id = `orguser_${Date.now()}`;
      const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), id);
      setDocumentNonBlocking(ref, {
        id,
        orgId: selectedOrg.id,
        email: userForm.email.toLowerCase().trim(),
        name: userForm.name,
        role: userForm.role,
        status: 'Invitado',
        addedAt: new Date().toISOString(),
      } as OrgUser, {});
      toast({ title: '✅ Usuario agregado', description: `${userForm.email} — Rol: ${userForm.role}` });
      setUserForm({ email: '', name: '', role: 'Agente' });
      setShowAddUserDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo agregar el usuario.', variant: 'destructive' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleChangeUserRole = (orgUser: OrgUser, role: OrgUserRole) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    setDocumentNonBlocking(ref, { role }, { merge: true });
    toast({ title: 'Rol actualizado', description: `${orgUser.email} → ${role}` });
  };

  const handleToggleUserStatus = (orgUser: OrgUser) => {
    if (!db) return;
    const newStatus = orgUser.status === 'Suspendido' ? 'Activo' : 'Suspendido';
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    setDocumentNonBlocking(ref, { status: newStatus }, { merge: true });
    toast({ title: `Usuario ${newStatus}`, description: orgUser.email });
  };

  const handleSaveEmailConfig = () => {
    if (!db || !selectedOrg) return;
    setIsSavingEmail(true);
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'), selectedOrg.id);
    setDocumentNonBlocking(ref, {
      emailUser: emailForm.emailUser.trim() || null,
      emailPass: emailForm.emailPass.trim() || null,
    }, { merge: true });
    toast({ title: '✅ Email configurado', description: emailForm.emailUser ? `Correos saldrán desde ${emailForm.emailUser}` : 'Se usará el email de la plataforma.' });
    setIsSavingEmail(false);
  };

  const handleDeleteUser = (orgUser: OrgUser) => {
    if (!db) return;
    const ref = doc(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'), orgUser.id);
    deleteDocumentNonBlocking(ref);
    toast({ title: 'Usuario eliminado', description: orgUser.email });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl"><Crown className="h-6 w-6 text-amber-600" /></div>
          <div>
            <h2 className="text-2xl font-black">Panel Super Admin</h2>
            <p className="text-sm text-muted-foreground">Gestión de organizaciones — AlquilaGestión Pro</p>
          </div>
        </div>
        <Button onClick={() => setShowNewOrgDialog(true)} className="bg-primary text-white gap-2 font-bold">
          <Plus className="h-4 w-4" /> Nueva Organización
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Building2, color: 'text-primary' },
          { label: 'Activas', value: stats.active, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-orange-500' },
          { label: 'Enterprise', value: stats.enterprise, icon: Crown, color: 'text-amber-600' },
        ].map(k => (
          <Card key={k.label} className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted/30 rounded-lg"><k.icon className={cn('h-5 w-5', k.color)} /></div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{k.label}</p>
                <p className="text-2xl font-black">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: org list */}
        <Card className="border-none shadow-sm bg-white lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Organizaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {organizations.length === 0 ? (
              <div className="py-12 text-center space-y-3 px-4">
                <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Sin organizaciones aún</p>
                <Button size="sm" variant="outline" onClick={() => setShowNewOrgDialog(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Crear primera
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {organizations.map(org => {
                  const StatusIcon = STATUS_CONFIG[org.status].icon;
                  return (
                    <button key={org.id} onClick={() => setSelectedOrg(org)}
                      className={cn('w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3',
                        selectedOrg?.id === org.id && 'bg-primary/5 border-l-2 border-primary')}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{org.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className={cn('text-[9px] px-1.5 py-0 border-0 font-bold', STATUS_CONFIG[org.status].color)}>
                            {org.status}
                          </Badge>
                          <Badge className={cn('text-[9px] px-1.5 py-0 border-0 font-bold', PLAN_CONFIG[org.plan].color)}>
                            {org.plan}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: org detail */}
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          {!selectedOrg ? (
            <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Seleccioná una organización para ver sus detalles y usuarios</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedOrg.name}</CardTitle>
                    <CardDescription>{selectedOrg.ownerEmail}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={cn('font-bold border-0', STATUS_CONFIG[selectedOrg.status].color)}>{selectedOrg.status}</Badge>
                    <Badge className={cn('font-bold border-0', PLAN_CONFIG[selectedOrg.plan].color)}>{selectedOrg.plan}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="info">
                  <TabsList className="bg-muted/40 mb-4">
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="users">
                      Usuarios ({orgUsers.length}/{PLAN_CONFIG[selectedOrg.plan].maxUsers === 999 ? '∞' : PLAN_CONFIG[selectedOrg.plan].maxUsers})
                    </TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                  </TabsList>

                  {/* Info tab */}
                  <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: 'Responsable', value: selectedOrg.ownerName || '—' },
                        { label: 'Email', value: selectedOrg.ownerEmail },
                        { label: 'Teléfono', value: selectedOrg.phone || '—' },
                        { label: 'Alta', value: new Date(selectedOrg.createdAt).toLocaleDateString('es-AR') },
                        { label: 'Props. máx', value: String(selectedOrg.maxProperties) },
                        { label: 'Usuarios máx', value: selectedOrg.maxUsers === 999 ? 'Ilimitado' : String(selectedOrg.maxUsers) },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-[10px] font-black uppercase text-muted-foreground">{item.label}</p>
                          <p className="font-semibold truncate">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedOrg.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">{selectedOrg.notes}</div>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase text-muted-foreground">Cambiar estado</p>
                      <div className="flex gap-2 flex-wrap">
                        {(['Activa', 'Pendiente', 'Suspendida'] as Organization['status'][]).map(s => (
                          <Button key={s} size="sm" variant={selectedOrg.status === s ? 'default' : 'outline'}
                            className={cn('text-xs font-bold', selectedOrg.status === s && 'bg-primary text-white')}
                            onClick={() => handleChangeOrgStatus(selectedOrg, s)}>
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <Button variant="ghost" size="sm" className="text-red-600 gap-2 w-full justify-start"
                      onClick={() => handleDeleteOrg(selectedOrg)}>
                      <Trash2 className="h-4 w-4" /> Eliminar organización permanentemente
                    </Button>
                  </TabsContent>

                  {/* Email tab */}
                  <TabsContent value="email" className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
                      <strong>Por defecto</strong>: los correos salen desde <code>alquilaGestionpro@gmail.com</code> con el nombre de tu organización,
                      y el cliente responde directamente a <strong>{selectedOrg.ownerEmail}</strong>.
                      <br /><br />
                      Si preferís que los correos salgan desde tu propio Gmail, cargá tus credenciales aquí.
                      Necesitás activar <strong>Contraseña de aplicación</strong> en tu cuenta Google.
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase">Gmail de la organización (opcional)</Label>
                        <Input type="email" placeholder="miinmobiliaria@gmail.com"
                          defaultValue={(selectedOrg as any).emailUser ?? ''}
                          onChange={e => setEmailForm(f => ({ ...f, emailUser: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase">Contraseña de aplicación Google</Label>
                        <Input type="password" placeholder="xxxx xxxx xxxx xxxx"
                          defaultValue={(selectedOrg as any).emailPass ?? ''}
                          onChange={e => setEmailForm(f => ({ ...f, emailPass: e.target.value }))} />
                        <p className="text-[10px] text-muted-foreground">
                          Generala en: Cuenta Google → Seguridad → Contraseñas de aplicaciones
                        </p>
                      </div>
                      <Button onClick={handleSaveEmailConfig} disabled={isSavingEmail} size="sm" className="gap-2 bg-primary text-white font-bold w-full">
                        {isSavingEmail ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Guardar configuración de email
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Users tab */}
                  <TabsContent value="users" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Controlá quién accede y qué puede hacer dentro de esta organización.
                      </p>
                      <Button size="sm" onClick={() => setShowAddUserDialog(true)} className="gap-1.5 bg-primary text-white font-bold shrink-0">
                        <UserPlus className="h-3.5 w-3.5" /> Agregar
                      </Button>
                    </div>

                    {/* Role legend */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {(Object.entries(ROLE_CONFIG) as [OrgUserRole, { color: string; desc: string }][]).map(([role, cfg]) => (
                        <div key={role} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                          <Badge className={cn('text-[10px] px-2 py-0 border-0 font-bold shrink-0', cfg.color)}>{role}</Badge>
                          <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {orgUsers.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No hay usuarios en esta organización todavía.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orgUsers.map(u => (
                          <div key={u.id} className={cn('flex items-center gap-3 p-3 rounded-xl border', u.status === 'Suspendido' ? 'opacity-50 bg-muted/20' : 'bg-white')}>
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm shrink-0">
                              {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{u.name || u.email}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <Select value={u.role} onValueChange={v => handleChangeUserRole(u, v as OrgUserRole)}>
                              <SelectTrigger className="h-7 w-36 text-xs border-0 bg-muted/40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Agente">Agente</SelectItem>
                                <SelectItem value="Solo lectura">Solo lectura</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                title={u.status === 'Suspendido' ? 'Activar' : 'Suspender'}
                                onClick={() => handleToggleUserStatus(u)}>
                                {u.status === 'Suspendido'
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                  : <XCircle className="h-3.5 w-3.5 text-orange-500" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                title="Eliminar usuario"
                                onClick={() => handleDeleteUser(u)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* New Org Dialog */}
      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Nueva Organización
            </DialogTitle>
            <DialogDescription>Registrá una nueva inmobiliaria o gestor de alquileres.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre de la organización *</Label>
              <Input placeholder="Ej: Inmobiliaria García & Asociados" value={orgForm.name}
                onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre del responsable</Label>
              <Input placeholder="Carlos García" value={orgForm.ownerName}
                onChange={e => setOrgForm({ ...orgForm, ownerName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Email del responsable *</Label>
              <Input type="email" placeholder="carlos@inmobiliaria.com" value={orgForm.ownerEmail}
                onChange={e => setOrgForm({ ...orgForm, ownerEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Teléfono</Label>
              <Input placeholder="+54 11 ..." value={orgForm.phone}
                onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Plan</Label>
              <Select value={orgForm.plan} onValueChange={v => setOrgForm({ ...orgForm, plan: v as Organization['plan'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico — hasta 10 propiedades, 1 usuario</SelectItem>
                  <SelectItem value="Profesional">Profesional — hasta 50 propiedades, 5 usuarios</SelectItem>
                  <SelectItem value="Enterprise">Enterprise — ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-bold uppercase">Notas internas</Label>
              <Input placeholder="Ej: cliente referido, descuento acordado..." value={orgForm.notes}
                onChange={e => setOrgForm({ ...orgForm, notes: e.target.value })} />
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

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Agregar Usuario
            </DialogTitle>
            <DialogDescription>
              Agregá un usuario a <strong>{selectedOrg?.name}</strong> con el rol correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Email del usuario *</Label>
              <Input type="email" placeholder="usuario@ejemplo.com" value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre</Label>
              <Input placeholder="Juan García" value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Rol</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v as OrgUserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador — acceso total</SelectItem>
                  <SelectItem value="Agente">Agente — gestión sin eliminar</SelectItem>
                  <SelectItem value="Solo lectura">Solo lectura — no puede modificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn('p-3 rounded-lg text-xs border', ROLE_CONFIG[userForm.role].color)}>
              {ROLE_CONFIG[userForm.role].desc}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={isSavingUser} className="bg-primary text-white gap-2">
              {isSavingUser ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Agregar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
