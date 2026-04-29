import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, NgSwitch, NgSwitchCase } from '@angular/common';
import { RoleService, NavigationItem } from '../services/role.service';
import { SidebarService } from '../services/sidebar.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, NgSwitch, NgSwitchCase],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnDestroy {
  navigationItems: NavigationItem[] = [];
  activeRole: string = '';
  isCollapsed: boolean = false;
  private sidebarSubscription: Subscription = new Subscription();

  constructor(
    private roleService: RoleService,
    private router: Router,
    private sidebarService: SidebarService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('Sidebar - Initializing...');
    this.activeRole = this.roleService.getActiveRole();
    console.log('Sidebar - Active role:', this.activeRole);
    
    this.navigationItems = this.roleService.getNavigationItems();
    console.log('Sidebar - Navigation items:', this.navigationItems);

    // S'abonner aux changements d'état du sidebar
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
    });
  }

  ngOnDestroy(): void {
    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
  }

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  navigateTo(item: NavigationItem): void {
    this.router.navigate([item.route]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
