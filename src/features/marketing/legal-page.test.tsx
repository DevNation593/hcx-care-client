import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CookiesText from '@/content/legal/cookies';
import DataProcessingText from '@/content/legal/data-processing';
import PrivacyText from '@/content/legal/privacy';
import TermsText from '@/content/legal/terms';
import { LegalPage } from './legal-page';

const draft = { companyName: '', taxId: '', address: '', dataContactEmail: '', reviewed: false };
const reviewed = { companyName: 'Salud SA', taxId: '1790000000001', address: 'Quito', dataContactEmail: 'datos@example.com', reviewed: true };

describe('LegalPage', () => {
  it('warns that an unreviewed text is a draft', () => {
    render(<LegalPage page="privacy" legal={draft}><p>Cuerpo</p></LegalPage>);
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Borrador pendiente de revisión legal');
  });

  it('drops the warning once reviewed', () => {
    render(<LegalPage page="privacy" legal={reviewed}><p>Cuerpo</p></LegalPage>);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('legal texts', () => {
  it.each([
    ['terms', TermsText],
    ['privacy', PrivacyText],
    ['cookies', CookiesText],
    ['data processing', DataProcessingText],
  ])('%s names the responsible party and never prints empty fields', (_name, Text) => {
    const filled = render(<Text legal={reviewed} brand="Marca" />);
    expect(filled.container).toHaveTextContent('Salud SA');
    filled.unmount();

    const empty = render(<Text legal={draft} brand="Marca" />);
    expect(empty.container).toHaveTextContent('[pendiente]');
    expect(empty.container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(5);
  });

  it('the privacy policy says the demo form stores the request and who sees it', () => {
    const { container } = render(<PrivacyText legal={reviewed} brand="Marca" />);
    expect(container).toHaveTextContent('se guardan en nuestra base de datos');
    expect(container).toHaveTextContent('panel de control');
    expect(container).toHaveTextContent('Conservamos tu solicitud de demo');
    expect(container).not.toHaveTextContent('no almacena');
  });

  it('the cookie policy names the analytics cookies and how to change the choice', () => {
    const { container } = render(<CookiesText legal={reviewed} brand="Marca" />);
    expect(container).toHaveTextContent('Google Analytics');
    expect(container).toHaveTextContent('Preferencias de cookies');
    expect(container).toHaveTextContent('cookie-consent');
  });
});
