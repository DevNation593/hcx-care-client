'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateBillingProfile, useLinkBillingProfile } from '@/hooks/useBillingProfiles';
import {
  SRI_ID_TYPE_LABELS,
  type BillingProfile,
  type BillingProfileInput,
  type BillingProfileKind,
  type SriIdType,
} from '@/types/cash';
import { normalizeIdNumber, taxIdentificationError } from './tax-identification';

interface BillingProfileFormProps {
  /** Called with the profile the server created (and linked, when asked to). */
  onCreated: (profile: BillingProfile) => void;
  onCancel: () => void;
  /** When given, offers to link the new profile to this patient. */
  linkToPatient?: { id: string; name: string };
}

const SELECT_CLASS = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a billing profile (who receives an invoice). Checks the identification before sending. */
export function BillingProfileForm({ onCreated, onCancel, linkToPatient }: BillingProfileFormProps) {
  const create = useCreateBillingProfile();
  const link = useLinkBillingProfile(linkToPatient?.id ?? '');
  const [kind, setKind] = useState<BillingProfileKind>('PERSON');
  const [idType, setIdType] = useState<SriIdType>('05');
  const [idNumber, setIdNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [linkIt, setLinkIt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeIdNumber(idType, idNumber);
    const name = legalName.trim();
    const problem =
      taxIdentificationError(idType, normalized, name) ??
      (name === '' ? 'Escribe el nombre o la razón social' : null) ??
      (idType !== '07' && !EMAIL.test(email.trim()) ? 'Escribe un correo válido' : null);
    if (problem) {
      setError(problem);
      return;
    }

    const data: BillingProfileInput = {
      kind,
      idType,
      idNumber: normalized,
      legalName: name,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };

    setError(null);
    setSaving(true);
    try {
      const profile = await create.mutateAsync(data);
      if (linkToPatient && linkIt) {
        try {
          await link.mutateAsync({ billingProfileId: profile.id });
        } catch {
          // The profile exists already; the hook showed why the link failed.
        }
      }
      onCreated(profile);
    } catch (err) {
      // The server's 409 / 422 message is shown as it comes; the form keeps what was typed.
      setError((err as { message?: string })?.message ?? 'No se pudo guardar el receptor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bp-kind">Tipo de receptor</Label>
          <select
            id="bp-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as BillingProfileKind)}
            className={SELECT_CLASS}
          >
            <option value="PERSON">Persona</option>
            <option value="COMPANY">Empresa</option>
          </select>
        </div>
        <div>
          <Label htmlFor="bp-id-type">Tipo de identificación</Label>
          <select
            id="bp-id-type"
            value={idType}
            onChange={(event) => setIdType(event.target.value as SriIdType)}
            className={SELECT_CLASS}
          >
            {(Object.keys(SRI_ID_TYPE_LABELS) as SriIdType[]).map((type) => (
              <option key={type} value={type}>
                {SRI_ID_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="bp-id-number">
            Identificación<span className="text-destructive"> *</span>
          </Label>
          <Input id="bp-id-number" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="bp-name">
            Nombre o razón social<span className="text-destructive"> *</span>
          </Label>
          <Input id="bp-name" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="bp-email">
            Correo{idType !== '07' && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id="bp-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bp-phone">Teléfono</Label>
          <Input id="bp-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bp-address">Dirección</Label>
          <Input id="bp-address" value={address} onChange={(event) => setAddress(event.target.value)} />
        </div>
      </div>
      {linkToPatient && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={linkIt} onChange={(event) => setLinkIt(event.target.checked)} />
          Vincular a {linkToPatient.name}
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
