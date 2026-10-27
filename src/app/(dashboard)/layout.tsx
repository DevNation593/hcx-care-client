'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { NotificationsPanel } from '@/components/layout/notifications-panel';
import { useUIStore } from '@/store/uiStore';
import { postLoginRoute } from '@/lib/post-login-route';
import { ROUTES } from '@/lib/constants';
import { isCashierPath } from '@/lib/cashier-routes';
import { isCashierRole } from '@/types/guards';


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const user = useAuthStore((state) => state.user);
  // Anything other than the dashboard means this user does not belong in it.
  const homeRoute = user ? postLoginRoute(user) : ROUTES.DASHBOARD;
  // A cashier belongs in the panel, but only on its allowed pages.
  const isCashier = !!user && !user.mustChangePassword && isCashierRole(user.role);
  const offLimits = isCashier && !isCashierPath(pathname);
  const leavesPanel = isCashier ? offLimits : homeRoute !== ROUTES.DASHBOARD;
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);

  useEffect(() => {
    if (window.innerWidth < 768) {
      useUIStore.getState().setSidebarCollapsed(true);
    }
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (leavesPanel) {
      router.replace(homeRoute);
    }
  }, [isAuthenticated, hasHydrated, homeRoute, leavesPanel, router]);

  if (!hasHydrated) {
    return null;
  }
  if (!isAuthenticated || leavesPanel) {
    return null;
  }

  return (
    // Printing a clinical document shows only the page: no navigation, no clipping.
    <div className="min-h-screen flex overflow-hidden bg-background print:block print:overflow-visible">
      <div className="contents print:hidden">
        <Sidebar />
      </div>
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => useUIStore.getState().setSidebarCollapsed(true)}
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        <div className="contents print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
      <div className="contents print:hidden">
        <NotificationsPanel />
      </div>
    </div>
  );
}
