'use client';

import { createContext, useContext } from 'react';

export interface OrgPermissions {
  canWrite: boolean;
  canDelete: boolean;
}

const OrgPermissionsContext = createContext<OrgPermissions>({
  canWrite: true,
  canDelete: true,
});

export const useOrgPermissions = () => useContext(OrgPermissionsContext);

export const OrgPermissionsProvider = OrgPermissionsContext.Provider;
