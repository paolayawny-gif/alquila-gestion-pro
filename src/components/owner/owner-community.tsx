'use client';

import React from 'react';
import { CommunityWallView } from '@/components/dashboard/community-wall-view';
import { OwnerRegistryEntry } from './owner-portal';

interface OwnerCommunityProps {
  ownerEntry: OwnerRegistryEntry;
}

export function OwnerCommunity({ ownerEntry }: OwnerCommunityProps) {
  return (
    <CommunityWallView
      userId={undefined}
      userEmail={ownerEntry.ownerEmail}
      userName={ownerEntry.ownerName}
    />
  );
}
