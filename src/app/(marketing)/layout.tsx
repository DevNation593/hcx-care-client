import { site } from '@/content/site';
import { CookieBanner } from '@/features/marketing/consent/cookie-banner';
import { GoogleAnalytics } from '@/features/marketing/consent/google-analytics';
import { SentryBrowser } from '@/features/marketing/consent/sentry-browser';
import { MobileCta } from '@/features/marketing/mobile-cta';
import { SiteFooter } from '@/features/marketing/site-footer';
import { SiteHeader } from '@/features/marketing/site-header';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // Bottom padding keeps the footer clear of the fixed mobile CTA.
    <div className="flex min-h-screen flex-col pb-[4.5rem] md:pb-0">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:p-2">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido" className="flex-1">{children}</main>
      <SiteFooter />
      <MobileCta contact={site.contact} />
      <CookieBanner />
      <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_ID} />
      <SentryBrowser
        dsn={process.env.NEXT_PUBLIC_SENTRY_DSN}
        environment={process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV}
      />
    </div>
  );
}
