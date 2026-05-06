'use client';

import React from 'react';
import { MarketplaceView } from '@/components/dashboard/marketplace-view';
import { TenantRegistryEntry } from './tenant-portal';
import { useUser } from '@/firebase';

interface TenantMarketplaceProps {
  tenantEntry: TenantRegistryEntry;
}

export function TenantMarketplace({ tenantEntry }: TenantMarketplaceProps) {
  const { user } = useUser();

  return (
    <MarketplaceView
      userId={user?.uid}
      userEmail={tenantEntry.tenantEmail}
      userName={tenantEntry.tenantName}
    />
  );
}
