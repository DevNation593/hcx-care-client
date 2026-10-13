'use client';

import { SectionGate } from '@/components/layout/section-gate';
import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usePatient, useUpdatePatient, useDeletePatient } from '@/hooks/usePatients';
import { usePatientClinicalNotes, useCreateClinicalNote, useDeleteClinicalNote } from '@/hooks/useClinicalNotes';
import { useAppointments } from '@/hooks/useAppointments';
import { useTasks, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { usePatientSessionPlan, useCreateSessionPlan, useUpdateSessionPlan } from '@/hooks/useSessionPlans';
import { useSections } from '@/hooks/useSections';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { ClinicalRecordsTab } from '@/features/patients/clinical-records-tab';
import { PatientClinicalAlerts } from '@/features/patients/patient-clinical-alerts';
import { PatientFilesTab } from '@/features/patients/patient-files-tab';
import { usePatientEncounters } from '@/hooks/useEncounters';
import { describeIdentification } from '@/features/patients/patient-identity';
import { PatientTeamTab } from '@/features/patients/patient-team-tab';
import { canAccessClinicalNotes, canDeletePatient, isMasterRole, isProfessionalRole } from '@/types/guards';
import { PatientInvoicesTab } from '@/features/billing/patient-invoices-tab';
import { FeatureLockedNotice, isFeatureLockedError } from '@/features/subscription/feature-locked-notice';
import { formatDate, formatRelativeDate, getInitials, cn } from '@/lib/utils';
import {
  AppointmentStatus,
  TaskStatus,
  TaskPriority,
  type Appointment,
  type ClinicalNote,
  type SectionKey,
  type Task,
} from '@/types';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  ClipboardList,
  Paperclip,
  FileText,
  Target,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Users,
  Receipt,
} from 'lucide-react';

// ==========================================
// TAB TYPES
// ==========================================
type TabId = 'overview' | 'team' | 'clinical' | 'specialties' | 'files' | 'appointments' | 'tasks' | 'session-plan' | 'billing';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'General', icon: UserIcon },
  { id: 'team', label: 'Equipo tratante', icon: Users },
  { id: 'clinical', label: 'Historia Clínica', icon: FileText },
  { id: 'specialties', label: 'Registros clínicos', icon: ClipboardList },
  { id: 'files', label: 'Archivos', icon: Paperclip },
  { id: 'appointments', label: 'Citas', icon: Calendar },
  { id: 'tasks', label: 'Actividades', icon: ClipboardList },
  { id: 'billing', label: 'Facturas', icon: Receipt },
  { id: 'session-plan', label: 'Plan de Sesión', icon: Target },
];

// Tabs backed by an optional section; the rest belong to the patient record itself.
const TAB_SECTIONS: Partial<Record<TabId, SectionKey>> = {
  clinical: 'core.clinicalNotes',
  'session-plan': 'core.clinicalNotes',
  specialties: 'core.specialties',
  files: 'core.storage',
  appointments: 'core.calendar',
  tasks: 'core.tasks',
  billing: 'core.billing',
};

// ==========================================
// MAIN PAGE
// ==========================================
function PatientDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const user = useAuthStore((state) => state.user);
  const { isEnabled } = useSections();

  const searchParams = useSearchParams();
  // The agenda links here to attend an appointment: ?tab=specialties&appointmentId=…
  const requestedTab = searchParams.get('tab');
  const startAppointmentId = searchParams.get('appointmentId') ?? undefined;
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((tab) => tab.id === requestedTab) ? (requestedTab as TabId) : 'overview',
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: patient, isLoading } = usePatient(patientId);
  const deletePatient = useDeletePatient();
  // Invoices are shown to the roles that can issue them, and to whoever was given the permission.
  const { can } = useMyPermissions();
  const canSeeInvoices =
    !!user && can('billing.view', isMasterRole(user.role) || isProfessionalRole(user.role));
  // Specialty records are clinical content: the API refuses them without an active professional profile.
  const canSeeClinical = !!user && canAccessClinicalNotes(user) && can('clinical_records.view');
  const visibleTabs = TABS.filter(
    (tab) =>
      (tab.id !== 'billing' || canSeeInvoices) &&
      (tab.id !== 'specialties' || canSeeClinical) &&
      (tab.id !== 'files' || canSeeClinical) &&
      (TAB_SECTIONS[tab.id] === undefined || isEnabled(TAB_SECTIONS[tab.id]!)),
  );

  const handleDelete = () => {
    deletePatient.mutate(patientId, {
      onSuccess: () => {
        router.push('/patients');
      },
    });
  };

  if (isLoading) {
    return <PatientDetailSkeleton />;
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground text-lg">Paciente no encontrado</p>
        <Button variant="outline" onClick={() => router.push('/patients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a pacientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/patients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar
            fallback={getInitials(patient.firstName, patient.lastName)}
            className="h-12 w-12 text-lg"
          />
          <div>
            <h1 className="text-2xl font-bold">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Paciente desde {formatDate(patient.createdAt, 'MMMM yyyy')}
            </p>
          </div>
          <Badge variant={patient.isActive ? 'default' : 'secondary'}>
            {patient.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/patients/${patientId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          {user && canDeletePatient(user) && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {canSeeClinical && isEnabled('core.specialties') && (
        <PatientClinicalAlerts patientId={patientId} />
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-4" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            // Hide clinical tabs for users without access
            if (tab.id === 'clinical' && user && !canAccessClinicalNotes(user)) {
              return null;
            }
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab patient={patient} />}
        {activeTab === 'team' && <PatientTeamTab patientId={patientId} />}
        {activeTab === 'clinical' && <ClinicalHistoryTab patientId={patientId} />}
        {activeTab === 'specialties' && canSeeClinical && (
          <ClinicalRecordsTab patientId={patientId} startAppointmentId={startAppointmentId} />
        )}
        {activeTab === 'files' && canSeeClinical && <PatientFilesTab patientId={patientId} />}
        {activeTab === 'appointments' && <AppointmentsTab patientId={patientId} />}
        {activeTab === 'tasks' && <TasksTab patientId={patientId} />}
        {activeTab === 'billing' && canSeeInvoices && <PatientInvoicesTab patientId={patientId} />}
        {activeTab === 'session-plan' && <SessionPlanTab patientId={patientId} />}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el paciente{' '}
              <strong>
                {patient.firstName} {patient.lastName}
              </strong>{' '}
              y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// OVERVIEW TAB
// ==========================================
function OverviewTab({ patient }: { patient: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow label="Nombre completo" value={`${patient.firstName} ${patient.lastName}`} />
          <InfoRow
            label="Identificación"
            value={describeIdentification(patient.identificationType, patient.identificationNumber) || '—'}
          />
          <InfoRow
            label="Fecha de nacimiento"
            value={patient.dateOfBirth ? formatDate(patient.dateOfBirth, 'PPP') : '—'}
          />
          <InfoRow
            label="Género"
            value={
              patient.gender
                ? ({ MALE: 'Masculino', FEMALE: 'Femenino', NON_BINARY: 'No binario', PREFER_NOT_TO_SAY: 'Prefiere no decir' } as Record<string, string>)[patient.gender] || patient.gender
                : '—'
            }
          />
          <InfoRow label="Dirección" value={patient.address || '—'} />
          {patient.maritalStatus && <InfoRow label="Estado civil" value={patient.maritalStatus} />}
          {patient.occupation && <InfoRow label="Ocupación" value={patient.occupation} />}
          {patient.nationality && <InfoRow label="Nacionalidad" value={patient.nationality} />}
          {patient.bloodType && <InfoRow label="Grupo sanguíneo" value={patient.bloodType} />}
          {patient.disability && <InfoRow label="Discapacidad" value={patient.disability} />}
          {patient.insuranceProvider && (
            <InfoRow
              label="Seguro o convenio"
              value={[patient.insuranceProvider, patient.insurancePolicyNumber].filter(Boolean).join(' · ')}
            />
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={patient.email || '—'} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Teléfono" value={patient.phone || '—'} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Dirección" value={patient.address || '—'} />
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Contacto de Emergencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow label="Nombre" value={patient.emergencyContactName || '—'} />
          <InfoRow label="Teléfono" value={patient.emergencyContactPhone || '—'} />
        </CardContent>
      </Card>

      {/* Legal guardian */}
      {patient.guardianName && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Representante legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              label="Nombre"
              value={[patient.guardianName, patient.guardianRelationship].filter(Boolean).join(' · ')}
            />
            <InfoRow label="Identificación" value={patient.guardianIdentification || '—'} />
            <InfoRow label="Teléfono" value={patient.guardianPhone || '—'} />
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {patient.notes && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Citas Totales"
              value={patient.appointmentsCount ?? '—'}
              icon={<Calendar className="h-5 w-5 text-blue-500" />}
            />
            <StatCard
              label="Actividades"
              value={patient.tasksCount ?? '—'}
              icon={<ClipboardList className="h-5 w-5 text-purple-500" />}
            />
            <StatCard
              label="Última Cita"
              value={patient.lastAppointmentDate ? formatDate(patient.lastAppointmentDate, 'dd/MM/yy') : '—'}
              icon={<Clock className="h-5 w-5 text-gray-500" />}
            />
            <StatCard
              label="Próxima Cita"
              value={patient.nextAppointmentDate ? formatDate(patient.nextAppointmentDate, 'dd/MM/yy') : '—'}
              icon={<Calendar className="h-5 w-5 text-green-500" />}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// CLINICAL HISTORY TAB
// ==========================================
function ClinicalHistoryTab({ patientId }: { patientId: string }) {
  const user = useAuthStore((state) => state.user);
  const { data: notes, isLoading, error: notesError } = usePatientClinicalNotes(patientId);
  const createNote = useCreateClinicalNote();
  const deleteNote = useDeleteClinicalNote();
  // A note written during an attention belongs to it.
  const { data: encounters = [] } = usePatientEncounters(patientId);
  const openEncounter = encounters.find(
    (encounter) => encounter.status === 'OPEN' && encounter.professionalId === user?.id,
  );

  const [showNewNote, setShowNewNote] = useState(false);
  const [viewNote, setViewNote] = useState<ClinicalNote | null>(null);
  const [noteForm, setNoteForm] = useState({ diagnosis: '', content: '' });
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const closeDeleteDialog = () => {
    setDeleteNoteId(null);
    setDeleteReason('');
  };

  const handleCreateNote = () => {
    createNote.mutate(
      {
        patientId,
        content: noteForm.content.trim(),
        diagnosis: noteForm.diagnosis.trim() || undefined,
        ...(openEncounter ? { encounterId: openEncounter.id } : {}),
      },
      {
        onSuccess: () => {
          setShowNewNote(false);
          setNoteForm({ diagnosis: '', content: '' });
        },
      }
    );
  };

  const handleDeleteNote = () => {
    if (!deleteNoteId || !deleteReason.trim()) return;
    deleteNote.mutate(
      { noteId: deleteNoteId, patientId, reason: deleteReason.trim() },
      { onSuccess: closeDeleteDialog }
    );
  };

  if (!user || !canAccessClinicalNotes(user)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            Solo las cuentas con un perfil profesional activo pueden ver la historia clínica.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isFeatureLockedError(notesError)) {
    return <FeatureLockedNotice featureName="El módulo de notas clínicas" />;
  }

  // The API accepts new notes only from the PROFESIONAL role.
  const canWriteNotes = isProfessionalRole(user.role);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Notas Clínicas</h3>
        {canWriteNotes && (
          <Button onClick={() => setShowNewNote(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Nota
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{note.diagnosis || 'Nota clínica'}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {note.psychologist
                          ? `Dr. ${note.psychologist.firstName} ${note.psychologist.lastName}`
                          : 'Profesional'}
                      </span>
                      <span>{formatRelativeDate(note.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setViewNote(note)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {note.psychologistId === user.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNoteId(note.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay notas clínicas registradas</p>
            {canWriteNotes && (
              <Button className="mt-4" variant="outline" onClick={() => setShowNewNote(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera nota
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Note Dialog */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Nota Clínica</DialogTitle>
            <DialogDescription>
              Las notas clínicas son confidenciales y solo son visibles para profesionales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-title">Diagnóstico (opcional)</Label>
              <Input
                id="note-title"
                value={noteForm.diagnosis}
                onChange={(e) => setNoteForm({ ...noteForm, diagnosis: e.target.value })}
                placeholder="Ej: Trastorno de ansiedad generalizada"
              />
            </div>
            <div>
              <Label htmlFor="note-content">Contenido</Label>
              <Textarea
                id="note-content"
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Escribe las notas de la sesión..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNote(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={!noteForm.content || createNote.isPending}
              loading={createNote.isPending}
            >
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog open={!!viewNote} onOpenChange={() => setViewNote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewNote?.diagnosis || 'Nota clínica'}
            </DialogTitle>
            <DialogDescription>
              {viewNote?.psychologist
                ? `Dr. ${viewNote.psychologist.firstName} ${viewNote.psychologist.lastName}`
                : 'Profesional'}{' '}
              — {viewNote && formatDate(viewNote.createdAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm py-4">{viewNote?.content}</div>
        </DialogContent>
      </Dialog>

      {/* Delete Note Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota clínica?</AlertDialogTitle>
            <AlertDialogDescription>
              La nota dejará de mostrarse en la historia clínica. Se conserva en el registro de
              auditoría junto con el motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="note-delete-reason">Motivo de la eliminación</Label>
            <Textarea
              id="note-delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ej: Nota registrada en el paciente equivocado"
              maxLength={500}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open until the API confirms.
                e.preventDefault();
                handleDeleteNote();
              }}
              disabled={!deleteReason.trim() || deleteNote.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// APPOINTMENTS TAB
// ==========================================
function AppointmentsTab({ patientId }: { patientId: string }) {
  const { data: appointments, isLoading } = useAppointments({ patientId });

  const upcomingAppointments =
    appointments?.filter(
      (a) => new Date(a.startTime) >= new Date() && a.status !== AppointmentStatus.CANCELLED
    ) || [];

  const pastAppointments =
    appointments?.filter(
      (a) => new Date(a.startTime) < new Date() || a.status === AppointmentStatus.CANCELLED
    ) || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Próximas Citas</h3>
        {upcomingAppointments.length > 0 ? (
          <div className="space-y-2">
            {upcomingAppointments.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay citas próximas programadas</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Past */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Historial de Citas</h3>
        {pastAppointments.length > 0 ? (
          <div className="space-y-2">
            {pastAppointments.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No hay citas pasadas</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ==========================================
// TASKS TAB
// ==========================================
function TasksTab({ patientId }: { patientId: string }) {
  const user = useAuthStore((state) => state.user);
  const { data: tasks, isLoading, error: tasksError } = useTasks({ patientId });
  const createTask = useCreateTask();

  const [showNewTask, setShowNewTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: TaskPriority.MEDIUM as TaskPriority,
    dueDate: '',
  });

  const activeTasks = tasks?.filter((t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED) || [];
  const completedTasks = tasks?.filter((t) => t.status === TaskStatus.COMPLETED) || [];

  const handleCreateTask = () => {
    createTask.mutate(
      {
        ...taskForm,
        patientId,
        assignedToId: user?.id || '',
      },
      {
        onSuccess: () => {
          setShowNewTask(false);
          setTaskForm({ title: '', description: '', priority: TaskPriority.MEDIUM, dueDate: '' });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isFeatureLockedError(tasksError)) {
    return <FeatureLockedNotice featureName="El módulo de actividades" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Actividades del Paciente</h3>
        <Button onClick={() => setShowNewTask(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Actividad
        </Button>
      </div>

      {/* Active Tasks */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Activas ({activeTasks.length})
        </h4>
        {activeTasks.length > 0 ? (
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No hay actividades activas</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Completadas ({completedTasks.length})
          </h4>
          <div className="space-y-2 opacity-60">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
            <DialogDescription>Crear una nueva actividad asociada a este paciente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Ej: Preparar informe de evaluación"
              />
            </div>
            <div>
              <Label htmlFor="task-desc">Descripción</Label>
              <Textarea
                id="task-desc"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Detalles de la actividad..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-priority">Prioridad</Label>
                <select
                  id="task-priority"
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  aria-label="Prioridad de la actividad"
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task-due">Fecha límite</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskForm.title || createTask.isPending}
              loading={createTask.isPending}
            >
              Crear Actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// SESSION PLAN TAB
// ==========================================
function SessionPlanTab({ patientId }: { patientId: string }) {
  const { data: sessionPlan, isLoading } = usePatientSessionPlan(patientId);
  const createPlan = useCreateSessionPlan();
  const updatePlan = useUpdateSessionPlan(patientId);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    objectives: [''],
    interventions: [''],
    progress: '',
    nextSteps: '',
    targetDate: '',
  });

  const startEditing = () => {
    if (sessionPlan) {
      const objectiveList = Array.isArray(sessionPlan.objectives)
        ? sessionPlan.objectives
        : sessionPlan.objectives
          ? [sessionPlan.objectives]
          : [''];
      const interventionList =
        sessionPlan.interventions?.length
          ? sessionPlan.interventions
          : sessionPlan.techniques
            ? [sessionPlan.techniques]
            : [''];

      setFormData({
        objectives: objectiveList.length ? objectiveList : [''],
        interventions: interventionList.length ? interventionList : [''],
        progress: sessionPlan.progress || sessionPlan.notes || '',
        nextSteps: sessionPlan.nextSteps || sessionPlan.homework || '',
        targetDate: sessionPlan.targetDate || '',
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    const data = {
      patientId,
      objectives: formData.objectives.filter(Boolean).join('\n'),
      techniques: formData.interventions.filter(Boolean).join('\n'),
      homework: formData.nextSteps.trim() || undefined,
      notes: formData.progress.trim() || undefined,
    };

    if (sessionPlan) {
      updatePlan.mutate(data, { onSuccess: () => setIsEditing(false) });
    } else {
      createPlan.mutate(data, { onSuccess: () => setIsEditing(false) });
    }
  };

  const addListItem = (field: 'objectives' | 'interventions') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const updateListItem = (field: 'objectives' | 'interventions', index: number, value: string) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData({ ...formData, [field]: updated });
  };

  const removeListItem = (field: 'objectives' | 'interventions', index: number) => {
    const updated = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: updated.length ? updated : [''] });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!sessionPlan && !isEditing) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Sin plan de sesión</p>
          <p className="text-sm text-muted-foreground mb-4">
            Crea un plan de sesión para guiar el tratamiento de este paciente.
          </p>
          <Button onClick={startEditing}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Plan de Sesión
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{sessionPlan ? 'Editar' : 'Nuevo'} Plan de Sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Objectives */}
          <div>
            <Label className="text-base font-medium">Objetivos Terapéuticos</Label>
            <div className="space-y-2 mt-2">
              {formData.objectives.map((obj, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={obj}
                    onChange={(e) => updateListItem('objectives', i, e.target.value)}
                    placeholder={`Objetivo ${i + 1}`}
                  />
                  {formData.objectives.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeListItem('objectives', i)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('objectives')}>
                <Plus className="h-3 w-3 mr-1" />
                Agregar Objetivo
              </Button>
            </div>
          </div>

          {/* Interventions */}
          <div>
            <Label className="text-base font-medium">Intervenciones</Label>
            <div className="space-y-2 mt-2">
              {formData.interventions.map((int, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={int}
                    onChange={(e) => updateListItem('interventions', i, e.target.value)}
                    placeholder={`Intervención ${i + 1}`}
                  />
                  {formData.interventions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeListItem('interventions', i)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addListItem('interventions')}>
                <Plus className="h-3 w-3 mr-1" />
                Agregar Intervención
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div>
            <Label htmlFor="sp-progress">Progreso</Label>
            <Textarea
              id="sp-progress"
              value={formData.progress}
              onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
              placeholder="Describe el progreso del paciente..."
              rows={4}
            />
          </div>

          {/* Next Steps */}
          <div>
            <Label htmlFor="sp-next">Próximos Pasos</Label>
            <Textarea
              id="sp-next"
              value={formData.nextSteps}
              onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
              placeholder="Describe los próximos pasos del tratamiento..."
              rows={4}
            />
          </div>

          {/* Target Date */}
          <div>
            <Label htmlFor="sp-target">Fecha Objetivo</Label>
            <Input
              id="sp-target"
              type="date"
              value={formData.targetDate}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createPlan.isPending || updatePlan.isPending}
              loading={createPlan.isPending || updatePlan.isPending}
            >
              Guardar Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View mode
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Plan de Sesión
          </CardTitle>
          <Button variant="outline" onClick={startEditing}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
        {sessionPlan?.targetDate && (
          <CardDescription>
            Fecha objetivo: {formatDate(sessionPlan.targetDate, 'PPP')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Objectives */}
        <div>
          <h4 className="font-medium mb-2">Objetivos Terapéuticos</h4>
          <ul className="space-y-1">
            {(Array.isArray(sessionPlan?.objectives)
              ? sessionPlan?.objectives
              : sessionPlan?.objectives
                ? [sessionPlan?.objectives]
                : []
            ).map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {obj}
              </li>
            ))}
          </ul>
        </div>

        {/* Interventions */}
        <div>
          <h4 className="font-medium mb-2">Intervenciones</h4>
          <ul className="space-y-1">
            {(sessionPlan?.interventions?.length
              ? sessionPlan.interventions
              : sessionPlan?.techniques
                ? sessionPlan.techniques.split('\n').filter(Boolean)
                : []
            ).map((int, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                {int}
              </li>
            ))}
          </ul>
        </div>

        {/* Progress */}
        <div>
          <h4 className="font-medium mb-2">Progreso</h4>
          <p className="text-sm whitespace-pre-wrap">{sessionPlan?.progress || sessionPlan?.notes}</p>
        </div>

        {/* Next Steps */}
        <div>
          <h4 className="font-medium mb-2">Próximos Pasos</h4>
          <p className="text-sm whitespace-pre-wrap">{sessionPlan?.nextSteps || sessionPlan?.homework}</p>
        </div>

        {/* Metadata */}
        <div className="flex gap-4 text-xs text-muted-foreground pt-4 border-t">
          {sessionPlan?.createdAt && <span>Creado: {formatDate(sessionPlan.createdAt)}</span>}
          {sessionPlan?.updatedAt && <span>Actualizado: {formatDate(sessionPlan.updatedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      {icon}
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-center min-w-[50px]">
              <p className="text-xs text-muted-foreground">
                {formatDate(appointment.startTime, 'MMM')}
              </p>
              <p className="text-lg font-bold">{formatDate(appointment.startTime, 'dd')}</p>
            </div>
            <div>
              <p className="font-medium text-sm">{appointment.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(appointment.startTime, 'HH:mm')} -{' '}
                {formatDate(appointment.endTime, 'HH:mm')}
              </p>
              {appointment.professional && (
                <p className="text-xs text-muted-foreground">
                  {appointment.professional.professionalTitle
                    ? `${appointment.professional.professionalTitle} `
                    : ''}
                  {appointment.professional.firstName} {appointment.professional.lastName}
                </p>
              )}
              {appointment.specialty && (
                <p className="text-xs text-muted-foreground">{appointment.specialty.name}</p>
              )}
            </div>
          </div>
          <Badge
            className={
              APPOINTMENT_STATUS_COLORS[appointment.status as AppointmentStatus] || ''
            }
          >
            {APPOINTMENT_STATUS_LABELS[appointment.status as AppointmentStatus] ||
              appointment.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { task: Task }) {
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;

  return (
    <Card className={cn(isOverdue && 'border-destructive/50')}>
      <CardContent className="py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {task.status === TaskStatus.COMPLETED ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : isOverdue ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p
                className={cn(
                  'font-medium text-sm',
                  task.status === TaskStatus.COMPLETED && 'line-through text-muted-foreground'
                )}
              >
                {task.title}
              </p>
              {task.dueDate && (
                <p className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                  {isOverdue ? 'Vencida: ' : 'Vence: '}
                  {formatDate(task.dueDate, 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={TASK_PRIORITY_COLORS[task.priority] || ''}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </Badge>
            <Badge variant="secondary">
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  return (
    <SectionGate section="core.patients">
      <PatientDetailPageContent />
    </SectionGate>
  );
}
