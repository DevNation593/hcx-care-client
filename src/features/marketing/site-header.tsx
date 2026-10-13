import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { AuthLink } from './auth-link';
import { PAGES, isIndexable, type PageKey } from './seo';

const NAV: PageKey[] = ['howItWorks', 'plans', 'caseStudies', 'about', 'contact'];
const cta = 'inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90';

export function SiteHeader() {
  // Pages without content (e.g. case studies) stay out of the navigation.
  const links = NAV.filter((key) => isIndexable(key));
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 md:h-16 md:flex-nowrap">
        <Link href="/" className="py-3 md:py-0"><Logo /></Link>
        {/* On phones the links sit on their own scrollable row under the brand. */}
        <nav aria-label="Principal" className="order-last flex w-full gap-6 overflow-x-auto whitespace-nowrap pb-3 md:order-none md:w-auto md:pb-0">
          {links.map((key) => (
            <Link key={key} href={PAGES[key].path} className="text-sm text-muted-foreground hover:text-foreground">
              {PAGES[key].label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <AuthLink />
          <Link href="/contacto" className={`${cta} hidden sm:inline-flex`}>Solicitar demo</Link>
        </div>
      </div>
    </header>
  );
}
