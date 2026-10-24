import { PlansManager } from '@/features/platform/plans-manager';

export default function PlatformPlansPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Planes</h1>
      <PlansManager />
    </div>
  );
}
