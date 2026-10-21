export interface AestheticClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface AestheticService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string | number;
  consentText: string | null;
  isActive: boolean;
}

export type AestheticPerson = Pick<AestheticClient, 'id' | 'firstName' | 'lastName'>;

export interface AestheticBooking {
  id: string;
  clientId: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  client: AestheticPerson;
  service: Pick<AestheticService, 'id' | 'name' | 'durationMinutes'>;
  staff: AestheticPerson;
}

export interface AestheticConsent {
  id: string;
  sessionId: string;
  signerName: string;
  bodySnapshot: string;
  acceptedAt: string;
  session?: { client: AestheticPerson; service: Pick<AestheticService, 'id' | 'name'> };
}

export interface AestheticPhoto {
  id: string;
  sessionId: string;
  phase: 'BEFORE' | 'AFTER';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AestheticSession {
  id: string;
  clientId: string;
  serviceId: string;
  staffId: string;
  bookingId: string | null;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  client: AestheticPerson;
  service: Pick<AestheticService, 'id' | 'name' | 'consentText'>;
  staff: AestheticPerson;
  consent: AestheticConsent | null;
}
