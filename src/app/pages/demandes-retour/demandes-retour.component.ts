import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DemandeRetourService, DemandeRetour, CreateDemandeRetourDto, ExecuteRetourDto } from './demande-retour.service';
import { RoleService } from '../../services/role.service';

@Component({
  selector: 'app-demandes-retour',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './demandes-retour.component.html',
  styleUrl: './demandes-retour.component.css'
})
export class DemandesRetourComponent implements OnInit {
  demandesRetour: DemandeRetour[] = [];
  filteredDemandes: DemandeRetour[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Filtres
  statutFilter = '';
  utilisateurFilter = '';
  
  // Modals
  showExecuteModal = false;
  selectedDemandeRetour: DemandeRetour | null = null;
  
  executeForm: ExecuteRetourDto = {
    utilisateurId: undefined,
    emplacementRetourId: undefined
  };
  
  // Utilisateurs pour l'assignation
  utilisateurs: any[] = [];
  
  // Statuts possibles
  statutsPossibles = ['GRIS', 'ACTIF', 'TERMINE'];
  
  constructor(
    private demandeRetourService: DemandeRetourService,
    private roleService: RoleService
  ) {}

  ngOnInit(): void {
    this.loadDemandesRetour();
    this.loadUtilisateurs();
  }

  // Charger toutes les demandes de retour
  loadDemandesRetour(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    this.demandeRetourService.getAll().subscribe({
      next: (demandes) => {
        this.demandesRetour = demandes;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des demandes de retour:', err);
        this.errorMessage = 'Erreur lors du chargement des demandes de retour';
        this.demandesRetour = [];
        this.isLoading = false;
      }
    });
  }

  // Charger les utilisateurs (alimentateurs)
  loadUtilisateurs(): void {
    // TODO: Implémenter le chargement des utilisateurs depuis le service approprié
    this.utilisateurs = [
      { id: 1, nomUtilisateur: 'Alimentateur 1' },
      { id: 2, nomUtilisateur: 'Alimentateur 2' }
    ];
  }

  // Appliquer les filtres
  applyFilters(): void {
    this.filteredDemandes = this.demandesRetour.filter(demande => {
      const statutMatch = !this.statutFilter || demande.statut === this.statutFilter;
      const utilisateurMatch = !this.utilisateurFilter || 
        (demande.utilisateurId && demande.utilisateurId.toString().includes(this.utilisateurFilter));
      
      return statutMatch && utilisateurMatch;
    });
  }

  // Obtenir le libellé du statut
  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'En attente';
      case 'ACTIF': return 'Approuvée';
      case 'TERMINE': return 'Terminée';
      default: return statut;
    }
  }

  // Obtenir la classe CSS pour le statut
  getStatutClass(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'status-gris';
      case 'ACTIF': return 'status-actif';
      case 'TERMINE': return 'status-termine';
      default: return 'status-inconnu';
    }
  }

  // Formater la date
  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Ouvrir le modal d'exécution
  openExecuteModal(demande: DemandeRetour): void {
    this.selectedDemandeRetour = demande;
    this.executeForm = {
      utilisateurId: undefined,
      emplacementRetourId: undefined
    };
    this.showExecuteModal = true;
  }

  // Fermer le modal d'exécution
  closeExecuteModal(): void {
    this.showExecuteModal = false;
    this.selectedDemandeRetour = null;
    this.executeForm = { 
      utilisateurId: undefined,
      emplacementRetourId: undefined 
    };
  }

  // Exécuter une demande de retour
  executeDemandeRetour(): void {
    if (!this.selectedDemandeRetour) {
      this.errorMessage = 'Aucune demande sélectionnée';
      return;
    }

    this.demandeRetourService.execute(this.selectedDemandeRetour.id, this.executeForm).subscribe({
      next: () => {
        this.successMessage = 'Retour exécuté avec succès';
        this.closeExecuteModal();
        this.loadDemandesRetour();
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        console.error('Erreur lors de l\'exécution:', err);
        this.errorMessage = 'Erreur lors de l\'exécution du retour';
        this.clearMessagesAfterDelay();
      }
    });
  }

  
  // Effacer les messages après un délai
  clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.errorMessage = null;
    }, 5000);
  }

  // Recharger les données
  refresh(): void {
    this.loadDemandesRetour();
  }

  
  // Vérifier si la demande peut être exécutée
  canExecute(demande: DemandeRetour): boolean {
    return demande.statut === 'ACTIF';
  }

  // Obtenir le nom de l'utilisateur
  getNomUtilisateur(utilisateurId: number | undefined): string {
    if (!utilisateurId) return 'Non assigné';
    const utilisateur = this.utilisateurs.find(u => u.id === utilisateurId);
    return utilisateur ? utilisateur.nomUtilisateur : `Utilisateur ${utilisateurId}`;
  }
}
