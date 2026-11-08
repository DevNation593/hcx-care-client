import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import AuthLayout from './layout';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: false, hasHydrated: true });
});

describe('AuthLayout', () => {
  it('links back to the public site from the login screens', () => {
    render(
      <AuthLayout>
        <p>Formulario</p>
      </AuthLayout>,
    );

    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Formulario')).toBeInTheDocument();
  });
});
