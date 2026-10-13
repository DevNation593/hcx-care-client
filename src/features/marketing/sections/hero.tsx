import Link from 'next/link';
import { hasWhatsappNumber, type ContactInfo, type SiteContent } from '@/content/site';
import { whatsappUrl } from '../demo-request';

export function Hero({ brand, hero, contact }: { brand: string; hero: SiteContent['hero']; contact: ContactInfo }) {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-background">
      {/* Compact vertical padding keeps both CTAs above the fold on small phones. */}
      <div className="mx-auto max-w-6xl px-4 py-12 text-center md:py-24">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{brand}</p>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">{hero.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{hero.subtitle}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/contacto" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Solicitar demo
          </Link>
          {hasWhatsappNumber(contact.whatsappNumber) && (
            <a
              href={whatsappUrl(contact.whatsappNumber, 'Hola, quiero información sobre la plataforma.')}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-md border px-8 text-sm font-medium hover:bg-accent"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
        {contact.responseTime && <p className="mt-3 text-sm text-muted-foreground">{contact.responseTime}</p>}
      </div>
    </section>
  );
}
