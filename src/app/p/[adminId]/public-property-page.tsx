'use client';

import React, { useState } from 'react';
import { Building2, MapPin, Maximize2, BedDouble, Phone, MessageCircle, ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';

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

function PropertyCard({ prop, phone, orgName }: { prop: Property; phone?: string; orgName: string }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = (prop.photos ?? []).filter(Boolean);
  const hasPhotos = photos.length > 0;

  const waMsg = `Hola ${orgName}, vi la propiedad "${prop.name}" en ${prop.address} y me gustaría recibir más información.`;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
      {/* Photo carousel */}
      <div className="relative h-48 bg-gradient-to-br from-emerald-50 to-green-100">
        {hasPhotos ? (
          <>
            <img
              src={photos[photoIdx]}
              alt={prop.name}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
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
        {/* Type badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 px-2.5 py-1 rounded-full">
          {prop.type}
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

        {/* Stats */}
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

        {/* Amenities */}
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

        {/* Price */}
        {prop.currentRentAmount ? (
          <p className="text-lg font-extrabold text-emerald-700 tabular-nums">
            {(prop.currency ?? 'ARS') === 'USD' ? 'USD' : '$'}{' '}
            {prop.currentRentAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            <span className="text-sm font-normal text-gray-400">/mes</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">Precio a consultar</p>
        )}

        {/* CTA */}
        <div className="mt-auto pt-1">
          {phone ? (
            <a
              href={buildWaLink(phone, waMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <MessageCircle size={15} />
              Consultar por WhatsApp
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <Phone size={15} />
              Consultar disponibilidad
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicPropertyPage({ adminId, profile, properties }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const orgName = profile.displayName ?? 'Inmobiliaria';
  const waPhone = profile.whatsappNumber;

  const types = [...new Set(properties.map(p => p.type))].sort();

  const filtered = properties.filter(p => {
    const matchSearch = !search || [p.name, p.address, p.type].some(f =>
      f?.toLowerCase().includes(search.toLowerCase()),
    );
    const matchType = !filterType || p.type === filterType;
    return matchSearch && matchType;
  });

  const waGeneral = waPhone
    ? buildWaLink(waPhone, `Hola ${orgName}, vi sus propiedades en AlquilaGestión Pro y quería consultar disponibilidad.`)
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#f0faf6', fontFamily: 'system-ui, sans-serif' }}>
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
            className="inline-flex items-center gap-2 mt-4 bg-white text-emerald-700 font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-emerald-50 transition-colors"
          >
            <MessageCircle size={15} />
            Contactar por WhatsApp
          </a>
        )}
      </header>

      {/* Filters */}
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
      </div>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-4 pb-16">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay propiedades disponibles en este momento.</p>
            {waGeneral && (
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <MessageCircle size={14} /> Consultá disponibilidades por WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <PropertyCard key={p.id} prop={p} phone={waPhone} orgName={orgName} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 bg-white">
        Gestionado con{' '}
        <a href="https://alquilagestionpro.com" className="text-emerald-600 font-medium hover:underline">
          AlquilaGestión Pro
        </a>
      </footer>
    </div>
  );
}
