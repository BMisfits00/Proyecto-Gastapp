'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, BarChart2, Wallet, LogOut, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const nav = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/accounts',      label: 'Cuentas',        icon: Wallet },
  { href: '/transactions',  label: 'Transacciones',  icon: ArrowLeftRight },
  { href: '/reports',       label: 'Reportes',       icon: BarChart2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col shadow-sm">
      {/* Brand Header */}
      <div className="px-6 py-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1E40AF] text-white flex items-center justify-center shadow-sm">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            <span className="text-[#1E40AF]">Gast</span>app
          </h1>
          <p className="text-slate-500 text-xs font-medium">Banca Personal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-sm font-semibold ${
                active
                  ? 'bg-blue-50 text-[#1E40AF] shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#1E40AF]' : 'text-slate-400'}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="px-3 pb-6 pt-2 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-semibold w-full cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
