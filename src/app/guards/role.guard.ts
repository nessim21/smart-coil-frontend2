import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '../services/role.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (route, state) => {
    const roleService = inject(RoleService);
    const router = inject(Router);

    const activeRole = roleService.getActiveRole();
    
    if (!activeRole) {
      router.navigate(['/login']);
      return false;
    }

    if (allowedRoles.includes(activeRole)) {
      return true;
    }

    // Rediriger vers une page d'accès non autorisé ou le dashboard
    router.navigate(['/dashboard']);
    return false;
  };
};
