import { Component, OnInit, inject, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdreTravailService, OrdreTravail, CreateOrdreTravailDto, UpdateOrdreTravailDto, Utilisateur } from '../../services/ordre-travail.service';
import { RoleService, Role } from '../../services/role.service';
import { BobineService, Bobine } from '../../services/bobine.service';

@Component({
  selector: 'app-ordres-travail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordres-travail.component.html',
  styleUrl: './ordres-travail.component.css',
  encapsulation: ViewEncapsulation.None
})
export class OrdresTravail implements OnInit {
  // Services
  private ordreTravailService = inject(OrdreTravailService);
  private roleService = inject(RoleService);
  private cdr = inject(ChangeDetectorRef);
  private bobineService = inject(BobineService);

  // Données
  ordresTravail: OrdreTravail[] = [];
  utilisateurs: Utilisateur[] = [];
  filteredOrdres: OrdreTravail[] = [];
  machines: string[] = [];
  bobines: Bobine[] = [];
  
  // Propriété pour les rôles utilisateur
  utilisateurRoles: { [userId: number]: Role[] } = {};

  // États
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Modal création/modification
  showModal = false;
  isEditMode = false;
  selectedOrdre: OrdreTravail | null = null;

  // Formulaire
  formIdMachine = '';
  formReferenceBobine = '';
  formUtilisateurId: number | null = null;
  formQuantiteRequise: number = 1;
  formStatut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE' = 'EN_ATTENTE';

  // Filtres
  statutFilter = '';
  machineFilter = '';
  searchFilter = '';

  // Modal de confirmation
  showConfirmModal = false;
  confirmAction: 'delete' | null = null;
  confirmOrdre: OrdreTravail | null = null;
  confirmMessage: string = '';

  // Statuts possibles
  statutsPossibles = ['EN_ATTENTE', 'EN_COURS', 'TERMINE'];

  ngOnInit(): void {
    // Initialiser les tableaux pour éviter les problèmes d'affichage
    this.ordresTravail = [];
    this.filteredOrdres = [];
    this.utilisateurs = [];
    this.machines = [];
    this.bobines = [];
    
    this.loadOrdresTravail();
    this.loadUtilisateurs();
    this.loadBobines();
  }

  // Charger tous les ordres de travail
  loadOrdresTravail(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    // Timeout de sécurité pour éviter le blocage indéfini
    const timeoutId = setTimeout(() => {
      this.isLoading = false;
      this.filteredOrdres = [];
      this.errorMessage = 'Le chargement a pris trop de temps. Veuillez réessayer.';
      this.cdr.detectChanges();
    }, 3000); // 3 secondes
    
    this.ordreTravailService.getOrdresTravail().subscribe({
      next: (ordres) => {
        clearTimeout(timeoutId);
        
        this.ordresTravail = ordres || [];
        this.extractMachines();
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        clearTimeout(timeoutId);
        
        this.errorMessage = 'Erreur lors du chargement des ordres de travail';
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Forcer l'affichage d'un tableau vide même en cas d'erreur
        this.filteredOrdres = [];
      }
    });
  }

  // Charger les utilisateurs
  loadUtilisateurs(): void {
    this.ordreTravailService.getUtilisateurs().subscribe({
      next: (utilisateurs) => {
        this.utilisateurs = utilisateurs || [];
        // Charger les rôles pour chaque utilisateur
        this.loadUserRoles();
      },
      error: (err) => {
        // Ne pas bloquer le tableau si les utilisateurs ne se chargent pas
        this.utilisateurs = [];
      }
    });
  }

  // Charger les rôles des utilisateurs
  loadUserRoles(): void {
    this.utilisateurs.forEach(utilisateur => {
      this.roleService.getRolesByUser(utilisateur.id).subscribe({
        next: (roles) => {
          this.utilisateurRoles[utilisateur.id] = roles;
          this.cdr.detectChanges(); // Forcer la mise à jour
        },
        error: (err) => {
          console.error(`Erreur lors du chargement des rôles de l'utilisateur ${utilisateur.id}:`, err);
          this.utilisateurRoles[utilisateur.id] = [];
        }
      });
    });
  }

  // Extraire la liste des machines uniques
  extractMachines(): void {
    const machinesSet = new Set(this.ordresTravail.map(ordre => ordre.idMachine));
    this.machines = Array.from(machinesSet).sort();
  }

  // Charger toutes les bobines pour les statuts de réservation
  loadBobines(): void {
    this.bobineService.getAll().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des bobines:', err);
        this.bobines = [];
      }
    });
  }

  // Appliquer les filtres
  applyFilters(): void {
    // Si les ordres ne sont pas encore chargés, initialiser avec un tableau vide
    if (!this.ordresTravail || this.ordresTravail.length === 0) {
      this.filteredOrdres = [];
      return;
    }
    
    this.filteredOrdres = this.ordresTravail.filter(ordre => {
      // Filtre par statut
      if (this.statutFilter && ordre.statut !== this.statutFilter) {
        return false;
      }

      // Filtre par machine
      if (this.machineFilter && ordre.idMachine !== this.machineFilter) {
        return false;
      }

      // Filtre par recherche
      if (this.searchFilter) {
        const searchLower = this.searchFilter.toLowerCase();
        return ordre.numeroOrdre.toLowerCase().includes(searchLower) ||
               ordre.referenceBobine.toLowerCase().includes(searchLower);
      }

      return true;
    }).sort((a, b) => {
      // Tri par machine en ordre croissant
      const machineA = a.idMachine || '';
      const machineB = b.idMachine || '';
      return machineA.localeCompare(machineB);
    });
  }

  // Ouvrir le modal pour créer un ordre
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedOrdre = null;
    this.resetForm();
    this.showModal = true;
  }

  // Ouvrir le modal pour modifier un ordre
  openEditModal(ordre: OrdreTravail): void {
    this.isEditMode = true;
    this.selectedOrdre = ordre;
    
    this.formIdMachine = ordre.idMachine;
    this.formReferenceBobine = ordre.referenceBobine;
    this.formUtilisateurId = ordre.utilisateurId;
    this.formQuantiteRequise = ordre.quantiteRequise;
    this.formStatut = ordre.statut;
    
    this.showModal = true;
  }

  // Fermer le modal
  closeModal(): void {
    this.showModal = false;
    this.selectedOrdre = null;
    this.resetForm();
    this.clearMessages();
  }

  // Réinitialiser le formulaire
  resetForm(): void {
    this.formIdMachine = '';
    this.formReferenceBobine = '';
    this.formUtilisateurId = null;
    this.formQuantiteRequise = 1;
    this.formStatut = 'EN_ATTENTE';
  }

  // Formater et valider le champ machine en temps réel
  formatMachine(): void {
    if (!this.formIdMachine) return;
    
    // Convertir en majuscules et garder uniquement les caractères valides
    let formatted = this.formIdMachine.toUpperCase();
    
    // Supprimer les caractères non valides sauf pour le préfixe MACHINE_
    const validPattern = /^MACHINE_[0-9]{0,2}$/;
    if (!validPattern.test(formatted)) {
      // Si le préfixe est correct, limiter les chiffres
      if (formatted.startsWith('MACHINE_')) {
        const numbersPart = formatted.substring(8); // Après "MACHINE_"
        const numbersOnly = numbersPart.replace(/[^0-9]/g, '').substring(0, 2);
        formatted = `MACHINE_${numbersOnly}`;
      } else {
        // Garder uniquement les caractères valides pour le préfixe
        const prefixOnly = formatted.replace(/[^A-Z_]/g, '');
        formatted = prefixOnly;
      }
    }
    
    this.formIdMachine = formatted;
  }

  // Valider le format de la machine en temps réel
  validateMachineFormat(): boolean {
    if (!this.formIdMachine) return false;
    const machinePattern = /^MACHINE_\d{2}$/;
    return machinePattern.test(this.formIdMachine);
  }

  // Obtenir un message d'aide pour le format de machine
  getMachineHelpMessage(): string {
    if (!this.formIdMachine) {
      return 'Format requis : MACHINE_** (exactement 2 chiffres, ex: MACHINE_01, MACHINE_12)';
    }
    
    if (this.validateMachineFormat()) {
      return 'Format valide';
    }
    
    return 'Format incorrect. Utilisez : MACHINE_** (exactement 2 chiffres, ex: MACHINE_01 à MACHINE_99)';
  }

  // Formater et valider le champ référence bobine en temps réel
  formatReferenceBobine(): void {
    if (!this.formReferenceBobine) return;
    
    // Convertir en majuscules et garder uniquement les caractères valides
    let formatted = this.formReferenceBobine.toUpperCase();
    
    // Supprimer les caractères non valides sauf pour le préfixe REF-
    const validPattern = /^REF-[0-9]{0,4}$/;
    if (!validPattern.test(formatted)) {
      // Si le préfixe est correct, limiter les chiffres
      if (formatted.startsWith('REF-')) {
        const numbersPart = formatted.substring(4); // Après "REF-"
        const numbersOnly = numbersPart.replace(/[^0-9]/g, '').substring(0, 4);
        formatted = `REF-${numbersOnly}`;
      } else {
        // Garder uniquement les caractères valides pour le préfixe
        const prefixOnly = formatted.replace(/[^A-Z-]/g, '');
        formatted = prefixOnly;
      }
    }
    
    this.formReferenceBobine = formatted;
  }

  // Valider le format de la référence bobine en temps réel
  validateReferenceBobineFormat(): boolean {
    if (!this.formReferenceBobine) return false;
    const bobinePattern = /^REF-\d{4}$/;
    return bobinePattern.test(this.formReferenceBobine);
  }

  // Bloquer la frappe si la limite est atteinte pour la machine
  onMachineKeyDown(event: KeyboardEvent): void {
    const currentValue = this.formIdMachine || '';
    
    // Autoriser les touches de contrôle (backspace, delete, tab, enter, etc.)
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab' || 
        event.key === 'Enter' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      return;
    }
    
    // Si on a déjà le format complet, bloquer toute nouvelle frappe
    if (/^MACHINE_\d{2}$/.test(currentValue)) {
      event.preventDefault();
      return;
    }
    
    // Vérifier si le caractère est valide pour la position actuelle
    if (currentValue.startsWith('MACHINE_')) {
      const numbersPart = currentValue.substring(8); // Après "MACHINE_"
      
      // Si on a déjà 2 chiffres, bloquer
      if (numbersPart.length >= 2) {
        event.preventDefault();
        return;
      }
      
      // N'autoriser que les chiffres après "MACHINE_"
      if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        return;
      }
    } else {
      // N'autoriser que les lettres, underscore pour le préfixe
      if (!/^[A-Z_]$/.test(event.key.toUpperCase())) {
        event.preventDefault();
        return;
      }
    }
  }

  // Bloquer la frappe si la limite est atteinte pour la référence bobine
  onReferenceBobineKeyDown(event: KeyboardEvent): void {
    const currentValue = this.formReferenceBobine || '';
    
    // Autoriser les touches de contrôle (backspace, delete, tab, enter, etc.)
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab' || 
        event.key === 'Enter' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      return;
    }
    
    // Si on a déjà le format complet, bloquer toute nouvelle frappe
    if (/^REF-\d{4}$/.test(currentValue)) {
      event.preventDefault();
      return;
    }
    
    // Vérifier si le caractère est valide pour la position actuelle
    if (currentValue.startsWith('REF-')) {
      const numbersPart = currentValue.substring(4); // Après "REF-"
      
      // Si on a déjà 4 chiffres, bloquer
      if (numbersPart.length >= 4) {
        event.preventDefault();
        return;
      }
      
      // N'autoriser que les chiffres après "REF-"
      if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        return;
      }
    } else {
      // N'autoriser que les lettres, tiret pour le préfixe
      if (!/^[A-Z-]$/.test(event.key.toUpperCase())) {
        event.preventDefault();
        return;
      }
    }
  }

  // Sauvegarder (créer ou modifier)
  save(): void {
    if (!this.formReferenceBobine || !this.formUtilisateurId) {
      this.errorMessage = 'Les champs obligatoires doivent être remplis';
      return;
    }

    if (this.formQuantiteRequise <= 0) {
      this.errorMessage = 'La quantité doit être supérieure à 0';
      return;
    }

    // Validation du format de la référence bobine : REF-**** où **** sont des nombres
    const bobinePattern = /^REF-\d{4}$/;
    if (!bobinePattern.test(this.formReferenceBobine)) {
      this.errorMessage = 'Le format de la référence bobine doit être : REF-**** (où **** sont exactement 4 chiffres, ex: REF-0001, REF-1234)';
      return;
    }

    // Validation du format de la machine : MACHINE_** où ** sont des nombres
    if (!this.formIdMachine) {
      this.errorMessage = 'L\'identifiant de la machine est obligatoire';
      return;
    }

    const machinePattern = /^MACHINE_\d{2}$/;
    if (!machinePattern.test(this.formIdMachine)) {
      this.errorMessage = 'Le format de la machine doit être : MACHINE_** (où ** sont exactement 2 chiffres, ex: MACHINE_01, MACHINE_12, MACHINE_99)';
      return;
    }

    if (this.isEditMode && this.selectedOrdre) {
      this.updateOrdre();
    } else {
      this.createOrdre();
    }
  }

  // Créer un ordre de travail
  createOrdre(): void {
    const dto: CreateOrdreTravailDto = {
      idMachine: this.formIdMachine,
      referenceBobine: this.formReferenceBobine,
      utilisateurId: this.formUtilisateurId!,
      quantiteRequise: this.formQuantiteRequise
    };

    this.ordreTravailService.create(dto).subscribe({
      next: () => {
        this.successMessage = 'Ordre de travail créé avec succès';
        this.loadOrdresTravail();
        this.closeModal();
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la création de l\'ordre de travail';
        console.error('Erreur:', err);
      }
    });
  }

  // Mettre à jour un ordre de travail
  updateOrdre(): void {
    if (!this.selectedOrdre) return;

    const dto: UpdateOrdreTravailDto = {
      idMachine: this.formIdMachine,
      referenceBobine: this.formReferenceBobine,
      utilisateurId: this.formUtilisateurId || undefined,
      quantiteRequise: this.formQuantiteRequise,
      statut: this.formStatut
    };

    this.ordreTravailService.update(this.selectedOrdre.id, dto).subscribe({
      next: () => {
        this.successMessage = 'Ordre de travail mis à jour avec succès';
        this.loadOrdresTravail();
        this.closeModal();
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la mise à jour de l\'ordre de travail';
        console.error('Erreur:', err);
      }
    });
  }

  // Ouvrir le modal de confirmation
  openConfirmModal(action: 'delete', ordre: OrdreTravail): void {
    this.confirmAction = action;
    this.confirmOrdre = ordre;
    
    if (action === 'delete') {
      this.confirmMessage = `Êtes-vous sûr de vouloir supprimer l'ordre de travail "${ordre.numeroOrdre}" ?`;
    }
    
    this.showConfirmModal = true;
  }

  // Confirmer l'action
  confirmActionExecute(): void {
    if (!this.confirmOrdre || !this.confirmAction) return;
    
    switch (this.confirmAction) {
      case 'delete':
        this.executeDelete(this.confirmOrdre);
        break;
    }
    
    this.closeConfirmModal();
  }

  // Fermer le modal de confirmation
  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmOrdre = null;
    this.confirmMessage = '';
  }

  // Exécuter la suppression (sans confirmation)
  executeDelete(ordre: OrdreTravail): void {
    this.ordreTravailService.delete(ordre.id).subscribe({
      next: () => {
        this.successMessage = 'Ordre de travail supprimé avec succès';
        this.loadOrdresTravail();
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la suppression de l\'ordre de travail';
        console.error('Erreur:', err);
      }
    });
  }

  // Supprimer un ordre de travail (avec confirmation)
  deleteOrdreTravail(ordre: OrdreTravail): void {
    this.openConfirmModal('delete', ordre);
  }

  // Obtenir le libellé du statut
  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE': return 'En attente';
      case 'EN_COURS': return 'En cours';
      case 'TERMINE': return 'Terminé';
      default: return statut;
    }
  }

  // Obtenir le nom de l'utilisateur
  getUtilisateurName(utilisateurId: number | undefined): string {
    const utilisateur = this.utilisateurs.find(u => u.id === utilisateurId);
    return utilisateur ? utilisateur.nomUtilisateur : `Utilisateur ${utilisateurId}`;
  }

  // Filtrer les utilisateurs par rôle (opérateur ou admin uniquement)
  getOperateurs(): Utilisateur[] {
    return this.utilisateurs.filter(utilisateur => {
      // Utiliser les rôles chargés
      const roles = this.utilisateurRoles[utilisateur.id] || [];
      const roleNames = roles.map(role => role.nomRole);
      return roleNames.includes('ADMIN') || roleNames.includes('OPERATEUR_MACHINE');
    });
  }

  // Obtenir la classe CSS du statut
  getStatutClass(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE': return 'badge-warning';
      case 'EN_COURS': return 'badge-info';
      case 'TERMINE': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  
  // Effacer les messages
  clearMessages(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }

  // Effacer les messages après un délai
  clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, 3000);
  }
}
