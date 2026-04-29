import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { Zones } from './pages/zones/zones';
import { StockGrid } from './pages/stock-grid/stock-grid';
import { Utilisateurs } from './pages/utilisateurs/utilisateurs';
import { Bobines } from './pages/bobines/bobines.component';
import { OrdresTravail } from './pages/ordres-travail/ordres-travail.component';
import { Demandes } from './pages/demandes/demandes.component';
import { OperateurDashboard } from './pages/operateur/operateur-dashboard.component';
import { AlimentateurDashboard } from './pages/alimentateur/alimentateur-dashboard.component';
import { authGuard } from './auth-guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        component: DashboardComponent,
      },
      { 
        path: 'zones', 
        component: Zones,
        canActivate: [roleGuard(['ADMIN'])],
      },
      { 
        path: 'stock-grid', 
        component: StockGrid,
        canActivate: [roleGuard(['ALIMENTATEUR', 'ADMIN'])],
      },
      { 
        path: 'bobines', 
        component: Bobines,
        canActivate: [roleGuard(['ADMIN'])],
      },
            { 
        path: 'ordres-travail', 
        component: OrdresTravail,
        canActivate: [roleGuard(['ADMIN'])],
      },
      { 
        path: 'demandes', 
        component: Demandes,
        canActivate: [roleGuard(['ADMIN'])],
      },
      { 
        path: 'operateur-dashboard', 
        component: OperateurDashboard,
        canActivate: [roleGuard(['OPERATEUR_MACHINE'])],
      },
      { 
        path: 'alimentateur-dashboard', 
        component: AlimentateurDashboard,
        canActivate: [roleGuard(['ALIMENTATEUR'])],
      },
      { 
        path: 'utilisateurs', 
        component: Utilisateurs,
        canActivate: [roleGuard(['ADMIN'])],
      }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
