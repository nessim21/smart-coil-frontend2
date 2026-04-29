import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface CreateUtilisateurDto {
  nomUtilisateur: string;
  motDePasse: string;
  codeBadge?: string;
  telephone?: string;
  bureau?: string;
}

export interface UpdateUtilisateurDto {
  nomUtilisateur: string;
  codeBadge?: string;
  telephone?: string;
  bureau?: string;
  estActif: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UtilisateurService {
  private apiUrl = `${environment.userApiUrl}/Utilisateurs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.apiUrl);
  }

  create(dto: CreateUtilisateurDto): Observable<Utilisateur> {
    return this.http.post<Utilisateur>(this.apiUrl, dto);
  }

  update(id: number, dto: UpdateUtilisateurDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getById(id: number): Observable<Utilisateur> {
    return this.http.get<Utilisateur>(`${this.apiUrl}/${id}`);
  }
}
