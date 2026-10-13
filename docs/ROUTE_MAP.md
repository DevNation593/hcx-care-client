# ROUTE MAP - HCX Care

## Complete Application Routes

### Public Routes (No Authentication)

```
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC ROUTES                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /                                                            │
│  └─ Redirect to /dashboard (if auth) or /login              │
│                                                               │
│  /login                                                       │
│  └─ User login page                                          │
│     Components: LoginForm                                    │
│     Layout: (auth) - Centered card, no sidebar              │
│                                                               │
│  /forgot-password (TODO)                                     │
│  └─ Password recovery                                        │
│                                                               │
│  /reset-password (TODO)                                      │
│  └─ Password reset with token                                │
│                                                               │
│  /onboarding                                                  │
│  └─ Redirects to /contacto (public sign-up is closed;         │
│     clinics are created by the platform ADMIN in /platform)  │
│                                                               │
│  /change-password                                             │
│  └─ Forced password change (users with mustChangePassword)   │
│     Any signed-in user; leaves for their home route after    │
│     the change                                                │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Private Routes (Authentication Required)

```
┌─────────────────────────────────────────────────────────────┐
│  PRIVATE ROUTES - Main Application                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layout: (dashboard)                                         │
│  ├─ Sidebar navigation                                       │
│  ├─ Header with notifications, profile                      │
│  └─ Notifications panel (slide-in)                          │
│                                                               │
│  /dashboard                                                   │
│  └─ Main dashboard                                           │
│     Widgets:                                                 │
│       - Stats cards (appointments, tasks, patients)          │
│       - Today's appointments list                            │
│       - Overdue tasks list                                   │
│       - Quick actions                                        │
│     Roles: ALL                                               │
│                                                               │
│  /calendar                                                    │
│  └─ Calendar view with appointments                          │
│     Features:                                                │
│       - FullCalendar integration                             │
│       - Month/Week/Day views                                 │
│       - Drag-drop reschedule                                 │
│       - Create appointment dialog                            │
│       - Event click to view details                          │
│     Roles: ALL                                               │
│                                                               │
│  /patients                                                    │
│  ├─ Patients list page                                       │
│  │   Features:                                               │
│  │     - Search and filters                                  │
│  │     - Sortable table                                      │
│  │     - Pagination                                          │
│  │     - Quick actions (view, edit)                          │
│  │   Roles: ALL                                              │
│  │                                                            │
│  ├─ /new                                                      │
│  │   └─ Create new patient form                              │
│  │       Fields: Name, contact, DOB, emergency contact        │
│  │       Roles: MASTER, PROFESIONAL                          │
│  │                                                            │
│  └─ /[id]                                                     │
│      └─ Patient detail page                                  │
│          Tabs:                                               │
│            - Overview (basic info, assigned psychologist)    │
│            - Clinical History (notes, RBAC protected)        │
│            - Appointments (past and upcoming)                │
│            - Tasks                                           │
│            - Session Plan                                    │
│          Roles: ALL (with RBAC per section)                  │
│                                                               │
│  /notifications (implemented as panel)                       │
│  └─ Slide-in panel from header bell icon                    │
│     Features:                                                │
│       - Unread count badge                                   │
│       - Mark as read                                         │
│       - Mark all as read                                     │
│       - Web push settings toggle                             │
│     Roles: ALL                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Admin Routes (solo MASTER y SOPORTE)

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN ROUTES                                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /admin/team                                                  │
│  └─ Team management                                          │
│     Features:                                                │
│       - Users list (professionals, assistants)               │
│       - Invite user dialog                                   │
│       - Deactivate user                                      │
│       - Seats usage alert                                    │
│       - Role assignment                                      │
│     RBAC: solo MASTER (y SOPORTE)                            │
│                                                               │
│  /admin/subscription                                         │
│  └─ Subscription and billing                                 │
│     Features:                                                │
│       - Current plan details                                 │
│       - Usage metrics (seats, patients, storage)             │
│       - Available plans comparison                           │
│       - Upgrade flow (with payment - TODO)                   │
│       - Billing history (TODO)                               │
│     RBAC: solo MASTER (y SOPORTE)                            │
│                                                               │
│  /admin/settings                                             │
│  └─ Clinic settings                                          │
│     Settings:                                                │
│       - Working hours per day                                │
│       - Default session duration                             │
│       - Reminder rules (Email, SMS, Push)                    │
│       - Timezone and locale                                  │
│       - Clinic branding (TODO)                               │
│     RBAC: solo MASTER (y SOPORTE)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Platform Routes (solo ADMIN)

Layout `(platform)`: the platform administrator's panel. After login the `ADMIN`
lands on `/platform`; any other role is sent back to its own home route.

```
/platform                       Resumen de la plataforma
/platform/tenants               Lista de consultorios
/platform/tenants/new           Alta de un consultorio y de su MASTER
/platform/tenants/[tenantId]    Detalle: datos, plan, secciones, suspensión, contraseña
/platform/payments              Pagos de suscripción (confirmar o rechazar)
```

Clinics are created only from `/platform/tenants/new`; there is no public sign-up.

### Profile Routes (TODO)

```
┌─────────────────────────────────────────────────────────────┐
│  PROFILE ROUTES                                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /profile                                                     │
│  └─ User profile page                                        │
│     Features:                                                │
│       - Edit personal info                                   │
│       - Change password                                      │
│       - Upload avatar                                        │
│       - Professional info (for psychologists)                │
│       - Notification preferences                             │
│     Roles: ALL                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Route Protection Strategy

### Layout-Based Protection

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);
  
  // Render sidebar, header, etc.
}
```

### Component-Level RBAC

```typescript
// In components
import { canManageUsers } from '@/types/guards';

const user = useAuthStore((state) => state.user);

// Conditional rendering
{user && canManageUsers(user) && (
  <Link href="/admin/team">Gestionar Equipo</Link>
)}

// Page-level redirect
if (user && !canManageUsers(user)) {
  router.replace('/dashboard');
}
```

## Dynamic Routes

### Patient Detail: `/patients/[id]`

```typescript
// File: app/(dashboard)/patients/[id]/page.tsx

interface Props {
  params: { id: string };
}

export default function PatientDetailPage({ params }: Props) {
  const { data: patient } = usePatient(params.id);
  // ...
}
```

## API Route Mapping

### Frontend Routes → API Endpoints

| Frontend Route | API Endpoint(s) | Method |
|----------------|-----------------|--------|
| `/login` | `/api/v1/auth/login` | POST |
| `/dashboard` | `/api/v1/dashboard/stats` | GET |
| `/calendar` | `/api/v1/appointments` | GET |
| `/calendar` (create) | `/api/v1/appointments` | POST |
| `/patients` | `/api/v1/patients` | GET |
| `/patients/new` | `/api/v1/patients` | POST |
| `/patients/[id]` | `/api/v1/patients/:id` | GET |
| `/admin/team` | `/api/v1/users` | GET, POST |
| `/admin/subscription` | `/api/v1/subscription` | GET |
| `/admin/subscription` | `/api/v1/plans` | GET |

## Navigation Flow

### New Clinic Journey

```
1. Visitor opens the public site
   │
2. /contacto → "Solicitar demo"
   │
3. The platform ADMIN creates the clinic in /platform/tenants/new
   │
4. The clinic MASTER logs in with the temporary password
   │
5. /change-password (forced)
   │
6. Redirect to /dashboard
```

### Daily User Journey

```
1. Visit site / /login
   │
2. Login
   │
3. /dashboard
   ├─ View today's appointments
   ├─ Check overdue tasks
   └─ Quick actions
   │
4. Navigate to /patients
   │
5. Click patient → /patients/[id]
   │
6. View patient details
   │
7. Create appointment → Dialog in /calendar
```

### Admin Journey

```
1. /dashboard
   │
2. Navigate to /admin/team
   │
3. Check seats usage
   │
4. Invite new psychologist
   │
5. Navigate to /admin/subscription
   │
6. Review usage metrics
   │
7. Consider upgrade (if near limits)
   │
8. Navigate to /admin/settings
   │
9. Configure working hours, reminders
```

## Sidebar Navigation Items

```javascript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
  { name: 'Calendario', href: '/calendar', icon: Calendar, show: true },
  { name: 'Pacientes', href: '/patients', icon: Users, show: true },
];

const adminNavigation = [
  { name: 'Equipo', href: '/admin/team', icon: UserCog, show: canManageUsers(user) },
  { name: 'Suscripción', href: '/admin/subscription', icon: CreditCard, show: canManageSubscription(user) },
  { name: 'Configuración', href: '/admin/settings', icon: Settings, show: canManageUsers(user) },
];
```

## Breadcrumb Examples

```
Dashboard > Pacientes > Juan Pérez
Dashboard > Calendario
Dashboard > Admin > Equipo
Dashboard > Admin > Suscripción
```

## Sitio público

Rutas del grupo `(marketing)`, accesibles sin sesión:

```
/                       Página principal
/planes                 Planes y precios
/como-funciona          Recorrido paso a paso
/casos-de-exito         Solo existe cuando hay casos cargados (si no, 404)
/nosotros               Equipo y ubicación
/contacto               Formulario de solicitud de demo
/gracias                Confirmación tras el formulario (no indexada)
/terminos               Términos y condiciones
/privacidad             Política de privacidad
/cookies                Política de cookies
/tratamiento-de-datos   Política de tratamiento de datos
/robots.txt, /sitemap.xml
```

El contenido editable vive en `src/content/site.ts`: datos de contacto, promesa de
respuesta, planes, preguntas frecuentes, reseñas, casos de éxito, equipo, ubicación y
datos del responsable legal. Reseñas, casos, equipo y ubicación no se muestran mientras
estén vacíos. Las páginas legales llevan aviso de borrador y `noindex` hasta que
`legal.reviewed` sea `true`.

## Future Routes (Roadmap)

```
/reports/psychologist-performance
/reports/appointment-stats
/reports/financial
/integrations/google-calendar
/integrations/zoom
/api-docs (for custom plan users)
```

---

**Total Routes**: 12+ implemented, 8+ planned  
**Protected Routes**: All except /login and the public site (/onboarding redirects to /contacto)  
**RBAC Routes**: 3 (admin area)  
**Dynamic Routes**: 1 (`/patients/[id]`)
