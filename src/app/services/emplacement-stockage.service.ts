import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmplacementStockage {
  id: number;
  codeZone: string;
  numeroRangee: number;
  numeroColonne: number;
  coordonneeEmplacement: string;  // ex: "A-01-02"
  statut: string;  // "OCCUPE" ou "VIDE"
  bobineId?: number;
  estActif: boolean;
}

export interface Bobine {
  id: number;
  referenceBobine: string;
  statut: 'DISPONIBLE' | 'RESERVEE' | 'EN_PRELEVEMENT' | 'EN_COURS' | 'EPUISEE';
  emplacementActuelId?: number;
  coordonneeEmplacement?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmplacementStockageService {
  private apiUrl = `${environment.stockApiUrl}/EmplacementsStockage`;
  private bobinesUrl = `${environment.stockApiUrl}/Bobines`;

  constructor(private http: HttpClient) {}

  // Récupérer tous les emplacements de stockage
  getAll(): Observable<EmplacementStockage[]> {
    return this.http.get<EmplacementStockage[]>(this.apiUrl);
  }

  // Récupérer les emplacements par zone
  getByZone(codeZone: string): Observable<EmplacementStockage[]> {
    return this.http.get<EmplacementStockage[]>(`${this.apiUrl}/zone/${codeZone}`);
  }

  // Récupérer les bobines disponibles
  getBobinesDisponibles(): Observable<Bobine[]> {
    return this.http.get<Bobine[]>(`${this.bobinesUrl}/disponibles`);
  }

  // Récupérer toutes les bobines
  getAllBobines(): Observable<Bobine[]> {
    return this.http.get<Bobine[]>(this.bobinesUrl);
  }

  // Créer des emplacements en masse pour une zone
  createEmplacementsForZone(emplacements: EmplacementStockage[]): Observable<EmplacementStockage[]> {
    return this.http.post<EmplacementStockage[]>(`${this.apiUrl}/bulk`, emplacements);
  }

  // Créer un seul emplacement
  create(emplacement: EmplacementStockage): Observable<EmplacementStockage> {
    return this.http.post<EmplacementStockage>(this.apiUrl, emplacement);
  }

  // Supprimer les emplacements par zone
  deleteByZone(codeZone: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/zone/${codeZone}`);
  }

  // Supprimer un seul emplacement
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Créer une bobine
  createBobine(bobineData: any): Observable<any> {
    return this.http.post<any>(this.bobinesUrl, bobineData);
  }

  // Supprimer une bobine
  deleteBobine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.bobinesUrl}/${id}`);
  }

  // Mettre à jour une bobine
  updateBobine(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.bobinesUrl}/${id}`, data);
  }

  // Mettre à jour un emplacement
  update(id: number, emplacement: EmplacementStockage): Observable<EmplacementStockage> {
    return this.http.put<EmplacementStockage>(`${this.apiUrl}/${id}`, emplacement);
  }

  // Retourner une bobine au stock
  retourStock(retourStockDto: { bobineId: number, emplacementVideId: number }): Observable<any> {
    return this.http.post<any>(`${this.bobinesUrl}/retour-stock`, retourStockDto);
  }
}
