import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { UtilisateurService, Utilisateur, CreateUtilisateurDto, UpdateUtilisateurDto } from '../../services/utilisateur.service';
import { RoleService, Role } from '../../services/role.service';

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './utilisateurs.html',
  styleUrl: './utilisateurs.css'
})
export class Utilisateurs implements OnInit {
  utilisateurs: Utilisateur[] = [];
  utilisateursFiltres: Utilisateur[] = [];
  loading = false;
  showModal = false;
  showDeleteModal = false;
  isEditMode = false;
  selectedUtilisateur: Utilisateur | null = null;
  utilisateurToDelete: { id: number; nom: string } | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  passwordMismatchError: boolean = false;
  
  // Propriétés de filtre
  searchQuery = '';
  statutFilter = '';
  roleFilter = '';
  availableRoles: Role[] = [];
  selectedRoles: number[] = []; // Pour le formulaire
  
  // Propriétés pour les rôles utilisateur
  utilisateurRoles: { [userId: number]: Role[] } = {};

  form = new FormGroup({
    nomUtilisateur: new FormControl('', [Validators.required]),
    motDePasse: new FormControl(''),
    confirmationMotDePasse: new FormControl(''),
    codeBadge: new FormControl('', [Validators.required]),
    telephone: new FormControl(''),
    bureau: new FormControl(''),
    estActif: new FormControl(true)
  });

  constructor(
    private utilisateurService: UtilisateurService,
    private roleService: RoleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true; // Forcer l'état de chargement initial
    this.cdr.detectChanges(); // S'assurer que l'UI se met à jour
    
    // Charger les rôles avec un fallback
    this.loadRolesWithFallback();
    this.loadUtilisateurs();
  }

  private loadRolesWithFallback(): void {
    this.roleService.getAllRoles().subscribe({
      next: (roles) => {
        this.availableRoles = roles;
        console.log('Rôles disponibles chargés:', roles);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rôles:', err);
        // Utiliser des rôles par défaut en cas d'erreur
        this.availableRoles = [
          { id: 1, nomRole: 'ADMIN', description: 'Administrateur - accès total' },
          { id: 2, nomRole: 'ALIMENTATEUR', description: 'Alimentateur - prélèvement, livraison, retour' },
          { id: 3, nomRole: 'OPERATEUR_MACHINE', description: 'Opérateur machine - production' }
        ];
        console.log('Utilisation des rôles par défaut:', this.availableRoles);
        this.cdr.detectChanges();
      }
    });
  }

  loadUtilisateurs(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.utilisateurService.getAll().subscribe({
      next: (data) => {
        this.utilisateurs = data;
        this.loading = false;
        console.log('Utilisateurs chargés:', data);
        
        // Charger les rôles pour chaque utilisateur
        this.loadUserRoles();
        
        // Appliquer les filtres initiaux
        this.applyFilters();
        
        this.cdr.detectChanges(); // Forcer la détection de changement
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        this.errorMessage = 'Erreur lors du chargement des utilisateurs';
        this.loading = false;
        this.cdr.detectChanges(); // Forcer la détection de changement
        
        // Gérer le cas 401 (token expiré)
        if (err.status === 401) {
          this.errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      }
    });
  }

  openAddModal(): void {
    console.log('openAddModal - Avant:', { loading: this.loading, utilisateurs: this.utilisateurs.length });
    this.isEditMode = false;
    this.selectedUtilisateur = null;
    this.selectedRoles = []; // Réinitialiser les rôles sélectionnés
    this.form.reset();
    this.form.get('estActif')?.setValue(true);
    this.form.get('motDePasse')?.setValidators([Validators.required]);
    this.showModal = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges(); // Forcer la détection
    console.log('openAddModal - Après:', { loading: this.loading, utilisateurs: this.utilisateurs.length });
  }

  openEditModal(utilisateur: Utilisateur): void {
    this.isEditMode = true;
    this.selectedUtilisateur = utilisateur;
    
    // Charger les rôles de l'utilisateur
    this.roleService.getRolesByUser(utilisateur.id).subscribe({
      next: (roles) => {
        this.selectedRoles = roles.map(role => role.id);
        console.log('Rôles de l\'utilisateur chargés pour édition:', this.selectedRoles);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rôles utilisateur:', err);
        this.selectedRoles = [];
      }
    });
    
    this.form.patchValue({
      nomUtilisateur: utilisateur.nomUtilisateur,
      codeBadge: utilisateur.codeBadge || '',
      telephone: utilisateur.telephone || '',
      bureau: utilisateur.bureau || '',
      estActif: utilisateur.estActif
    });
    this.form.get('motDePasse')?.clearValidators();
    this.form.get('motDePasse')?.setValue('');
    this.showModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  openDeleteModal(id: number, nom: string): void {
    this.utilisateurToDelete = { id, nom };
    this.showDeleteModal = true;
  }

  closeModal(): void {
    console.log('closeModal - Avant:', { loading: this.loading, utilisateurs: this.utilisateurs.length });
    this.showModal = false;
    this.showDeleteModal = false;
    this.form.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges(); // Forcer la détection
    console.log('closeModal - Après:', { loading: this.loading, utilisateurs: this.utilisateurs.length });
  }

  save(): void {
    if (this.form.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs requis';
      return;
    }

    const formValue = this.form.value;

    if (this.isEditMode && this.selectedUtilisateur) {
      // Mode édition
      const updateDto: UpdateUtilisateurDto = {
        nomUtilisateur: formValue.nomUtilisateur || '',
        codeBadge: formValue.codeBadge || undefined,
        telephone: formValue.telephone || undefined,
        bureau: formValue.bureau || undefined,
        estActif: formValue.estActif ?? true
      };

      console.log('Mise à jour utilisateur:', updateDto);

      this.utilisateurService.update(this.selectedUtilisateur.id, updateDto).subscribe({
        next: () => {
          // Sauvegarder les rôles
          if (this.selectedUtilisateur) {
            this.saveUserRoles(this.selectedUtilisateur.id);
          }
          
          this.successMessage = 'Utilisateur mis à jour avec succès';
          setTimeout(() => {
            this.loadUtilisateurs();
            this.closeModal();
          }, 1500);
        },
        error: (err) => {
          console.error('Erreur lors de la mise à jour:', err);
          this.errorMessage = 'Erreur lors de la mise à jour de l\'utilisateur';
        }
      });
    } else {
      // Mode création
      if (!formValue.motDePasse) {
        this.errorMessage = 'Le mot de passe est requis pour la création';
        return;
      }

      if (!formValue.confirmationMotDePasse) {
        this.errorMessage = 'La confirmation du mot de passe est requise';
        return;
      }

      if (formValue.motDePasse !== formValue.confirmationMotDePasse) {
        this.passwordMismatchError = true;
        this.errorMessage = null; // Ne pas afficher dans le dashboard
        return;
      }

      if (!formValue.codeBadge || formValue.codeBadge.trim() === '') {
        this.errorMessage = 'Le code badge est requis pour la création';
        return;
      }

      const createDto: CreateUtilisateurDto = {
        nomUtilisateur: formValue.nomUtilisateur || '',
        motDePasse: formValue.motDePasse || '',
        codeBadge: formValue.codeBadge,
        telephone: formValue.telephone || undefined,
        bureau: formValue.bureau || undefined
      };

      console.log('Création utilisateur:', createDto);

      this.utilisateurService.create(createDto).subscribe({
        next: (newUser) => {
          console.log('Utilisateur créé avec succès:', newUser);
          
          // Ajouter immédiatement le nouvel utilisateur à la liste locale
          this.utilisateurs.push(newUser);
          console.log('Nouvel utilisateur ajouté à la liste locale:', newUser);
          
          // Sauvegarder les rôles pour le nouvel utilisateur
          if (this.selectedRoles.length > 0) {
            console.log('Sauvegarde des rôles pour le nouvel utilisateur:', newUser.id);
            this.saveUserRoles(newUser.id);
          } else {
            console.log('Aucun rôle à assigner pour le nouvel utilisateur');
          }
          
          this.successMessage = 'Utilisateur créé avec succès';
          
          // Recharger immédiatement la liste des utilisateurs
          this.loadUtilisateurs();
          
          // Forcer la mise à jour de l'interface
          setTimeout(() => {
            this.cdr.detectChanges();
            this.closeModal();
          }, 1500);
        },
        error: (err) => {
          console.error('Erreur lors de la création de l\'utilisateur:', err);
          if (err.status === 400) {
            this.errorMessage = 'Erreur de validation: Vérifiez les données saisies';
          } else if (err.status === 409) {
            this.errorMessage = 'Cet utilisateur existe déjà';
          } else if (err.status === 401) {
            this.errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          } else {
            this.errorMessage = 'Erreur lors de la création de l\'utilisateur';
          }
        }
      });
    }
  }

  confirmDelete(): void {
    if (this.utilisateurToDelete) {
      console.log('Suppression utilisateur:', this.utilisateurToDelete.id);

      this.utilisateurService.delete(this.utilisateurToDelete.id).subscribe({
        next: () => {
          this.successMessage = 'Utilisateur supprimé avec succès';
          this.showDeleteModal = false;
          this.utilisateurToDelete = null;
          setTimeout(() => {
            this.loadUtilisateurs();
          }, 1000);
        },
        error: (err) => {
          console.error('Erreur lors de la suppression:', err);
          this.errorMessage = 'Erreur lors de la suppression de l\'utilisateur';
          this.showDeleteModal = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.utilisateurToDelete = null;
  }

  getRoleNames(roles?: string[]): string {
    if (!roles || roles.length === 0) return '-';
    return roles.join(', ');
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.passwordMismatchError = false;
  }

  // === Méthodes de gestion des rôles ===

  loadRoles(): void {
    this.roleService.getAllRoles().subscribe({
      next: (roles) => {
        this.availableRoles = roles;
        console.log('Rôles disponibles chargés:', roles);
        this.cdr.detectChanges(); // Forcer la détection pour éviter NG0100
      },
      error: (err) => {
        console.error('Erreur lors du chargement des rôles:', err);
        this.cdr.detectChanges();
      }
    });
  }

  loadUserRoles(): void {
    this.utilisateurs.forEach(utilisateur => {
      this.roleService.getRolesByUser(utilisateur.id).subscribe({
        next: (roles) => {
          this.utilisateurRoles[utilisateur.id] = roles;
          console.log(`Rôles de l'utilisateur ${utilisateur.id}:`, roles);
          this.cdr.detectChanges(); // Forcer la mise à jour du tableau
        },
        error: (err) => {
          console.error(`Erreur lors du chargement des rôles de l'utilisateur ${utilisateur.id}:`, err);
          this.utilisateurRoles[utilisateur.id] = [];
        }
      });
    });
  }

  // === Méthodes de filtrage ===

  applyFilters(): void {
    let filtered = [...this.utilisateurs];

    // Filtrage par recherche textuelle
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(utilisateur => 
        utilisateur.nomUtilisateur.toLowerCase().includes(query) ||
        (utilisateur.codeBadge && utilisateur.codeBadge.toLowerCase().includes(query)) ||
        (utilisateur.telephone && utilisateur.telephone.toLowerCase().includes(query)) ||
        (utilisateur.bureau && utilisateur.bureau.toLowerCase().includes(query))
      );
    }

    // Filtrage par statut
    if (this.statutFilter) {
      filtered = filtered.filter(utilisateur => {
        if (this.statutFilter === 'actif') return utilisateur.estActif;
        if (this.statutFilter === 'inactif') return !utilisateur.estActif;
        return true;
      });
    }

    // Filtrage par rôle
    if (this.roleFilter) {
      filtered = filtered.filter(utilisateur => {
        const userRoles = this.utilisateurRoles[utilisateur.id] || [];
        return userRoles.some(role => role.nomRole === this.roleFilter);
      });
    }

    this.utilisateursFiltres = filtered;
    console.log('Filtres appliqués:', {
      searchQuery: this.searchQuery,
      statutFilter: this.statutFilter,
      roleFilter: this.roleFilter,
      resultats: filtered.length
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onStatutFilterChange(): void {
    this.applyFilters();
  }

  onRoleFilterChange(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statutFilter = '';
    this.roleFilter = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // === Méthodes pour les rôles dans le formulaire ===

  onRoleChange(roleId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedRoles.includes(roleId)) {
        this.selectedRoles.push(roleId);
      }
    } else {
      const index = this.selectedRoles.indexOf(roleId);
      if (index > -1) {
        this.selectedRoles.splice(index, 1);
      }
    }
    console.log('Rôles sélectionnés:', this.selectedRoles);
  }

  isRoleSelected(roleId: number): boolean {
    return this.selectedRoles.includes(roleId);
  }

  getUserRoles(utilisateur: Utilisateur): Role[] {
    return this.utilisateurRoles[utilisateur.id] || [];
  }

  getUserRoleNames(utilisateur: Utilisateur): string {
    const roles = this.getUserRoles(utilisateur);
    return roles.length > 0 ? roles.map(r => r.nomRole).join(', ') : '-';
  }

  // === Méthodes pour la sauvegarde des rôles ===

  saveUserRoles(userId: number): void {
    console.log('Sauvegarde des rôles pour utilisateur', userId, 'Rôles sélectionnés:', this.selectedRoles);
    
    const currentRoles = this.utilisateurRoles[userId] || [];
    const currentRoleIds = currentRoles.map(r => r.id);
    console.log('Rôles actuels:', currentRoleIds);

    // Rôles à ajouter
    const rolesToAdd = this.selectedRoles.filter(roleId => !currentRoleIds.includes(roleId));
    
    // Rôles à supprimer
    const rolesToRemove = currentRoleIds.filter(roleId => !this.selectedRoles.includes(roleId));

    console.log('Rôles à ajouter:', rolesToAdd);
    console.log('Rôles à supprimer:', rolesToRemove);

    // Exécuter les opérations séquentiellement pour éviter les problèmes
    this.executeRoleOperations(userId, rolesToAdd, rolesToRemove);
  }

  private executeRoleOperations(userId: number, rolesToAdd: number[], rolesToRemove: number[]): void {
    let operationsCompleted = 0;
    const totalOperations = rolesToAdd.length + rolesToRemove.length;

    if (totalOperations === 0) {
      console.log('Aucun changement de rôle à effectuer');
      return;
    }

    const checkCompletion = () => {
      operationsCompleted++;
      if (operationsCompleted === totalOperations) {
        console.log('Toutes les opérations de rôles terminées');
        // Recharger les rôles de l'utilisateur
        this.refreshUserRoles(userId);
      }
    };

    // Ajouter les nouveaux rôles
    rolesToAdd.forEach(roleId => {
      console.log('Ajout du rôle', roleId, 'à l\'utilisateur', userId);
      
      // Vérifier d'abord que l'utilisateur existe
      const utilisateur = this.utilisateurs.find(u => u.id === userId);
      if (!utilisateur) {
        console.warn('Utilisateur', userId, 'non trouvé dans la liste locale, mais tentative d\'assignation quand même...');
        console.warn('Utilisateurs disponibles:', this.utilisateurs.map(u => ({ id: u.id, nom: u.nomUtilisateur })));
      } else {
        console.log('Utilisateur trouvé dans la liste locale:', utilisateur.nomUtilisateur, '(ID:', userId, ')');
      }
      
      // Essayer d'abord le format standard
      this.roleService.assignRole(userId, roleId).subscribe({
        next: () => {
          console.log('Rôle ajouté avec succès (format standard):', roleId);
          checkCompletion();
        },
        error: (err) => {
          console.error('Erreur avec le format standard pour le rôle:', roleId);
          console.error('Status:', err.status);
          console.error('Error:', err.error);
          
          // Si erreur 500 ou 400, essayer le format alternatif
          if (err.status === 500 || err.status === 400) {
            console.log('Tentative avec le format alternatif...');
            this.roleService.assignRoleAlternative(userId, roleId).subscribe({
              next: () => {
                console.log('Rôle ajouté avec succès (format alternatif):', roleId);
                checkCompletion();
              },
              error: (altErr) => {
                console.error('Le format alternatif a échoué pour le rôle:', roleId);
                console.error('Erreur alternative:', altErr);
                
                // Dernier essai: format simple
                console.log('Tentative avec le format simple...');
                this.roleService.assignRoleSimple(userId, roleId).subscribe({
                  next: () => {
                    console.log('Rôle ajouté avec succès (format simple):', roleId);
                    checkCompletion();
                  },
                  error: (simpleErr) => {
                    console.error('Tous les formats ont échoué pour le rôle:', roleId);
                    console.error('Erreur format simple:', simpleErr);
                    
                    // Message d'erreur plus précis
                    this.errorMessage = `Impossible d'assigner le rôle ${roleId}. Erreur serveur: ${simpleErr.status}`;
                    checkCompletion();
                  }
                });
              }
            });
          } else {
            // Autres types d'erreurs
            if (err.status === 404) {
              this.errorMessage = `Rôle ${roleId} ou utilisateur ${userId} non trouvé`;
            } else {
              this.errorMessage = `Erreur lors de l'ajout du rôle ${roleId}: ${err.message}`;
            }
            checkCompletion();
          }
        }
      });
    });

    // Supprimer les anciens rôles
    rolesToRemove.forEach(roleId => {
      console.log('Suppression du rôle', roleId, 'de l\'utilisateur', userId);
      this.roleService.removeRole(userId, roleId).subscribe({
        next: () => {
          console.log('Rôle supprimé avec succès:', roleId);
          checkCompletion();
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du rôle:', roleId, err);
          this.errorMessage = `Erreur lors de la suppression du rôle ${roleId}`;
          checkCompletion();
        }
      });
    });
  }

  private refreshUserRoles(userId: number): void {
    console.log('Rechargement des rôles pour utilisateur', userId);
    this.roleService.getRolesByUser(userId).subscribe({
      next: (roles) => {
        this.utilisateurRoles[userId] = roles;
        console.log('Rôles rechargés:', roles);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du rechargement des rôles:', err);
      }
    });
  }
}
