'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { useProfile, useUpdateProfile, useChangePassword, useUploadAvatar } from '@/hooks/useProfile';
import { ROLE_LABELS, PASSWORD_MIN_LENGTH } from '@/lib/constants';
import { getInitials, formatDate } from '@/lib/utils';
import { hasActiveProfessionalProfile, isProfessionalRole } from '@/types/guards';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Camera,
  Save,
  Award,
  Calendar,
} from 'lucide-react';

// ==========================================
// SCHEMAS
// ==========================================
const profileSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  professionalTitle: z.string().optional(),
  bio: z.string().optional(),
  licenseNumber: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
      .regex(/[A-Z]/, 'Debe contener una mayúscula')
      .regex(/[a-z]/, 'Debe contener una minúscula')
      .regex(/[0-9]/, 'Debe contener un número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ==========================================
// MAIN PAGE
// ==========================================
export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName || user?.firstName || '',
      lastName: profile?.lastName || user?.lastName || '',
      phone: profile?.phone || user?.phone || '',
      professionalTitle: profile?.professionalProfile?.professionalTitle || profile?.professionalTitle || '',
      bio: profile?.professionalProfile?.bio ?? profile?.bio ?? '',
      licenseNumber: profile?.professionalProfile?.licenseNumber || profile?.licenseNumber || '',
    },
    values: profile
      ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone || '',
          professionalTitle: profile.professionalProfile?.professionalTitle || profile.professionalTitle || '',
          bio: profile.professionalProfile?.bio ?? profile.bio ?? '',
          licenseNumber: profile.professionalProfile?.licenseNumber || profile.licenseNumber || '',
        }
      : undefined,
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmitProfile = (data: ProfileFormData) => {
    const currentProfessionalProfile = profile?.professionalProfile ?? user?.professionalProfile;
    updateProfile.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      ...(currentProfessionalProfile
        ? {
            professionalProfile: {
              professionalTitle: data.professionalTitle,
              licenseNumber: data.licenseNumber,
              bio: data.bio,
            },
          }
        : {}),
    });
  };

  const onSubmitPassword = (data: ChangePasswordFormData) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          setPasswordDialogOpen(false);
          resetPasswordForm();
        },
      }
    );
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return; // Max 5MB — could show toast
      }
      uploadAvatar.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeUser = profile ?? user;
  const isProfessional = activeUser ? isProfessionalRole(activeUser.role) || hasActiveProfessionalProfile(activeUser) : false;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          Mi Perfil
        </h1>
        <p className="text-muted-foreground">Gestiona tu información personal y preferencias</p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar
                src={user?.avatarUrl}
                fallback={user ? getInitials(user.firstName, user.lastName) : '??'}
                className="h-24 w-24 text-2xl"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Seleccionar foto de perfil"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge>
                  <Shield className="h-3 w-3 mr-1" />
                  {user?.role ? ROLE_LABELS[user.role] : 'Usuario'}
                </Badge>
                {user?.emailVerified && (
                  <Badge variant="secondary" className="text-green-600">
                    ✓ Email verificado
                  </Badge>
                )}
              </div>
              {user?.lastLogin && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Último acceso: {formatDate(user.lastLogin)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmitProfile)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
            <CardDescription>Actualiza tu información de contacto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  error={errors.firstName?.message}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  error={errors.lastName?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  El email no se puede cambiar desde aquí.
                </p>
              </div>
              <div>
                <Label htmlFor="phone">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="+52 55 1234 5678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info */}
        {isProfessional && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Información Profesional
              </CardTitle>
              <CardDescription>
                Datos profesionales visibles para otros miembros del equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="professionalTitle">Título Profesional</Label>
                  <Input
                    id="professionalTitle"
                    {...register('professionalTitle')}
                    placeholder="Ej: Médico general"
                  />
                </div>
                <div>
                  <Label htmlFor="licenseNumber">Número de Cédula/Licencia</Label>
                  <Input
                    id="licenseNumber"
                    {...register('licenseNumber')}
                    placeholder="Ej: 12345678"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Biografía</Label>
                <Textarea
                  id="bio"
                  {...register('bio')}
                  placeholder="Escribe una breve descripción sobre ti y tu práctica profesional..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-between items-center mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <Key className="h-4 w-4 mr-2" />
            Cambiar Contraseña
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || updateProfile.isPending}
            loading={updateProfile.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </form>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu contraseña actual y la nueva contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit(onSubmitPassword)} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Contraseña Actual</Label>
              <Input
                id="currentPassword"
                type="password"
                {...registerPassword('currentPassword')}
                error={passwordErrors.currentPassword?.message}
              />
            </div>
            <div>
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                {...registerPassword('newPassword')}
                error={passwordErrors.newPassword?.message}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mínimo {PASSWORD_MIN_LENGTH} caracteres, una mayúscula, una minúscula y un número.
              </p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...registerPassword('confirmPassword')}
                error={passwordErrors.confirmPassword?.message}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={changePassword.isPending}
                loading={changePassword.isPending}
              >
                Cambiar Contraseña
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
