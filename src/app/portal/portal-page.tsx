'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, MapPin, Maximize2, BedDouble, Building2, ArrowUpRight,
  ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react';
import type { PortalProperty, PortalAdmin } from './page';

const DISPLAY = 'font-[family-name:var(--font-portal-display)]';

// Textura de grano sutil para dar atmósfera al hero.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Props {
  properties: PortalProperty[];
  admins: Record<string, PortalAdmin>;
}

function formatPrice(amount?: number, currency?: string) {
  if (!amount) return null;
  const prefix = (currency ?? 'ARS') === 'USD' ? 'USD' : '$';
  return `${prefix} ${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function PortalCard({ prop, adminName, index }: { prop: PortalProperty; adminName: string; index: number }) {
  const photos = (prop.photos ?? []).filter(Boolean);
  const cover = photos[0];
  const price = formatPrice(prop.currentRentAmount, prop.currency);

  return (
    <Link
      href={`/portal/${prop.adminId}/${prop.id}`}
      style={{ animationDelay: `${Math.min(index, 9) * 70}ms` }}
      className="group flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-[#E4DECB] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-22px_rgba(12,58,42,0.4)] animate-[portalRise_0.6s_cubic-bezier(0.22,1,0.36,1)_both]"
    >
      {/* Foto */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0C3A2A]">
        {cover ? (
          <img
            src={cover}
            alt={prop.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0C3A2A] to-[#15543d]">
            <Building2 size={44} className="text-[#2BBE8E]/40" strokeWidth={1.5} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0C3A2A] backdrop-blur">
          {prop.type}
        </span>

        {price ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold tabular-nums text-[#0C3A2A] shadow-lg">
            {price}
            <span className="ml-0.5 text-[11px] font-medium text-[#5C6B62]">/mes</span>
          </span>
        ) : (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#5C6B62]">
            Precio a consultar
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className={`${DISPLAY} text-[19px] font-semibold leading-snug text-[#14201A] transition-colors group-hover:text-[#1D9E75]`}>
            {prop.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#5C6B62]">
            <MapPin size={13} className="shrink-0 text-[#1D9E75]" />
            <span className="truncate">{prop.address}</span>
          </p>
        </div>

        <div className="mt-auto flex items-center gap-4 border-t border-[#EFEBDD] pt-3 text-[13px] text-[#3D4A43]">
          {prop.squareMeters ? (
            <span className="flex items-center gap-1.5">
              <Maximize2 size={14} className="text-[#9AA69E]" />
              {prop.squareMeters} m²
            </span>
          ) : null}
          {prop.rooms ? (
            <span className="flex items-center gap-1.5">
              <BedDouble size={14} className="text-[#9AA69E]" />
              {prop.rooms} amb.
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-[#1D9E75] opacity-0 transition-opacity group-hover:opacity-100">
            Ver <ArrowUpRight size={14} />
          </span>
        </div>

        <p className="text-[11px] uppercase tracking-[0.1em] text-[#9AA69E]">
          Publicado por {adminName}
        </p>
      </div>
    </Link>
  );
}

export function PortalPage({ properties, admins }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRooms, setMinRooms] = useState('');

  const types = useMemo(() => [...new Set(properties.map(p => p.type))].sort(), [properties]);

  const filtered = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const rooms = minRooms ? Number(minRooms) : null;
    return properties.filter(p => {
      const matchSearch = !search || [p.name, p.address, p.type].some(f =>
        f?.toLowerCase().includes(search.toLowerCase()),
      );
      const matchType = !filterType || p.type === filterType;
      const price = p.currentRentAmount ?? null;
      const matchMin = min === null || (price !== null && price >= min);
      const matchMax = max === null || (price !== null && price <= max);
      const matchRooms = rooms === null || (p.rooms ?? 0) >= rooms;
      return matchSearch && matchType && matchMin && matchMax && matchRooms;
    });
  }, [properties, search, filterType, minPrice, maxPrice, minRooms]);

  const hasFilters = !!(search || filterType || minPrice || maxPrice || minRooms);
  const clearFilters = () => {
    setSearch(''); setFilterType(''); setMinPrice(''); setMaxPrice(''); setMinRooms('');
  };

  const inputCls =
    'rounded-xl border border-[#E4DECB] bg-[#FBFAF4] px-3 py-2.5 text-sm text-[#14201A] outline-none transition-colors placeholder:text-[#9AA69E] focus:border-[#1D9E75] focus:bg-white focus:ring-2 focus:ring-[#1D9E75]/15';

  return (
    <div
      className="portal-scope min-h-screen bg-[#F4F1E8] font-[family-name:var(--font-portal-body)] text-[#14201A] antialiased"
    >
      {/* ───────── Hero ───────── */}
      <header className="relative overflow-hidden bg-[#0C3A2A] text-white">
        {/* Resplandor */}
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-[460px] w-[460px] rounded-full animate-[portalGlow_7s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(43,190,142,0.55) 0%, rgba(43,190,142,0) 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(29,158,117,0.28) 0%, rgba(29,158,117,0) 70%)' }}
        />
        {/* Grano */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />

        <div className="relative mx-auto max-w-6xl px-5">
          {/* Nav */}
          <nav className="flex items-center justify-between py-6">
            <Link href="/portal" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D9E75] shadow-lg shadow-[#1D9E75]/30">
                <Building2 size={18} className="text-white" strokeWidth={2.2} />
              </span>
              <span className={`${DISPLAY} text-lg font-semibold tracking-tight`}>
                AlquilaGestión <span className="text-[#2BBE8E]">Pro</span>
              </span>
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:border-white/60 hover:text-white"
            >
              Ingresá a la app
            </Link>
          </nav>

          {/* Headline */}
          <div className="pb-14 pt-10 sm:pt-16">
            <p
              className="mb-5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.28em] text-[#2BBE8E] animate-[portalFade_0.8s_ease-out_both]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#2BBE8E]" />
              Portal inmobiliario
            </p>
            <h1
              className={`${DISPLAY} max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[64px] animate-[portalRise_0.7s_cubic-bezier(0.22,1,0.36,1)_both]`}
            >
              Encontrá el lugar
              <br />
              donde <span className="italic text-[#2BBE8E]">querés vivir</span>.
            </h1>
            <p
              className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/65 animate-[portalRise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.1s_both]"
            >
              Propiedades en alquiler publicadas por inmobiliarias y administradores
              verificados de toda la Argentina.
            </p>

            {/* Buscador */}
            <div
              className="mt-9 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] animate-[portalRise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]"
            >
              <Search size={20} className="ml-3 shrink-0 text-[#9AA69E]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscá por barrio, ciudad o dirección…"
                className="flex-1 bg-transparent py-2.5 text-[15px] text-[#14201A] outline-none placeholder:text-[#9AA69E]"
              />
              <span className="hidden rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white sm:block">
                Buscar
              </span>
            </div>

            {/* Stat */}
            <p
              className="mt-6 flex items-center gap-2 text-[13px] text-white/55 animate-[portalFade_1s_ease-out_0.4s_both]"
            >
              <ShieldCheck size={15} className="text-[#2BBE8E]" />
              <strong className="font-semibold text-white/85">{properties.length}</strong>
              propiedad{properties.length !== 1 ? 'es' : ''} activa{properties.length !== 1 ? 's' : ''}
              <span className="text-white/30">·</span>
              inmobiliarias verificadas
            </p>
          </div>
        </div>
      </header>

      {/* ───────── Filtros (tarjeta flotante) ───────── */}
      <div className="relative z-10 mx-auto -mt-9 max-w-6xl px-5">
        <div className="rounded-[22px] bg-white p-4 shadow-[0_18px_44px_-26px_rgba(12,58,42,0.5)] ring-1 ring-[#E4DECB]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#9AA69E]">
              <SlidersHorizontal size={14} /> Filtrar
            </span>

            {/* Tipos */}
            {types.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterType('')}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    !filterType ? 'bg-[#0C3A2A] text-white' : 'bg-[#F4F1E8] text-[#5C6B62] hover:bg-[#E9E4D4]'
                  }`}
                >
                  Todos
                </button>
                {types.map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? '' : t)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      filterType === t ? 'bg-[#0C3A2A] text-white' : 'bg-[#F4F1E8] text-[#5C6B62] hover:bg-[#E9E4D4]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                type="number"
                placeholder="Precio mín."
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className={`w-28 ${inputCls}`}
              />
              <input
                type="number"
                placeholder="Precio máx."
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className={`w-28 ${inputCls}`}
              />
              <select
                value={minRooms}
                onChange={e => setMinRooms(e.target.value)}
                className={inputCls}
              >
                <option value="">Ambientes</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+ amb.</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Resultados ───────── */}
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className={`${DISPLAY} text-2xl font-semibold text-[#14201A]`}>
              {hasFilters ? 'Resultados de tu búsqueda' : 'Propiedades destacadas'}
            </h2>
            <p className="mt-0.5 text-[13px] text-[#5C6B62]">
              {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5C6B62] transition-colors hover:text-[#1D9E75]"
            >
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-[24px] border border-dashed border-[#D8D1BC] bg-white/60 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0C3A2A]/5">
              <Building2 size={30} className="text-[#0C3A2A]/30" strokeWidth={1.5} />
            </div>
            <p className={`${DISPLAY} mt-5 text-xl font-semibold text-[#14201A]`}>
              No encontramos propiedades
            </p>
            <p className="mt-1 max-w-sm text-[14px] text-[#5C6B62]">
              {hasFilters
                ? 'Probá ajustar los filtros o ampliar tu búsqueda.'
                : 'Todavía no hay publicaciones activas. Volvé pronto.'}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-6 rounded-full bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <PortalCard
                key={`${p.adminId}-${p.id}`}
                prop={p}
                index={i}
                adminName={admins[p.adminId]?.displayName ?? 'Inmobiliaria'}
              />
            ))}
          </div>
        )}
      </main>

      {/* ───────── CTA administradores ───────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0C3A2A] px-8 py-12 sm:px-14">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(43,190,142,0.4) 0%, rgba(43,190,142,0) 70%)' }}
          />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.24em] text-[#2BBE8E]">
                Para inmobiliarias
              </p>
              <h3 className={`${DISPLAY} max-w-md text-[28px] font-semibold leading-tight text-white`}>
                Publicá tus propiedades en el portal
              </h3>
              <p className="mt-2 max-w-md text-[14px] text-white/60">
                Gestioná alquileres, contratos y publicaciones desde un solo lugar con AlquilaGestión Pro.
              </p>
            </div>
            <Link
              href="/login"
              className="group flex shrink-0 items-center gap-2 rounded-full bg-[#1D9E75] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#2BBE8E]"
            >
              Ingresá a la app
              <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-[#E4DECB] bg-[#F4F1E8]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-10 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0C3A2A]">
              <Building2 size={15} className="text-[#2BBE8E]" strokeWidth={2.2} />
            </span>
            <span className={`${DISPLAY} text-[15px] font-semibold text-[#14201A]`}>
              AlquilaGestión Pro
            </span>
          </div>
          <p className="text-[12px] text-[#9AA69E]">
            Portal inmobiliario · {new Date().getFullYear()} · Hecho en Argentina
          </p>
        </div>
      </footer>
    </div>
  );
}
