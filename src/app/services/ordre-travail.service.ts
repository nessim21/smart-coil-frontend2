import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OrdreTravail {
  id: number;
  idMachine: string;
  numeroOrdre: string;
  referenceBobine: string;
  utilisateurId: number;
  quantiteRequise: number;
  statut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE';
  dateCreation: Date;
  dateTerminaison?: Date;
}

export interface CreateOrdreTravailDto {
  idMachine: string;
  referenceBobine: string;
  utilisateurId: number;
  quantiteRequise: number;
}

export interface UpdateOrdreTravailDto {
  idMachine?: string;
  numeroOrdre?: string;
  referenceBobine?: string;
  utilisateurId?: number;
  quantiteRequise?: number;
  statut?: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE';
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

@Injectable({
  providedIn: 'root'
})
export class OrdreTravailService {
  private apiUrl = 'http://localhost:5206/api/OrdresTravail';
  private utilisateursUrl = 'http://localhost:5268/api/Utilisateurs';

  constructor(private http: HttpClient) {}

  // Récupérer tous les ordres de travail
  getOrdresTravail(): Observable<OrdreTravail[]> {
    return this.http.get<OrdreTravail[]>(this.apiUrl);
  }

  // Récupérer un ordre par ID
  getOrdreTravail(id: number): Observable<OrdreTravail> {
    return this.http.get<OrdreTravail>(`${this.apiUrl}/${id}`);
  }

  // Récupérer les ordres par opérateur
  getOrdresParUtilisateur(utilisateurId: number): Observable<OrdreTravail[]> {
    return this.http.get<OrdreTravail[]>(`${this.apiUrl}/utilisateur/${utilisateurId}`);
  }

  // Récupérer les ordres de travail en attente
  getOrdresTravailEnAttente(): Observable<OrdreTravail[]> {
    return this.http.get<OrdreTravail[]>(`${this.apiUrl}/en-attente`);
  }

  // Récupérer les ordres par machine
  getOrdresParMachine(idMachine: string): Observable<OrdreTravail[]> {
    return this.http.get<OrdreTravail[]>(`${this.apiUrl}/machine/${idMachine}`);
  }

  // Créer un ordre de travail
  create(dto: CreateOrdreTravailDto): Observable<OrdreTravail> {
    return this.http.post<OrdreTravail>(this.apiUrl, dto);
  }

  // Mettre à jour un ordre de travail
  update(id: number, dto: UpdateOrdreTravailDto): Observable<void> {
    const url = `${this.apiUrl}/${id}`;
    return this.http.put<void>(url, dto);
  }

  // Supprimer un ordre de travail
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Récupérer la liste des utilisateurs pour le select
  getUtilisateurs(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.utilisateursUrl);
  }
}
