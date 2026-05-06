'use client';

import React from 'react';
import { CommunityWallView } from '@/components/dashboard/community-wall-view';
import { TenantRegistryEntry } from './tenant-portal';
import { useUser } from '@/firebase';

interface TenantCommunityProps {
  tenantEntry: TenantRegistryEntry;
}

export function TenantCommunity({ tenantEntry }: TenantCommunityProps) {
  const { user } = useUser();

  return (
    <CommunityWallView
      userId={user?.uid}
      userEmail={tenantEntry.tenantEmail}
      userName={tenantEntry.tenantName}
      propertyFilter={tenantEntry.propertyId}
      propertyFilterName={tenantEntry.propertyName}
    />
  );
}
