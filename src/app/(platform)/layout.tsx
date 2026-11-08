'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { Header } from '@/components/layout/header';
import { useUIStore } from '@/store/uiStore';
import { postLoginRoute } from '@/lib/post-login-route';
import { ROUTES } from '@/lib/constants';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const user = useAuthStore((state) => state.user);
  // Anything other than the platform panel means this user does not belong in it.
  const homeRoute = user ? postLoginRoute(user) : ROUTES.PLATFORM;
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
    if (homeRoute !== ROUTES.PLATFORM) {
      router.replace(homeRoute);
    }
  }, [isAuthenticated, hasHydrated, homeRoute, router]);

  if (!hasHydrated) {
    return null;
  }
  if (!isAuthenticated || homeRoute !== ROUTES.PLATFORM) {
    return null;
  }

  return (
    // One viewport tall: only <main> scrolls, the sidebar and header stay put.
    <div className="h-dvh flex overflow-hidden bg-background">
      <PlatformSidebar />
      {!sidebarCollapsed && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => useUIStore.getState().setSidebarCollapsed(true)}
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
