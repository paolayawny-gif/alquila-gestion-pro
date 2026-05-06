'use client';

import React from 'react';
import { MarketplaceView } from '@/components/dashboard/marketplace-view';
import { OwnerRegistryEntry } from './owner-portal';

interface OwnerMarketplaceProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerMarketplace({ ownerEntry }: OwnerMarketplaceProps) {
  return (
    <MarketplaceView
      userId={undefined}
      userEmail={ownerEntry.ownerEmail}
      userName={ownerEntry.ownerName}
    />
  );
}
