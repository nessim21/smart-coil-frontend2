import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmplacementStockageService, EmplacementStockage, Bobine } from '../../services/emplacement-stockage.service';
import { ZoneService, Zone } from '../../services/zone.service';
import { RoleService } from '../../services/role.service';

@Component({
  selector: 'app-stock-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-grid.html',
  styleUrl: './stock-grid.css'
})
export class StockGrid implements OnInit {
  emplacements: EmplacementStockage[] = [];
  bobines: Bobine[] = [];
  zones: Zone[] = [];
  selectedZone: string = '';
  loading = false;
  errorMessage: string | null = null;

  // Grille de stockage
  grille: EmplacementStockage[][] = [];
  nombreRangees: number = 0;
  nombreColonnes: number = 0;
  
  // Limites d'affichage
  readonly MAX_RANGEES_AFFICHES = 10;
  readonly MAX_COLONNES_AFFICHES = 10;
  
  // Filtres de recherche
  searchRangee: string = '';
  searchColonne: string = '';
  searchCoordonnee: string = '';

  // Propriétés pour l'ajout de bobine
  showAddBobineModal = false;
  selectedEmplacement: EmplacementStockage | null = null;
  bobineReference: string = '';
  
  // Messages pour l'ajout de bobine
  bobineErrorMessage: string | null = null;
  bobineSuccessMessage: string | null = null;

  // Flag pour empêcher les créations multiples
  isCreatingBobine: boolean = false;

  // Vérification du rôle
  isAlimentateur: boolean = false;

  // Propriétés pour la suppression de bobine
  showRemoveBobineModal = false;
  bobineToRemoveReference: string = '';
  bobineToRemoveEmplacement: string = '';
  emplacementToRemove: EmplacementStockage | null = null;

  constructor(
    private emplacementService: EmplacementStockageService,
    private zoneService: ZoneService,
    private cdr: ChangeDetectorRef,
    private roleService: RoleService
  ) {}

  ngOnInit(): void {
    // Vérifier si l'utilisateur est un alimentateur
    const userRole = this.roleService.getActiveRole();
    this.isAlimentateur = userRole === 'ALIMENTATEUR';
    
    this.loadZones();
  }

  loadZones(): void {
    this.loading = true;
    this.errorMessage = null;
    
    this.zoneService.getAll().subscribe({
      next: (zones) => {
        console.log('Zones chargées:', zones);
        this.zones = zones;
        if (zones.length > 0) {
          console.log('Première zone:', zones[0]);
          this.selectedZone = zones[0].codeZone || zones[0].id;
          console.log('selectedZone initialisé:', this.selectedZone);
          this.loadGrille();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des zones:', err);
        this.errorMessage = 'Erreur lors du chargement des zones';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadGrille(): void {
    console.log('=== DÉBUT loadGrille ===');
    console.log('selectedZone:', this.selectedZone);
    
    if (!this.selectedZone) {
      console.log('Aucune zone sélectionnée');
      return;
    }

    console.log('Début du chargement...');
    this.loading = true;
    this.errorMessage = '';
    
    console.log(`Chargement de la grille pour la zone: ${this.selectedZone}`);
    // Récupérer la zone sélectionnée pour obtenir ses dimensions
    const selectedZoneData = this.zones.find(z => (z.codeZone || z.id) === this.selectedZone);
    if (!selectedZoneData) {
      console.error('Zone sélectionnée non trouvée:', this.selectedZone);
      this.errorMessage = 'Zone sélectionnée non trouvée';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    console.log('Zone sélectionnée:', selectedZoneData);

    // Charger les emplacements et bobines en parallèle
    let emplacementsLoaded = false;
    let bobinesLoaded = false;

    // Charger les emplacements
    this.emplacementService.getAll().subscribe({
      next: (emplacements) => {
        try {
          // Filtrer les emplacements pour la zone sélectionnée
          this.emplacements = emplacements.filter(e => e.codeZone === this.selectedZone);
          console.log('Emplacements filtrés pour la zone:', this.emplacements);
          
          this.nombreRangees = selectedZoneData.nombreRangees || 10;
          this.nombreColonnes = selectedZoneData.nombreColonnes || 10;
          
          emplacementsLoaded = true;
          if (bobinesLoaded) {
            // Construire la grille seulement si les bobines sont déjà chargées
            this.construireGrille();
            this.loading = false;
            this.cdr.detectChanges();
          }
        } catch (filterError) {
          console.error('Erreur lors du filtrage des emplacements:', filterError);
          this.errorMessage = 'Erreur lors du filtrage des emplacements';
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des emplacements:', err);
        this.errorMessage = 'Erreur lors du chargement des emplacements (Erreur 500 du serveur)';
        this.loading = false;
        this.cdr.detectChanges();
        
        // Continuer avec une grille vide pour éviter de bloquer l'interface
        this.emplacements = [];
        this.construireGrille();
      }
    });

    // Charger les bobines
    this.emplacementService.getAllBobines().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
        console.log('Bobines chargées:', this.bobines.length);
        
        bobinesLoaded = true;
        if (emplacementsLoaded) {
          // Construire la grille seulement si les emplacements sont déjà chargés
          this.construireGrille();
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des bobines:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  construireGrille(): void {
    console.log('Construction de la grille - Dimensions:', this.nombreRangees, 'x', this.nombreColonnes);
    
    // Initialiser la grille avec des emplacements virtuels vides
    this.grille = Array(this.nombreRangees).fill(null).map((_, rangeeIndex) => 
      Array(this.nombreColonnes).fill(null).map((_, colonneIndex) => {
        // Créer un emplacement virtuel pour chaque position
        const emplacementVirtuel: EmplacementStockage = {
          id: 0, // ID virtuel pour les emplacements vides
          codeZone: this.selectedZone,
          numeroRangee: rangeeIndex + 1,
          numeroColonne: colonneIndex + 1,
          coordonneeEmplacement: `${this.selectedZone}-${(rangeeIndex + 1).toString().padStart(2, '0')}-${(colonneIndex + 1).toString().padStart(2, '0')}`,
          statut: 'VIDE',
          estActif: true
        };

        // Chercher si un emplacement réel existe à cette position
        const emplacementReel = this.emplacements.find(e => 
          e.numeroRangee === rangeeIndex + 1 && 
          e.numeroColonne === colonneIndex + 1 &&
          e.codeZone === this.selectedZone
        );

        // Si un emplacement réel existe, l'utiliser, sinon garder l'emplacement virtuel vide
        return emplacementReel || emplacementVirtuel;
      })
    );

    console.log('Grille construite:', this.grille);
    // Forcer la détection de changements pour afficher la grille immédiatement
    this.cdr.detectChanges();
  }

  onZoneChange(): void {
    console.log('Changement de zone vers:', this.selectedZone);
    this.cdr.detectChanges(); // Forcer la mise à jour immédiate
    this.loadGrille();
  }

  refresh(): void {
    this.loadGrille();
  }

  getCouleurCellule(emplacement: EmplacementStockage): string {
    if (!emplacement) {
      return 'rouge'; // VIDE - emplacement libre
    }

    // Vérifier si l'emplacement est réservé (statut 'RESERVE')
    if (emplacement.statut === 'RESERVE') {
      return 'jaune'; // Emplacement réservé par l'alimentateur
    }

    // Si l'emplacement n'a pas de bobine, il est vide (rouge)
    if (!emplacement.bobineId) {
      return 'rouge';
    }

    // Si l'emplacement a une bobine, la couleur dépend du statut de la bobine
    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (bobine) {
      switch (bobine.statut) {
        case 'DISPONIBLE':
          return 'vert'; // Bobine disponible
        case 'RESERVEE':
          return 'jaune'; // Bobine réservée
        case 'EN_PRELEVEMENT':
          return 'orange'; // Bobine en cours de prélèvement
        case 'EN_COURS':
          return 'bleu'; // Bobine en cours d'utilisation
        case 'EPUISEE':
          return 'gris'; // Bobine terminée
        default:
          return 'vert'; // Par défaut
      }
    }

    // Si la bobine n'est pas trouvée mais l'emplacement a un bobineId
    return 'vert';
  }

  getBobineReference(emplacement: EmplacementStockage): string {
    if (!emplacement || !emplacement.bobineId) return '';
    
    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    return bobine ? bobine.referenceBobine : '';
  }

  getStatutTexte(emplacement: EmplacementStockage): string {
    if (!emplacement) {
      return 'VIDE';
    }

    // Si l'emplacement n'a pas de bobine, il est vide
    if (!emplacement.bobineId) {
      return 'VIDE';
    }

    // Si l'emplacement a une bobine, afficher le statut de la bobine
    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (bobine) {
      // Afficher le statut réel de la bobine
      switch (bobine.statut) {
        case 'DISPONIBLE':
          return 'DISPONIBLE';
        case 'RESERVEE':
          return 'RESERVEE';
        case 'EN_PRELEVEMENT':
          return 'EN PRÉLÈVEMENT';
        case 'EN_COURS':
          return 'EN UTILISATION';
        case 'EPUISEE':
          return 'TERMINEE';
        default:
          return bobine.statut;
      }
    }

    // Si la bobine n'est pas trouvée mais l'emplacement a un bobineId
    return 'OCCUPE';
  }

  // Méthodes pour l'affichage complet
  getRangeesAffichees(): number[] {
    // Retourne les rangées limitées à 99 : [1, 2, 3, ..., 99] pour une zone 303x20
    const rangeesMax = Math.min(this.nombreRangees, 99);
    return Array.from({length: rangeesMax}, (_, i) => i + 1);
  }

  getColonnesAffichees(): number[] {
    // Retourne les colonnes limitées à 99 : [1, 2, 3, ..., 99] pour une zone 303x20
    const colonnesMax = Math.min(this.nombreColonnes, 99);
    return Array.from({length: colonnesMax}, (_, i) => i + 1);
  }

  aScrollHorizontal(): boolean {
    return this.nombreColonnes > this.MAX_COLONNES_AFFICHES;
  }

  aScrollVertical(): boolean {
    return this.nombreRangees > this.MAX_RANGEES_AFFICHES;
  }

  getInfosGrille(): string {
    const rangeesAffichees = Math.min(this.nombreRangees, 99);
    const colonnesAffichees = Math.min(this.nombreColonnes, 99);
    return `Zone: ${this.selectedZone} | ${rangeesAffichees}×${colonnesAffichees} affichées (max 99×99)${this.nombreRangees > 99 || this.nombreColonnes > 99 ? ` | Total: ${this.nombreRangees}×${this.nombreColonnes}` : ''}`;
  }

  // Méthodes de filtrage
  applyFilters(): void {
    // Pas besoin de filtrer la grille car on filtre à l'affichage
    this.cdr.detectChanges();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchRangee = '';
    this.searchColonne = '';
    this.searchCoordonnee = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // === Méthodes pour l'ajout de bobine ===

  openAddBobineModal(emplacement: EmplacementStockage): void {
    console.log('openAddBobineModal appelé avec:', emplacement);
    this.selectedEmplacement = emplacement;
    this.bobineReference = '';
    this.showAddBobineModal = true;
    console.log('showAddBobineModal mis à true:', this.showAddBobineModal);
    this.clearBobineMessages();
    this.cdr.detectChanges(); // Forcer la détection de changement
  }

  closeAddBobineModal(): void {
    console.log('=== FERMETURE DU MODAL ===');
    console.log('showAddBobineModal avant:', this.showAddBobineModal);
    console.log('bobineReference avant:', this.bobineReference);
    console.log('isCreatingBobine avant:', this.isCreatingBobine);
    
    this.showAddBobineModal = false;
    this.selectedEmplacement = null;
    this.bobineReference = '';
    this.isCreatingBobine = false; // Réinitialiser le flag
    this.clearBobineMessages();
    
    console.log('showAddBobineModal après:', this.showAddBobineModal);
    console.log('bobineReference après:', this.bobineReference);
    console.log('isCreatingBobine après:', this.isCreatingBobine);
    console.log('=== MODAL FERMÉ ===');
  }

  addBobineToEmplacement(): void {
    // Empêcher les créations multiples
    if (this.isCreatingBobine) {
      console.log('Création de bobine déjà en cours, ignoré');
      return;
    }

    if (!this.selectedEmplacement || !this.bobineReference || this.bobineReference.trim() === '') {
      this.bobineErrorMessage = 'Veuillez entrer une référence de bobine';
      return;
    }

    // Valider le format de la référence : REF-**** où **** sont des chiffres
    const referencePattern = /^REF-\d{4}$/;
    const referenceSaisie = this.bobineReference.trim().toUpperCase();
    
    if (!referencePattern.test(referenceSaisie)) {
      this.bobineErrorMessage = 'La référence doit être au format REF-**** (ex: REF-1002, REF-0156)';
      return;
    }

    // La référence de bobine n'est pas unique - plusieurs bobines peuvent avoir la même référence
    // Pas de vérification d'unicité nécessaire

    const bobineData = {
      referenceBobine: referenceSaisie, // Utiliser la référence formatée et validée
      statut: 'DISPONIBLE',
      emplacementActuelId: this.selectedEmplacement.id
    };

    // Activer le flag pour empêcher les créations multiples
    this.isCreatingBobine = true;

    console.log('Création de bobine - Données envoyées:', JSON.stringify(bobineData, null, 2));
    console.log('URL de l\'API:', this.emplacementService['bobinesUrl']);
    console.log('isCreatingBobine mis à true, flag actif');

    // Créer la bobine
    console.log('Appel à createBobine...');
    this.emplacementService.createBobine(bobineData).subscribe({
      next: (bobine: any) => {
        console.log('Bobine créée avec succès:', bobine);
        console.log('Début de la mise à jour de l\'emplacement...');
        
        // Mettre à jour l'emplacement pour le marquer comme occupé
        const updateData: EmplacementStockage = {
          id: this.selectedEmplacement!.id,
          codeZone: this.selectedEmplacement!.codeZone,
          numeroRangee: this.selectedEmplacement!.numeroRangee,
          numeroColonne: this.selectedEmplacement!.numeroColonne,
          coordonneeEmplacement: this.selectedEmplacement!.coordonneeEmplacement,
          bobineId: bobine.id,
          statut: 'OCCUPE',
          estActif: this.selectedEmplacement!.estActif
        };

        console.log('Mise à jour de l\'emplacement:', updateData);

        this.emplacementService.update(this.selectedEmplacement!.id, updateData).subscribe({
          next: () => {
            console.log('Emplacement mis à jour avec succès');
            console.log('Préparation de la fermeture du modal...');
            
            this.bobineSuccessMessage = `Bobine "${this.bobineReference}" ajoutée à l'emplacement ${this.selectedEmplacement!.coordonneeEmplacement}`;
            
            // Recharger la grille pour voir les changements
            console.log('Rechargement de la grille...');
            this.loadGrille();
            
            // Fermer le modal immédiatement
            console.log('Fermeture immédiate du modal...');
            this.isCreatingBobine = false; // Désactiver le flag immédiatement
            this.closeAddBobineModal();
          },
          error: (err: any) => {
            // Désactiver le flag en cas d'erreur
            this.isCreatingBobine = false;
            console.error('Erreur lors de la mise à jour de l\'emplacement:', err);
            this.bobineErrorMessage = 'Bobine créée mais erreur lors de la mise à jour de l\'emplacement';
            this.loadGrille(); // Recharger quand même
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur lors de la création de la bobine:');
        console.error('Status:', err.status);
        console.error('Status Text:', err.statusText);
        console.error('Error:', err.error);
        console.error('Message:', err.message);
        
        // Afficher un message d'erreur plus détaillé
        if (err.status === 500) {
          this.bobineErrorMessage = 'Erreur serveur lors de la création de la bobine. Vérifiez les logs du serveur.';
        } else if (err.status === 400) {
          this.bobineErrorMessage = 'Données invalides. Vérifiez la référence de la bobine.';
        } else {
          this.bobineErrorMessage = `Erreur (${err.status}): ${err.statusText || 'Erreur inconnue'}`;
        }
        
        // Désactiver le flag en cas d'erreur
        this.isCreatingBobine = false;
      }
    });
  }

  clearBobineMessages(): void {
    this.bobineErrorMessage = null;
    this.bobineSuccessMessage = null;
  }

  // Méthode pour retirer une bobine d'un emplacement
  removeBobineFromEmplacement(emplacement: EmplacementStockage): void {
    if (!emplacement.bobineId) {
      console.log('Aucune bobine à retirer pour cet emplacement');
      return;
    }

    // Préparer les informations pour le modal
    this.bobineToRemoveReference = this.getBobineReference(emplacement);
    this.bobineToRemoveEmplacement = emplacement.coordonneeEmplacement;
    this.emplacementToRemove = emplacement;
    
    // Afficher le modal de confirmation
    this.showRemoveBobineModal = true;
  }

  // Méthode pour fermer le modal de suppression
  closeRemoveBobineModal(): void {
    this.showRemoveBobineModal = false;
    this.bobineToRemoveReference = '';
    this.bobineToRemoveEmplacement = '';
    this.emplacementToRemove = null;
  }

  // Méthode pour confirmer la suppression de la bobine
  confirmRemoveBobine(): void {
    if (!this.emplacementToRemove || !this.emplacementToRemove.bobineId) {
      console.log('Aucun emplacement ou bobine à supprimer');
      return;
    }

    console.log(`Retrait de la bobine ID: ${this.emplacementToRemove.bobineId} de l'emplacement: ${this.emplacementToRemove.coordonneeEmplacement}`);

    // Supprimer la bobine (le backend gère la dissociation automatiquement)
    this.emplacementService.deleteBobine(this.emplacementToRemove.bobineId).subscribe({
      next: () => {
        console.log(`Bobine ${this.emplacementToRemove!.bobineId} supprimée avec succès (dissociation automatique)`);
        
        // Mettre à jour l'emplacement pour le libérer
        const emplacement = this.emplacementToRemove!; // Assertion non-null car déjà vérifié
        const updateData: EmplacementStockage = {
          id: emplacement.id,
          codeZone: emplacement.codeZone,
          numeroRangee: emplacement.numeroRangee,
          numeroColonne: emplacement.numeroColonne,
          coordonneeEmplacement: emplacement.coordonneeEmplacement,
          statut: 'VIDE',
          bobineId: undefined,
          estActif: emplacement.estActif
        };

        this.emplacementService.update(emplacement.id, updateData).subscribe({
          next: () => {
            console.log('Emplacement libéré avec succès');
            
            // Recharger la grille pour voir les changements
            this.loadGrille();
            
            // Fermer le modal
            this.closeRemoveBobineModal();
            
            // Afficher un message de succès temporaire
            const tempSuccess = document.createElement('div');
            tempSuccess.className = 'temp-success-message';
            tempSuccess.textContent = `Bobine retirée de ${this.emplacementToRemove!.coordonneeEmplacement}`;
            tempSuccess.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #28a745;
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 4px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              z-index: 9999;
              animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(tempSuccess);
            
            // Supprimer le message après 3 secondes
            setTimeout(() => {
              if (tempSuccess.parentNode) {
                tempSuccess.parentNode.removeChild(tempSuccess);
              }
            }, 3000);
          },
          error: (err) => {
            console.error('Erreur lors de la libération de l\'emplacement:', err);
            // Recharger quand même pour voir les changements
            this.loadGrille();
            this.closeRemoveBobineModal();
          }
        });
      },
      error: (err) => {
        console.error('Erreur lors de la suppression de la bobine:', err);
        
        // Afficher un message d'erreur
        const tempError = document.createElement('div');
        tempError.className = 'temp-error-message';
        tempError.textContent = `Erreur lors du retrait de la bobine`;
        tempError.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #dc3545;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 9999;
          animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(tempError);
        
        // Supprimer le message après 3 secondes
        setTimeout(() => {
          if (tempError.parentNode) {
            tempError.parentNode.removeChild(tempError);
          }
        }, 3000);
        
        this.closeRemoveBobineModal();
      }
    });
  }

  
  // Gestion du clic sur les cellules
  onCellClick(emplacement: EmplacementStockage | null): void {
    if (emplacement) {
      console.log('Cellule cliquée:', emplacement);
      console.log('bobineId:', emplacement.bobineId);
      console.log('Est vide?:', !emplacement.bobineId || emplacement.bobineId === 0);
      
      if (this.isAlimentateur) {
        // Pour l'alimentateur : seulement réserver les emplacements vides
        if (!emplacement.bobineId || emplacement.bobineId === 0) {
          console.log('Alimentateur : réservation de l\'emplacement vide');
          this.reserverEmplacement(emplacement);
        }
      } else {
        // Pour l'admin : ajouter ou supprimer des bobines
        if (!emplacement.bobineId || emplacement.bobineId === 0) {
          this.openAddBobineModal(emplacement);
        }
      }
    }
  }

  // Méthode pour réserver un emplacement (pour l'alimentateur)
  reserverEmplacement(emplacement: EmplacementStockage): void {
    console.log('Réservation de l\'emplacement:', emplacement.coordonneeEmplacement);
    
    // Marquer l'emplacement comme réservé en utilisant le statut
    this.emplacementService.update(emplacement.id, {
      ...emplacement,
      statut: 'RESERVE'
    }).subscribe({
      next: () => {
        console.log('Emplacement réservé avec succès');
        this.loadGrille(); // Recharger pour voir les changements
      },
      error: (err) => {
        console.error('Erreur lors de la réservation de l\'emplacement:', err);
      }
    });
  }

  // Vérifier si une cellule doit être affichée selon les filtres
  shouldShowCell(rangeeNum: number, colonneNum: number, emplacement: EmplacementStockage): boolean {
    // Validation : ne pas dépasser 99 pour rangées et colonnes
    if (rangeeNum > 99 || colonneNum > 99) {
      return false;
    }

    // Filtre par rangée
    if (this.searchRangee && this.searchRangee.trim()) {
      if (!rangeeNum.toString().includes(this.searchRangee.trim())) {
        return false;
      }
    }

    // Filtre par colonne
    if (this.searchColonne && this.searchColonne.trim()) {
      if (!colonneNum.toString().includes(this.searchColonne.trim())) {
        return false;
      }
    }

    // Filtre par coordonnée d'emplacement
    if (this.searchCoordonnee && this.searchCoordonnee.trim()) {
      const coordonnee = emplacement?.coordonneeEmplacement || '';
      if (!coordonnee.toLowerCase().includes(this.searchCoordonnee.toLowerCase().trim())) {
        return false;
      }
    }

    return true;
  }
}
