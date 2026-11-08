import { z } from 'zod';

/** Same options the API accepts (api/src/demo-requests/dto/demo-request.dto.ts). */
export const TEAM_SIZES = ['1', '2-5', '6-15', '16+'] as const;

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120, 'Máximo 120 caracteres'),
  clinic: z.string().trim().min(2, 'Escribe el nombre de tu consultorio').max(160, 'Máximo 160 caracteres'),
  email: z.string().trim().email('Correo inválido').max(254, 'Correo inválido'),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,}$/, 'Teléfono inválido').max(30, 'Teléfono inválido'),
  teamSize: z.string().min(1, 'Selecciona el tamaño de tu equipo'),
  message: z.string().trim().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  acceptPrivacy: z.boolean().refine((value) => value, 'Debes aceptar la política de privacidad'),
  /** Honeypot: hidden from people, so only bots fill it. */
  website: z.string().optional(),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;

export function whatsappUrl(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
