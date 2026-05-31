'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2, MapPin, Maximize2, BedDouble, MessageCircle, ChevronLeft,
  ChevronRight, ArrowLeft, ArrowUpRight, Layers, Check,
} from 'lucide-react';

const DISPLAY = 'font-[family-name:var(--font-portal-display)]';

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  usage?: string;
  squareMeters?: number;
  rooms?: number;
  floor?: string;
  amenities?: string[];
  photos?: string[];
  features?: string;
  currentRentAmount?: number;
  currency?: string;
  status: string;
}

interface Props {
  adminId: string;
  property: Property;
  profile: {
    displayName?: string;
    whatsappNumber?: string;
    logoUrl?: string;
  };
}

function buildWaLink(phone: string, message: string) {
  const n = phone.replace(/[\s\-\(\)\+\.]/g, '').replace(/^0/, '54');
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function PropertyDetail({ adminId, property, profile }: Props) {
  const photos = (property.photos ?? []).filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);
  const hasPhotos = photos.length > 0;

  const orgName = profile.displayName ?? 'Inmobiliaria';
  const waPhone = profile.whatsappNumber;
  const waMsg = `Hola ${orgName}, vi la propiedad "${property.name}" en ${property.address} en el portal y me gustaría recibir más información.`;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(property.address)}&output=embed`;
  const price = property.currentRentAmount
    ? `${(property.currency ?? 'ARS') === 'USD' ? 'USD' : '$'} ${property.currentRentAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
    : null;

  return (
    <div className="portal-scope min-h-screen bg-[#F4F1E8] font-[family-name:var(--font-portal-body)] text-[#0d1f3c] antialiased">
      {/* ───────── Nav ───────── */}
      <header className="bg-[#023d6b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/portal"
            className="group flex items-center gap-2 text-sm font-semibold text-white/85 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Volver al portal
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:border-white/60 hover:text-white"
          >
            Ingresá a la app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* ───────── Galería ───────── */}
        <div className="animate-[portalRise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-[#023d6b] ring-1 ring-[#E4DECB] sm:aspect-[16/8]">
            {hasPhotos ? (
              <img src={photos[photoIdx]} alt={property.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#023d6b] to-[#034f7a]">
                <Building2 size={60} className="text-[#38bdf8]/40" strokeWidth={1.5} />
              </div>
            )}
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#023d6b] backdrop-blur">
              {property.type}
            </span>

            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-[#023d6b] shadow-lg transition-transform hover:scale-110"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-[#023d6b] shadow-lg transition-transform hover:scale-110"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {photoIdx + 1} / {photos.length}
                </span>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoIdx(i)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl transition-all ${
                    i === photoIdx ? 'ring-2 ring-[#0369A1] ring-offset-2 ring-offset-[#F4F1E8]' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ───────── Contenido ───────── */}
        <div className="mt-9 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          {/* Columna principal */}
          <div className="flex flex-col gap-8">
            <div>
              <h1 className={`${DISPLAY} text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0d1f3c] sm:text-[40px]`}>
                {property.name}
              </h1>
              <p className="mt-3 flex items-center gap-2 text-[15px] text-[#4b6584]">
                <MapPin size={17} className="shrink-0 text-[#0369A1]" />
                {property.address}
              </p>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] bg-[#E4DECB] ring-1 ring-[#E4DECB] sm:grid-cols-4">
              {[
                property.squareMeters ? { icon: Maximize2, label: 'Superficie', value: `${property.squareMeters} m²` } : null,
                property.rooms ? { icon: BedDouble, label: 'Ambientes', value: String(property.rooms) } : null,
                property.floor ? { icon: Layers, label: 'Piso', value: property.floor } : null,
                { icon: Building2, label: 'Tipo', value: property.type },
              ].filter((x): x is { icon: typeof Maximize2; label: string; value: string } => x !== null).map(s => (
                <div key={s.label} className="flex flex-col gap-1.5 bg-white p-4">
                  <s.icon size={17} className="text-[#0369A1]" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[#94a3b8]">{s.label}</span>
                  <span className="text-[15px] font-bold text-[#0d1f3c]">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Comodidades */}
            {(property.amenities ?? []).length > 0 && (
              <section>
                <h2 className={`${DISPLAY} mb-3 text-xl font-semibold text-[#0d1f3c]`}>Comodidades</h2>
                <div className="flex flex-wrap gap-2">
                  {property.amenities!.map(a => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-[#3D4A43] ring-1 ring-[#E4DECB]"
                    >
                      <Check size={13} className="text-[#0369A1]" />
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Descripción */}
            {property.features && (
              <section>
                <h2 className={`${DISPLAY} mb-3 text-xl font-semibold text-[#0d1f3c]`}>Descripción</h2>
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3D4A43]">
                  {property.features}
                </p>
              </section>
            )}

            {/* Mapa */}
            <section>
              <h2 className={`${DISPLAY} mb-3 text-xl font-semibold text-[#0d1f3c]`}>Ubicación</h2>
              <iframe
                title="Mapa de la propiedad"
                src={mapSrc}
                className="h-72 w-full rounded-[18px] ring-1 ring-[#E4DECB]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          </div>

          {/* Sidebar contacto */}
          <aside>
            <div className="flex flex-col gap-5 rounded-[22px] bg-white p-6 ring-1 ring-[#E4DECB] shadow-[0_18px_44px_-30px_rgba(12,58,42,0.5)] lg:sticky lg:top-6">
              <div>
                <p className="text-[12px] uppercase tracking-[0.14em] text-[#94a3b8]">Alquiler mensual</p>
                {price ? (
                  <p className={`${DISPLAY} mt-1 text-[32px] font-semibold tabular-nums text-[#023d6b]`}>
                    {price}
                  </p>
                ) : (
                  <p className={`${DISPLAY} mt-1 text-[24px] font-semibold text-[#4b6584]`}>
                    A consultar
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-[#EFEBDD] pt-5">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt={orgName} className="h-11 w-11 rounded-xl object-contain ring-1 ring-[#E4DECB]" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#023d6b]">
                    <Building2 size={18} className="text-[#38bdf8]" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-[#94a3b8]">Publicado por</p>
                  <p className="truncate text-[15px] font-bold text-[#0d1f3c]">{orgName}</p>
                </div>
              </div>

              {waPhone ? (
                <a
                  href={buildWaLink(waPhone, waMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#0369A1] py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#38bdf8]"
                >
                  <MessageCircle size={18} />
                  Consultar por WhatsApp
                </a>
              ) : (
                <div className="rounded-2xl bg-[#F4F1E8] py-3.5 text-center text-sm font-medium text-[#94a3b8]">
                  Contacto no disponible
                </div>
              )}

              <Link
                href={`/p/${adminId}`}
                className="group flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#0369A1] transition-colors hover:text-[#023d6b]"
              >
                Ver más propiedades de {orgName}
                <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </aside>
        </div>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-[#E4DECB]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-10 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#023d6b]">
              <Building2 size={15} className="text-[#38bdf8]" strokeWidth={2.2} />
            </span>
            <span className={`${DISPLAY} text-[15px] font-semibold text-[#0d1f3c]`}>
              AlquilaGestión Pro
            </span>
          </div>
          <p className="text-[12px] text-[#94a3b8]">
            Portal inmobiliario · {new Date().getFullYear()} · Hecho en Argentina
          </p>
        </div>
      </footer>
    </div>
  );
}
