import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type User } from '@/types';
import DashboardLayout from './layout';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

const route = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => route.pathname,
}));
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('@/components/layout/header', () => ({ Header: () => <header /> }));
vi.mock('@/components/layout/notifications-panel', () => ({ NotificationsPanel: () => null }));

const signIn = (user: Partial<User>) =>
  useAuthStore.setState({
    user: { id: 'user-1', tenantId: 'tenant-1', ...user } as User,
    isAuthenticated: true,
    hasHydrated: true,
  });

beforeEach(() => {
  vi.clearAllMocks();
  route.pathname = '/dashboard';
  useAuthStore.setState({ user: null, tenant: null, isAuthenticated: false, hasHydrated: true });
});

describe('DashboardLayout routing', () => {
  it('sends an ADMIN to /platform', () => {
    signIn({ role: UserRole.ADMIN });
    render(<DashboardLayout><p>content</p></DashboardLayout>);
    expect(router.replace).toHaveBeenCalledWith('/platform');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('sends a user with a temporary password to /change-password', () => {
    signIn({ role: UserRole.MASTER, mustChangePassword: true });
    render(<DashboardLayout><p>content</p></DashboardLayout>);
    expect(router.replace).toHaveBeenCalledWith('/change-password');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it.each(['/dashboard', '/patients/123'])('sends a CAJERO on %s to /cash', (pathname) => {
    route.pathname = pathname;
    signIn({ role: UserRole.CAJERO, mustChangePassword: false });
    render(<DashboardLayout><p>content</p></DashboardLayout>);
    expect(router.replace).toHaveBeenCalledWith('/cash');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it.each(['/cash', '/inventory', '/admin/billing', '/profile'])('keeps a CAJERO on %s', (pathname) => {
    route.pathname = pathname;
    signIn({ role: UserRole.CAJERO, mustChangePassword: false });
    render(<DashboardLayout><p>content</p></DashboardLayout>);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows the dashboard to a regular user', () => {
    signIn({ role: UserRole.MASTER, mustChangePassword: false });
    render(<DashboardLayout><p>content</p></DashboardLayout>);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
