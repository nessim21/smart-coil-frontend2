import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Demande {
  id: number;
  niveauPriorite: 'NORMAL' | 'PRIORITAIRE';
  utilisateurId: number;
  referenceBobine: string;
  statut: 'NON_AFFECTEE' | 'EN_COURS' | 'TERMINE' | 'TERMINEE';
  utilisateurAssigneId?: number;
  ordreTravailId: number;
  bobineId?: number;
  dateCreation: Date;
  dateAffectation?: Date;
  dateTerminaison?: Date;
}

export interface CreateDemandeDto {
  niveauPriorite: 'NORMAL' | 'PRIORITAIRE';
  utilisateurId: number;
  ordreTravailId: number;
  utilisateurAssigneId?: number;  // optionnel : ID du feeder à assigner immédiatement
}

export interface UpdateDemandeDto {
  statut?: 'NON_AFFECTEE' | 'EN_COURS' | 'TERMINE' | 'TERMINEE';
  utilisateurAssigneId?: number | null;  // Permettre null pour désassigner
  bobineId?: number | null;  // ID de la bobine assignée (null pour détacher)
  dateAffectation?: string | null;  // Date d'affectation de la bobine (null pour effacer)
}

export interface Utilisateur {
  id: number;
  nomUtilisateur: string;
  codeBadge?: string;
  telephone?: string;
  bureau?: string;
  estActif: boolean;
  roles?: string[];
  dateCreation?: string;
}

export interface WorkOrder {
  id: number;
  numero: string;
  description?: string;
  statut?: string;
  dateCreation?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DemandeService {
  private apiUrl = 'http://localhost:5206/api/Demandes';
  private utilisateursUrl = 'http://localhost:5268/api/Utilisateurs';

  constructor(private http: HttpClient) {}

  // Récupérer toutes les demandes
  getDemandes(): Observable<Demande[]> {
    return this.http.get<Demande[]>(this.apiUrl);
  }

  // Obtenir les demandes assignées à un alimentateur spécifique
  getDemandesByAlimentateur(alimentateurId: number): Observable<Demande[]> {
    return this.http.get<Demande[]>(`${this.apiUrl}/alimentateur/${alimentateurId}`);
  }

  // Récupérer tous les work orders
  getWorkOrders(): Observable<WorkOrder[]> {
    return this.http.get<WorkOrder[]>('http://localhost:5057/api/OrdresTravail');
  }

  // Récupérer une demande par ID
  getDemande(id: number): Observable<Demande> {
    return this.http.get<Demande>(`${this.apiUrl}/${id}`);
  }

  // Créer une demande normale
  create(dto: CreateDemandeDto): Observable<Demande> {
    return this.http.post<Demande>(this.apiUrl, dto);
  }

  // Créer une demande prioritaire
  createPrioritaire(dto: CreateDemandeDto): Observable<Demande> {
    return this.http.post<Demande>(`${this.apiUrl}/prioritaire`, dto);
  }

  // Mettre à jour une demande
  update(id: number, dto: UpdateDemandeDto): Observable<void> {
    const url = `${this.apiUrl}/${id}`;
    return this.http.put<void>(url, dto);
  }

  // Supprimer une demande
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Récupérer les utilisateurs
  getUtilisateurs(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.utilisateursUrl);
  }
}
