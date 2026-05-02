import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BobineService, Bobine, CreateBobineDto, UpdateBobineDto, EmplacementStockage } from '../../services/bobine.service';
import { RoleService } from '../../services/role.service';
import { DemandeService, Demande, UpdateDemandeDto } from '../../services/demande.service';

@Component({
  selector: 'app-bobines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bobines.component.html',
  styleUrl: './bobines.component.css'
})
export class Bobines implements OnInit {
  bobines: Bobine[] = [];
  emplacementsVides: EmplacementStockage[] = [];
  filteredBobines: Bobine[] = [];
  
  // États du composant
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Modal
  showModal = false;
  isEditMode = false;
  selectedBobine: Bobine | null = null;
  
  // Modal de confirmation
  showConfirmModal = false;
  confirmAction: 'reserver' | 'liberer' | 'delete' | null = null;
  confirmBobine: Bobine | null = null;
  confirmMessage: string = '';
  
  // Formulaire
  formReference = '';
  formEmplacementId: number | null = null;
  
  // Filtres
  statutFilter = '';
  referenceFilter = '';
  
  // Statuts possibles
  statutsPossibles = ['DISPONIBLE', 'RESERVEE', 'EN_PRELEVEMENT', 'EN_COURS', 'EPUISEE'];

  constructor(private bobineService: BobineService, private cdr: ChangeDetectorRef, private roleService: RoleService, private demandeService: DemandeService) {}

  ngOnInit(): void {
    this.loadBobines();
    this.loadEmplacementsVides();
  }

  // Charger toutes les bobines
  loadBobines(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.bobineService.getAll().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges(); // Forcer la détection de changement
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des bobines';
        this.isLoading = false;
        this.cdr.detectChanges(); // Forcer la détection de changement
        console.error('Erreur:', err);
      }
    });
  }

  // Charger les bobines disponibles uniquement
  loadBobinesDisponibles(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.bobineService.getBobinesDisponibles().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges(); // Forcer la détection de changement
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des bobines disponibles';
        this.isLoading = false;
        this.cdr.detectChanges(); // Forcer la détection de changement
        console.error('Erreur:', err);
      }
    });
  }

  // Charger les emplacements vides
  loadEmplacementsVides(): void {
    this.bobineService.getEmplacementsVides().subscribe({
      next: (emplacements) => {
        this.emplacementsVides = emplacements;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des emplacements vides:', err);
      }
    });
  }

  // Appliquer les filtres
  applyFilters(): void {
    this.filteredBobines = this.bobines.filter(bobine => {
      const statutMatch = !this.statutFilter || bobine.statut === this.statutFilter;
      const referenceMatch = !this.referenceFilter || 
        bobine.referenceBobine.toLowerCase().includes(this.referenceFilter.toLowerCase());
      return statutMatch && referenceMatch;
    });
  }

  // Ouvrir le modal pour créer
  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedBobine = null;
    this.formReference = '';
    this.formEmplacementId = null;
    this.showModal = true;
    this.clearMessages();
  }

  // Ouvrir le modal pour modifier
  openEditModal(bobine: Bobine): void {
    this.isEditMode = true;
    this.selectedBobine = bobine;
    this.formReference = bobine.referenceBobine;
    this.formEmplacementId = bobine.emplacementActuelId || null;
    this.showModal = true;
    this.clearMessages();
  }

  
  // Log pour le bouton réserver
  logReserverClick(bobine: Bobine): void {
    console.log('Bouton Réserver cliqué pour:', bobine.referenceBobine);
  }

  // Log pour le bouton libérer
  logLibererClick(bobine: Bobine): void {
    console.log('Bouton Libérer cliqué pour:', bobine.referenceBobine);
  }

  // Ouvrir le modal de confirmation
  openConfirmModal(action: 'reserver' | 'liberer' | 'delete', bobine: Bobine): void {
    this.confirmAction = action;
    this.confirmBobine = bobine;
    
    switch (action) {
      case 'reserver':
        this.confirmMessage = `Êtes-vous sûr de vouloir réserver la bobine "${bobine.referenceBobine}" ?`;
        break;
      case 'liberer':
        this.confirmMessage = `Êtes-vous sûr de vouloir libérer la bobine "${bobine.referenceBobine}" ?`;
        break;
      case 'delete':
        this.confirmMessage = `Êtes-vous sûr de vouloir supprimer la bobine "${bobine.referenceBobine}" ?`;
        break;
    }
    
    this.showConfirmModal = true;
  }

  // Confirmer l'action
  confirmActionExecute(): void {
    if (!this.confirmBobine || !this.confirmAction) return;
    
    switch (this.confirmAction) {
      case 'reserver':
        this.executeReserver(this.confirmBobine);
        break;
      case 'liberer':
        this.executeLiberer(this.confirmBobine);
        break;
      case 'delete':
        this.executeDelete(this.confirmBobine);
        break;
    }
    
    this.closeConfirmModal();
  }

  // Fermer le modal de confirmation
  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
    this.confirmBobine = null;
    this.confirmMessage = '';
  }

  // Fermer le modal
  closeModal(): void {
    this.showModal = false;
    this.selectedBobine = null;
    this.formReference = '';
    this.formEmplacementId = null;
    this.clearMessages();
  }

  // Sauvegarder (créer ou modifier)
  save(): void {
    if (!this.formReference.trim()) {
      this.errorMessage = 'La référence est obligatoire';
      return;
    }

    if (this.isEditMode && this.selectedBobine) {
      // Mode modification
      const dto: UpdateBobineDto = {
        referenceBobine: this.formReference.trim(),
        emplacementActuelId: this.formEmplacementId || undefined
      };

      this.bobineService.update(this.selectedBobine.id, dto).subscribe({
        next: () => {
          this.successMessage = 'Bobine modifiée avec succès';
          
          // Recharger les données
          this.loadBobines();
          this.loadEmplacementsVides(); // Recharger les emplacements pour la grille
          
          // Fermer le modal immédiatement et forcer la détection de changement
          this.closeModal();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erreur lors de la modification:', err);
          console.error('Status:', err.status);
          console.error('Message:', err.message);
          console.error('Error:', err.error);
          
          if (err.status === 500) {
            // Extraire le message d'erreur spécifique du backend
            const backendError = err.error?.error || err.error?.message || err.error;
            if (backendError && typeof backendError === 'string') {
              this.errorMessage = backendError;
            } else {
              this.errorMessage = 'Erreur serveur lors de la modification. Vérifiez les logs du backend.';
            }
          } else if (err.status === 400) {
            this.errorMessage = 'Données invalides. Vérifiez les champs du formulaire.';
          } else if (err.status === 404) {
            this.errorMessage = 'Bobine non trouvée.';
          } else {
            this.errorMessage = `Erreur lors de la modification de la bobine (${err.status})`;
          }
        }
      });
    } else {
      // Mode création
      const dto: CreateBobineDto = {
        referenceBobine: this.formReference.trim(),
        emplacementActuelId: this.formEmplacementId || undefined
      };

      this.bobineService.create(dto).subscribe({
        next: () => {
          this.successMessage = 'Bobine créée avec succès';
          this.loadBobines();
          this.loadEmplacementsVides(); // Recharger les emplacements
          
          // Fermer le modal immédiatement et forcer la détection de changement
          this.closeModal();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors de la création de la bobine';
          console.error('Erreur:', err);
        }
      });
    }
  }

  // Exécuter la suppression (sans confirmation)
  executeDelete(bobine: Bobine): void {
    console.log('=== TENTATIVE SUPPRESSION BOBINE ===');
    console.log('Bobine ID:', bobine.id);
    console.log('Bobine référence:', bobine.referenceBobine);
    console.log('Bobine statut:', bobine.statut);
    
    this.bobineService.delete(bobine.id).subscribe({
      next: () => {
        console.log('Suppression normale réussie');
        this.successMessage = 'Bobine supprimée avec succès';
        this.loadBobines();
        this.loadEmplacementsVides(); // Recharger les emplacements
        this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        console.error('=== ERREUR SUPPRESSION NORMALE ===');
        console.error('Status:', err.status);
        console.error('Error body:', err.error);
        
        // Si erreur 500 ou 409, essayer de libérer la bobine puis la supprimer
        if (err.status === 500 || err.status === 409) {
          console.log('Tentative de libération de la bobine avant suppression...');
          
          // D'abord libérer la bobine pour la détacher des demandes
          this.bobineService.liberer(bobine.id).subscribe({
            next: () => {
              console.log('Bobine libérée avec succès, tentative de suppression...');
              
              // Puis supprimer la bobine maintenant qu'elle est libérée
              this.bobineService.delete(bobine.id).subscribe({
                next: () => {
                  console.log('Suppression après libération réussie');
                  this.successMessage = `Bobine "${bobine.referenceBobine}" supprimée avec succès (après libération)`;
                  this.loadBobines();
                  this.loadEmplacementsVides(); // Recharger les emplacements
                  this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
                  this.clearMessagesAfterDelay();
                },
                error: (deleteErr) => {
                  console.error('=== ERREUR SUPPRESSION APRÈS LIBÉRATION ===');
                  console.error('Erreur:', deleteErr);
                  console.error('Status:', deleteErr.status);
                  
                  // Afficher l'erreur détaillée
                  let backendMessage = 'Erreur lors de la suppression après libération';
                  
                  if (deleteErr.error?.message) {
                    backendMessage = deleteErr.error.message;
                  } else if (deleteErr.error?.error) {
                    backendMessage = deleteErr.error.error;
                  } else if (deleteErr.error && typeof deleteErr.error === 'string') {
                    backendMessage = deleteErr.error;
                  }
                  
                  this.errorMessage = `Impossible de supprimer cette bobine (${bobine.statut}). Erreur: ${backendMessage}`;
                }
              });
            },
            error: (libererErr) => {
              console.error('=== ERREUR LIBÉRATION ===');
              console.error('Erreur:', libererErr);
              console.error('Status:', libererErr.status);
              
              // Si la libération échoue, essayer la suppression forcée si disponible
              if (libererErr.status !== 404) {
                console.log('Tentative de suppression forcée (admin)...');
                
                this.bobineService.forceDelete(bobine.id).subscribe({
                  next: () => {
                    console.log('Suppression forcée réussie');
                    this.successMessage = `Bobine "${bobine.referenceBobine}" supprimée avec succès (mode admin)`;
                    this.loadBobines();
                    this.loadEmplacementsVides(); // Recharger les emplacements
                    this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
                    this.clearMessagesAfterDelay();
                  },
                  error: (forceErr) => {
                    console.error('=== ERREUR SUPPRESSION FORCÉE ===');
                    console.error('Erreur:', forceErr);
                    console.error('Status:', forceErr.status);
                    
                    let backendMessage = 'Erreur lors de la suppression forcée';
                    
                    if (forceErr.error?.message) {
                      backendMessage = forceErr.error.message;
                    } else if (forceErr.error?.error) {
                      backendMessage = forceErr.error.error;
                    } else if (forceErr.error && typeof forceErr.error === 'string') {
                      backendMessage = forceErr.error;
                    }
                    
                    this.errorMessage = `Impossible de supprimer cette bobine (${bobine.statut}). Erreur: ${backendMessage}`;
                  }
                });
              } else {
                // L'endpoint force n'existe pas
                this.errorMessage = `Impossible de supprimer cette bobine (${bobine.statut}). Elle est liée à une demande et l'endpoint de suppression forcée n'est pas disponible. Détail: ${libererErr.status} - ${libererErr.statusText}`;
              }
            }
          });
        } else {
          // Autres erreurs
          if (err.status === 404) {
            this.errorMessage = 'Bobine non trouvée';
          } else {
            this.errorMessage = `Erreur lors de la suppression de la bobine (${err.status}): ${err.statusText}`;
          }
        }
      }
    });
  }

  // Supprimer une bobine (avec confirmation)
  deleteBobine(bobine: Bobine): void {
    this.openConfirmModal('delete', bobine);
  }

  // Exécuter la réservation (sans confirmation)
  executeReserver(bobine: Bobine): void {
    // Récupérer l'ID utilisateur depuis le token
    const userId = this.roleService.getUserId();
    if (!userId) {
      this.errorMessage = 'Utilisateur non connecté';
      return;
    }
    
    console.log('=== RÉSERVATION BOBINE ===');
    console.log('Bobine ID:', bobine.id);
    console.log('Bobine référence:', bobine.referenceBobine);
    console.log('Bobine statut actuel:', bobine.statut);
    console.log('Utilisateur ID:', userId);
    console.log('Envoi de la requête POST /api/Bobines/' + bobine.id + '/reserver');
    console.log('Body:', { utilisateurId: userId });
    
    this.bobineService.reserver(bobine.id, userId).subscribe({
      next: (response) => {
        console.log('=== RÉSERVATION RÉUSSIE ===');
        console.log('Response:', response);
        console.log('Bobine réservée avec succès');
        
        this.successMessage = `Bobine "${bobine.referenceBobine}" réservée avec succès`;
        
        // Rafraîchir les données
        console.log('Rafraîchissement des données...');
        this.loadBobines();
        this.loadEmplacementsVides(); // Recharger les emplacements
        
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        console.error('=== ERREUR RÉSERVATION ===');
        console.error('Erreur:', err);
        console.error('Status:', err.status);
        console.error('Message:', err.error);
        
        if (err.status === 409) {
          // Conflit - bobine déjà réservée
          let backendMessage = 'Cette bobine est déjà réservée';
          
          if (err.error?.message) {
            backendMessage = err.error.message;
          } else if (err.error && typeof err.error === 'string') {
            backendMessage = err.error;
          }
          
          this.errorMessage = `Conflit: ${backendMessage}`;
        } else if (err.status === 400) {
          this.errorMessage = 'Cette bobine ne peut plus être réservée';
        } else if (err.status === 404) {
          this.errorMessage = 'Bobine non trouvée';
        } else {
          this.errorMessage = 'Erreur lors de la réservation de la bobine';
        }
      }
    });
  }

  // Réserver une bobine (avec confirmation)
  reserverBobine(bobine: Bobine): void {
    this.openConfirmModal('reserver', bobine);
  }

  // Exécuter la libération (sans confirmation)
  executeLiberer(bobine: Bobine): void {
    console.log('=== LIBÉRATION BOBINE ===');
    console.log('Bobine ID:', bobine.id);
    console.log('Bobine référence:', bobine.referenceBobine);
    console.log('Bobine statut actuel:', bobine.statut);
    console.log('Envoi de la requête POST /api/Bobines/' + bobine.id + '/liberer');
    
    this.bobineService.liberer(bobine.id).subscribe({
      next: (response) => {
        console.log('=== LIBÉRATION RÉUSSIE ===');
        console.log('Response:', response);
        console.log('Bobine libérée avec succès');
        
        this.successMessage = `Bobine "${bobine.referenceBobine}" libérée avec succès`;
        
        // Chercher et mettre à jour la demande associée
        console.log('Recherche de la demande associée à la bobine:', bobine.id);
        this.demandeService.getDemandes().subscribe({
          next: (demandes: Demande[]) => {
            const demandeAssociee = demandes.find((d: Demande) => d.bobineId === bobine.id);
            if (demandeAssociee) {
              console.log('Demande associée trouvée:', demandeAssociee.id);
              console.log('Mise à jour de la demande pour retirer le bobineId');
              
              // Mettre à jour la demande pour retirer le bobineId
              const updateDto: UpdateDemandeDto = {
                bobineId: null,              // Détacher complètement la bobine (NULL en base)
                dateAffectation: null,       // Effacer la date d'affectation
                statut: 'NON_AFFECTEE'       // Remettre la demande en statut non affectée
              };
              
              this.demandeService.update(demandeAssociee.id, updateDto).subscribe({
                next: () => {
                  console.log('Demande mise à jour avec succès - bobineId détaché');
                  // Rafraîchir toutes les données
                  this.loadBobines();
                  this.loadEmplacementsVides();
                  this.clearMessagesAfterDelay();
                },
                error: (err: any) => {
                  console.error('Erreur lors de la mise à jour de la demande:', err);
                  // Même si la mise à jour de la demande échoue, la bobine est libérée
                  this.loadBobines();
                  this.loadEmplacementsVides();
                  this.clearMessagesAfterDelay();
                }
              });
            } else {
              console.log('Aucune demande associée trouvée pour cette bobine');
              // Rafraîchir seulement les bobines et emplacements
              this.loadBobines();
              this.loadEmplacementsVides();
              this.clearMessagesAfterDelay();
            }
          },
          error: (err: any) => {
            console.error('Erreur lors du chargement des demandes:', err);
            // Même si on ne trouve pas la demande, la bobine est libérée
            this.loadBobines();
            this.loadEmplacementsVides();
            this.clearMessagesAfterDelay();
          }
        });
      },
      error: (err) => {
        console.error('=== ERREUR LIBÉRATION ===');
        console.error('Erreur:', err);
        console.error('Status:', err.status);
        console.error('Message:', err.error);
        
        if (err.status === 409) {
          // Conflit - bobine ne peut pas être libérée
          let backendMessage = 'Cette bobine ne peut pas être libérée';
          
          if (err.error?.message) {
            backendMessage = err.error.message;
          } else if (err.error && typeof err.error === 'string') {
            backendMessage = err.error;
          }
          
          this.errorMessage = `Conflit: ${backendMessage}`;
        } else if (err.status === 400) {
          this.errorMessage = 'Cette bobine ne peut pas être libérée';
        } else if (err.status === 404) {
          this.errorMessage = 'Bobine non trouvée';
        } else {
          this.errorMessage = 'Erreur lors de la libération de la bobine';
        }
      }
    });
  }

  // Libérer une bobine (avec confirmation)
  libererBobine(bobine: Bobine): void {
    this.openConfirmModal('liberer', bobine);
  }

  // Obtenir le libellé du statut
  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'Disponible';
      case 'RESERVEE': return 'Réservée';
      case 'EN_PRELEVEMENT': return 'En prélèvement';
      case 'EN_COURS': return 'En utilisation';
      case 'EPUISEE': return 'Terminée';
      default: return statut;
    }
  }

  // Obtenir la classe CSS pour le statut
  getStatutClass(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'badge-success';
      case 'RESERVEE': return 'badge-warning';
      case 'EN_PRELEVEMENT': return 'badge-info';
      case 'EN_COURS': return 'badge-primary';
      case 'EPUISEE': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  }

  // Nettoyer les messages
  clearMessages(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }

  // Nettoyer les messages après un délai
  clearMessagesAfterDelay(): void {
    setTimeout(() => this.clearMessages(), 3000);
  }

  // Formater la date
  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
