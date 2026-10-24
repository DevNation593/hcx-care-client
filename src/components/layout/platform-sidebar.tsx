'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChevronLeft, ChevronRight, CreditCard, Layers, LayoutDashboard } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

const NAVIGATION = [
  { name: 'Resumen', href: ROUTES.PLATFORM, icon: LayoutDashboard, exact: true },
  { name: 'Consultorios', href: ROUTES.PLATFORM_TENANTS, icon: Building2, exact: false },
  { name: 'Planes', href: ROUTES.PLATFORM_PLANS, icon: Layers, exact: false },
  { name: 'Pagos', href: ROUTES.PLATFORM_PAYMENTS, icon: CreditCard, exact: false },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <div
      className={cn(
        'flex flex-col bg-card border-r transition-all duration-300 shrink-0',
        sidebarCollapsed
          ? 'hidden md:flex md:w-16'
          : 'fixed inset-y-0 left-0 z-50 flex w-64 shadow-xl md:static md:shadow-none'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <LogoMark />
            <p className="font-semibold text-sm">Panel de control</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          className={cn(sidebarCollapsed && 'mx-auto')}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                sidebarCollapsed && 'justify-center'
              )}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {!sidebarCollapsed && user && (
        <div className="p-4 border-t">
          <p className="text-sm font-medium truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      )}
    </div>
  );
}
