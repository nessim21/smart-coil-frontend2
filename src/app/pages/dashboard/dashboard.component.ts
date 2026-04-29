import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  username: string = '';
  currentDate: Date = new Date();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('Dashboard ngOnInit - Debug info:');
    console.log('Token from sessionStorage:', sessionStorage.getItem('auth_token'));
    console.log('All sessionStorage keys:', Object.keys(sessionStorage));
    
    const userInfo = this.authService.getUserInfo();
    console.log('User info from service:', userInfo);
    
    if (userInfo) {
      this.username = userInfo.nomUtilisateur;
      console.log('Username set to:', this.username);
    } else {
      console.log('No user info found, redirecting to login');
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
