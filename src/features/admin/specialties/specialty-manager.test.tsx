import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { UserRole, type Tenant, type User } from '@/types';
import { SpecialtyManager } from './specialty-manager';

const api = vi.hoisted(() => ({ catalog: vi.fn(), specialties: vi.fn(), modules: vi.fn(), replace: vi.fn(), setModule: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({
  specialtyCatalogApi: { list: api.catalog },
  tenantSpecialtiesApi: { list: api.specialties, replace: api.replace },
  tenantModulesApi: { list: api.modules, setEnabled: api.setModule },
}));

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SpecialtyManager /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: { role: UserRole.MASTER, tenantId: 'tenant-1' } as User,
    tenant: { id: 'tenant-1' } as Tenant,
  });
  api.catalog.mockResolvedValue([
    { id: 's1', code: 'PSYCHOLOGY', name: 'Psicología', description: null, modules: [{ id: 'm1', moduleKey: 'psychology.assessments' }] },
    { id: 's2', code: 'NUTRITION', name: 'Nutrición', description: null, modules: [{ id: 'm2', moduleKey: 'nutrition.assessments' }] },
  ]);
  api.specialties.mockResolvedValue([{ id: 's1', code: 'PSYCHOLOGY', name: 'Psicología', isActive: true, modules: [] }]);
  api.modules.mockResolvedValue([{ id: 'tm1', tenantId: 'tenant-1', moduleKey: 'psychology.assessments', enabled: true }]);
});

describe('SpecialtyManager', () => {
  it('shows only assigned specialties and modules as read-only information', async () => {
    renderManager();
    expect(await screen.findByText('Evaluaciones psicológicas')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByText('Nutrición')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar especialidades' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(api.replace).not.toHaveBeenCalled();
    expect(api.setModule).not.toHaveBeenCalled();
  });

  it('shows a loading error without any assignment control', async () => {
    api.modules.mockRejectedValue(new Error('unavailable'));
    renderManager();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los módulos');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
