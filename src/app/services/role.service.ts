import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface JwtPayload {
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string[];
  exp?: number;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string;
}

export interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

export interface Role {
  id: number;
  nomRole: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly apiUrl = `${environment.roleApiUrl}/Roles`;
  private readonly navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard',
      roles: ['ADMIN']
    },
    {
      label: 'Mon Espace',
      icon: 'engineering',
      route: '/operateur-dashboard',
      roles: ['OPERATEUR_MACHINE']
    },
    {
      label: 'Espace Alimentateur',
      icon: 'local_shipping',
      route: '/alimentateur-dashboard',
      roles: ['ALIMENTATEUR']
    },
    {
      label: 'Utilisateurs',
      icon: 'people',
      route: '/utilisateurs',
      roles: ['ADMIN']
    },
    {
      label: 'Zones',
      icon: 'location_on',
      route: '/zones',
      roles: ['ADMIN']
    },
    {
      label: 'Grille de stockage',
      icon: 'grid_view',
      route: '/stock-grid',
      roles: ['ADMIN', 'ALIMENTATEUR']
    },
    {
      label: 'Bobines',
      icon: 'radio_button_checked',
      route: '/bobines',
      roles: ['ADMIN']
    },
        {
      label: 'Ordres de travail',
      icon: 'clipboard-list',
      route: '/ordres-travail',
      roles: ['ADMIN']
    },
    {
      label: 'Demandes',
      icon: 'request_quote',
      route: '/demandes',
      roles: ['ADMIN']
    }
  ];

  constructor(private http: HttpClient) {}

  private decodeJwt(token: string): JwtPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  getUserRoles(): string[] {
    console.log('=== GET USER ROLES ===');
    const token = sessionStorage.getItem('auth_token');
    console.log('Token found:', !!token);
    
    if (!token) {
      console.log('No token found');
      return [];
    }

    const decoded = this.decodeJwt(token);
    console.log('Decoded JWT:', decoded);
    
    let roles = decoded?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || [];
    console.log('Raw roles from JWT:', roles);
    console.log('Roles type:', typeof roles);
    console.log('Roles isArray:', Array.isArray(roles));
    
    // Si les rôles sont une chaîne de caractères, la convertir en tableau
    if (typeof roles === 'string') {
      roles = [roles];
      console.log('Converted string to array:', roles);
    }
    
    console.log('Final roles array:', roles);
    return roles;
  }

  getActiveRole(): string {
    console.log('=== GET ACTIVE ROLE ===');
    // Récupérer le rôle actif depuis sessionStorage
    const activeRole = sessionStorage.getItem('smartCoil_activeRole');
    console.log('Active role from sessionStorage:', activeRole);
    
    if (activeRole) {
      console.log('Using active role from sessionStorage:', activeRole);
      return activeRole;
    }

    // Sinon, prendre le premier rôle disponible
    const roles = this.getUserRoles();
    console.log('Available roles:', roles);
    console.log('First role:', roles.length > 0 ? roles[0] : 'No roles');
    
    const firstRole = roles.length > 0 ? roles[0] : '';
    console.log('Returning first role:', firstRole);
    return firstRole;
  }

  hasRole(role: string): boolean {
    const userRoles = this.getUserRoles();
    return userRoles.includes(role);
  }

  getUserId(): number | null {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    const decoded = this.decodeJwt(token);
    const userId = decoded?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
    return userId ? parseInt(userId) : null;
  }

  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some(role => userRoles.includes(role));
  }

  getNavigationItems(): NavigationItem[] {
    console.log('=== GET NAVIGATION ITEMS ===');
    const activeRole = this.getActiveRole();
    console.log('Active role for navigation:', activeRole);
    console.log('All navigation items:', this.navigationItems);
    
    const filteredItems = this.navigationItems.filter(item => 
      item.roles.includes(activeRole)
    );
    console.log('Filtered navigation items:', filteredItems);
    
    return filteredItems;
  }

  canAccessRoute(route: string): boolean {
    const navItem = this.navigationItems.find(item => item.route === route);
    if (!navItem) {
      return false;
    }

    const activeRole = this.getActiveRole();
    return navItem.roles.includes(activeRole);
  }

  // === Méthodes API pour la gestion des rôles ===

  /**
   * Récupérer tous les rôles disponibles
   */
  getAllRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.apiUrl);
  }

  /**
   * Récupérer les rôles d'un utilisateur spécifique
   */
  getRolesByUser(userId: number): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/user/${userId}`);
  }

  /**
   * Assigner un rôle à un utilisateur
   */
  assignRole(userId: number, roleId: number): Observable<void> {
    // Headers explicites pour JSON
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Payload avec "utilisateurId" comme attendu par le backend
    const payload = {
      utilisateurId: userId,
      roleId: roleId
    };
    
    console.log('=== DÉTAILS REQUÊTE ASSIGNATION ===');
    console.log('URL:', `${this.apiUrl}/assign`);
    console.log('Méthode:', 'POST');
    console.log('Headers:', headers);
    console.log('Payload:', payload);
    console.log('Payload JSON stringifié:', JSON.stringify(payload));
    console.log('=====================================');
    
    return this.http.post<void>(`${this.apiUrl}/assign`, payload, { headers });
  }

  /**
   * Alternative: Essayer un format différent de payload
   */
  assignRoleAlternative(userId: number, roleId: number): Observable<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Format alternatif que l'API pourrait attendre
    const payload = {
      UtilisateurId: userId,
      RoleId: roleId
    };
    
    console.log('=== DÉTAILS REQUÊTE ALTERNATIVE ===');
    console.log('URL:', `${this.apiUrl}/assign`);
    console.log('Payload alternatif:', payload);
    console.log('Payload JSON stringifié:', JSON.stringify(payload));
    console.log('==================================');
    
    return this.http.post<void>(`${this.apiUrl}/assign`, payload, { headers });
  }

  /**
   * Test: Format le plus simple possible
   */
  assignRoleSimple(userId: number, roleId: number): Observable<void> {
    console.log('=== FORMAT SIMPLE ===');
    console.log('Envoi de:', userId, roleId);
    console.log('URL:', `${this.apiUrl}/assign`);
    
    // Essayer sans headers explicites mais avec le bon nom de propriété
    return this.http.post<void>(`${this.apiUrl}/assign`, { utilisateurId: userId, roleId });
  }

  /**
   * Retirer un rôle d'un utilisateur
   */
  removeRole(userId: number, roleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/remove/${userId}/${roleId}`);
  }

  /**
   * Obtenir les noms des rôles pour un utilisateur (formaté pour l'affichage)
   */
  getUserRoleNames(userId: number): Observable<string> {
    return new Observable<string>(observer => {
      this.getRolesByUser(userId).subscribe({
        next: (roles) => {
          const roleNames = roles.map(role => role.nomRole);
          observer.next(roleNames.length > 0 ? roleNames.join(', ') : '-');
          observer.complete();
        },
        error: (err) => {
          console.error('Erreur lors du chargement des rôles utilisateur:', err);
          observer.next('-');
          observer.complete();
        }
      });
    });
  }
}
