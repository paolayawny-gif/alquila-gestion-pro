"use client";

import { useEffect, useState } from "react";
import { 
  Building, Users, FileText, Bell, TrendingUp, DollarSign, 
  Wallet, Wrench, FileCheck2, ArrowUpRight, ArrowDownRight,
  CalendarClock
} from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const dataChart = [
  { name: 'Ene', ingresos: 4500000, egresos: 1200000 },
  { name: 'Feb', ingresos: 4800000, egresos: 1100000 },
  { name: 'Mar', ingresos: 4600000, egresos: 1300000 },
  { name: 'Abr', ingresos: 5200000, egresos: 1000000 },
  { name: 'May', ingresos: 5800000, egresos: 1500000 },
  { name: 'Jun', ingresos: 6100000, egresos: 1400000 },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated fetch
    setTimeout(() => setLoading(false), 500);
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8 bg-gray-50 min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
            Panel de Administración
          </h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Resumen en tiempo real de propiedades, finanzas y operaciones.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">
            <Bell className="h-4 w-4 text-emerald-600 animate-pulse" /> 
            Alertas (5)
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md shadow-emerald-600/20 text-sm font-semibold hover:bg-emerald-700 transition-all">
            + Nuevo Contrato
          </button>
        </div>
      </div>

      <div className={`transition-opacity duration-700 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Propiedades Totales</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">42</h3>
              </div>
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Building className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded mr-2">35 Alquiladas</span>
              <span className="text-gray-400">7 Disponibles</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Recaudación del Mes</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">$6.1M</h3>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
              <span className="text-emerald-600 font-medium">12.5%</span>
              <span className="text-gray-400 ml-2">vs mes anterior</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Inquilinos en Mora</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">3</h3>
              </div>
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-red-500 font-medium flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-1" /> +1 este mes
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group hover:border-blue-200">
             <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Caja Diaria</p>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-2">ABIERTA</h3>
              </div>
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <Link href="/dashboard/caja" className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600 hover:underline">
              Ir a caja del día &rarr;
            </Link>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Flujo de Ingresos Anual</h2>
              <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1.5 font-medium outline-none">
                <option>2024</option>
                <option>2023</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `$${value/1000000}M`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Monto"]}
                  />
                  <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Accesos Rápidos</h2>
            <div className="grid grid-cols-2 gap-4 flex-1">
              {[
                { name: "Propiedades", icon: Building, color: "text-blue-600", bg: "bg-blue-50", link: "/propiedades" },
                { name: "Contratos", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", link: "/contratos" },
                { name: "Servicios", icon: FileCheck2, color: "text-indigo-600", bg: "bg-indigo-50", link: "/dashboard/comprobantes" },
                { name: "Tickets", icon: Wrench, color: "text-orange-600", bg: "bg-orange-50", link: "/tickets" }
              ].map((item, idx) => (
                <Link key={idx} href={item.link} className="flex flex-col items-center justify-center p-4 rounded-xl border border-transparent hover:border-gray-200 hover:shadow-sm bg-gray-50 hover:bg-white transition-all group">
                  <div className={`p-3 rounded-full ${item.bg} ${item.color} mb-3 group-hover:scale-110 transition-transform`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Lower Alerts Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Contratos por Ajustar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-500" /> Próximos Ajustes
              </h3>
              <span className="text-xs font-semibold text-gray-500 px-2 py-1 bg-gray-100 rounded-lg">Este mes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { prop: "Av. Libertador 1234, 4° B", date: "15 Oct", type: "ICL Anual", tenant: "Juan Pérez", increment: "Aprox +125%" },
                { prop: "Local Comercial Centro", date: "20 Oct", type: "IPC Trimestral", tenant: "Kiosko El Sol", increment: "A confirmar" },
              ].map((ajuste, i) => (
                <div key={i} className="p-5 hover:bg-gray-50/50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{ajuste.prop}</p>
                    <p className="text-xs text-gray-500 mt-1">{ajuste.tenant} • {ajuste.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">{ajuste.date}</p>
                    <p className="text-xs text-gray-400 mt-1">{ajuste.increment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tickets Operativos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-red-500" /> Reclamos Pendientes
              </h3>
              <Link href="/tickets" className="text-xs font-semibold text-emerald-600 hover:underline">Ver todos</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { title: "Filtración en el baño principal", prop: "San Martín 432", time: "hace 2 días", status: "PENDIENTE" },
                { title: "Estufa rota", prop: "Belgrano 98", time: "hace 5 horas", status: "COTIZANDO" },
              ].map((ticket, i) => (
                 <div key={i} className="p-5 hover:bg-gray-50/50 transition-colors flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{ticket.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{ticket.prop}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${ticket.status === 'PENDIENTE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {ticket.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{ticket.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
