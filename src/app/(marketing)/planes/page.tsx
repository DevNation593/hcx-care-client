import { site } from '@/content/site';
import { Breadcrumbs } from '@/features/marketing/breadcrumbs';
import { ContactCta } from '@/features/marketing/sections/contact-cta';
import { FaqSection } from '@/features/marketing/sections/faq';
import { PlanLadder } from '@/features/marketing/sections/plan-ladder';
import { buildMetadata } from '@/features/marketing/seo';

export const metadata = buildMetadata('plans');

export default function PlansPage() {
  return (
    <>
      <Breadcrumbs page="plans" />
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="text-3xl font-bold">Planes y precios</h1>
        <p className="mt-2 text-muted-foreground">Desde un consultorio independiente hasta una clínica con varias sedes. Todos incluyen agenda, historia clínica y facturación electrónica.</p>
      </div>
      <PlanLadder plans={site.plans} heading="Elige tu plan" />
      <FaqSection faq={site.faq} />
      <ContactCta contact={site.contact} />
    </>
  );
}
