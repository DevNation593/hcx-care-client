# PROYECTO: HCX Care - Frontend

## 📋 ÍNDICE

1. [Resumen de Arquitectura](#resumen-de-arquitectura)
2. [Estructura de Carpetas](#estructura-de-carpetas)
3. [Mapa de Rutas](#mapa-de-rutas)
4. [Componentes UI](#componentes-ui)
5. [Capa de Datos](#capa-de-datos)
6. [Esquemas Zod y Formularios](#esquemas-zod-y-formularios)
7. [Instalación y Ejecución](#instalación-y-ejecución)
8. [Variables de Entorno](#variables-de-entorno)
9. [Deployment](#deployment)

---

## 🏗️ RESUMEN DE ARQUITECTURA

### Stack Tecnológico

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: TailwindCSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Formularios**: React Hook Form + Zod
- **Calendario**: FullCalendar
- **Notificaciones**: Web Push API + Service Worker
- **Iconos**: Lucide React
- **Toasts**: Sonner

### Capas de Arquitectura

```
┌──────────────────────────────────────────────────┐
│  PRESENTACIÓN (React Components)                  │
│  - Páginas (App Router)                          │
│  - Componentes UI                                │
│  - Módulos de Features                           │
├──────────────────────────────────────────────────┤
│  APLICACIÓN (Business Logic)                     │
│  - Zustand Stores (Estado Global)                │
│  - React Query Hooks (Data Fetching)             │
│  - Form Validators (Zod Schemas)                 │
├──────────────────────────────────────────────────┤
│  DOMINIO (Types & Rules)                         │
│  - TypeScript Types/DTOs                         │
│  - Reglas de negocio                             │
│  - Constantes                                    │
├──────────────────────────────────────────────────┤
│  INFRAESTRUCTURA (External Services)             │
│  - API Client (Axios + Interceptors)             │
│  - Service Worker (Web Push)                     │
│  - Local Storage                                 │
└──────────────────────────────────────────────────┘
```

### Características Principales

#### Multi-Tenancy
- **Tenant** = Clínica/Consultorio (organización)
- Aislamiento automático por `tenantId`
- Datos compartimentados por organización

#### RBAC (Role-Based Access Control)
- **MASTER**: Titular de la cuenta
- **PROFESIONAL**: Psicólogo/a
- **ASISTENTE**: Asistente

#### Planes y Licencias (Seat-based)
- **BASIC**: Plan básico con límites
- **PRO**: Plan profesional con más features
- **CUSTOM**: Plan personalizado enterprise
- Precio por psicólogo (seat)
- Límites de psychologists, pacientes, almacenamiento

---

## 📁 ESTRUCTURA DE CARPETAS

```
web/
├── public/
│   ├── sw.js                      # Service Worker para Web Push
│   └── (assets estáticos)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/               # Layout group: Autenticación
│   │   │   ├── layout.tsx        # Layout de auth (sin sidebar)
│   │   │   └── login/
│   │   │       └── page.tsx      # Página de login
│   │   │
│   │   ├── (dashboard)/          # Layout group: Dashboard
│   │   │   ├── layout.tsx        # Layout con sidebar/header
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Dashboard principal
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx      # Vista de calendario
│   │   │   ├── patients/
│   │   │   │   ├── page.tsx      # Lista de pacientes
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx  # Crear paciente
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Detalle de paciente
│   │   │   └── admin/
│   │   │       ├── team/
│   │   │       │   └── page.tsx  # Gestión de equipo
│   │   │       ├── subscription/
│   │   │       │   └── page.tsx  # Gestión de suscripción
│   │   │       └── settings/
│   │   │           └── page.tsx  # Configuración
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx          # Wizard de onboarding
│   │   │
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home (redirect)
│   │   └── globals.css           # Estilos globales
│   │
│   ├── components/               # Componentes reusables
│   │   ├── ui/                   # Componentes base
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── alert.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/               # Componentes de layout
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── notifications-panel.tsx
│   │   │
│   │   └── providers.tsx         # React Query + Toaster provider
│   │
│   ├── features/                 # Módulos por dominio
│   │   ├── auth/
│   │   ├── calendar/
│   │   │   ├── calendar-view.tsx
│   │   │   └── appointment-dialog.tsx
│   │   ├── patients/
│   │   ├── admin/
│   │   │   └── invite-user-dialog.tsx
│   │   ├── notifications/
│   │   └── dashboard/
│   │
│   ├── hooks/                    # Custom React Hooks
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   ├── useAppointments.ts
│   │   └── usePushNotifications.ts
│   │
│   ├── lib/                      # Librerías y utilidades
│   │   ├── api/
│   │   │   ├── client.ts         # Axios client con interceptors
│   │   │   └── endpoints.ts      # API endpoints organizados
│   │   ├── validations/
│   │   │   └── schemas.ts        # Zod schemas
│   │   ├── utils.ts              # Funciones helper
│   │   └── constants.ts          # Constantes de la app
│   │
│   ├── store/                    # Zustand stores
│   │   ├── authStore.ts          # Estado de autenticación
│   │   └── uiStore.ts            # Estado de UI (sidebar, etc)
│   │
│   └── types/                    # TypeScript types
│       ├── index.ts              # Types principales
│       └── guards.ts             # Type guards y helpers
│
├── .env.local.example            # Variables de entorno ejemplo
├── .gitignore
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

### Explicación de Organización

#### `/app` - App Router (Next.js 14)
- **Route Groups** `(auth)` y `(dashboard)` para layouts diferentes
- Páginas organizadas por feature/dominio
- Server Components por defecto, Client Components donde se necesita

#### `/components` - Componentes Reusables
- **ui/**: Componentes base sin lógica de negocio (Button, Input, Card...)
- **layout/**: Componentes estructurales (Sidebar, Header...)
- **providers.tsx**: Wrapper de providers globales

#### `/features` - Módulos de Dominio
- Componentes específicos de cada feature
- Lógica acoplada al dominio

#### `/hooks` - Custom Hooks
- Lógica reutilizable con React Query
- Abstracción de API calls

#### `/lib` - Utilidades y Configuraciones
- API client con refresh token automático
- Esquemas de validación
- Helpers y constantes

#### `/store` - Estado Global (Zustand)
- `authStore`: User, tenant, isAuthenticated
- `uiStore`: UI state (sidebar collapsed, etc)

#### `/types` - TypeScript Types
- DTOs alineados con el backend
- Type guards para validaciones en runtime

---

## 🗺️ MAPA DE RUTAS

### Rutas Públicas

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/login` | `app/(auth)/login/page.tsx` | Login de usuarios |
| `/forgot-password` | - | Recuperar contraseña (TODO) |
| `/onboarding` | `app/onboarding/page.tsx` | Wizard de configuración inicial |

### Rutas Privadas (Requieren autenticación)

#### Dashboard
| Ruta | Componente | Descripción | Roles |
|------|------------|-------------|-------|
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Dashboard principal | Todos |

#### Calendario y Citas
| Ruta | Componente | Descripción | Roles |
|------|------------|-------------|-------|
| `/calendar` | `app/(dashboard)/calendar/page.tsx` | Vista de calendario | Todos |

#### Pacientes
| Ruta | Componente | Descripción | Roles |
|------|------------|-------------|-------|
| `/patients` | `app/(dashboard)/patients/page.tsx` | Lista de pacientes | Todos |
| `/patients/new` | `app/(dashboard)/patients/new/page.tsx` | Crear paciente | MASTER, PROFESIONAL |
| `/patients/[id]` | `app/(dashboard)/patients/[id]/page.tsx` | Detalle de paciente | Todos |

#### Administración
| Ruta | Componente | Descripción | Roles |
|------|------------|-------------|-------|
| `/admin/team` | `app/(dashboard)/admin/team/page.tsx` | Gestión de usuarios | MASTER (y SOPORTE) |
| `/admin/subscription` | `app/(dashboard)/admin/subscription/page.tsx` | Planes y facturación | MASTER (y SOPORTE) |
| `/admin/settings` | `app/(dashboard)/admin/settings/page.tsx` | Configuración clínica | MASTER (y SOPORTE) |

### Protección de Rutas

```typescript
// Layout con protección
export default function DashboardLayout({ children }: Props) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);
  
  // ...
}
```

### Gating por Rol

```typescript
// En componentes
import { canManageUsers } from '@/types/guards';

const user = useAuthStore((state) => state.user);
const canInvite = user && canManageUsers(user);

{canInvite && (
  <Button onClick={handleInvite}>Invitar Usuario</Button>
)}
```

---

## 🎨 COMPONENTES UI

### Librería de Componentes Base

Todos en `src/components/ui/`:

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| `<Button />` | `button.tsx` | Botón con variants, loading state |
| `<Input />` | `input.tsx` | Input con error display |
| `<Textarea />` | `textarea.tsx` | Textarea con error |
| `<Label />` | `label.tsx` | Label con asterisco para required |
| `<Card />` | `card.tsx` | Card container con Header, Content, Footer |
| `<Badge />` | `badge.tsx` | Badge con variants (success, warning, etc) |
| `<Alert />` | `alert.tsx` | Alert box con variants |
| `<Dialog />` | `dialog.tsx` | Modal dialog |
| `<Avatar />` | `avatar.tsx` | Avatar con fallback a iniciales |
| `<Skeleton />` | `skeleton.tsx` | Loading skeletons |

### Ejemplo de Uso

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mi Título <Badge variant="success">Activo</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button loading={isPending} variant="primary">
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Variants y Props Comunes

#### Button
- **variant**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **size**: `default`, `sm`, `lg`, `icon`
- **loading**: `boolean` - Muestra spinner y deshabilita

#### Badge
- **variant**: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`

#### Alert
- **variant**: `default`, `destructive`, `success`, `warning`

---

## 🔌 CAPA DE DATOS

### API Client

**Ubicación**: `src/lib/api/client.ts`

Características:
- Instancia de Axios configurada
- Interceptor de request: Añade el access token JWT (`localStorage`)
- Interceptor de response: Manejo de errores y renovación automática del access token
- El refresh token **no** se guarda en el navegador legible por scripts: la API lo envía en la cookie `HttpOnly` `refresh_token`. El cliente usa `withCredentials: true` y la cabecera `X-Client: web` en todas las peticiones, y `/auth/refresh` se llama sin cuerpo. Las peticiones que fallan con 401 durante la renovación esperan en cola y se repiten con el token nuevo.
- Al cargar, se borra la clave `refresh_token` que dejaban las versiones anteriores en `localStorage`. Si hay un usuario persistido y el access token falta o caducó, `authStore` renueva la sesión con la cookie antes de marcar `hasHydrated`; si la API responde 401 o 403 se limpia la sesión.
- Métodos HTTP: `get`, `post`, `put`, `patch`, `delete`, `upload`

```typescript
// Uso directo
import { apiClient } from '@/lib/api/client';

const response = await apiClient.get<ApiResponse<User>>('/users/me');
```

### API Endpoints

**Ubicación**: `src/lib/api/endpoints.ts`

Organizado por dominio:

```typescript
// Auth
export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
};

// Patients
export const patientsApi = {
  list: (params) => apiClient.get('/patients', { params }),
  get: (id) => apiClient.get(`/patients/${id}`),
  create: (data) => apiClient.post('/patients', data),
  // ...
};
```

### React Query Hooks

**Ubicación**: `src/hooks/`

Ejemplo:

```typescript
// hooks/usePatients.ts
export function usePatients(params?) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, params],
    queryFn: async () => {
      const response = await patientsApi.list(params);
      return response;
    },
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
      toast.success('Paciente creado');
    },
  });
}
```

### Query Keys Strategy

**Ubicación**: `src/lib/constants.ts`

```typescript
export const QUERY_KEYS = {
  ME: ['me'],
  PATIENTS: ['patients'],
  PATIENT_DETAIL: (id: string) => ['patients', id],
  APPOINTMENTS: ['appointments'],
  APPOINTMENTS_TODAY: ['appointments', 'today'],
  // ...
};
```

### Zustand Stores

#### Auth Store

```typescript
// store/authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      isAuthenticated: false,
      
      setAuth: (user, tenant) => set({ user, tenant, isAuthenticated: true }),
      logout: async () => {
        await apiClient.post('/auth/logout');
        apiClient.clearAuthData();
        set({ user: null, tenant: null, isAuthenticated: false });
      },
    }),
    { name: 'auth-storage' }
  )
);
```

#### UI Store

```typescript
// store/uiStore.ts
export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  notificationsPanelOpen: false,
  
  toggleSidebar: () => set((state) => ({ 
    sidebarCollapsed: !state.sidebarCollapsed 
  })),
  toggleNotificationsPanel: () => set((state) => ({ 
    notificationsPanelOpen: !state.notificationsPanelOpen 
  })),
}));
```

### Error Handling

**Global**:
- Interceptor en API client normaliza errores
- React Query muestra errors en UI
- Sonner toast para feedback al usuario

```typescript
// En componente
const { mutate, error, isPending } = useCreatePatient();

if (error) {
  toast.error(error.message);
}
```

### Loading States

- **Skeleton**: Para carga inicial
- **Spinner**: En botones durante mutations
- **isLoading**: Estado de queries

```tsx
{isLoading ? (
  <SkeletonTable />
) : data ? (
  <Table data={data} />
) : (
  <EmptyState />
)}
```

---

## 📝 ESQUEMAS ZOD Y FORMULARIOS

### Schemas

**Ubicación**: `src/lib/validations/schemas.ts`

#### Login

```typescript
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
```

#### Paciente

```typescript
export const patientSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  assignedPsychologistId: z.string().optional(),
  // ...
});
```

#### Cita

```typescript
export const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Selecciona un paciente'),
  psychologistId: z.string().min(1),
  title: z.string().min(3),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  isOnline: z.boolean().default(false),
  meetingUrl: z.string().url().optional().or(z.literal('')),
}).refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  { message: 'Fin debe ser posterior a inicio', path: ['endTime'] }
);
```

### Uso en Formularios

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, type PatientFormData } from '@/lib/validations/schemas';

function PatientForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  });
  
  const onSubmit = (data: PatientFormData) => {
    createPatient(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Label htmlFor="firstName" required>Nombre</Label>
      <Input
        id="firstName"
        {...register('firstName')}
        error={errors.firstName?.message}
      />
      <Button type="submit">Guardar</Button>
    </form>
  );
}
```

---

## 🔔 WEB PUSH NOTIFICATIONS

### Service Worker

**Ubicación**: `public/sw.js`

Funcionalidades:
- Cache de assets
- Manejo de push notifications
- Background sync (opcional)

### Hook de Push

**Ubicación**: `src/hooks/usePushNotifications.ts`

```tsx
function MyComponent() {
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    requestPermission,
    unsubscribe 
  } = usePushNotifications();
  
  return (
    <div>
      {isSupported && permission !== 'granted' && (
        <Button onClick={requestPermission}>
          Activar Notificaciones
        </Button>
      )}
    </div>
  );
}
```

### Flujo de Activación

1. Usuario hace click en "Activar notificaciones"
2. Browser solicita permiso
3. Si se concede, se suscribe al push service
4. Subscription se envía al backend
5. Backend puede enviar notificaciones

---

## 🚀 INSTALACIÓN Y EJECUCIÓN

### Prerequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

### Instalación

```bash
# Clonar repositorio
cd web

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.local.example .env.local

# Editar .env.local con tus valores
# NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, etc.
```

### Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Build de Producción

```bash
npm run build
npm start
```

### Type Check

```bash
npm run type-check
```

### Lint

```bash
npm run lint
```

---

## 🔐 VARIABLES DE ENTORNO

Archivo `.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Application
NEXT_PUBLIC_APP_NAME=HCX Care
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Web Push (VAPID keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key-here

# Feature Flags (optional)
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DEBUG=true
```

### Generar VAPID Keys

```bash
npm install -g web-push
web-push generate-vapid-keys
```

---

## 📈 MONITOREO: ERRORES Y WEB VITALS (Sentry)

El cliente usa `@sentry/nextjs` (fijado en `^10.x` a propósito: la v11 quitó `sendDefaultPii` y recoge usuario,
cookies y cabeceras; no actualizar sin pasar a `dataCollection`). La configuración vive en `sentry.*.config.ts`
y `src/lib/monitoring/`.

### Errores

`NEXT_PUBLIC_SENTRY_DSN` activa el reporte de errores del navegador y del servidor de Next. Sin DSN, Sentry no
se inicializa. Los errores de Axios no se reportan (la API reporta sus 5xx); no hay replay ni `sendDefaultPii`, y se
descartan los breadcrumbs de interfaz, consola y peticiones.

### Web Vitals de usuarios reales

`NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` es la fracción de cargas de página y navegaciones que se miden, un número
entre 0 y 1. **Por defecto 0 (apagado)**: sin la variable, vacía o con un valor inválido (texto, negativo, mayor que
1, `10%`) el navegador se comporta exactamente como antes. Recomendación inicial: `0.05` a `0.1`. Requiere
`NEXT_PUBLIC_SENTRY_DSN`.

- **`NEXT_PUBLIC_*` se inyecta al compilar**: cambiar la variable (activarla, subirla o apagarla) exige volver a
  construir y desplegar la web; no basta con editarla en Vercel. Para apagarlo: borrar la variable (o ponerla a `0`)
  y redesplegar.
- **Qué se mide:** LCP, FCP, CLS y TTFB como mediciones (`measurements`) de la transacción de carga de página
  (`pageload`); cada navegación entre rutas genera su propia transacción (`navigation`) con su duración (LCP y TTFB
  solo existen en la carga inicial). INP, como un span suelto por interacción. Cada transacción se llama con la ruta
  **parametrizada** de Next: `/patients/:id`, no `/patients/<uuid>`.
- **Qué NO se envía** (`scrubTransaction` y `scrubSpan`, en `src/lib/monitoring/sentry-tracing.ts`, reconstruyen
  cada transacción y cada span desde una lista de campos permitidos; si el filtrado falla, la transacción se
  descarta). Se instalan cuando la variable está definida. Sin ella (tasa 0) tampoco hay transacciones, y no porque
  falte nada que filtrar: `buildSentryOptions`, que comparten navegador, servidor y edge, lleva siempre
  `tracesSampler: () => 0` y `beforeSendTransaction: () => null`. Sin eso el SDK hereda la decisión de muestreo de
  una traza entrante, y un `curl -H 'sentry-trace: <id>-<id>-1'` a la web (o una etiqueta
  `<meta name="sentry-trace">` con `-1`) generaba una transacción sin filtrar, con la URL completa. Se comprobó con el
  SDK real del servidor de `@sentry/nextjs`; en el edge no se pudo reproducir, y la misma opción lo deja cubierto:
  - `request` (cabeceras, cookies, query string, cuerpo): solo queda el origen y la ruta parametrizada de la página;
    nunca un id, la query ni el fragmento (`#`). Un valor que parezca un id (UUID, código, número) se sustituye por
    `:param` aunque ninguna ruta lo haya parametrizado; también las palabras en minúsculas unidas por dos o más
    guiones (`abcd-efgh-jkmn-pqrs`, un código de verificación), salvo las páginas estáticas conocidas
    (`casos-de-exito`, `tratamiento-de-datos`). Los segmentos dinámicos de Next (`:id`, `:slug*`, `[id]`,
    `[...slug]`) se conservan.
  - `user`, `tags`, `extra`, `breadcrumbs` y los contextos de dispositivo y navegador. Sin cabeceras, Sentry no ve el
    `User-Agent`, así que la segmentación por navegador es más limitada.
  - Spans de recursos y de llamadas a la API (llevan la URL completa, con ids y query): se descartan todos; solo
    sobreviven los spans de fases de la carga (`browser.*`), con el nombre de su `op`.
  - Elementos de la interfaz: el nombre del span de INP es el selector del elemento pulsado (puede incluir
    `aria-label`, `title` o `name` con datos de pacientes), así que se sustituye por `ui.interaction.click`. Pero
    ese nombre también viaja en la cabecera `trace` del envelope del span suelto (`trace.transaction`), que el SDK
    calcula desde el span vivo y `beforeSendSpan` no toca (comprobado con el SDK real de Next en jsdom): la
    integración `EnvelopeTraceScrub` reduce la cabecera `trace` de todo envelope a `trace_id`, `public_key`,
    `sample_rate`, `sample_rand`, `sampled`, `release`, `environment` y `org_id`. Los clics
    (`ui.action.click`, la opción `_experiments.enableInteractions`) no se instrumentan, ni tampoco las tareas largas.
  - Atributos de LCP y CLS que nombran elementos o URLs (`lcp.element`, `lcp.url`, `cls.source.*`).
- **Propagación de trazas:** decisión por defecto = **no propagar**, con cualquier tasa, también 0, y en navegador,
  servidor y edge (`tracePropagationTargets: []` en `src/lib/monitoring/sentry-options.ts`; con el valor por defecto
  del SDK se añadían las cabeceras a toda llamada saliente del servidor y al mismo origen en el navegador, aunque la
  traza no estuviera muestreada). Con la tasa activa, además, `traceFetch`/`traceXHR` están desactivados. La web no añade `sentry-trace` ni `baggage` a ninguna petición, ni siquiera
  a la API, y la traza del navegador no se enlaza con la del servidor. Motivos: (1) la API decide el muestreo por sí
  misma con `Math.random()` y no hereda la decisión de la traza entrante (cualquier cliente podría forzar el 100 %
  con esa cabecera o con `sentry-sample_rand=0` en el `baggage`), así que enlazar solo daría trazas a medias; (2) `traceFetch`/`traceXHR` son lo que crearía un span por llamada con la URL
  completa, que se descartaría de todos modos. Con la configuración actual de CORS de la API (`main.ts`: sin
  `allowedHeaders`, así que se reflejan las cabeceras pedidas en el preflight) no haría falta tocar CORS. Para activarlo
  habría que: poner `traceFetch`/`traceXHR` a `true` y `tracePropagationTargets: [<origen de la API>]` en
  `src/lib/monitoring/sentry-browser-options.ts`, hacer que el muestreador de la API respete la decisión entrante de
  forma controlada, y comprobar el preflight real en un Preview.
- **Servidor y edge de Next:** siempre a tasa 0 y sin transacciones, también con la variable definida. El
  rastreo de Web Vitals vive solo en el navegador (`buildBrowserSentryOptions`, que únicamente usa
  `sentry.client.config.ts`); `sentry.server.config.ts` y `sentry.edge.config.ts` usan `buildSentryOptions`, con el
  muestreador `() => 0`. En el navegador, con la variable definida, el muestreador decide con `Math.random() < tasa`
  y devuelve un booleano: ni la decisión ni el `sample_rand` de una traza entrante (etiqueta `<meta>`) pueden subir
  la fracción de páginas muestreadas, y `sample_rate` se reporta como 1 en las trazas muestreadas.
- **Peso:** el SDK de Next ya incluye el código de tracing del navegador aunque no se use. Con la variable sin definir
  en el build no se añade nada: `sentry.client.config.ts` elige las opciones de Web Vitals con
  `process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ? buildBrowserSentryOptions(...) : buildSentryOptions(...)`, y
  `next.config.mjs` define la variable siempre (vacía si falta) para que esa condición sea constante y webpack
  elimine la rama y el módulo `sentry-browser-options` con ella. Medido con `next build` y
  `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_APP_URL` de prueba, «First Load JS shared by all»: **164 kB antes, 164 kB
  después con la variable sin definir** (mismo chunk compartido; el código de Web Vitals no está en ningún chunk),
  168 kB con `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1`, y 168 kB (con el código dentro del bundle) si se quita el
  bloque `env` de `next.config.mjs`: sin la definición la variable no se inlina, la condición deja de ser constante
  y la rama sobrevive. No quitarlo; `sentry-bundle-gating.test.ts` lo vigila.
- **Hallazgo previo, corregido por T4:** con `origin/dev` y `NEXT_PUBLIC_SENTRY_DSN` definido, el muestreo
  forzado por `sentry-trace` ya era posible en el servidor de Next y en el navegador (por la etiqueta `<meta>`).
  Solo ocurre si el DSN está definido: mergear T4, o al menos `tracesSampler` y `beforeSendTransaction` de
  `buildSentryOptions`, antes de definirlo en producción.
- **Sin smoke test real:** los tests usan el SDK real con un transporte en memoria (cliente de Next en jsdom,
  servidor y edge), pero no se ha enviado nada a Sentry y no sustituyen a una verificación en un Preview con un DSN
  de prueba, temporal y solo en esa rama, de una transacción **y** de un error, incluidas las cabeceras del
  envelope. Recomendaciones del lado de Sentry: «Prevent storing of IP addresses», data scrubbing del servidor y
  límites de cuota con *spike protection*.

---

## 📦 DEPLOYMENT

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Variables de entorno en Vercel Dashboard:
- Configurar todas las de `.env.local`
- `NEXT_PUBLIC_API_BASE_URL` apuntando a tu API en producción

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Build y run:

```bash
docker build -t hcx-care-web .
docker run -p 3000:3000 hcx-care-web
```

---

## 🧪 TESTING (TODO)

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

---

## 📊 PERFORMANCE

### Optimizaciones Implementadas

- **Code splitting**: Automatic por Next.js App Router
- **Dynamic imports**: Para FullCalendar (evita SSR issues)
- **Image optimization**: `next/image` ready
- **Font optimization**: `next/font`
- **API caching**: React Query con staleTime
- **Memoization**: En componentes pesados

### Lighthouse Score Target

- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

---

## 🔒 SECURITY

### Implementado

- Token refresh automático
- HTTPS only cookies (configurar en backend)
- XSS protection (React escaping)
- CSRF tokens (implementar en backend)
- Role-based access control (RBAC)
- Tenant isolation

### TODO

- Content Security Policy (CSP)
- Rate limiting (en API)
- Input sanitization adicional
- Audit logs

---

## 📚 RECURSOS ADICIONALES

### Documentación

- [Next.js Docs](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [TailwindCSS](https://tailwindcss.com/)

### Convenciones de Código

- **Componentes**: PascalCase
- **Hooks**: camelCase con prefijo `use`
- **Types**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case para utils, PascalCase para componentes

---

## 🐛 TROUBLESHOOTING

### Error: "Hydration mismatch"

- Asegurar que no hay diferencias entre SSR y cliente
- Usar dynamic imports para componentes solo-cliente

### Error: "Failed to register service worker"

- Verificar que `/sw.js` es accesible
- Revisar headers en `next.config.mjs`

### Error: "Invalid hook call"

- Asegurar que hooks se usan en componentes cliente (`'use client'`)
- Verificar versiones de React

---

## 📄 LICENCIA

Propietario - Todos los derechos reservados

---

**Última actualización**: Febrero 2026
