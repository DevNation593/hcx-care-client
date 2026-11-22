import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import MarketingError from './error';
import MarketingLayout from './layout';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/features/marketing/consent/sentry-browser', () => ({
  SentryBrowser: () => <div data-testid="sentry-browser" />,
}));
vi.mock('@/features/marketing/consent/cookie-banner', () => ({ CookieBanner: () => null }));
vi.mock('@/features/marketing/consent/google-analytics', () => ({ GoogleAnalytics: () => null }));
vi.mock('@/features/marketing/mobile-cta', () => ({ MobileCta: () => null }));
vi.mock('@/features/marketing/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/features/marketing/site-header', () => ({ SiteHeader: () => null }));

afterEach(() => cleanup());

describe('(marketing) error boundary', () => {
  it('renders the shared fallback embedded (no nested <main>) and reports the error', () => {
    const error = new Error('render boom');
    const reset = vi.fn();

    const { container } = render(<MarketingError error={error} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument();
    expect(container.querySelector('main')).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('sits inside the layout: its <main id="contenido"> is the only <main> and SentryBrowser stays mounted', () => {
    const { container } = render(
      <MarketingLayout>
        <MarketingError error={new Error('render boom')} reset={vi.fn()} />
      </MarketingLayout>,
    );

    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('main#contenido')).toContainElement(
      screen.getByRole('heading', { name: 'Algo salió mal' }),
    );
    expect(screen.getByTestId('sentry-browser')).toBeInTheDocument();
  });
});
