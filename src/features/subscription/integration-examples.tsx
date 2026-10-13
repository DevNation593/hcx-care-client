'use client';

/**
 * INTEGRATION EXAMPLES
 * 
 * This file demonstrates how to integrate subscription limits into your components.
 * Copy these patterns into your actual feature components.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, FileUp, Users } from 'lucide-react';
import { useCanInviteUser, useCanCreatePatient, useCanUploadFile, useFeatureGate, useLimitChecks } from '@/hooks/useLimits';
import { SeatLimitModal } from '@/features/subscription/seat-limit-modal';
import { PatientLimitModal } from '@/features/subscription/patient-limit-modal';
import { StorageLimitModal } from '@/features/subscription/storage-limit-modal';
import { FeatureLockedModal } from '@/features/subscription/feature-locked-modal';

/**
 * Example 1: Invite User Button with Seat Limit Check
 * 
 * Use this pattern in your team/users page when inviting new psychologists
 */
export function InviteUserButton() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { 
    canInvite, 
    remaining, 
    checkAndProceed, 
    showSeatLimitModal, 
    setShowSeatLimitModal 
  } = useCanInviteUser();

  const handleClick = () => {
    checkAndProceed(() => {
      // Open your invite user dialog/form
      setShowInviteDialog(true);
    });
  };

  return (
    <>
      <Button onClick={handleClick} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Invitar Profesional
        {canInvite && remaining <= 3 && (
          <span className="ml-1 text-xs opacity-70">({remaining} restantes)</span>
        )}
      </Button>

      {/* Your actual invite dialog would go here */}
      {showInviteDialog && (
        <div>Tu diálogo de invitación...</div>
      )}

      {/* Seat limit modal - shown automatically when limit reached */}
      <SeatLimitModal 
        open={showSeatLimitModal} 
        onOpenChange={setShowSeatLimitModal}
      />
    </>
  );
}

/**
 * Example 2: Create Patient Button with Patient Limit Check
 * 
 * Use this pattern in your patients page when creating new patient records
 */
export function CreatePatientButton() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { 
    canCreate, 
    remaining, 
    checkAndProceed, 
    showPatientLimitModal, 
    setShowPatientLimitModal 
  } = useCanCreatePatient();

  const handleClick = () => {
    checkAndProceed(() => {
      // Open your create patient dialog/form
      setShowCreateDialog(true);
    });
  };

  return (
    <>
      <Button onClick={handleClick} className="gap-2">
        <Users className="h-4 w-4" />
        Nuevo Paciente
        {canCreate && remaining <= 10 && (
          <span className="ml-1 text-xs opacity-70">({remaining} restantes)</span>
        )}
      </Button>

      {/* Your actual create patient dialog would go here */}
      {showCreateDialog && (
        <div>Tu diálogo de crear paciente...</div>
      )}

      {/* Patient limit modal - shown automatically when limit reached */}
      <PatientLimitModal 
        open={showPatientLimitModal} 
        onOpenChange={setShowPatientLimitModal}
      />
    </>
  );
}

/**
 * Example 3: File Upload with Storage Limit Check
 * 
 * Use this pattern in file upload components (avatar upload, document attachments, etc.)
 */
export function FileUploadButton() {
  const { 
    checkAndProceed, 
    remainingGB, 
    showStorageLimitModal, 
    setShowStorageLimitModal,
    rejectedFile,
  } = useCanUploadFile();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    checkAndProceed(file, () => {
      // Proceed with file upload
      uploadFile(file);
    });
  };

  const uploadFile = async (file: File) => {
    // Your actual upload logic here
    console.log('Uploading file:', file.name);
  };

  return (
    <>
      <Button asChild className="gap-2">
        <label htmlFor="file-upload" className="cursor-pointer">
          <FileUp className="h-4 w-4" />
          Subir Archivo
          <span className="ml-1 text-xs opacity-70">
            ({remainingGB.toFixed(1)} GB disponibles)
          </span>
        </label>
      </Button>

      <input
        id="file-upload"
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Storage limit modal - shown automatically when limit reached */}
      <StorageLimitModal 
        open={showStorageLimitModal} 
        onOpenChange={setShowStorageLimitModal}
        fileName={rejectedFile?.name}
        fileSize={rejectedFile?.size}
      />
    </>
  );
}

/**
 * Example 4: Feature-Gated Button (e.g., Clinical Notes)
 * 
 * Use this pattern for features that are only available in certain plans
 */
export function ClinicalNotesButton() {
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const { 
    isAvailable, 
    checkAndProceed, 
    showFeatureLockedModal, 
    setShowFeatureLockedModal 
  } = useFeatureGate('clinicalNotes');

  const handleClick = () => {
    checkAndProceed(() => {
      // Open clinical notes interface
      setShowNotesDialog(true);
    });
  };

  return (
    <>
      <Button onClick={handleClick} className="gap-2">
        Notas Clínicas
        {!isAvailable && (
          <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            PRO
          </span>
        )}
      </Button>

      {/* Your actual clinical notes interface would go here */}
      {showNotesDialog && (
        <div>Tu interfaz de notas clínicas...</div>
      )}

      {/* Feature locked modal - shown automatically for BASIC users */}
      <FeatureLockedModal 
        open={showFeatureLockedModal} 
        onOpenChange={setShowFeatureLockedModal}
        featureName="Notas Clínicas"
        featureDescription="Las notas clínicas te permiten documentar sesiones de forma segura y cumplir con normativas HIPAA."
        benefits={[
          'Registro seguro de sesiones',
          'Control de acceso por rol',
          'Historial completo del paciente',
          'Cumplimiento normativo',
        ]}
      />
    </>
  );
}

/**
 * Example 5: Multiple Limit Checks in a Single Component
 * 
 * Use this pattern when you have a component that needs to check multiple limits
 */
export function PatientProfileActions() {
  const limits = useLimitChecks();

  return (
    <div className="flex gap-2">
      {/* Upload attachment */}
      <Button 
        variant="outline"
        onClick={() => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              limits.upload.checkAndProceed(file, () => {
                console.log('Upload file:', file.name);
              });
            }
          };
          fileInput.click();
        }}
      >
        <FileUp className="h-4 w-4 mr-2" />
        Adjuntar
      </Button>

      {/* All modals */}
      <StorageLimitModal 
        open={limits.upload.showStorageLimitModal} 
        onOpenChange={limits.upload.setShowStorageLimitModal}
        fileName={limits.upload.rejectedFile?.name}
        fileSize={limits.upload.rejectedFile?.size}
      />
    </div>
  );
}
