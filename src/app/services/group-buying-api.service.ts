import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BundleDealDetect,
  CampaignLobby,
  CreateCampaignPayload
} from '../models/group-buying.model';

@Injectable({ providedIn: 'root' })
export class GroupBuyingApiService {
  private base = `${environment.apiBaseUrl}/api/shoppe/group-buy`;

  constructor(private http: HttpClient) {}

  detect(url: string): Observable<BundleDealDetect> {
    return this.http.post<BundleDealDetect>(`${this.base}/detect`, { url });
  }

  create(payload: CreateCampaignPayload): Observable<CampaignLobby> {
    return this.http.post<CampaignLobby>(`${this.base}/campaigns`, payload);
  }

  getLobby(campaignId: number): Observable<CampaignLobby> {
    return this.http.get<CampaignLobby>(`${this.base}/campaigns/${campaignId}`);
  }

  join(campaignId: number, displayName?: string): Observable<CampaignLobby> {
    return this.http.post<CampaignLobby>(`${this.base}/campaigns/${campaignId}/join`, {
      displayName
    });
  }
}
