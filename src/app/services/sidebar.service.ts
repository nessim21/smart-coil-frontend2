import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  isCollapsed$ = this.isCollapsedSubject.asObservable();

  constructor() {}

  toggleSidebar(): void {
    const currentCollapsed = this.isCollapsedSubject.value;
    this.isCollapsedSubject.next(!currentCollapsed);
  }

  setCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
  }

  get isCollapsed(): boolean {
    return this.isCollapsedSubject.value;
  }
}
