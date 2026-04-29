import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DemandeService, Demande, CreateDemandeDto, UpdateDemandeDto, Utilisateur } from '../../services/demande.service';
import { OrdreTravailService, OrdreTravail } from '../../services/ordre-travail.service';
import { RoleService, Role } from '../../services/role.service';
import { BobineService, Bobine } from '../../services/bobine.service';
import { UtilisateurService } from '../../services/utilisateur.service';

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './demandes.component.html',
  styleUrl: './demandes.component.css'
})
export class Demandes implements OnInit {
  // Services
  private demandeService = inject(DemandeService);
  private ordreTravailService = inject(OrdreTravailService);
  private roleService = inject(RoleService);
  private bobineService = inject(BobineService);
  private utilisateurService = inject(UtilisateurService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  // Données
  demandes: Demande[] = [];
  demandesTerminees: Demande[] = []; // Nouveau tableau pour les demandes terminées
  demandesRetours: any[] = []; // Nouveau tableau pour les demandes de retour
  ordresTravail: OrdreTravail[] = [];
  ordresTravailEnAttente: OrdreTravail[] = []; // Work orders en attente pour la création
  utilisateurs: Utilisateur[] = [];
  filteredDemandes: Demande[] = [];
  bobines: Bobine[] = [];
  
  // Propriété pour les rôles utilisateur
  utilisateurRoles: { [userId: number]: Role[] } = {};
  
  // Propriété pour les noms utilisateurs pré-calculés
  utilisateurNames: { [userId: number]: string } = {};
  
  // ID de l'utilisateur connecté (ADMIN)
  currentUserId: number | null = null;

  // Modal d'assignation
  selectedRetour: any = null;
  showAssignationModal = false;
  utilisateursDisponibles: any[] = [];
  selectedUtilisateurId: number | null = null;
  loadingUtilisateurs = false;
  
  // Ordres de travail déjà utilisés dans des demandes
  ordresTravailUtilises: Set<number> = new Set();

  // États
  isLoading = false;
  isLoadingTerminees = false; // État de chargement pour les demandes terminées
  isLoadingRetours = false; // État de chargement pour les demandes de retour
  isCreating = false;  // État pour bloquer le bouton pendant la création
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Modal création/modification
  showModal = false;
  isEditMode = false;
  selectedDemande: Demande | null = null;

  // Modal détails
  showDetailsModal = false;
  selectedDemandeForDetails: Demande | null = null;

  // Modal détails des demandes de retour
  showRetourDetailsModal = false;
  selectedRetourForDetails: any = null;

  // Formulaire
  formOrdreTravailId: number | null = null;
  formAlimentateurId: number | null | string = null;
  formPriorite: 'NORMAL' | 'PRIORITAIRE' = 'NORMAL';
  formStatut: 'NON_AFFECTEE' | 'EN_COURS' | 'TERMINE' = 'NON_AFFECTEE';
  formUtilisateurAssigneId: number | null = null;
  
  // Ordre de travail sélectionné pour afficher la machine
  selectedOrdreTravail: OrdreTravail | null = null;

  // Modal de confirmation
  showConfirmModal = false;
  confirmAction: 'delete' | null = null;
  confirmDemande: Demande | null = null;
  confirmMessage: string = '';

  // Filtres
  statutFilter = '';
  prioriteFilter = '';

  // Statuts possibles
  statutsPossibles: ('NON_AFFECTEE' | 'EN_COURS' | 'TERMINE' | 'TERMINEE')[] = ['NON_AFFECTEE', 'EN_COURS', 'TERMINE', 'TERMINEE'];
  prioritesPossibles: ('NORMAL' | 'PRIORITAIRE')[] = ['NORMAL', 'PRIORITAIRE'];

  ngOnInit(): void {
    this.getCurrentUserId();
    this.loadDemandes();
    this.loadDemandesTerminees(); // Charger les demandes terminées
    this.loadDemandesRetours(); // Charger les demandes de retour
    this.loadOrdresTravail();
    this.loadUtilisateurs();
    this.loadBobines(); // Charger les bobines pour les statuts
  }

  // Récupérer l'ID de l'utilisateur connecté depuis le vrai JWT token
  getCurrentUserId(): void {
    const token = sessionStorage.getItem('auth_token'); // Utiliser la bonne clé
    
    if (!token) {
      console.error('Aucun token trouvé - utilisateur non authentifié');
      this.currentUserId = null;
      // Rediriger vers la page de login
      this.router.navigate(['/login']);
      return;
    }

    try {
      // Vérifier que le token a bien 3 parties (vrai JWT)
      const jwtParts = token.split('.');
      
      if (jwtParts.length !== 3) {
        throw new Error('Token invalide : format JWT incorrect');
      }
      
      const payload = JSON.parse(atob(jwtParts[1]));
      
      // Chercher l'ID utilisateur dans les claims standards
      const possibleKeys = [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
        'nameidentifier',
        'sub',
        'userId',
        'id',
        'nameid'
      ];
      
      for (const key of possibleKeys) {
        if (payload[key] !== undefined) {
          this.currentUserId = parseInt(payload[key]);
          if (!isNaN(this.currentUserId)) {
            console.log(`ID utilisateur trouvé: ${this.currentUserId}`);
            return;
          }
        }
      }
      
      throw new Error('ID utilisateur non trouvé dans le token JWT');
      
    } catch (error) {
      console.error('Erreur lors du décodage du token JWT:', error);
      this.currentUserId = null;
      // Rediriger vers la page de login en cas de token invalide
      this.router.navigate(['/login']);
    }
  }

  // Charger les demandes
  loadDemandes(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    // Timeout de sécurité pour éviter le blocage indéfini
    const timeoutId = setTimeout(() => {
      this.isLoading = false;
      this.filteredDemandes = [];
      this.errorMessage = 'Le chargement a pris trop de temps. Veuillez réessayer.';
      this.cdr.detectChanges();
    }, 3000); // 3 secondes
    
    this.demandeService.getDemandes().subscribe({
      next: (demandes) => {
        clearTimeout(timeoutId);
        
        // Utiliser setTimeout pour éviter les erreurs de détection de changements
        setTimeout(() => {
          this.demandes = demandes || [];
          
          // Extraire les ordres de travail déjà utilisés
          this.ordresTravailUtilises.clear();
          this.demandes.forEach(demande => {
            if (demande.ordreTravailId) {
              this.ordresTravailUtilises.add(demande.ordreTravailId);
            }
          });
          
          // Mettre à jour les work orders disponibles après chargement des demandes
          this.updateOrdresTravailDisponibles();
          
          this.applyFilters();
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        clearTimeout(timeoutId);
        
        // Utiliser setTimeout pour éviter les erreurs de détection de changements
        setTimeout(() => {
          this.errorMessage = 'Erreur lors du chargement des demandes';
          this.isLoading = false;
          this.filteredDemandes = [];
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Charger les demandes terminées
  loadDemandesTerminees(): void {
    this.isLoadingTerminees = true;
    
    // Timeout de sécurité pour éviter le blocage indéfini
    const timeoutId = setTimeout(() => {
      this.isLoadingTerminees = false;
      this.demandesTerminees = [];
      this.errorMessage = 'Le chargement des demandes terminées a pris trop de temps. Veuillez réessayer.';
      this.cdr.detectChanges();
    }, 3000); // 3 secondes
    
    this.demandeService.getDemandes().subscribe({
      next: (demandes) => {
        clearTimeout(timeoutId);
        
        // Utiliser setTimeout pour éviter les erreurs de détection de changements
        setTimeout(() => {
          // Filtrer uniquement les demandes terminées
          this.demandesTerminees = (demandes || []).filter(demande => 
            demande.statut === 'TERMINE' || demande.statut === 'TERMINEE'
          );
          
          console.log(`Chargé ${this.demandesTerminees.length} demandes terminées`);
          
          this.isLoadingTerminees = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        clearTimeout(timeoutId);
        
        // Utiliser setTimeout pour éviter les erreurs de détection de changements
        setTimeout(() => {
          console.error('Erreur lors du chargement des demandes terminées:', err);
          this.errorMessage = 'Erreur lors du chargement des demandes terminées';
          this.demandesTerminees = [];
          this.isLoadingTerminees = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Charger les demandes de retour
  loadDemandesRetours(): void {
    this.isLoadingRetours = true;
    
    // Timeout de sécurité pour éviter le blocage indéfini
    const timeoutId = setTimeout(() => {
      this.isLoadingRetours = false;
      this.demandesRetours = [];
      this.errorMessage = 'Le chargement des demandes de retour a pris trop de temps. Veuillez réessayer.';
      this.cdr.detectChanges();
    }, 3000); // 3 secondes
    
    // Importer le service de demande de retour
    import('../demandes-retour/demande-retour.service').then(module => {
      const demandeRetourService = module.DemandeRetourService;
      const service = new demandeRetourService(this.http);
      
      service.getAll().subscribe({
        next: (retours) => {
          clearTimeout(timeoutId);
          
          // Utiliser setTimeout pour éviter les erreurs de détection de changements
          setTimeout(() => {
            this.demandesRetours = retours || [];
            console.log(`Chargé ${this.demandesRetours.length} demandes de retour`);
            
            this.isLoadingRetours = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          clearTimeout(timeoutId);
          
          // Utiliser setTimeout pour éviter les erreurs de détection de changements
          setTimeout(() => {
            console.error('Erreur lors du chargement des demandes de retour:', err);
            this.errorMessage = 'Erreur lors du chargement des demandes de retour';
            this.demandesRetours = [];
            this.isLoadingRetours = false;
            this.cdr.detectChanges();
          });
        }
      });
    }).catch(err => {
      clearTimeout(timeoutId);
      console.error('Erreur lors de l\'import du service de retour:', err);
      this.errorMessage = 'Erreur interne lors du chargement des demandes de retour';
      this.demandesRetours = [];
      this.isLoadingRetours = false;
      this.cdr.detectChanges();
    });
  }

  // Charger les ordres de travail
  loadOrdresTravail(): void {
    this.ordreTravailService.getOrdresTravail().subscribe({
      next: (ordres) => {
        this.ordresTravail = ordres || [];
        console.log('Ordres chargés:', this.ordresTravail.length);
        
        // Filtrer les work orders en attente ET non liés à une demande
        this.updateOrdresTravailDisponibles();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des ordres de travail:', err);
        this.ordresTravail = [];
        this.ordresTravailEnAttente = [];
      }
    });
  }

  // Mettre à jour les work orders disponibles (en attente et non liés à une demande)
  updateOrdresTravailDisponibles(): void {
    // Obtenir les IDs des work orders déjà utilisés dans des demandes
    const ordresTravailUtilises = new Set(this.demandes.map(d => d.ordreTravailId));
    
    // Filtrer: 1) en attente ET 2) non utilisés dans une demande
    this.ordresTravailEnAttente = this.ordresTravail.filter(ordre => 
      ordre.statut === 'EN_ATTENTE' && !ordresTravailUtilises.has(ordre.id)
    );
    
    console.log('Work orders utilisés dans les demandes:', Array.from(ordresTravailUtilises));
    console.log('Work orders disponibles pour création:', this.ordresTravailEnAttente.length);
    console.log('Détails des work orders disponibles:', this.ordresTravailEnAttente);
  }

  // Charger les utilisateurs
  loadUtilisateurs(): void {
    this.demandeService.getUtilisateurs().subscribe({
      next: (utilisateurs) => {
        this.utilisateurs = utilisateurs || [];
        // Charger les rôles pour chaque utilisateur
        this.loadUserRoles();
      },
      error: (err) => {
        this.utilisateurs = [];
      }
    });
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

  // Charger les rôles des utilisateurs
  loadUserRoles(): void {
    // Pré-calculer les noms utilisateurs
    this.utilisateurs.forEach(utilisateur => {
      this.utilisateurNames[utilisateur.id] = utilisateur.nomUtilisateur || `Utilisateur ${utilisateur.id}`;
    });
    
    console.log('Noms utilisateurs pré-calculés:', this.utilisateurNames);
    
    // Charger les rôles
    this.utilisateurs.forEach(utilisateur => {
      this.roleService.getRolesByUser(utilisateur.id).subscribe({
        next: (roles) => {
          this.utilisateurRoles[utilisateur.id] = roles;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(`Erreur lors du chargement des rôles de l'utilisateur ${utilisateur.id}:`, err);
          this.utilisateurRoles[utilisateur.id] = [];
          this.cdr.detectChanges();
        }
      });
    });
  }

  // Obtenir les alimentateurs
  getAlimentateurs(): Utilisateur[] {
    return this.utilisateurs.filter(user => 
      this.utilisateurRoles[user.id]?.some(role => role.nomRole === 'ALIMENTATEUR')
    );
  }

  // Obtenir les work orders disponibles pour la création (en attente et non liés à une demande)
  getOrdresTravailEnAttente(): OrdreTravail[] {
    console.log('getOrdresTravailEnAttente appelé - work orders disponibles:', this.ordresTravailEnAttente.length);
    console.log('Détails des work orders disponibles:', this.ordresTravailEnAttente);
    return this.ordresTravailEnAttente;
  }

  // Appliquer les filtres
  applyFilters(): void {
    this.filteredDemandes = this.demandes.filter(demande => {
      const statutMatch = !this.statutFilter || demande.statut === this.statutFilter;
      const prioriteMatch = !this.prioriteFilter || demande.niveauPriorite === this.prioriteFilter;
      
      // Exclure les demandes terminées (TERMINE ou TERMINEE) du tableau principal
      const estTerminee = demande.statut === 'TERMINE' || demande.statut === 'TERMINEE';
      
      return statutMatch && prioriteMatch && !estTerminee;
    });
  }

  // Ouvrir le modal pour créer une demande
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedDemande = null;
    this.resetForm();
    this.showModal = true;
  }

  // Ouvrir le modal pour modifier une demande
  openEditModal(demande: Demande): void {
    this.isEditMode = true;
    this.selectedDemande = demande;
    
    // Trouver l'ordre de travail associé
    this.selectedOrdreTravail = this.ordresTravail.find(o => o.id === demande.ordreTravailId) || null;
    
    this.formOrdreTravailId = demande.ordreTravailId;
    this.formAlimentateurId = demande.utilisateurAssigneId || null;
    this.formPriorite = demande.niveauPriorite;
    // Le statut n'est plus modifiable manuellement, il sera déterminé automatiquement
    
    this.showModal = true;
  }

  // Fermer le modal
  closeModal(): void {
    console.log('closeModal appelé - showModal avant:', this.showModal);
    console.log('closeModal appelé - isCreating avant:', this.isCreating);
    
    this.showModal = false;
    this.selectedDemande = null;
    this.resetForm();
    this.clearMessages();
    
    // Forcer la détection de changements
    this.cdr.detectChanges();
    
    // Forcer une deuxième détection pour s'assurer que le modal se ferme
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
    
    console.log('closeModal appelé - showModal après:', this.showModal);
    console.log('closeModal appelé - isCreating après:', this.isCreating);
  }

  // Réinitialiser le formulaire
  resetForm(): void {
    this.formOrdreTravailId = null;
    this.formAlimentateurId = null;
    this.formPriorite = 'NORMAL';
    // Le statut n'est plus modifiable manuellement
    this.selectedOrdreTravail = null;
    this.isCreating = false; // Réinitialiser l'état de création
  }

  // Gérer le changement d'ordre de travail
  onOrdreTravailChange(): void {
    if (this.formOrdreTravailId) {
      this.selectedOrdreTravail = this.ordresTravail.find(o => o.id === this.formOrdreTravailId) || null;
    } else {
      this.selectedOrdreTravail = null;
    }
  }

  // Obtenir les ordres de travail disponibles (non encore utilisés dans des demandes)
  getOrdresTravailDisponibles(): OrdreTravail[] {
    return this.ordresTravail.filter(ordre => !this.ordresTravailUtilises.has(ordre.id));
  }

  // Sauvegarder (créer ou modifier)
  save(): void {
    if (this.isCreating) {
      return; // Bloquer les clics multiples
    }

    // En mode création, l'ordre de travail est obligatoire
    // En mode modification, l'ordre de travail reste intact (pas de validation nécessaire)
    if (!this.isEditMode && !this.formOrdreTravailId) {
      this.errorMessage = 'L\'ordre de travail est obligatoire pour la création d\'une demande';
      return;
    }

    if (this.isEditMode && this.selectedDemande) {
      this.updateDemande();
    } else {
      this.createDemande();
    }
  }

  // Créer une demande
  createDemande(): void {
    console.log('!!! CRÉATION DEMANDE DÉMARRÉE !!!');
    
    if (!this.formOrdreTravailId) {
      console.log('!!! ERREUR: Ordre de travail manquant pour la création !!!');
      this.errorMessage = 'L\'ordre de travail est obligatoire pour la création d\'une demande';
      return;
    }

    // Vérifier que l'utilisateur est authentifié
    if (!this.currentUserId) {
      this.errorMessage = 'Utilisateur non authentifié. Veuillez vous reconnecter.';
      return;
    }

    // Activer l'état de création pour bloquer les clics
    this.isCreating = true;
    this.clearMessages();

    // Créer le DTO de base
    const demandeDto: CreateDemandeDto = {
      niveauPriorite: this.formPriorite,
      utilisateurId: this.currentUserId,        // L'utilisateur authentifié
      ordreTravailId: Number(this.formOrdreTravailId!)
    };

    // Ajouter l'alimentateur seulement si un est sélectionné
    // Le select HTML envoie "" quand rien n'est sélectionné
    if (this.formAlimentateurId && this.formAlimentateurId !== "") {
      demandeDto.utilisateurAssigneId = Number(this.formAlimentateurId);
    }

    const createMethod = this.formPriorite === 'PRIORITAIRE' 
      ? this.demandeService.createPrioritaire(demandeDto)
      : this.demandeService.create(demandeDto);

    // Debug détaillé pour diagnostiquer le problème
    console.log('=== DEBUG CRÉATION DEMANDE ===');
    console.log('formAlimentateurId:', this.formAlimentateurId);
    console.log('formAlimentateurId type:', typeof this.formAlimentateurId);
    console.log('formAlimentateurId === null:', this.formAlimentateurId === null);
    console.log('formAlimentateurId === undefined:', this.formAlimentateurId === undefined);
    console.log('formAlimentateurId === 0:', this.formAlimentateurId === 0);
    
    console.log('Payload final:', JSON.stringify(demandeDto, null, 2));
    console.log('URL:', this.formPriorite === 'PRIORITAIRE' ? 'http://localhost:5206/api/Demandes/prioritaire' : 'http://localhost:5206/api/Demandes');
    console.log('=== FIN DEBUG ===');

    createMethod.subscribe({
      next: (response) => {
        console.log('Création demande réussie - response:', response);
        console.log('Appel de closeModal après création réussie');
        
        // Ajouter l'ordre de travail utilisé dans le Set
        if (this.formOrdreTravailId) {
          this.ordresTravailUtilises.add(Number(this.formOrdreTravailId));
        }
        
        // Utiliser setTimeout pour éviter les erreurs de détection de changements
        setTimeout(() => {
          this.successMessage = 'Demande créée avec succès';
          console.log('Avant closeModal - showModal:', this.showModal);
          
          // Réactiver le bouton AVANT de fermer le modal
          this.isCreating = false; // Réactiver le bouton immédiatement
          
          this.closeModal(); // Fermer le modal
          console.log('Après closeModal - showModal:', this.showModal);
          
          // Recharger les données après la fermeture du modal
          this.loadDemandes(); // Recharger les données
          this.updateOrdresTravailDisponibles(); // Mettre à jour les work orders disponibles
          this.clearMessagesAfterDelay(); // Effacer le message après délai
        });
      },
      error: (err) => {
        console.error('Erreur détaillée lors de la création de la demande:', err);
        setTimeout(() => {
          let errorMsg = `Erreur lors de la création: `;
          
          if (err.status === 400) {
            errorMsg += 'Erreur de validation (400)';
          } else if (err.status === 500) {
            errorMsg += 'Erreur serveur (500)';
          } else {
            errorMsg += err.message || 'Erreur inconnue';
          }
          
          this.errorMessage = errorMsg;
          setTimeout(() => {
            this.isCreating = false; // Réactiver le bouton en cas d'erreur
          }, 0);
        });
        
        // Afficher plus de détails en cas d'erreur 400 ou 500
        if (err.status === 400 || err.status === 500) {
          console.error('Status:', err.status);
          
          // Créer une copie profonde sans la référence circulaire pour le debug
          const payloadCopy = {
            niveauPriorite: demandeDto.niveauPriorite,
            utilisateurId: demandeDto.utilisateurId,
            ordreTravailId: demandeDto.ordreTravailId,
            ...(demandeDto.utilisateurAssigneId && { utilisateurAssigneId: demandeDto.utilisateurAssigneId })
          };
          console.error('Payload envoyé:', JSON.stringify(payloadCopy, null, 2));
          
          console.error('URL:', this.formPriorite === 'PRIORITAIRE' ? 'http://localhost:5206/api/Demandes/prioritaire' : 'http://localhost:5206/api/Demandes');
          console.error('Erreur complète:', err);
          
          // Afficher le corps de l'erreur s'il existe
          if (err.error) {
            console.error('Corps de l\'erreur:', JSON.stringify(err.error, null, 2));
          }
        }
      }
    });
  }

  // Mettre à jour une demande
  updateDemande(): void {
    if (!this.selectedDemande) return;

    // Déterminer automatiquement le statut selon l'assignation
    let statut: 'NON_AFFECTEE' | 'EN_COURS' | 'TERMINE';
    let utilisateurAssigneId: number | null | undefined;

    // Logique automatique du statut
    if (this.formAlimentateurId && this.formAlimentateurId !== 0 && this.formAlimentateurId !== "") {
      statut = 'EN_COURS'; // Si un alimentateur est assigné, statut = EN_COURS
      utilisateurAssigneId = Number(this.formAlimentateurId);
    } else {
      statut = 'NON_AFFECTEE'; // Si aucun alimentateur, statut = NON_AFFECTEE
      utilisateurAssigneId = null; // S'assurer qu'il n'y a pas d'assignation
    }

    const dto: UpdateDemandeDto = {
      statut: statut,
      utilisateurAssigneId: utilisateurAssigneId
    };

    this.demandeService.update(this.selectedDemande.id, dto).subscribe({
      next: () => {
        setTimeout(() => {
          this.successMessage = 'Demande mise à jour avec succès';
          this.loadDemandes();
          this.closeModal();
          this.clearMessagesAfterDelay();
        });
      },
      error: (err) => {
        setTimeout(() => {
          this.errorMessage = 'Erreur lors de la mise à jour de la demande';
        });
        console.error('Erreur:', err);
      }
    });
  }

  // Ouvrir le modal de confirmation pour supprimer
  openDeleteModal(demande: Demande): void {
    this.confirmDemande = demande;
    this.confirmMessage = `Êtes-vous sûr de vouloir supprimer la demande pour la bobine "${demande.referenceBobine}" ?`;
    this.showConfirmModal = true;
  }

  // Confirmer la suppression
  confirmDelete(): void {
    if (this.confirmDemande) {
      this.demandeService.delete(this.confirmDemande.id).subscribe({
      next: () => {
        setTimeout(() => {
          this.successMessage = 'Demande supprimée avec succès';
          this.loadDemandes();
          this.closeConfirmModal();
          this.clearMessagesAfterDelay();
        });
      },
      error: (err) => {
        setTimeout(() => {
          this.errorMessage = 'Erreur lors de la suppression de la demande';
        });
        console.error('Erreur:', err);
      }
    });
    }
  }

  // Fermer le modal de confirmation
  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmDemande = null;
    this.confirmMessage = '';
  }

  // Obtenir le nom de l'utilisateur
  getUtilisateurName(utilisateurId: number | undefined): string {
    if (!utilisateurId) return 'Non assigné';
    
    // Debug pour voir ce qui se passe
    console.log(`Recherche nom pour utilisateur ID: ${utilisateurId}`);
    console.log('Noms pré-calculés disponibles:', this.utilisateurNames);
    console.log('Liste utilisateurs:', this.utilisateurs.map(u => ({ id: u.id, nom: u.nomUtilisateur })));
    
    // D'abord essayer les noms pré-calculés
    if (this.utilisateurNames[utilisateurId]) {
      console.log(`Nom trouvé dans pré-calculés: ${this.utilisateurNames[utilisateurId]}`);
      return this.utilisateurNames[utilisateurId];
    }
    
    // Si pas trouvé, chercher dans la liste des utilisateurs
    const utilisateur = this.utilisateurs.find(u => u.id === utilisateurId);
    if (utilisateur) {
      console.log(`Nom trouvé dans liste: ${utilisateur.nomUtilisateur}`);
      return utilisateur.nomUtilisateur || `Utilisateur ${utilisateurId}`;
    }
    
    console.log(`Aucun nom trouvé pour l'utilisateur ${utilisateurId}`);
    return `Utilisateur ${utilisateurId}`;
  }

  // Obtenir la classe CSS du statut
  getStatutClass(statut: string): string {
    switch (statut) {
      case 'NON_AFFECTEE': return 'badge-warning';
      case 'EN_COURS': return 'badge-info';
      case 'TERMINE': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  // Obtenir la classe CSS de la priorité
  getPrioriteClass(priorite: string): string {
    switch (priorite) {
      case 'PRIORITAIRE': return 'badge-danger';
      case 'NORMAL': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  }

  // Obtenir le label du statut
  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'NON_AFFECTEE': return 'Non affectée';
      case 'EN_COURS': return 'En cours';
      case 'TERMINE': return 'Terminée';
      default: return statut;
    }
  }

  // Obtenir le label de la priorité
  getPrioriteLabel(priorite: string): string {
    switch (priorite) {
      case 'PRIORITAIRE': return 'Prioritaire';
      case 'NORMAL': return 'Normal';
      default: return priorite;
    }
  }

  // Obtenir le numéro de l'ordre de travail
  getOrdreNumero(ordreId: number): string {
    // Si les ordres ne sont pas encore chargés
    if (this.ordresTravail.length === 0) {
      return `Chargement...`;
    }
    
    const ordre = this.ordresTravail.find(o => o.id === ordreId);
    if (!ordre) {
      console.warn(`Ordre non trouvé: ID ${ordreId}, ordres disponibles:`, 
        this.ordresTravail.map(o => ({ id: o.id, numero: o.numeroOrdre, machine: o.idMachine })));
      return `Ordre ${ordreId} non trouvé`;
    }
    
    return ordre.numeroOrdre;
  }

  // Obtenir la machine associée à un ordre de travail
  getMachineFromOrdre(ordreId: number): string {
    const ordre = this.ordresTravail.find(o => o.id === ordreId);
    return ordre ? ordre.idMachine : `Machine inconnue`;
  }

  // Effacer les messages après un délai
  clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.clearMessages();
    }, 3000);
  }

  // Obtenir le statut direct de la bobine
  getBobineStatusText(bobineId: number): string {
    if (!bobineId || bobineId === 0) return 'Aucune bobine';
    
    const bobine = this.bobines.find(b => b.id === bobineId);
    if (!bobine) return 'Inconnu';
    
    switch (bobine.statut) {
      case 'DISPONIBLE': return 'Disponible';
      case 'RESERVEE': return 'Réservée';
      case 'EN_PRELEVEMENT': return 'En prélèvement';
      case 'EN_COURS': return 'En utilisation';
      case 'EPUISEE': return 'Épuisée';
      default: return 'Inconnu';
    }
  }

  // Obtenir la classe CSS pour le statut de la bobine
  getBobineStatusClass(bobineId: number): string {
    if (!bobineId || bobineId === 0) return 'status-no-bobine';
    
    const bobine = this.bobines.find(b => b.id === bobineId);
    if (!bobine) return 'status-inconnu';
    
    switch (bobine.statut) {
      case 'DISPONIBLE': return 'status-disponible';
      case 'RESERVEE': return 'status-reservee';
      case 'EN_PRELEVEMENT': return 'status-en-prelevement';
      case 'EN_COURS': return 'status-en-cours';
      case 'EPUISEE': return 'status-epuisee';
      default: return 'status-inconnu';
    }
  }

  // Effacer les messages
  clearMessages(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }

  // Vérifier si la demande peut être modifiée
  canModifyDemande(demande: Demande): boolean {
    // Les demandes terminées ne peuvent pas être modifiées
    return demande.statut !== 'TERMINE' && demande.statut !== 'TERMINEE';
  }

  // Voir les détails d'une demande
  viewDetails(demande: Demande): void {
    console.log('Affichage des détails de la demande:', demande);
    this.selectedDemandeForDetails = demande;
    this.showDetailsModal = true;
  }

  // Fermer le modal des détails
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedDemandeForDetails = null;
  }

  // Créer une demande de retour à partir d'une demande terminée
  createRetourFromDemande(demande: Demande): void {
    if (!demande.bobineId) {
      this.errorMessage = 'Cette demande n\'a pas de bobine associée, impossible de créer un retour';
      this.clearMessagesAfterDelay();
      return;
    }

    console.log('Création de retour depuis demande terminée:', demande);
    
    // Importer le service de demande de retour
    import('../demandes-retour/demande-retour.service').then(module => {
      const demandeRetourService = module.DemandeRetourService;
      const service = new demandeRetourService(this.http);
      
      const createRetourDto = {
        bobineId: demande.bobineId!,
        demandeId: demande.id,
        operateurId: this.currentUserId || undefined
      };
      
      service.create(createRetourDto).subscribe({
        next: (retour) => {
          console.log('Demande de retour créée:', retour);
          this.successMessage = `Demande de retour #${retour.id} créée avec succès à partir de la demande #${demande.id}`;
          this.clearMessagesAfterDelay();
        },
        error: (err) => {
          console.error('Erreur lors de la création de la demande de retour:', err);
          this.errorMessage = 'Erreur lors de la création de la demande de retour';
          this.clearMessagesAfterDelay();
        }
      });
    }).catch(err => {
      console.error('Erreur lors de l\'import du service:', err);
      this.errorMessage = 'Erreur interne lors de la création de la demande de retour';
      this.clearMessagesAfterDelay();
    });
  }

  // Méthodes pour les demandes de retour
  trackByRetourId(index: number, retour: any): number {
    return retour.id;
  }

  // Obtenir le libellé du statut de retour
  getRetourStatutLabel(statut: string): string {
    // Retourner le statut brut du backend sans traduction
    return statut || 'Inconnu';
  }

  // Obtenir la classe CSS pour le statut de retour
  getRetourStatutClass(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'status-gris';
      case 'ACTIF': return 'status-actif';
      case 'TERMINE': return 'status-termine';
      default: return 'status-inconnu';
    }
  }

  // Obtenir le nom de l'utilisateur assigné au retour
  getRetourUtilisateurName(utilisateurId: number | undefined): string {
    if (!utilisateurId) return 'Non assigné';
    const utilisateur = this.utilisateurs.find(u => u.id === utilisateurId);
    return utilisateur ? utilisateur.nomUtilisateur : `Utilisateur ${utilisateurId}`;
  }

  // Obtenir le nom de l'opérateur du retour
  getRetourOperateurName(operateurId: number | undefined): string {
    if (!operateurId) return 'Non spécifié';
    const operateur = this.utilisateurs.find(u => u.id === operateurId);
    return operateur ? operateur.nomUtilisateur : `Opérateur ${operateurId}`;
  }

  // Obtenir le nom de l'opérateur via la chaîne: Demande Retour → Demande → Ordre de Travail → Opérateur
  getRetourOperateurNameFromDemande(retour: any): string {
    if (!retour.demandeId) return 'Non spécifié';
    
    // Chercher la demande associée
    const demandeAssociee = this.demandes.find(d => d.id === retour.demandeId);
    if (!demandeAssociee || !demandeAssociee.ordreTravailId) {
      return 'Non spécifié';
    }
    
    // Chercher l'ordre de travail associé
    const ordreTravail = this.ordresTravail.find(ot => ot.id === demandeAssociee.ordreTravailId);
    if (!ordreTravail || !ordreTravail.utilisateurId) {
      return 'Non spécifié';
    }
    
    // Chercher l'opérateur
    const operateur = this.utilisateurs.find(u => u.id === ordreTravail.utilisateurId);
    return operateur ? operateur.nomUtilisateur : `Opérateur ${ordreTravail.utilisateurId}`;
  }

  // Obtenir la machine via la chaîne: Demande Retour → Demande → Ordre de Travail → Machine
  getRetourMachineFromDemande(retour: any): string {
    if (!retour.demandeId) return 'Non spécifié';
    
    // Chercher la demande associée
    const demandeAssociee = this.demandes.find(d => d.id === retour.demandeId);
    if (!demandeAssociee || !demandeAssociee.ordreTravailId) {
      return 'Non spécifié';
    }
    
    // Chercher l'ordre de travail associé
    const ordreTravail = this.ordresTravail.find(ot => ot.id === demandeAssociee.ordreTravailId);
    if (!ordreTravail || !ordreTravail.idMachine) {
      return 'Non spécifié';
    }
    
    // Retourner l'ID de la machine
    return ordreTravail.idMachine;
  }

  
  // Vérifier si le retour peut être exécuté
  canExecuteRetour(retour: any): boolean {
    return retour.statut === 'ACTIF';
  }

  // Voir les détails d'une demande de retour
  viewRetourDetails(retour: any): void {
    console.log('Affichage des détails de la demande de retour:', retour);
    this.selectedRetourForDetails = retour;
    this.showRetourDetailsModal = true;
  }

  // Fermer le modal des détails de la demande de retour
  closeRetourDetailsModal(): void {
    this.showRetourDetailsModal = false;
    this.selectedRetourForDetails = null;
  }

  // Assigner une demande de retour - Ouvre le modal de sélection
  assignerRetour(retour: any): void {
    console.log('Ouverture du modal d\'assignation pour la demande de retour:', retour);
    this.selectedRetour = retour;
    this.selectedUtilisateurId = retour.utilisateurId || null; // Pré-sélectionner l'utilisateur actuel
    this.showAssignationModal = true;
    this.loadUtilisateursDisponibles(); // Charger la liste des utilisateurs disponibles
  }

  // Charger la liste des utilisateurs disponibles (ADMIN et ALIMENTATEUR)
  loadUtilisateursDisponibles(): void {
    this.loadingUtilisateurs = true;
    
    // Utiliser les mêmes utilisateurs que ceux chargés pour le formulaire
    // Filtrer pour garder les ADMIN et ALIMENTATEUR (comme getAlimentateurs mais + ADMIN)
    this.utilisateursDisponibles = this.utilisateurs.filter(user => 
      this.utilisateurRoles[user.id]?.some(role => 
        role.nomRole === 'ADMIN' || role.nomRole === 'ALIMENTATEUR'
      )
    );
    
    console.log('Utilisateurs chargés depuis this.utilisateurs:', this.utilisateurs);
    console.log('Utilisateurs disponibles pour assignation:', this.utilisateursDisponibles);
    this.loadingUtilisateurs = false;
  }

  // Confirmer l'assignation
  confirmerAssignation(): void {
    if (!this.selectedRetour) return;
    
    const body = {
      utilisateurId: this.selectedUtilisateurId
    };
    
    // Utiliser le nouvel endpoint PUT
    this.http.put(`http://localhost:5206/api/DemandesRetour/${this.selectedRetour.id}`, body).subscribe({
      next: (updatedRetour) => {
        console.log('Demande de retour assignée avec succès:', updatedRetour);
        this.successMessage = `Demande de retour #${this.selectedRetour.id} assignée avec succès`;
        this.showAssignationModal = false;
        this.selectedRetour = null;
        this.selectedUtilisateurId = null;
        this.loadDemandesRetours(); // Recharger la liste
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        console.error('Erreur lors de l\'assignation:', err);
        this.errorMessage = 'Erreur lors de l\'assignation de la demande de retour';
        this.clearMessagesAfterDelay();
      }
    });
  }

  // Annuler l'assignation
  annulerAssignation(): void {
    this.showAssignationModal = false;
    this.selectedRetour = null;
    this.selectedUtilisateurId = null;
  }

  // Exécuter une demande de retour
  executeRetour(retour: any): void {
    console.log('Exécution de la demande de retour:', retour);
    
    // Importer le service de demande de retour
    import('../demandes-retour/demande-retour.service').then(module => {
      const DemandeRetourService = module.DemandeRetourService;
      const service = new DemandeRetourService(this.http);
      
      const executeDto = {
        utilisateurId: this.currentUserId || undefined,
        emplacementRetourId: undefined
      };
      
      service.execute(retour.id, executeDto).subscribe({
        next: (updatedRetour) => {
          console.log('Demande de retour exécutée:', updatedRetour);
          this.successMessage = `Demande de retour #${retour.id} exécutée avec succès`;
          this.loadDemandesRetours(); // Recharger la liste
          this.clearMessagesAfterDelay();
        },
        error: (err) => {
          console.error('Erreur lors de l\'exécution:', err);
          this.errorMessage = 'Erreur lors de l\'exécution de la demande de retour';
          this.clearMessagesAfterDelay();
        }
      });
    }).catch(err => {
      console.error('Erreur lors de l\'import du service:', err);
      this.errorMessage = 'Erreur interne lors de l\'exécution';
      this.clearMessagesAfterDelay();
    });
  }

  // TrackBy pour optimiser le ngFor
  trackByDemandeId(index: number, demande: Demande): number {
    return demande.id;
  }
}
