import { ImageResponse } from 'next/og';
import { site } from '@/content/site';

export const runtime = 'edge';
export const alt = `${site.brand.name}: ${site.brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: 80, color: '#ffffff',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 36 }}>
          {/* The brand mark of components/brand/logo.tsx, inverted to stand on the gradient. */}
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect width="64" height="64" rx="14" fill="#ffffff" />
            <path d="M18 16V48M46 16V48" stroke="#1d4ed8" strokeWidth="6" />
            <path d="M18 32H26L30 23L35 42L39 32H46" stroke="#1d4ed8" strokeWidth="4" />
          </svg>
          <div style={{ marginLeft: 20 }}>{site.brand.name}</div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>{site.brand.tagline}</div>
        <div style={{ fontSize: 30, marginTop: 32, opacity: 0.9 }}>Agenda · Pacientes · Notas clínicas · Facturación</div>
      </div>
    ),
    size,
  );
}
