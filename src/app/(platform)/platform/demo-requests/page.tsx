import { DemoRequestsTable } from '@/features/platform/demo-requests-table';

export default function PlatformDemoRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitudes de demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que envían los visitantes desde el formulario de contacto del sitio público.
        </p>
      </div>
      <DemoRequestsTable />
    </div>
  );
}
