# 🚀 GETTING STARTED - HCX Care

This guide will help you set up and run the HCX Care frontend for the first time.

## 📋 Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js** version 18.0.0 or higher installed
  ```bash
  node --version  # Should be >= 18.0.0
  ```

- [ ] **npm** version 9.0.0 or higher installed
  ```bash
  npm --version  # Should be >= 9.0.0
  ```

- [ ] **Git** installed
  ```bash
  git --version
  ```

- [ ] **Backend API** running (check backend repository)
  - Default: `http://localhost:3001/api/v1`

- [ ] Code editor (VS Code recommended)

## 📦 Installation Steps

### Step 1: Clone and Navigate

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the web frontend
cd web
```

### Step 2: Install Dependencies

```bash
# Install all project dependencies
npm install

# This will install:
# - Next.js, React, TypeScript
# - TailwindCSS
# - Zustand, TanStack Query
# - FullCalendar
# - and more...
```

**Expected time**: 2-5 minutes depending on your internet connection.

### Step 3: Environment Configuration

```bash
# Copy the example environment file
cp .env.local.example .env.local
```

**Edit `.env.local`** with your actual values:

```bash
# Required: Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1

# Required for Web Push (see below for generation)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-actual-vapid-key

# Optional but recommended
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEBUG=true
```

#### Generate VAPID Keys (for Web Push)

```bash
# Install web-push CLI globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys

# Output will be:
# Public Key: BNxxx...
# Private Key: xxx...

# Copy the PUBLIC KEY to .env.local
# Share the PRIVATE KEY with backend team
```

### Step 4: Verify Backend Connection

**Before starting the frontend**, ensure your backend is running and accessible:

```bash
# Test backend health endpoint
curl http://localhost:3001/api/v1/health

# Expected response: 
# {"status":"ok","timestamp":"2024-XX-XX..."}
```

If this fails, start your backend API first (see backend repository).

### Step 5: Start Development Server

```bash
npm run dev
```

**Expected output**:
```
> next dev --turbo

  ▲ Next.js 14.2.x
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.3s
```

### Step 6: Open in Browser

Navigate to: **http://localhost:3000**

You should see the **Login page**.

## 🎬 First Run: Create a Clinic

Since this is your first run, you need to create a clinic:

### Onboarding Flow

1. **Click** "Crear nueva clínica" on the login page

2. **Step 1 - Clinic Information**
   - Clinic Name: e.g., "Centro Psicológico Salud Mental"
   - Email: clinic@example.com
   - Phone: +34 600 123 456
   - Address (optional)

3. **Step 2 - Admin Profile**
   - First Name: Juan
   - Last Name: Pérez
   - Email: admin@clinic.com
   - Password: ********
   - Confirm Password: ********

4. **Step 3 - Invite Team** (optional)
   - Skip for now or invite team members
   - You can do this later from Admin > Team

5. **Step 4 - Completion**
   - Review and submit

6. **Auto-login**
   - You'll be automatically logged in
   - Redirected to the Dashboard

## 🧭 Exploring the Application

After logging in, you'll see:

### Dashboard (`/dashboard`)

- **Stats cards**: Appointments, tasks, patients count
- **Today's appointments**: List of today's scheduled sessions
- **Overdue tasks**: Tasks that need attention
- **Quick actions**: Shortcuts to common tasks

### Main Navigation (Sidebar)

| Icon | Section | What you can do |
|------|---------|-----------------|
| 📊 | Dashboard | Overview and stats |
| 📅 | Calendar | Manage appointments |
| 👤 | Patients | Patient records |
| ⚙️ | Admin | Team, subscription, settings (MASTER only) |

### Try These Actions

1. **Create a Patient**
   - Go to "Pacientes" → Click "Nuevo Paciente"
   - Fill in patient details
   - Submit

2. **Create an Appointment**
   - Go to "Calendario"
   - Click on a time slot
   - Select patient and psychologist
   - Choose online/in-person
   - Save

3. **Enable Web Push Notifications**
   - Click the bell icon in the header
   - Click "Activar notificaciones push"
   - Allow browser permission

4. **Invite Team Member** (if you're MASTER)
   - Go to "Admin" → "Equipo"
   - Click "Invitar Usuario"
   - Enter email, name, role
   - Send invitation

## 🛠️ Development Workflow

### Code Structure

```
src/
├── app/              # Routes (Next.js App Router)
├── components/       # Reusable UI components
├── features/         # Feature modules (calendar, patients, etc.)
├── hooks/            # Custom React hooks (useAuth, usePatients, etc.)
├── lib/              # Utilities, API client, constants
├── store/            # Zustand stores (auth, UI state)
└── types/            # TypeScript types and DTOs
```

### Making Changes

#### Example: Add a New Field to Patient Form

1. **Update Types** (`src/types/index.ts`):
   ```typescript
   export interface Patient {
     // ... existing fields
     occupation?: string;  // Add this
   }
   ```

2. **Update Zod Schema** (`src/lib/validations/schemas.ts`):
   ```typescript
   export const patientSchema = z.object({
     // ... existing fields
     occupation: z.string().optional(),
   });
   ```

3. **Update Form** (`src/app/(dashboard)/patients/new/page.tsx`):
   ```tsx
   <Input
     {...register('occupation')}
     placeholder="Ocupación"
   />
   ```

4. **Verify Type Safety**:
   ```bash
   npm run type-check
   ```

### Hot Reload

Changes to code will automatically reload in the browser (no need to restart server).

**Exception**: Changes to `.env.local` require a restart:

```bash
# Stop server: Ctrl+C
npm run dev  # Restart
```

## 🔍 Troubleshooting

### Issue: "Cannot connect to API"

**Symptoms**: Login fails, data doesn't load

**Solution**:
1. Check backend is running: `curl http://localhost:3001/api/v1/health`
2. Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
3. Check browser console for CORS errors

### Issue: "Hydration mismatch"

**Symptoms**: React error about server/client mismatch

**Solution**:
- This is usually from FullCalendar (already fixed with dynamic import)
- Clear `.next` folder: `rm -rf .next` then `npm run dev`

### Issue: "Module not found"

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Service Worker not registering"

**Symptoms**: Web Push doesn't work

**Solution**:
1. Ensure HTTPS (or localhost)
2. Check browser console for SW errors
3. Verify `/sw.js` is accessible: `http://localhost:3000/sw.js`

### Issue: "Type errors"

**Solution**:
```bash
# Run type check
npm run type-check

# Fix any reported errors
# Most common: missing imports, wrong types
```

## 📚 Next Steps

Now that you're set up:

1. **Read the Documentation**
   - [DOCUMENTATION.md](./DOCUMENTATION.md) - Full technical documentation
   - [ROUTE_MAP.md](./ROUTE_MAP.md) - All routes and navigation

2. **Explore the Codebase**
   - Start with `src/app/(dashboard)/dashboard/page.tsx` - Dashboard implementation
   - Look at `src/hooks/useAuth.ts` - Authentication logic
   - Review `src/components/ui/` - Reusable components

3. **Try Building a Feature**
   - Add a new field to patient form
   - Create a custom dashboard widget
   - Add a new filter to patients list

4. **Learn the Patterns**
   - How components are structured
   - How API calls are made (React Query)
   - How forms are validated (Zod + React Hook Form)

## 🎓 Learning Resources

### Next.js
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

### React Query (TanStack Query)
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- Focus on: `useQuery`, `useMutation`, `invalidateQueries`

### Zustand
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Persist Middleware](https://github.com/pmndrs/zustand#persist-middleware)

### Forms
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

## 🆘 Getting Help

If you're stuck:

1. **Check the docs**: [DOCUMENTATION.md](./DOCUMENTATION.md)
2. **Search the codebase**: Use VS Code search (Ctrl+Shift+F)
3. **Check browser console**: Look for errors
4. **Review the route map**: [ROUTE_MAP.md](./ROUTE_MAP.md)
5. **Ask the team**: Create an issue or ask in team chat

## ✅ Verification Checklist

Before starting development, verify:

- [ ] `npm run dev` starts without errors
- [ ] Login page loads at `http://localhost:3000`
- [ ] You can create a clinic via onboarding
- [ ] Dashboard loads after login
- [ ] You can navigate between pages
- [ ] API calls work (open Network tab in browser DevTools)
- [ ] `npm run type-check` passes with no errors
- [ ] Hot reload works (make a change, see it update)

## 🎉 You're Ready!

You now have:
- ✅ A running development environment
- ✅ A functional clinic with admin account
- ✅ Knowledge of key features
- ✅ Resources to learn more

**Happy coding!** 🚀

---

**Need backend setup?** Check the backend repository for API setup instructions.
