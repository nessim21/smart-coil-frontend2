import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Zone, ZoneService } from '../../services/zone.service';
import { EmplacementStockageService, EmplacementStockage } from '../../services/emplacement-stockage.service';

@Component({
  selector: 'app-zones',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './zones.html',
  styleUrl: './zones.css',
})
export class Zones implements OnInit {
  zones: Zone[] = [];
  zonesFiltrees: Zone[] = [];
  loading = false;
  showModal = false;
  showDeleteModal = false;
  isEditMode = false;
  selectedZone: Zone | null = null;
  zoneToDelete: { id: string; nom: string; codeZone?: string; nombreEmplacements?: number } | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Messages d'erreur pour les champs
  getRangeesError(): string {
    const rangeesControl = this.form.get('nombreRangees');
    if (rangeesControl?.errors) {
      if (rangeesControl.errors['min']) {
        return 'Le nombre de rangées doit être au moins 1';
      }
      if (rangeesControl.errors['max']) {
        return 'Le nombre de rangées ne peut pas dépasser 99';
      }
    }
    return '';
  }
  
  getColonnesError(): string {
    const colonnesControl = this.form.get('nombreColonnes');
    if (colonnesControl?.errors) {
      if (colonnesControl.errors['min']) {
        return 'Le nombre de colonnes doit être au moins 1';
      }
      if (colonnesControl.errors['max']) {
        return 'Le nombre de colonnes ne peut pas dépasser 99';
      }
    }
    return '';
  }
  
  // Propriétés de filtre
  searchQuery = '';
  capaciteFilter = '';
  rangeesFilter = '';
  colonnesFilter = '';

  form = new FormGroup({
    codeZone: new FormControl('', [Validators.required]),
    nom: new FormControl('', [Validators.required]),
    description: new FormControl(''),
    nombreRangees: new FormControl('', [Validators.min(1), Validators.max(99)]),
    nombreColonnes: new FormControl('', [Validators.min(1), Validators.max(99)])
  });

  constructor(
    private zoneService: ZoneService, 
    private emplacementService: EmplacementStockageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadZones();
  }

  loadZones(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.zoneService.getAll().subscribe({
      next: (data) => {
        this.zones = data;
        this.zonesFiltrees = data;
        this.loading = false;
        console.log('Zones chargées:', data);
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('Erreur lors du chargement des zones:', err);
        this.loading = false;
        this.errorMessage = 'Erreur lors du chargement des zones';
        this.cdr.detectChanges(); 
      }
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.selectedZone = null;
    this.form.reset({
      codeZone: '',
      nom: '',
      description: '',
      nombreRangees: '',
      nombreColonnes: ''
    });
    this.clearMessages();
    this.showModal = true;
  }

  openEditModal(zone: Zone): void {
    this.isEditMode = true;
    this.selectedZone = zone;
    this.form.patchValue({
      codeZone: zone.codeZone || zone.id,
      nom: zone.nom,
      description: zone.description || '',
      nombreRangees: zone.nombreRangees.toString(),
      nombreColonnes: zone.nombreColonnes.toString()
    });
    this.clearMessages();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.form.reset();
    this.clearMessages();
  }

  clearMessages(): void {
    this.errorMessage = null;
    this.successMessage = null;
  }

  
  save(): void {
    if (this.form.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const formValue = this.form.value;
    
    // Validation spécifique pour le codeZone
    if (!formValue.codeZone || formValue.codeZone.trim() === '') {
      this.errorMessage = 'Le code de la zone est obligatoire';
      return;
    }

    // Vérifier si le code de zone existe déjà (hors mode édition)
    if (!this.isEditMode) {
      const codeZoneSaisi = formValue.codeZone?.trim();
      if (codeZoneSaisi) {
        const existingZone = this.zones.find(z => {
          const zoneCode = (z.codeZone || z.id || '').toLowerCase();
          return zoneCode === codeZoneSaisi.toLowerCase();
        });
        
        if (existingZone) {
          this.errorMessage = `Ce code de zone "${codeZoneSaisi.toUpperCase()}" existe déjà. Veuillez choisir un autre code.`;
          return;
        }
      }
    }

    if (this.isEditMode && this.selectedZone) {
      // Mode modification - vérifier les changements de dimensions
      const anciennesRangees = this.selectedZone.nombreRangees || 0;
      const anciennesColonnes = this.selectedZone.nombreColonnes || 0;
      const nouvellesRangees = formValue.nombreRangees ? Number(formValue.nombreRangees) : 0;
      const nouvellesColonnes = formValue.nombreColonnes ? Number(formValue.nombreColonnes) : 0;

      console.log(`Dimensions changées: ${anciennesRangees}x${anciennesColonnes} -> ${nouvellesRangees}x${nouvellesColonnes}`);

      // Vérifier si les dimensions ont changé
      if (anciennesRangees !== nouvellesRangees || anciennesColonnes !== nouvellesColonnes) {
        console.log('Les dimensions ont changé, vérification des emplacements à supprimer...');
        this.verifierEtSupprimerEmplacementsEnTrop(
          this.selectedZone.id || this.selectedZone.codeZone || '',
          anciennesRangees,
          anciennesColonnes,
          nouvellesRangees,
          nouvellesColonnes,
          formValue
        );
      } else {
        // Dimensions inchangées - mise à jour simple
        this.updateZoneSimple(formValue);
      }
    
    } else {
      // Mode création
      const createDto: any = {
        codeZone: formValue.codeZone,
        nom: formValue.nom || '',
        nombreRangees: formValue.nombreRangees ? Number(formValue.nombreRangees) : 0,
        nombreColonnes: formValue.nombreColonnes ? Number(formValue.nombreColonnes) : 0
      };
      
      // Ajouter la description seulement si elle n'est pas vide
      if (formValue.description) {
        createDto.description = formValue.description;
      }

      console.log('Création zone - DTO:', createDto);
      console.log('Création zone - DTO JSON:', JSON.stringify(createDto));

      this.zoneService.create(createDto).subscribe({
        next: (newZone: any) => {
          console.log('Zone créée avec succès:', newZone);
          this.successMessage = 'Zone créée avec succès (emplacements générés automatiquement)';
          
          // Rafraîchir la liste des zones
          this.loadZones();
          setTimeout(() => {
            this.closeModal();
          }, 1500);
        },
        error: (err: any) => {
          console.error('=== ERREUR CRÉATION ZONE ===');
          console.error('Status:', err.status);
          console.error('Status Text:', err.statusText);
          console.error('Error:', err.error);
          console.error('Message:', err.message);
          console.error('Headers:', err.headers);
          console.error('================================');
          
          if (err.status === 400) {
            this.errorMessage = 'Erreur de validation: Vérifiez les données saisies';
          } else if (err.status === 500) {
            const errorMessage = err.error?.message || err.message || '';
            
            // Gérer spécifiquement les doublons de zones
            if (errorMessage.includes('existe déjà') || errorMessage.toLowerCase().includes('already exists')) {
              this.errorMessage = `Ce code de zone existe déjà. Veuillez choisir un autre code.`;
            } else {
              this.errorMessage = `Erreur serveur: ${errorMessage}`;
            }
          } else {
            this.errorMessage = 'Erreur lors de la création de la zone';
          }
        }
      });
    }
  }

  confirmDelete(zone: Zone): void {
    const zoneId = zone.codeZone || zone.id;
    this.zoneToDelete = { id: zoneId, nom: zone.nom, codeZone: zoneId };
    this.showDeleteModal = true;
    
    // Récupérer le nombre d'emplacements pour le message de confirmation
    this.emplacementService.getByZone(zoneId).subscribe({
      next: (emplacements) => {
        this.zoneToDelete!.nombreEmplacements = emplacements.length;
      },
      error: (err) => {
        console.error('Erreur lors du comptage des emplacements:', err);
        this.zoneToDelete!.nombreEmplacements = 0;
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.zoneToDelete = null;
  }

  deleteZone(): void {
    if (this.zoneToDelete) {
      console.log('=== DÉBUT SUPPRESSION ZONE ===');
      console.log('Zone à supprimer:', this.zoneToDelete);
      const codeZone = this.zoneToDelete.codeZone || this.zoneToDelete.id;
      console.log('Code zone utilisé:', codeZone);
      
      // Récupérer les emplacements pour les supprimer individuellement
      this.emplacementService.getByZone(codeZone).subscribe({
        next: (emplacements) => {
          console.log(`Emplacements trouvés (${emplacements.length}):`, emplacements);
          console.log(`Détail des emplacements:`);
          emplacements.forEach((emp, index) => {
            console.log(`  ${index + 1}. ID: ${emp.id}, Coordonnées: ${emp.coordonneeEmplacement}, bobineId: ${emp.bobineId}`);
          });
          
          if (emplacements.length === 0) {
            console.log('Aucun emplacement à supprimer, suppression directe de la zone');
            this.deleteZoneOnly();
          } else {
            console.log('Suppression individuelle des emplacements...');
            this.deleteEmplacementsIndividually(emplacements, codeZone);
          }
        },
        error: (err) => {
          console.error('Erreur lors de la récupération des emplacements:', err);
          console.log('Tentative de suppression directe de la zone malgré l\'erreur');
          // Continuer quand même avec la suppression de la zone
          this.deleteZoneOnly();
        }
      });
    }
  }

  // Supprimer uniquement la zone (sans les emplacements)
  deleteZoneOnly(): void {
    if (this.zoneToDelete) {
      console.log('=== DÉBUT SUPPRESSION ZONE UNIQUEMENT ===');
      console.log('ID de la zone à supprimer:', this.zoneToDelete.id);
      console.log('URL de l\'API de suppression:', `${this.zoneService['apiUrl']}/${this.zoneToDelete.id}`);
      
      this.zoneService.delete(this.zoneToDelete.id).subscribe({
        next: () => {
          console.log('=== ZONE SUPPRIMÉE AVEC SUCCÈS ===');
          const nombreEmplacements = this.zoneToDelete!.nombreEmplacements || 0;
          console.log(`Message de succès: Zone "${this.zoneToDelete!.nom}" supprimée avec ${nombreEmplacements} emplacement(s)`);
          this.successMessage = `Zone "${this.zoneToDelete!.nom}" supprimée avec ${nombreEmplacements} emplacement(s)`;
          this.loadZones();
          this.cancelDelete();
        },
        error: (err) => {
          console.error('=== ERREUR SUPPRESSION ZONE ===');
          console.error('Erreur lors de la suppression de la zone:', err);
          console.error('Status:', err.status);
          console.error('Status Text:', err.statusText);
          console.error('Error:', err.error);
          console.error('Message:', err.message);
          
          // Si erreur 500 de contrainte, afficher un message d'erreur clair
          if (err.status === 500 && err.error?.toString().includes('FK_emplacement_zone')) {
            console.log('Contrainte de clé étrangère détectée, impossible de supprimer la zone...');
            this.errorMessage = `Impossible de supprimer la zone "${this.zoneToDelete!.nom}" car des emplacements sont encore associés. Veuillez d'abord supprimer tous les emplacements de cette zone.`;
            this.cancelDelete();
          } else {
            this.errorMessage = 'Erreur lors de la suppression de la zone';
            this.cancelDelete();
          }
        }
      });
    }
  }

  
  // Supprimer les emplacements un par un
  deleteEmplacementsIndividually(emplacements: EmplacementStockage[], codeZone: string): void {
    let deletedCount = 0;
    let errorCount = 0;
    const total = emplacements.length;

    console.log(`=== DÉBUT SUPPRESSION INDIVIDUELLE ===`);
    console.log(`Nombre total d'emplacements à supprimer: ${total}`);

    // Utiliser Promise.all avec suppression individuelle
    const deletionPromises = emplacements.map((emplacement, index) => {
      return new Promise<void>((resolve, reject) => {
        console.log(`Tentative de suppression emplacement ${index + 1}/${total}:`);
        console.log(`  ID: ${emplacement.id}`);
        console.log(`  Coordonnées: ${emplacement.coordonneeEmplacement}`);
        console.log(`  bobineId: ${emplacement.bobineId}`);
        
        // Approche simplifiée : supprimer les bobines d'abord, puis les emplacements
        if (emplacement.bobineId) {
          console.log(`  -> L'emplacement a une bobine (ID: ${emplacement.bobineId}), suppression de la bobine d'abord...`);
          
          // 1. Supprimer la bobine (le backend gère la dissociation automatiquement)
          this.emplacementService.deleteBobine(emplacement.bobineId).subscribe({
            next: () => {
              console.log(`  -> Bobine ${emplacement.bobineId} supprimée avec succès (dissociation automatique)`);
              
              // 2. Maintenant supprimer l'emplacement
              this.emplacementService.delete(emplacement.id).subscribe({
                next: () => {
                  deletedCount++;
                  console.log(`  -> Emplacement ${index + 1}/${total} SUPPRIMÉ AVEC SUCCÈS: ${emplacement.coordonneeEmplacement}`);
                  resolve();
                },
                error: (err) => {
                  errorCount++;
                  console.error(`  -> ERREUR suppression emplacement ${index + 1}:`, err);
                  console.error(`     Status: ${err.status}`);
                  console.error(`     Message: ${err.message}`);
                  resolve(); // Continuer même en cas d'erreur
                }
              });
            },
            error: (err: any) => {
              errorCount++;
              console.error(`  -> ERREUR suppression bobine ${emplacement.bobineId}:`, err);
              console.error(`     Status: ${err.status}`);
              console.error(`     Message: ${err.message}`);
              resolve(); // Continuer même en cas d'erreur
            }
          });
        } else {
          // Pas de bobine, supprimer directement l'emplacement
          this.emplacementService.delete(emplacement.id).subscribe({
            next: () => {
              deletedCount++;
              console.log(`  -> Emplacement ${index + 1}/${total} SUPPRIMÉ AVEC SUCCÈS: ${emplacement.coordonneeEmplacement}`);
              resolve();
            },
            error: (err) => {
              errorCount++;
              console.error(`  -> ERREUR suppression emplacement ${index + 1}:`, err);
              console.error(`     Status: ${err.status}`);
              console.error(`     Message: ${err.message}`);
              resolve(); // Continuer même en cas d'erreur
            }
          });
        }
      });
    });

    // Attendre que toutes les suppressions soient terminées
    Promise.all(deletionPromises).then(() => {
      console.log(`=== FIN SUPPRESSION INDIVIDUELLE ===`);
      console.log(`Résultat: ${deletedCount} succès, ${errorCount} erreurs`);
      
      // Mettre à jour le nombre d'emplacements supprimés pour le message
      if (this.zoneToDelete) {
        this.zoneToDelete.nombreEmplacements = deletedCount;
      }
      
      // Supprimer la zone après les emplacements
      console.log('Passage à la suppression de la zone...');
      this.deleteZoneOnly();
    }).catch((err) => {
      console.error('Erreur globale lors de la suppression des emplacements:', err);
      
      // Mettre à jour avec le nombre d'emplacements supprimés même en cas d'erreur
      if (this.zoneToDelete) {
        this.zoneToDelete.nombreEmplacements = deletedCount;
      }
      
      // Continuer quand même avec la suppression de la zone
      console.log('Passage à la suppression de la zone malgré l\'erreur...');
      this.deleteZoneOnly();
    });
  }

  // === Méthodes de filtrage ===

  applyFilters(): void {
    let filtered = [...this.zones];

    // Filtrage par recherche textuelle
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(zone => 
        zone.codeZone.toLowerCase().includes(query) ||
        zone.nom.toLowerCase().includes(query) ||
        (zone.description && zone.description.toLowerCase().includes(query))
      );
    }

    // Filtrage par capacité
    if (this.capaciteFilter) {
      filtered = filtered.filter(zone => {
        // Calculer la capacité réelle (nombreRangees × nombreColonnes)
        const capaciteReelle = zone.capaciteMax || (zone.nombreRangees * zone.nombreColonnes);
        
        if (this.capaciteFilter === 'petite') return capaciteReelle <= 50;
        if (this.capaciteFilter === 'moyenne') return capaciteReelle > 50 && capaciteReelle <= 200;
        if (this.capaciteFilter === 'grande') return capaciteReelle > 200;
        return true;
      });
    }

    // Filtrage par nombre de rangées
    if (this.rangeesFilter) {
      filtered = filtered.filter(zone => {
        if (this.rangeesFilter === 'petit') return zone.nombreRangees <= 5;
        if (this.rangeesFilter === 'moyen') return zone.nombreRangees > 5 && zone.nombreRangees <= 15;
        if (this.rangeesFilter === 'grand') return zone.nombreRangees > 15;
        return true;
      });
    }

    // Filtrage par nombre de colonnes
    if (this.colonnesFilter) {
      filtered = filtered.filter(zone => {
        if (this.colonnesFilter === 'petit') return zone.nombreColonnes <= 5;
        if (this.colonnesFilter === 'moyen') return zone.nombreColonnes > 5 && zone.nombreColonnes <= 15;
        if (this.colonnesFilter === 'grand') return zone.nombreColonnes > 15;
        return true;
      });
    }

    this.zonesFiltrees = filtered;
    console.log('Filtres appliqués:', {
      searchQuery: this.searchQuery,
      capaciteFilter: this.capaciteFilter,
      rangeesFilter: this.rangeesFilter,
      colonnesFilter: this.colonnesFilter,
      resultats: filtered.length
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onCapaciteFilterChange(): void {
    this.applyFilters();
  }

  onRangeesFilterChange(): void {
    this.applyFilters();
  }

  onColonnesFilterChange(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.capaciteFilter = '';
    this.rangeesFilter = '';
    this.colonnesFilter = '';
    this.applyFilters();
    this.cdr.detectChanges();
  }

  
  // Méthode pour mettre à jour une zone simplement (sans changement de dimensions)
  updateZoneSimple(formValue: any): void {
    const updateDto: any = {
      codeZone: formValue.codeZone || this.selectedZone?.codeZone || this.selectedZone?.id || '',
      nom: formValue.nom || '',
      nombreRangees: formValue.nombreRangees ? Number(formValue.nombreRangees) : 0,
      nombreColonnes: formValue.nombreColonnes ? Number(formValue.nombreColonnes) : 0
    };
    
    // Ajouter la description seulement si elle n'est pas vide
    if (formValue.description) {
      updateDto.description = formValue.description;
    }

    console.log('Mise à jour simple de zone:', updateDto);

    this.zoneService.update(this.selectedZone!.id, updateDto).subscribe({
      next: () => {
        console.log('Zone mise à jour avec succès');
        this.successMessage = 'Zone mise à jour avec succès';
        this.loadZones();
        setTimeout(() => {
          this.closeModal();
        }, 1500);
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour de la zone:', err);
        this.errorMessage = 'Erreur lors de la mise à jour de la zone';
      }
    });
  }

  // Méthode pour vérifier et supprimer les emplacements en trop lors d'un changement de dimensions
  verifierEtSupprimerEmplacementsEnTrop(
    codeZone: string,
    anciennesRangees: number,
    anciennesColonnes: number,
    nouvellesRangees: number,
    nouvellesColonnes: number,
    formValue: any
  ): void {
    console.log(`Vérification des emplacements à supprimer pour la zone ${codeZone}`);
    console.log(`Anciennes dimensions: ${anciennesRangees}x${anciennesColonnes}`);
    console.log(`Nouvelles dimensions: ${nouvellesRangees}x${nouvellesColonnes}`);

    this.emplacementService.getByZone(codeZone).subscribe({
      next: (emplacements: EmplacementStockage[]) => {
        console.log(`Emplacements trouvés: ${emplacements.length}`);
        
        // Identifier les emplacements à supprimer
        const emplacementsASupprimer = emplacements.filter(emp => {
          return emp.numeroRangee > nouvellesRangees || emp.numeroColonne > nouvellesColonnes;
        });

        console.log(`Emplacements à supprimer: ${emplacementsASupprimer.length}`);

        if (emplacementsASupprimer.length === 0) {
          // Aucun emplacement à supprimer, mise à jour simple
          console.log('Aucun emplacement à supprimer, mise à jour simple de la zone');
          this.updateZoneSimple(formValue);
          return;
        }

        // Vérifier si des emplacements contiennent des bobines
        const emplacementsAvecBobines = emplacementsASupprimer.filter(emp => emp.bobineId);
        console.log(`Emplacements avec bobines: ${emplacementsAvecBobines.length}`);

        if (emplacementsAvecBobines.length > 0) {
          // Afficher un message d'avertissement avec les détails
          const detailsBobines = emplacementsAvecBobines.map(emp => 
            `${emp.coordonneeEmplacement} (Bobine ID: ${emp.bobineId})`
          ).join(', ');
          
          this.errorMessage = `Impossible de réduire la zone: ${emplacementsAvecBobines.length} emplacement(s) contiennent des bobines (${detailsBobines}). Veuillez d'abord retirer les bobines de ces emplacements.`;
          return;
        }

        // Confirmer la suppression des emplacements vides
        if (confirm(`Vous allez supprimer ${emplacementsASupprimer.length} emplacement(s) vide(s). Continuer?`)) {
          this.supprimerEmplacementsEtMettreAJourZone(emplacementsASupprimer, formValue);
        }
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des emplacements:', err);
        this.errorMessage = 'Erreur lors de la vérification des emplacements';
      }
    });
  }

  // Méthode pour supprimer les emplacements et mettre à jour la zone
  supprimerEmplacementsEtMettreAJourZone(emplacementsASupprimer: EmplacementStockage[], formValue: any): void {
    console.log(`Suppression de ${emplacementsASupprimer.length} emplacements...`);

    let supprimesCount = 0;
    let erreursCount = 0;
    const total = emplacementsASupprimer.length;

    const suppressionPromises = emplacementsASupprimer.map((emplacement, index) => {
      return new Promise<void>((resolve) => {
        console.log(`Suppression emplacement ${index + 1}/${total}: ${emplacement.coordonneeEmplacement}`);
        
        this.emplacementService.delete(emplacement.id).subscribe({
          next: () => {
            supprimesCount++;
            console.log(`Emplacement ${emplacement.coordonneeEmplacement} supprimé avec succès`);
            resolve();
          },
          error: (err) => {
            erreursCount++;
            console.error(`Erreur suppression emplacement ${emplacement.coordonneeEmplacement}:`, err);
            resolve();
          }
        });
      });
    });

    Promise.all(suppressionPromises).then(() => {
      console.log(`Suppression terminée: ${supprimesCount} succès, ${erreursCount} erreurs`);
      
      if (supprimesCount > 0) {
        // Mettre à jour la zone après suppression des emplacements
        this.updateZoneSimple(formValue);
      } else {
        this.errorMessage = 'Aucun emplacement n\'a pu être supprimé';
      }
    });
  }
}
