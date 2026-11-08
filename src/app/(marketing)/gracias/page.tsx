import Link from 'next/link';
import { site } from '@/content/site';
import { Breadcrumbs } from '@/features/marketing/breadcrumbs';
import { buildMetadata } from '@/features/marketing/seo';

export const metadata = buildMetadata('thanks');

export default function ThanksPage() {
  return (
    <>
      <Breadcrumbs page="thanks" />
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">¡Gracias por tu solicitud!</h1>
      <p className="mt-4 text-muted-foreground">
        Recibimos tu solicitud de demo. {site.contact.responseTime}
      </p>
      <ul className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
        <li><Link href="/como-funciona" className="text-primary underline">Ver cómo funciona</Link></li>
        <li><Link href="/planes" className="text-primary underline">Comparar planes</Link></li>
        <li><Link href="/" className="text-primary underline">Volver al inicio</Link></li>
      </ul>
      </div>
    </>
  );
}
