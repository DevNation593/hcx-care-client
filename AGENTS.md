# AGENTS.md — hcx-care-client

Guía para agentes de código (Codex / GPT) que trabajan o revisan PRs en este repositorio.
Las reglas de seguridad viven en [`SECURITY.md`](SECURITY.md); este archivo las referencia y no las repite.

## Contexto del proyecto

HCX Care es un SaaS **multi-tenant** para consultorios y clínicas de salud (psicología, estética y otras especialidades). Este repositorio es el cliente web:

- Next.js 14 (App Router) + React 18 + TypeScript, Tailwind, TanStack Query, Zustand, React Hook Form + Zod, Axios, Vitest + Testing Library.
- Consume la API `hcx-care-api` (`NEXT_PUBLIC_API_BASE_URL`). **La API es la única autoridad de seguridad**: el cliente oculta lo que el usuario no puede usar, pero nunca es la barrera que lo impide.
- Muestra **datos clínicos sensibles** (historia clínica, notas, registros de especialidad, archivos de pacientes) y datos de facturación.
- Documentación de referencia en `docs/`: `ROUTE_MAP.md`, `DOCUMENTATION.md`, `SUBSCRIPTION_*.md`.

### Mapa rápido

| Ruta | Qué contiene |
| --- | --- |
| `src/app/(marketing)/` | Sitio público (SEO, planes, legales) |
| `src/app/(auth)/`, `activate/`, `change-password/`, `verify/` | Login, activación, cambio de contraseña, verificación pública de documentos |
| `src/app/(dashboard)/` | App del consultorio (agenda, pacientes, caja, inventario, administración) |
| `src/app/(platform)/` | Panel del `ADMIN` de plataforma |
| `src/lib/api/` | Cliente Axios (`client.ts`: tokens, refresh, interceptores) y endpoints |
| `src/store/authStore.ts` | Sesión persistida (Zustand) |
| `src/hooks/` | Hooks de datos con TanStack Query; `usePermissions`, `useSections`, `useCanManageAccount` |
| `src/types/guards.ts` | Helpers de rol (`isMasterRole`, `isPlatformAdmin`, `isCashierRole`, …) |
| `public/sw.js` | Service worker solo para notificaciones push |

### Roles

`MASTER` (titular, uno por consultorio), `PROFESIONAL`, `ASISTENTE`, `CAJERO` (solo caja, facturación e inventario; sin agenda, pacientes ni historia clínica), `PACIENTE`, `ADMIN` (solo `/platform`). `CLIENTE`, `PSICOLOGO` y `SOPORTE` son obsoletos.

## Comandos

```bash
npm ci
npm run lint        # --max-warnings=0
npm run type-check
npm test
npm run build
```

La CI (`.github/workflows/ci.yml`) ejecuta los cuatro. Un PR debe pasarlos todos.

## Convenciones

- Los PRs se abren contra **`dev`**, nunca contra `main`.
- Commits en inglés con prefijo convencional (`feat(web):`, `fix(web):`, `test(web):`, `chore:`).
- Código y comentarios en inglés; textos de interfaz en español.
- Las llamadas HTTP pasan por `src/lib/api/` (nunca `fetch`/`axios` sueltos con el token a mano).
- Datos del servidor con TanStack Query; las mutaciones invalidan las queries afectadas (`src/hooks/queryInvalidation.ts`).
- Formularios con React Hook Form + Zod (`src/lib/validations/`).
- Componentes y hooks nuevos con pruebas en Vitest; los cambios de visibilidad por rol o sección llevan una prueba de que el rol excluido no ve la opción.

## Review guidelines

Instrucciones para la revisión automática de PRs con Codex / GPT.

### Idioma y formato

- Escribe todos los comentarios de revisión **en español**.
- Cada hallazgo indica: severidad (`P0`–`P3`), archivo y línea, qué falla, un escenario concreto que lo demuestra y la corrección sugerida.
- Si un hallazgo viola una regla de `SECURITY.md`, cita su identificador (por ejemplo `SEC-WEB-02`).
- No resumas el PR ni felicites; reporta solo hallazgos accionables. Si no hay ninguno, dilo en una línea.

### Antes de revisar

1. Lee [`SECURITY.md`](SECURITY.md). Sus reglas son invariantes del sistema.
2. Si el cambio depende de un endpoint nuevo o modificado de la API, comprueba que el contrato (tipos en `src/types/`) coincide con lo que la API devuelve y que el cliente no asume un permiso que la API no concede.

### Severidades

- **P0 — bloquea el merge.** XSS (HTML sin sanear, `dangerouslySetInnerHTML` con datos de usuario, URLs `javascript:`); tokens o datos clínicos expuestos a terceros (analítica, logs, URLs, almacenamiento compartido); secreto en una variable `NEXT_PUBLIC_*` o en el código; redirección abierta tras login; datos de un consultorio o usuario visibles tras cerrar sesión o cambiar de cuenta.
- **P1 — debe corregirse antes del merge.** Opción visible para un rol que no debe usarla (por ejemplo `CAJERO` viendo pacientes o historia clínica) aunque la API la rechace; ruta del dashboard o de plataforma accesible sin sesión o con el rol equivocado; errores de la API ignorados que dejan la interfaz en un estado incorrecto; regresión funcional en agenda, historia clínica, caja, facturación o inventario; regresión sin prueba.
- **P2 — conviene corregir.** Invalidación de caché incompleta, estados de carga/error ausentes, accesibilidad básica rota (formularios sin etiqueta, foco perdido en diálogos), pruebas faltantes para ramas nuevas, renderizados costosos en listas grandes.
- **P3 — menor.** Legibilidad, nombres, textos. Repórtalos solo si el PR no tiene hallazgos de mayor severidad.

### Qué revisar con prioridad

1. **Renderizado seguro.** Ningún HTML de la API o del usuario se inserta sin sanear; enlaces construidos con datos externos validan el esquema (`https:`, `mailto:`, `tel:`).
2. **Sesión y tokens.** Solo `src/lib/api/client.ts` y `authStore` leen o escriben tokens; el logout limpia tokens, `authStore` y la caché de TanStack Query; el refresh no entra en bucle ni reintenta peticiones de autenticación.
3. **Visibilidad por rol y sección.** La interfaz usa `usePermissions`, `useSections` y los helpers de `src/types/guards.ts`, coherentes con el catálogo de permisos de la API; `ADMIN` no ve la app del consultorio y los roles del consultorio no ven `/platform`.
4. **Datos clínicos y PII.** No se escriben en `localStorage`/`sessionStorage`, en la URL (query string), en `console.*`, en eventos de analítica ni en el service worker.
5. **Contrato con la API.** Tipos y nombres de campos coinciden con la API; las mutaciones manejan 403 (`PASSWORD_CHANGE_REQUIRED`, `SECTION_NOT_ENABLED`, `PLATFORM_ONLY`, límites del plan) con un mensaje útil.
6. **Pruebas.** Que existan y prueben el comportamiento visible, incluido lo que un rol excluido no debe ver.

### Qué no reportar

- Formato o estilo que ya cubre ESLint.
- Archivos generados o ajenos al PR: `.next/`, `node_modules/`, `.worktrees/`, `tsconfig.tsbuildinfo`, `next-env.d.ts`.
- Diferencias de diseño visual sin impacto funcional o de accesibilidad.
- Preferencias personales sin impacto en corrección, seguridad o mantenimiento.
- Problemas preexistentes en código que el PR no toca, salvo que sean P0.
