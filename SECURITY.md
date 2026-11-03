# Política de seguridad — hcx-care-client

## Reportar una vulnerabilidad

No abras un issue público. Usa **Security → Report a vulnerability** en
[DevNation593/hcx-care-client](https://github.com/DevNation593/hcx-care-client/security/advisories/new)
(reporte privado de GitHub). Incluye la página o archivo afectado, los pasos para reproducirlo y el impacto.
Si la causa está en la API, repórtalo en [hcx-care-api](https://github.com/DevNation593/hcx-care-api/security/advisories/new).

Solo recibe parches la rama `main` (producción) y `dev` (integración).

## Principio base

**El cliente no es una barrera de seguridad.** Toda autorización la decide la API (`hcx-care-api`, ver su `SECURITY.md`). El cliente:

- oculta lo que el usuario no puede usar, para no ofrecer acciones que fallarán;
- no debe filtrar lo que la API le entrega (tokens, datos clínicos, PII) a ningún otro lugar;
- no debe abrir vías de ataque contra el navegador del usuario (XSS, redirecciones abiertas).

## Qué protegemos

| Activo | Dónde vive en el cliente |
| --- | --- |
| Tokens de sesión (access y refresh) | `localStorage`, gestionados solo por `src/lib/api/client.ts` |
| Usuario y consultorio en sesión | `authStore` (Zustand persistido como `auth-storage`) |
| Datos clínicos y de pacientes | Memoria (caché de TanStack Query) y pantalla; nunca persistidos |
| Facturación, caja e inventario | Igual que los datos clínicos |

## Reglas (invariantes)

Toda revisión de código, humana o automática, verifica estas reglas. Un cambio que viole una regla marcada **P0** no se fusiona.

### Renderizado y XSS

- **SEC-WEB-01 (P0).** Prohibido `dangerouslySetInnerHTML`, `innerHTML` o `eval`/`new Function` con datos que provengan de la API, del usuario o de la URL. La única excepción existente es `JsonLd` (`src/features/marketing/json-ld.tsx`), que serializa datos estáticos y escapa `<`.
- **SEC-WEB-02 (P0).** Los `href`, `src` y `window.location` construidos con datos externos solo aceptan `https:`, `mailto:` o `tel:` (o rutas internas que empiezan por `/` y no por `//`). Nunca `javascript:` ni `data:`.
- **SEC-WEB-03 (P1).** Los archivos subidos por usuarios (imágenes, PDFs) se muestran como descarga o en `<img>`/`<iframe sandbox>`, nunca inyectados como HTML. Los `target="_blank"` llevan `rel="noopener noreferrer"`.

### Sesión y tokens

- **SEC-WEB-04 (P0).** Solo `src/lib/api/client.ts` (y `authStore` al cerrar sesión) lee o escribe tokens. Ningún componente, hook ni script de terceros los lee, los registra ni los envía a un host distinto de `NEXT_PUBLIC_API_BASE_URL`.
- **SEC-WEB-05 (P0).** Cerrar sesión borra tokens, `authStore` y la caché de TanStack Query (`queryClient.clear()`), y redirige a `/login`. Cambiar de usuario o de consultorio nunca muestra datos del anterior.
- **SEC-WEB-06 (P0).** Las redirecciones tras login, activación o cambio de contraseña van solo a rutas internas conocidas (`postLoginRoute`, `ROUTES`). Un parámetro de la URL nunca decide un destino externo.
- **SEC-WEB-07 (P1).** El interceptor de refresh no reintenta peticiones de `/auth/*`, no entra en bucle y, si el refresh falla, cierra la sesión. Un `403 PASSWORD_CHANGE_REQUIRED` lleva a `/change-password`.

### Datos clínicos y PII

- **SEC-WEB-08 (P0).** Datos clínicos y PII de pacientes (nombres, documentos, diagnósticos, notas, archivos) no se guardan en `localStorage`, `sessionStorage`, IndexedDB, cookies ni en la caché del service worker, y no se ponen en la URL (query string o segmentos legibles: se usan IDs).
- **SEC-WEB-09 (P0).** Analítica y scripts de terceros (Google Analytics) se cargan solo en `src/app/(marketing)/` y solo después del consentimiento de cookies. Nunca en `(dashboard)`, `(platform)`, `(auth)` ni en páginas con datos de pacientes.
- **SEC-WEB-10 (P1).** Ningún `console.*` con datos de la API, tokens o PII en código de producción. Los mensajes de error al usuario no muestran respuestas crudas de la API.
- **SEC-WEB-11 (P1).** El service worker (`public/sw.js`) solo maneja notificaciones push: no cachea respuestas de la API ni rutas autenticadas, y las notificaciones no contienen datos clínicos.

### Visibilidad por rol

- **SEC-WEB-12 (P1).** Las opciones, rutas y acciones se muestran según `usePermissions`, `useSections` y los helpers de `src/types/guards.ts`, coherentes con el catálogo de permisos de la API. `CAJERO` no ve agenda, pacientes, tareas ni historia clínica; `ADMIN` solo ve `/platform`; los roles del consultorio no ven `/platform`.
- **SEC-WEB-13 (P1).** Las páginas de `(dashboard)` y `(platform)` exigen sesión y rol antes de pedir datos; no se piden datos a la API para luego ocultarlos.

### Configuración y dependencias

- **SEC-WEB-14 (P0).** Toda variable `NEXT_PUBLIC_*` es pública: nunca contiene secretos, claves privadas ni tokens. Las nuevas se documentan en `.env.local.example` con un valor de ejemplo inválido.
- **SEC-WEB-15 (P2).** Dependencias nuevas: mantenidas, sin vulnerabilidades conocidas altas o críticas (`npm audit`) y justificadas en el PR. Scripts externos solo desde orígenes conocidos.

## Lista rápida por tipo de cambio

- **Componente que muestra datos de la API o del usuario:** SEC-WEB-01, 02, 03, 10.
- **Login, logout, refresh, cambio de contraseña:** SEC-WEB-04, 05, 06, 07.
- **Pantallas de pacientes, historia clínica o archivos:** SEC-WEB-03, 08, 10, 12.
- **Navegación, menús o rutas nuevas:** SEC-WEB-06, 12, 13.
- **Sitio público, analítica, service worker o variables de entorno:** SEC-WEB-09, 11, 14, 15.

## Pendientes conocidos

Riesgos identificados que aún no se resuelven. Una revisión no los reporta como nuevos salvo que el PR los empeore:

- Los tokens viven en `localStorage`, accesibles a cualquier XSS. Por eso SEC-WEB-01 a 03 son P0. El objetivo a futuro es mover el refresh token a una cookie `HttpOnly` emitida por la API.
- `next.config.mjs` no define cabeceras de seguridad (`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) para las páginas de la app.
- La protección de rutas se hace en el cliente (no hay `middleware.ts`); un usuario sin sesión puede cargar el shell de la página antes de ser redirigido, aunque la API no le entregue datos.
