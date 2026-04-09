'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, BarChart2, Wallet, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const nav = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/transactions',  label: 'Transacciones',  icon: ArrowLeftRight },
  { href: '/reports',       label: 'Reportes',       icon: BarChart2 },
  { href: '/accounts',      label: 'Cuentas',        icon: Wallet },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-[#1A1A2E] border-r border-[#2A2A45] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-[#2A2A45]">
        <h1 className="text-2xl font-bold">
          <span className="text-[#7B68EE]">Gast</span>
          <span className="text-white">app</span>
        </h1>
        <p className="text-[#8888AA] text-xs mt-1">Finanzas personales</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
                active
                  ? 'bg-[#7B68EE]/20 text-[#7B68EE]'
                  : 'text-[#8888AA] hover:bg-[#252540] hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 pb-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#8888AA] hover:bg-[#252540] hover:text-[#FF6B6B] transition-colors text-sm font-medium w-full"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
