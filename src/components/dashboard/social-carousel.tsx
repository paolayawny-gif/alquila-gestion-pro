"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Sparkles, Download, Loader2, Plus, Trash2,
  ChevronLeft, ChevronRight, GalleryHorizontal, ImagePlus,
} from 'lucide-react';
import {
  CardPreview, CardFormat, CardStyle, CardLayout,
  ACCENT_COLORS, DARK_BG_COLORS, CARD_TEXT_COLORS,
  PREVIEW_DIMS, EXPORT_DIMS, exportCardToPng,
} from './social-card-designer';
import { generateCarousel } from '@/ai/flows/generate-carousel-flow';
import { useAIConfig } from '@/hooks/use-ai-config';
import { AIKeyRequiredNotice } from '@/components/ui/ai-key-required-notice';

interface Slide {
  title: string;
  subtitle: string;
  bgImage?: string;
}

const TONE_OPTIONS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'cercano', label: 'Cercano' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'inspiracional', label: 'Inspiracional' },
  { value: 'informativo', label: 'Informativo' },
] as const;

const DEFAULT_SLIDES: Slide[] = [
  { title: 'Tu titular aquí', subtitle: 'Subtexto de apoyo para el primer slide' },
  { title: 'Segundo punto clave', subtitle: 'Detalle que amplía el titular' },
  { title: '¡Contactanos!', subtitle: 'Escribinos para más información' },
];

interface SocialCarouselProps {
  userId?: string;
  canWrite?: boolean;
  brandContext?: string;
  initialSlides?: Slide[];
  initialTopic?: string;
  initialContext?: string;
  initialBrandTag?: string;
}

export function SocialCarousel({
  userId, canWrite = true, brandContext,
  initialSlides, initialTopic = '', initialContext = '', initialBrandTag = '',
}: SocialCarouselProps) {
  const { toast } = useToast();
  const { apiKey, loading: aiConfigLoading } = useAIConfig(userId);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Solo imágenes', variant: 'destructive' }); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSlides(prev => prev.map((s, i) => i === currentIdx ? { ...s, bgImage: dataUrl } : s));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Slides
  const [slides, setSlides] = useState<Slide[]>(initialSlides ?? DEFAULT_SLIDES);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Design
  const [format, setFormat] = useState<CardFormat>('Cuadrado');
  const [style, setStyle] = useState<CardStyle>('gradient');
  const [layout, setLayout] = useState<CardLayout>('inferior');
  const [accent, setAccent] = useState(ACCENT_COLORS[0].value);
  const [darkBg, setDarkBg] = useState(DARK_BG_COLORS[0].value);
  const [textColor, setTextColor] = useState(CARD_TEXT_COLORS[0].value);
  const [brandTag, setBrandTag] = useState(initialBrandTag);

  // AI
  const [aiTopic, setAiTopic] = useState(initialTopic);
  const [aiContext, setAiContext] = useState(initialContext);
  const [aiTone, setAiTone] = useState<'profesional' | 'cercano' | 'urgente' | 'inspiracional' | 'informativo'>('profesional');
  const [numSlides, setNumSlides] = useState(initialSlides?.length ?? 5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const current = slides[currentIdx] ?? { title: '', subtitle: '' };

  const updateCurrent = (field: keyof Slide, value: string) => {
    setSlides(prev => prev.map((s, i) => i === currentIdx ? { ...s, [field]: value || undefined } : s));
  };

  const addSlide = () => {
    setSlides(prev => [...prev, { title: 'Nuevo slide', subtitle: '' }]);
    setCurrentIdx(slides.length);
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setCurrentIdx(prev => Math.min(prev, slides.length - 2));
  };

  const handleGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: 'Ingresá un tema', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const r = await generateCarousel({
        topic: aiTopic,
        numSlides,
        tone: aiTone,
        context: aiContext.trim() || undefined,
        brandContext,
      }, { apiKey: apiKey ?? undefined });
      setSlides(r.slides.map((s, i) => ({
        title: s.title,
        subtitle: s.subtitle,
        bgImage: slides[i]?.bgImage,
      })));
      setCurrentIdx(0);
      if (!brandTag) setBrandTag(r.hashtags.split(' ')[0] ?? '');
      toast({ title: '✨ Carrusel generado', description: `${r.slides.length} slides listos para editar.` });
    } catch (e: any) {
      toast({ title: 'Error IA', description: e?.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportAll = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        setCurrentIdx(i);
        // Wait for React re-render before capturing
        await new Promise(res => setTimeout(res, 180));
        await exportCardToPng(
          previewRef.current!,
          format,
          `carrusel-slide-${i + 1}.png`
        );
      }
      toast({ title: `✅ ${slides.length} slides exportados`, description: 'Revisá tu carpeta de descargas.' });
    } catch (e: any) {
      toast({ title: 'Error al exportar', description: e?.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-foreground">Carrusel</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Creá carruseles de múltiples slides para Instagram y LinkedIn.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">

        {/* Controls */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* AI generator */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-violet-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" /> Generar carrusel con IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Tema del carrusel</Label>
                  <Input
                    placeholder="Ej: 5 cosas que debés saber antes de alquilar"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Cantidad de slides</Label>
                  <Select value={String(numSlides)} onValueChange={v => setNumSlides(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 8, 10].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Contexto adicional (opcional)</Label>
                  <Input
                    placeholder="Zona, tipo de propiedad, datos relevantes…"
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
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
                <AIKeyRequiredNotice feature="la generación de carruseles" />
              ) : (
                <Button
                  className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold"
                  onClick={handleGenerate}
                  disabled={isGenerating || !canWrite}
                >
                  {isGenerating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                    : <><GalleryHorizontal className="h-4 w-4" /> Generar carrusel</>}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Slide editor */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                Slide {currentIdx + 1} de {slides.length}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCurrentIdx(i => Math.min(slides.length - 1, i + 1))} disabled={currentIdx === slides.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Titular</Label>
                <Input
                  value={current.title}
                  onChange={e => updateCurrent('title', e.target.value)}
                  placeholder="Titular del slide"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Subtexto</Label>
                <Input
                  value={current.subtitle}
                  onChange={e => updateCurrent('subtitle', e.target.value)}
                  placeholder="Texto de apoyo"
                />
              </div>
              {/* Photo upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {current.bgImage ? 'Cambiar foto' : 'Agregar foto de fondo'}
                </Button>
              </div>

              {/* Per-slide photo preview */}
              {current.bgImage && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <img src={current.bgImage} alt="" className="h-10 w-14 object-cover rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Foto de fondo</p>
                    <p className="text-[10px] text-muted-foreground truncate">{current.bgImage.split('/').pop()}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => updateCurrent('bgImage', '')}>
                    Quitar
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Etiqueta de marca (todos los slides)</Label>
                <Input
                  value={brandTag}
                  onChange={e => setBrandTag(e.target.value)}
                  placeholder="@mi_inmobiliaria"
                />
              </div>

              {/* Slide thumbnails */}
              <div className="flex gap-1.5 flex-wrap pt-1">
                {slides.map((s, i) => (
                  <div key={i} className="relative group">
                    <button
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        'w-10 h-10 rounded-lg border-2 text-[9px] font-bold flex items-center justify-center transition-colors overflow-hidden',
                        i === currentIdx ? 'border-primary' : 'border-muted hover:border-primary/40'
                      )}
                      style={{ background: accent }}
                    >
                      <span className="text-white">{i + 1}</span>
                    </button>
                    {slides.length > 1 && (
                      <button
                        onClick={() => removeSlide(i)}
                        className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSlide}
                  className="w-10 h-10 rounded-lg border-2 border-dashed border-muted text-muted-foreground flex items-center justify-center hover:border-primary/40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Style */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black">Estilo (aplica a todos los slides)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Formato</Label>
                  <Select value={format} onValueChange={v => setFormat(v as CardFormat)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cuadrado">Cuadrado 1:1</SelectItem>
                      <SelectItem value="Historia">Historia 9:16</SelectItem>
                      <SelectItem value="Paisaje">Paisaje 16:9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Estilo</Label>
                  <Select value={style} onValueChange={v => setStyle(v as CardStyle)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gradient">Degradado</SelectItem>
                      <SelectItem value="solid">Sólido</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Composición del texto</Label>
                <Select value={layout} onValueChange={v => setLayout(v as CardLayout)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inferior">Abajo</SelectItem>
                    <SelectItem value="centrado">Centrado</SelectItem>
                    <SelectItem value="superior">Arriba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

        {/* Preview */}
        <div className="xl:w-auto flex-shrink-0 flex flex-col items-center gap-4">
          <div className="overflow-auto max-w-full">
            <CardPreview
              format={format}
              style={style}
              layout={layout}
              accent={accent}
              darkBg={darkBg}
              textColor={textColor}
              headline={current.title}
              subtext={current.subtitle}
              brandTag={brandTag}
              bgImage={current.bgImage}
              previewRef={previewRef}
            />
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Slide {currentIdx + 1}/{slides.length}</span>
            <span>·</span>
            <span>{EXPORT_DIMS[format].w}×{EXPORT_DIMS[format].h}px</span>
          </div>

          <Button
            className="gap-2 font-bold w-full"
            onClick={handleExportAll}
            disabled={isExporting}
          >
            {isExporting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Exportando…</>
              : <><Download className="h-4 w-4" /> Exportar todos los slides ({slides.length})</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
