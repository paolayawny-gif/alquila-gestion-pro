"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Sparkles, Download, Loader2, Image as ImageIcon,
  LayoutTemplate, Palette, ImagePlus,
} from 'lucide-react';
import { generateSocialContent } from '@/ai/flows/generate-social-content-flow';
import { useAIConfig } from '@/hooks/use-ai-config';
import { AIKeyRequiredNotice } from '@/components/ui/ai-key-required-notice';

// ── Types & constants ─────────────────────────────────────────────────────────

export type CardStyle = 'gradient' | 'solid' | 'dark' | 'minimal';
export type CardFormat = 'Cuadrado' | 'Historia' | 'Paisaje';
export type CardLayout = 'inferior' | 'centrado' | 'superior';

export const ACCENT_COLORS = [
  { label: 'Ocean Blue (marca)', value: '#0369A1' },
  { label: 'Violeta', value: '#7c3aed' },
  { label: 'Rosa', value: '#db2777' },
  { label: 'Naranja', value: '#ea580c' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#16a34a' },
  { label: 'Índigo', value: '#4f46e5' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Rojo', value: '#dc2626' },
];

export const DARK_BG_COLORS = [
  { label: 'Carbón', value: '#1a1a2e' },
  { label: 'Noche', value: '#0f172a' },
  { label: 'Grafito', value: '#1f2937' },
  { label: 'Chocolate', value: '#1c1210' },
];

export const CARD_TEXT_COLORS = [
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Crema', value: '#fef9f0' },
  { label: 'Negro', value: '#0f0f0f' },
  { label: 'Gris oscuro', value: '#374151' },
];

export const PREVIEW_DIMS: Record<CardFormat, { w: number; h: number }> = {
  Cuadrado: { w: 340, h: 340 },
  Historia: { w: 191, h: 340 },
  Paisaje: { w: 340, h: 191 },
};

export const EXPORT_DIMS: Record<CardFormat, { w: number; h: number }> = {
  Cuadrado: { w: 1080, h: 1080 },
  Historia: { w: 1080, h: 1920 },
  Paisaje: { w: 1920, h: 1080 },
};

export function getCardBackground(style: CardStyle, accent: string, darkBg: string): string {
  if (style === 'gradient') return `linear-gradient(135deg, ${accent} 0%, ${accent}99 60%, ${accent}44 100%)`;
  if (style === 'dark') return darkBg;
  if (style === 'solid') return accent;
  return '#ffffff';
}

// ── CardPreview ───────────────────────────────────────────────────────────────

export interface CardPreviewProps {
  format: CardFormat;
  style: CardStyle;
  layout?: CardLayout;
  accent: string;
  darkBg: string;
  textColor: string;
  eyebrow?: string;
  headline: string;
  subtext: string;
  brandTag: string;
  bgImage?: string;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

export function CardPreview({
  format, style, layout = 'inferior', accent, darkBg, textColor,
  eyebrow, headline, subtext, brandTag, bgImage, previewRef,
}: CardPreviewProps) {
  const { w, h } = PREVIEW_DIMS[format];
  const bg = bgImage ? `url(${bgImage}) center/cover no-repeat` : getCardBackground(style, accent, darkBg);
  const isMinimal = !bgImage && style === 'minimal';
  const effectiveTextColor = bgImage ? '#ffffff' : (isMinimal ? undefined : textColor);
  const bodyColor = isMinimal ? '#0f172a' : (effectiveTextColor ?? textColor);
  const headlineSize = format === 'Historia'
    ? (headline.length > 40 ? '1.05rem' : '1.3rem')
    : (headline.length > 40 ? '1rem' : '1.2rem');

  const justify = layout === 'centrado' ? 'center' : layout === 'superior' ? 'flex-start' : 'flex-end';
  const textAlign = layout === 'centrado' ? 'center' : 'left';

  return (
    <div
      ref={previewRef as React.RefObject<HTMLDivElement>}
      style={{
        width: w,
        height: h,
        background: bg,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        alignItems: layout === 'centrado' ? 'center' : 'stretch',
        padding: 26,
        boxSizing: 'border-box',
        border: isMinimal ? '1.5px solid #e5e7eb' : 'none',
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      {/* Dark gradient overlay when using a background image */}
      {bgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          background: layout === 'superior'
            ? 'linear-gradient(0deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 45%)'
            : 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.72) 100%)',
        }} />
      )}

      {/* Decorative layered shapes for color styles (not minimal, not bg image) */}
      {!isMinimal && !bgImage && (
        <>
          <div style={{
            position: 'absolute', top: -60, right: -50,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: -70, left: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(0,0,0,0.10)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 14px)',
          }} />
        </>
      )}

      {/* Corner-frame accent for minimal style */}
      {isMinimal && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: 40, height: 4, background: accent, borderRadius: '0 0 4px 0',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, transparent 40%, ${accent}18 100%)`,
          }} />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 1, textAlign, width: '100%' }}>
        {eyebrow && (
          <div style={{
            display: 'inline-block',
            fontSize: '0.58rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: isMinimal ? accent : bodyColor,
            opacity: isMinimal ? 1 : 0.85,
            marginBottom: 6,
          }}>
            {eyebrow}
          </div>
        )}
        {headline && (
          <div style={{
            color: bodyColor,
            fontSize: headlineSize,
            fontWeight: 900,
            lineHeight: 1.18,
            marginBottom: subtext ? 8 : 0,
            letterSpacing: '-0.02em',
            textWrap: 'balance' as any,
          }}>
            {headline}
          </div>
        )}
        {subtext && (
          <div style={{
            color: isMinimal ? '#475569' : `${bodyColor}cc`,
            fontSize: '0.72rem',
            lineHeight: 1.45,
            marginBottom: brandTag ? 12 : 0,
            maxWidth: layout === 'centrado' ? '85%' : undefined,
            marginLeft: layout === 'centrado' ? 'auto' : undefined,
            marginRight: layout === 'centrado' ? 'auto' : undefined,
          }}>
            {subtext}
          </div>
        )}
        {brandTag && (
          <div style={{
            display: 'inline-block',
            background: isMinimal ? accent : 'rgba(255,255,255,0.18)',
            color: isMinimal ? '#fff' : bodyColor,
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {brandTag}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export helper ─────────────────────────────────────────────────────────────

export async function exportCardToPng(
  previewEl: HTMLDivElement,
  format: CardFormat,
  filename: string
): Promise<void> {
  const { w: exportW, h: exportH } = EXPORT_DIMS[format];
  const { w: previewW, h: previewH } = PREVIEW_DIMS[format];

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(previewEl, {
    scale: exportW / previewW,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    width: previewW,
    height: previewH,
  });

  // Draw to exact target size
  const out = document.createElement('canvas');
  out.width = exportW;
  out.height = exportH;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, exportW, exportH);

  const link = document.createElement('a');
  link.download = filename;
  link.href = out.toDataURL('image/png');
  link.click();
}

// ── SocialCardDesigner ────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'cercano', label: 'Cercano' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'inspiracional', label: 'Inspiracional' },
  { value: 'informativo', label: 'Informativo' },
] as const;

interface SocialCardDesignerProps {
  userId?: string;
  canWrite?: boolean;
  brandContext?: string;
}

export function SocialCardDesigner({ userId, canWrite = true, brandContext }: SocialCardDesignerProps) {
  const { toast } = useToast();
  const { apiKey, loading: aiConfigLoading } = useAIConfig(userId);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [format, setFormat] = useState<CardFormat>('Cuadrado');
  const [style, setStyle] = useState<CardStyle>('gradient');
  const [layout, setLayout] = useState<CardLayout>('inferior');
  const [accent, setAccent] = useState(ACCENT_COLORS[0].value);
  const [darkBg, setDarkBg] = useState(DARK_BG_COLORS[0].value);
  const [textColor, setTextColor] = useState(CARD_TEXT_COLORS[0].value);
  const [eyebrow, setEyebrow] = useState('');
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [brandTag, setBrandTag] = useState('');
  const [bgImage, setBgImage] = useState<string | undefined>(undefined);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Solo imágenes', variant: 'destructive' }); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setBgImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<'profesional' | 'cercano' | 'urgente' | 'inspiracional' | 'informativo'>('profesional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: 'Ingresá un tema', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const r = await generateSocialContent({
        topic: aiTopic,
        network: 'Instagram',
        contentType: 'post',
        tone: aiTone,
        brandContext,
      }, { apiKey: apiKey ?? undefined });
      // Use first sentence of mainText as headline, rest as subtext
      const sentences = r.mainText.split(/(?<=[.!?])\s+/);
      setHeadline(sentences[0]?.slice(0, 80) ?? aiTopic);
      setSubtext(sentences.slice(1, 3).join(' ').slice(0, 120));
      toast({ title: '✨ Texto generado', description: 'Podés editarlo y exportar.' });
    } catch (e: any) {
      toast({ title: 'Error IA', description: e?.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      await exportCardToPng(previewRef.current, format, `tarjeta-${format.toLowerCase()}.png`);
      toast({ title: '✅ Imagen exportada', description: `${EXPORT_DIMS[format].w}×${EXPORT_DIMS[format].h}px` });
    } catch (e: any) {
      toast({ title: 'Error al exportar', description: e?.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-foreground">Diseño de tarjeta</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Creá imágenes listas para publicar en Instagram, Stories y LinkedIn.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">

        {/* Controls */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* AI */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-violet-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" /> Generar texto con IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Tema</Label>
                  <Input
                    placeholder="Ej: Nuevo depto en Palermo disponible"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Tono</Label>
                  <Select value={aiTone} onValueChange={v => setAiTone(v as typeof aiTone)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!aiConfigLoading && !apiKey ? (
                <AIKeyRequiredNotice feature="la generación de texto con IA" />
              ) : (
                <Button
                  className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold"
                  onClick={handleGenerate}
                  disabled={isGenerating || !canWrite}
                >
                  {isGenerating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                    : <><Sparkles className="h-4 w-4" /> Generar texto</>}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Text content */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-primary" /> Contenido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Categoría (opcional)</Label>
                <Input
                  placeholder="Ej: NOVEDAD, TIP, PROMO"
                  value={eyebrow}
                  onChange={e => setEyebrow(e.target.value)}
                  maxLength={24}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Titular principal</Label>
                <Textarea
                  rows={2}
                  placeholder="Texto grande e impactante"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Subtexto (opcional)</Label>
                <Textarea
                  rows={2}
                  placeholder="Detalle adicional, beneficio, o CTA"
                  value={subtext}
                  onChange={e => setSubtext(e.target.value)}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Etiqueta de marca (opcional)</Label>
                <Input
                  placeholder="Ej: @mi_inmobiliaria · Palermo"
                  value={brandTag}
                  onChange={e => setBrandTag(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Foto de fondo (opcional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {bgImage ? 'Cambiar foto' : 'Agregar foto de fondo'}
                </Button>
                {bgImage && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mt-1.5">
                    <img src={bgImage} alt="" className="h-10 w-14 object-cover rounded flex-shrink-0" />
                    <p className="flex-1 text-[10px] text-muted-foreground">Se usa como fondo de la tarjeta.</p>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => setBgImage(undefined)}>
                      Quitar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Style */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Estilo y formato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Format */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Formato</Label>
                <div className="flex gap-2">
                  {(['Cuadrado', 'Historia', 'Paisaje'] as CardFormat[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        'flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors',
                        format === f ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {f}
                      <span className="block text-[9px] opacity-60 mt-0.5">
                        {f === 'Cuadrado' ? '1:1' : f === 'Historia' ? '9:16' : '16:9'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Estilo de fondo</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['gradient', 'solid', 'dark', 'minimal'] as CardStyle[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={cn(
                        'text-xs font-semibold py-2 px-1 rounded-lg border transition-colors capitalize',
                        style === s ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {s === 'gradient' ? 'Degradado' : s === 'solid' ? 'Sólido' : s === 'dark' ? 'Oscuro' : 'Minimal'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Composición del texto</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['inferior', 'centrado', 'superior'] as CardLayout[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLayout(l)}
                      className={cn(
                        'text-xs font-semibold py-2 px-1 rounded-lg border transition-colors capitalize',
                        layout === l ? 'border-primary bg-primary/10 text-primary' : 'border-muted text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {l === 'inferior' ? 'Abajo' : l === 'centrado' ? 'Centrado' : 'Arriba'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Color de acento</Label>
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => setAccent(c.value)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        accent === c.value ? 'border-gray-900 scale-110' : 'border-transparent'
                      )}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              </div>

              {/* Dark bg (only for dark style) */}
              {style === 'dark' && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Fondo oscuro</Label>
                  <div className="flex gap-2">
                    {DARK_BG_COLORS.map(c => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={() => setDarkBg(c.value)}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                          darkBg === c.value ? 'border-gray-300 scale-110' : 'border-transparent'
                        )}
                        style={{ background: c.value }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Text color */}
              {style !== 'minimal' && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Color de texto</Label>
                  <div className="flex gap-2">
                    {CARD_TEXT_COLORS.map(c => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={() => setTextColor(c.value)}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                          textColor === c.value ? 'border-primary scale-110' : 'border-muted'
                        )}
                        style={{ background: c.value }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview + export */}
        <div className="xl:w-auto flex-shrink-0 flex flex-col items-center gap-4">
          <div className="overflow-auto max-w-full">
            <CardPreview
              format={format}
              style={style}
              layout={layout}
              accent={accent}
              darkBg={darkBg}
              textColor={textColor}
              eyebrow={eyebrow}
              headline={headline}
              subtext={subtext}
              brandTag={brandTag}
              bgImage={bgImage}
              previewRef={previewRef}
            />
          </div>

          <div className="text-center space-y-1">
            <p className="text-[10px] text-muted-foreground">
              Vista previa · Exporta a {EXPORT_DIMS[format].w}×{EXPORT_DIMS[format].h}px
            </p>
            <Button
              className="gap-2 font-bold"
              onClick={handleExport}
              disabled={isExporting || (!headline && !subtext)}
            >
              {isExporting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Exportando…</>
                : <><Download className="h-4 w-4" /> Descargar PNG</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
