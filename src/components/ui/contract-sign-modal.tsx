'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Contract, SignerRole } from '@/lib/types';
import { authedFetch } from '@/lib/authed-fetch';
import { CheckCircle2, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(amount: number, currency: string): string {
  const prefix = currency === 'USD' ? 'U$D ' : '$ ';
  return prefix + amount.toLocaleString('es-AR');
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractSignModalProps {
  open: boolean;
  onClose: () => void;
  contract: Contract;
  adminId: string;
  signerEmail: string;
  signerName: string;
  signerRole: SignerRole;
  onSigned?: () => void;
}

type Step = 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Revisión' },
  { id: 2, label: 'Firma' },
  { id: 3, label: 'Confirmación' },
];

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                done  && 'bg-emerald-600 border-emerald-600 text-white',
                active && 'bg-primary border-primary text-white',
                !done && !active && 'bg-muted border-muted-foreground/30 text-muted-foreground',
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={cn(
                'text-xs whitespace-nowrap',
                active ? 'text-primary font-medium' : 'text-muted-foreground',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-4 rounded',
                done ? 'bg-emerald-500' : 'bg-muted',
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ContractSignModal({
  open,
  onClose,
  contract,
  adminId,
  signerEmail,
  signerName,
  signerRole,
  onSigned,
}: ContractSignModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [accepted, setAccepted] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  function handleClose() {
    // Reset state when modal closes
    setStep(1);
    setAccepted(false);
    setSig(null);
    setSubmitting(false);
    setSignedAt(null);
    onClose();
  }

  async function handleSubmit() {
    if (!sig || !accepted) return;
    setStep(3);
    setSubmitting(true);

    try {
      const hashInput = `${contract.id}|${contract.tenantEmail}|${contract.propertyId}|${contract.startDate}|${contract.endDate}|${contract.baseRentAmount}|${contract.currency}`;
      const documentHash = await sha256(hashInput);

      const res = await authedFetch('/api/signature', {
        method: 'POST',
        body: JSON.stringify({
          adminId,
          contractId: contract.id,
          signerEmail,
          signerName,
          signerRole,
          signatureImage: sig,
          documentHash,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const now = new Date().toISOString();
      setSignedAt(now);
      setSubmitting(false);
      onSigned?.();
    } catch (err: any) {
      setSubmitting(false);
      setStep(2);
      toast({
        title: 'Error al registrar la firma',
        description: err.message ?? 'Intentá de nuevo en unos segundos.',
        variant: 'destructive',
      });
    }
  }

  // ── Render step content ──────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        {/* Key terms card */}
        <Card className="border-primary/20">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Propiedad</p>
                <p className="font-medium">{contract.propertyName ?? contract.propertyId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inquilino</p>
                <p className="font-medium">{contract.tenantName ?? contract.tenantEmail ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Período</p>
                <p className="font-medium">{fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alquiler mensual</p>
                <p className="font-medium">{fmtMoney(contract.baseRentAmount, contract.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Depósito</p>
                <p className="font-medium">{fmtMoney(contract.depositAmount, contract.depositCurrency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ajuste</p>
                <p className="font-medium">
                  {contract.adjustmentMechanism ?? contract.adjustmentType}
                  {contract.adjustmentFrequencyMonths
                    ? ` · cada ${contract.adjustmentFrequencyMonths} mes${contract.adjustmentFrequencyMonths !== 1 ? 'es' : ''}`
                    : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full transcription */}
        {contract.fullTranscription && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Texto completo del contrato</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">
                {contract.fullTranscription}
              </pre>
            </div>
          </div>
        )}

        {/* Existing signatures */}
        {contract.signatures && contract.signatures.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Firmas registradas</p>
            <div className="flex flex-wrap gap-2">
              {contract.signatures.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 bg-emerald-50 text-xs"
                >
                  ✓ Firmado por {s.signerName} el {fmtDate(s.signedAt)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        {/* Legal disclaimer */}
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
          Al firmar este documento confirmás haber leído y aceptado los términos del contrato. Esta firma
          electrónica tiene validez legal conforme a la Ley 25.506 de Firma Digital de la República Argentina.
        </p>

        {/* Acceptance checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={v => setAccepted(!!v)}
            className="mt-0.5"
          />
          <Label htmlFor="accept-terms" className="text-sm leading-snug cursor-pointer">
            Declaro haber leído y acepto los términos del contrato
          </Label>
        </div>

        {/* Signature pad */}
        <div>
          <p className="text-sm font-medium mb-2">Tu firma</p>
          <SignaturePad onChange={setSig} />
        </div>
      </div>
    );
  }

  function renderStep3() {
    if (submitting) {
      return (
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-base font-medium text-muted-foreground">Registrando firma...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-emerald-700">¡Firma registrada exitosamente!</p>
          {signedAt && (
            <p className="text-sm text-muted-foreground">
              Registrada el {fmtDate(signedAt)} a las{' '}
              {new Date(signedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Dialog footer ────────────────────────────────────────────────────────

  function renderFooter() {
    if (step === 1) {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => setStep(2)}>
            Siguiente →
          </Button>
        </DialogFooter>
      );
    }
    if (step === 2) {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
          <Button
            onClick={handleSubmit}
            disabled={!accepted || !sig}
          >
            Confirmar firma →
          </Button>
        </DialogFooter>
      );
    }
    if (step === 3 && !submitting) {
      return (
        <DialogFooter>
          <Button onClick={handleClose}>Cerrar</Button>
        </DialogFooter>
      );
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Firma electrónica de contrato</DialogTitle>
        </DialogHeader>

        <Stepper current={step} />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
