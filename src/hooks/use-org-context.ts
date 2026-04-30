'use client';

import { useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

const APP_ID = 'alquilagestion-pro';
const SUPER_ADMIN_EMAIL = 'paolayawny@gmail.com';

export type OrgUserRole = 'Administrador' | 'Agente' | 'Solo lectura';

export interface OrgMembership {
  /** El usuario es el super admin de la plataforma */
  isSuperAdmin: boolean;
  /** El usuario pertenece a una organización (como miembro, no como super admin) */
  isOrgUser: boolean;
  /** Nombre de la organización a la que pertenece */
  orgName: string | null;
  /** ID de la organización */
  orgId: string | null;
  /** Email del dueño de la org (para envíos de email con Reply-To) */
  orgOwnerEmail: string | null;
  /** Email configurado para enviar correos (propio de la org, si tiene) */
  orgEmailUser: string | null;
  /** Contraseña de app del email de la org */
  orgEmailPass: string | null;
  /** Rol del usuario dentro de la org */
  role: OrgUserRole | null;
  /** El usuario puede crear y editar registros */
  canWrite: boolean;
  /** El usuario puede eliminar registros */
  canDelete: boolean;
  /** Estado de carga */
  isLoading: boolean;
}

/**
 * Detecta si el usuario logueado es:
 * - Super Admin (paolayawny@gmail.com)
 * - Miembro de una organización (con su rol)
 * - Usuario independiente (no pertenece a ninguna org)
 */
export function useOrgContext(): OrgMembership {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Cargar todos los org_users (el usuario solo puede leer su propio registro por regla Firestore)
  const orgUsersQuery = useMemoFirebase(() => {
    if (!db || !user || isSuperAdmin) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'org_users'));
  }, [db, user, isSuperAdmin]);
  const { data: orgUsersData, isLoading: isLoadingUsers } = useCollection<{
    id: string; orgId: string; email: string; name: string; role: OrgUserRole; status: string;
  }>(orgUsersQuery);

  // Cargar organizaciones (lectura pública para autenticados)
  const orgsQuery = useMemoFirebase(() => {
    if (!db || !user || isSuperAdmin) return null;
    return query(collection(db, 'artifacts', APP_ID, 'superadmin', 'data', 'organizations'));
  }, [db, user, isSuperAdmin]);
  const { data: orgsData, isLoading: isLoadingOrgs } = useCollection<{
    id: string; name: string; ownerEmail: string; status: string;
    emailUser?: string; emailPass?: string;
  }>(orgsQuery);

  return useMemo((): OrgMembership => {
    if (isSuperAdmin) {
      return {
        isSuperAdmin: true, isOrgUser: false,
        orgName: null, orgId: null, orgOwnerEmail: null,
        orgEmailUser: null, orgEmailPass: null,
        role: null, canWrite: true, canDelete: true,
        isLoading: false,
      };
    }

    if (!user || isUserLoading || isLoadingUsers || isLoadingOrgs) {
      return {
        isSuperAdmin: false, isOrgUser: false,
        orgName: null, orgId: null, orgOwnerEmail: null,
        orgEmailUser: null, orgEmailPass: null,
        role: null, canWrite: true, canDelete: true,
        isLoading: true,
      };
    }

    // Buscar si el email del usuario está en algún org_user activo
    const myMembership = (orgUsersData || []).find(
      u => u.email.toLowerCase() === (user.email ?? '').toLowerCase() && u.status !== 'Suspendido'
    );

    if (!myMembership) {
      // Usuario independiente (no está en ninguna org)
      return {
        isSuperAdmin: false, isOrgUser: false,
        orgName: null, orgId: null, orgOwnerEmail: null,
        orgEmailUser: null, orgEmailPass: null,
        role: null, canWrite: true, canDelete: true,
        isLoading: false,
      };
    }

    const myOrg = (orgsData || []).find(o => o.id === myMembership.orgId);
    const role = myMembership.role;

    return {
      isSuperAdmin: false,
      isOrgUser: true,
      orgName: myOrg?.name ?? null,
      orgId: myOrg?.id ?? null,
      orgOwnerEmail: myOrg?.ownerEmail ?? null,
      orgEmailUser: myOrg?.emailUser ?? null,
      orgEmailPass: myOrg?.emailPass ?? null,
      role,
      canWrite: role === 'Administrador' || role === 'Agente',
      canDelete: role === 'Administrador',
      isLoading: false,
    };
  }, [isSuperAdmin, user, isUserLoading, isLoadingUsers, isLoadingOrgs, orgUsersData, orgsData]);
}
