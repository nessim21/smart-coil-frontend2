import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { DemandeService, Demande } from '../../services/demande.service';
import { AuthService } from '../../services/auth.service';
import { EmplacementStockageService, EmplacementStockage, Bobine } from '../../services/emplacement-stockage.service';
import { ZoneService, Zone } from '../../services/zone.service';
import { HttpClient } from '@angular/common/http';
import { RoleService } from '../../services/role.service';
import { BobineService } from '../../services/bobine.service';
import { OrdreTravailService, OrdreTravail } from '../../services/ordre-travail.service';

@Component({
  selector: 'app-alimentateur-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alimentateur-dashboard.component.html',
  styleUrl: './alimentateur-dashboard.component.css'
})
export class AlimentateurDashboard implements OnInit {
  // Services
  private demandeService = inject(DemandeService);
  private authService = inject(AuthService);
  private roleService = inject(RoleService);
  private cdr = inject(ChangeDetectorRef);
  private emplacementService = inject(EmplacementStockageService);
  private zoneService = inject(ZoneService);
  private http = inject(HttpClient);
  private bobineService = inject(BobineService);
  private ordreTravailService = inject(OrdreTravailService);

  // Données
  demandes: Demande[] = [];
  demandesNonAffectees: Demande[] = [];
  demandesEnCours: Demande[] = [];
  demandesTerminees: Demande[] = [];
  ordresTravail: OrdreTravail[] = [];
  
  // Données pour les demandes de retour
  demandesRetourATraiter: any[] = []; // Données réelles depuis le backend
  loadingDemandesRetour = false;

  // Propriétés pour le modal d'exécution des demandes de retour
  showExecuteRetourModal = false;
  selectedRetourToExecute: any = null;
  executeRetourForm = {
    emplacementRetourId: null as number | null
  };

  // Propriétés pour la grille de retour
  showConfirmExecuteRetourModal = false;
  selectedZoneRetour: string = '';
  selectedEmplacementRetour: any = null;
  loadingRetourGrid = false;
  grilleRetour: any[][] = [];

  // Modal détails demande de retour
  showRetourDetailsModal = false;
  selectedRetourDetails: any = null;

  
  // États
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isProcessing = false;

  // Modaux
  showConfirmStartModal = false;
  showConfirmEndModal = false;
  demandeToStart: Demande | null = null;
  demandeToEnd: Demande | null = null;

  // Propriétés pour la réservation de bobines
  showReservationModal = false;
  showConfirmReservationModal = false;
  selectedDemande: Demande | null = null;
  selectedBobine: Bobine | null = null;
  selectedEmplacement: EmplacementStockage | null = null;
  
  // Propriétés pour le modal de prélèvement
  showPrelevementModal = false;
  showPrelevementSuccessModal = false;
  selectedDemandeForPrelevement: Demande | null = null;
  prelevementBobineId: number | null = null;
  prelevementEmplacementId: number | null = null;
  prelevementEmplacementCoordonnees: string = '';
  prelevementForm = {
    bobineId: null as number | null
  };
  
  // Grille de stockage
  zones: Zone[] = [];
  selectedZone: string = '';
  emplacements: EmplacementStockage[] = [];
  bobines: Bobine[] = [];
  grille: EmplacementStockage[][] = [];
  nombreRangees: number = 0;
  nombreColonnes: number = 0;
  
  // Limites d'affichage
  readonly MAX_RANGEES_AFFICHES = 10;
  readonly MAX_COLONNES_AFFICHES = 10;

  // Info alimentateur
  alimentateurId: number | null = null;
  alimentateurNom: string | null = null;

  // Filtres
  statutFilter: string = 'TOUS';
  prioriteFilter: string = 'TOUS';

  ngOnInit(): void {
    this.getAlimentateurInfo();
    // Charger les bobines pour avoir les statuts à jour
    this.loadBobines();
    // Charger les ordres de travail pour avoir les vrais numéros
    this.loadOrdresTravail();
    // Attendre un tick pour s'assurer que l'ID est bien récupéré
    setTimeout(() => {
      this.loadDemandes();
      // Charger les demandes de retour APRÈS les demandes et ordres de travail
      this.loadDemandesRetourAlimentateur();
    }, 100);
  }

  // Charger toutes les bobines pour avoir les statuts à jour
  loadBobines(): void {
    console.log('=== LOAD BOBINES POUR STATUTS ===');
    this.bobineService.getAll().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
        console.log('Bobines chargées:', this.bobines.length, 'bobines');
        // Recharger aussi les demandes car elles peuvent être modifiées (libération de bobine)
        this.loadDemandes();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des bobines:', err);
        this.bobines = [];
      }
    });
  }

  // Charger tous les ordres de travail pour avoir les vrais numéros
  loadOrdresTravail(): void {
    console.log('=== LOAD ORDRES TRAVAIL ===');
    this.ordreTravailService.getOrdresTravail().subscribe({
      next: (ordres: OrdreTravail[]) => {
        this.ordresTravail = ordres;
        console.log('Ordres de travail chargés:', this.ordresTravail.length, 'ordres');
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des ordres de travail:', err);
        this.ordresTravail = [];
      }
    });
  }

  // Récupérer les infos de l'alimentateur connecté
  getAlimentateurInfo(): void {
    this.alimentateurId = this.roleService.getUserId();
    const userInfo = this.authService.getUserInfo();
    if (userInfo && this.alimentateurId) {
      this.alimentateurNom = userInfo.nomUtilisateur;
    } else {
      this.errorMessage = 'Erreur: Impossible de récupérer les informations de l\'alimentateur';
    }
  }

  
  // Charger toutes les demandes
  loadDemandes(): void {
    if (!this.alimentateurId) {
      this.errorMessage = 'ID alimentateur non disponible';
      this.loading = false;
      return;
    }

    // Vérifier que l'utilisateur est bien authentifié
    if (!this.authService.isAuthenticated()) {
      this.errorMessage = 'Vous devez être connecté pour accéder à cette page';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.demandeService.getDemandesByAlimentateur(this.alimentateurId!).subscribe({
      next: (demandes: Demande[]) => {
        this.demandes = demandes || [];
        this.filtrerDemandes();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des demandes alimentateur:', err);
        this.errorMessage = 'Erreur lors du chargement de vos demandes';
        this.loading = false;
      }
    });
  }

  // Filtrer les demandes par statut
  filtrerDemandes(): void {
    // L'API retourne déjà les demandes de cet alimentateur, donc pas besoin de filtrer par utilisateurAssigneId
    
    // Classer par statut (les demandes EN_COURS vont dans "Demandes à traiter")
    this.demandesNonAffectees = this.demandes.filter(d => d.statut === 'NON_AFFECTEE' || d.statut === 'EN_COURS');
    this.demandesEnCours = []; // Le tableau "Demandes en cours" sera vide
    this.demandesTerminees = this.demandes.filter(d => d.statut === 'TERMINE');

    // Appliquer les filtres supplémentaires
    this.applyFilters();
  }

  // Appliquer les filtres
  applyFilters(): void {
    // L'API retourne déjà les demandes de cet alimentateur, donc pas besoin de filtrer par utilisateurAssigneId
    let demandesFiltrees = [...this.demandes];

    if (this.prioriteFilter !== 'TOUS') {
      demandesFiltrees = demandesFiltrees.filter(d => d.niveauPriorite === this.prioriteFilter);
    }

    // Mettre à jour les listes (les demandes EN_COURS vont dans "Demandes à traiter")
    this.demandesNonAffectees = demandesFiltrees.filter(d => d.statut === 'NON_AFFECTEE' || d.statut === 'EN_COURS')
      .sort((a, b) => {
        // Tri par ordre de travail croissant
        const ordreA = this.getWorkOrderName(a.ordreTravailId);
        const ordreB = this.getWorkOrderName(b.ordreTravailId);
        return ordreA.localeCompare(ordreB);
      });
    this.demandesEnCours = []; // Le tableau "Demandes en cours" reste vide
    this.demandesTerminees = demandesFiltrees.filter(d => d.statut === 'TERMINE')
      .sort((a, b) => {
        // Tri par ordre de travail croissant aussi pour les demandes terminées
        const ordreA = this.getWorkOrderName(a.ordreTravailId);
        const ordreB = this.getWorkOrderName(b.ordreTravailId);
        return ordreA.localeCompare(ordreB);
      });
  }

  // Ouvrir le modal de confirmation pour démarrer une demande
  openConfirmStartModal(demande: Demande): void {
    this.demandeToStart = demande;
    this.showConfirmStartModal = true;
  }

  // Fermer le modal de confirmation pour démarrer
  closeConfirmStartModal(): void {
    this.showConfirmStartModal = false;
    this.demandeToStart = null;
  }

  // Confirmer et démarrer la demande
  confirmStart(): void {
    if (!this.demandeToStart || !this.alimentateurId) return;

    this.isProcessing = true;
    this.clearMessages();

    this.demandeService.update(this.demandeToStart.id, {
      statut: 'EN_COURS',
      utilisateurAssigneId: this.alimentateurId
    }).subscribe({
      next: () => {
        this.successMessage = 'Demande démarrée avec succès';
        this.closeConfirmStartModal();
        this.loadDemandes();
        this.clearMessagesAfterDelay();
        this.isProcessing = false;
      },
      error: (err: any) => {
        console.error('Erreur lors du démarrage:', err);
        this.errorMessage = 'Erreur lors du démarrage de la demande';
        this.isProcessing = false;
        this.clearMessagesAfterDelay();
      }
    });
  }

  // Ouvrir le modal de confirmation pour terminer une demande
  openConfirmEndModal(demande: Demande): void {
    this.demandeToEnd = demande;
    this.showConfirmEndModal = true;
  }

  // Fermer le modal de confirmation pour terminer
  closeConfirmEndModal(): void {
    this.showConfirmEndModal = false;
    this.demandeToEnd = null;
  }

  // Confirmer et terminer la demande
  confirmEnd(): void {
    if (!this.demandeToEnd || !this.alimentateurId) return;

    this.isProcessing = true;
    this.clearMessages();

    this.demandeService.update(this.demandeToEnd.id, {
      statut: 'TERMINE',
      utilisateurAssigneId: this.alimentateurId
    }).subscribe({
      next: () => {
        this.successMessage = 'Demande terminée avec succès';
        this.closeConfirmEndModal();
        this.loadDemandes();
        this.clearMessagesAfterDelay();
        this.isProcessing = false;
      },
      error: (err: any) => {
        console.error('Erreur lors de la terminaison:', err);
        this.errorMessage = 'Erreur lors de la terminaison de la demande';
        this.isProcessing = false;
        this.clearMessagesAfterDelay();
      }
    });
  }

  // Formater le statut pour l'affichage
  formatStatut(statut: string): string {
    switch (statut) {
      case 'NON_AFFECTEE': return 'Non affectée';
      case 'EN_COURS': return 'En cours';
      case 'TERMINE': return 'Terminée';
      default: return statut;
    }
  }

  // Obtenir la classe CSS pour le statut
  getStatutClass(statut: string): string {
    switch (statut) {
      case 'NON_AFFECTEE': return 'badge-warning';
      case 'EN_COURS': return 'badge-info';
      case 'TERMINE': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  // Obtenir la classe CSS pour la priorité
  getPrioriteClass(priorite: string | undefined): string {
    if (!priorite) {
      return 'badge-default';
    }
    switch (priorite) {
      case 'PRIORITAIRE':
        return 'badge-urgent';
      case 'NORMAL':
        return 'badge-normal';
      default:
        return 'badge-default';
    }
  }

  // Formater la priorité pour l'affichage
  formatPriorite(priorite: string | undefined): string {
    if (!priorite) {
      return 'Non définie';
    }
    switch (priorite) {
      case 'PRIORITAIRE':
        return 'Urgente';
      case 'NORMAL':
        return 'Normale';
      default:
        return priorite;
    }
  }

  // Formater la date
  formatDate(dateInput: string | Date): string {
    if (!dateInput) return 'N/A';
    
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Obtenir le vrai numéro de l'ordre de travail à partir de son ID
  getWorkOrderName(ordreTravailId: number | undefined): string {
    if (!ordreTravailId) {
      return 'Non assigné';
    }
    
    // Chercher l'ordre de travail correspondant dans notre liste
    const ordre = this.ordresTravail.find(o => o.id === ordreTravailId);
    if (ordre) {
      console.log(`Ordre trouvé pour ID ${ordreTravailId}: ${ordre.numeroOrdre}`);
      return ordre.numeroOrdre;
    }
    
    console.log(`Ordre non trouvé pour ID ${ordreTravailId}, utilisation du format par défaut`);
    // Fallback si l'ordre n'est pas trouvé
    return `WO-${String(ordreTravailId).padStart(5, '0')}`;
  }

  // Obtenir la machine associée à un ordre de travail
  getMachineForOrder(ordreTravailId: number | undefined): string {
    if (!ordreTravailId) {
      return '-';
    }
    
    // Chercher l'ordre de travail correspondant dans notre liste
    const ordre = this.ordresTravail.find(o => o.id === ordreTravailId);
    if (ordre && ordre.idMachine) {
      console.log(`Machine trouvée pour ordre ${ordreTravailId}: ${ordre.idMachine}`);
      return ordre.idMachine;
    }
    
    console.log(`Machine non trouvée pour ordre ${ordreTravailId}`);
    return '-';
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

  // Recharger les données
  refresh(): void {
    this.clearMessages();
    this.loadDemandes();
    this.loadDemandesRetourAlimentateur();
  }

  // Obtenir le nombre total de demandes
  getNombreTotal(): number {
    return this.demandesNonAffectees.length + this.demandesEnCours.length + this.demandesTerminees.length;
  }

  // Obtenir le nombre de demandes urgentes
  getNombreUrgentes(): number {
    return this.demandesNonAffectees.filter(d => d.niveauPriorite === 'PRIORITAIRE').length;
  }

  // Obtenir le nombre de demandes urgentes (méthode pour le HTML)
  getDemandesUrgentes(): number {
    return this.getNombreUrgentes();
  }

  // === MÉTHODES DE RÉSERVATION ===

  // Obtenir le statut direct de la bobine
  getBobineStatusText(bobineId: number): string {
    if (!bobineId || bobineId === 0) return 'Aucune bobine';
    
    const bobine = this.bobines.find(b => b.id === bobineId);
    if (!bobine) return 'Inconnu';
    
    switch (bobine.statut) {
      case 'DISPONIBLE': return 'Disponible';
      case 'RESERVEE': return 'Réservée';
      case 'EN_PRELEVEMENT': return 'En prélèvement';
      case 'EN_COURS': return 'En cours';
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

  // Vérifier si la bobine est réservée (peut être prélevée)
  isBobineReservee(demande: Demande): boolean {
    if (!demande.bobineId) {
      return false;
    }
    
    const bobine = this.bobines.find(b => b.id === demande.bobineId);
    return bobine ? bobine.statut === 'RESERVEE' : false;
  }

  // Vérifier si la bobine est déjà prélevée (statut EN_PRELEVEMENT)
  isBobinePrelevee(demande: Demande): boolean {
    if (!demande.bobineId) {
      return false;
    }
    const bobine = this.bobines.find(b => b.id === demande.bobineId);
    return bobine ? bobine.statut === 'EN_PRELEVEMENT' : false;
  }

  // Ouvrir le modal de réservation
  openReservationModal(demande: Demande): void {
    this.selectedDemande = demande;
    this.showReservationModal = true;
    this.loadZones();
  }

  // Fermer le modal de réservation
  closeReservationModal(): void {
    this.showReservationModal = false;
    this.selectedDemande = null;
    this.selectedBobine = null;
    this.selectedEmplacement = null;
    this.grille = [];
  }

  // Charger les zones
  loadZones(): void {
    this.loading = true;
    this.zoneService.getAll().subscribe({
      next: (zones) => {
        this.zones = zones;
        if (zones.length > 0) {
          this.selectedZone = zones[0].codeZone || zones[0].id;
          this.loadGrille();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des zones:', err);
        this.errorMessage = 'Erreur lors du chargement des zones';
        this.loading = false;
      }
    });
  }

  // Charger la grille de stockage
  loadGrille(): void {
    if (!this.selectedZone) {
      return;
    }

    this.loading = true;
    
    // Charger les emplacements et les bobines en parallèle
    let emplacementsLoaded = false;
    let bobinesLoaded = false;

    this.emplacementService.getAll().subscribe({
      next: (emplacements) => {
        this.emplacements = emplacements.filter(e => e.codeZone === this.selectedZone);
        const selectedZoneData = this.zones.find(z => (z.codeZone || z.id) === this.selectedZone);
        this.nombreRangees = selectedZoneData?.nombreRangees || 10;
        this.nombreColonnes = selectedZoneData?.nombreColonnes || 10;
        
        emplacementsLoaded = true;
        if (bobinesLoaded) {
          this.construireGrille();
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des emplacements:', err);
        this.loading = false;
      }
    });

    this.emplacementService.getAllBobines().subscribe({
      next: (bobines) => {
        this.bobines = bobines;
        bobinesLoaded = true;
        if (emplacementsLoaded) {
          this.construireGrille();
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des bobines:', err);
        this.loading = false;
      }
    });
  }

  // Construire la grille
  construireGrille(): void {
    this.grille = Array(this.nombreRangees).fill(null).map((_, rangeeIndex) => 
      Array(this.nombreColonnes).fill(null).map((_, colonneIndex) => {
        // Vérifier si cet emplacement existe dans la base de données
        const emplacementExiste = this.emplacements.some(e => 
          e.numeroRangee === rangeeIndex + 1 && 
          e.numeroColonne === colonneIndex + 1 &&
          e.codeZone === this.selectedZone
        );

        const emplacementVirtuel: EmplacementStockage = {
          id: 0,
          codeZone: this.selectedZone,
          numeroRangee: rangeeIndex + 1,
          numeroColonne: colonneIndex + 1,
          coordonneeEmplacement: `${this.selectedZone}-${(rangeeIndex + 1).toString().padStart(2, '0')}-${(colonneIndex + 1).toString().padStart(2, '0')}`,
          statut: 'VIDE',
          estActif: emplacementExiste // Actif seulement s'il existe dans la base
        };

        const emplacementReel = this.emplacements.find(e => 
          e.numeroRangee === rangeeIndex + 1 && 
          e.numeroColonne === colonneIndex + 1 &&
          e.codeZone === this.selectedZone
        );

        return emplacementReel || emplacementVirtuel;
      })
    );
  }

  // Changer de zone
  onZoneChange(): void {
    this.loadGrille();
  }

  // Obtenir la couleur d'une cellule
  getCouleurCellule(emplacement: EmplacementStockage): string {
    if (!emplacement) {
      return 'rouge';
    }

    if (emplacement.statut === 'RESERVE') {
      return 'jaune';
    }

    if (!emplacement.bobineId) {
      return 'rouge';
    }

    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (bobine) {
      switch (bobine.statut) {
        case 'DISPONIBLE': return 'vert';
        case 'RESERVEE': return 'jaune';
        case 'EN_PRELEVEMENT': return 'orange';
        case 'EN_COURS': return 'bleu';
        case 'EPUISEE': return 'gris';
        default: return 'gris'; // Couleur par défaut si statut inconnu
      }
    }

    // Si l'emplacement a un bobineId mais qu'on ne trouve pas la bobine,
    // c'est probablement un problème de synchronisation
    console.warn(`Emplacement ${emplacement.coordonneeEmplacement} a un bobineId ${emplacement.bobineId} mais la bobine n'est pas trouvée`);
    return 'gris'; // Gris pour indiquer un problème
  }

  // Vérifier si une bobine doit clignoter (correspond à la référence demandée)
  shouldBobineClignoter(emplacement: EmplacementStockage): boolean {
    if (!emplacement || !emplacement.bobineId || !this.selectedDemande) {
      return false;
    }

    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (!bobine) {
      return false;
    }

    return bobine.statut === 'DISPONIBLE' && 
           bobine.referenceBobine === this.selectedDemande?.referenceBobine;
  }

  // Obtenir la référence d'une bobine
  getBobineReference(emplacement: EmplacementStockage): string {
    if (!emplacement || !emplacement.bobineId) {
      return '';
    }

    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (bobine) {
      return bobine.referenceBobine;
    } else {
      // Si l'emplacement a un bobineId mais qu'on ne trouve pas la bobine
      console.warn(`Référence non trouvée pour bobineId ${emplacement.bobineId} à l'emplacement ${emplacement.coordonneeEmplacement}`);
      return '???'; // Indique un problème de synchronisation
    }
  }

  // Clic sur une bobine
  onBobineClick(emplacement: EmplacementStockage): void {
    if (!emplacement || !emplacement.bobineId || !this.selectedDemande) {
      return;
    }

    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (bobine && 
        bobine.statut === 'DISPONIBLE' && 
        bobine.referenceBobine === this.selectedDemande.referenceBobine) {
      this.selectedBobine = bobine;
      this.selectedEmplacement = emplacement;
      this.showConfirmReservationModal = true;
    }
  }

  // Vérifier si une cellule est cliquable (bobine disponible et bonne référence)
  isCellClickable(emplacement: EmplacementStockage): boolean {
    if (!emplacement || !emplacement.bobineId || !this.selectedDemande) {
      return false;
    }

    const bobine = this.bobines.find(b => b.id === emplacement.bobineId);
    if (!bobine) {
      return false;
    }

    return bobine.statut === 'DISPONIBLE' && 
           bobine.referenceBobine === this.selectedDemande.referenceBobine;
  }

  // Ouvrir le modal de confirmation de réservation
  openConfirmReservationModal(): void {
    console.log('=== OUVERTURE MODAL CONFIRMATION ===');
    console.log('selectedBobine:', this.selectedBobine);
    console.log('selectedEmplacement:', this.selectedEmplacement);
    this.showConfirmReservationModal = true;
  }

  // Fermer le modal de confirmation de réservation
  closeConfirmReservationModal(): void {
    console.log('=== FERMETURE MODAL CONFIRMATION ===');
    this.showConfirmReservationModal = false;
    this.selectedBobine = null;
    this.selectedEmplacement = null;
  }

  // Confirmer la réservation
  confirmReservation(): void {
    console.log('=== BOUTON CONFIRMER CLIQUÉ ===');
    console.log('=== DÉBUT confirmReservation ===');
    console.log('selectedBobine:', this.selectedBobine);
    console.log('selectedDemande:', this.selectedDemande);
    
    if (!this.selectedBobine || !this.selectedDemande) {
      console.log('ERREUR: selectedBobine ou selectedDemande est null');
      return;
    }

    // Vérifier que la bobine est encore disponible
    console.log('Vérification du statut de la bobine avant réservation...');
    console.log('Statut actuel de la bobine:', this.selectedBobine.statut);
    
    if (this.selectedBobine.statut !== 'DISPONIBLE') {
      console.log('ERREUR: La bobine n\'est plus disponible - statut actuel:', this.selectedBobine.statut);
      this.errorMessage = `Cette bobine n'est plus disponible (statut: ${this.selectedBobine.statut}). Veuillez en sélectionner une autre.`;
      return;
    }

    console.log('Début de la réservation...');
    this.isProcessing = true;

    // 1. Réserver la bobine
    const bobineId = this.selectedBobine!.id;
    const userId = this.roleService.getUserId();
    
    if (!userId) {
      console.log('ERREUR: Utilisateur non connecté');
      this.errorMessage = 'Utilisateur non connecté. Veuillez vous reconnecter.';
      this.isProcessing = false;
      return;
    }
    
    console.log(`Appel bobineService.reserver(${bobineId}, ${userId})`);
    
    this.bobineService.reserver(bobineId, userId).subscribe({
      next: () => {
        console.log('Bobine réservée avec succès');
        // 2. Mettre à jour la demande avec l'ID de la bobine
        const demandeId = this.selectedDemande!.id;
        console.log(`Appel PUT /api/Demandes/${demandeId}`);
        
        this.demandeService.update(demandeId, {
          ...this.selectedDemande!,
          bobineId: this.selectedBobine!.id,
          dateAffectation: new Date().toISOString(),
          statut: 'EN_COURS' // Mettre la demande en cours après réservation
        }).subscribe({
          next: () => {
            console.log('Demande mise à jour avec succès');
            this.successMessage = 'Bobine réservée avec succès';
            this.closeConfirmReservationModal();
            this.closeReservationModal();
            this.loadDemandes();  // Recharger les demandes
            this.loadBobines();   // Recharger les bobines (statut RESERVEE)
            this.loadGrille();    // Recharger la grille (affichage des emplacements)
            this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
            this.clearMessagesAfterDelay();
            this.isProcessing = false;
          },
          error: (err: any) => {
            console.error('Erreur lors de la mise à jour de la demande:', err);
            this.errorMessage = 'Erreur lors de la mise à jour de la demande';
            this.isProcessing = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur lors de la réservation de la bobine:', err);
        console.error('Status:', err.status);
        console.error('StatusText:', err.statusText);
        console.error('Error body:', err.error);
        console.error('Error body JSON:', JSON.stringify(err.error, null, 2));
        
        if (err.status === 409) {
          console.log('ERREUR 409: Conflit de réservation');
          console.log('Bobine ID:', this.selectedBobine?.id);
          console.log('Statut frontend:', this.selectedBobine?.statut);
          
          // Vérifier si c'est un problème de FOREIGN KEY
          const errorMessage = err.error?.message || '';
          if (errorMessage.includes('FOREIGN KEY') && errorMessage.includes('FK_bobine_utilisateur')) {
            console.log('PROBLÈME FOREIGN KEY détecté dans la base de données');
            this.errorMessage = 'Erreur de base de données: Cette bobine est liée à un utilisateur inexistant. Veuillez contacter l\'administrateur système ou sélectionner une autre bobine.';
          } else {
            // Tenter de recharger les bobines pour voir le statut réel
            console.log('Rechargement des bobines pour vérifier le statut réel...');
            this.emplacementService.getAllBobines().subscribe({
              next: (bobines) => {
                this.bobines = bobines;
                const bobineActuelle = bobines.find(b => b.id === this.selectedBobine?.id);
                console.log('Statut réel de la bobine:', bobineActuelle?.statut);
                
                if (bobineActuelle && bobineActuelle.statut !== 'DISPONIBLE') {
                  this.errorMessage = `Cette bobine est déjà réservée (statut: ${bobineActuelle.statut}). Veuillez en sélectionner une autre.`;
                } else if (!bobineActuelle) {
                  this.errorMessage = 'Bobine introuvable. Veuillez rafraîchir la page et réessayer.';
                } else {
                  this.errorMessage = 'Conflit de réservation détecté. Veuillez réessayer avec une autre bobine.';
                }
              },
              error: (refreshErr: any) => {
                console.error('Erreur lors du rechargement des bobines:', refreshErr);
                this.errorMessage = 'Erreur lors de la réservation. Veuillez réessayer.';
              }
            });
          }
        } else {
          this.errorMessage = `Erreur lors de la réservation de la bobine (${err.status}): ${err.statusText}`;
        }
        this.isProcessing = false;
      }
    });
  }

  // Ouvrir le modal de prélèvement
  markBobinePrelevee(demande: Demande): void {
    if (!demande.bobineId) {
      return;
    }

    // Initialiser le modal
    this.selectedDemandeForPrelevement = demande;
    this.prelevementBobineId = null;
    this.prelevementEmplacementId = null;
    this.showPrelevementModal = true;
  }

  // Confirmer le prélèvement
  confirmerPrelevement(): void {
    if (!this.selectedDemandeForPrelevement || !this.prelevementForm.bobineId) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    const bobineId = this.prelevementForm.bobineId;

    // Vérifier que la bobine correspond à la demande
    if (bobineId !== this.selectedDemandeForPrelevement.bobineId) {
      this.errorMessage = `La bobine ID ${bobineId} ne correspond pas à la bobine réservée (ID ${this.selectedDemandeForPrelevement.bobineId})`;
      return;
    }

    this.isProcessing = true;

    // 1. Prélever la bobine avec le nouvel endpoint (body vide - l'emplacement est déjà connu)
    this.http.post(`http://localhost:5057/api/Bobines/${bobineId}/prelever`, {}).subscribe({
      next: () => {
        console.log(`Bobine ${bobineId} prélevée avec succès (statut EN_PRELEVEMENT)`);
        
        // 2. Mettre à jour les propriétés pour le modal de succès
        this.prelevementBobineId = bobineId;
        // L'emplacement est automatiquement libéré par le backend
        this.prelevementEmplacementId = null;
        
        // 3. Fermer le modal de prélèvement et ouvrir le modal de succès
        this.showPrelevementModal = false;
        this.showPrelevementSuccessModal = true;
        this.isProcessing = false;
        
        // 4. Recharger les données pour mettre à jour l'affichage
        this.loadDemandes();      // Mettre à jour le tableau des demandes
        this.loadBobines();       // Mettre à jour le statut des bobines
        this.loadGrille();        // Mettre à jour les emplacements (CRUCIAL !)
      },
      error: (err) => {
        console.error('Erreur lors du prélèvement de la bobine:', err);
        this.errorMessage = 'Erreur lors du prélèvement de la bobine';
        this.isProcessing = false;
      }
    });
  }

  // Ouvrir le modal de prélèvement
  openPrelevementModal(demande: Demande): void {
    console.log('=== OPEN PRÉLÈVEMENT MODAL ===');
    this.selectedDemandeForPrelevement = demande;
    this.prelevementForm = {
      bobineId: demande.bobineId || null
    };

    // Récupérer l'emplacement actuel de la bobine
    if (demande.bobineId) {
      console.log(`=== RECHERCHE EMPACEMENT POUR BOBINE ${demande.bobineId} ===`);
      console.log('Nombre total d\'emplacements chargés:', this.emplacements.length);
      console.log('Emplacements avec bobineId:', this.emplacements.filter(e => e.bobineId).length);
      
      // Afficher tous les emplacements qui ont une bobine pour le débogage
      const emplacementsAvecBobine = this.emplacements.filter(e => e.bobineId);
      console.log('Emplacements avec bobine:', emplacementsAvecBobine.map(e => ({
        id: e.id,
        bobineId: e.bobineId,
        coordonneeEmplacement: e.coordonneeEmplacement
      })));

      const emplacementActuel = this.emplacements.find(e => e.bobineId === demande.bobineId);
      if (emplacementActuel) {
        this.prelevementEmplacementId = emplacementActuel.id;
        this.prelevementEmplacementCoordonnees = emplacementActuel.coordonneeEmplacement;
        console.log(`✅ Bobine ${demande.bobineId} trouvée à l'emplacement: ${emplacementActuel.coordonneeEmplacement}`);
      } else {
        console.warn(`❌ Emplacement non trouvé pour la bobine ${demande.bobineId}`);
        console.warn('Recherche effectuée dans:', this.emplacements.map(e => ({ id: e.id, bobineId: e.bobineId })));
        
        // Si non trouvé dans les emplacements filtrés, essayer de tous les charger
        console.log('Tentative de chargement de tous les emplacements...');
        this.emplacementService.getAll().subscribe({
          next: (tousLesEmplacements) => {
            console.log('Tous les emplacements chargés:', tousLesEmplacements.length);
            const emplacementGlobal = tousLesEmplacements.find(e => e.bobineId === demande.bobineId);
            if (emplacementGlobal) {
              this.prelevementEmplacementId = emplacementGlobal.id;
              this.prelevementEmplacementCoordonnees = emplacementGlobal.coordonneeEmplacement;
              console.log(`✅ Bobine ${demande.bobineId} trouvée dans tous les emplacements: ${emplacementGlobal.coordonneeEmplacement}`);
              this.cdr.detectChanges(); // Forcer la mise à jour de l'affichage
            } else {
              console.warn(`❌ Bobine ${demande.bobineId} non trouvée même dans tous les emplacements`);
              this.prelevementEmplacementId = null;
              this.prelevementEmplacementCoordonnees = 'Non trouvé';
            }
          },
          error: (err) => {
            console.error('Erreur lors du chargement de tous les emplacements:', err);
            this.prelevementEmplacementId = null;
            this.prelevementEmplacementCoordonnees = 'Erreur de chargement';
          }
        });
      }
    } else {
      this.prelevementEmplacementId = null;
      this.prelevementEmplacementCoordonnees = '';
    }

    this.showPrelevementModal = true;
    this.clearMessages();
  }

  // Fermer le modal de prélèvement
  closePrelevementModal(): void {
    this.showPrelevementModal = false;
    this.selectedDemandeForPrelevement = null;
    this.prelevementBobineId = null;
    this.prelevementEmplacementId = null;
    this.prelevementEmplacementCoordonnees = '';
    this.errorMessage = '';
  }

  // Fermer le modal de succès de prélèvement
  closePrelevementSuccessModal(): void {
    this.showPrelevementSuccessModal = false;
    this.loadDemandes(); // Recharger les demandes
    this.loadBobines();  // Recharger les bobines pour mettre à jour le statut
    this.loadGrille();   // Recharger les emplacements (CRUCIAL !)
    this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
  }

  
  // Méthodes utilitaires pour la grille
  getRangeesAffichees(): number[] {
    return Array.from({ length: Math.min(this.nombreRangees, this.MAX_RANGEES_AFFICHES) }, (_, i) => i + 1);
  }

  getColonnesAffichees(): number[] {
    return Array.from({ length: Math.min(this.nombreColonnes, this.MAX_COLONNES_AFFICHES) }, (_, i) => i + 1);
  }

  // Charger les demandes de retour assignées à l'alimentateur
  loadDemandesRetourAlimentateur(): void {
    if (!this.alimentateurId) {
      console.log('ID alimentateur non disponible pour charger les demandes de retour');
      return;
    }

    this.loadingDemandesRetour = true;
    console.log('Chargement des demandes de retour pour l\'alimentateur:', this.alimentateurId);

    // Importer le service de demande de retour dynamiquement
    import('../demandes-retour/demande-retour.service').then(module => {
      const demandeRetourService = new module.DemandeRetourService(this.http);
      
      // Utiliser l'endpoint alimentateur/{alimentateurId}
      demandeRetourService.getByAlimentateur(this.alimentateurId!).subscribe({
        next: (retours) => {
          console.log('Demandes de retour chargées pour l\'alimentateur:', retours);
          this.demandesRetourATraiter = retours || [];
          this.loadingDemandesRetour = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erreur lors du chargement des demandes de retour:', err);
          this.errorMessage = 'Erreur lors du chargement des demandes de retour';
          this.demandesRetourATraiter = [];
          this.loadingDemandesRetour = false;
          this.cdr.detectChanges();
        }
      });
    }).catch(err => {
      console.error('Erreur lors de l\'import du service demande retour:', err);
      this.errorMessage = 'Erreur interne lors du chargement des demandes de retour';
      this.loadingDemandesRetour = false;
    });
  }

  getRetourStatutLabel(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'En attente';
      case 'ACTIF': return 'Actif';
      case 'TERMINE': return 'Terminée';
      default: return statut;
    }
  }

  getRetourStatutClass(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'status-gray';
      case 'ACTIF': return 'status-active';
      case 'TERMINE': return 'status-completed';
      default: return 'status-unknown';
    }
  }

  // Récupérer l'ordreTravailId depuis une demande de retour en chargeant la demande spécifique
  getOrdreTravailIdForRetour(retour: any): number | undefined {
    if (!retour.demandeId) return undefined;
    
    // D'abord, chercher dans les demandes déjà chargées
    const demandeAssociee = this.demandes.find(d => d.id === retour.demandeId);
    if (demandeAssociee) {
      return demandeAssociee.ordreTravailId;
    }
    
    // Si pas trouvée, charger la demande spécifique via getDemande
    console.log(`Chargement de la demande spécifique ${retour.demandeId}`);
    this.demandeService.getDemande(retour.demandeId).subscribe({
      next: (demande: any) => {
        console.log(`Demande ${retour.demandeId} chargée:`, demande);
        // Ajouter la demande à la liste pour les prochains appels
        this.demandes.push(demande);
        // Forcer la mise à jour de l'affichage
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(`Erreur lors du chargement de la demande ${retour.demandeId}:`, err);
      }
    });
    
    return undefined; // Retourner undefined pour l'instant, sera mis à jour après le chargement
  }

  // Obtenir la machine pour une demande de retour (réutilise la logique existante)
  getRetourMachineFromDemande(retour: any): string {
    const ordreTravailId = this.getOrdreTravailIdForRetour(retour);
    return this.getMachineForOrder(ordreTravailId); // ✅ Réutilise la méthode existante
  }

  // Charger les zones et sélectionner automatiquement la première pour le retour
  loadZonesAndAutoSelect(): void {
    this.loading = true;
    this.zoneService.getAll().subscribe({
      next: (zones) => {
        this.zones = zones;
        if (zones.length > 0) {
          this.selectedZoneRetour = zones[0].codeZone || zones[0].id;
          // Charger automatiquement la grille pour la première zone
          this.onZoneRetourChange();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des zones:', err);
        this.errorMessage = 'Erreur lors du chargement des zones';
        this.loading = false;
      }
    });
  }

  // Ouvrir le modal d'exécution pour une demande de retour
  openExecuteRetourModal(retour: any): void {
    this.selectedRetourToExecute = retour;
    this.executeRetourForm.emplacementRetourId = null;
    this.selectedZoneRetour = '';
    this.selectedEmplacementRetour = null;
    this.grilleRetour = [];
    this.showExecuteRetourModal = true;
    this.loadZonesAndAutoSelect(); // Charger les zones et sélectionner automatiquement la première
  }

  // Changement de zone pour le retour
  onZoneRetourChange(): void {
    if (!this.selectedZoneRetour) return;
    
    this.loadingRetourGrid = true;
    this.grilleRetour = [];
    
    // Importer le service d'emplacement de stockage dynamiquement
    import('../../services/emplacement-stockage.service').then(module => {
      const emplacementService = new module.EmplacementStockageService(this.http);
      
      emplacementService.getByZone(this.selectedZoneRetour).subscribe({
        next: (emplacements: any[]) => {
          // Transformer les emplacements en grille 2D
          this.grilleRetour = this.transformerEnGrille(emplacements);
          this.loadingRetourGrid = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Erreur lors du chargement de la grille de retour:', err);
          this.errorMessage = 'Erreur lors du chargement de la grille de stockage';
          this.loadingRetourGrid = false;
        }
      });
    }).catch((err: any) => {
      console.error('Erreur lors de l\'import du service emplacement:', err);
      this.errorMessage = 'Erreur interne lors du chargement de la grille';
      this.loadingRetourGrid = false;
    });
  }

  // Méthodes pour la grille de retour
  getColonnesRetourAffichees(): number[] {
    if (this.grilleRetour.length === 0) return [];
    return Array.from({length: this.grilleRetour[0].length}, (_, i) => i + 1);
  }

  getRangeesRetourAffichees(): number[] {
    return Array.from({length: this.grilleRetour.length}, (_, i) => i + 1);
  }

  getCouleurCelluleRetour(emplacement: any): string {
    if (!emplacement) return 'cell-empty';
    
    if (emplacement.bobineId) {
      return 'cell-occupied'; // Gris pour les emplacements occupés
    }
    
    return 'cell-available'; // Vert pour les emplacements vides
  }

  isCellRetourClickable(emplacement: any): boolean {
    // Uniquement les emplacements vides sont cliquables
    return emplacement && !emplacement.bobineId;
  }

  onEmplacementRetourClick(emplacement: any): void {
    if (!this.isCellRetourClickable(emplacement)) return;
    
    this.selectedEmplacementRetour = emplacement;
    this.executeRetourForm.emplacementRetourId = emplacement.id;
    this.showConfirmExecuteRetourModal = true;
  }

  closeConfirmExecuteRetourModal(): void {
    this.showConfirmExecuteRetourModal = false;
    this.selectedEmplacementRetour = null;
    this.executeRetourForm.emplacementRetourId = null;
  }

  // Transformer les emplacements en grille 2D
  transformerEnGrille(emplacements: any[]): any[][] {
    if (!emplacements || emplacements.length === 0) return [];
    
    // Trouver les dimensions maximales
    const maxRangee = Math.max(...emplacements.map(e => e.numeroRangee));
    const maxColonne = Math.max(...emplacements.map(e => e.numeroColonne));
    
    // Créer une grille vide
    const grille: any[][] = Array(maxRangee).fill(null).map(() => Array(maxColonne).fill(null));
    
    // Remplir la grille avec les emplacements
    emplacements.forEach(emplacement => {
      const rangee = emplacement.numeroRangee - 1; // -1 pour l'index 0-based
      const colonne = emplacement.numeroColonne - 1;
      
      if (rangee >= 0 && rangee < maxRangee && colonne >= 0 && colonne < maxColonne) {
        grille[rangee][colonne] = emplacement;
      }
    });
    
    return grille;
  }

  // Confirmer l'exécution du retour
  confirmerExecuteRetour(): void {
    if (!this.selectedRetourToExecute || !this.selectedEmplacementRetour) {
      this.errorMessage = 'Veuillez sélectionner un emplacement';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = null;

    // Importer les services dynamiquement
    import('../demandes-retour/demande-retour.service').then(module => {
      const demandeRetourService = new module.DemandeRetourService(this.http);
      
      // Importer le service de stockage pour l'endpoint retour-stock
      import('../../services/emplacement-stockage.service').then(stockModule => {
        const emplacementService = new stockModule.EmplacementStockageService(this.http);
        
        // Appeler l'endpoint /api/Bobines/retour-stock
        const retourStockDto = {
          bobineId: this.selectedRetourToExecute.bobineId,
          emplacementVideId: this.selectedEmplacementRetour.id
        };

        emplacementService.retourStock(retourStockDto).subscribe({
          next: (result) => {
            console.log('Bobine retournée au stock:', result);
            
            // Puis exécuter la demande de retour
            const executeDto = {
              emplacementRetourId: this.selectedEmplacementRetour.id
            };

            demandeRetourService.execute(this.selectedRetourToExecute.id, executeDto).subscribe({
              next: (retour) => {
                console.log('Demande de retour exécutée:', retour);
                this.successMessage = 'Demande de retour exécutée avec succès - Bobine remise en stock';
                this.closeConfirmExecuteRetourModal();
                this.closeExecuteRetourModal();
                this.loadDemandesRetourAlimentateur(); // Recharger les demandes
                this.clearMessagesAfterDelay();
                this.isProcessing = false;
              },
              error: (err: any) => {
                console.error('Erreur lors de l\'exécution de la demande de retour:', err);
                this.errorMessage = 'Erreur lors de l\'exécution de la demande de retour';
                this.isProcessing = false;
              }
            });
          },
          error: (err: any) => {
            console.error('Erreur lors du retour de la bobine au stock:', err);
            this.errorMessage = 'Erreur lors du retour de la bobine au stock';
            this.isProcessing = false;
          }
        });
      }).catch((err: any) => {
        console.error('Erreur lors de l\'import du service stock:', err);
        this.errorMessage = 'Erreur interne lors du retour de la bobine';
        this.isProcessing = false;
      });
    }).catch((err: any) => {
      console.error('Erreur lors de l\'import du service demande retour:', err);
      this.errorMessage = 'Erreur interne lors de l\'exécution';
      this.isProcessing = false;
    });
  }

  // Fermer le modal d'exécution
  closeExecuteRetourModal(): void {
    this.showExecuteRetourModal = false;
    this.selectedRetourToExecute = null;
    this.executeRetourForm.emplacementRetourId = null;
  }

  // Exécuter la demande de retour
  executeRetour(): void {
    if (!this.selectedRetourToExecute || !this.executeRetourForm.emplacementRetourId) {
      this.errorMessage = 'Veuillez sélectionner un emplacement';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = null;

    // Importer le service de demande de retour dynamiquement
    import('../demandes-retour/demande-retour.service').then(module => {
      const demandeRetourService = new module.DemandeRetourService(this.http);
      
      const executeDto = {
        emplacementRetourId: this.executeRetourForm.emplacementRetourId || undefined
      };

      demandeRetourService.execute(this.selectedRetourToExecute.id, executeDto).subscribe({
        next: (retour) => {
          console.log('Demande de retour exécutée:', retour);
          this.successMessage = 'Demande de retour exécutée avec succès';
          this.closeExecuteRetourModal();
          this.loadDemandesRetourAlimentateur(); // Recharger les demandes
          this.clearMessagesAfterDelay();
          this.isProcessing = false;
        },
        error: (err) => {
          console.error('Erreur lors de l\'exécution de la demande de retour:', err);
          this.errorMessage = 'Erreur lors de l\'exécution de la demande de retour';
          this.isProcessing = false;
        }
      });
    }).catch(err => {
      console.error('Erreur lors de l\'import du service demande retour:', err);
      this.errorMessage = 'Erreur interne lors de l\'exécution';
      this.isProcessing = false;
    });
  }

  // Vérifier si la demande de retour peut être exécutée
  canExecuteRetour(retour: any): boolean {
    return retour.statut === 'ACTIF';
  }

  viewRetourDetails(retour: any): void {
    this.selectedRetourDetails = retour;
    this.showRetourDetailsModal = true;
  }

  // Fermer le modal des détails
  closeRetourDetailsModal(): void {
    this.showRetourDetailsModal = false;
    this.selectedRetourDetails = null;
  }
}
