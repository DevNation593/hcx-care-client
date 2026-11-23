import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecordPrintPage from './page';

const mocks = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), search: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  useParams: () => ({ id: 'patient-1', recordId: 'record-1' }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@/hooks/useSections', () => ({
  useSections: () => ({ isEnabled: () => true, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/usePatients', () => ({
  usePatient: () => ({ data: { id: 'patient-1', firstName: 'Ana', lastName: 'Vega' }, isError: false }),
}));
vi.mock('@/hooks/useSpecialtyRecords', () => ({
  usePatientSpecialtyRecord: () => ({
    data: { id: 'record-1', moduleKey: 'general.vital-signs', schemaVersion: 1 },
    isError: false,
  }),
}));
vi.mock('@/hooks/useClinicalModules', () => ({
  useClinicalModules: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/useDocuments', () => ({
  useSaveRecordDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/patients/record-document', () => ({
  RecordDocument: () => <p>Documento</p>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = '';
});

describe('the printed record: way back', () => {
  it('returns to the clinical history when it was opened from there', () => {
    mocks.search = 'from=clinical';
    render(<RecordPrintPage />);

    fireEvent.click(screen.getByRole('button', { name: /Volver a la historia clínica/ }));
    expect(mocks.push).toHaveBeenCalledWith('/patients/patient-1?tab=clinical');
  });

  it('returns to the records tab otherwise, and never to the general tab', () => {
    render(<RecordPrintPage />);

    fireEvent.click(screen.getByRole('button', { name: /Volver a los registros clínicos/ }));
    expect(mocks.push).toHaveBeenCalledWith('/patients/patient-1?tab=specialties');
  });

  it.each(['https://evil.example', '//evil.example', 'javascript:alert(1)', '../..', 'nope'])(
    'ignores %s in ?from=',
    (from) => {
      mocks.search = new URLSearchParams({ from }).toString();
      render(<RecordPrintPage />);

      fireEvent.click(screen.getByRole('button', { name: /Volver a los registros clínicos/ }));
      expect(mocks.push).toHaveBeenCalledWith('/patients/patient-1?tab=specialties');
    },
  );
});
