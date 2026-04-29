import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Bobine {
  id: number;
  referenceBobine: string;
  statut: 'DISPONIBLE' | 'RESERVEE' | 'EN_PRELEVEMENT' | 'EN_COURS' | 'EPUISEE';
  emplacementActuelId?: number;
  coordonneeEmplacement?: string;
  utilisateurReserveurId?: number;
  dateCreation: Date;
  dateMiseAJour?: Date;
}

export interface CreateBobineDto {
  referenceBobine: string;
  emplacementActuelId?: number;
}

export interface UpdateBobineDto {
  referenceBobine: string;
  emplacementActuelId?: number;
}

export interface EmplacementStockage {
  id: number;
  codeZone: string;
  coordonneeEmplacement: string;
  statut: string;
}

@Injectable({
  providedIn: 'root'
})
export class BobineService {
  private readonly apiUrl = 'http://localhost:5057/api/Bobines';
  private readonly emplacementsUrl = 'http://localhost:5057/api/EmplacementsStockage';

  constructor(private http: HttpClient) {}

  // Récupérer toutes les bobines
  getAll(): Observable<Bobine[]> {
    return this.http.get<Bobine[]>(this.apiUrl);
  }

  // Récupérer une bobine par ID
  getById(id: number): Observable<Bobine> {
    return this.http.get<Bobine>(`${this.apiUrl}/${id}`);
  }

  // Créer une bobine
  create(dto: CreateBobineDto): Observable<Bobine> {
    return this.http.post<Bobine>(this.apiUrl, dto);
  }

  // Mettre à jour une bobine
  update(id: number, dto: UpdateBobineDto): Observable<void> {
    const url = `${this.apiUrl}/${id}`;
    console.log('PUT Bobine - URL:', url);
    console.log('PUT Bobine - DTO:', dto);
    
    return this.http.put<void>(url, dto);
  }

  // Supprimer une bobine
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Forcer la suppression d'une bobine (admin uniquement)
  forceDelete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/force`);
  }

  // Réserver une bobine
  reserver(id: number, utilisateurId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reserver`, { utilisateurId });
  }

  // Libérer une bobine
  liberer(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/liberer`, {});
  }

  // Récupérer tous les emplacements vides
  getEmplacementsVides(): Observable<EmplacementStockage[]> {
    return this.http.get<EmplacementStockage[]>(`${this.emplacementsUrl}/vides`);
  }

  // Récupérer les bobines disponibles
  getBobinesDisponibles(): Observable<Bobine[]> {
    return this.http.get<Bobine[]>(`${this.apiUrl}/disponibles`);
  }
}
