# HCX Care - Frontend

> Multi-tenant SaaS platform for health clinics and private practices, empowering health professionals with appointment management, patient records, and comprehensive practice management tools.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your API URL and keys

# Run development server
npm run dev
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Environment Variables](#environment-variables)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

## ✨ Features

### Core Functionality

- 🏥 **Multi-Tenancy**: Clinic/practice as tenant with data isolation
- 👥 **Team Management**: RBAC with roles (Admin, Psychologist, Assistant)
- 📅 **Calendar & Appointments**: FullCalendar integration with drag-drop
- 👤 **Patient Management**: Comprehensive patient records and history
- 🔔 **Notifications**: Web Push + in-app notification center
- 💳 **Subscription Plans**: Seat-based pricing (Basic, Pro, Custom)

### User Experience

- 🎨 Modern, responsive UI with TailwindCSS
- 🌙 Professional design with consistent styling
- ⚡ Fast navigation with Next.js App Router
- 📱 Mobile-friendly interface
- ♿ Accessibility-focused components
- 🌍 Spanish localization (extensible to other languages)

### Technical Features

- 🔐 JWT authentication with auto-refresh
- 🎯 Type-safe development with TypeScript
- 🧪 Form validation with Zod schemas
- 📡 Optimistic updates and cache management
- 🔄 Real-time updates with WebSocket (ready)
- 📦 Clean architecture with separation of concerns

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | TailwindCSS |
| **State Management** | Zustand |
| **Data Fetching** | TanStack Query (React Query) |
| **Forms** | React Hook Form + Zod |
| **Calendar** | FullCalendar |
| **HTTP Client** | Axios |
| **Notifications** | Web Push API + Sonner (toasts) |
| **Icons** | Lucide React |

## 📁 Project Structure

```
web/
├── public/
│   └── sw.js                    # Service Worker for Web Push
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/             # Auth routes (login)
│   │   ├── (dashboard)/        # Dashboard routes
│   │   └── onboarding/         # Onboarding wizard
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   └── layout/             # Layout components
│   ├── features/               # Feature-specific modules
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── api/                # API client and endpoints
│   │   └── validations/        # Zod schemas
│   ├── store/                  # Zustand stores
│   └── types/                  # TypeScript types
├── .env.local.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

For a complete folder structure explanation, see [DOCUMENTATION.md](./DOCUMENTATION.md).

## 🎯 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Backend API** running (see backend repository)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd web
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-vapid-public-key>
# ... other variables
```

To generate VAPID keys:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

4. **Run development server**

```bash
npm run dev
```

Visit [http://localhost:4200](http://localhost:4200)

### First Login

**Option A: Onboarding** (Create new clinic)

1. Go to `/login`
2. Click "Crear nueva clínica"
3. Complete the 4-step wizard:
   - Clinic information
   - Admin profile
   - Invite team (optional)
   - Completion
4. Auto-login to dashboard

**Option B: Existing User**

1. Go to `/login`
2. Enter credentials provided by clinic admin
3. Access dashboard

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (with turbo) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler check |
| `npm test` | Run the Vitest unit test suite |
| `npm run test:watch` | Run Vitest in watch mode |

Quality checks:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

## 🔐 Environment Variables

All environment variables are documented in [.env.local.example](./.env.local.example).

**Required:**

- `NEXT_PUBLIC_API_BASE_URL`: Backend API URL
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: VAPID key for Web Push

**Optional:**

- `NEXT_PUBLIC_WS_URL`: WebSocket URL for real-time features
- `NEXT_PUBLIC_ENABLE_DEBUG`: Enable debug logs
- `NEXT_PUBLIC_GA_ID`: Google Analytics ID

## 📚 Documentation

- **[DOCUMENTATION.md](./DOCUMENTATION.md)**: Complete technical documentation
  - Architecture overview
  - Folder structure explained
  - Component library
  - Data layer
  - Zod schemas
  - Web Push setup

- **[ROUTE_MAP.md](./ROUTE_MAP.md)**: Complete route documentation
  - All routes with descriptions
  - RBAC permissions
  - Navigation flow
  - API endpoint mapping

## 🔧 Development

### Code Style

- **Components**: PascalCase (`PatientList.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.ts`)
- **Utils**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`User`, `Appointment`)
- **Constants**: UPPER_SNAKE_CASE (`API_ROUTES`)

### Component Pattern

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { usePatients } from '@/hooks/usePatients';

export function PatientsList() {
  const { data, isLoading } = usePatients();

  if (isLoading) return <SkeletonTable />;

  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

### Adding a New Feature

1. **Create types** in `/src/types/index.ts`
2. **Add API endpoints** in `/src/lib/api/endpoints.ts`
3. **Create Zod schema** in `/src/lib/validations/schemas.ts`
4. **Build React Query hook** in `/src/hooks/useYourFeature.ts`
5. **Create UI components** in `/src/components/ui/` or `/src/features/`
6. **Add page/route** in `/src/app/`
7. **Update navigation** in `/src/components/layout/sidebar.tsx`

### Type Safety

All API responses, forms, and state are strongly typed. Never use `any`.

```typescript
// ✅ Good
const { data } = useQuery<ApiResponse<Patient[]>>({ ... });

// ❌ Bad
const { data } = useQuery<any>({ ... });
```

### Form Validation

Always use Zod schemas with React Hook Form:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema, type PatientFormData } from '@/lib/validations/schemas';

const { register, handleSubmit, formState: { errors } } = useForm<PatientFormData>({
  resolver: zodResolver(patientSchema),
});
```

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set environment variables in Vercel Dashboard.

### Docker

```bash
docker build -t hcx-care-web .
docker run -p 4200:4200 hcx-care-web
```

### Build Output

```bash
npm run build
# Output in .next/

npm start
# Runs production server
```

## 🧪 Testing

The unit-test baseline uses Vitest, jsdom, and React Testing Library.

- Implemented: unit tests (Vitest + React Testing Library)
- Planned: integration tests (Playwright)
- Planned: E2E tests (Playwright)

## 🔒 Security

- ✅ JWT with automatic refresh
- ✅ RBAC with type guards
- ✅ XSS protection (React escaping)
- ✅ Tenant isolation
- ⏳ CSP headers (configure in `next.config.mjs`)
- ⏳ CSRF tokens (implement in backend)

## 📊 Performance

Current optimizations:

- Code splitting (automatic by Next.js)
- Dynamic imports for heavy components
- React Query caching with `staleTime`
- Image optimization ready (`next/image`)
- Font optimization (`next/font`)

Target Lighthouse scores: 90+ across all metrics.

## 🗺️ Roadmap

- [ ] Patient detail page with tabs
- [ ] Clinical notes CRUD
- [ ] Tasks management
- [ ] Reports and analytics
- [ ] Billing and invoices
- [ ] Email/SMS reminders
- [ ] Video call integration
- [ ] Dark mode
- [ ] Multi-language support
- [ ] Mobile app (React Native)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Proprietary - All rights reserved.

## 🆘 Support

For issues or questions:

- Check [DOCUMENTATION.md](./DOCUMENTATION.md)
- Check [ROUTE_MAP.md](./ROUTE_MAP.md)
- Review troubleshooting section in docs
- Open an issue in the repository

## 👏 Acknowledgments

Built with modern web technologies:

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://github.com/pmndrs/zustand)
- [TailwindCSS](https://tailwindcss.com/)

---

**Made with ❤️ for mental health professionals**

