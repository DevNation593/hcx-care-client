'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBillingProfiles, usePatientBillingProfiles } from '@/hooks/useBillingProfiles';
import { cn } from '@/lib/utils';
import { SRI_ID_TYPE_LABELS, type BillingProfile, type BillingProfileKind } from '@/types/cash';
import { BillingProfileForm } from './billing-profile-form';

type PickerTab = 'patient' | 'person' | 'company';

interface PickerPatient {
  id: string;
  name: string;
}

interface BillingProfilePickerProps {
  /** Patients whose linked profiles are offered first (the patients of an order). */
  patients?: PickerPatient[];
  selectedId?: string | null;
  onSelect: (profile: BillingProfile) => void;
  disabled?: boolean;
}

function ProfileRow({
  profile,
  selected,
  disabled,
  onSelect,
}: {
  profile: BillingProfile;
  selected: boolean;
  disabled?: boolean;
  onSelect: (profile: BillingProfile) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{profile.legalName}</p>
        <p className="text-muted-foreground">
          {SRI_ID_TYPE_LABELS[profile.idType]} {profile.idNumber}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={selected ? 'secondary' : 'outline'}
        disabled={disabled || selected}
        aria-label={`${selected ? 'Elegido' : 'Elegir'} ${profile.legalName}`}
        onClick={() => onSelect(profile)}
      >
        {selected ? 'Elegido' : 'Elegir'}
      </Button>
    </li>
  );
}

function PatientProfiles({
  patient,
  selectedId,
  disabled,
  onSelect,
}: {
  patient: PickerPatient;
  selectedId?: string | null;
  disabled?: boolean;
  onSelect: (profile: BillingProfile) => void;
}) {
  const { data, isPending } = usePatientBillingProfiles(patient.id);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{patient.name}</p>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos de facturación vinculados.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              selected={profile.id === selectedId}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileSearch({
  kind,
  selectedId,
  disabled,
  onSelect,
}: {
  kind: BillingProfileKind;
  selectedId?: string | null;
  disabled?: boolean;
  onSelect: (profile: BillingProfile) => void;
}) {
  const [q, setQ] = useState('');
  const { data, isPending } = useBillingProfiles(q, true);
  const items = (data?.items ?? []).filter((profile) => profile.kind === kind);
  return (
    <div className="space-y-2">
      <Input
        aria-label="Buscar receptor"
        placeholder="Nombre o identificación"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay receptores.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              selected={profile.id === selectedId}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Chooses who receives the invoice: a linked profile of a patient, another person, or a company. */
export function BillingProfilePicker({
  patients = [],
  selectedId,
  onSelect,
  disabled,
}: BillingProfilePickerProps) {
  const hasPatients = patients.length > 0;
  const [tab, setTab] = useState<PickerTab>(hasPatients ? 'patient' : 'person');
  const [creating, setCreating] = useState(false);
  const activeTab: PickerTab = tab === 'patient' && !hasPatients ? 'person' : tab;

  const tabs: { id: PickerTab; label: string }[] = [
    ...(hasPatients ? [{ id: 'patient' as const, label: 'Paciente' }] : []),
    { id: 'person', label: 'Otro particular' },
    { id: 'company', label: 'Empresa' },
  ];

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Quién paga" className="inline-flex rounded-lg border bg-muted p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-md px-3 py-1 text-sm',
              activeTab === item.id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        {activeTab === 'patient' &&
          patients.map((patient) => (
            <PatientProfiles
              key={patient.id}
              patient={patient}
              selectedId={selectedId}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        {activeTab === 'person' && (
          <ProfileSearch kind="PERSON" selectedId={selectedId} disabled={disabled} onSelect={onSelect} />
        )}
        {activeTab === 'company' && (
          <ProfileSearch kind="COMPANY" selectedId={selectedId} disabled={disabled} onSelect={onSelect} />
        )}
      </div>
      {creating ? (
        <BillingProfileForm
          linkToPatient={patients.length === 1 ? patients[0] : undefined}
          onCancel={() => setCreating(false)}
          onCreated={(profile) => {
            setCreating(false);
            onSelect(profile);
          }}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setCreating(true)}>
          Nuevo receptor
        </Button>
      )}
    </div>
  );
}
