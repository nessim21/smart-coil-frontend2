import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { OperateurService, OrdreTravailOperateur, DemandeAssociee } from '../../services/operateur.service';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';
import { Bobine } from '../../services/bobine.service';
import { DemandeRetourService, CreateDemandeRetourDto } from '../demandes-retour/demande-retour.service';

@Component({
  selector: 'app-operateur-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, JsonPipe],
  templateUrl: './operateur-dashboard.component.html',
  styleUrl: './operateur-dashboard.component.css'
})
export class OperateurDashboard implements OnInit {
  // Services
  private operateurService = inject(OperateurService);
  private authService = inject(AuthService);
  private roleService = inject(RoleService);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private demandeRetourService = inject(DemandeRetourService);

  // Données
  ordresTravail: OrdreTravailOperateur[] = [];
  demandes: DemandeAssociee[] = [];
  ordreEnCours: OrdreTravailOperateur | null = null;
  prochainsOrdres: OrdreTravailOperateur[] = [];
  demandesAssociees: DemandeAssociee[] = [];

  // Demandes de retour
  demandesRetourOperateur: any[] = [];
  loadingRetours = false;

  // États
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showAttenteBobineModal = false;
  fakeTimer = '00:00:00'; // Fake timer au format HH:MM:SS

  // Info opérateur
  operateurId: number | null = null;
  operateurNom: string | null = null;

  // Liste des alimentateurs
  alimentateurs: { id: number; nom: string }[] = [];
  
  // Mapping des utilisateurs (pour les alimentateurs)
  utilisateursMap: { [key: number]: string } = {};
  
  // Liste des bobines (pour vérifier les statuts)
  bobines: Bobine[] = [];

  // Modal besoin bobine
  showBesoinBobineModal = false;
  showSuccessModal = false;
  isCreatingDemande = false;

  // Modal détails demande de retour
  showRetourDetailsModal = false;
  selectedRetourDetails: any = null;

    besoinBobineForm = {
    referenceBobine: '',
    ordreTravail: '',
    quantite: 1
  };

  ngOnInit(): void {
    console.log('=== OPERATEUR DASHBOARD INIT ===');
    this.getOperateurInfo();
    this.loadAlimentateurs();
    this.loadBobines();
    this.loadData();
  }

  // Récupérer les infos de l'opérateur connecté
  getOperateurInfo(): void {
    console.log('=== GET OPERATEUR INFO ===');
    const userInfo = this.authService.getUserInfo();
    console.log('User info from auth service:', userInfo);
    
    // Récupérer l'ID depuis le JWT via RoleService
    this.operateurId = this.roleService.getUserId();
    console.log('Opérateur ID from JWT:', this.operateurId);
    
    if (userInfo) {
      this.operateurNom = userInfo.nomUtilisateur;
      console.log('Opérateur Nom:', this.operateurNom);
    } else {
      console.error('No user info found');
      this.operateurNom = 'Opérateur inconnu';
    }
    
    if (!this.operateurId) {
      console.error('ID opérateur non disponible depuis JWT');
      this.errorMessage = 'Erreur: Impossible de récupérer l\'ID de l\'opérateur depuis le token';
    }
  }

  // Charger toutes les données
  loadData(): void {
    console.log('=== LOAD DATA START ===');
    console.log('Opérateur ID:', this.operateurId);
    console.log('Loading AVANT traitement:', this.loading);
    
    if (!this.operateurId) {
      console.error('ID opérateur non disponible');
      this.errorMessage = 'ID opérateur non disponible';
      this.loading = false; // S'assurer que loading est false
      console.log('Loading APRÈS erreur ID:', this.loading);
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    console.log('Loading set to true - Loading APRÈS set:', this.loading);
    this.cdr.detectChanges(); // Forcer la détection de changement
    
    // Ajouter un timeout de sécurité pour éviter que loading reste true indéfiniment
    setTimeout(() => {
      console.log('Timeout check - Loading actuel:', this.loading);
      if (this.loading) {
        console.warn('Timeout de chargement - forcing loading to false');
        this.loading = false;
        this.errorMessage = 'Le chargement a pris trop de temps. Veuillez réessayer.';
        console.log('Loading APRÈS timeout:', this.loading);
        this.cdr.detectChanges(); // Forcer la détection de changement
      }
    }, 10000); // 10 secondes de timeout

    // Charger les ordres de travail
    const apiUrl = `http://localhost:5206/api/OrdresTravail/utilisateur/${this.operateurId}`;
    console.log('API URL for ordres:', apiUrl);
    
    this.operateurService.getOrdresOperateur(this.operateurId).subscribe({
      next: (ordres) => {
        console.log('Ordres reçus:', ordres);
        this.ordresTravail = ordres || [];
        console.log('OrdresTravail array:', this.ordresTravail);
        this.processOrdres();
        
        // Charger les demandes après avoir les ordres
        this.loadDemandes();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des ordres:', err);
        console.error('Error details:', err.status, err.error);
        
        // Si erreur 403 ou 404, afficher un message d'erreur clair
        if (err.status === 403 || err.status === 404) {
          console.error('Erreur API - Impossible de charger les ordres de travail:', err.status);
          this.ordresTravail = [];
          this.processOrdres();
          
          // Continuer avec le chargement des demandes (sera vide si pas d'ordres)
          this.loadDemandes();
          
          this.errorMessage = `Erreur d'accès aux ordres de travail (${err.status}). Veuillez contacter l'administrateur.`;
          this.loading = false;
        } else {
          this.errorMessage = `Erreur lors du chargement des ordres: ${err.status}`;
          this.loading = false;
        }
      }
    });
  }

  // Charger les bobines (pour vérifier les statuts de réservation)
  loadBobines(): void {
    console.log('=== LOAD BOBINES (OPERATEUR) ===');
    
    this.http.get<Bobine[]>('http://localhost:5057/api/Bobines').subscribe({
      next: (bobines) => {
        console.log('Bobines chargées:', bobines.length);
        this.bobines = bobines;
        this.cdr.detectChanges(); // Forcer la mise à jour de l'interface
      },
      error: (err) => {
        console.error('Erreur lors du chargement des bobines:', err);
        this.bobines = [];
      }
    });
  }

  // Charger les demandes
  loadDemandes(): void {
    console.log('=== LOAD DEMANDES START ===');
    console.log('Opérateur ID pour demandes:', this.operateurId);
    console.log('Loading AVANT appel API demandes:', this.loading);
    
    // S'assurer que l'opérateur ID est disponible
    if (!this.operateurId) {
      console.error('ID opérateur non disponible pour charger les demandes');
      this.demandes = [];
      this.processDemandes();
      this.loading = false;
      return;
    }
    
    this.operateurService.getDemandes(this.operateurId).subscribe({
      next: (demandes) => {
        console.log('Demandes reçues de l\'API pour l\'opérateur:', this.operateurId, demandes);
        
        // Analyser la structure des données reçues
        if (demandes && demandes.length > 0) {
          console.log('=== ANALYSE STRUCTURE DEMANDES ===');
          demandes.forEach((demande, index) => {
            console.log(`Demande ${index + 1}:`);
            console.log('  - ID:', demande.id);
            console.log('  - Référence bobine:', demande.referenceBobine);
            console.log('  - Statut:', demande.statut);
            console.log('  - utilisateurAssigneId (alimentateur):', demande.utilisateurAssigneId);
            console.log('  - ordreTravailId:', demande.ordreTravailId);
            console.log('  - Structure complète:', JSON.stringify(demande, null, 2));
          });
        }
        
        // Le backend retourne déjà les demandes filtrées par opérateur
        // Plus besoin de filtrer, utiliser directement les données reçues
        this.demandes = demandes || [];
        
        console.log(`Demandes chargées pour l'opérateur ${this.operateurId} (${this.demandes.length} demandes):`, this.demandes);
        this.processDemandes();
        
        // Charger les demandes de retour après les demandes
        this.loadDemandesRetourOperateur();
        
        this.loading = false;
        console.log('Loading set to false (demandes chargées) - Loading APRÈS:', this.loading);
        this.cdr.detectChanges(); // Forcer la détection de changement
      },
      error: (err) => {
        console.error('Erreur lors du chargement des demandes:', err);
        console.error('Error details:', err.status, err.error);
        
        // En cas d'erreur, ne pas créer de données de test
        this.demandes = [];
        this.processDemandes();
        this.loading = false;
        
        // Afficher un message d'erreur clair
        if (err.status === 404) {
          this.errorMessage = `Endpoint des demandes non disponible (404). L'endpoint /api/Demandes/utilisateur/{id} doit être implémenté dans le backend.`;
        } else if (err.status === 403) {
          this.errorMessage = `Accès aux demandes refusé (403). Vérifiez que l'opérateur a les droits nécessaires.`;
        } else {
          this.errorMessage = `Erreur lors du chargement des demandes: ${err.status}`;
        }
        
        console.log('Loading set to false (erreur demandes) - Loading APRÈS:', this.loading);
        this.cdr.detectChanges(); // Forcer la détection de changement
      }
    });
  }

  // Traiter les ordres de travail
  processOrdres(): void {
    console.log('=== PROCESS ORDRES START ===');
    console.log('Ordres to process:', this.ordresTravail);
    
    // Afficher le statut de chaque ordre pour le debug
    this.ordresTravail.forEach(ordre => {
      console.log(`Ordre ${ordre.id} (${ordre.numeroOrdre}): ${ordre.statut}`);
    });
    
    this.ordreEnCours = this.operateurService.getOrdreEnCours(this.ordresTravail);
    this.prochainsOrdres = this.operateurService.getProchainsOrdres(this.ordresTravail);
    
    console.log('=== RÉSULTAT TRAITEMENT ===');
    console.log('Ordre en cours:', this.ordreEnCours);
    console.log('Prochains ordres:', this.prochainsOrdres);
    console.log('Nombre de prochains ordres:', this.prochainsOrdres.length);
    
    // Vérifier que les ordres terminés ne sont pas dans les prochains ordres
    const ordresTermines = this.ordresTravail.filter(o => o.statut === 'TERMINE');
    console.log('Ordres terminés:', ordresTermines);
    
    const ordresTerminesDansProchains = this.prochainsOrdres.filter(po => 
      ordresTermines.some(ot => ot.id === po.id)
    );
    
    if (ordresTerminesDansProchains.length > 0) {
      console.error('❌ ERREUR : Des ordres terminés sont dans les prochains ordres !', ordresTerminesDansProchains);
    } else {
      console.log('✅ OK : Aucun ordre terminé dans les prochains ordres');
    }
  }

  // Traiter les demandes
  processDemandes(): void {
    console.log('=== PROCESS DEMANDES START ===');
    console.log('Demandes reçues du backend:', this.demandes);
    
    // Le backend retourne déjà les demandes filtrées pour l'opérateur
    // Plus besoin de filtrer, utiliser directement les données reçues
    this.demandesAssociees = this.demandes;
    console.log('Demandes associées (directement du backend):', this.demandesAssociees);
  }

  
  // Mettre à jour le statut d'un ordre
  updateStatutOrdre(ordreId: number, nouveauStatut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE'): void {
    console.log(`=== UPDATE STATUT ORDRE ===`);
    console.log(`Ordre ID: ${ordreId}, Nouveau statut: ${nouveauStatut}`);
    
    this.operateurService.updateStatutOrdre(ordreId, nouveauStatut).subscribe({
      next: (response) => {
        console.log('Réponse mise à jour statut:', response);
        
        // Vérifier si la réponse vient de l'API ou de la simulation
        if (response && response.message && response.message.includes('simulation')) {
          console.log('🔄 Mode simulation activé');
          this.successMessage = 'Statut de l\'ordre mis à jour (simulation)';
          // Mettre à jour les données localement pour la simulation
          this.updateOrdreStatutLocal(ordreId, nouveauStatut);
        } else {
          console.log('✅ API backend connectée');
          this.successMessage = 'Statut de l\'ordre mis à jour avec succès dans la base de données';
          
          // Recharger les données depuis le backend pour avoir les vraies valeurs
          // Ajouter un petit délai pour s'assurer que le backend a bien mis à jour
          setTimeout(() => {
            console.log('Rechargement des données depuis le backend...');
            this.loadData();
          }, 300); // 300ms de délai
        }
        
        this.clearMessagesAfterDelay();
      },
      error: (err) => {
        console.error('❌ Erreur lors de la mise à jour du statut:', err);
        
        // Gérer les erreurs spécifiques
        if (err.status === 403) {
          this.errorMessage = 'Permission refusée : Seuls ADMIN et OPERATEUR_MACHINE peuvent modifier le statut';
        } else if (err.status === 404) {
          this.errorMessage = 'Ordre de travail non trouvé';
        } else if (err.status === 400) {
          this.errorMessage = 'Statut invalide ou transition non autorisée';
        } else {
          this.errorMessage = 'Erreur lors de la mise à jour du statut';
        }
        
        this.clearMessagesAfterDelay();
      }
    });
  }

  // Mettre à jour le statut d'un ordre localement (pour la simulation)
  updateOrdreStatutLocal(ordreId: number, nouveauStatut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE'): void {
    console.log(`=== UPDATE STATUT LOCAL ===`);
    console.log(`Ordre ID: ${ordreId}, Nouveau statut: ${nouveauStatut}`);
    
    // Mettre à jour l'ordre dans la liste
    const ordreIndex = this.ordresTravail.findIndex(o => o.id === ordreId);
    if (ordreIndex !== -1) {
      this.ordresTravail[ordreIndex].statut = nouveauStatut;
      console.log('Ordre mis à jour localement:', this.ordresTravail[ordreIndex]);
      
      // Reprocesser les ordres
      this.processOrdres();
      
      console.log('Ordre en cours après mise à jour:', this.ordreEnCours);
      console.log('Prochains ordres après mise à jour:', this.prochainsOrdres);
    }
  }

  // Vérifier si l'ordre peut être démarré (demande terminée)
  peutDemarrerOrdre(): boolean {
    if (!this.ordreEnCours) return false;
    
    // Trouver la demande associée à cet ordre
    const demandeAssociee = this.demandesAssociees.find(d => d.ordreTravailId === this.ordreEnCours!.id);
    
    // L'ordre peut démarrer seulement si la demande est terminée (seulement TERMINEE est disponible dans le type)
    return demandeAssociee ? demandeAssociee.statut === 'TERMINEE' : false;
  }

  // Afficher le message d'attente de bobine
  afficherMessageAttenteBobine(): void {
    this.showAttenteBobineModal = true;
  }

  // Fermer le message d'attente de bobine
  fermerMessageAttenteBobine(): void {
    this.showAttenteBobineModal = false;
  }

  // Démarrer l'ordre en cours
  demarrerOrdre(): void {
    if (this.ordreEnCours) {
      // Valider la transition : EN_ATTENTE → EN_COURS
      if (this.ordreEnCours.statut === 'EN_ATTENTE') {
        // Vérifier que la demande est terminée avant de démarrer
        if (!this.peutDemarrerOrdre()) {
          this.afficherMessageAttenteBobine();
          return;
        }
        
        // Initialiser le fake timer
        this.fakeTimer = '00:00:00';
        
        // Mettre à jour la bobine associée à la demande de cet ordre
        this.mettreBobineEnLivrePourOrdre(this.ordreEnCours.id);
        
        // Mettre à jour le statut de l'ordre
        this.updateStatutOrdre(this.ordreEnCours.id, 'EN_COURS');
      } else {
        this.errorMessage = 'Seul un ordre en attente peut être démarré';
      }
    }
  }

  // Mettre la bobine associée à un ordre en statut EPUISEE (Livrée)
  mettreBobineEnLivrePourOrdre(ordreId: number): void {
    console.log(`=== METTRE BOBINE EN LIVRÉE POUR ORDRE ${ordreId} ===`);
    
    // Trouver la demande associée à cet ordre
    const demandeAssociee = this.demandesAssociees.find(d => d.ordreTravailId === ordreId);
    
    if (!demandeAssociee || !demandeAssociee.bobineId) {
      console.log('Aucune demande ou bobine associée trouvée pour cet ordre');
      this.errorMessage = 'Aucune bobine associée à cet ordre de travail';
      return;
    }
    
    console.log(`Demande trouvée: ${demandeAssociee.id}, Bobine ID: ${demandeAssociee.bobineId}`);
    
    // Mettre à jour le statut de la bobine à EPUISEE (Livrée)
    const bobineId = demandeAssociee.bobineId;
    const bobineApiUrl = `http://localhost:5057/api/Bobines/${bobineId}`;
    
    this.http.put(bobineApiUrl, {
      statut: 'EPUISEE'
    }).subscribe({
      next: () => {
        console.log(`Bobine ${bobineId} marquée comme EPUISEE (Livrée) avec succès`);
        this.successMessage = 'Bobine marquée comme livrée';
      },
      error: (err) => {
        console.error('Erreur lors du marquage de la bobine comme livrée:', err);
        this.errorMessage = 'Erreur lors du marquage de la bobine comme livrée';
      }
    });
  }

  // Terminer l'ordre en cours
  terminerOrdre(): void {
    if (this.ordreEnCours) {
      // Valider la transition : EN_COURS → TERMINE
      if (this.ordreEnCours.statut === 'EN_COURS') {
        // Sauvegarder l'ID de l'ordre avant la mise à jour
        const ordreId = this.ordreEnCours.id;
        
        this.updateStatutOrdre(this.ordreEnCours.id, 'TERMINE');
        
        // Attendre un court délai pour que la mise à jour de l'ordre soit effective
        setTimeout(() => {
          this.mettreAJourDemandeRetour(ordreId);
        }, 500);
      } else {
        this.errorMessage = 'Seul un ordre en cours peut être terminé';
        this.clearMessagesAfterDelay();
      }
    }
  }

  // Mettre à jour la demande de retour associée pour la rendre assignable
  private mettreAJourDemandeRetour(ordreId: number): void {
    // Importer le service de demande de retour
    import('../demandes-retour/demande-retour.service').then(module => {
      const DemandeRetourService = module.DemandeRetourService;
      const demandeRetourService = new DemandeRetourService(this.http);
      
      // Trouver d'abord la demande associée à l'ordre de travail spécifié
      const demandeAssociee = this.demandesAssociees.find(d => 
        d.ordreTravailId === ordreId
      );
      
      if (!demandeAssociee) {
        return;
      }
      
      // Ensuite chercher la demande de retour associée à cette demande
      demandeRetourService.getByOperateur(this.operateurId || 0).subscribe({
        next: (retours) => {
          const retourAssocie = retours.find(r => 
            r.demandeId === demandeAssociee.id
          );
          
          if (retourAssocie && retourAssocie.statut === 'GRIS') {
            // Activer la demande de retour
            demandeRetourService.activer(retourAssocie.id).subscribe({
              next: () => {
                this.successMessage = 'Ordre terminé. Demande de retour prête pour assignation.';
                this.clearMessagesAfterDelay();
              },
              error: (err) => {
                this.errorMessage = 'Erreur lors de l\'activation de la demande de retour';
                this.clearMessagesAfterDelay();
              }
            });
          }
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors du chargement des demandes de retour';
          this.cdr.detectChanges();
        }
      });
    }).catch(err => {
      this.errorMessage = 'Erreur interne lors de l\'activation';
    });
  }

  // Valider une transition de statut selon les règles métier
  private isValidTransition(statutActuel: string, nouveauStatut: string): boolean {
    const transitionsValides: Record<string, string[]> = {
      'EN_ATTENTE': ['EN_COURS'],
      'EN_COURS': ['TERMINE'],
      'TERMINE': [] // Pas de transition depuis TERMINE
    };
    
    return transitionsValides[statutActuel]?.includes(nouveauStatut) || false;
  }

  // Formater le statut pour l'affichage
  formatStatut(statut: string): string {
    return this.operateurService.formatStatut(statut);
  }

  // Obtenir la classe CSS pour le statut
  getStatutClass(statut: string): string {
    return this.operateurService.getStatutClass(statut);
  }

  // Debug l'état de loading
  debugLoadingState(): void {
    console.log('=== DEBUG LOADING STATE ===');
    console.log('Loading actuel:', this.loading);
    console.log('Opérateur ID:', this.operateurId);
    console.log('Ordres travail:', this.ordresTravail.length);
    console.log('Demandes:', this.demandes.length);
    console.log('Ordre en cours:', this.ordreEnCours);
    console.log('Prochains ordres:', this.prochainsOrdres.length);
    console.log('Error message:', this.errorMessage);
    
    // Forcer loading à false si bloqué
    if (this.loading) {
      console.warn('⚠️ Loading bloqué - forcing à false');
      this.loading = false;
      console.log('Loading APRÈS force:', this.loading);
      this.cdr.detectChanges(); // Forcer la détection de changement
    }
  }

  // Ouvrir le formulaire besoin bobine
  ouvrirFormulaireBesoinBobine(ordre: OrdreTravailOperateur): void {
    console.log('=== OUVRIR FORMULAIRE BESOIN BOBINE ===');
    console.log('Ordre sélectionné:', ordre);
    
    this.besoinBobineForm = {
      referenceBobine: ordre.referenceBobine,
      ordreTravail: ordre.numeroOrdre,
      quantite: ordre.quantiteRequise || 1
    };
    
    this.showBesoinBobineModal = true;
    console.log('Formulaire besoin bobine ouvert:', this.besoinBobineForm);
    this.cdr.detectChanges(); // Forcer la détection de changement
  }

  // Fermer le formulaire besoin bobine
  fermerFormulaireBesoinBobine(): void {
    console.log('=== FERMER FORMULAIRE BESOIN BOBINE ===');
    this.showBesoinBobineModal = false;
    this.besoinBobineForm = {
      referenceBobine: '',
      ordreTravail: '',
      quantite: 1
    };
    console.log('Formulaire besoin bobine fermé');
    this.cdr.detectChanges(); // Forcer la détection de changement
  }

  // Fermer le modal de succès
  fermerModalSucces(): void {
    console.log('=== FERMER MODAL SUCCÈS ===');
    this.showSuccessModal = false;
    this.cdr.detectChanges(); // Forcer la détection de changement
  }

  // Créer une demande prioritaire
  creerDemandePrioritaire(): void {
    console.log('=== CREER DEMANDE PRIORITAIRE ===');
    console.log('État isCreatingDemande avant:', this.isCreatingDemande);
    console.log('Formulaire:', this.besoinBobineForm);
    
    // Éviter les créations multiples
    if (this.isCreatingDemande) {
      console.warn('Création déjà en cours... isCreatingDemande =', this.isCreatingDemande);
      return;
    }
    
    if (!this.operateurId) {
      console.error('ID opérateur non disponible pour créer la demande');
      this.errorMessage = 'ID opérateur non disponible pour créer la demande';
      this.cdr.detectChanges();
      return;
    }

    // Activer l'état de création
    console.log('Activation de isCreatingDemande = true');
    this.isCreatingDemande = true;
    this.cdr.detectChanges();
    
    // Log pour vérifier que l'état est bien activé
    console.log('État isCreatingDemande après activation:', this.isCreatingDemande);

    // Créer l'objet demande selon le format DemandePrioritaireDto du backend
    const demandePrioritaireDto = {
      UtilisateurId: this.operateurId,
      ReferenceBobine: this.besoinBobineForm.referenceBobine,
      OrdreTravailId: this.ordreEnCours?.id || 1
    };

    console.log('DemandePrioritaireDto à envoyer:', demandePrioritaireDto);

    // Appeler le service pour créer la demande
    this.operateurService.creerDemande(demandePrioritaireDto).subscribe({
      next: (demandeCreee: any) => {
        console.log('Demande prioritaire créée avec succès:', demandeCreee);
        console.log('État isCreatingDemande dans next avant réinitialisation:', this.isCreatingDemande);
        
        // Fermer le formulaire immédiatement
        this.fermerFormulaireBesoinBobine();
        
        // Afficher le modal de succès
        this.showSuccessModal = true;
        
        // Réinitialiser l'état de création de manière agressive
        this.isCreatingDemande = false;
        console.log('État isCreatingDemande dans next après réinitialisation:', this.isCreatingDemande);
        
        // Forcer la détection de changement plusieurs fois
        this.cdr.detectChanges();
        setTimeout(() => this.cdr.detectChanges(), 100);
        setTimeout(() => this.cdr.detectChanges(), 200);
        
        // Recharger les demandes pour afficher la nouvelle demande
        setTimeout(() => {
          this.loadDemandes();
        }, 500);
        
        // Fermer automatiquement le modal de succès après 3 secondes
        setTimeout(() => {
          this.fermerModalSucces();
        }, 3000);
      },
      error: (err: any) => {
        console.error('Erreur lors de la création de la demande prioritaire:', err);
        console.log('État isCreatingDemande dans error avant réinitialisation:', this.isCreatingDemande);
        
        // Fermer le formulaire immédiatement pour éviter l'état bloqué
        this.fermerFormulaireBesoinBobine();
        
        // Réinitialiser l'état de création de manière agressive
        this.isCreatingDemande = false;
        console.log('État isCreatingDemande dans error après réinitialisation:', this.isCreatingDemande);
        
        // Forcer la détection de changement plusieurs fois
        this.cdr.detectChanges();
        setTimeout(() => this.cdr.detectChanges(), 100);
        setTimeout(() => this.cdr.detectChanges(), 200);
        
        // Si l'API n'existe pas, créer la demande localement
        if (err.status === 404 || err.status === 403) {
          console.log('API non disponible - Création locale de la demande prioritaire');
          
          const nouvelleDemande: DemandeAssociee = {
            id: Date.now(), // ID temporaire pour l'affichage
            referenceBobine: demandePrioritaireDto.ReferenceBobine,
            niveauPriorite: 'PRIORITAIRE',
            statut: 'NON_AFFECTEE',
            utilisateurAssigneId: demandePrioritaireDto.UtilisateurId,
            ordreTravailId: demandePrioritaireDto.OrdreTravailId,
            dateCreation: new Date().toISOString()
          };
          
          // Ajouter à la liste des demandes
          this.demandes.push(nouvelleDemande);
          this.processDemandes();
          
          // Afficher le message de succès
          this.successMessage = 'Demande urgente créée localement (mode démo). Elle sera visible dans votre tableau.';
          
          console.log('Demande prioritaire créée localement:', nouvelleDemande);
        } else {
          this.errorMessage = `Erreur lors de la création de la demande: ${err.status}`;
        }
        
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('Observable completed - État isCreatingDemande:', this.isCreatingDemande);
        
        // S'assurer que l'état est réinitialisé même si quelque chose d'inattendu se produit
        if (this.isCreatingDemande) {
          console.warn('État de création toujours actif dans complete - réinitialisation forcée');
          this.isCreatingDemande = false;
          this.fermerFormulaireBesoinBobine();
          console.log('État isCreatingDemande dans complete après réinitialisation forcée:', this.isCreatingDemande);
          this.cdr.detectChanges();
          setTimeout(() => this.cdr.detectChanges(), 100);
        }
      }
    });
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

  
  // Récupérer les alimentateurs depuis l'API AuthService
  loadAlimentateurs(): void {
    console.log('=== LOAD ALIMENTATEURS ===');
    
    // URL de l'API AuthService
    const authApiUrl = 'http://localhost:5268/api/Utilisateurs/public/role/ALIMENTATEUR';
    
    this.http.get<any[]>(authApiUrl).subscribe({
      next: (utilisateurs: any[]) => {
        console.log('Alimentateurs récupérés depuis AuthService:', utilisateurs);
        
        // Créer le mapping ID -> Nom
        this.utilisateursMap = {};
        this.alimentateurs = utilisateurs.map((utilisateur: any) => {
          this.utilisateursMap[utilisateur.id] = utilisateur.nomUtilisateur;
          return {
            id: utilisateur.id,
            nom: utilisateur.nomUtilisateur
          };
        });
        
        console.log('Mapping des utilisateurs:', this.utilisateursMap);
        console.log('Alimentateurs chargés:', this.alimentateurs);
        
        // Forcer la détection de changement pour mettre à jour l'affichage
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des alimentateurs:', err);
        console.log('Utilisation des noms par défaut (Alimentateur ID)');
        
        // En cas d'erreur, initialiser avec une liste vide
        this.alimentateurs = [];
        this.utilisateursMap = {};
      }
    });
  }

  // Obtenir le nom de l'alimentateur à partir de son ID
  getNomAlimentateur(alimentateurId: number): string {
    console.log(`=== GET NOM ALIMENTATEUR ===`);
    console.log(`alimentateurId reçu: ${alimentateurId}`);
    console.log(`Type de alimentateurId: ${typeof alimentateurId}`);
    console.log(`Mapping utilisateurs disponible:`, this.utilisateursMap);
    
    // Si l'ID est 0, undefined, ou null, retourner "Non assigné"
    if (!alimentateurId || alimentateurId === 0) {
      console.log('Retour: Non assigné (ID = 0, undefined ou null)');
      return 'Non assigné';
    }
    
    // S'assurer que c'est un nombre
    const idNumber = Number(alimentateurId);
    console.log(`ID converti en nombre: ${idNumber}`);
    
    // Chercher le nom dans le mapping des utilisateurs
    const nomAlimentateur = this.utilisateursMap[idNumber];
    
    if (nomAlimentateur) {
      console.log(`Retour: ${nomAlimentateur} (nom trouvé dans mapping)`);
      return nomAlimentateur;
    } else {
      // Si pas trouvé dans le mapping, utiliser le format par défaut
      const resultat = `Alimentateur ${idNumber}`;
      console.log(`Retour: ${resultat} (non trouvé dans mapping, format par défaut)`);
      return resultat;
    }
  }

  // Obtenir le numéro de l'ordre de travail à partir de son ID
  getNumeroOrdreTravail(ordreTravailId: number): string {
    const ordre = this.ordresTravail.find(o => o.id === ordreTravailId);
    return ordre ? ordre.numeroOrdre : `OT-${ordreTravailId}`;
  }

  // Obtenir la machine associée à l'ordre de travail
  getMachineOrdreTravail(ordreTravailId: number): string {
    const ordre = this.ordresTravail.find(o => o.id === ordreTravailId);
    return ordre ? ordre.idMachine : 'N/A';
  }

  // Recharger uniquement les demandes
  refreshDemandes(): void {
    console.log('=== REFRESH DEMANDES MANUEL ===');
    console.log('Opérateur ID:', this.operateurId);
    console.log('Timestamp:', new Date().toISOString());
    
    // Effacer les messages précédents
    this.errorMessage = null;
    this.successMessage = null;
    
    // S'assurer que l'état est réinitialisé même si quelque chose d'inattendu se produit
    if (this.isCreatingDemande) {
      console.warn('État de création toujours actif dans complete - réinitialisation forcée');
      this.isCreatingDemande = false;
      this.fermerFormulaireBesoinBobine();
      console.log('État isCreatingDemande dans complete après réinitialisation forcée:', this.isCreatingDemande);
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 100);
      return;
    }
    
    // Recharger les demandes
    this.loadDemandes();
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

  // Vérifier si la bobine est prélevée (statut EN_PRELEVEMENT)
  isBobinePrelevee(demande: DemandeAssociee): boolean {
    if (!demande.bobineId) {
      return false;
    }
    const bobine = this.bobines.find(b => b.id === demande.bobineId);
    return bobine ? bobine.statut === 'EN_PRELEVEMENT' : false;
  }

  // Confirmer la livraison d'une bobine (3 appels API séquentiels)
  confirmerLivraison(demande: DemandeAssociee): void {
    console.log('=== CONFIRMER LIVRAISON (OPERATEUR) ===');
    console.log('Demande:', demande);
    
    if (!demande.bobineId) {
      console.error('Aucune bobine associée à cette demande');
      this.errorMessage = 'Aucune bobine associée à cette demande';
      return;
    }

    const bobineId = demande.bobineId;
    const maintenant = new Date().toISOString();
    
    console.log('DÉBUT DES 3 APPELS API SÉQUENTIELS...');
    
    // APPEL 1: Terminer la demande (DemandeService)
    console.log(`APPEL 1: PUT /api/Demandes/${demande.id} - Terminer la demande`);
    this.http.put(`http://localhost:5206/api/Demandes/${demande.id}`, {
      statut: "TERMINEE",
      dateTerminaison: maintenant
    }).subscribe({
      next: () => {
        console.log('✅ APPEL 1 RÉUSSI: Demande terminée');
        
        // APPEL 2: Livrer la bobine (StockService)
        console.log(`APPEL 2: POST /api/Bobines/${bobineId}/livrer - Livrer la bobine`);
        this.http.post(`http://localhost:5057/api/Bobines/${bobineId}/livrer`, {}).subscribe({
          next: () => {
            console.log('✅ APPEL 2 RÉUSSI: Bobine mise en EN_COURS');
            
            // APPEL 3: Créer une demande de retour (DemandeRetourService)
            console.log('APPEL 3: Créer demande de retour via DemandeRetourService');
            const createRetourDto: CreateDemandeRetourDto = {
              bobineId: bobineId,
              demandeId: demande.id
              // Pas d'utilisateurId (sera assigné plus tard par l'admin)
            };
            
            this.demandeRetourService.create(createRetourDto).subscribe({
              next: (retour) => {
                console.log('✅ APPEL 3 RÉUSSI: Demande de retour créée');
                console.log('ID retour:', retour.id);
                
                this.successMessage = `Livraison terminée. Demande de retour #${retour.id} créée.`;
                
                // Charger toutes les données
                this.loadData();
                this.clearMessagesAfterDelay();
              },
              error: (err: any) => {
                console.error('❌ ERREUR APPEL 3: Création demande retour:', err);
                this.errorMessage = 'Erreur lors de la création de la demande de retour';
                this.clearMessagesAfterDelay();
              }
            });
          },
          error: (err) => {
            console.error('❌ ERREUR APPEL 2: Mise à jour bobine:', err);
            this.errorMessage = 'Erreur lors de la mise à jour de la bobine';
            this.clearMessagesAfterDelay();
          }
        });
      },
      error: (err) => {
        console.error('❌ ERREUR APPEL 1: Terminaison demande:', err);
        this.errorMessage = 'Erreur lors de la terminaison de la demande';
        this.clearMessagesAfterDelay();
      }
    });
  }

  // Recharger les données
  refresh(): void {
    this.loadData();
  }

  
  // Charger les demandes de retour de l'opérateur
  loadDemandesRetourOperateur(): void {
    if (!this.operateurId) return;
    
    this.loadingRetours = true;
    
    import('../demandes-retour/demande-retour.service').then(module => {
      const DemandeRetourService = module.DemandeRetourService;
      const demandeRetourService = new DemandeRetourService(this.http);
      
      demandeRetourService.getByOperateur(this.operateurId!).subscribe({
        next: (retours) => {
          this.demandesRetourOperateur = retours;
          this.loadingRetours = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement des demandes de retour:', err);
          this.demandesRetourOperateur = [];
          this.loadingRetours = false;
        }
      });
    }).catch(err => {
      console.error('Erreur lors de l\'import du service:', err);
      this.demandesRetourOperateur = [];
      this.loadingRetours = false;
    });
  }

  // Rafraîchir les demandes de retour
  refreshRetours(): void {
    this.loadDemandesRetourOperateur();
  }

  // Obtenir le libellé du statut de retour
  getRetourStatutLabel(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'En attente';
      case 'ACTIF': return 'Actif';
      case 'TERMINE': return 'Terminée';
      default: return statut || 'Inconnu';
    }
  }

  // Obtenir la classe CSS pour le statut de retour
  getRetourStatutClass(statut: string): string {
    switch (statut) {
      case 'GRIS': return 'status-gray';
      case 'ACTIF': return 'status-active';
      case 'TERMINE': return 'status-completed';
      default: return 'status-unknown';
    }
  }

  // Obtenir le nom de la demande associée
  getDemandeReference(demandeId: number): string {
    const demande = this.demandes.find(d => d.id === demandeId);
    return demande ? demande.referenceBobine : 'Inconnue';
  }

  // Voir les détails d'une demande de retour
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
