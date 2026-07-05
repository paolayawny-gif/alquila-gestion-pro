"use client";
import { APP_ID } from '@/lib/constants';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import {
  Sparkles, Save, RefreshCw, Loader2,
  CheckCircle2, BookOpen, Zap, Target, ShieldAlert,
} from 'lucide-react';
import { SocialBrandProfile, BrandSpecialty, BrandAudience } from '@/lib/types';
import { generateBrandBrief } from '@/ai/flows/generate-brand-brief-flow';
import { useAIConfig } from '@/hooks/use-ai-config';
import { AIKeyRequiredNotice } from '@/components/ui/ai-key-required-notice';


const SPECIALTY_OPTIONS: { value: BrandSpecialty; label: string }[] = [
  { value: 'Residencial', label: 'Residencial (casas y deptos)' },
  { value: 'Comercial', label: 'Comercial (locales y oficinas)' },
  { value: 'Vacacional', label: 'Vacacional / turístico' },
  { value: 'Oficinas', label: 'Oficinas y coworking' },
  { value: 'Mixta', label: 'Mixta (varios tipos)' },
];

const AUDIENCE_OPTIONS: { value: BrandAudience; label: string }[] = [
  { value: 'Propietarios', label: 'Propietarios que quieren alquilar' },
  { value: 'Inquilinos', label: 'Inquilinos que buscan propiedad' },
  { value: 'Ambos', label: 'Propietarios e inquilinos' },
  { value: 'Inversores', label: 'Inversores y desarrolladores' },
];

const PILLAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
];

interface SocialBrandProfileViewProps {
  userId?: string;
  profile: SocialBrandProfile | null;
  onProfileSaved: (profile: SocialBrandProfile) => void;
  canWrite?: boolean;
}

export function SocialBrandProfileView({
  userId, profile, onProfileSaved, canWrite = true,
}: SocialBrandProfileViewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { apiKey, loading: aiConfigLoading } = useAIConfig(userId);

  const [brandName, setBrandName] = useState(profile?.brandName ?? '');
  const [zone, setZone] = useState(profile?.zone ?? '');
  const [specialty, setSpecialty] = useState<BrandSpecialty>(profile?.specialty ?? 'Residencial');
  const [audience, setAudience] = useState<BrandAudience>(profile?.audience ?? 'Ambos');
  const [usp, setUsp] = useState(profile?.usp ?? '');
  const [samplePosts, setSamplePosts] = useState(profile?.samplePosts ?? '');

  const [brief, setBrief] = useState(profile?.brief ?? '');
  const [pillars, setPillars] = useState<string[]>(profile?.contentPillars ?? []);
  const [powerWords, setPowerWords] = useState(profile?.powerWords ?? '');
  const [avoidances, setAvoidances] = useState(profile?.avoidances ?? '');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [briefReady, setBriefReady] = useState(!!profile?.brief);

  const hasBrief = !!brief;

  const handleGenerate = async () => {
    if (!brandName.trim() || !zone.trim() || !usp.trim()) {
      toast({ title: 'Completá nombre, zona y propuesta de valor', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateBrandBrief({
        brandName, zone, specialty, audience, usp,
        samplePosts: samplePosts.trim() || undefined,
      }, { apiKey: apiKey ?? undefined });
      setBrief(result.brief);
      setPillars(result.contentPillars);
      setPowerWords(result.powerWords);
      setAvoidances(result.avoidances);
      setBriefReady(true);
      toast({ title: '✨ Brief generado', description: 'Revisá y guardá para activarlo.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!userId || !db || !brief) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    const data: SocialBrandProfile = {
      id: 'main',
      ownerId: userId,
      brandName, zone, specialty, audience, usp,
      samplePosts: samplePosts.trim() || undefined,
      brief, contentPillars: pillars, powerWords, avoidances,
      briefGeneratedAt: now,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };
    const ref = doc(db, 'artifacts', APP_ID, 'users', userId, 'socialBrandProfile', 'main');
    setDocumentNonBlocking(ref, data, { merge: true });
    onProfileSaved(data);
    toast({ title: '✅ Perfil de marca guardado', description: 'La IA lo usará en cada generación.' });
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">

      {profile?.brief && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-emerald-700">
            Perfil de marca activo — la IA aplica la identidad de <strong>{profile.brandName}</strong> en cada publicación generada.
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left: form */}
        <div className="flex-1 space-y-4 min-w-0">
          <div>
            <h3 className="text-lg font-black text-foreground">Perfil de marca</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configurá la identidad de tu inmobiliaria. La IA aprenderá tu voz y la aplicará en cada publicación.
            </p>
          </div>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Información de la marca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nombre de la inmobiliaria</Label>
                  <Input placeholder="Ej: Inmobiliaria García" value={brandName} onChange={e => setBrandName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Zona / ciudad</Label>
                  <Input placeholder="Ej: Palermo, CABA" value={zone} onChange={e => setZone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Especialidad</Label>
                  <Select value={specialty} onValueChange={v => setSpecialty(v as BrandSpecialty)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPECIALTY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Audiencia principal</Label>
                  <Select value={audience} onValueChange={v => setAudience(v as BrandAudience)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Propuesta de valor única (¿qué te diferencia?)</Label>
                <Textarea
                  rows={3}
                  placeholder="Ej: 15 años en Palermo, ajustes automáticos sin demoras, liquidaciones el día 5 garantizadas, atención 24/7 por WhatsApp…"
                  value={usp}
                  onChange={e => setUsp(e.target.value)}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Análisis de estilo existente
                <span className="text-[10px] font-normal text-muted-foreground ml-1">(opcional pero recomendado)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={5}
                placeholder={`Pegá 2-3 de tus mejores publicaciones actuales para que la IA aprenda tu estilo real.\n\nEj:\n"¡Nueva propiedad disponible en Palermo! Departamento de 2 ambientes, piso 8, luminoso…"\n\n"Recordá que el ajuste ICL de julio ya está disponible. Contactanos para más info."`}
                value={samplePosts}
                onChange={e => setSamplePosts(e.target.value)}
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                La IA analiza el tono, vocabulario y estructura de tus posts para replicar tu voz auténtica.
              </p>
            </CardContent>
          </Card>

          {!aiConfigLoading && !apiKey ? (
            <AIKeyRequiredNotice feature="la generación del perfil de marca" />
          ) : (
            <Button
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !canWrite}
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando tu marca…</>
                : briefReady
                  ? <><RefreshCw className="h-4 w-4" /> Regenerar brief</>
                  : <><Sparkles className="h-4 w-4" /> Generar brief de marca con IA</>}
            </Button>
          )}
        </div>

        {/* Right: generated brief */}
        <div className="lg:w-[420px] flex-shrink-0 space-y-4">
          {!hasBrief ? (
            <Card className="border-none shadow-sm bg-gray-50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-violet-500" />
                </div>
                <div>
                  <p className="font-black text-sm text-foreground">Tu brief de marca aparecerá acá</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug max-w-xs">
                    Completá el formulario y generá el brief. La IA lo usará en cada publicación para mantener tu identidad.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pillars.length > 0 && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Pilares de contenido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {pillars.map((p, i) => (
                        <span key={i} className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', PILLAR_COLORS[i % PILLAR_COLORS.length])}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Brief de marca generado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground font-sans bg-gray-50 rounded-xl p-3 max-h-52 overflow-y-auto">
                    {brief}
                  </pre>
                </CardContent>
              </Card>

              {powerWords && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" /> Palabras de poder
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-foreground leading-relaxed">{powerWords}</p>
                  </CardContent>
                </Card>
              )}

              {avoidances && (
                <Card className="border-none shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-400" /> Evitar siempre
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">{avoidances}</p>
                  </CardContent>
                </Card>
              )}

              <Button
                className="w-full gap-2 font-bold"
                size="lg"
                onClick={handleSave}
                disabled={isSaving || !canWrite}
              >
                <Save className="h-4 w-4" />
                {profile?.brief ? 'Actualizar perfil de marca' : 'Guardar y activar perfil de marca'}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground leading-snug">
                Una vez guardado, la IA lo usará automáticamente en Publicaciones, Carruseles y Diseño de tarjetas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
