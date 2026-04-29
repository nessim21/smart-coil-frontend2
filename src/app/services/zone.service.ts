import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Zone {
  id: string;
  codeZone: string;
  nom: string;
  description?: string;
  nombreRangees: number;
  nombreColonnes: number;
  capaciteMax?: number;
  dateCreation?: string;
}

export interface CreateZoneDto {
  codeZone: string;
  nom: string;
  description: string | null;
  nombreRangees?: number;
  nombreColonnes?: number;
}

export interface UpdateZoneDto {
  codeZone: string;
  nom: string;
  description: string | null;
  nombreRangees?: number;
  nombreColonnes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ZoneService {
  private apiUrl = `${environment.stockApiUrl}/Zones`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Zone[]> {
    return this.http.get<Zone[]>(this.apiUrl);
  }

  create(dto: CreateZoneDto): Observable<Zone> {
    console.log('=== DÉTAILS CRÉATION ZONE ===');
    console.log('URL:', this.apiUrl);
    console.log('DTO envoyé:', dto);
    console.log('DTO JSON stringifié:', JSON.stringify(dto));
    console.log('================================');
    
    return this.http.post<Zone>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateZoneDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getById(id: string): Observable<Zone> {
    return this.http.get<Zone>(`${this.apiUrl}/${id}`);
  }
}
