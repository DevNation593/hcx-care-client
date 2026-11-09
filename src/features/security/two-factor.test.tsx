import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postLoginRoute } from '@/lib/post-login-route';
import { UserRole } from '@/types';
import { TwoFactorEnrollment } from './two-factor-setup';

const api = vi.hoisted(() => ({
  login: vi.fn(),
  verifyMfa: vi.fn(),
  setupMfa: vi.fn(),
  enableMfa: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/api/endpoints', () => ({
  authApi: {
    login: api.login,
    verifyMfa: api.verifyMfa,
    setupMfa: api.setupMfa,
    enableMfa: api.enableMfa,
  },
  tenantsApi: { get: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push, replace: api.push }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { setTokens: vi.fn() } }));

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {node}
  </QueryClientProvider>
);

beforeEach(() => vi.clearAllMocks());

describe('postLoginRoute', () => {
  it('sends an account the clinic requires a second factor from to its setup first', () => {
    expect(postLoginRoute({ role: UserRole.PROFESIONAL, mfaEnrollmentRequired: true })).toBe(
      '/security/two-factor',
    );
    // The temporary password still comes before it.
    expect(
      postLoginRoute({ role: UserRole.PROFESIONAL, mustChangePassword: true, mfaEnrollmentRequired: true }),
    ).toBe('/change-password');
  });
});

describe('TwoFactorEnrollment', () => {
  it('asks the password, shows the QR, confirms a code and shows the recovery codes once', async () => {
    api.setupMfa.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/x',
      qrCodeDataUrl: 'data:image/png;base64,AAAA',
    });
    api.enableMfa.mockResolvedValue({ recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'] });
    const onEnabled = vi.fn();
    render(wrap(<TwoFactorEnrollment onEnabled={onEnabled} />));

    fireEvent.change(screen.getByLabelText('Tu contraseña'), { target: { value: 'Password123!' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' })));
    expect(api.setupMfa).toHaveBeenCalledWith('Password123!');
    expect(screen.getByAltText(/Código QR/)).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();

    const activate = screen.getByRole('button', { name: /Activar/ });
    fireEvent.change(screen.getByLabelText('Código de la aplicación'), { target: { value: '12 34a5' } });
    expect(activate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Código de la aplicación'), { target: { value: '123 456' } });
    await act(async () => fireEvent.click(activate));

    expect(api.enableMfa).toHaveBeenCalledWith('123456');
    expect(screen.getByText('aaaa-bbbb')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ya guardé los códigos' }));
    expect(onEnabled).toHaveBeenCalled();
  });
});

describe('LoginPage', () => {
  it('asks the code of the app after a correct password of an account with two-factor', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page');
    api.login.mockResolvedValue({ mfaRequired: true, mfaToken: 'challenge' });
    api.verifyMfa.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u', role: UserRole.PROFESIONAL, tenantId: 'tenant-1' },
    });
    render(wrap(<LoginPage />));

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'Password123!' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' })));

    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Código/), { target: { value: '654321' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verificar' })));
    expect(api.verifyMfa).toHaveBeenCalledWith({ mfaToken: 'challenge', code: '654321' });

    // Or a recovery code, when the phone is not at hand.
    fireEvent.click(screen.getByRole('button', { name: /usar un código de recuperación/ }));
    expect(screen.getByLabelText(/Código de recuperación/)).toBeInTheDocument();
  });
});
