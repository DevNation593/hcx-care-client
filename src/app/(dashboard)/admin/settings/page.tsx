'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { canManageUsers } from '@/types/guards';
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/useTenantSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Clock,
  Globe,
  Bell,
  FileText,
  Save,
  RotateCcw,
} from 'lucide-react';
import { type WorkingHours, type ReminderRule, type TenantSettings } from '@/types';
import { BranchesManager } from '@/features/admin/branches/branches-manager';

const DAYS_MAP: { key: keyof WorkingHours; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-4)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
];

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
  saturday: { enabled: false, startTime: '09:00', endTime: '14:00' },
  sunday: { enabled: false, startTime: '09:00', endTime: '14:00' },
};

const DEFAULT_REMINDERS: ReminderRule[] = [
  { id: '1', type: 'EMAIL', minutesBefore: 1440, enabled: true },
  { id: '2', type: 'PUSH', minutesBefore: 60, enabled: true },
  { id: '3', type: 'SMS', minutesBefore: 120, enabled: false },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const { data: settings, isLoading } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    settings?.workingHours || DEFAULT_WORKING_HOURS
  );
  const [sessionDuration, setSessionDuration] = useState(
    settings?.defaultSessionDuration || 60
  );
  const [timezone, setTimezone] = useState(settings?.timezone || 'America/Mexico_City');
  const [locale, setLocale] = useState(settings?.locale || 'es');
  const [reminders, setReminders] = useState<ReminderRule[]>(
    settings?.reminderRules || DEFAULT_REMINDERS
  );
  const [legalName, setLegalName] = useState(settings?.legalName || '');
  const [taxIdentificationType, setTaxIdentificationType] = useState(
    settings?.taxIdentificationType || 'RUC'
  );
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState(
    settings?.taxIdentificationNumber || ''
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings || initialized) {
      return;
    }

    setWorkingHours(settings.workingHours || DEFAULT_WORKING_HOURS);
    setSessionDuration(settings.defaultSessionDuration || 60);
    setTimezone(settings.timezone || 'America/Mexico_City');
    setLocale(settings.locale || 'es');
    setReminders(settings.reminderRules || DEFAULT_REMINDERS);
    setLegalName(settings.legalName || '');
    setTaxIdentificationType(settings.taxIdentificationType || 'RUC');
    setTaxIdentificationNumber(settings.taxIdentificationNumber || '');
    setInitialized(true);
  }, [initialized, settings]);

  // Redirect non-admin users
  if (user && !canManageUsers(user)) {
    router.replace('/dashboard');
    return null;
  }

  const markChanged = () => setHasChanges(true);

  const handleDayToggle = (day: keyof WorkingHours) => {
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day], enabled: !workingHours[day].enabled },
    });
    markChanged();
  };

  const handleTimeChange = (day: keyof WorkingHours, field: 'startTime' | 'endTime', value: string) => {
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day], [field]: value },
    });
    markChanged();
  };

  const handleReminderToggle = (index: number) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setReminders(updated);
    markChanged();
  };

  const handleReminderMinutes = (index: number, minutes: number) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], minutesBefore: minutes };
    setReminders(updated);
    markChanged();
  };

  const handleSave = () => {
    updateSettings.mutate(
      {
        workingHours,
        defaultSessionDuration: sessionDuration,
        timezone,
        locale,
        reminderRules: reminders,
        legalName,
        taxIdentificationType,
        taxIdentificationNumber,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleReset = () => {
    if (settings) {
      setWorkingHours(settings.workingHours || DEFAULT_WORKING_HOURS);
      setSessionDuration(settings.defaultSessionDuration || 60);
      setTimezone(settings.timezone || 'America/Mexico_City');
      setLocale(settings.locale || 'es');
      setReminders(settings.reminderRules || DEFAULT_REMINDERS);
      setLegalName(settings.legalName || '');
      setTaxIdentificationType(settings.taxIdentificationType || 'RUC');
      setTaxIdentificationNumber(settings.taxIdentificationNumber || '');
    }
    setHasChanges(false);
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)} día(s)`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)} hora(s)`;
    return `${minutes} minutos`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuración
          </h1>
          <p className="text-muted-foreground">
            Configura los ajustes de {tenant?.name || 'tu clínica'}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Descartar
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
            loading={updateSettings.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horario de Atención
          </CardTitle>
          <CardDescription>
            Define los horarios de trabajo de tu clínica. Las citas solo se podrán programar dentro de estos horarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS_MAP.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-28">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workingHours[key].enabled}
                      onChange={() => handleDayToggle(key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                </div>
                {workingHours[key].enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={workingHours[key].startTime}
                      onChange={(e) => handleTimeChange(key, 'startTime', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={workingHours[key].endTime}
                      onChange={(e) => handleTimeChange(key, 'endTime', e.target.value)}
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Cerrado</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Duración de Sesión
          </CardTitle>
          <CardDescription>
            Define la duración predeterminada de las sesiones de terapia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Label htmlFor="session-duration">Duración (minutos)</Label>
              <Input
                id="session-duration"
                type="number"
                min={15}
                max={240}
                step={5}
                value={sessionDuration}
                onChange={(e) => {
                  setSessionDuration(Number(e.target.value));
                  markChanged();
                }}
              />
            </div>
            <div className="flex gap-2 mt-5">
              {[30, 45, 50, 60, 90].map((mins) => (
                <Button
                  key={mins}
                  variant={sessionDuration === mins ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSessionDuration(mins);
                    markChanged();
                  }}
                >
                  {mins} min
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recordatorios de Citas
          </CardTitle>
          <CardDescription>
            Configura cuándo y cómo se envían los recordatorios a los pacientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reminders.map((reminder, index) => (
              <div key={reminder.id} className="flex items-center gap-4 p-3 rounded-lg border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminder.enabled}
                    onChange={() => handleReminderToggle(index)}
                    className="rounded border-gray-300"
                    aria-label={`Activar recordatorio ${reminder.type}`}
                  />
                </label>
                <Badge
                  variant={
                    reminder.type === 'EMAIL'
                      ? 'default'
                      : reminder.type === 'PUSH'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {reminder.type === 'EMAIL' ? '✉️ Email' : reminder.type === 'PUSH' ? '🔔 Push' : '📱 SMS'}
                </Badge>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-muted-foreground">Enviar</span>
                  <select
                    value={reminder.minutesBefore}
                    onChange={(e) => handleReminderMinutes(index, Number(e.target.value))}
                    disabled={!reminder.enabled}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    aria-label="Tiempo antes del recordatorio"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={120}>2 horas</option>
                    <option value={1440}>1 día</option>
                    <option value={2880}>2 días</option>
                  </select>
                  <span className="text-sm text-muted-foreground">antes</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatMinutes(reminder.minutesBefore)} antes
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Facturación electrónica
          </CardTitle>
          <CardDescription>
            Datos del emisor de los comprobantes electrónicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="legal-name">Razón social</Label>
              <Input
                id="legal-name"
                value={legalName}
                placeholder="Clínica Integral S.A."
                onChange={(e) => {
                  setLegalName(e.target.value);
                  markChanged();
                }}
              />
            </div>
            <div>
              <Label htmlFor="tax-identification-type">Tipo de identificación</Label>
              <select
                id="tax-identification-type"
                value={taxIdentificationType}
                onChange={(e) => {
                  setTaxIdentificationType(e.target.value);
                  markChanged();
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              >
                <option value="RUC">RUC</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASSPORT">Pasaporte</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="tax-identification-number">Número de identificación</Label>
              <Input
                id="tax-identification-number"
                value={taxIdentificationNumber}
                placeholder="1790012345001"
                onChange={(e) => {
                  setTaxIdentificationNumber(e.target.value);
                  markChanged();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone & Locale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Zona Horaria e Idioma
          </CardTitle>
          <CardDescription>
            Configuración regional de tu clínica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="timezone">Zona Horaria</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  markChanged();
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                aria-label="Zona horaria"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="locale">Idioma</Label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => {
                  setLocale(e.target.value);
                  markChanged();
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                aria-label="Idioma"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <BranchesManager />
    </div>
  );
}
