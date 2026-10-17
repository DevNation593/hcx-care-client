'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useSections } from '@/hooks/useSections';
import { useMyPermissions } from '@/hooks/usePermissions';
import { canManageUsers, canManageSubscription, isMasterRole, isProfessionalRole } from '@/types/guards';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Users,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCog,
  CreditCard,
  FileText,
  Settings,
  HardDrive,
  ClipboardList,
  LayoutGrid,
  ListChecks,
  Stethoscope,
  BarChart3,
  Syringe,
  FileSignature,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  show: boolean;
}

/** A module groups several screens as submodules; one with a single screen is a plain entry. */
interface NavModule {
  name: string;
  icon: LucideIcon;
  items: NavItem[];
}

type NavEntry = NavItem | NavModule;

const isModule = (entry: NavEntry): entry is NavModule => 'items' in entry;

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { isEnabled } = useSections();
  const { can } = useMyPermissions();
  const [closedModules, setClosedModules] = useState<string[]>([]);

  const managesUsers = !!user && canManageUsers(user);
  const managesSubscription = !!user && canManageSubscription(user);
  const isMaster = !!user && isMasterRole(user.role);

  const navigation: NavEntry[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
    {
      name: 'Agenda',
      icon: CalendarDays,
      items: [
        { name: 'Calendario', href: '/calendar', icon: Calendar, show: isEnabled('core.calendar') },
        { name: 'Actividades', href: '/tasks', icon: ClipboardList, show: isEnabled('core.tasks') },
      ],
    },
    { name: 'Pacientes', href: '/patients', icon: Users, show: isEnabled('core.patients') },
    {
      name: 'Clínica',
      icon: Stethoscope,
      items: [
        { name: 'Módulos clínicos', href: '/admin/specialties', icon: LayoutGrid, show: isEnabled('core.specialties') && managesUsers },
        { name: 'Formularios', href: '/admin/forms', icon: ListChecks, show: isEnabled('core.specialties') && managesSubscription },
        { name: 'Tratamientos', href: '/admin/treatments', icon: Syringe, show: isEnabled('core.specialties') && can('treatments.manage', isMaster) },
        { name: 'Consentimientos', href: '/admin/consents', icon: FileSignature, show: isEnabled('core.specialties') && can('treatments.manage', isMaster) },
      ],
    },
    { name: 'Facturación', href: '/admin/billing', icon: FileText, show: isEnabled('core.billing') && can('billing.view', user ? isMasterRole(user.role) || isProfessionalRole(user.role) : false) },
    {
      name: 'Administración',
      icon: Building2,
      items: [
        { name: 'Equipo', href: '/admin/team', icon: UserCog, show: isEnabled('core.team') && managesUsers },
        { name: 'Reportes', href: '/admin/reports', icon: BarChart3, show: isEnabled('core.calendar') && isMaster },
        { name: 'Suscripción', href: '/admin/subscription', icon: CreditCard, show: managesSubscription },
        { name: 'Almacenamiento', href: '/admin/storage', icon: HardDrive, show: isEnabled('core.storage') && managesUsers },
        { name: 'Configuración', href: '/admin/settings', icon: Settings, show: managesUsers },
      ],
    },
  ];

  // A module is listed only while it has a submodule to open.
  const visibleNavigation = navigation
    .map((entry) => (isModule(entry) ? { ...entry, items: entry.items.filter((item) => item.show) } : entry))
    .filter((entry) => (isModule(entry) ? entry.items.length > 0 : entry.show));

  const toggleModule = (name: string) =>
    setClosedModules((closed) =>
      closed.includes(name) ? closed.filter((module) => module !== name) : [...closed, name],
    );

  const renderLink = (item: NavItem, isSubmodule = false) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;

    return (
      <Link
        key={item.name}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          sidebarCollapsed && 'justify-center'
        )}
        title={sidebarCollapsed ? item.name : undefined}
      >
        <Icon className={cn('shrink-0', isSubmodule && !sidebarCollapsed ? 'h-4 w-4' : 'h-5 w-5')} />
        {!sidebarCollapsed && <span>{item.name}</span>}
      </Link>
    );
  };

  const renderModule = (module: NavModule) => {
    // The icon rail has no room for headers: it lists the submodules between two rules.
    if (sidebarCollapsed) {
      return (
        <div key={module.name} role="group" aria-label={module.name} className="space-y-1 border-y py-1">
          {module.items.map((item) => renderLink(item, true))}
        </div>
      );
    }

    const Icon = module.icon;
    const isOpen = !closedModules.includes(module.name);
    const holdsCurrentPage = module.items.some((item) => item.href === pathname);

    return (
      <div key={module.name} role="group" aria-label={module.name} className="space-y-1">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleModule(module.name)}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted hover:text-foreground',
            // A closed module still shows that the current page is inside it.
            !isOpen && holdsCurrentPage ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{module.name}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', !isOpen && '-rotate-90')} />
        </button>
        {isOpen && (
          <div className="ml-5 space-y-1 border-l pl-2">
            {module.items.map((item) => renderLink(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-card border-r transition-all duration-300 shrink-0',
        sidebarCollapsed
          ? 'hidden md:flex md:w-16'
          : 'fixed inset-y-0 left-0 z-50 flex w-64 shadow-xl md:static md:shadow-none'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <LogoMark />
            <div>
              <p className="font-semibold text-sm">{tenant?.name || 'Clínica'}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(sidebarCollapsed && 'mx-auto')}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleNavigation.map((entry) => (isModule(entry) ? renderModule(entry) : renderLink(entry)))}
      </nav>

      {/* User Info */}
      {!sidebarCollapsed && user && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
