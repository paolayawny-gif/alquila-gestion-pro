'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PenLine, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract } from '@/lib/types';
import { TenantRegistryEntry } from '@/components/tenant/tenant-portal';
import { ContractSignModal } from '@/components/ui/contract-sign-modal';

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface TenantContractSignProps {
  contract: Contract;
  adminId: string;
  tenantEntry: TenantRegistryEntry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TenantContractSign({ contract, adminId, tenantEntry }: TenantContractSignProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const email = tenantEntry.tenantEmail.toLowerCase();
  const existingSignature = contract.signatures?.find(
    s => s.signerEmail === email,
  );
  const alreadySigned = !!existingSignature;

  // ── Already signed ───────────────────────────────────────────────────────
  if (alreadySigned) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700 bg-emerald-50 text-xs py-1 px-2.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 inline-block" />
          Contrato firmado electrónicamente
          {existingSignature.signedAt
            ? ` · ${fmtDate(existingSignature.signedAt)}`
            : ''}
        </Badge>
      </div>
    );
  }

  // ── Pending signature ────────────────────────────────────────────────────
  return (
    <>
      <Card className={cn(
        'border-amber-300 bg-amber-50/60',
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-0.5 h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <PenLine className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-amber-900">
                  Tu contrato requiere firma electrónica
                </p>
                <p className="text-xs text-amber-700 leading-snug">
                  Revisá los términos y firmá el contrato de manera digital. Es rápido y tiene validez legal.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setModalOpen(true)}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
            >
              <PenLine className="h-4 w-4 mr-1.5" />
              Firmar ahora
            </Button>
          </div>
        </CardContent>
      </Card>

      <ContractSignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contract={contract}
        adminId={adminId}
        signerEmail={tenantEntry.tenantEmail}
        signerName={tenantEntry.tenantName}
        signerRole="Inquilino"
        onSigned={() => setModalOpen(false)}
      />
    </>
  );
}
