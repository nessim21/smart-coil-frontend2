import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  nomUtilisateur: string = '';
  motDePasse: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.nomUtilisateur || !this.motDePasse) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.nomUtilisateur, this.motDePasse).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Stocker les données d'authentification
        this.authService.setAuthData(response.token, {
          nomUtilisateur: response.nomUtilisateur || this.nomUtilisateur
        });
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'Nom d\'utilisateur ou mot de passe incorrect';
        console.error('Login error:', error);
      }
    });
  }

  onInputChange(): void {
    this.errorMessage = '';
  }
}
