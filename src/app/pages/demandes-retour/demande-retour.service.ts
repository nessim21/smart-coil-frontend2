import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DemandeRetour {
  id: number;
  bobineId: number;
  demandeId: number;
  utilisateurId?: number;        // Alimentateur assigné (optionnel)
  operateurId?: number;          // Opérateur qui a livré (optionnel)
  statut: 'GRIS' | 'ACTIF' | 'TERMINE';
  dateCreation: Date;
  dateExecution?: Date;          // Date d'exécution par alimentateur
  dateTerminaison?: Date;        // Date de terminaison
  notes?: string;                // Notes additionnelles
}

export interface CreateDemandeRetourDto {
  bobineId: number;
  demandeId: number;
  utilisateurId?: number;         // Optionnel (sera assigné plus tard)
  operateurId?: number;          // Optionnel
  notes?: string;
}


export interface ExecuteRetourDto {
  utilisateurId?: number;         // ID de l'alimentateur (optionnel)
  emplacementRetourId?: number;  // Emplacement de retour (optionnel)
}

@Injectable({
  providedIn: 'root'
})
export class DemandeRetourService {
  private apiUrl = 'http://localhost:5206/api/DemandesRetour';

  constructor(private http: HttpClient) {}

  // Récupérer toutes les demandes de retour
  getAll(): Observable<DemandeRetour[]> {
    return this.http.get<DemandeRetour[]>(this.apiUrl);
  }

  // Récupérer une demande de retour par ID
  getById(id: number): Observable<DemandeRetour> {
    return this.http.get<DemandeRetour>(`${this.apiUrl}/${id}`);
  }

  // Récupérer les demandes de retour assignées à un utilisateur (alimentateur)
  getByUtilisateur(utilisateurId: number): Observable<DemandeRetour[]> {
    return this.http.get<DemandeRetour[]>(`${this.apiUrl}/utilisateur/${utilisateurId}`);
  }

  // Récupérer les demandes de retour créées par un opérateur
  getByOperateur(operateurId: number): Observable<DemandeRetour[]> {
    return this.http.get<DemandeRetour[]>(`${this.apiUrl}/operateur/${operateurId}`);
  }

  // Récupérer les demandes de retour assignées à un alimentateur
  getByAlimentateur(alimentateurId: number): Observable<DemandeRetour[]> {
    return this.http.get<DemandeRetour[]>(`${this.apiUrl}/alimentateur/${alimentateurId}`);
  }

  // Créer une nouvelle demande de retour
  create(dto: CreateDemandeRetourDto): Observable<DemandeRetour> {
    return this.http.post<DemandeRetour>(this.apiUrl, dto);
  }

  
  // Exécuter une demande de retour
  execute(id: number, dto: ExecuteRetourDto): Observable<DemandeRetour> {
    return this.http.post<DemandeRetour>(`${this.apiUrl}/${id}/executer`, dto);
  }

  // Activer une demande de retour (GRIS → ACTIF)
  activer(id: number): Observable<DemandeRetour> {
    return this.http.put<DemandeRetour>(`${this.apiUrl}/${id}/activer`, {});
  }
}
