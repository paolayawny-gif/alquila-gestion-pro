'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PenLine, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contract, ContractSignature } from '@/lib/types';
import { OwnerRegistryEntry } from '@/components/owner/owner-portal';
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

interface OwnerContractSignProps {
  contract: Contract;
  adminId: string;
  ownerEntry: OwnerRegistryEntry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: signature chip
// ─────────────────────────────────────────────────────────────────────────────

function SignatureChip({ sig }: { sig: ContractSignature }) {
  return (
    <Badge
      variant="outline"
      className="border-emerald-300 text-emerald-700 bg-emerald-50 text-xs py-1 px-2.5"
    >
      <CheckCircle2 className="h-3 w-3 mr-1 inline-block" />
      {sig.signerName} ({sig.signerRole})
      {sig.signedAt ? ` · ${fmtDate(sig.signedAt)}` : ''}
    </Badge>
  );
}

function PendingChip({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-amber-300 text-amber-700 bg-amber-50 text-xs py-1 px-2.5"
    >
      <Clock className="h-3 w-3 mr-1 inline-block" />
      {label}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function OwnerContractSign({ contract, adminId, ownerEntry }: OwnerContractSignProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const ownerEmail = ownerEntry.ownerEmail.toLowerCase();
  const tenantEmail = contract.tenantEmail?.toLowerCase();

  const ownerSignature = contract.signatures?.find(
    s => s.signerEmail === ownerEmail,
  );
  const ownerSigned = !!ownerSignature;

  const tenantSignature = tenantEmail
    ? contract.signatures?.find(s => s.signerEmail === tenantEmail)
    : undefined;
  const tenantSigned = !!tenantSignature;

  // Collect all signatures for display
  const allSignatures = contract.signatures ?? [];

  return (
    <>
      <div className="space-y-3">
        {/* Owner signing status / CTA */}
        {ownerSigned ? (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-300 text-emerald-700 bg-emerald-50 text-xs py-1 px-2.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 inline-block" />
              Firmaste este contrato
              {ownerSignature.signedAt ? ` el ${fmtDate(ownerSignature.signedAt)}` : ''}
            </Badge>
          </div>
        ) : (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <PenLine className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-amber-900">
                      Tu contrato requiere tu firma como propietario
                    </p>
                    <p className="text-xs text-amber-700 leading-snug">
                      Revisá los términos y firmá digitalmente. Tiene validez legal conforme a la Ley 25.506.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0"
                >
                  <PenLine className="h-4 w-4 mr-1.5" />
                  Firmar como propietario
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All signatures summary */}
        {(allSignatures.length > 0 || !tenantSigned) && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Estado de firmas
            </p>
            <div className="flex flex-wrap gap-2">
              {allSignatures.map((s, i) => (
                <SignatureChip key={i} sig={s} />
              ))}
              {!tenantSigned && (
                <PendingChip label="Pendiente firma del inquilino" />
              )}
            </div>
          </div>
        )}
      </div>

      <ContractSignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contract={contract}
        adminId={adminId}
        signerEmail={ownerEntry.ownerEmail}
        signerName={ownerEntry.ownerName}
        signerRole="Propietario"
        onSigned={() => setModalOpen(false)}
      />
    </>
  );
}
