import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

// Configuration spécifique pour l'authentification
const authConfig = {
  apiUrl: environment.authApiUrl || 'http://localhost:5268/api'  // Port 5268 pour l'authentification
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'auth_token';
  private userKey = 'user_info';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {
    this.checkAuthenticationStatus();
  }

  login(nomUtilisateur: string, motDePasse: string): Observable<any> {
    return this.http.post(`${authConfig.apiUrl}/Auth/login`, {
      nomUtilisateur,
      motDePasse
    });
  }

  setAuthData(token: string, userInfo: any): void {
    sessionStorage.setItem(this.tokenKey, token);
    sessionStorage.setItem(this.userKey, JSON.stringify(userInfo));
    this.isAuthenticatedSubject.next(true);
  }

  logout(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    this.isAuthenticatedSubject.next(false);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return token !== null && token !== undefined && token !== '';
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  getUserInfo(): any {
    const userInfo = sessionStorage.getItem(this.userKey);
    return userInfo ? JSON.parse(userInfo) : null;
  }

  getAuthenticationStatus(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  private checkAuthenticationStatus(): void {
    const isAuth = this.isAuthenticated();
    this.isAuthenticatedSubject.next(isAuth);
  }
}
