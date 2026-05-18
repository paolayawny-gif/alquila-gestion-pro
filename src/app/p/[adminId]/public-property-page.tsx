'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Building2, MapPin, Maximize2, BedDouble, Phone, MessageCircle,
  ChevronLeft, ChevronRight, Search, Heart, X, ArrowLeftRight,
  Map, Loader2, ZoomIn, Send, Mail,
} from 'lucide-react';

const PropertyMap = dynamic(
  () => import('./property-map').then(m => ({ default: m.PropertyMapComponent })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
        <p className="text-sm">Cargando mapa…</p>
      </div>
    ),
  },
);

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  usage: string;
  squareMeters?: number;
  rooms?: number;
  amenities?: string[];
  photos?: string[];
  currentRentAmount?: number;
  currency?: string;
  status: string;
  latitude?: number;
  longitude?: number;
}

interface Props {
  adminId: string;
  profile: {
    displayName?: string;
    whatsappNumber?: string;
    logoUrl?: string;
    tagline?: string;
    email?: string;
  };
  properties: Property[];
}

const BRAND = '#1D9E75';

function buildWaLink(phone: string, message: string) {
  const n = phone.replace(/[\s\-\(\)\+\.]/g, '').replace(/^0/, '54');
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

// ─── Hook: Favoritos ──────────────────────────────────────────────────────────

function useFavorites(adminId: string) {
  const key = `agp_fav_${adminId}`;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, [key]);

  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [key]);

  return { favorites, toggle };
}

// ─── Hook: Geocodificación ────────────────────────────────────────────────────

function useGeocode(properties: Property[], enabled: boolean) {
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const cacheKey = 'agp_geocache';
    let cache: Record<string, { lat: number; lng: number }> = {};
    try { cache = JSON.parse(sessionStorage.getItem(cacheKey) ?? '{}'); } catch {}

    const toGeocode = properties
      .filter(p => !p.latitude && !p.longitude && !cache[p.id])
      .slice(0, 6);

    if (toGeocode.length === 0) {
      setCoords(cache);
      return;
    }

    setLoading(true);
    setProgress(0);
    let cancelled = false;

    (async () => {
      const next = { ...cache };
      for (let i = 0; i < toGeocode.length; i++) {
        if (cancelled) break;
        const prop = toGeocode[i];
        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: prop.address }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.lat && data.lng) next[prop.id] = { lat: data.lat, lng: data.lng };
          }
        } catch {}
        if (!cancelled) {
          setProgress(Math.round(((i + 1) / toGeocode.length) * 100));
          setCoords({ ...next });
        }
        if (i < toGeocode.length - 1) await new Promise(r => setTimeout(r, 1150));
      }
      try { sessionStorage.setItem(cacheKey, JSON.stringify(next)); } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCoords: Record<string, { lat: number; lng: number }> = { ...coords };
  for (const p of properties) {
    if (p.latitude && p.longitude) allCoords[p.id] = { lat: p.latitude, lng: p.longitude };
  }

  return { coords: allCoords, loading, progress };
}

// ─── Galería Lightbox ─────────────────────────────────────────────────────────

function GalleryLightbox({ photos, initial, onClose }: {
  photos: string[];
  initial: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initial);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 transition-colors"
        onClick={onClose}
        aria-label="Cerrar galería"
      >
        <X size={28} />
      </button>

      <div
        className="relative w-full max-w-4xl px-12 flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={photos[idx]}
          alt={`Foto ${idx + 1}`}
          className="max-h-[78vh] max-w-full object-contain rounded-lg"
        />
        {photos.length > 1 && (
          <>
            <button
              className="absolute left-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
              onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
              aria-label="Foto anterior"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className="absolute right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
              onClick={() => setIdx(i => (i + 1) % photos.length)}
              aria-label="Foto siguiente"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <p className="mt-4 text-white/50 text-sm">{idx + 1} / {photos.length}</p>

      {photos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto px-4 max-w-full pb-1">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === idx ? 'border-emerald-400 opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal de Consulta ────────────────────────────────────────────────────────

interface InquiryFormState {
  name: string;
  email: string;
  phone: string;
  message: string;
}

function InquiryModal({ prop, adminId, orgName, onClose }: {
  prop: Property;
  adminId: string;
  orgName: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<InquiryFormState>({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<InquiryFormState>>({});

  const validate = () => {
    const e: Partial<InquiryFormState> = {};
    if (!form.name.trim()) e.name = 'Tu nombre es requerido';
    if (!form.email.trim() && !form.phone.trim()) e.email = 'Ingresá tu email o teléfono';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          propertyId: prop.id,
          propertyName: prop.name,
          propertyAddress: prop.address,
          ...form,
        }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const fieldClass = (key: keyof InquiryFormState) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-colors ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Consultar propiedad</h2>
            <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{prop.name} — {prop.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#e6f7f1' }}>
              <Send size={24} style={{ color: BRAND }} />
            </div>
            <p className="font-semibold text-gray-900">¡Consulta enviada!</p>
            <p className="text-sm text-gray-500 mt-1">{orgName} se comunicará a la brevedad.</p>
            <button onClick={onClose} className="mt-4 text-sm font-medium hover:underline" style={{ color: BRAND }}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Juan García"
                className={fieldClass('name')}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="juan@ejemplo.com"
                className={fieldClass('email')}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+54 9 11 0000-0000"
                className={fieldClass('phone')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder={`Hola, me interesa "${prop.name}"...`}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-500 text-center">
                Hubo un error. Intentá contactarnos por WhatsApp.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              {status === 'loading'
                ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                : <><Send size={14} /> Enviar consulta</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Panel de Comparación ─────────────────────────────────────────────────────

function ComparisonPanel({ properties, onClose }: {
  properties: Property[];
  onClose: () => void;
}) {
  const rows: { label: string; render: (p: Property) => React.ReactNode }[] = [
    {
      label: 'Foto',
      render: p => p.photos?.[0]
        ? <img src={p.photos[0]} alt={p.name} className="w-full h-28 object-cover rounded-lg" />
        : <div className="w-full h-28 bg-emerald-50 rounded-lg flex items-center justify-center"><Building2 className="text-emerald-300" size={28} /></div>,
    },
    { label: 'Nombre', render: p => <span className="font-semibold text-gray-900 text-sm">{p.name}</span> },
    { label: 'Dirección', render: p => <span className="text-sm text-gray-600">{p.address}</span> },
    { label: 'Tipo', render: p => <span className="text-sm">{p.type}</span> },
    {
      label: 'Precio',
      render: p => p.currentRentAmount
        ? <span className="font-bold text-sm" style={{ color: BRAND }}>
            {p.currency === 'USD' ? 'USD' : '$'} {p.currentRentAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/mes
          </span>
        : <span className="text-sm text-gray-400">A consultar</span>,
    },
    {
      label: 'Superficie',
      render: p => p.squareMeters
        ? <span className="text-sm">{p.squareMeters} m²</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      label: 'Ambientes',
      render: p => p.rooms
        ? <span className="text-sm">{p.rooms} amb.</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      label: 'Comodidades',
      render: p => (p.amenities?.length ?? 0) > 0
        ? <div className="flex flex-wrap gap-1">
            {p.amenities!.map(a => (
              <span key={a} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
        : <span className="text-gray-300 text-sm">—</span>,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Comparar propiedades</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-24 bg-gray-50 sticky left-0 z-10">
                  Detalle
                </th>
                {properties.map(p => (
                  <th key={p.id} className="px-4 py-3 text-sm font-bold text-gray-800 border-l border-gray-100 min-w-[180px]">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 sticky left-0 z-10 align-top">
                    {row.label}
                  </td>
                  {properties.map(p => (
                    <td key={p.id} className="px-4 py-3 border-l border-gray-100 align-top">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({
  prop, phone, orgName, adminId,
  isFavorite, onToggleFavorite,
  isComparing, onToggleCompare, compareDisabled,
  onOpenGallery, onOpenInquiry,
}: {
  prop: Property;
  phone?: string;
  orgName: string;
  adminId: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isComparing: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
  onOpenGallery: (idx: number) => void;
  onOpenInquiry: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = (prop.photos ?? []).filter(Boolean);
  const hasPhotos = photos.length > 0;

  const waMsg = `Hola ${orgName}, vi la propiedad "${prop.name}" en ${prop.address} y me gustaría recibir más información.`;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all border ${
      isComparing ? 'border-emerald-400 ring-2 ring-emerald-300' : 'border-gray-100'
    }`}>
      {/* Área de fotos */}
      <div
        className="relative h-48 bg-gradient-to-br from-emerald-50 to-green-100 cursor-pointer group"
        onClick={() => hasPhotos && onOpenGallery(photoIdx)}
      >
        {hasPhotos ? (
          <>
            <img src={photos[photoIdx]} alt={prop.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn size={26} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
            {photos.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors z-10"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photos.length); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors z-10"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {photos.map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all ${i === photoIdx ? 'w-4 bg-white' : 'w-1 bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 size={40} className="text-emerald-300" />
          </div>
        )}

        {/* Badge tipo */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 px-2.5 py-1 rounded-full z-10">
          {prop.type}
        </div>

        {/* Botones favorito + comparar */}
        <div className="absolute top-3 right-3 flex gap-1.5 z-10">
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
            className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${
              isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-500 hover:text-red-500'
            }`}
            aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              if (!compareDisabled || isComparing) onToggleCompare();
            }}
            className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${
              isComparing
                ? 'bg-emerald-500 text-white'
                : compareDisabled
                  ? 'bg-white/50 text-gray-300 cursor-not-allowed'
                  : 'bg-white/90 text-gray-500 hover:text-emerald-600'
            }`}
            aria-label={isComparing ? 'Quitar de comparación' : 'Agregar a comparación'}
            title={compareDisabled && !isComparing ? 'Máximo 3 propiedades' : 'Comparar'}
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">{prop.name}</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin size={13} className="shrink-0 text-emerald-500" />
            {prop.address}
          </p>
        </div>

        <div className="flex gap-3 text-sm text-gray-600">
          {prop.squareMeters && (
            <span className="flex items-center gap-1">
              <Maximize2 size={13} className="text-gray-400" />
              {prop.squareMeters} m²
            </span>
          )}
          {prop.rooms && (
            <span className="flex items-center gap-1">
              <BedDouble size={13} className="text-gray-400" />
              {prop.rooms} amb.
            </span>
          )}
        </div>

        {(prop.amenities ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prop.amenities!.slice(0, 4).map(a => (
              <span key={a} className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{a}</span>
            ))}
            {prop.amenities!.length > 4 && (
              <span className="text-[11px] text-gray-400">+{prop.amenities!.length - 4}</span>
            )}
          </div>
        )}

        {prop.currentRentAmount ? (
          <p className="text-lg font-extrabold tabular-nums" style={{ color: BRAND }}>
            {(prop.currency ?? 'ARS') === 'USD' ? 'USD' : '$'}{' '}
            {prop.currentRentAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            <span className="text-sm font-normal text-gray-400">/mes</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">Precio a consultar</p>
        )}

        {/* CTAs */}
        <div className="mt-auto pt-1 flex flex-col gap-2">
          <button
            onClick={onOpenInquiry}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Mail size={14} />
            Consultar
          </button>
          {phone && (
            <a
              href={buildWaLink(phone, waMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          )}
          {!phone && (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <Phone size={14} />
              Consultar disponibilidad
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function PublicPropertyPage({ adminId, profile, properties }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [gallery, setGallery] = useState<{ photos: string[]; initial: number } | null>(null);
  const [inquiryProp, setInquiryProp] = useState<Property | null>(null);

  const { favorites, toggle: toggleFavorite } = useFavorites(adminId);
  const { coords: geoCoords, loading: geoLoading, progress: geoProgress } = useGeocode(properties, showMap);

  const orgName = profile.displayName ?? 'Inmobiliaria';
  const waPhone = profile.whatsappNumber;
  const types = [...new Set(properties.map(p => p.type))].sort();

  const filtered = properties.filter(p => {
    const matchSearch = !search || [p.name, p.address, p.type].some(f =>
      f?.toLowerCase().includes(search.toLowerCase()),
    );
    const matchType = !filterType || p.type === filterType;
    const matchFav = !showFavoritesOnly || favorites.has(p.id);
    return matchSearch && matchType && matchFav;
  });

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  const propertiesWithCoords = properties
    .map(p => ({
      ...p,
      latitude: p.latitude ?? geoCoords[p.id]?.lat,
      longitude: p.longitude ?? geoCoords[p.id]?.lng,
    }))
    .filter((p): p is Property & { latitude: number; longitude: number } =>
      typeof p.latitude === 'number' && typeof p.longitude === 'number',
    );

  const waGeneral = waPhone
    ? buildWaLink(waPhone, `Hola ${orgName}, vi sus propiedades en AlquilaGestión Pro y quería consultar disponibilidad.`)
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#f0faf6', fontFamily: 'system-ui, sans-serif' }}>
      {/* Galería */}
      {gallery && (
        <GalleryLightbox
          photos={gallery.photos}
          initial={gallery.initial}
          onClose={() => setGallery(null)}
        />
      )}

      {/* Modal consulta */}
      {inquiryProp && (
        <InquiryModal
          prop={inquiryProp}
          adminId={adminId}
          orgName={orgName}
          onClose={() => setInquiryProp(null)}
        />
      )}

      {/* Panel comparación */}
      {showComparison && (
        <ComparisonPanel
          properties={properties.filter(p => compareIds.includes(p.id))}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Header */}
      <header style={{ background: BRAND }} className="py-10 px-4 text-center text-white">
        {profile.logoUrl && (
          <img src={profile.logoUrl} alt={orgName} className="h-12 mx-auto mb-3 object-contain" />
        )}
        <h1 className="text-2xl font-extrabold tracking-tight">{orgName}</h1>
        {profile.tagline && <p className="mt-1 text-sm text-white/80">{profile.tagline}</p>}
        <p className="mt-2 text-sm text-white/70">
          {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''} disponible{filtered.length !== 1 ? 's' : ''}
        </p>
        {waGeneral && (
          <a
            href={waGeneral}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-white font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-50 transition-colors"
            style={{ color: BRAND }}
          >
            <MessageCircle size={15} />
            Contactar por WhatsApp
          </a>
        )}
      </header>

      {/* Filtros */}
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o dirección…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        {types.length > 1 && (
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">Todos los tipos</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          {/* Favoritos toggle */}
          <button
            onClick={() => setShowFavoritesOnly(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              showFavoritesOnly
                ? 'bg-red-50 border-red-300 text-red-600'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Heart size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">Favoritos</span>
            {favorites.size > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {favorites.size}
              </span>
            )}
          </button>
          {/* Mapa toggle */}
          <button
            onClick={() => setShowMap(m => !m)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              showMap
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Map size={14} />
            <span className="hidden sm:inline">Mapa</span>
          </button>
        </div>
      </div>

      {/* Sección mapa */}
      {showMap && (
        <div className="max-w-5xl mx-auto px-4 mb-6">
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            {geoLoading && propertiesWithCoords.length === 0 ? (
              <div className="h-[400px] bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 size={28} className="animate-spin text-emerald-500" />
                <p className="text-sm">Buscando ubicaciones… {geoProgress > 0 ? `${geoProgress}%` : ''}</p>
              </div>
            ) : (
              <PropertyMap properties={propertiesWithCoords} />
            )}
          </div>
          {propertiesWithCoords.length === 0 && !geoLoading && (
            <p className="text-xs text-gray-400 text-center mt-2">
              No se pudieron obtener coordenadas para las propiedades actuales.
            </p>
          )}
          {geoLoading && propertiesWithCoords.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
              <Loader2 size={11} className="animate-spin" />
              Cargando más ubicaciones…
            </p>
          )}
        </div>
      )}

      {/* Grid de propiedades */}
      <main className="max-w-5xl mx-auto px-4 pb-28">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {showFavoritesOnly
                ? 'No tenés propiedades guardadas en favoritos.'
                : 'No hay propiedades disponibles en este momento.'}
            </p>
            {showFavoritesOnly && (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="mt-3 text-sm font-medium hover:underline"
                style={{ color: BRAND }}
              >
                Ver todas las propiedades
              </button>
            )}
            {!showFavoritesOnly && waGeneral && (
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND }}>
                <MessageCircle size={14} /> Consultá disponibilidades por WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <PropertyCard
                key={p.id}
                prop={p}
                phone={waPhone}
                orgName={orgName}
                adminId={adminId}
                isFavorite={favorites.has(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                isComparing={compareIds.includes(p.id)}
                onToggleCompare={() => toggleCompare(p.id)}
                compareDisabled={compareIds.length >= 3}
                onOpenGallery={idx => setGallery({ photos: (p.photos ?? []).filter(Boolean), initial: idx })}
                onOpenInquiry={() => setInquiryProp(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Barra flotante de comparación */}
      {compareIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <ArrowLeftRight size={17} className="text-emerald-400 shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">
            {compareIds.length} propiedades
          </span>
          <button
            onClick={() => setShowComparison(true)}
            className="text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors"
            style={{ background: BRAND }}
          >
            Comparar
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="text-gray-400 hover:text-white transition-colors ml-1"
            aria-label="Cancelar comparación"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 bg-white">
        Gestionado con{' '}
        <a href="https://alquilagestionpro.com" className="font-medium hover:underline" style={{ color: BRAND }}>
          AlquilaGestión Pro
        </a>
      </footer>
    </div>
  );
}
