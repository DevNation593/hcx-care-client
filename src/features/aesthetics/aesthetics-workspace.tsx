'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMyPermissions } from '@/hooks/usePermissions';
import { aestheticsApi } from '@/lib/api/aesthetics-api';
import { extractArray, usersApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import type { AestheticClient, AestheticPhoto, AestheticService, AestheticSession } from '@/types/aesthetics';

type Area = 'Clientes' | 'Servicios' | 'Agenda' | 'Sesiones' | 'Consentimientos' | 'Fotos';
const areas: Area[] = ['Clientes', 'Servicios', 'Agenda', 'Sesiones', 'Consentimientos', 'Fotos'];
const name = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;
const dateTime = (value: string) => new Date(value).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function Select({ value, onChange, options, placeholder, required = true }: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  required?: boolean;
}) {
  return <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} required={required}>
    <option value="">{placeholder}</option>
    {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
  </select>;
}

export function AestheticsWorkspace() {
  const tenantId = useAuthStore((state) => state.tenant?.id ?? state.user?.tenantId ?? '');
  const user = useAuthStore((state) => state.user);
  const isMaster = user?.role === UserRole.MASTER;
  const { can } = useMyPermissions();
  const queryClient = useQueryClient();
  const [area, setArea] = useState<Area>('Clientes');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', durationMinutes: '60', price: '0', consentText: '' });
  const [bookingForm, setBookingForm] = useState({ clientId: '', serviceId: '', staffId: '', startAt: '' });
  const [sessionForm, setSessionForm] = useState({ bookingId: '', clientId: '', serviceId: '', staffId: '', notes: '' });
  const [consentForm, setConsentForm] = useState({ sessionId: '', signerName: '', expectedConsentText: '', confirmed: false });
  const [photoForm, setPhotoForm] = useState<{ sessionId: string; phase: AestheticPhoto['phase']; file: File | null }>({ sessionId: '', phase: 'BEFORE', file: null });

  const key = ['aesthetics', tenantId];
  const usesClients = area === 'Clientes' || area === 'Agenda' || area === 'Sesiones';
  const usesServices = area === 'Servicios' || area === 'Agenda' || area === 'Sesiones';
  const usesBookings = area === 'Agenda' || area === 'Sesiones';
  const usesSessions = area === 'Sesiones' || area === 'Consentimientos' || area === 'Fotos';
  const usesStaff = area === 'Agenda' || area === 'Sesiones';
  const clients = useQuery({ queryKey: [...key, 'clients'], queryFn: () => aestheticsApi.clients(tenantId), enabled: !!tenantId && usesClients });
  const services = useQuery({ queryKey: [...key, 'services'], queryFn: () => aestheticsApi.services(tenantId), enabled: !!tenantId && usesServices });
  const bookings = useQuery({ queryKey: [...key, 'bookings'], queryFn: () => aestheticsApi.bookings(tenantId), enabled: !!tenantId && usesBookings });
  const sessions = useQuery({ queryKey: [...key, 'sessions'], queryFn: () => aestheticsApi.sessions(tenantId), enabled: !!tenantId && usesSessions });
  const consents = useQuery({ queryKey: [...key, 'consents'], queryFn: () => aestheticsApi.consents(tenantId), enabled: !!tenantId && area === 'Consentimientos' });
  const staff = useQuery({
    queryKey: [...key, 'staff'],
    queryFn: async () => extractArray(await usersApi.list(undefined, tenantId)).filter((member) =>
      member.isActive && [UserRole.MASTER, UserRole.PROFESIONAL].includes(member.role)),
    enabled: !!tenantId && usesStaff,
  });
  const mayViewPhotos = can('aesthetics.photos.view', isMaster);
  const photos = useQuery({
    queryKey: [...key, 'photos', photoForm.sessionId],
    queryFn: () => aestheticsApi.photos(tenantId, photoForm.sessionId),
    enabled: !!tenantId && !!photoForm.sessionId && area === 'Fotos' && mayViewPhotos,
  });
  const clientOptions = (clients.data ?? []).filter((item) => item.isActive).map((item) => ({ id: item.id, label: name(item) }));
  const serviceOptions = (services.data ?? []).filter((item) => item.isActive).map((item) => ({ id: item.id, label: item.name }));
  const staffOptions = (staff.data ?? []).map((item) => ({ id: item.id, label: name(item) }));
  const scheduledBookings = (bookings.data ?? []).filter((item) => item.status === 'SCHEDULED');
  const sessionOptions = (sessions.data ?? []).map((item) => ({ id: item.id, label: `${name(item.client)} · ${item.service.name} · ${dateTime(item.startedAt)}` }));
  const consentableSessions = (sessions.data ?? []).filter((item) => item.service.consentText && !item.consent && !item.completedAt);
  const chosenConsentSession = consentableSessions.find((item) => item.id === consentForm.sessionId);
  const chosenPhotoSession = (sessions.data ?? []).find((item) => item.id === photoForm.sessionId);

  async function run(action: () => Promise<unknown>, after?: () => void, onError?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: key });
      after?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la operación.');
      if (onError) {
        await queryClient.invalidateQueries({ queryKey: key });
        onError();
      }
    } finally {
      setBusy(false);
    }
  }

  const submitClient = (event: FormEvent) => {
    event.preventDefault();
    const input = {
      firstName: clientForm.firstName,
      lastName: clientForm.lastName,
      ...(clientForm.email.trim() && { email: clientForm.email.trim() }),
      ...(clientForm.phone.trim() && { phone: clientForm.phone.trim() }),
    };
    void run(() => clientId
      ? aestheticsApi.updateClient(tenantId, clientId, { ...input, email: clientForm.email.trim() || null, phone: clientForm.phone.trim() || null })
      : aestheticsApi.createClient(tenantId, input),
    () => { setClientId(null); setClientForm({ firstName: '', lastName: '', email: '', phone: '' }); });
  };
  const submitService = (event: FormEvent) => {
    event.preventDefault();
    const input = { ...serviceForm, durationMinutes: Number(serviceForm.durationMinutes), price: Number(serviceForm.price) };
    void run(() => serviceId
      ? aestheticsApi.updateService(tenantId, serviceId, input)
      : aestheticsApi.createService(tenantId, input),
    () => { setServiceId(null); setServiceForm({ name: '', description: '', durationMinutes: '60', price: '0', consentText: '' }); });
  };
  const editClient = (item: AestheticClient) => {
    setClientId(item.id);
    setClientForm({ firstName: item.firstName, lastName: item.lastName, email: item.email ?? '', phone: item.phone ?? '' });
  };
  const editService = (item: AestheticService) => {
    setServiceId(item.id);
    setServiceForm({ name: item.name, description: item.description ?? '', durationMinutes: String(item.durationMinutes), price: String(item.price), consentText: item.consentText ?? '' });
  };
  const submitBooking = (event: FormEvent) => {
    event.preventDefault();
    void run(() => aestheticsApi.createBooking(tenantId, { ...bookingForm, startAt: new Date(bookingForm.startAt).toISOString() }),
      () => setBookingForm({ clientId: '', serviceId: '', staffId: '', startAt: '' }));
  };
  const submitSession = (event: FormEvent) => {
    event.preventDefault();
    const booking = scheduledBookings.find((item) => item.id === sessionForm.bookingId);
    const input = {
      clientId: booking?.clientId ?? sessionForm.clientId,
      serviceId: booking?.serviceId ?? sessionForm.serviceId,
      staffId: booking?.staffId ?? sessionForm.staffId,
      ...(booking && { bookingId: booking.id }),
      notes: sessionForm.notes,
    };
    void run(() => aestheticsApi.createSession(tenantId, input),
      () => setSessionForm({ bookingId: '', clientId: '', serviceId: '', staffId: '', notes: '' }));
  };
  const submitConsent = (event: FormEvent) => {
    event.preventDefault();
    if (!consentForm.confirmed || !chosenConsentSession) return;
    void run(() => aestheticsApi.recordConsent(tenantId, consentForm.sessionId, consentForm.signerName, consentForm.expectedConsentText),
      () => setConsentForm({ sessionId: '', signerName: '', expectedConsentText: '', confirmed: false }),
      () => setConsentForm((previous) => ({ ...previous, sessionId: '', expectedConsentText: '', confirmed: false })));
  };
  const submitPhoto = (event: FormEvent) => {
    event.preventDefault();
    if (!photoForm.file || !photoForm.sessionId) return;
    void run(() => aestheticsApi.uploadPhoto(tenantId, photoForm.sessionId, photoForm.phase, photoForm.file!),
      () => setPhotoForm({ ...photoForm, file: null }));
  };
  const downloadPhoto = async (session: AestheticSession, photo: AestheticPhoto) => {
    try {
      setError(null);
      const blob = await aestheticsApi.downloadPhoto(tenantId, session.id, photo.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `estetica-${photo.phase.toLowerCase()}-${photo.id}.${photo.mimeType === 'image/png' ? 'png' : 'jpg'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo descargar la foto.');
    }
  };

  if (!tenantId) return null;
  const loading =
    (usesClients && clients.isPending) ||
    (usesServices && services.isPending) ||
    (usesBookings && bookings.isPending) ||
    (usesSessions && sessions.isPending) ||
    (area === 'Consentimientos' && consents.isPending) ||
    (usesStaff && staff.isPending) ||
    (area === 'Fotos' && !!photoForm.sessionId && mayViewPhotos && photos.isPending);
  const failed =
    (usesClients && clients.isError) ||
    (usesServices && services.isError) ||
    (usesBookings && bookings.isError) ||
    (usesSessions && sessions.isError) ||
    (area === 'Consentimientos' && consents.isError) ||
    (usesStaff && staff.isError) ||
    (area === 'Fotos' && mayViewPhotos && photos.isError);

  return <div className="space-y-5">
    <div>
      <p className="text-sm font-medium text-muted-foreground">Operación del estudio</p>
      <h1 className="text-2xl font-bold">Estética</h1>
      <p className="text-sm text-muted-foreground">Clientes, citas y sesiones en un mismo lugar.</p>
    </div>
    <nav aria-label="Áreas de estética" className="flex flex-wrap gap-2 border-b pb-3">
      {areas.map((item) => <Button key={item} type="button" size="sm" variant={area === item ? 'default' : 'outline'} onClick={() => { setArea(item); setError(null); }}>{item}</Button>)}
    </nav>
    {loading && <p role="status">Cargando datos del estudio…</p>}
    {failed && <p role="alert" className="text-sm text-destructive">No se pudieron cargar todos los datos. Vuelve a intentar.</p>}
    {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

    {area === 'Clientes' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.clients.manage', isMaster) && <Card><CardHeader><CardTitle>{clientId ? 'Editar cliente' : 'Nuevo cliente'}</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitClient}>
          <Field label="Nombre"><Input value={clientForm.firstName} onChange={(event) => setClientForm({ ...clientForm, firstName: event.target.value })} required maxLength={100} /></Field>
          <Field label="Apellido"><Input value={clientForm.lastName} onChange={(event) => setClientForm({ ...clientForm, lastName: event.target.value })} required maxLength={100} /></Field>
          <Field label="Correo"><Input type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /></Field>
          <Field label="Teléfono"><Input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} maxLength={40} /></Field>
          <div className="flex gap-2"><Button type="submit" disabled={busy}>{clientId ? 'Guardar' : 'Registrar'}</Button>{clientId && <Button type="button" variant="outline" onClick={() => { setClientId(null); setClientForm({ firstName: '', lastName: '', email: '', phone: '' }); }}>Cancelar</Button>}</div>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Clientes ({clients.data?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-2">
        {clients.data?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay clientes.</p>}
        {clients.data?.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{name(item)}</p><p className="text-sm text-muted-foreground">{item.phone || item.email || 'Sin contacto'}</p></div>{can('aesthetics.clients.manage', isMaster) && <Button type="button" variant="outline" size="sm" onClick={() => editClient(item)}>Editar</Button>}</div>)}
      </CardContent></Card>
    </div>}

    {area === 'Servicios' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.services.manage', isMaster) && <Card><CardHeader><CardTitle>{serviceId ? 'Editar servicio' : 'Nuevo servicio'}</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitService}>
          <Field label="Nombre"><Input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required maxLength={140} /></Field>
          <Field label="Descripción"><Textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} maxLength={1000} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Duración (min)"><Input type="number" min={5} max={480} value={serviceForm.durationMinutes} onChange={(event) => setServiceForm({ ...serviceForm, durationMinutes: event.target.value })} required /></Field><Field label="Precio"><Input type="number" min={0} step="0.01" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} required /></Field></div>
          <Field label="Texto de consentimiento"><Textarea value={serviceForm.consentText} onChange={(event) => setServiceForm({ ...serviceForm, consentText: event.target.value })} maxLength={10000} /></Field>
          <p className="text-xs text-muted-foreground">Si defines un texto, cada sesión requerirá registrar su aceptación antes de completarla.</p>
          <div className="flex gap-2"><Button type="submit" disabled={busy}>{serviceId ? 'Guardar' : 'Crear servicio'}</Button>{serviceId && <Button type="button" variant="outline" onClick={() => { setServiceId(null); setServiceForm({ name: '', description: '', durationMinutes: '60', price: '0', consentText: '' }); }}>Cancelar</Button>}</div>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Catálogo ({services.data?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-2">
        {services.data?.length === 0 && <p className="text-sm text-muted-foreground">Crea el primer servicio para comenzar.</p>}
        {services.data?.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.durationMinutes} min · ${Number(item.price).toFixed(2)}{item.consentText ? ' · Requiere consentimiento' : ''}</p></div>{can('aesthetics.services.manage', isMaster) && <Button type="button" variant="outline" size="sm" onClick={() => editService(item)}>Editar</Button>}</div>)}
      </CardContent></Card>
    </div>}

    {area === 'Agenda' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.bookings.manage', isMaster) && <Card><CardHeader><CardTitle>Programar cita</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitBooking}>
          <Field label="Cliente"><Select value={bookingForm.clientId} onChange={(value) => setBookingForm({ ...bookingForm, clientId: value })} options={clientOptions} placeholder="Selecciona un cliente" /></Field>
          <Field label="Servicio"><Select value={bookingForm.serviceId} onChange={(value) => setBookingForm({ ...bookingForm, serviceId: value })} options={serviceOptions} placeholder="Selecciona un servicio" /></Field>
          <Field label="Profesional"><Select value={bookingForm.staffId} onChange={(value) => setBookingForm({ ...bookingForm, staffId: value })} options={staffOptions} placeholder="Selecciona un profesional" /></Field>
          <Field label="Fecha y hora"><Input type="datetime-local" value={bookingForm.startAt} onChange={(event) => setBookingForm({ ...bookingForm, startAt: event.target.value })} required /></Field>
          <Button type="submit" disabled={busy || !clientOptions.length || !serviceOptions.length || !staffOptions.length}>Programar</Button>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Próximas citas</CardTitle></CardHeader><CardContent className="space-y-2">
        {bookings.data?.length === 0 && <p className="text-sm text-muted-foreground">No hay citas registradas.</p>}
        {bookings.data?.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">{dateTime(item.startAt)} · {name(item.client)}</p><p className="text-sm text-muted-foreground">{item.service.name} · {name(item.staff)} · {item.status === 'SCHEDULED' ? 'Programada' : item.status === 'CANCELLED' ? 'Cancelada' : 'Completada'}</p></div>{item.status === 'SCHEDULED' && can('aesthetics.bookings.manage', isMaster) && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(() => aestheticsApi.updateBooking(tenantId, item.id, { status: 'CANCELLED' }))}>Cancelar</Button>}</div>)}
      </CardContent></Card>
    </div>}

    {area === 'Sesiones' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.sessions.manage', isMaster) && <Card><CardHeader><CardTitle>Iniciar sesión</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitSession}>
          <Field label="Cita existente (opcional)"><Select value={sessionForm.bookingId} onChange={(value) => setSessionForm({ ...sessionForm, bookingId: value })} options={scheduledBookings.map((item) => ({ id: item.id, label: `${dateTime(item.startAt)} · ${name(item.client)} · ${item.service.name}` }))} placeholder="Sesión sin cita" required={false} /></Field>
          {!sessionForm.bookingId && <>
            <Field label="Cliente"><Select value={sessionForm.clientId} onChange={(value) => setSessionForm({ ...sessionForm, clientId: value })} options={clientOptions} placeholder="Selecciona un cliente" /></Field>
            <Field label="Servicio"><Select value={sessionForm.serviceId} onChange={(value) => setSessionForm({ ...sessionForm, serviceId: value })} options={serviceOptions} placeholder="Selecciona un servicio" /></Field>
            <Field label="Profesional"><Select value={sessionForm.staffId} onChange={(value) => setSessionForm({ ...sessionForm, staffId: value })} options={staffOptions} placeholder="Selecciona un profesional" /></Field>
          </>}
          <Field label="Notas de sesión"><Textarea value={sessionForm.notes} onChange={(event) => setSessionForm({ ...sessionForm, notes: event.target.value })} maxLength={5000} /></Field>
          <Button type="submit" disabled={busy}>Iniciar sesión</Button>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Sesiones ({sessions.data?.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-2">
        {sessions.data?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay sesiones.</p>}
        {sessions.data?.map((item) => <div key={item.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{name(item.client)} · {item.service.name}</p><p className="text-sm text-muted-foreground">{dateTime(item.startedAt)} · {name(item.staff)}</p></div>{item.completedAt ? <span className="text-xs text-muted-foreground">Completada</span> : can('aesthetics.sessions.manage', isMaster) && <Button type="button" size="sm" variant="outline" disabled={busy || (!!item.service.consentText && !item.consent)} onClick={() => void run(() => aestheticsApi.completeSession(tenantId, item.id))}>Completar</Button>}</div>{item.service.consentText && !item.consent && <p className="mt-2 text-xs text-amber-700">Pendiente de consentimiento</p>}{item.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{item.notes}</p>}</div>)}
      </CardContent></Card>
    </div>}

    {area === 'Consentimientos' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.consents.manage', isMaster) && <Card><CardHeader><CardTitle>Registrar aceptación</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitConsent}>
          <Field label="Sesión"><Select value={consentForm.sessionId} onChange={(value) => setConsentForm({ ...consentForm, sessionId: value, expectedConsentText: consentableSessions.find((item) => item.id === value)?.service.consentText ?? '', confirmed: false })} options={consentableSessions.map((item) => ({ id: item.id, label: `${name(item.client)} · ${item.service.name}` }))} placeholder="Selecciona una sesión" /></Field>
          {chosenConsentSession && <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{consentForm.expectedConsentText}</div>}
          <Field label="Nombre de quien acepta"><Input value={consentForm.signerName} onChange={(event) => setConsentForm({ ...consentForm, signerName: event.target.value })} required maxLength={200} /></Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={consentForm.confirmed} onChange={(event) => setConsentForm({ ...consentForm, confirmed: event.target.checked })} required /><span>Confirmo que la persona leyó y aceptó el texto mostrado.</span></label>
          <Button type="submit" disabled={busy || !chosenConsentSession || !consentForm.confirmed}>Registrar</Button>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Consentimientos registrados</CardTitle></CardHeader><CardContent className="space-y-2">
        {consents.data?.length === 0 && <p className="text-sm text-muted-foreground">No hay consentimientos registrados.</p>}
        {consents.data?.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="font-medium">{item.session ? name(item.session.client) : item.signerName} · {item.session?.service.name}</p><p className="text-sm text-muted-foreground">Aceptó: {item.signerName} · {dateTime(item.acceptedAt)}</p><details className="mt-2 text-sm"><summary className="cursor-pointer">Ver texto aceptado</summary><p className="mt-2 whitespace-pre-wrap">{item.bodySnapshot}</p></details></div>)}
      </CardContent></Card>
    </div>}

    {area === 'Fotos' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {can('aesthetics.photos.manage', isMaster) && <Card><CardHeader><CardTitle>Subir foto</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={submitPhoto}>
          <Field label="Sesión"><Select value={photoForm.sessionId} onChange={(value) => setPhotoForm({ ...photoForm, sessionId: value })} options={sessionOptions} placeholder="Selecciona una sesión" /></Field>
          <Field label="Momento"><Select value={photoForm.phase} onChange={(value) => setPhotoForm({ ...photoForm, phase: value as AestheticPhoto['phase'] })} options={[{ id: 'BEFORE', label: 'Antes' }, { id: 'AFTER', label: 'Después' }]} placeholder="Selecciona el momento" /></Field>
          <Field label="Foto JPG o PNG"><Input type="file" accept="image/jpeg,image/png" onChange={(event) => setPhotoForm({ ...photoForm, file: event.target.files?.[0] ?? null })} required /></Field>
          <p className="text-xs text-muted-foreground">Máximo 10 MB. Las fotos se guardan cifradas.</p>
          <Button type="submit" disabled={busy || !photoForm.file}>Subir foto</Button>
        </form>
      </CardContent></Card>}
      {mayViewPhotos && <Card><CardHeader><CardTitle>Fotos de sesión</CardTitle></CardHeader><CardContent className="space-y-3">
        <Field label="Sesión"><Select value={photoForm.sessionId} onChange={(value) => setPhotoForm({ ...photoForm, sessionId: value })} options={sessionOptions} placeholder="Selecciona una sesión" /></Field>
        {chosenPhotoSession && photos.data?.length === 0 && <p className="text-sm text-muted-foreground">Esta sesión no tiene fotos.</p>}
        {chosenPhotoSession && photos.data?.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-3"><span className="text-sm">{item.phase === 'BEFORE' ? 'Antes' : 'Después'} · {dateTime(item.createdAt)}</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void downloadPhoto(chosenPhotoSession, item)}>Descargar</Button>{can('aesthetics.photos.manage', isMaster) && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => aestheticsApi.removePhoto(tenantId, chosenPhotoSession.id, item.id))}>Retirar</Button>}</div></div>)}
      </CardContent></Card>}
    </div>}
  </div>;
}
