'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface NpsSurveyProps {
  userId?: string;
  contractCount: number;
}

const NPS_KEY = 'nps_last_shown_v1';
const COOLDOWN_DAYS = 90;
const MIN_CONTRACTS = 2;
const WAIT_DAYS = 7;
const SIGNUP_KEY = 'app_first_seen_v1';

function scoreColor(n: number) {
  if (n <= 6) return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
  if (n <= 8) return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200';
  return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
}

function scoreColorSelected(n: number) {
  if (n <= 6) return 'bg-red-500 text-white border-red-500';
  if (n <= 8) return 'bg-amber-500 text-white border-amber-500';
  return 'bg-green-600 text-white border-green-600';
}

export function NpsSurvey({ userId, contractCount }: NpsSurveyProps) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!userId || contractCount < MIN_CONTRACTS) return;

    // Track first-seen date
    if (!localStorage.getItem(SIGNUP_KEY)) {
      localStorage.setItem(SIGNUP_KEY, Date.now().toString());
    }

    const firstSeen = Number(localStorage.getItem(SIGNUP_KEY) ?? 0);
    const daysSinceFirst = (Date.now() - firstSeen) / 86_400_000;
    if (daysSinceFirst < WAIT_DAYS) return;

    const lastShown = Number(localStorage.getItem(NPS_KEY) ?? 0);
    const daysSinceLast = (Date.now() - lastShown) / 86_400_000;
    if (lastShown > 0 && daysSinceLast < COOLDOWN_DAYS) return;

    // Show after a short delay so the UI is settled
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, [userId, contractCount]);

  const handleSubmit = async () => {
    if (score === null) return;
    localStorage.setItem(NPS_KEY, Date.now().toString());

    // Save to Firestore via API
    try {
      await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, score, comment }),
      });
    } catch { /* non-blocking */ }

    setSubmitted(true);
    setTimeout(() => setOpen(false), 2000);
  };

  const handleDismiss = () => {
    localStorage.setItem(NPS_KEY, Date.now().toString());
    setOpen(false);
  };

  const label = score === null ? '' : score <= 6 ? 'No es probable' : score <= 8 ? 'Probable' : '¡Muy probable!';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="text-4xl">🙏</div>
            <p className="font-bold text-lg">¡Gracias por tu respuesta!</p>
            <p className="text-sm text-muted-foreground">Tu feedback nos ayuda a mejorar AlquilaGestión Pro.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu opinión importa</span>
              </div>
              <DialogTitle className="text-lg leading-tight">
                ¿Qué tan probable es que recomiendes AlquilaGestión Pro a otro administrador?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Del 0 (nada probable) al 10 (muy probable)
              </DialogDescription>
            </DialogHeader>

            {/* Score buttons */}
            <div className="flex gap-1.5 flex-wrap justify-center py-2">
              {Array.from({ length: 11 }, (_, i) => i).map(n => (
                <button
                  key={n}
                  onClick={() => setScore(n)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-bold border transition-all',
                    score === n ? scoreColorSelected(n) : scoreColor(n),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {score !== null && (
              <p className="text-center text-sm font-semibold text-muted-foreground -mt-1">{label}</p>
            )}

            <Textarea
              placeholder="¿Qué mejorarías? (opcional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleDismiss}>
                Ahora no
              </Button>
              <Button disabled={score === null} onClick={handleSubmit} className="flex-1">
                Enviar respuesta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
