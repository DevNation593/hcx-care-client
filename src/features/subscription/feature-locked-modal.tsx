'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useCanManageAccount } from '@/hooks/useCanManageAccount';
import { useSubscription } from '@/hooks/useSubscription';
import { PlanTier } from '@/types';
import { ROUTES } from '@/lib/constants';

interface FeatureLockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  featureDescription?: string;
  benefits?: string[];
}

export function FeatureLockedModal({
  open,
  onOpenChange,
  featureName,
  featureDescription,
  benefits = [],
}: FeatureLockedModalProps) {
  const router = useRouter();
  const { data: subscription } = useSubscription();
  const canManage = useCanManageAccount();

  const handleUpgrade = () => {
    onOpenChange(false);
    router.push(`${ROUTES.ADMIN_SUBSCRIPTION}?action=upgrade`);
  };

  const handleViewPlans = () => {
    onOpenChange(false);
    router.push(ROUTES.ADMIN_SUBSCRIPTION);
  };

  const currentTier = subscription?.plan.planType || PlanTier.BASIC;

  // Default benefits based on feature
  const getDefaultBenefits = () => {
    if (benefits.length > 0) return benefits;

    switch (featureName.toLowerCase()) {
      case 'notas clínicas':
      case 'clinical notes':
        return [
          'Registrar sesiones de forma segura',
          'Acceso restringido por RBAC',
          'Historial completo del tratamiento',
          'Cumplimiento de normativas HIPAA',
        ];
      case 'actividades':
      case 'tasks':
        return [
          'Asignar actividades a profesionales',
          'Fechas límite y recordatorios',
          'Seguimiento de progreso',
          'Priorización de pendientes',
        ];
      case 'archivos adjuntos':
      case 'attachments':
        return [
          'Adjuntar documentos a pacientes',
          'Pruebas y evaluaciones',
          'Informes y certificados',
          'Hasta 25 MB por archivo',
        ];
      default:
        return [
          'Herramientas profesionales avanzadas',
          'Mejora la eficiencia del equipo',
          'Cumplimiento de estándares',
          'Soporte prioritario',
        ];
    }
  };

  const displayBenefits = getDefaultBenefits();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>Función PRO: {featureName}</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-4">
            {featureDescription ? (
              <p>{featureDescription}</p>
            ) : (
              <p>
                {featureName} está disponible en nuestro plan PRO.
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-blue-900">
                Con {featureName} puedes:
              </h4>
              <ul className="space-y-2">
                {displayBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {currentTier === PlanTier.BASIC && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Plan PRO también incluye:
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Hasta 15 profesionales</li>
                    <li>• 500 pacientes</li>
                    <li>• 50 GB de almacenamiento</li>
                    <li>• Notificaciones web push</li>
                    <li>• Analíticas avanzadas</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-600">
                  Desde <strong className="text-gray-900">€79/mes</strong>
                </p>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Más Tarde
          </Button>

          {!canManage && (
            <p className="text-sm text-muted-foreground">Contacta al titular de la cuenta.</p>
          )}

          {canManage && (
            <Button variant="secondary" onClick={handleViewPlans}>
              Ver Planes
            </Button>
          )}

          {canManage && currentTier === PlanTier.BASIC && (
            <Button onClick={handleUpgrade} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Actualizar Ahora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
